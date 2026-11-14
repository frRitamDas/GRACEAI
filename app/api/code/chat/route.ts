import { NextResponse } from "next/server";
import { z } from "zod";

import { clientKey, jsonError, rateLimit } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { getProject, listFiles, listMessages, addMessage, runCodeTurn } from "@/lib/code/store";
import { recordUsage } from "@/lib/db/store";

/**
 * The Grace Code agent turn.
 *
 * Same shape as the chat route — NDJSON over a stream — because the client
 * already knows how to read it, and because a coding reply takes long enough
 * that waiting for a whole JSON body would feel broken.
 *
 * What is different: the agent is handed the project's files, and it returns
 * file replacements that this route applies after the stream ends.
 */

export const maxDuration = 300;

const schema = z.object({
  projectId: z.string().min(1).max(64),
  message: z.string().trim().min(1).max(20_000),
  model: z.string().max(120).nullable().optional(),
  /** File the user has open: the agent reads that one first. */
  focus: z.string().max(400).nullable().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to use Grace Code.", 401);

  const limited = await rateLimit(clientKey(request, user.id), 40, 60_000);
  if (!limited.ok) return jsonError("Too many requests. Give it a moment.", 429);

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return jsonError("Write a message first.", 400);
  }

  const project = await getProject(user.id, body.projectId);
  if (!project) return jsonError("That project is gone.", 404);

  // Owners are never blocked or charged; everyone else pays per turn.
  const cost = user.unlimited ? 0 : 2;
  if (!user.unlimited && user.credits < cost) {
    return jsonError("You're out of credits this month.", 402, {
      code: "out_of_credits",
      needed: cost,
      available: user.credits,
    });
  }

  const [files, history] = await Promise.all([
    listFiles(project.id),
    listMessages(project.id),
  ]);

  await addMessage({ projectId: project.id, role: "user", content: body.message });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      let produced = false;

      try {
        for await (const event of runCodeTurn({
          project,
          files,
          history,
          prompt: body.message,
          preferredModel: body.model ?? user.model,
          focus: body.focus ?? null,
          signal: request.signal,
        })) {
          if (event.type === "done") produced = true;
          send(event as unknown as Record<string, unknown>);
        }
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof Error && error.name === "AbortError"
              ? "Stopped."
              : "Something went wrong on the way to the model. Try again.",
        });
      }

      if (produced && !user.unlimited) {
        await recordUsage(user.id, cost);
        send({ type: "saved", credits: cost });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
