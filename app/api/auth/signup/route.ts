import { NextResponse } from "next/server";
import { z } from "zod";

import { clientKey, emailSchema, jsonError, parseJson, passwordSchema, rateLimit } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { countUsers, createUser, findUserByEmail } from "@/lib/db/store";
import { isOwnerEmail } from "@/lib/allowlist";
import { getSettings } from "@/lib/settings";
import { StorageError } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(1, "What should Grace call you?").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "signup"), 8, 60_000);
  if (!limited.ok) {
    return jsonError("Too many attempts. Try again in a minute.", 429);
  }

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;

  try {
    const existing = await findUserByEmail(body.email);
    if (existing) return jsonError("That email already has an account. Sign in instead.", 409);

    const settings = await getSettings();
    const owner = isOwnerEmail(body.email);
    // Sign-ups can be closed by the owner. Their own address always gets in so
    // a fresh deployment can never lock itself out.
    if (!settings.signupEnabled && !owner) {
      return jsonError("Sign-ups are closed on this deployment. Ask the owner for an account.", 403);
    }

    // The owner's address owns the deployment; on a fresh database the first
    // account does too, so a self-hosted install is never headless.
    const isAdmin = owner || (await countUsers()) === 0;
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      email: body.email,
      name: body.name,
      passwordHash,
      isAdmin,
      // An invited owner lands as Apex instead of Free.
      plan: isAdmin ? "apex-pro" : "free",
    });

    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof StorageError) return jsonError(error.message, 503);
    throw error;
  }
}
