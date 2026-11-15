import "server-only";

import { getSupabaseAdmin, StorageError } from "@/lib/supabase/server";
import {
  localMode,
  newId,
  nowIso,
  periodStart,
  readLocalDb,
  withLocalDb,
  type LocalMessage,
  type LocalUser,
} from "@/lib/db/local";
import { getSql } from "@/lib/supabase/server";
import { publicUser, type SessionUser } from "@/lib/auth/session";

/**
 * Users, conversations, messages and usage.
 *
 * Each function has one path per backend (Supabase REST or direct Postgres or
 * the local JSON store) and returns plain objects so callers stay unaware.
 */

const USER_COLUMNS =
  "id, email, name, is_admin, unlimited, plan, credits, effort, provider, model, show_credit_percentage, created_at";

export type ConversationRepo = { owner: string; name: string; branch: string };

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Set when this chat has a GitHub workspace attached. */
  repo?: ConversationRepo | null;
};

/** Columns to select when a caller only needs the conversation itself. */
const CONVERSATION_COLUMNS = "id, title, created_at, updated_at, repo_owner, repo_name, repo_branch";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId: string | null;
  modelName: string | null;
  provider: string | null;
  effort: number | null;
  credits: number;
  attachments: unknown[];
  error: boolean;
  createdAt: string;
};

function toConversation(row: Record<string, unknown>): Conversation {
  const owner = row.repo_owner as string | null | undefined;
  const name = row.repo_name as string | null | undefined;
  const branch = row.repo_branch as string | null | undefined;
  return {
    id: String(row.id),
    title: String(row.title ?? "New chat"),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
    repo: owner && name && branch ? { owner, name, branch } : null,
  };
}

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    role: (row.role as Message["role"]) ?? "assistant",
    content: String(row.content ?? ""),
    modelId: (row.model_id as string | null) ?? null,
    modelName: (row.model_name as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    effort: row.effort == null ? null : Number(row.effort),
    credits: Number(row.credits ?? 0),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    error: Boolean(row.error),
    createdAt: String(row.created_at ?? nowIso()),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (localMode()) {
    return readLocalDb((db) => db.users.find((u) => u.email === normalized) ?? null);
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("grace_users")
      .select(`password_hash, ${USER_COLUMNS}`)
      .eq("email", normalized)
      .maybeSingle();
    if (error) throw new StorageError(error);
    return (data as Record<string, unknown> | null) ?? null;
  }
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    select password_hash, ${sql.unsafe(USER_COLUMNS)}
    from grace_users where email = ${normalized} limit 1`;
  return (rows[0] as unknown as Record<string, unknown>) ?? null;
}

export async function countUsers(): Promise<number> {
  if (localMode()) return readLocalDb((db) => db.users.length);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { count } = await supabase
      .from("grace_users")
      .select("id", { count: "exact", head: true });
    return count ?? 0;
  }
  const sql = getSql();
  if (!sql) return 0;
  const rows = await sql`select count(*)::int as n from grace_users`;
  return Number(rows[0]?.n ?? 0);
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  isAdmin: boolean;
  /**
   * Set when the address is already on the owner's allowlist, so an invited
   * address lands as Apex on its first sign-in without a second click.
   */
  plan?: "free" | "apex" | "apex-pro";
}): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  if (localMode()) {
    return withLocalDb((db) => {
      const user: LocalUser = {
        id: newId(),
        email,
        name: input.name.trim(),
        password_hash: input.passwordHash,
        is_admin: input.isAdmin,
        unlimited: Boolean(input.plan && input.plan !== "free"),
        plan: input.plan ?? "free",
        credits: input.plan && input.plan !== "free" ? 3_000 : 250,
        effort: 0,
        provider: "openrouter",
        model: null,
        show_credit_percentage: true,
        created_at: nowIso(),
        last_seen_at: nowIso(),
      };
      db.users.push(user);
      return publicUser(user as unknown as Record<string, unknown>);
    });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("grace_users")
      .insert({
        email,
        name: input.name.trim(),
        password_hash: input.passwordHash,
        is_admin: input.isAdmin,
        unlimited: Boolean(input.plan && input.plan !== "free"),
        plan: input.plan ?? "free",
        credits: input.plan && input.plan !== "free" ? 3_000 : 250,
      })
      .select(USER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return publicUser(data as Record<string, unknown>);
  }

  const sql = getSql();
  if (!sql) throw new Error("No database configured.");
  const gifted = input.plan && input.plan !== "free";
  const rows = await sql`
    insert into grace_users (email, name, password_hash, is_admin, unlimited, plan, credits)
    values (
      ${email},
      ${input.name.trim()},
      ${input.passwordHash},
      ${input.isAdmin},
      ${Boolean(gifted)},
      ${input.plan ?? "free"},
      ${gifted ? 3_000 : 250}
    )
    returning ${sql.unsafe(USER_COLUMNS)}`;
  return publicUser(rows[0] as unknown as Record<string, unknown>);
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  if (localMode()) {
    return readLocalDb((db) => {
      const u = db.users.find((x) => x.id === id);
      return u ? publicUser(u as unknown as Record<string, unknown>) : null;
    });
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("grace_users")
      .select(USER_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    return data ? publicUser(data as Record<string, unknown>) : null;
  }
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`select ${sql.unsafe(USER_COLUMNS)} from grace_users where id = ${id} limit 1`;
  return rows[0] ? publicUser(rows[0] as unknown as Record<string, unknown>) : null;
}

export async function updateUser(
  id: string,
  patch: Partial<{
    name: string;
    unlimited: boolean;
    effort: number;
    provider: string;
    model: string | null;
    show_credit_percentage: boolean;
    plan: string;
    credits: number;
    is_admin: boolean;
  }>
): Promise<SessionUser | null> {
  if (localMode()) {
    return withLocalDb((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) return null;
      Object.assign(user, patch);
      return publicUser(user as unknown as Record<string, unknown>);
    });
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("grace_users")
      .update(patch)
      .eq("id", id)
      .select(USER_COLUMNS)
      .single();
    return data ? publicUser(data as Record<string, unknown>) : null;
  }
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    update grace_users set ${sql(patch as Record<string, never>)} where id = ${id}
    returning ${sql.unsafe(USER_COLUMNS)}`;
  return rows[0] ? publicUser(rows[0] as unknown as Record<string, unknown>) : null;
}

