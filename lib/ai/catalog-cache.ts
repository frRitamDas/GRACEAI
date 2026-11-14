import "server-only";

import type { ModelDef, ProviderId } from "@/lib/ai/catalog";

/**
 * One cache for the built catalog, shared by `/api/models` and anything else
 * that needs it.
 *
 * Discovery costs up to three provider round-trips, so the result is cached for
 * two minutes. It lives here rather than inside a route because an owner edit
 * has to be able to clear it: otherwise a model they just hid stays visible
 * until the entry ages out, which reads as the edit not working.
 */

export type CatalogSnapshot = { models: ModelDef[]; live: ProviderId[] };

type Entry = { at: number; value: CatalogSnapshot };

declare global {
  var __graceCatalogCache: Entry | null | undefined;
}

const TTL_MS = 120_000;

export function cachedCatalog(): CatalogSnapshot | null {
  const entry = globalThis.__graceCatalogCache;
  if (!entry) return null;
  if (Date.now() - entry.at >= TTL_MS) return null;
  return entry.value;
}

export function storeCatalog(value: CatalogSnapshot) {
  globalThis.__graceCatalogCache = { at: Date.now(), value };
}

export function clearCatalogCache() {
  globalThis.__graceCatalogCache = null;
}
