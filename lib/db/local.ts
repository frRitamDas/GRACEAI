import "server-only";

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { backendMode, getSql } from "@/lib/supabase/server";

/**
 * Developer-mode datastore.
 *
 * When no Supabase/Postgres connection is configured the app still has to be
 * fully usable (sign in, chats, credits, admin). This file-backed store gives
 * that experience locally and on previews; production points at Supabase and
 * this file is never touched. It is cached on globalThis so hot reloads do not
 * re-read the JSON on every call.
 */

export type LocalUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  is_admin: boolean;
  unlimited: boolean;
  plan: string;
  credits: number;
  effort: number;
  provider: string;
  model: string | null;
  show_credit_percentage: boolean;
  created_at: string;
  last_seen_at: string;
};

export type LocalConversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  /** Present when this conversation is attached to a GitHub repository. */
  repo_owner?: string | null;
  repo_name?: string | null;
  repo_branch?: string | null;
};

/** A file attached to a chat workspace (not a Grace Code project). */
export type LocalWorkspaceFile = {
  conversation_id: string;
  path: string;
  content: string;
  sha?: string | null;
  updated_at: string;
};

export type LocalMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model_id: string | null;
  model_name: string | null;
  provider: string | null;
  effort: number | null;
  credits: number;
  attachments: unknown[];
  error: boolean;
  created_at: string;
};

export type LocalFile = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  name: string;
  mime: string;
  size: number;
  data_url: string | null;
  extracted_text: string | null;
  created_at: string;
};

export type LocalUsage = {
  user_id: string;
  period_start: string;
  credits_used: number;
  requests: number;
};

export type LocalDb = {
  users: LocalUser[];
  sessions: { token_hash: string; user_id: string; created_at: string; expires_at: string }[];
  conversations: LocalConversation[];
  messages: LocalMessage[];
  files: LocalFile[];
  usage: LocalUsage[];
  modelOverrides: {
    id: string;
    hidden: boolean;
    name: string | null;
    tier: number | null;
    credits: number | null;
    blurb: string | null;
    custom: boolean;
    provider: string | null;
    upstream: string | null;
    context_label: string | null;
    free: boolean;
    updated_at: string;
  }[];
  /** Files attached to a conversation's workspace (chat-side coding). */
  workspaceFiles: LocalWorkspaceFile[];
  codeProjects: {
    id: string;
    user_id: string;
    name: string;
    language: string;
    instructions: string;
    created_at: string;
    updated_at: string;
    /** Set when the project was imported from GitHub and can write back. */
    repo_owner?: string | null;
    repo_name?: string | null;
    repo_branch?: string | null;
    /** Author, when it differs from the row owner (shared projects). */
    created_by?: string | null;
    /** User ids this project is shared with, read-only for them. */
    shared_with?: string[];
  }[];
  codeFiles: {
    project_id: string;
    path: string;
    content: string;
    updated_at: string;
    /** GitHub blob sha at import time, used to detect a moved remote file. */
    sha?: string | null;
  }[];
  codeMessages: {
    id: string;
    project_id: string;
    role: "user" | "assistant";
    content: string;
    touched: string[];
    created_at: string;
  }[];
  /** GitHub connections. The token is stored encrypted-at-rest by the backend
   *  it lands in; it is never sent back to a browser. */
  github: {
    user_id: string;
    login: string;
    name: string | null;
    avatar_url: string | null;
    token: string;
    scopes: string[];
    connected_at: string;
  }[];
  /** Facts the user asked Grace to remember. Injected into the chat prompt. */
  memories: {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
  }[];
  /** Cleared Upcoming notices, one row per (user, notice). */
  dismissals: {
    user_id: string;
    notice_id: string;
    dismissed_at: string;
  }[];
  /** Owner-controlled deployment settings. One row for the installation. */
  settings?: import("@/lib/settings").DeploymentSettings | null;
  providerKeys: {
    provider: string;
    api_key: string;
    enabled: boolean;
    updated_at: string;
    /** Allow-list of model ids. Null means every model this key can reach. */
    models?: string[] | null;
  }[];
};

const EMPTY: LocalDb = {
  users: [],
  sessions: [],
  conversations: [],
  messages: [],
  files: [],
  usage: [],
  providerKeys: [],
  modelOverrides: [],
  workspaceFiles: [],
  codeProjects: [],
  codeFiles: [],
  codeMessages: [],
  github: [],
  memories: [],
  dismissals: [],
  settings: null,
};

const LOCAL_DIR = path.join(process.cwd(), ".data");
/**
 * Serverless filesystems are read-only except the temp dir, so the developer
 * store lives under `.data/` locally and in `${TMPDIR}` on a function. Temp
 * data is per-instance: without Supabase, a deployment is a demo, not a home
 * for real accounts. The admin console says so.
 */
const STORE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), "grace", "grace-local.json")
  : path.join(LOCAL_DIR, "grace-local.json");

declare global {
  var __graceLocalDb: LocalDb | undefined;
  var __graceLocalWrite: Promise<void> | undefined;
}

export function localMode(): boolean {
  return backendMode() === "none";
}

/** True when the store cannot survive a restart (serverless temp dir). */
export function localModeIsEphemeral(): boolean {
  return localMode() && Boolean(process.env.VERCEL);
}

async function load(): Promise<LocalDb> {
  if (globalThis.__graceLocalDb) return globalThis.__graceLocalDb;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    const merged = { ...structuredClone(EMPTY), ...parsed };
    // A file written by an older build is missing collections added since, and
    // a missing array would turn every push into a crash. Fill them in.
    for (const key of Object.keys(EMPTY) as (keyof LocalDb)[]) {
      if (!Array.isArray(merged[key])) {
        (merged as unknown as Record<string, unknown>)[key] = [];
      }
    }
    globalThis.__graceLocalDb = merged;
  } catch {
    globalThis.__graceLocalDb = structuredClone(EMPTY);
  }
  return globalThis.__graceLocalDb!;
}

async function persist(db: LocalDb) {
  // Serialize writes so parallel server calls cannot clobber each other.
  while (globalThis.__graceLocalWrite) await globalThis.__graceLocalWrite;
  globalThis.__graceLocalWrite = (async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(db), "utf8");
  })();
  await globalThis.__graceLocalWrite;
  globalThis.__graceLocalWrite = undefined;
}

/** Read-modify-write helper. Mutate the db inside the callback. */
export async function withLocalDb<T>(fn: (db: LocalDb) => T | Promise<T>): Promise<T> {
  const db = await load();
  const result = await fn(db);
  await persist(db);
  return result;
}

export async function readLocalDb<T>(fn: (db: LocalDb) => T): Promise<T> {
  return fn(await load());
}

/**
 * Returns the direct Postgres client when a database URL is configured.
 * Callers that prefer Supabase REST fall back to this.
 */
export function db(): ReturnType<typeof getSql> {
  return getSql();
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return crypto.randomUUID();
}

/** First day of the current UTC month, used for usage periods. */
export function periodStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function nextPeriodStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

export function periodResetLabel(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", timeZone: "UTC" }
  );
}
