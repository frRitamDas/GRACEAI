import { NextResponse } from "next/server";
import { z } from "zod";

import { PROVIDERS, type ModelDef, type ProviderId } from "@/lib/ai/catalog";
import { loadCatalog } from "@/lib/ai/discovery";
import {
  deleteOverride,
  loadOverrides,
  saveOverride,
  type ModelOverride,
} from "@/lib/ai/overrides";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Model management for the owner.
 *
 * This is the only screen that sees the whole catalog with every provider's
 * models in one list — the public picker deliberately hides unavailable ones.
 * Edits are stored as overrides so a provider refresh never discards them.
 *
 * GET    list every model with its effective values and whether an override
 *        exists.
 * PATCH  edit one model (rename, tier, credits, blurb, free, hidden).
 * POST   add a custom model that discovery cannot produce.
 * DELETE remove an override, restoring discovered values.
 */

const auth = async () => {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  if (!user.isAdmin) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { user };
};

export async function GET() {
  const guard = await auth();
  if (guard.error) return guard.error;

  const [catalog, overrides] = await Promise.all([loadCatalog(), loadOverrides()]);

  const models = catalog.models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    providerLabel: PROVIDERS[m.provider].label,
    tier: m.tier,
    credits: m.credits,
    contextLabel: m.contextLabel,
    blurb: m.blurb,
    free: Boolean(m.free),
    upstream: m.upstream,
    override: overrides.get(m.id) ?? null,
  }));

  // Overrides can name models discovery did not return (a retired model the
  // owner still wants listed). Surface them so the console can manage them.
  const present = new Set(models.map((m) => m.id));
  const orphans = [...overrides.values()].filter((o) => !present.has(o.id));

  return NextResponse.json(
    {
      models,
      orphans,
      liveProviders: catalog.live,
      counts: {
        total: models.length,
        free: models.filter((m) => m.free).length,
        edited: models.filter((m) => m.override).length + orphans.length,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

const editSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().max(80).nullable().optional(),
  tier: z.number().int().min(1).max(5).nullable().optional(),
  credits: z.number().int().min(0).max(100).nullable().optional(),
  blurb: z.string().trim().max(160).nullable().optional(),
  contextLabel: z.string().trim().max(40).nullable().optional(),
  free: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await auth();
  if (guard.error) return guard.error;

  let body: z.infer<typeof editSchema>;
  try {
    body = editSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Send a model id and the fields to change." }, { status: 400 });
  }

  const [catalog, overrides] = await Promise.all([loadCatalog(), loadOverrides()]);
  const base = catalog.models.find((m) => m.id === body.id);
  const existing = overrides.get(body.id);

  if (!base && !existing) {
    return NextResponse.json({ error: "That model is not in the catalog." }, { status: 404 });
  }

  const merged: ModelOverride = {
    id: body.id,
    hidden: body.hidden ?? existing?.hidden ?? false,
    name: body.name !== undefined ? body.name : (existing?.name ?? null),
    tier: body.tier !== undefined ? body.tier : (existing?.tier ?? null),
    credits: body.credits !== undefined ? body.credits : (existing?.credits ?? null),
    blurb: body.blurb !== undefined ? body.blurb : (existing?.blurb ?? null),
    custom: existing?.custom ?? false,
    provider: existing?.provider ?? (base?.provider as ProviderId) ?? null,
    upstream: existing?.upstream ?? base?.upstream ?? null,
    contextLabel:
      body.contextLabel !== undefined ? body.contextLabel : (existing?.contextLabel ?? null),
    free: body.free ?? existing?.free ?? false,
  };

  if (!(await saveOverride(merged))) {
    return NextResponse.json({ error: "That change could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, override: merged });
}

const customSchema = z.object({
  id: z.string().trim().min(3).max(200).regex(/^[a-z0-9]+\/.+$/i, "Use provider/model-id."),
  name: z.string().trim().min(1).max(80),
  provider: z.enum(Object.keys(PROVIDERS) as [ProviderId, ...ProviderId[]]),
  upstream: z.string().trim().min(1).max(160),
  tier: z.number().int().min(1).max(5).default(3),
  credits: z.number().int().min(0).max(100).default(0),
  contextLabel: z.string().trim().max(40).default("Context varies"),
  blurb: z.string().trim().max(160).default("Custom model."),
  free: z.boolean().default(false),
});

export async function POST(request: Request) {
  const guard = await auth();
  if (guard.error) return guard.error;

  let body: z.infer<typeof customSchema>;
  try {
    body = customSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError ? (error.issues[0]?.message ?? "Check the fields.") : "Check the fields.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const override: ModelOverride = {
    id: body.id,
    hidden: false,
    name: body.name,
    tier: body.tier,
    credits: body.free ? 0 : body.credits,
    blurb: body.blurb,
    custom: true,
    provider: body.provider,
    upstream: body.upstream,
    contextLabel: body.contextLabel,
    free: body.free,
  };

  if (!(await saveOverride(override))) {
    return NextResponse.json({ error: "That model could not be added." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, model: override });
}

const deleteSchema = z.object({ id: z.string().min(1).max(200) });

export async function DELETE(request: Request) {
  const guard = await auth();
  if (guard.error) return guard.error;

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Send a model id." }, { status: 400 });
  }

  const [catalog, overrides] = await Promise.all([loadCatalog(), loadOverrides()]);
  const existing = overrides.get(body.id);
  if (!existing) {
    return NextResponse.json({ error: "That model has no override." }, { status: 404 });
  }

  // A custom model has nothing to fall back to; removing it removes the model.
  // A discovered model only loses its edits.
  const wasCustom = existing.custom;
  if (!(await deleteOverride(body.id))) {
    return NextResponse.json({ error: "That override could not be removed." }, { status: 500 });
  }
  void catalog;

  return NextResponse.json({ ok: true, removed: wasCustom ? "model" : "edits" });
}

/** The shape the console renders, exported so the page and client agree. */
export type AdminModel = ModelDef & { override: ModelOverride | null };
