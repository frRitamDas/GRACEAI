import { NextResponse } from "next/server";
import { z } from "zod";

import { clientKey, jsonError, parseJson, rateLimit } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DEFAULT_MODEL_ID,
  EFFORT_LEVELS,
  getModel,
  pickModelForEffort,
  PROVIDERS,
  type ProviderId,
} from "@/lib/ai/catalog";
import { configuredProviders, getProviderKey, keyServesModel } from "@/lib/ai/env";
import { cachedCatalog, storeCatalog } from "@/lib/ai/catalog-cache";
import { loadCatalog } from "@/lib/ai/discovery";
import { streamChat, titleFrom, type ChatAttachment, type ChatTurn } from "@/lib/ai/chat";
import {
  addMessage,
  createConversation,
  getConversation,
  getUsage,
  listMessages,
  recordUsage,
  renameConversation,
} from "@/lib/db/store";

export const maxDuration = 300;

const attachmentSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().max(200),
  mime: z.string().max(120),
  text: z.string().max(200_000).optional(),
  dataUrl: z.string().max(6_000_000).optional(),
});

const schema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().max(20_000).default(""),
  attachments: z.array(attachmentSchema).max(6).default([]),
  effort: z.number().int().min(0).max(EFFORT_LEVELS.length - 1).optional(),
  model: z.string().max(120).nullable().optional(),
  deepResearch: z.boolean().optional(),
});

/** Credits for a turn: base model cost, scaled by effort, plus add-ons. */
function costFor(modelCredits: number, effort: number, deepResearch: boolean) {
  const effortMultiplier = [1, 1, 1.5, 2, 3][effort] ?? 1;
  return Math.max(1, Math.round(modelCredits * effortMultiplier) + (deepResearch ? 25 : 0));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to send a message.", 401);

  const limited = rateLimit(clientKey(request, `chat:${user.id}`), 30, 60_000);
  if (!limited.ok) {
    return jsonError(`You are sending messages quickly. Try again in ${limited.retryAfter}s.`, 429);
  }

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;
  if (!body.message && body.attachments.length === 0) {
    return jsonError("Write a message first.");
  }

  const effort = body.effort ?? user.effort ?? 0;
  const ready = await configuredProviders();

  if (ready.size === 0) {
    return jsonError(
      user.isAdmin
        ? "No provider is connected yet. Add an OpenRouter, Groq or Google AI Studio key in the admin console."
        : "No provider is available yet. The owner needs to connect one before chats can run.",
      503,
      { code: "no_provider" }
    );
  }

  // Route against the live catalog, not the bundled one: a model discovered
  // from the provider (including free ones) must be sendable too.
  // Reuse the shared cache when warm; discovery is three provider round-trips.
  const cached = cachedCatalog();
  const built = cached ?? (await loadCatalog());
  if (!cached) storeCatalog(built);
  const catalog = built.models;

  let model =
    getModel(body.model, catalog) ??
    // An unknown id on a provider we can reach is still valid: the model may be
    // newer than our catalog. Trust the provider prefix and let it answer.
    (body.model && ready.has(body.model.split("/")[0] as ProviderId)
      ? {
          id: body.model,
          name: body.model.split("/").slice(1).join("/"),
          provider: body.model.split("/")[0] as ProviderId,
          upstream: body.model.split("/").slice(1).join("/"),
          tier: 3,
          credits: 1,
          contextLabel: "",
          blurb: "",
        }
      : null) ??
    pickModelForEffort(effort, (user.provider as ProviderId) ?? "openrouter", ready, catalog);

  if (!ready.has(model.provider)) {
    model = pickModelForEffort(effort, "openrouter", ready, catalog);
  }

  const key = await getProviderKey(model.provider);
  if (!key) {
    return jsonError(
      user.isAdmin
        ? `${PROVIDERS[model.provider].label} is not connected. Add its key in the admin console.`
        : `${PROVIDERS[model.provider].label} is not available right now. Pick another model.`,
      503,
      { code: "no_provider" }
    );
  }

  // The key may be restricted to a subset of the provider's models.
  if (!(await keyServesModel(model.provider, model.id))) {
    return jsonError(
      `${model.name} is not enabled for the shared ${PROVIDERS[model.provider].label} key, so it cannot run. Pick another model.`,
      403,
      { code: "model_not_allowed" }
    );
  }

  // Owners (unlimited) see the cost of each answer but are never blocked or charged.
  const billed = !user.unlimited;
  const cost = billed ? costFor(model.credits, effort, Boolean(body.deepResearch)) : 0;
  const available = user.credits;
  if (billed && available < cost) {
    return jsonError("You're out of credits this month.", 402, {
      code: "out_of_credits",
      needed: cost,
      available,
    });
  }

  // Conversation: reuse the one given, or create it with a title from the prompt.
  let conversationId = body.conversationId ?? null;
  let isNew = false;
  if (conversationId) {
    const existing = await getConversation(user.id, conversationId);
    if (!existing) return jsonError("That chat no longer exists.", 404);
  } else {
    const conversation = await createConversation(user.id, titleFrom(body.message || "New chat"));
    conversationId = conversation.id;
    isNew = true;
  }

  const attachments: ChatAttachment[] = body.attachments.map((a) => ({
    name: a.name,
    mime: a.mime,
    text: a.text,
    dataUrl: a.dataUrl,
  }));

  const history = await listMessages(conversationId);
  const turns: ChatTurn[] = history
    .filter((m) => !m.error && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  const userContent = body.message || "Review the attached files.";
  turns.push({ role: "user", content: userContent });

  await addMessage({
    conversationId,
    role: "user",
    content: userContent,
    attachments: attachments.map((a) => ({ name: a.name, mime: a.mime })),
  });

  // Rename placeholder titles once the first real prompt arrives.
  if (!isNew && history.length === 0) {
    await renameConversation(user.id, conversationId, titleFrom(userContent));
  }

  const encoder = new TextEncoder();
  let full = "";
  let failed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      send({
        type: "meta",
        conversationId,
        model: {
          id: model.id,
          name: model.name,
          provider: model.provider,
          providerLabel: PROVIDERS[model.provider].label,
        },
        effort,
        cost,
      });

      try {
        for await (const event of streamChat({
          key,
          model,
          effortIndex: effort,
          turns,
          attachments,
          signal: request.signal,
        })) {
          if (event.type === "status") send({ type: "status", label: event.label });
          if (event.type === "delta") {
            full += event.text;
            send({ type: "delta", text: event.text });
          }
          if (event.type === "error") {
            failed = true;
            send({ type: "error", message: event.message, retryable: event.retryable });
          }
          if (event.type === "done") send({ type: "done" });
        }
      } catch (error) {
        failed = true;
        send({
          type: "error",
          message:
            error instanceof Error && error.name === "AbortError"
              ? "Stopped."
              : "Something went wrong on the way to the model. Try again.",
          retryable: true,
        });
      }

      if (full.trim().length > 0) {
        await addMessage({
          conversationId: conversationId!,
          role: "assistant",
          content: full,
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
          effort,
          credits: cost,
          error: false,
        });
        // Charge for delivered work, even a partial answer the user stopped.
        if (billed) {
          await recordUsage(user.id, cost);
          send({ type: "saved", credits: cost });
        }
      } else if (failed) {
        await addMessage({
          conversationId: conversationId!,
          role: "assistant",
          content: "",
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
          effort,
          credits: 0,
          error: true,
        });
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ usage: null });
  const usage = await getUsage(user.id);
  return NextResponse.json({
    usage,
    credits: user.credits,
    defaultModel: DEFAULT_MODEL_ID,
  });
}
