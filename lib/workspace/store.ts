import "server-only";

import { localMode, nowIso, readLocalDb, withLocalDb, type LocalWorkspaceFile } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Chat workspaces.
 *
 * A conversation can optionally carry a repository and a handful of local
 * files. That is the whole difference between "ask Grace a question" and "ask
 * Grace to change this code": the agent gets real file contents, and what it
 * writes back becomes a working tree the user can review.
 *
 * Deliberately not shared with `lib/code/store.ts`. A Grace Code project is a
 * long-lived container with its own transcript; a workspace belongs to one
 * conversation and dies with it. Reusing the project tables would have meant a
 * migration, an id collision and two concepts fighting over one row.
 */

export type WorkspaceRepo = { owner: string; name: string; branch: string };

export type WorkspaceFile = {
  path: string;
  content: string;
  sha?: string | null;
  updatedAt: string;
};

export type WorkspaceState = {
  repo: WorkspaceRepo | null;
  files: WorkspaceFile[];
};

/** Paths are code, not user input: no traversal, no absolute paths, no dotfiles. */
export function safeWorkspacePath(input: string): string | null {
  const raw = input.trim().replace(/^\.?\/+/, "");
  if (!raw || raw.length > 240) return null;
  if (raw.includes("\0") || raw.includes("\\")) return null;
  const parts = raw.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  // Reject a leading dot only at the top: ".github/workflows" is legitimate,
  // but a hidden root file is nearly always a mistake.
  if (parts[0].startsWith(".") && !parts.join("/").startsWith(".github/")) return null;
  return parts.join("/");
}

async function repoFor(conversationId: string): Promise<WorkspaceRepo | null> {
  if (localMode()) {
    const row = await readLocalDb(
      (db) => db.conversations.find((c) => c.id === conversationId) ?? null
    );
    if (!row?.repo_owner || !row?.repo_name || !row?.repo_branch) return null;
    return { owner: row.repo_owner, name: row.repo_name, branch: row.repo_branch };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("grace_conversations")
    .select("repo_owner, repo_name, repo_branch")
    .eq("id", conversationId)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  if (!row?.repo_owner || !row?.repo_name || !row?.repo_branch) return null;
  return {
    owner: String(row.repo_owner),
    name: String(row.repo_name),
    branch: String(row.repo_branch),
  };
}

export async function getWorkspaceRepo(conversationId: string): Promise<WorkspaceRepo | null> {
  return repoFor(conversationId);
}

export async function setWorkspaceRepo(
  conversationId: string,
  repo: WorkspaceRepo | null
): Promise<void> {
  const patch = repo
    ? { repo_owner: repo.owner, repo_name: repo.name, repo_branch: repo.branch }
    : { repo_owner: null, repo_name: null, repo_branch: null };

  if (localMode()) {
    await withLocalDb((db) => {
      const row = db.conversations.find((c) => c.id === conversationId);
      if (!row) return;
      Object.assign(row, patch);
      row.updated_at = nowIso();
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("grace_conversations").update(patch).eq("id", conversationId);
}

export async function listWorkspaceFiles(conversationId: string): Promise<WorkspaceFile[]> {
  if (localMode()) {
    const rows = await readLocalDb((db) =>
      (db.workspaceFiles ?? []).filter((f) => f.conversation_id === conversationId)
    );
    return rows
      .map((r) => ({
        path: r.path,
        content: r.content,
        sha: r.sha ?? null,
        updatedAt: r.updated_at,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("grace_workspace_files")
    .select("path, content, sha, updated_at")
    .eq("conversation_id", conversationId)
    .order("path");
  return (data ?? []).map((row) => ({
    path: String(row.path),
    content: String(row.content ?? ""),
    sha: (row.sha as string | null) ?? null,
    updatedAt: String(row.updated_at ?? nowIso()),
  }));
}

export async function readWorkspaceFile(
  conversationId: string,
  path: string
): Promise<WorkspaceFile | null> {
  const safe = safeWorkspacePath(path);
  if (!safe) return null;
  const all = await listWorkspaceFiles(conversationId);
  return all.find((f) => f.path === safe) ?? null;
}

export async function writeWorkspaceFile(
  conversationId: string,
  path: string,
  content: string,
  sha?: string | null
): Promise<boolean> {
  const safe = safeWorkspacePath(path);
  if (!safe) return false;
  const stamp = nowIso();

  if (localMode()) {
    await withLocalDb((db) => {
      db.workspaceFiles = db.workspaceFiles ?? [];
      const existing = db.workspaceFiles.find(
        (f) => f.conversation_id === conversationId && f.path === safe
      );
      if (existing) {
        existing.content = content;
        existing.updated_at = stamp;
        if (sha !== undefined) existing.sha = sha;
      } else {
        const row: LocalWorkspaceFile = {
          conversation_id: conversationId,
          path: safe,
          content,
          sha: sha ?? null,
          updated_at: stamp,
        };
        db.workspaceFiles.push(row);
      }
    });
    return true;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase.from("grace_workspace_files").upsert(
    { conversation_id: conversationId, path: safe, content, sha: sha ?? null, updated_at: stamp },
    { onConflict: "conversation_id,path" }
  );
  return !error;
}

export async function deleteWorkspaceFile(conversationId: string, path: string): Promise<boolean> {
  const safe = safeWorkspacePath(path);
  if (!safe) return false;
  if (localMode()) {
    await withLocalDb((db) => {
      db.workspaceFiles = (db.workspaceFiles ?? []).filter(
        (f) => !(f.conversation_id === conversationId && f.path === safe)
      );
    });
    return true;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("grace_workspace_files")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("path", safe);
  return !error;
}

/** Removes every local file, used when a workspace is detached from its repo. */
export async function clearWorkspaceFiles(conversationId: string): Promise<void> {
  if (localMode()) {
    await withLocalDb((db) => {
      db.workspaceFiles = (db.workspaceFiles ?? []).filter(
        (f) => f.conversation_id !== conversationId
      );
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("grace_workspace_files").delete().eq("conversation_id", conversationId);
}
