import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { EFFORT_LEVELS } from "@/lib/ai/catalog";
import { updateUser } from "@/lib/db/store";

/**
 * Personal preferences. Users choose how hard Grace thinks, not which model
 * answers — the owner sets that in the console — so `model` and `provider`
 * are deliberately absent from this schema and a request carrying them is
 * rejected rather than silently ignored.
 */
const schema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    effort: z.number().int().min(0).max(EFFORT_LEVELS.length - 1).optional(),
    showCreditPercentage: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to change settings.", 401);

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;

  const updated = await updateUser(user.id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.effort !== undefined ? { effort: body.effort } : {}),
    ...(body.showCreditPercentage !== undefined
      ? { show_credit_percentage: body.showCreditPercentage }
      : {}),
  });

  if (!updated) return jsonError("Could not save that change.", 500);
  return NextResponse.json({ user: updated });
}
