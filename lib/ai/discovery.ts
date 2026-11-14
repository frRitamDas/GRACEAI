import "server-only";

import { MODELS, PROVIDERS, type ModelDef, type ProviderId } from "@/lib/ai/catalog";
import { getProviderKey } from "@/lib/ai/env";
import { applyOverrides, loadOverrides } from "@/lib/ai/overrides";

/**
 * Live model discovery.
 *
 * The bundled catalog is a guess about what exists; this asks each provider
 * what it actually serves right now, which is the only honest answer once a key
 * is present. Providers add and retire models constantly, so a hardcoded list
 * silently rots.
 *
 * Free detection per provider:
 *   openrouter  — the `:free` suffix, and pricing.prompt === pricing.completion === "0"
 *   groq        — the free tier covers every chat model, so all are free
 *   google      — AI Studio keys include a free tier, so all are free; the
 *                 paid-only ids are filtered out by name
 *
 * A failure in any provider never breaks the page: the bundled entries for
 * that provider stay in place, so the picker degrades to the curated catalog.
 */

export type DiscoveredModel = ModelDef;

/** Substrings that mark a Google model as not usable for chat. */
const GOOGLE_SKIP = [
  "embedding",
  "embed",
  "aqa",
  "imagen",
  "veo",
  "image",
  "tts",
  "audio",
  "live",
  "learnlm",
];

/**
 * OpenRouter routes these to non-chat endpoints — batch jobs, moderation and
 * single-purpose tools like summarize/extract. They answer a different API shape
 * and would fail in the chat window, so they never enter the picker.
 */
const OPENROUTER_SKIP = [
  ":batch",
  "content-safety",
  "moderation",
  "guard",
  "scaledown/",
  "/summarize",
  "/extract",
  "/rerank",
  ":online",
];

const TIER_HINTS: [RegExp, number][] = [
  [/opus|sol-pro|gpt-6|ultra|pro(?![a-z])/i, 5],
  [/sonnet|terra|gpt-5\.\d|kimi|qwen3\.8|ernie-5\.5|gemini-3\.\d-pro/i, 4],
  [/flash(?!-lite)|scout|oss-120b|medium|3[0-9]b|27b|32b|hydrogen|carbon/i, 3],
  [/mini|lite|small|light|instant|8b|20b|2b/i, 2],
  [/guard|prompt|safeguard|allam/i, 1],
];

/** Model families whose names are acronyms, not words. */
const ACRONYMS = new Set(["gpt", "oss", "llm", "moe", "api", "vl", "it", "ai", "sft", "dpo", "rlhf"]);

function guessTier(id: string, contextLength: number): number {
  for (const [pattern, tier] of TIER_HINTS) {
    if (pattern.test(id)) return tier;
  }
  if (contextLength >= 500_000) return 3;
  if (contextLength >= 100_000) return 2;
  return 1;
}

/**
 * Grace credits per tier. Kept in one place so the live catalog and the bundled
 * one cannot drift apart, and so a "Frontier" badge always means the same price.
 */
function creditsForTier(tier: number): number {
  return [1, 1, 1, 2, 3, 4][Math.min(5, Math.max(1, tier))] ?? 2;
}

