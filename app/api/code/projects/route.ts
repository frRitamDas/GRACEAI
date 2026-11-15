import { NextResponse } from "next/server";
import { z } from "zod";

import { createProject, deleteProject, getProject, listProjects } from "@/lib/code/store";
import { shareProjectWith } from "@/lib/db/social";
import { getCurrentUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { featureEnabled } from "@/lib/settings";

/**
 * Grace Code projects.
 *
 * Every handler scopes by the session user, so a project id from another account
 * is indistinguishable from one that does not exist — except when it was shared,
 * which listProjects() reports explicitly.
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  language: z.enum(["javascript", "typescript", "python", "html", "go"]).default("javascript"),
  instructions: z.string().max(2000).optional(),
});

const shareSchema = z.object({ email: z.string().trim().email().max(200) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("projects"))) return jsonError("Projects are turned off on this deployment.", 403, { code: "feature_off" });

  const projects = await listProjects(user.id);
  return NextResponse.json(
    { projects },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("projects"))) return jsonError("Projects are turned off on this deployment.", 403, { code: "feature_off" });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Give the project a name." }, { status: 400 });
  }

  const project = await createProject(user.id, body);
  return NextResponse.json({ project: { ...project, access: "owner" as const } });
}

/** Share a project with another Grace account, by email. Owner only. */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("projects"))) return jsonError("Projects are turned off on this deployment.", 403, { code: "feature_off" });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Send a project id." }, { status: 400 });

  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "That project no longer exists." }, { status: 404 });
  if (project.access === "shared") {
    return NextResponse.json({ error: "Only the owner can share this project." }, { status: 403 });
  }

  let body: z.infer<typeof shareSchema>;
  try {
    body = shareSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter the email on their Grace account." }, { status: 400 });
  }

  const result = await shareProjectWith(user.id, id, body.email);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, email: body.email.trim().toLowerCase() });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await featureEnabled("projects"))) return jsonError("Projects are turned off on this deployment.", 403, { code: "feature_off" });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Send a project id." }, { status: 400 });

  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "That project no longer exists." }, { status: 404 });
  if (project.access === "shared") {
    return NextResponse.json({ error: "Only the owner can delete this project." }, { status: 403 });
  }

  await deleteProject(user.id, id);
  return NextResponse.json({ ok: true });
}
