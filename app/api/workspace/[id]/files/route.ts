import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversation } from "@/lib/db/store";
import {
  deleteWorkspaceFile,
  listWorkspaceFiles,
  safeWorkspacePath,
  writeWorkspaceFile,
} from "@/lib/workspace/store";
import { featureEnabled } from "@/lib/settings";

/** Editing a chat workspace's files directly, without spending a model turn. */

type Params = { params: Promise<{ id: string }> };

async function owned(conversationId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first.", status: 401 as const, user: null };
  if (!(await featureEnabled("graceCode"))) {
    return { error: "Grace Code is turned off on this deployment.", status: 403 as const, user: null };
  }
  const conversation = await getConversation(user.id, conversationId);
  if (!conversation) return { error: "That chat no longer exists.", status: 404 as const, user: null };
  return { error: null, status: 200 as const, user };
}

const putSchema = z.object({
  path: z.string().min(1).max(240),
  content: z.string().max(400_000),
});

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const check = await owned(id);
  if (check.error) return jsonError(check.error, check.status);

  const body = await parseJson(request, putSchema);
  if (body instanceof NextResponse) return body;

  // Validate here as well as in the store: a rejection should say why.
  if (!safeWorkspacePath(body.path)) {
    return jsonError("That file path is not allowed. Use a relative path like src/app.ts.");
  }

  if (!(await writeWorkspaceFile(id, body.path, body.content))) {
    return jsonError("That file could not be saved.", 500);
  }

  const files = await listWorkspaceFiles(id);
  return NextResponse.json({
    files: files.map((f) => ({ path: f.path, content: f.content, updatedAt: f.updatedAt })),
  });
}

const deleteSchema = z.object({ path: z.string().min(1).max(240) });

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const check = await owned(id);
  if (check.error) return jsonError(check.error, check.status);

  const body = await parseJson(request, deleteSchema);
  if (body instanceof NextResponse) return body;

  await deleteWorkspaceFile(id, body.path);
  const files = await listWorkspaceFiles(id);
  return NextResponse.json({
    files: files.map((f) => ({ path: f.path, content: f.content, updatedAt: f.updatedAt })),
  });
}
