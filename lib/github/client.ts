import "server-only";

import { localMode, nowIso, readLocalDb, withLocalDb } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GitHub, as far as Grace needs it.
 *
 * Two ways in, because they suit different people:
 *
 *   1. An OAuth App, so someone signs in with GitHub and grants access to the
 *      repositories they choose. This is the path a real user takes.
 *   2. A personal access token, pasted once. This is the path for a single
 *      owner working on their own repos, and the only one available without
 *      registering an OAuth app.
 *
 * Either way the token is a *user* credential: it is stored server-side, never
 * leaves the server, and every call is made with it. The browser only ever sees
 * the login name and avatar.
 */

/**
 * GitHub's REST base. Overridable so a GitHub Enterprise install (which serves
 * `/api/v3`) works, and so the integration can be exercised against a local
 * stub rather than the real API in tests.
 */
const API = (process.env.GITHUB_API_BASE_URL?.trim() || "https://api.github.com").replace(/\/$/, "");

export type GithubAccount = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  scopes: string[];
  connectedAt: string;
};

export type GithubRepo = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  updatedAt: string;
  language: string | null;
};

export type GithubFile = {
  path: string;
  content: string;
  sha: string;
};

type Row = {
  user_id: string;
  login: string;
  name: string | null;
  avatar_url: string | null;
  token: string;
  scopes: string[];
  connected_at: string;
};

/** OAuth is only offered when the deployment has an app registered. */
export function githubOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return {
        data: null,
        error: body.message ?? `GitHub answered ${response.status}.`,
        status: response.status,
      };
    }
    return { data: (await response.json()) as T, error: null, status: response.status };
  } catch {
    return { data: null, error: "Could not reach GitHub.", status: 0 };
  }
}

// ------------------------------------------------------------------ accounts

