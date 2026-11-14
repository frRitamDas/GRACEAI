/**
 * Provider catalog.
 *
 * Two layers, deliberately:
 *
 *   1. A curated list bundled with the app, so the model picker works before
 *      any provider key exists.
 *   2. Live discovery (`lib/ai/discovery.ts`), which asks each provider what it
 *      actually serves right now and marks the zero-cost ones as free. That is
 *      the authoritative list once a key is present — providers retire and add
 *      models faster than any hardcoded table can track.
 *
 * Provider APIs are all OpenAI-compatible, so one transport serves all three.
 */

export type ProviderId = "openrouter" | "groq" | "google" | "nvidia";

export type ProviderMeta = {
  id: ProviderId;
  label: string;
  /** One short line used in settings copy. */
  blurb: string;
  /** Server env var that holds the key. Never sent to the browser. */
  envKey: string;
  /** Docs URL shown in the connect hint. */
  docsUrl: string;
  /** Where free usage comes from, in one line, for the picker. */
  freeNote: string;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    blurb: "One key for Claude, GPT, Gemini and more.",
    envKey: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/keys",
    freeNote: "Models tagged :free cost nothing to run.",
  },
  groq: {
    id: "groq",
    label: "Groq",
    blurb: "Open models at very low latency.",
    envKey: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/keys",
    freeNote: "Every Groq model runs on the free plan.",
  },
  nvidia: {
    id: "nvidia",
    label: "NVIDIA NIM",
    blurb: "Nemotron 3 Ultra direct from NVIDIA, free for development.",
    envKey: "NVIDIA_API_KEY",
    docsUrl: "https://build.nvidia.com",
    freeNote: "Free on a developer key; production use needs a license.",
  },
  google: {
    id: "google",
    label: "Google AI Studio",
    blurb: "Gemini models direct from Google.",
    envKey: "GOOGLE_AI_API_KEY",
    docsUrl: "https://aistudio.google.com/apikey",
    freeNote: "AI Studio keys include a free tier on every model.",
  },
};

export type EffortLevel = {
  id: "instant" | "quick" | "balanced" | "deep" | "ultra";
  /** First word is painted in accent, second word in white (DESIGN.md §3). */
  name: string;
  index: number;
  /** One line explaining what the level buys, shown in the effort panel. */
  hint: string;
};

/** Instant -> Ultra. Five discrete stops keeps each thumb position honest. */
export const EFFORT_LEVELS: EffortLevel[] = [
  { id: "instant", name: "Instant effort", index: 0, hint: "Fastest reply, smallest model." },
  { id: "quick", name: "Quick effort", index: 1, hint: "A step up in quality, still quick." },
  { id: "balanced", name: "Balanced effort", index: 2, hint: "Everyday reasoning and writing." },
  { id: "deep", name: "Deep effort", index: 3, hint: "Multi-step work, careful answers." },
  { id: "ultra", name: "Ultra effort", index: 4, hint: "Frontier models, full reasoning." },
];

export const DEFAULT_EFFORT_INDEX = 0;

