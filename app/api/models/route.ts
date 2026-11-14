import { NextResponse } from "next/server";

import { PROVIDERS } from "@/lib/ai/catalog";
import { loadCatalog } from "@/lib/ai/discovery";
import { getProviderStatus } from "@/lib/ai/env";

/**
 * The model catalog.
 *
 * Providers report whether a key exists, never the key itself. Models are
 * discovered live once a key is present, so the picker shows what the provider
 * actually serves — including which models cost nothing.
 *
 * Discovery is the slow part (three provider calls), so the response carries a
 * short shared cache. `?fresh=1` skips it, which is what the admin console uses
 * right after a key is saved.
 */

const CACHE_MS = 120_000;
let cache: { at: number; body: string; status: number } | null = null;

/**
 * Vercel caches an uncached route handler's response at the edge anyway, which
 * would freeze the catalog across deploys. `no-store` releases it; short edge
 * caching is left to the in-process cache above, which is what actually keeps
 * the three provider calls off the critical path.
 */
const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";

  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return new NextResponse(cache.body, { status: cache.status, headers: HEADERS });
  }

  const [status, catalog] = await Promise.all([getProviderStatus(), loadCatalog()]);
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

  cache = { at: Date.now(), body, status: 200 };

  return new NextResponse(body, { status: 200, headers: HEADERS });
}
