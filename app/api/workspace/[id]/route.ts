import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { readRepoFiles } from "@/lib/github/client";
import { getConversation } from "@/lib/db/store";
import {
  clearWorkspaceFiles,
  listWorkspaceFiles,
  setWorkspaceRepo,
  writeWorkspaceFile,
} from "@/lib/workspace/store";
import { featureEnabled } from "@/lib/settings";

/**
 * A chat's workspace: an optional repository plus the files that came with it.
 *
 * GET is what the chat shell calls when a conversation opens, and again the
 * moment a turn writes files. PUT attaches a repo (importing its text files) or,
 * with `repo: null`, detaches it. The two are separate verbs on purpose:
 * attaching is the expensive, side-effecting one.
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in first.", 401);
  if (!(await featureEnabled("graceCode"))) return jsonError("Grace Code is turned off on this deployment.", 403, { code: "feature_off" });

  const { id } = await params;
  const conversation = await getConversation(user.id, id);
  if (!conversation) return jsonError("That chat no longer exists.", 404);

  const files = await listWorkspaceFiles(id);
  return NextResponse.json({
    repo: conversation.repo,
    files: files.map((f) => ({ path: f.path, content: f.content, updatedAt: f.updatedAt })),
  });
}

const attachSchema = z.object({
  repo: z
    .object({
      owner: z.string().trim().min(1).max(120),
      name: z.string().trim().min(1).max(160),
      branch: z.string().trim().min(1).max(160),
    })
    .nullable(),
});

export async function PUT(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in first.", 401);
  if (!(await featureEnabled("graceCode"))) return jsonError("Grace Code is turned off on this deployment.", 403, { code: "feature_off" });

  const { id } = await params;
  const conversation = await getConversation(user.id, id);
  if (!conversation) return jsonError("That chat no longer exists.", 404);

  const body = await parseJson(request, attachSchema);
  if (body instanceof NextResponse) return body;

  if (!body.repo) {
    await setWorkspaceRepo(id, null);
    await clearWorkspaceFiles(id);
    return NextResponse.json({ repo: null, files: [] });
  }

  const read = await readRepoFiles(user.id, body.repo.owner, body.repo.name, body.repo.branch);
  if (read.error) return jsonError(read.error, 400);

  // A workspace that changes repo starts clean: keeping files from the old one
  // would let a later push write them into a repository they never came from.
  await clearWorkspaceFiles(id);
  await setWorkspaceRepo(id, body.repo);

  let written = 0;
  for (const file of read.files) {
    if (await writeWorkspaceFile(id, file.path, file.content, file.sha)) written += 1;
  }

  const files = await listWorkspaceFiles(id);
  return NextResponse.json({
    repo: body.repo,
    files: files.map((f) => ({ path: f.path, content: f.content, updatedAt: f.updatedAt })),
    truncated: read.truncated,
    imported: written,
  });
}