export type ModelDef = {
  id: string;
  /** User-facing name. Kept short so it fits a menu row. */
  name: string;
  provider: ProviderId;
  /** Upstream model id for the provider API. */
  upstream: string;
  /** 1 (fastest/cheapest) .. 5 (most capable). Drives effort routing. */
  tier: number;
  /** Rough per-answer cost in Grace credits. Free models cost 0. */
  credits: number;
  contextLabel: string;
  /** Short reason-to-pick line. */
  blurb: string;
  /** True when running this model costs no money on the provider. */
  free?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Curated catalog                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Frontier set. Ordered by tier so effort fallback can walk down the list.
 * Everything here is completions-capable; if a provider retires an id the
 * router falls back to the next best model on the same provider, and live
 * discovery replaces this list whenever a key is available.
 */
export const MODELS: ModelDef[] = [
  // --- OpenRouter: frontier closed models ---------------------------------
  {
    id: "openrouter/anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    provider: "openrouter",
    upstream: "anthropic/claude-sonnet-5.5",
    tier: 5,
    credits: 6,
    contextLabel: "1M context",
    blurb: "Long-horizon work and careful writing.",
  },
  {
    id: "openrouter/openai/gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "openrouter",
    upstream: "openai/gpt-6-astra",
    tier: 5,
    credits: 8,
    contextLabel: "1M context",
    blurb: "Hard reasoning, coding and research.",
  },
  {
    id: "openrouter/google/gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "openrouter",
    upstream: "google/gemini-4-argon",
    tier: 5,
    credits: 6,
    contextLabel: "1M context",
    blurb: "Math, science and multi-step agents.",
  },
  {
    id: "openrouter/anthropic/claude-opus-5.5",
    name: "Claude Opus 5.5",
    provider: "openrouter",
    upstream: "anthropic/claude-opus-5.5",
    tier: 5,
    credits: 10,
    contextLabel: "1M context",
    blurb: "Deepest Claude for complex builds.",
  },
  {
    id: "openrouter/openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "openrouter",
    upstream: "openai/gpt-5.2",
    tier: 4,
    credits: 4,
    contextLabel: "400K context",
    blurb: "Reliable everyday reasoning.",
  },
  {
    id: "openrouter/anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "openrouter",
    upstream: "anthropic/claude-sonnet-4.6",
    tier: 4,
    credits: 4,
    contextLabel: "1M context",
    blurb: "Balanced coding and analysis.",
  },
  {
    id: "openrouter/openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openrouter",
    upstream: "openai/gpt-5-mini",
    tier: 2,
    credits: 1,
    contextLabel: "400K context",
    blurb: "Fast answers, low cost.",
  },
  {
    id: "openrouter/moonshotai/kimi-k3.1-pro",
    name: "Kimi K3.1 Pro",
    provider: "openrouter",
    upstream: "moonshotai/kimi-k3.1-pro",
    tier: 4,
    credits: 3,
    contextLabel: "1M context",
    blurb: "Open-weight long-horizon coding.",
  },

  // --- OpenRouter: free models (:free suffix, zero cost) -------------------
  {
    id: "openrouter/inclusionai/ling-3.2-flash:free",
    name: "Ling 3.2 Flash",
    provider: "openrouter",
    upstream: "inclusionai/ling-3.2-flash:free",
    tier: 3,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Free reasoning model that reads images.",
    free: true,
  },
  {
    id: "openrouter/baidu/ernie-5.5-flash-preview:free",
    name: "ERNIE 5.5 Flash",
    provider: "openrouter",
    upstream: "baidu/ernie-5.5-flash-preview:free",
    tier: 4,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Free, strong at coding and agent work.",
    free: true,
  },

  // --- Groq: fast open models ---------------------------------------------
  {
    id: "groq/openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    provider: "groq",
    upstream: "openai/gpt-oss-120b",
    tier: 4,
    credits: 0,
    contextLabel: "131K context",
    blurb: "Open weights on Groq LPUs.",
    free: true,
  },
  {
    id: "groq/openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "groq",
    upstream: "openai/gpt-oss-20b",
    tier: 2,
    credits: 0,
    contextLabel: "131K context",
    blurb: "Small, fast and free.",
    free: true,
  },
  {
    id: "groq/qwen/qwen3.8-27b",
    name: "Qwen3.8 27B",
    provider: "groq",
    upstream: "qwen/qwen3.8-27b",
    tier: 4,
    credits: 0,
    contextLabel: "262K context",
    blurb: "Multilingual reasoning at Groq speed.",
    free: true,
  },
  {
    id: "groq/moonshotai/kimi-k2-instruct-0905",
    name: "Kimi K2",
    provider: "groq",
    upstream: "moonshotai/kimi-k2-instruct-0905",
    tier: 3,
    credits: 0,
    contextLabel: "256K context",
    blurb: "Strong reasoning, free on Groq.",
    free: true,
  },
  {
    id: "groq/qwen/qwen3-32b",
    name: "Qwen3 32B",
    provider: "groq",
    upstream: "qwen/qwen3-32b",
    tier: 2,
    credits: 0,
    contextLabel: "131K context",
    blurb: "Multilingual and quick.",
    free: true,
  },

  // --- NVIDIA: Nemotron 3 Ultra -------------------------------------------
  // 550B MoE with 55B active. Ultra-long context makes it the pick for reading
  // a whole repository in one pass, which is why Grace Code offers it by name.
  {
    id: "openrouter/nvidia/nemotron-3-ultra",
    name: "Nemotron 3 Ultra",
    provider: "openrouter",
    upstream: "nvidia/nemotron-3-ultra-550b-a55b",
    tier: 5,
    credits: 3,
    contextLabel: "1M context",
    blurb: "NVIDIA's flagship reasoning model — huge context.",
  },
  {
    id: "openrouter/nvidia/nemotron-3-ultra:free",
    name: "Nemotron 3 Ultra (free)",
    provider: "openrouter",
    upstream: "nvidia/nemotron-3-ultra-550b-a55b:free",
    tier: 5,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Same model, rate-limited and free.",
    free: true,
  },
  {
    id: "nvidia/nvidia/nemotron-3-ultra-550b-a55b",
    name: "Nemotron 3 Ultra (NVIDIA)",
    provider: "nvidia",
    upstream: "nvidia/nemotron-3-ultra-550b-a55b",
    tier: 5,
    credits: 3,
    contextLabel: "1M context",
    blurb: "Direct from NVIDIA NIM — lowest latency.",
  },
  {
    id: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout",
    provider: "groq",
    upstream: "meta-llama/llama-4-scout-17b-16e-instruct",
    tier: 2,
    credits: 0,
    contextLabel: "131K context",
    blurb: "Lightweight everyday tasks.",
    free: true,
  },
  {
    id: "groq/llama-3.1-8b-instant",
    name: "Llama 3.1 8B",
    provider: "groq",
    upstream: "llama-3.1-8b-instant",
    tier: 1,
    credits: 0,
    contextLabel: "131K context",
    blurb: "Instant one-liners.",
    free: true,
  },

  // --- Google AI Studio: Gemini -------------------------------------------
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
    upstream: "gemini-3.1-pro-preview",
    tier: 5,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Frontier multimodal reasoning.",
    free: true,
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    upstream: "gemini-3-flash-preview",
    tier: 3,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Fast, cheap and multimodal.",
    free: true,
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash-Lite",
    provider: "google",
    upstream: "gemini-3.1-flash-lite-preview",
    tier: 2,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Highest throughput for small jobs.",
    free: true,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    upstream: "gemini-2.5-flash",
    tier: 3,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Proven workhorse, still free.",
    free: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    provider: "google",
    upstream: "gemini-2.5-flash-lite",
    tier: 1,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Cheapest free Gemini for small jobs.",
    free: true,
  },
  {
    id: "google/gemini-flash-latest",
    name: "Gemini Flash (latest)",
    provider: "google",
    upstream: "gemini-flash-latest",
    tier: 3,
    credits: 0,
    contextLabel: "1M context",
    blurb: "Always the newest Flash.",
    free: true,
  },
];

