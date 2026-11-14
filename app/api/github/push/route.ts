import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { getProject, listFiles } from "@/lib/code/store";
import { getConversation } from "@/lib/db/store";
import { commitFiles, readRepoFiles } from "@/lib/github/client";
import { listWorkspaceFiles } from "@/lib/workspace/store";

/**
 * Writes files back to GitHub.
 *
 * Two callers, one behaviour: a Grace Code project pushes the files it was told
 * to push, and a chat workspace pushes its whole working tree. Both re-read the
 * remote shas first. A project imported an hour ago would otherwise carry stale
 * blob shas and fail with a conflict; re-reading also catches a file that
 * changed on GitHub since the import before anything is overwritten.
 *
 * Only files that are actually wanted are sent. Dumping the whole tree would
 * turn an untouched import into a commit that changed nothing.
 */

const schema = z.union([
  z.object({
    projectId: z.string().min(1).max(64),
    paths: z.array(z.string().min(1).max(240)).min(1).max(40),
    message: z.string().trim().max(200).optional(),
  }),
  z.object({
    conversationId: z.string().min(1).max(64),
    paths: z.array(z.string().min(1).max(240)).max(40).optional(),
    message: z.string().trim().max(200).optional(),
  }),
]);

type Target = {
  repo: { owner: string; name: string; branch: string };
  files: { path: string; content: string }[];
  label: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Choose at least one file to push." }, { status: 400 });
  }

  let target: Target | null = null;

  if ("projectId" in body) {
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
    target = {
      repo: project.repo,
      files: selected.map((f) => ({ path: f.path, content: f.content })),
      label: "Grace Code",
    };
  } else {
    const conversation = await getConversation(user.id, body.conversationId);
    if (!conversation) return NextResponse.json({ error: "That chat is gone." }, { status: 404 });
    if (!conversation.repo) {
      return NextResponse.json(
        { error: "Attach a repository to this chat first." },
        { status: 400 }
      );
    }
    const files = await listWorkspaceFiles(body.conversationId);
    if (files.length === 0) {
      return NextResponse.json({ error: "This workspace has no files yet." }, { status: 400 });
    }
    const wanted = body.paths ? new Set(body.paths) : null;
    target = {
      repo: conversation.repo,
      files: files
        .filter((f) => !wanted || wanted.has(f.path))
        .map((f) => ({ path: f.path, content: f.content })),
      label: "Grace",
    };
  }

  if (target.files.length === 0) {
    return NextResponse.json({ error: "Nothing to push." }, { status: 400 });
  }

  // The remote is the authority on what a file's current sha is.
  const remote = await readRepoFiles(
    user.id,
    target.repo.owner,
    target.repo.name,
    target.repo.branch
  );
  if (remote.error) {
    return NextResponse.json({ error: remote.error }, { status: 400 });
  }
  const shas = new Map(remote.files.map((f) => [f.path, f.sha]));

  const count = target.files.length;
  const result = await commitFiles(
    user.id,
    target.repo.owner,
    target.repo.name,
    target.repo.branch,
    target.files.map((f) => ({ path: f.path, content: f.content, sha: shas.get(f.path) ?? null })),
    body.message || `${target.label}: update ${count} file${count === 1 ? "" : "s"}`
  );

  if (result.error) {
    return NextResponse.json(
      { error: result.error, written: result.written, failed: result.failed },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    written: result.written,
    // A partial push is a success with a caveat, not a failure: the user needs
    // to know which files landed and which GitHub refused.
    failed: result.failed,
    url: `https://github.com/${target.repo.owner}/${target.repo.name}/tree/${target.repo.branch}`,
  });
}
