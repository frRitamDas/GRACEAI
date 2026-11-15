import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { findUserByEmail, getUserById, listUsers, updateUser } from "@/lib/db/store";
import { getUsage } from "@/lib/db/store";

/**
 * Member administration.
 *
 * The owner can list accounts, grant or revoke Apex by email, change a plan,
 * and promote another account to owner. Two things are deliberately refused:
 * revoking the last owner (which would lock the deployment) and demoting
 * yourself (which would strand the console).
 */

const grantSchema = z.object({
  email: z.string().trim().email().max(200),
  action: z.enum(["grant", "revoke"]),
  /** Optional explicit plan; defaults to apex for grants. */
  plan: z.enum(["free", "apex", "apex-pro"]).optional(),
});

const roleSchema = z.object({
  email: z.string().trim().email().max(200),
  action: z.enum(["promote", "demote"]),
});

export async function GET() {
  const owner = await getCurrentUser();
  if (!owner) return jsonError("Sign in to open the console.", 401);
  if (!owner.isAdmin) return jsonError("This console is for the deployment owner.", 403);

  const rows = await listUsers();
  const detailed = await Promise.all(
    rows.slice(0, 200).map(async (row) => {
      const usage = await getUsage(row.id).catch(() => ({ used: 0, allowance: 0 }));
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        plan: row.plan,
        isAdmin: row.isAdmin,
        unlimited: row.unlimited,
        credits: row.credits,
        createdAt: row.createdAt,
        conversations: row.conversationCount,
        used: usage.used,
      };
    })
  );

  return NextResponse.json({ members: detailed }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const owner = await getCurrentUser();
  if (!owner) return jsonError("Sign in to open the console.", 401);
  if (!owner.isAdmin) return jsonError("This console is for the deployment owner.", 403);

  const raw = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;

  // One endpoint, two shapes: membership grants and role changes.
  if (raw.action === "promote" || raw.action === "demote") {
    const body = await parseJson(request, roleSchema);
    if (body instanceof NextResponse) return body;

    const target = await findUserByEmail(body.email);
    if (!target) return jsonError("No Grace account uses that email.", 404);
    if (target.id === owner.id) return jsonError("You cannot change your own role.", 400);

    if (body.action === "demote") {
      const owners = (await listUsers()).filter((u) => u.isAdmin);
      if (owners.length <= 1) return jsonError("There has to be at least one owner.", 400);
    }

    const updated = await updateUser(target.id, { is_admin: body.action === "promote" });
    if (!updated) return jsonError("That change did not save.", 500);
    return NextResponse.json({ member: updated });
  }

  const body = await parseJson(request, grantSchema);
  if (body instanceof NextResponse) return body;

  const target = await findUserByEmail(body.email);
  if (!target) return jsonError("No Grace account uses that email.", 404);

  const plan = body.action === "grant" ? (body.plan ?? "apex") : "free";
  const updated = await updateUser(target.id, {
    plan,
    // An owner account is unlimited by design; revoking must not remove that.
    unlimited: target.is_admin ? true : body.action === "grant",
    ...(body.action === "grant" ? { credits: Math.max(target.credits, 3_000) } : {}),
  });
  if (!updated) return jsonError("That change did not save.", 500);

  const fresh = await getUserById(target.id);
  return NextResponse.json({
    member: fresh,
    action: body.action,
    email: body.email.trim().toLowerCase(),
  });
}