export const DEFAULT_MODEL_ID = "openrouter/anthropic/claude-sonnet-5.5";

/** The best free model to start with, so a new account can chat for nothing. */
export const DEFAULT_FREE_MODEL_ID = "google/gemini-2.5-flash";

export function getModel(id: string | null | undefined, catalog: ModelDef[] = MODELS): ModelDef | undefined {
  if (!id) return undefined;
  return catalog.find((m) => m.id === id);
}

export function modelsForProvider(provider: ProviderId, catalog: ModelDef[] = MODELS): ModelDef[] {
  return catalog.filter((m) => m.provider === provider);
}

/**
 * Effort picks the best model for the level, preferring the user's chosen
 * provider, then any available provider, then the closest lower tier so a
 * request never fails just because a tier is missing.
 */
export function pickModelForEffort(
  effortIndex: number,
  preferredProvider: ProviderId,
  available: Set<ProviderId>,
  catalog: ModelDef[] = MODELS
): ModelDef {
  const targetTier = Math.min(5, Math.max(1, effortIndex + 1));
  const pool = catalog.filter((m) => available.has(m.provider));
  const usable = pool.length ? pool : catalog;

  const atOrAbove = usable.filter((m) => m.tier >= targetTier);
  const preferred = atOrAbove.filter((m) => m.provider === preferredProvider);
  const rest = atOrAbove.filter((m) => m.provider !== preferredProvider);
  const lower = usable
    .filter((m) => m.tier < targetTier)
    .sort((a, b) => b.tier - a.tier);

  // Cheapest first inside a tier: a free model that answers just as well should
  // win over a paid one at the same capability.
  const rank = (a: ModelDef, b: ModelDef) =>
    a.tier === b.tier ? a.credits - b.credits : b.tier - a.tier;

  return [...preferred.sort(rank), ...rest.sort(rank), ...lower][0] ?? usable[0] ?? MODELS[0];
}

/** Free models first at equal capability; used by the picker's Free filter. */
export function freeModels(catalog: ModelDef[] = MODELS): ModelDef[] {
  return catalog.filter((m) => m.free);
}
