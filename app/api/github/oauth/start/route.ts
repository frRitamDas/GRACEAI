import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/session";
import { githubOAuthConfigured } from "@/lib/github/client";

/**
 * Starts the GitHub OAuth dance.
 *
 * The `state` value is random, single-use, and stored in an httpOnly cookie, so
 * a callback that was not started by this browser is rejected. Without it an
 * attacker could hand a victim a callback URL and bind their own GitHub account
 * to the victim's Grace account.
 */

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));
  if (!githubOAuthConfigured()) {
    // Land back where the Connect button lives, so the page can explain what is
    // missing instead of dropping the user somewhere unrelated.
    return NextResponse.redirect(new URL("/connections?github=unavailable", request.url));
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set("grace_gh_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!.trim(),
    redirect_uri: new URL("/api/github/oauth/callback", request.url).toString(),
    // `repo` is the whole point: Grace has to commit. `read:user` names the account.
    scope: "repo read:user",
    state,
    allow_signup: "false",
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
