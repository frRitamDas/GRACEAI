import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import {
  connectGithub,
  disconnectGithub,
  getGithubAccount,
  githubOAuthConfigured,
  listRepos,
} from "@/lib/github/client";

/**
 * GitHub connection state for the signed-in user.
 *
 * GET reports whether a connection exists and whether OAuth is available, so
 * the UI can offer the right affordance instead of a button that dead-ends.
 * PUT takes a personal access token; DELETE forgets it.
 */

const tokenSchema = z.object({ token: z.string().trim().min(8).max(200) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const account = await getGithubAccount(user.id);
  return NextResponse.json(
    {
      connected: Boolean(account),
      account,
      oauthConfigured: githubOAuthConfigured(),
      repos: account ? await listRepos(user.id) : [],
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof tokenSchema>;
  try {
    body = tokenSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Paste a GitHub token first." }, { status: 400 });
  }

  const result = await connectGithub(user.id, body.token);
  if (!result.account) {
    return NextResponse.json({ error: result.error ?? "GitHub rejected that token." }, { status: 400 });
  }

  return NextResponse.json({
    connected: true,
    account: result.account,
    repos: await listRepos(user.id),
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  await disconnectGithub(user.id);
  return NextResponse.json({ ok: true });
}