export async function listUsers(): Promise<(SessionUser & { conversationCount: number; used: number })[]> {
  if (localMode()) {
    return readLocalDb((db) =>
      db.users.map((u) => ({
        ...publicUser(u as unknown as Record<string, unknown>),
        conversationCount: db.conversations.filter((c) => c.user_id === u.id).length,
        used: db.usage
          .filter((x) => x.user_id === u.id && x.period_start === periodStart())
          .reduce((sum, x) => sum + x.credits_used, 0),
      }))
    );
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase.from("grace_users").select(USER_COLUMNS).order("created_at", { ascending: false });
    return (data ?? []).map((row) => ({
      ...publicUser(row as Record<string, unknown>),
      conversationCount: 0,
      used: 0,
    }));
  }
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`select ${sql.unsafe(USER_COLUMNS)} from grace_users order by created_at desc`;
  return rows.map((row) => ({
    ...publicUser(row as unknown as Record<string, unknown>),
    conversationCount: 0,
    used: 0,
  }));
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------
export async function listConversations(userId: string): Promise<Conversation[]> {
  if (localMode()) {
    return readLocalDb((db) =>
      db.conversations
        .filter((c) => c.user_id === userId)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((c) => toConversation(c as unknown as Record<string, unknown>))
    );
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("grace_conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((row) => toConversation(row as Record<string, unknown>));
  }
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`
    select id, title, created_at, updated_at, repo_owner, repo_name, repo_branch from grace_conversations
    where user_id = ${userId} order by updated_at desc limit 200`;
  return rows.map((row) => toConversation(row as unknown as Record<string, unknown>));
}

export async function createConversation(userId: string, title = "New chat"): Promise<Conversation> {
  if (localMode()) {
    return withLocalDb((db) => {
      const now = nowIso();
      const row = { id: newId(), user_id: userId, title, created_at: now, updated_at: now };
      db.conversations.unshift(row);
      return toConversation(row as unknown as Record<string, unknown>);
    });
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("grace_conversations")
      .insert({ user_id: userId, title })
      .select(CONVERSATION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toConversation(data as Record<string, unknown>);
  }
  const sql = getSql();
  if (!sql) throw new Error("No database configured.");
  const rows = await sql`
    insert into grace_conversations (user_id, title) values (${userId}, ${title})
    returning id, title, created_at, updated_at`;
  return toConversation(rows[0] as unknown as Record<string, unknown>);
}

export async function getConversation(userId: string, id: string): Promise<Conversation | null> {
  if (localMode()) {
    return readLocalDb((db) => {
      const row = db.conversations.find((c) => c.id === id && c.user_id === userId);
      return row ? toConversation(row as unknown as Record<string, unknown>) : null;
    });
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("grace_conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? toConversation(data as Record<string, unknown>) : null;
  }
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    select id, title, created_at, updated_at, repo_owner, repo_name, repo_branch from grace_conversations
    where id = ${id} and user_id = ${userId} limit 1`;
  return rows[0] ? toConversation(rows[0] as unknown as Record<string, unknown>) : null;
}

export async function renameConversation(userId: string, id: string, title: string) {
  const clean = title.trim().slice(0, 120) || "New chat";
  if (localMode()) {
    await withLocalDb((db) => {
      const row = db.conversations.find((c) => c.id === id && c.user_id === userId);
      if (row) {
        row.title = clean;
        row.updated_at = nowIso();
      }
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase
      .from("grace_conversations")
      .update({ title: clean, updated_at: nowIso() })
      .eq("id", id)
      .eq("user_id", userId);
    return;
  }
  const sql = getSql();
  if (!sql) return;
  await sql`update grace_conversations set title = ${clean}, updated_at = now()
            where id = ${id} and user_id = ${userId}`;
}

export async function deleteConversation(userId: string, id: string) {
  if (localMode()) {
    await withLocalDb((db) => {
      db.conversations = db.conversations.filter((c) => !(c.id === id && c.user_id === userId));
      db.messages = db.messages.filter((m) => m.conversation_id !== id);
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("grace_conversations").delete().eq("id", id).eq("user_id", userId);
    return;
  }
  const sql = getSql();
  if (!sql) return;
  await sql`delete from grace_conversations where id = ${id} and user_id = ${userId}`;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export async function listMessages(conversationId: string): Promise<Message[]> {
  if (localMode()) {
    return readLocalDb((db) =>
      db.messages
        .filter((m) => m.conversation_id === conversationId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => toMessage(m as unknown as Record<string, unknown>))
    );
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("grace_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    return (data ?? []).map((row) => toMessage(row as Record<string, unknown>));
  }
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`select * from grace_messages where conversation_id = ${conversationId}
                         order by created_at asc limit 500`;
  return rows.map((row) => toMessage(row as unknown as Record<string, unknown>));
}

export async function addMessage(input: {
  conversationId: string;
  role: Message["role"];
  content: string;
  modelId?: string | null;
  modelName?: string | null;
  provider?: string | null;
  effort?: number | null;
  credits?: number;
  attachments?: unknown[];
  error?: boolean;
}): Promise<Message> {
  const record: LocalMessage = {
    id: newId(),
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    model_id: input.modelId ?? null,
    model_name: input.modelName ?? null,
    provider: input.provider ?? null,
    effort: input.effort ?? null,
    credits: input.credits ?? 0,
    attachments: input.attachments ?? [],
    error: input.error ?? false,
    created_at: nowIso(),
  };

  if (localMode()) {
    return withLocalDb((db) => {
      db.messages.push(record);
      const convo = db.conversations.find((c) => c.id === input.conversationId);
      if (convo) convo.updated_at = record.created_at;
      return toMessage(record as unknown as Record<string, unknown>);
    });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("grace_messages")
      .insert({
        conversation_id: record.conversation_id,
        role: record.role,
        content: record.content,
        model_id: record.model_id,
        model_name: record.model_name,
        provider: record.provider,
        effort: record.effort,
        credits: record.credits,
        attachments: record.attachments,
        error: record.error,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("grace_conversations")
      .update({ updated_at: nowIso() })
      .eq("id", input.conversationId);
    return toMessage(data as Record<string, unknown>);
  }

  const sql = getSql();
  if (!sql) throw new Error("No database configured.");
  const rows = await sql`
    insert into grace_messages
      (conversation_id, role, content, model_id, model_name, provider, effort, credits, attachments, error)
    values (
      ${record.conversation_id}, ${record.role}, ${record.content}, ${record.model_id},
      ${record.model_name}, ${record.provider}, ${record.effort}, ${record.credits},
      ${sql.json(record.attachments as never)}, ${record.error}
    )
    returning *`;
  await sql`update grace_conversations set updated_at = now() where id = ${input.conversationId}`;
  return toMessage(rows[0] as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------
export type Usage = { used: number; requests: number; periodStart: string };

export async function getUsage(userId: string): Promise<Usage> {
  const start = periodStart();
  if (localMode()) {
    return readLocalDb((db) => {
      const row = db.usage.find((u) => u.user_id === userId && u.period_start === start);
      return { used: row?.credits_used ?? 0, requests: row?.requests ?? 0, periodStart: start };
    });
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("grace_usage")
      .select("credits_used, requests, period_start")
      .eq("user_id", userId)
      .eq("period_start", start)
      .maybeSingle();
    return {
      used: Number(data?.credits_used ?? 0),
      requests: Number(data?.requests ?? 0),
      periodStart: start,
    };
  }
  const sql = getSql();
  if (!sql) return { used: 0, requests: 0, periodStart: start };
  const rows = await sql`
    select credits_used, requests from grace_usage
    where user_id = ${userId} and period_start = ${start}`;
  return {
    used: Number(rows[0]?.credits_used ?? 0),
    requests: Number(rows[0]?.requests ?? 0),
    periodStart: start,
  };
}

/** Records spend and decrements the user's balance in one step. */
export async function recordUsage(userId: string, credits: number): Promise<number> {
  const start = periodStart();
  if (localMode()) {
    return withLocalDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      const remaining = Math.max(0, (user?.credits ?? 0) - credits);
      if (user) user.credits = remaining;
      const row = db.usage.find((u) => u.user_id === userId && u.period_start === start);
      if (row) {
        row.credits_used += credits;
        row.requests += 1;
      } else {
        db.usage.push({ user_id: userId, period_start: start, credits_used: credits, requests: 1 });
      }
      return remaining;
    });
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.rpc("grace_record_usage", { p_user_id: userId, p_credits: credits }).then(
      () => undefined,
      () => undefined
    );
    const user = await getUserById(userId);
    const remaining = Math.max(0, (user?.credits ?? 0) - credits);
    await updateUser(userId, { credits: remaining });
    const { data } = await supabase
      .from("grace_usage")
      .select("credits_used, requests")
      .eq("user_id", userId)
      .eq("period_start", start)
      .maybeSingle();
    if (data) {
      await supabase
        .from("grace_usage")
        .update({ credits_used: Number(data.credits_used) + credits, requests: Number(data.requests) + 1 })
        .eq("user_id", userId)
        .eq("period_start", start);
    } else {
      await supabase
        .from("grace_usage")
        .insert({ user_id: userId, period_start: start, credits_used: credits, requests: 1 });
    }
    return remaining;
  }
  const sql = getSql();
  if (!sql) return 0;
  const rows = await sql`
    with u as (
      update grace_users set credits = greatest(0, credits - ${credits})
      where id = ${userId} returning credits
    ), usage as (
      insert into grace_usage (user_id, period_start, credits_used, requests)
      values (${userId}, ${start}, ${credits}, 1)
      on conflict (user_id, period_start)
      do update set credits_used = grace_usage.credits_used + ${credits},
                    requests = grace_usage.requests + 1
      returning credits_used
    ) select u.credits as remaining from u`;
  return Number(rows[0]?.remaining ?? 0);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
export async function saveFile(input: {
  userId: string;
  conversationId: string | null;
  name: string;
  mime: string;
  size: number;
  dataUrl?: string | null;
  extractedText?: string | null;
}): Promise<string> {
  if (localMode()) {
    return withLocalDb((db) => {
      const id = newId();
      db.files.push({
        id,
        user_id: input.userId,
        conversation_id: input.conversationId,
        name: input.name,
        mime: input.mime,
        size: input.size,
        data_url: input.dataUrl ?? null,
        extracted_text: input.extractedText ?? null,
        created_at: nowIso(),
      });
      return id;
    });
  }
  const row = {
    user_id: input.userId,
    conversation_id: input.conversationId,
    name: input.name,
    mime: input.mime,
    size: input.size,
    data_url: input.dataUrl ?? null,
    extracted_text: input.extractedText ?? null,
  };
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("grace_files").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return String(data.id);
  }
  const sql = getSql();
  if (!sql) throw new Error("No database configured.");
  const rows = await sql`
    insert into grace_files ${sql(row)} returning id`;
  return String(rows[0].id);
}

export { periodStart };