export async function getGithubRow(userId: string): Promise<Row | null> {
  if (localMode()) {
    const rows = await readLocalDb((db) => db.github ?? []);
    return rows.find((r) => r.user_id === userId) ?? null;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("grace_github")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

export async function getGithubAccount(userId: string): Promise<GithubAccount | null> {
  const row = await getGithubRow(userId);
  if (!row) return null;
  return {
    login: row.login,
    name: row.name,
    avatarUrl: row.avatar_url,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    connectedAt: row.connected_at,
  };
}

/**
 * Stores a token after checking it against GitHub.
 *
 * A token that does not work is worse than no token: the UI would show
 * "connected" and every action would fail. So the identity call is the
 * validation, and its answer is what gets stored.
 */
export async function connectGithub(
  userId: string,
  token: string,
  scopes: string[] = []
): Promise<{ account: GithubAccount | null; error: string | null }> {
  const clean = token.trim();
  if (clean.length < 8) return { account: null, error: "That token looks too short." };

  const who = await gh<{ login: string; name: string | null; avatar_url: string | null }>(
    clean,
    "/user"
  );
  if (!who.data) {
    return { account: null, error: who.error ?? "GitHub rejected that token." };
  }

  const row: Row = {
    user_id: userId,
    login: who.data.login,
    name: who.data.name,
    avatar_url: who.data.avatar_url,
    token: clean,
    scopes,
    connected_at: nowIso(),
  };

  if (localMode()) {
    await withLocalDb((db) => {
      db.github = (db.github ?? []).filter((r) => r.user_id !== userId);
      db.github.push(row);
    });
  } else {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { account: null, error: "Storage is not configured." };
    const { error } = await supabase
      .from("grace_github")
      .upsert(row, { onConflict: "user_id" });
    if (error) return { account: null, error: "That connection could not be saved." };
  }

  return {
    account: {
      login: row.login,
      name: row.name,
      avatarUrl: row.avatar_url,
      scopes,
      connectedAt: row.connected_at,
    },
    error: null,
  };
}

export async function disconnectGithub(userId: string) {
  if (localMode()) {
    await withLocalDb((db) => {
      db.github = (db.github ?? []).filter((r) => r.user_id !== userId);
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (supabase) await supabase.from("grace_github").delete().eq("user_id", userId);
}

// -------------------------------------------------------------------- repos

export async function listRepos(userId: string): Promise<GithubRepo[]> {
  const row = await getGithubRow(userId);
  if (!row) return [];

  // Requested in the order GitHub's own list uses: recently pushed first.
  const result = await gh<
    {
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      description: string | null;
      updated_at: string;
      language: string | null;
      owner: { login: string };
    }[]
  >(row.token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");

  if (!result.data) return [];
  return result.data.map((repo) => ({
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    description: repo.description,
    updatedAt: repo.updated_at,
    language: repo.language,
  }));
}

/** Reads a repository's text files, which is what the agent gets as context. */
export async function readRepoFiles(
  userId: string,
  owner: string,
  repo: string,
  branch: string
): Promise<{ files: GithubFile[]; truncated: boolean; error: string | null }> {
  const row = await getGithubRow(userId);
  if (!row) return { files: [], truncated: false, error: "Connect GitHub first." };

  const tree = await gh<{ tree: { path: string; type: string; size?: number; sha: string }[]; truncated: boolean }>(
    row.token,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  if (!tree.data) {
    return { files: [], truncated: false, error: tree.error ?? "That repository could not be read." };
  }

  // A prompt has a budget. Skip binaries, vendored code and the usual noise,
  // then take whole files until the budget is spent.
  const SKIP = /(^|\/)(node_modules|\.next|dist|build|vendor|\.git|coverage|__pycache__|\.venv)\//;
  const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|tar|mp4|mp3|woff2?|ttf|otf|lock|so|dylib|exe|bin|wasm)$/i;

  const candidates = tree.data.tree
    .filter((entry) => entry.type === "blob")
    .filter((entry) => !SKIP.test(entry.path) && !BINARY.test(entry.path))
    .filter((entry) => (entry.size ?? 0) < 160_000)
    .slice(0, 60);

  const files: GithubFile[] = [];
  let budget = 240_000;

  for (const entry of candidates) {
    if (budget <= 0) break;
    const blob = await gh<{ content: string; encoding: string }>(
      row.token,
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(entry.path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`
    );
    if (!blob.data || blob.data.encoding !== "base64") continue;
    const text = Buffer.from(blob.data.content, "base64").toString("utf8");
    // A NUL byte means it was not really text despite the extension.
    if (text.includes("\u0000")) continue;
    files.push({ path: entry.path, content: text, sha: entry.sha });
    budget -= text.length;
  }

  return { files, truncated: tree.data.truncated || candidates.length < tree.data.tree.length, error: null };
}

/**
 * Writes one file on a branch.
 *
 * Uses the contents API with the blob's current sha: GitHub rejects the write
 * if the file changed underneath us, which is the behaviour a coding agent
 * needs. Without the sha it would blindly overwrite someone else's commit.
 */
export async function writeRepoFile(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  sha: string | null,
  message: string
): Promise<{ ok: boolean; sha: string | null; error: string | null }> {
  const row = await getGithubRow(userId);
  if (!row) return { ok: false, sha: null, error: "Connect GitHub first." };

  const result = await gh<{ content: { sha: string } }>(
    row.token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    }
  );

  if (!result.data) {
    // A 409 means the sha no longer matches: the branch moved on.
    return {
      ok: false,
      sha: null,
      error:
        result.status === 409
          ? "That file changed on GitHub while Grace was working. Re-read the repo and try again."
          : (result.error ?? "That file could not be written."),
    };
  }
  return { ok: true, sha: result.data.content.sha, error: null };
}

/** Lands several file writes on one branch, stopping at the first failure. */
export async function commitFiles(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  files: { path: string; content: string; sha: string | null }[],
  message: string
): Promise<{ written: string[]; error: string | null }> {
  const written: string[] = [];
  for (const file of files) {
    const result = await writeRepoFile(
      userId,
      owner,
      repo,
      branch,
      file.path,
      file.content,
      file.sha,
      message
    );
    if (!result.ok) {
      return { written, error: result.error ?? "That commit could not be completed." };
    }
    written.push(file.path);
  }
  return { written, error: null };
}

/** Branch list for the picker; falls back to the default branch on failure. */
export async function listBranches(
  userId: string,
  owner: string,
  repo: string
): Promise<{ name: string; sha: string }[]> {
  const row = await getGithubRow(userId);
  if (!row) return [];
  const result = await gh<{ name: string; commit: { sha: string } }[]>(
    row.token,
    `/repos/${owner}/${repo}/branches?per_page=100`
  );
  return (result.data ?? []).map((b) => ({ name: b.name, sha: b.commit.sha }));
}
