import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { createConversation, listConversations } from "@/lib/db/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ conversations: [] });
  const conversations = await listConversations(user.id);
  return NextResponse.json({ conversations });
}

const schema = z.object({ title: z.string().trim().max(120).optional() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to start a chat.", 401);

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;

  const conversation = await createConversation(user.id, body.title || "New chat");
  return NextResponse.json({ conversation });
}
