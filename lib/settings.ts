import "server-only";

import { connection } from "next/server";

import { localMode, nowIso, readLocalDb, withLocalDb } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Deployment settings.
 *
 * One row per installation, written only by the owner in the admin console.
 * Everything here is read by the public surfaces (shell copy, which models the
 * chat may route to, whether the composer is open) so a control flipped in the
 * console takes effect on the next request without a redeploy.
 *
 * Secrets are not here. Provider keys keep their own table.
 */

export type DeploymentSettings = {
  /** The product's display name. Used in copy, the tab title and the persona. */
  brandName: string;
  /** How Grace introduces itself; the persona rule is appended server-side. */
  tagline: string;
  /** Powers chat at all. Off shows an honest "paused" state to users. */
  chatEnabled: boolean;
  /** Allow public sign-ups. Off leaves existing sessions working. */
  signupEnabled: boolean;
  /** The three fixed greetings. `{name}` is replaced with the first name. */
  greetings: [string, string, string];
  /** Announcement banner: null when hidden. */
  announcement: { id: string; text: string; href: string } | null;
  /**
   * The model that answers every chat turn. The owner sets it once so users
   * never see or choose a model. Empty means "let effort decide" from the
   * allowed set.
   */
  chatModel: string;
  /** Model ids the router may use, in preference order. Empty = the catalog. */
  allowedModels: string[];
  /** Models hidden from the owner's own pickers (kept for read-only telemetry). */
  hiddenModels: string[];
  /** Shown under the composer. */
  footerNote: string;
  /** Which surfaces are reachable. */
  features: {
    graceCode: boolean;
    projects: boolean;
    memory: boolean;
    apex: boolean;
    attachments: boolean;
    deepResearch: boolean;
  };
  updatedAt: string;
};

export const DEFAULT_SETTINGS: DeploymentSettings = {
  brandName: "GRACE AI",
  tagline: "A calmer space to think clearly.",
  chatEnabled: true,
  signupEnabled: true,
  greetings: [
    "Where should we start, {name}?",
    "What should Grace look into, {name}?",
    "What needs clarity, {name}?",
  ],
  announcement: null,
  allowedModels: [],
  hiddenModels: [],
  chatModel: "",
  footerNote: "Grace can make mistakes.",
  features: {
    graceCode: true,
    projects: true,
    memory: true,
    apex: true,
    attachments: true,
    deepResearch: true,
  },
  updatedAt: new Date(0).toISOString(),
};

/** Fields the console is allowed to write. Anything else is ignored. */
export type SettingsPatch = Partial<
  Pick<
    DeploymentSettings,
    | "brandName"
    | "tagline"
    | "chatEnabled"
    | "signupEnabled"
    | "greetings"
    | "announcement"
    | "chatModel"
    | "allowedModels"
    | "hiddenModels"
    | "footerNote"
    | "features"
  >
>;

const CACHE_MS = 1_000;
let cache: { at: number; value: DeploymentSettings } | null = null;

function merge(base: DeploymentSettings, patch: Partial<DeploymentSettings>): DeploymentSettings {
  return {
    ...base,
    ...patch,
    greetings: (patch.greetings ?? base.greetings).slice(0, 3) as [string, string, string],
    features: { ...base.features, ...(patch.features ?? {}) },
  };
}

/** Carry forward operator edits while replacing only the former shipped defaults. */
function migrateLegacyDefaults(stored: Partial<DeploymentSettings>): Partial<DeploymentSettings> {
  return {
    ...stored,
    brandName: stored.brandName === "Grace" ? DEFAULT_SETTINGS.brandName : stored.brandName,
    tagline:
      stored.tagline === "An AI that keeps things clear." ? DEFAULT_SETTINGS.tagline : stored.tagline,
  };
}

export async function getSettings(): Promise<DeploymentSettings> {
  // These are the console's switches. They are read at request time, never baked
  // into a prerendered page, or a banner the owner removed would keep showing
  // until the next deploy. `connection()` is also what keeps the short cache
  // below from being evaluated during a static pass.
  await connection();

  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let value: DeploymentSettings = DEFAULT_SETTINGS;
  if (localMode()) {
    const row = await readLocalDb((db) => db.settings ?? null);
    if (row) value = merge(DEFAULT_SETTINGS, migrateLegacyDefaults(row as Partial<DeploymentSettings>));
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase.from("grace_settings").select("value").eq("id", "deployment").maybeSingle();
      const stored = (data?.value ?? null) as Partial<DeploymentSettings> | null;
      if (stored) value = merge(DEFAULT_SETTINGS, migrateLegacyDefaults(stored));
    }
  }

  cache = { at: Date.now(), value };
  return value;
}

/** Read a feature switch at request time for API guards. */
export async function featureEnabled(feature: keyof DeploymentSettings["features"]): Promise<boolean> {
  return (await getSettings()).features[feature];
}

export async function saveSettings(patch: SettingsPatch): Promise<DeploymentSettings> {
  const current = await getSettings();
  const next = merge(current, { ...patch, updatedAt: nowIso() } as Partial<DeploymentSettings>);

  if (localMode()) {
    await withLocalDb((db) => {
      db.settings = next;
    });
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase
        .from("grace_settings")
        .upsert({ id: "deployment", value: next, updated_at: nowIso() }, { onConflict: "id" });
    }
  }

  cache = { at: Date.now(), value: next };
  return next;
}

/**
 * Whether a specific model id may answer a chat turn.
 *
 * An empty allowlist means "whatever the catalog decides": the owner has not
 * restricted routing, so effort still picks the tier. Once the owner picks any
 * model, only those ids are eligible.
 */
export function modelAllowed(settings: DeploymentSettings, id: string): boolean {
  if (settings.allowedModels.length === 0) {
    return !settings.hiddenModels.includes(id);
  }
  return settings.allowedModels.includes(id) && !settings.hiddenModels.includes(id);
}

/**
 * Every model id that may answer, restricted to the ones the deployment can
 * actually reach. With no allowlist this is the whole reachable catalog minus
 * hidden models; with one it is the allowlist filtered the same way.
 */
export function allowedCatalog<T extends { id: string; provider: string }>(
  settings: DeploymentSettings,
  catalog: T[],
  reachable: Set<string>
): T[] {
  // Hidden always means unavailable. If an allowlist names only models that
  // cannot be reached, fall back to other reachable, non-hidden models; never
  // resurrect a hidden model just to avoid an empty result.
  const available = catalog.filter(
    (model) => reachable.has(model.provider) && !settings.hiddenModels.includes(model.id)
  );
  const selected = available.filter((model) => modelAllowed(settings, model.id));
  // An allowlist naming only unreachable models must not strand the deploy:
  // fall back to other reachable, non-hidden models, never to hidden ones.
  return selected.length > 0 ? selected : available;
}

/** Replace `{name}` in a greeting, and nothing else. */
export function fillGreeting(template: string, name: string): string {
  return template.replaceAll("{name}", name || "there");
}
