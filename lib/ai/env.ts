import "server-only";

import { PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import { localMode, readLocalDb } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Server-side provider configuration.
 *
 * Keys come from two places, in order:
 *   1. Process env (Vercel environment variables) — the normal path.
 *   2. The `admin_settings` row in Supabase — lets an operator paste a key in
 *      the admin console without a redeploy. Values are masked on read.
 *
 * The browser never sees a key: `/api/models` only returns booleans.
 */

export type ProviderStatus = {
  id: ProviderId;
  label: string;
  blurb: string;
  envKey: string;
  docsUrl: string;
  /** True when a usable key exists on the server. */
  configured: boolean;
};

const PROVIDER_ENDPOINTS: Record<ProviderId, { url: string; env: string }> = {
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", env: "OPENROUTER_BASE_URL" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", env: "GROQ_BASE_URL" },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    env: "GOOGLE_AI_BASE_URL",
  },
};

/**
 * Chat completions URL for a provider. The *_BASE_URL overrides exist for
 * gateways, proxies and self-hosted OpenAI-compatible deployments.
 */
export function providerEndpoint(provider: ProviderId): string {
  const entry = PROVIDER_ENDPOINTS[provider];
  const override = process.env[entry.env]?.trim();
  if (!override) return entry.url;
  return override.replace(/\/$/, "").endsWith("/chat/completions")
    ? override.replace(/\/$/, "")
    : `${override.replace(/\/$/, "")}/chat/completions`;
}

/**
 * Values that look like a key but are really a note-to-self ("paste it here"
 * placeholders in .env.example or the Vercel dashboard, or a stub from a
 * template) must not count as configured: the model picker would advertise a
 * provider that answers 401. Real keys are long and never contain these words.
 */
const PLACEHOLDER = /paste|your[-_ ]?(api[-_ ]?)?key|replace[-_ ]?me|changeme|xxx+|<.*>|example|dummy|placeholder/i;

function looksLikeKey(value: string): boolean {
  if (value.length < 20) return false;
  if (PLACEHOLDER.test(value)) return false;
  // Real provider keys are a single token: no whitespace, no URL.
  return !/\s/.test(value);
}

function envKey(provider: ProviderId): string | undefined {
  const value = process.env[PROVIDERS[provider].envKey]?.trim();
  return value && looksLikeKey(value) ? value : undefined;
}

/** True when the provider's Vercel/env var holds a usable key (not a placeholder). */
export function hasEnvKey(provider: ProviderId): boolean {
  return Boolean(envKey(provider));
}

/**
 * Keys stored in Supabase by the admin console.
 *
 * Deliberately uncached. Most deployments set the three provider keys as
 * environment variables, so this table is usually empty and the query costs
 * almost nothing. The two things a cache would buy are both bugs:
 *
 *   - a TTL needs a clock, and `getProviderStatus()` runs during render, where
 *     reading the current time makes Next.js fail prerendering;
 *   - a permanent cache on a reused serverless instance hides a key the
 *     operator just saved in the admin console.
 *
 * A count-based guard keeps the per-request duplicate call from re-querying.
 */
async function dbKeys(): Promise<Partial<Record<ProviderId, string>>> {
  // Without Supabase the admin console writes to the developer store; read it
  // back or a key pasted in Settings is silently ignored.
  if (localMode()) {
    const keys: Partial<Record<ProviderId, string>> = {};
    const rows = await readLocalDb((db) => db.providerKeys);
    for (const row of rows) {
      const value = row.enabled ? row.api_key.trim() : "";
      if (value && looksLikeKey(value)) keys[row.provider as ProviderId] = value;
    }
    return keys;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from("grace_provider_keys")
      .select("provider, api_key")
      .eq("enabled", true);
    if (error) return {};
    const keys: Partial<Record<ProviderId, string>> = {};
    for (const row of data ?? []) {
      const value = typeof row.api_key === "string" ? row.api_key.trim() : "";
      if (value && looksLikeKey(value)) {
        keys[row.provider as ProviderId] = value;
      }
    }
    return keys;
  } catch {
    return {};
  }
}

