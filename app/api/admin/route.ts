import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import { getProviderStatus, hasEnvKey, invalidateProviderKeyCache } from "@/lib/ai/env";
import { localMode, localModeIsEphemeral, withLocalDb, readLocalDb } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSql } from "@/lib/supabase/server";
import { configuredProviders } from "@/lib/ai/env";
import { MODELS } from "@/lib/ai/catalog";

/**
 * Admin console data. Only the deployment owner (is_admin) can read or write.
 * Keys are write-only: the response reports whether a key exists and hides it.
 */

async function keyRows(): Promise<{ provider: string; updated_at: string }[]> {
  if (localMode()) {
    return readLocalDb((db) =>
      db.providerKeys.map((k) => ({ provider: k.provider, updated_at: k.updated_at }))
    );
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase.from("grace_provider_keys").select("provider, updated_at");
    return data ?? [];
  }
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`select provider, updated_at from grace_provider_keys`;
  return rows.map((r) => ({
    provider: String(r.provider),
    updated_at: String(r.updated_at ?? ""),
  }));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to open the console.", 401);
  if (!user.isAdmin) return jsonError("This console is for the deployment owner.", 403);

  const [status, rows, ready] = await Promise.all([
    getProviderStatus(),
    keyRows(),
    configuredProviders(),
  ]);

  return NextResponse.json(
    {
      providers: status.map((s) => ({
        ...s,
        source: hasEnvKey(s.id) ? "env" : rows.some((r) => r.provider === s.id) ? "console" : "none",
      })),
      models: MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        providerLabel: PROVIDERS[m.provider].label,
        tier: m.tier,
        credits: m.credits,
        available: ready.has(m.provider),
      })),
      backend: localMode() ? "local" : process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "postgres",
      ephemeral: localModeIsEphemeral(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const keySchema = z.object({
  provider: z.enum(Object.keys(PROVIDERS) as [ProviderId, ...ProviderId[]]),
  apiKey: z.string().trim().min(12, "That key looks too short.").max(400),
});

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to change provider keys.", 401);
  if (!user.isAdmin) return jsonError("This console is for the deployment owner.", 403);

  const body = await parseJson(request, keySchema);
  if (body instanceof NextResponse) return body;

  const record = {
    provider: body.provider,
    api_key: body.apiKey,
    enabled: true,
    updated_at: new Date().toISOString(),
  };

  if (localMode()) {
    await withLocalDb((db) => {
      db.providerKeys = db.providerKeys.filter((k) => k.provider !== body.provider);
      db.providerKeys.push(record);
    });
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from("grace_provider_keys")
        .upsert(record, { onConflict: "provider" });
      if (error) return jsonError(error.message, 500);
    } else {
      const sql = getSql();
      if (!sql) return jsonError("No database configured.", 500);
      await sql`
        insert into grace_provider_keys (provider, api_key, enabled, updated_at)
        values (${record.provider}, ${record.api_key}, true, now())
        on conflict (provider) do update
          set api_key = excluded.api_key, enabled = true, updated_at = now()`;
    }
  }

  invalidateProviderKeyCache();
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ provider: z.string().max(40) });

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to change provider keys.", 401);
  if (!user.isAdmin) return jsonError("This console is for the deployment owner.", 403);

  const body = await parseJson(request, deleteSchema);
  if (body instanceof NextResponse) return body;

  if (localMode()) {
    await withLocalDb((db) => {
      db.providerKeys = db.providerKeys.filter((k) => k.provider !== body.provider);
    });
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from("grace_provider_keys").delete().eq("provider", body.provider);
    } else {
      const sql = getSql();
      if (sql) await sql`delete from grace_provider_keys where provider = ${body.provider}`;
    }
  }

  invalidateProviderKeyCache();
  return NextResponse.json({ ok: true });
}
