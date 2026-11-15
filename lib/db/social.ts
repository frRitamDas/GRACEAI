import "server-only";

import { localMode, nowIso, readLocalDb, withLocalDb } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Memory, project sharing and notice dismissals.
 *
 * Same two-path shape as lib/db/store.ts: Supabase when it is configured, the
 * JSON store in development. The caller never sees which one answered.
 */

export type Memory = { id: string; body: string; createdAt: string };

type MemoryRow = { id: string; body: string; created_at: string };

function toMemory(row: MemoryRow): Memory {
  return { id: row.id, body: row.body, createdAt: row.created_at };
}

/* ------------------------------------------------------------------ memory */

export async function listMemories(userId: string): Promise<Memory[]> {
  if (localMode()) {
    return readLocalDb((db) =>
      db.memories
        .filter((m) => m.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at }))
    );
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("grace_memories")
    .select("id, body, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as MemoryRow[]).map(toMemory);
}

export async function addMemory(userId: string, body: string): Promise<Memory | null> {
  const clean = body.trim();
  if (!clean) return null;
  if (localMode()) {
    return withLocalDb((db) => {
      // Same fact twice is noise, not a second memory.
      const duplicate = db.memories.find(
        (m) => m.user_id === userId && m.body.toLowerCase() === clean.toLowerCase()
      );
      if (duplicate) {
        return { id: duplicate.id, body: duplicate.body, createdAt: duplicate.created_at };
      }
      const row = {
        id: crypto.randomUUID(),
        user_id: userId,
        body: clean,
        created_at: nowIso(),
      };
      db.memories.push(row);
      return { id: row.id, body: row.body, createdAt: row.created_at };
    });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("grace_memories")
    .insert({ user_id: userId, body: clean })
    .select("id, body, created_at")
    .single();
  return data ? toMemory(data as MemoryRow) : null;
}

export async function deleteMemory(userId: string, id: string): Promise<boolean> {
  if (localMode()) {
    return withLocalDb((db) => {
      const index = db.memories.findIndex((m) => m.id === id && m.user_id === userId);
      if (index < 0) return false;
      db.memories.splice(index, 1);
      return true;
    });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase.from("grace_memories").delete().eq("id", id).eq("user_id", userId);
  return !error;
}

/* ---------------------------------------------------------------- dismissals */

export async function listDismissals(userId: string): Promise<string[]> {
  if (localMode()) {
    return readLocalDb((db) =>
      db.dismissals.filter((d) => d.user_id === userId).map((d) => d.notice_id)
    );
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase.from("grace_dismissals").select("notice_id").eq("user_id", userId);
  return ((data ?? []) as { notice_id: string }[]).map((d) => d.notice_id);
}

export async function dismissNotice(userId: string, noticeId: string): Promise<boolean> {
  if (localMode()) {
    return withLocalDb((db) => {
      if (db.dismissals.some((d) => d.user_id === userId && d.notice_id === noticeId)) return true;
      db.dismissals.push({ user_id: userId, notice_id: noticeId, dismissed_at: nowIso() });
      return true;
    });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("grace_dismissals")
    .upsert({ user_id: userId, notice_id: noticeId }, { onConflict: "user_id,notice_id" });
  return !error;
}

/* ------------------------------------------------------------ project sharing */

/**
 * Who a project is shared with, when the backend supports it. Local mode keeps
 * the list on the row; Supabase reads the array column.
 */
export async function shareProjectWith(
  ownerId: string,
  projectId: string,
  email: string
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = getSupabaseAdmin();
  if (localMode()) {
    return withLocalDb((db) => {
      const project = db.codeProjects.find((p) => p.id === projectId && p.user_id === ownerId);
      if (!project) return { ok: false, error: "That project no longer exists." };
      const target = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!target) return { ok: false, error: "No Grace account uses that email." };
      if (!project.shared_with) project.shared_with = [];
      if (!project.shared_with.includes(target.id)) project.shared_with.push(target.id);
      return { ok: true, error: null };
    });
  }
  if (!supabase) return { ok: false, error: "Sharing needs a configured backend." };

  const { data: target } = await supabase
    .from("grace_users")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (!target) return { ok: false, error: "No Grace account uses that email." };

  const { data: project } = await supabase
    .from("grace_code_projects")
    .select("shared_with")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!project) return { ok: false, error: "That project no longer exists." };

  const current = ((project.shared_with as string[] | null) ?? []).slice();
  if (!current.includes(target.id as string)) current.push(target.id as string);
  const { error } = await supabase
    .from("grace_code_projects")
    .update({ shared_with: current })
    .eq("id", projectId)
    .eq("user_id", ownerId);
  return { ok: !error, error: error?.message ?? null };
}