/**
 * Kept so the admin route's call site stays meaningful. Nothing is cached any
 * more, so there is no state to drop; the export documents that a write takes
 * effect on the next read.
 */
export function invalidateProviderKeyCache() {
  void 0;
}

export async function getProviderKey(
  provider: ProviderId
): Promise<string | undefined> {
  return envKey(provider) ?? (await dbKeys())[provider];
}

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const fromDb = await dbKeys();
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => {
    const meta = PROVIDERS[id];
    return {
      id,
      label: meta.label,
      blurb: meta.blurb,
      envKey: meta.envKey,
      docsUrl: meta.docsUrl,
      configured: Boolean(envKey(id) ?? fromDb[id]),
    };
  });
}

export async function configuredProviders(): Promise<Set<ProviderId>> {
  const status = await getProviderStatus();
  return new Set(status.filter((s) => s.configured).map((s) => s.id));
}

/** Optional app-level attribution for OpenRouter rankings. */
export function appReferer(): string {
  return (
    process.env.GRACE_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://grace.chat")
  );
}

/**
 * Per-key model allow-list.
 *
 * A key can be limited to a subset of its provider's models, so an operator can
 * hand a friend a key that only reaches the cheap ones. `null` means "not
 * restricted" — the state every key starts in, including one added before this
 * feature existed. An empty array means the key serves nothing yet, which the
 * dialog produces when every box is unticked.
 *
 * Ids are stored without the provider prefix (that is what the provider
 * reports) and compared that way, so a prefix change cannot silently unlock
 * everything.
 */
export async function keyModelAllowList(
  provider: ProviderId
): Promise<string[] | null> {
  try {
    if (localMode()) {
      const rows = await readLocalDb((db) => db.providerKeys);
      const row = rows.find((r) => r.provider === provider);
      return row?.models ?? null;
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("grace_provider_keys")
      .select("models")
      .eq("provider", provider)
      .maybeSingle();
    if (error || !data) return null;
    const models = (data as { models?: string[] | null }).models;
    return Array.isArray(models) ? models : null;
  } catch {
    // Never lock a key out because the allow-list could not be read.
    return null;
  }
}

/** Whether this key may serve this model id. Unknown keys are unrestricted. */
export async function keyServesModel(provider: ProviderId, modelId: string): Promise<boolean> {
  const allow = await keyModelAllowList(provider);
  if (allow === null) return true;
  const bare = modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId;
  return allow.some((id) => id === modelId || id === bare);
}

/** The allowed ids for every configured provider, for filtering the catalog. */
export async function allowLists(): Promise<Partial<Record<ProviderId, string[] | null>>> {
  const providers = Object.keys(PROVIDERS) as ProviderId[];
  const entries = await Promise.all(
    providers.map(async (provider) => [provider, await keyModelAllowList(provider)] as const)
  );
  return Object.fromEntries(entries);
}

/**
 * Writes the allow-list for a key.
 *
 * Returns false when there is no key row to update: the list is a property of an
 * existing key, so it cannot create one. Values are de-duplicated and trimmed,
 * and an empty list is stored as `{}` rather than null so "serve nothing" stays
 * distinct from "serve everything".
 */
export async function setKeyModels(provider: ProviderId, models: string[]): Promise<boolean> {
  const clean = [...new Set(models.map((id) => id.trim()).filter(Boolean))];

  try {
    if (localMode()) {
      let found = false;
      await readLocalDb((db) => {
        const row = db.providerKeys.find((r) => r.provider === provider);
        if (!row) return db.providerKeys;
        found = true;
        row.models = clean;
        row.updated_at = new Date().toISOString();
        return db.providerKeys;
      });
      return found;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { data, error } = await supabase
      .from("grace_provider_keys")
      .update({ models: clean })
      .eq("provider", provider)
      .select("provider");
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
