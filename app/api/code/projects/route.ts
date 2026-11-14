import { NextResponse } from "next/server";
import { z } from "zod";

import { createProject, deleteProject, listProjects } from "@/lib/code/store";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Grace Code projects.
 *
 * Every handler scopes by the session user, so a project id from another account
 * is indistinguishable from one that does not exist.
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  language: z.enum(["javascript", "typescript", "python", "html", "go"]).default("javascript"),
  instructions: z.string().max(2000).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const projects = await listProjects(user.id);
  return NextResponse.json(
    { projects },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
  }

  const project = await createProject(user.id, body);
  return NextResponse.json({ project });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Send a project id." }, { status: 400 });

  await deleteProject(user.id, id);
  return NextResponse.json({ ok: true });
}
