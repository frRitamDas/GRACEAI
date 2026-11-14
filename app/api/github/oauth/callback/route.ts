import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/session";
import { connectGithub, githubOAuthConfigured } from "@/lib/github/client";

/**
 * GitHub sends the browser back here with a code.
 *
 * The code is exchanged server-side for a token using the client secret, so the
 * secret never reaches the browser and the token never appears in a URL. On any
 * failure the user lands back in Grace Code with a short reason rather than a
 * JSON error page.
 */

function back(request: Request, query: string) {
  return NextResponse.redirect(new URL(`/code?${query}`, request.url));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));
  if (!githubOAuthConfigured()) return back(request, "github=unavailable");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return back(request, "github=denied");

  const store = await cookies();
  const expected = store.get("grace_gh_state")?.value;
  store.delete("grace_gh_state");

  if (!code || !state || !expected || state !== expected) {
    return back(request, "github=state");
  }

  let token: string | null = null;
  let scopes: string[] = [];

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!.trim(),
        client_secret: process.env.GITHUB_CLIENT_SECRET!.trim(),
        code,
        redirect_uri: new URL("/api/github/oauth/callback", request.url).toString(),
      }),
      cache: "no-store",
    });
    const data = (await response.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
    };
    token = data.access_token ?? null;
    scopes = (data.scope ?? "").split(",").filter(Boolean);
  } catch {
    return back(request, "github=unreachable");
  }

  if (!token) return back(request, "github=denied");

  const result = await connectGithub(user.id, token, scopes);
  if (!result.account) return back(request, "github=failed");

  return back(request, "github=connected");
}
