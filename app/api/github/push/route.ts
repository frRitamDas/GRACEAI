import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getProject, listFiles } from "@/lib/code/store";
import { commitFiles, readRepoFiles } from "@/lib/github/client";

/**
 * Writes a project's files back to its GitHub repository.
 *
 * The shas are re-read from GitHub at push time rather than trusted from the
 * import. A project imported an hour ago would otherwise carry stale blob shas,
 * and the write would fail with a conflict; re-reading also means a file that
 * changed on GitHub since the import is caught before anything is overwritten.
 *
 * Only files named in the request are pushed. Sending the whole project would
 * turn an untouched import into a commit that says nothing changed.
 */

const schema = z.object({
  projectId: z.string().min(1).max(64),
  paths: z.array(z.string().min(1).max(200)).min(1).max(40),
  message: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Choose at least one file to push." }, { status: 400 });
  }

  const project = await getProject(user.id, body.projectId);
  if (!project) return NextResponse.json({ error: "That project is gone." }, { status: 404 });
  if (!project.repo) {
    return NextResponse.json(
      { error: "This project is not linked to a repository." },
      { status: 400 }
    );
  }

  const files = await listFiles(project.id);
  const wanted = new Set(body.paths);
  const selected = files.filter((f) => wanted.has(f.path));
  if (selected.length === 0) {
    return NextResponse.json({ error: "None of those files exist here." }, { status: 400 });
  }

  // The remote is the authority on what a file's current sha is.
  const remote = await readRepoFiles(
    user.id,
    project.repo.owner,
    project.repo.name,
    project.repo.branch
  );
  if (remote.error) {
    return NextResponse.json({ error: remote.error }, { status: 400 });
  }
  const shas = new Map(remote.files.map((f) => [f.path, f.sha]));

  const result = await commitFiles(
    user.id,
    project.repo.owner,
    project.repo.name,
    project.repo.branch,
    selected.map((f) => ({ path: f.path, content: f.content, sha: shas.get(f.path) ?? null })),
    body.message || `Grace Code: update ${selected.length} file${selected.length === 1 ? "" : "s"}`
  );

  if (result.error) {
    return NextResponse.json({ error: result.error, written: result.written }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    written: result.written,
    url: `https://github.com/${project.repo.owner}/${project.repo.name}/tree/${project.repo.branch}`,
  });
}
