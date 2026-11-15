import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteFile,
  getProject,
  listFiles,
  listMessages,
  safePath,
  updateProject,
  writeFile,
} from "@/lib/code/store";
import { getCurrentUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { featureEnabled } from "@/lib/settings";

/**
 * One project: its files, its transcript, and direct file edits.
 *
 * The agent path (`/api/code/chat`) applies its own patches, but a person also
 * needs to fix a typo without asking a model to do it, so the same validated
 * write path is exposed here.
 */

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  instructions: z.string().max(2000).optional(),
  // Write or delete a single file directly from the editor.
  file: z
    .object({
      path: z.string().min(1).max(200),
      content: z.string().max(400_000).optional(),
      remove: z.boolean().optional(),
    })
    .optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("projects"))) return jsonError("Projects are turned off on this deployment.", 403, { code: "feature_off" });

  const { id } = await context.params;
  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "That project is gone." }, { status: 404 });

  const [files, messages] = await Promise.all([listFiles(id), listMessages(id)]);
  return NextResponse.json(
    { project, files, messages },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("projects"))) return jsonError("Projects are turned off on this deployment.", 403, { code: "feature_off" });

  const { id } = await context.params;
  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "That project is gone." }, { status: 404 });

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That change did not make sense." }, { status: 400 });
  }

  if (body.name !== undefined || body.instructions !== undefined) {
    await updateProject(user.id, id, { name: body.name, instructions: body.instructions });
  }

  if (body.file) {
    const path = safePath(body.file.path);
    if (!path) return NextResponse.json({ error: "That file name is not allowed." }, { status: 400 });
    if (body.file.remove) {
      await deleteFile(id, path);
    } else {
      await writeFile(id, path, body.file.content ?? "");
    }
  }

  const [files, messages] = await Promise.all([listFiles(id), listMessages(id)]);
  return NextResponse.json({ ok: true, files, messages });
}
