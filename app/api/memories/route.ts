import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { addMemory, deleteMemory, listMemories } from "@/lib/db/social";
import { featureEnabled } from "@/lib/settings";
import { jsonError } from "@/lib/api";

/**
 * Saved memories.
 *
 * These are facts the user typed and confirmed. They are appended to the chat
 * system prompt on the server, so nothing here is sent to a model that the user
 * did not write themselves. No extraction, no guesses.
 */

const schema = z.object({ body: z.string().trim().min(1).max(400) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ memories: [] });
  if (!(await featureEnabled("memory"))) return jsonError("Memory is turned off on this deployment.", 403, { code: "feature_off" });
  return NextResponse.json(
    { memories: await listMemories(user.id) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("memory"))) return jsonError("Memory is turned off on this deployment.", 403, { code: "feature_off" });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Write what Grace should remember." }, { status: 400 });
  }

  const memory = await addMemory(user.id, body.body);
  if (!memory) return NextResponse.json({ error: "That could not be saved." }, { status: 400 });
  return NextResponse.json({ memory });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("memory"))) return jsonError("Memory is turned off on this deployment.", 403, { code: "feature_off" });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Send a memory id." }, { status: 400 });

  const removed = await deleteMemory(user.id, id);
  if (!removed) return NextResponse.json({ error: "That memory is already gone." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
