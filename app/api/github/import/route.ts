import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { createProject, writeFile, updateProject } from "@/lib/code/store";
import { getGithubRow, readRepoFiles } from "@/lib/github/client";

/**
 * Brings a GitHub repository into Grace Code.
 *
 * The repo's text files are copied into a project, and the project remembers
 * which repo it came from so the agent can write back. Copying rather than
 * reading live is deliberate: a turn can then read the same files the user is
 * looking at, and a network failure mid-turn cannot corrupt the conversation.
 */

const schema = z.object({
  owner: z.string().trim().min(1).max(100),
  repo: z.string().trim().min(1).max(100),
  branch: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Pick a repository and a branch." }, { status: 400 });
  }

  if (!(await getGithubRow(user.id))) {
    return NextResponse.json({ error: "Connect GitHub first." }, { status: 400 });
  }

  const read = await readRepoFiles(user.id, body.owner, body.repo, body.branch);
  if (read.error) return NextResponse.json({ error: read.error }, { status: 400 });
  if (read.files.length === 0) {
    return NextResponse.json(
      { error: "That repository has no readable text files." },
      { status: 400 }
    );
  }

  // The language decides the starter files, but this repo already has its own,
  // so only its name matters here.
  const project = await createProject(user.id, {
    name: `${body.owner}/${body.repo}`.slice(0, 80),
    language: "javascript",
    repo: { owner: body.owner, name: body.repo, branch: body.branch },
  });

  for (const file of read.files) {
    await writeFile(project.id, file.path, file.content, file.sha);
  }

  await updateProject(user.id, project.id, {
    instructions: `This project is ${body.owner}/${body.repo} on the ${body.branch} branch. Keep changes compatible with its existing structure.`,
  });

  return NextResponse.json({ project, files: read.files.length, truncated: read.truncated });
}
