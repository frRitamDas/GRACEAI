import { NextResponse } from "next/server";
import { z } from "zod";

import { PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import { loadProviderModels } from "@/lib/ai/discovery";
import { getProviderKey, keyModelAllowList } from "@/lib/ai/env";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The models a provider key can serve, plus which of them the key is currently
 * allowed to use. This is what the "Which models should this key serve?"
 * dialog reads.
 *
 * Only ids, names and context labels leave the server — never the key.
 */
export const GET = async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const provider = new URL(request.url).searchParams.get("provider") as ProviderId | null;
  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const key = await getProviderKey(provider);
  if (!key) {
    return NextResponse.json({ configured: false, models: [], selected: [] });
  }

  const [models, allow] = await Promise.all([
    loadProviderModels(provider),
    keyModelAllowList(provider),
  ]);

  // Strip the provider prefix so ids match what the provider reports.
  const bare = (id: string) => (id.includes("/") ? id.slice(id.indexOf("/") + 1) : id);

  return NextResponse.json({
    configured: true,
    provider: { id: provider, label: PROVIDERS[provider].label, freeNote: PROVIDERS[provider].freeNote },
    models: models.map((m) => ({
      id: bare(m.id),
      name: m.name,
      tier: m.tier,
      contextLabel: m.contextLabel,
    })),
    // Selected is a list of ids. A null allow-list means everything is on.
    selected: allow === null ? models.map((m) => bare(m.id)) : allow,
    restricted: allow !== null,
  });
};

const schema = z.object({
  provider: z.enum(["openrouter", "groq", "google"]),
  models: z.array(z.string().min(1).max(200)).max(500),
});

/** Saves the allow-list. An empty list is meaningful: the key serves nothing. */
export const PUT = async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Send a provider and a list of model ids." }, { status: 400 });
  }

  const { setKeyModels } = await import("@/lib/ai/env");
  const ok = await setKeyModels(body.provider, body.models);
  if (!ok) {
    return NextResponse.json({ error: "The key could not be updated." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: body.models.length });
};
