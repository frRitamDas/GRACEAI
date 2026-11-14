import { NextResponse } from "next/server";
import { z } from "zod";

import { clientKey, emailSchema, jsonError, parseJson, passwordSchema, rateLimit } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { countUsers, createUser, findUserByEmail } from "@/lib/db/store";
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

    // The first account owns the deployment, so it becomes the admin.
    const isAdmin = (await countUsers()) === 0;
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      email: body.email,
      name: body.name,
      passwordHash,
      isAdmin,
    });

    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof StorageError) return jsonError(error.message, 503);
    throw error;
  }
}
