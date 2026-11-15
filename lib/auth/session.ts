import "server-only";

import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { localMode, newId, nowIso, withLocalDb, readLocalDb } from "@/lib/db/local";
import { newToken, sha256 } from "@/lib/auth/password";

/**
 * Email + password sessions. A random token lives in an httpOnly cookie; only
 * its SHA-256 lands in the database, so a leaked table cannot be replayed.
 */

export const SESSION_COOKIE = "grace_session";

/** Columns publicUser() reads. Deliberately excludes password_hash. */
const USER_COLUMNS_SESSION =
  "id, email, name, is_admin, unlimited, plan, credits, effort, provider, model, show_credit_percentage, created_at";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  /** Owner accounts skip credit checks and charging. */
  unlimited: boolean;
  plan: string;
  credits: number;
  effort: number;
  provider: string;
  model: string | null;
  showCreditPercentage: boolean;
  createdAt: string;
};

export function publicUser(row: Record<string, unknown>): SessionUser {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    name: String(row.name ?? ""),
    isAdmin: Boolean(row.is_admin),
    unlimited: Boolean(row.unlimited),
    plan: String(row.plan ?? "free"),
    credits: Number(row.credits ?? 0),
    effort: Number(row.effort ?? 0),
    provider: String(row.provider ?? "openrouter"),
    model: (row.model as string | null) ?? null,
    showCreditPercentage: row.show_credit_percentage !== false,
    createdAt: String(row.created_at ?? nowIso()),
  };
}

export function displayName(user: { name?: string | null; email?: string | null }): string {
  const first = (user.name ?? "").trim().split(/\s+/)[0];
  if (first) return first;
  const local = (user.email ?? "").split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z]/g, " ");
  const word = cleaned.trim().split(/\s+/)[0];
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "there";
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);

  if (localMode()) {
    await withLocalDb((db) => {
      db.sessions = db.sessions.filter((s) => new Date(s.expires_at) > new Date());
      db.sessions.push({
        token_hash: tokenHash,
        user_id: userId,
        created_at: nowIso(),
        expires_at: expires.toISOString(),
      });
    });
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from("grace_sessions").insert({
        token_hash: tokenHash,
        user_id: userId,
        expires_at: expires.toISOString(),
      });
    } else {
      const { db } = await import("@/lib/db/local");
      const sql = db();
      if (sql) {
        await sql`insert into grace_sessions (token_hash, user_id, expires_at)
                  values (${tokenHash}, ${userId}, ${expires.toISOString()})`;
      }
    }
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = await sha256(token);
    if (localMode()) {
      await withLocalDb((db) => {
        db.sessions = db.sessions.filter((s) => s.token_hash !== tokenHash);
      });
    } else {
      const supabase = getSupabaseAdmin();
      if (supabase) await supabase.from("grace_sessions").delete().eq("token_hash", tokenHash);
      else {
        const { db } = await import("@/lib/db/local");
        const sql = db();
        if (sql) await sql`delete from grace_sessions where token_hash = ${tokenHash}`;
      }
    }
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call in layouts and route handlers. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256(token);

  if (localMode()) {
    return readLocalDb((db) => {
      const session = db.sessions.find(
        (s) => s.token_hash === tokenHash && new Date(s.expires_at) > new Date()
      );
      if (!session) return null;
      const user = db.users.find((u) => u.id === session.user_id);
      return user ? publicUser(user as unknown as Record<string, unknown>) : null;
    });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    // Two plain reads instead of an embedded join: a join depends on PostgREST
    // resolving the foreign key, and if that ever fails every signed-in person
    // is silently signed out. A second query by primary key is one extra hop
    // and cannot fail that way.
    // Pages render from here, so an outage must not throw: someone with a valid
    // cookie sees the signed-out screen and the log explains why. The auth
    // endpoints do surface a 503 themselves.
    const session = await supabase
      .from("grace_sessions")
      .select("user_id")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (session.error) {
      console.error("[grace] session lookup failed:", session.error.message);
      return null;
    }
    const userId = (session.data as { user_id?: string } | null)?.user_id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("grace_users")
      .select(USER_COLUMNS_SESSION)
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[grace] user lookup failed:", error.message);
      return null;
    }
    const user = (data ?? null) as Record<string, unknown> | null;
    return user ? publicUser(user) : null;
  }

  const { db } = await import("@/lib/db/local");
  const sql = db();
  if (!sql) return null;
  const rows = await sql`
    select u.* from grace_sessions s
    join grace_users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.expires_at > now()
    limit 1`;
  return rows[0] ? publicUser(rows[0] as Record<string, unknown>) : null;
}

/** Used by route handlers that must not run without a session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sign in to continue.");
    this.name = "UnauthorizedError";
  }
}

export { newId };