function contextLabel(tokens: number): string {
  if (!tokens || tokens <= 0) return "Context unknown";
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M context`;
  return `${Math.round(tokens / 1000)}K context`;
}

/**
 * A row title that reads like a product, not a slug.
 *
 * OpenRouter usually sends a display name ("Baidu: ERNIE 5.5 Flash Preview"),
 * which only needs the vendor and the "(free)" suffix trimmed. When a name is
 * missing it falls back to the id, and that has to be humanised: keep the case
 * of real acronyms and version numbers, then title-case the words.
 */
function prettyName(raw: string, suffixPattern: RegExp): string {
  let name = raw.replace(suffixPattern, "").trim();
  name = name.replace(/^[^:]+:\s*/, ""); // "Google: Gemini 3 Pro" -> "Gemini 3 Pro"
  name = name.replace(/\s*\(free\)\s*/i, "");
  name = name.replace(/\s+/g, " ").trim();

  // A slug is all-lowercase with hyphens and a version number; a display name
  // has a capital letter somewhere.
  const looksLikeSlug = /^[a-z0-9._-]+$/.test(name) && !/[A-Z]/.test(name);
  if (looksLikeSlug) {
    name = name
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((word) => {
        // Known model-family acronyms stay upper-case.
        if (ACRONYMS.has(word)) return word.toUpperCase();
        // A letter-prefixed number ("lfm3", "v4") keeps its case, since the
        // number is part of the product name.
        if (/^[a-z]+[0-9]/.test(word)) return word.toUpperCase();
        // Size tokens ("20b", "1.7b") read better lower-case next to the name.
        if (/^[0-9.]+b$/.test(word)) return `${word.slice(0, -1)}B`;
        if (/^[0-9]/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  return name;
}

function blurbFor(free: boolean, provider: ProviderId): string {
  if (provider === "groq") return free ? "Runs free on Groq." : "Runs on Groq.";
  if (provider === "google") return free ? "Free on an AI Studio key." : "Paid on an AI Studio key.";
  return free ? "Free on OpenRouter." : "Paid on OpenRouter.";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Per-provider discovery                                                     */
/* -------------------------------------------------------------------------- */

type OpenRouterRow = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
};

async function discoverOpenRouter(key: string): Promise<DiscoveredModel[]> {
  // /models is public, but send the key so per-account access is respected.
  const payload = await fetchJson<{ data: OpenRouterRow[] }>("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!payload?.data?.length) return [];

  const out: DiscoveredModel[] = [];
  for (const row of payload.data) {
    if (!row.id) continue;
    if (OPENROUTER_SKIP.some((needle) => row.id.includes(needle))) continue;

    const isFree =
      row.id.endsWith(":free") ||
      (row.pricing?.prompt === "0" && row.pricing?.completion === "0");

    // A model nobody can actually send messages to is not a model we offer.
    if (row.supported_parameters && !row.supported_parameters.includes("max_tokens")) continue;

    const vision = row.architecture?.input_modalities?.includes("image") ?? false;
    out.push({
      id: `openrouter/${row.id}`,
      name: prettyName(row.name ?? row.id, /\s*\(free\)\s*$/i),
      provider: "openrouter",
      upstream: row.id,
      tier: guessTier(row.id, row.context_length ?? 0),
      // Price the model by what it is, not by how long its context window is:
      // a 1M-context small model is still a small model.
      credits: isFree ? 0 : creditsForTier(guessTier(row.id, row.context_length ?? 0)),
      contextLabel: contextLabel(row.context_length ?? 0) + (vision ? " · vision" : ""),
      blurb: blurbFor(isFree, "openrouter"),
      free: isFree,
    });
  }
  return out;
}

type GroqRow = {
  id: string;
  active?: boolean;
  context_window?: number;
  owned_by?: string;
};

async function discoverGroq(key: string): Promise<DiscoveredModel[]> {
  const payload = await fetchJson<{ data: GroqRow[] }>("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!payload?.data?.length) return [];

  return payload.data
    .filter((row) => row.id && row.active !== false)
    .filter((row) => !/whisper|tts|distil-whisper|guard/i.test(row.id))
    .map((row) => {
      const id = row.id.startsWith("groq/") ? row.id.slice(5) : row.id;
      const name = prettyName(id, /$/);
      return {
        id: `groq/${id}`,
        name: name.length > 34 ? `${name.slice(0, 32)}…` : name,
        provider: "groq" as const,
        upstream: id,
        tier: guessTier(id, row.context_window ?? 0),
        credits: 0,
        contextLabel: contextLabel(row.context_window ?? 0),
        blurb: blurbFor(true, "groq"),
        free: true,
      };
    });
}

type GoogleRow = {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

async function discoverGoogle(key: string): Promise<DiscoveredModel[]> {
  const payload = await fetchJson<{ models?: GoogleRow[] }>(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`
  );
  if (!payload?.models?.length) return [];

  const out: DiscoveredModel[] = [];
  for (const row of payload.models) {
    const upstream = (row.name ?? "").replace(/^models\//, "");
    if (!upstream) continue;
    if (!row.supportedGenerationMethods?.includes("generateContent")) continue;
    if (GOOGLE_SKIP.some((needle) => upstream.includes(needle))) continue;

    out.push({
      id: `google/${upstream}`,
      name: prettyName(row.displayName ?? upstream, /$/),
      provider: "google",
      upstream,
      tier: guessTier(upstream, row.inputTokenLimit ?? 0),
      credits: 0,
      contextLabel: contextLabel(row.inputTokenLimit ?? 0),
      blurb: blurbFor(true, "google"),
      free: true,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Assembly                                                                   */
/* -------------------------------------------------------------------------- */

export type CatalogResult = {
  models: ModelDef[];
  /** Providers whose live list was used. Anything else fell back to bundled. */
  live: ProviderId[];
};

/**
 * The model catalog for this request.
 *
 * Providers that answer are authoritative for their own models; providers that
 * do not answer keep their curated entries. Duplicates across the two lists are
 * resolved in favour of live data.
 */
export async function loadCatalog(): Promise<CatalogResult> {
  const entries = await Promise.all(
    (Object.keys(PROVIDERS) as ProviderId[]).map(async (provider) => {
      const key = await getProviderKey(provider);
      if (!key) return { provider, models: [] as DiscoveredModel[] };
      const models =
        provider === "openrouter"
          ? await discoverOpenRouter(key)
          : provider === "groq"
            ? await discoverGroq(key)
            : await discoverGoogle(key);
      return { provider, models };
    })
  );

  const live = new Map<ProviderId, DiscoveredModel[]>();
  for (const entry of entries) {
    if (entry.models.length > 0) live.set(entry.provider, entry.models);
  }

  const models: ModelDef[] = [];
  for (const provider of Object.keys(PROVIDERS) as ProviderId[]) {
    const discovered = live.get(provider);
    if (discovered) {
      models.push(...discovered);
    } else {
      // No live answer: keep the curated entries so the picker is never empty.
      models.push(...MODELS.filter((m) => m.provider === provider));
    }
  }

  // Owner edits win over whatever the providers reported: a hidden model stays
  // hidden across a provider refresh, and a renamed one keeps its name.
  const overrides = await loadOverrides();
  return { models: applyOverrides(models, overrides), live: [...live.keys()] };
}

/** The catalog for a single provider, without touching the others. */
export async function loadProviderModels(provider: ProviderId): Promise<ModelDef[]> {
  const key = await getProviderKey(provider);
  if (!key) return MODELS.filter((m) => m.provider === provider);
  const models =
    provider === "openrouter"
      ? await discoverOpenRouter(key)
      : provider === "groq"
        ? await discoverGroq(key)
        : await discoverGoogle(key);
  const base = models.length ? models : MODELS.filter((m) => m.provider === provider);
  const overrides = await loadOverrides();
  return applyOverrides(base, overrides).filter((m) => m.provider === provider);
}
