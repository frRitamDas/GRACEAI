import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { EFFORT_LEVELS, getModel, PROVIDERS, type ProviderId } from "@/lib/ai/catalog";
import { configuredProviders } from "@/lib/ai/env";
import { updateUser } from "@/lib/db/store";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  effort: z.number().int().min(0).max(EFFORT_LEVELS.length - 1).optional(),
  provider: z.enum(Object.keys(PROVIDERS) as [ProviderId, ...ProviderId[]]).optional(),
  model: z.string().max(120).nullable().optional(),
  showCreditPercentage: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to change settings.", 401);

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;

  if (body.model) {
    const model = getModel(body.model);
    if (!model) return jsonError("That model is not in the catalog.");
    const ready = await configuredProviders();
    if (ready.size > 0 && !ready.has(model.provider)) {
      return jsonError(`${PROVIDERS[model.provider].label} is not connected yet.`, 409);
    }
  }

  const updated = await updateUser(user.id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.effort !== undefined ? { effort: body.effort } : {}),
    ...(body.provider !== undefined ? { provider: body.provider } : {}),
    ...(body.model !== undefined ? { model: body.model } : {}),
    ...(body.showCreditPercentage !== undefined
      ? { show_credit_percentage: body.showCreditPercentage }
      : {}),
  });

  if (!updated) return jsonError("Could not save that change.", 500);
  return NextResponse.json({ user: updated });
}
