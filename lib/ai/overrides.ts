import "server-only";

import { MODELS, PROVIDERS, type ModelDef, type ProviderId } from "@/lib/ai/catalog";
import { clearCatalogCache } from "@/lib/ai/catalog-cache";
import { localMode, readLocalDb, withLocalDb } from "@/lib/db/local";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Owner edits layered on top of the discovered catalog.
 *
 * Discovery answers "what does this provider serve right now". This answers
 * "what should the product offer", which is a different question and belongs to
 * the operator: hide an experimental model, reprice one, rename a slug, or add a
 * model the provider does not advertise. Keeping the two separate means a
 * provider refresh can never silently undo a decision.
 *
 * The override set is small (a handful of rows) and read on every catalog build,
 * so it is fetched with the catalog rather than cached separately.
 */

export type ModelOverride = {
  id: string;
  hidden: boolean;
  name: string | null;
  tier: number | null;
  credits: number | null;
  blurb: string | null;
  custom: boolean;
  provider: ProviderId | null;
  upstream: string | null;
  contextLabel: string | null;
  free: boolean;
};

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

function normalise(row: Record<string, unknown>): ModelOverride | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;
  const provider = PROVIDER_IDS.find((p) => p === row.provider) ?? null;
  return {
    id,
    hidden: row.hidden === true,
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
    tier: typeof row.tier === "number" ? Math.min(5, Math.max(1, row.tier)) : null,
    credits: typeof row.credits === "number" ? Math.max(0, row.credits) : null,
    blurb: typeof row.blurb === "string" && row.blurb.trim() ? row.blurb.trim() : null,
    custom: row.custom === true,
    provider,
    upstream: typeof row.upstream === "string" && row.upstream.trim() ? row.upstream.trim() : null,
    contextLabel:
      typeof row.context_label === "string" && row.context_label.trim()
        ? row.context_label.trim()
        : null,
    free: row.free === true,
  };
}

/**
 * Every override, keyed by model id.
 *
 * Never throws: if the table is missing (a deployment that has not run the
 * migration) or the database is unreachable, the catalog simply behaves as if
 * nobody has customised it.
 */
export async function loadOverrides(): Promise<Map<string, ModelOverride>> {
  const out = new Map<string, ModelOverride>();
  try {
    if (localMode()) {
      const rows = await readLocalDb((db) => db.modelOverrides ?? []);
      for (const row of rows) {
        const parsed = normalise(row as unknown as Record<string, unknown>);
        if (parsed) out.set(parsed.id, parsed);
      }
      return out;
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return out;
    const { data, error } = await supabase.from("grace_model_overrides").select("*");
    if (error) return out;
    for (const row of data ?? []) {
      const parsed = normalise(row as Record<string, unknown>);
      if (parsed) out.set(parsed.id, parsed);
    }
  } catch {
    /* an unreachable table means no overrides, never a broken catalog */
  }
  return out;
}

/** A custom model row turned into a routable catalog entry. */
function customModel(override: ModelOverride): ModelDef | null {
  if (!override.custom || !override.provider) return null;
  if (!PROVIDERS[override.provider]) return null;
  const upstream = override.upstream ?? override.id.slice(override.id.indexOf("/") + 1);
  return {
    id: override.id,
    name: override.name ?? upstream,
    provider: override.provider,
    upstream,
    tier: override.tier ?? 3,
    credits: override.credits ?? (override.free ? 0 : 2),
    contextLabel: override.contextLabel ?? "Context varies",
    blurb: override.blurb ?? (override.free ? "Free custom model." : "Custom model."),
    free: override.free,
  };
}

/**
 * Applies overrides to a discovered catalog.
 *
 * Order: drop hidden models, apply field edits, then append custom models that
 * discovery cannot produce. Custom entries sort to the front of their provider
 * so an operator can find what they just added.
 */
export function applyOverrides(models: ModelDef[], overrides: Map<string, ModelOverride>): ModelDef[] {
  if (overrides.size === 0) return models;

  const merged: ModelDef[] = [];
  for (const model of models) {
    const override = overrides.get(model.id);
    if (override?.hidden) continue;
    if (!override) {
      merged.push(model);
      continue;
    }
    merged.push({
      ...model,
      name: override.name ?? model.name,
      tier: override.tier ?? model.tier,
      credits: override.credits ?? model.credits,
      contextLabel: override.contextLabel ?? model.contextLabel,
      blurb: override.blurb ?? model.blurb,
      free: override.free || model.free,
    });
  }

  const present = new Set(merged.map((m) => m.id));
  const custom: ModelDef[] = [];
  for (const override of overrides.values()) {
    if (!override.custom || present.has(override.id)) continue;
    if (override.hidden) continue;
    const model = customModel(override);
    if (model) custom.push(model);
  }

  return [...custom, ...merged];
}

/** The override map plus the catalog it produces, for admin screens. */
export async function catalogWithOverrides(models: ModelDef[]): Promise<ModelDef[]> {
  return applyOverrides(models, await loadOverrides());
}

/** Writes one override. Returns false when the row could not be stored. */
export async function saveOverride(override: ModelOverride): Promise<boolean> {
  const record = {
    id: override.id,
    hidden: override.hidden,
    name: override.name,
    tier: override.tier,
    credits: override.credits,
    blurb: override.blurb,
    custom: override.custom,
    provider: override.provider,
    upstream: override.upstream,
    context_label: override.contextLabel,
    free: override.free,
    updated_at: new Date().toISOString(),
  };

  try {
    if (localMode()) {
      await withLocalDb((db) => {
        const rows = (db.modelOverrides ??= []);
        const index = rows.findIndex((r) => r.id === override.id);
        if (index >= 0) rows[index] = record;
        else rows.push(record);
      });
      clearCatalogCache();
      return true;
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { error } = await supabase
      .from("grace_model_overrides")
      .upsert(record, { onConflict: "id" });
    if (!error) clearCatalogCache();
    return !error;
  } catch {
    return false;
  }
}

/** Removes an override, restoring the discovered values. */
export async function deleteOverride(id: string): Promise<boolean> {
  try {
    if (localMode()) {
      await withLocalDb((db) => {
        db.modelOverrides = (db.modelOverrides ?? []).filter((r) => r.id !== id);
      });
      clearCatalogCache();
      return true;
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { error } = await supabase.from("grace_model_overrides").delete().eq("id", id);
    if (!error) clearCatalogCache();
    return !error;
  } catch {
    return false;
  }
}

/** Bundled models a custom override does not need to duplicate. */
export function bundledModelIds(): Set<string> {
  return new Set(MODELS.map((m) => m.id));
}
