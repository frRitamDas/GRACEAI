import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Supabase access.
 *
 * Two ways in, chosen by what the deployment has:
 *   1. Supabase REST + service role via SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
 *   2. A direct Postgres connection string (POSTGRES_URL / SUPABASE_DB_URL),
 *      which is what Supabase's Vercel integration injects.
 *
 * Either path gives the server full table access; nothing here is exposed to
 * the browser. Every query lives in lib/db/* so the storage choice stays an
 * implementation detail.
 */

const SUPABASE_URL = (
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ""
).trim();

const SERVICE_ROLE = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  ""
).trim();

const DB_URL = (
  process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  ""
).trim();

export type BackendMode = "postgres" | "supabase" | "none";

export function backendMode(): BackendMode {
  if (DB_URL) return "postgres";
  if (SUPABASE_URL && SERVICE_ROLE) return "supabase";
  return "none";
}

/** Message shown when the database is configured but unreachable. */
export const STORAGE_UNAVAILABLE =
  "The database is not reachable right now. Try again in a moment.";

/**
 * Wraps a storage read. A transport failure (DNS, TLS, timeout, 5xx) is not
 * "no such user" — callers must be able to tell an outage from a bad password,
 * or every outage is reported as a wrong login.
 */
export class StorageError extends Error {
  constructor(cause: unknown) {
    super(STORAGE_UNAVAILABLE);
    this.name = "StorageError";
    this.cause = cause;
  }
}

export async function guardStorage<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new StorageError(error);
  }
}

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

type Sql = ReturnType<typeof postgres>;

declare global {
  var __graceSql: Sql | undefined;
}

/**
 * A single pooled connection per server instance. Serverless functions are
 * frozen between requests, so the pool is small and connections rotate.
 */
export function getSql(): Sql | null {
  if (!DB_URL) return null;
  if (!globalThis.__graceSql) {
    const isPooler = /supabase\.(co|com)|pooler/.test(DB_URL);
    globalThis.__graceSql = postgres(DB_URL, {
      max: 3,
      idle_timeout: 20,
      max_lifetime: 60 * 10,
      connect_timeout: 10,
      prepare: !isPooler,
      ssl: DB_URL.includes("sslmode=disable") ? false : "require",
      onnotice: () => {},
    });
  }
  return globalThis.__graceSql;
}
