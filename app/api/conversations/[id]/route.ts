import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteConversation, getConversation, listMessages, renameConversation } from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to open that chat.", 401);

  const { id } = await params;
  const conversation = await getConversation(user.id, id);
  if (!conversation) return jsonError("That chat no longer exists.", 404);

  // Message rows retain private routing metadata for owner-side accounting,
  // but the user's transcript needs only the content and its attachments.
  const messages = (await listMessages(id)).map(({ id: messageId, role, content, attachments, error, createdAt }) => ({
    id: messageId,
    role,
    content,
    attachments,
    error,
    createdAt,
  }));
  return NextResponse.json({ conversation, messages });
}

const patchSchema = z.object({ title: z.string().trim().min(1).max(120) });

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to rename that chat.", 401);

  const { id } = await params;
  const body = await parseJson(request, patchSchema);
  if (body instanceof NextResponse) return body;

  const conversation = await getConversation(user.id, id);
  if (!conversation) return jsonError("That chat no longer exists.", 404);

  await renameConversation(user.id, id, body.title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to delete that chat.", 401);

  const { id } = await params;
  await deleteConversation(user.id, id);
  return NextResponse.json({ ok: true });
}
