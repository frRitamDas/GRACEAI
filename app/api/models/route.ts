import { NextResponse } from "next/server";

import { PROVIDERS } from "@/lib/ai/catalog";
import { cachedCatalog, storeCatalog } from "@/lib/ai/catalog-cache";
import { loadCatalog } from "@/lib/ai/discovery";
import { getProviderStatus } from "@/lib/ai/env";

/**
 * The model catalog.
 *
 * Providers report whether a key exists, never the key itself. Models are
 * discovered live once a key is present, so the picker shows what the provider
 * actually serves — including which models cost nothing — with the owner's
 * edits applied on top.
 *
 * Discovery is the slow part (three provider calls), so the built catalog is
 * cached for two minutes in `lib/ai/catalog-cache`. That cache is cleared by any
 * owner edit, so a hide or a reprice takes effect immediately; `?fresh=1` skips
 * it entirely.
 */

/**
 * Vercel caches an uncached route handler's response at the edge anyway, which
 * would freeze the catalog across deploys. `no-store` releases it; the only
 * cache that matters is the in-process one above.
 */
const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";

  const [status, catalog] = await Promise.all([
    getProviderStatus(),
    (async () => {
      if (!fresh) {
        const hit = cachedCatalog();
        if (hit) return hit;
      }
      const built = await loadCatalog();
      storeCatalog(built);
      return built;
    })(),
  ]);

  const ready = new Set(status.filter((s) => s.configured).map((s) => s.id));

  const body = JSON.stringify({
    providers: status,
    models: catalog.models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      providerLabel: PROVIDERS[m.provider].label,
      tier: m.tier,
      credits: m.credits,
      contextLabel: m.contextLabel,
      blurb: m.blurb,
      free: Boolean(m.free),
      available: ready.size === 0 ? true : ready.has(m.provider),
    })),
    freeCount: catalog.models.filter((m) => m.free).length,
    liveProviders: catalog.live,
    anyConfigured: ready.size > 0,
  });

  return new NextResponse(body, { status: 200, headers: HEADERS });
}
