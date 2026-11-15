import { NextResponse } from "next/server";
import { z } from "zod";

import { clientKey, emailSchema, jsonError, parseJson, rateLimit } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/db/store";
import { publicUser } from "@/lib/auth/session";
import { StorageError } from "@/lib/supabase/server";

const schema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "login"), 12, 60_000);
  if (!limited.ok) return jsonError("Too many attempts. Try again in a minute.", 429);

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;

  let row: Awaited<ReturnType<typeof findUserByEmail>>;
  try {
    row = await findUserByEmail(body.email);
  } catch (error) {
    if (error instanceof StorageError) return jsonError(error.message, 503);
    throw error;
  }
  const valid = row ? await verifyPassword(body.password, row.password_hash as string | null) : false;

  // Same message either way so the endpoint cannot confirm which emails exist.
  if (!row || !valid) return jsonError("That email and password do not match.", 401);

  await createSession(String(row.id));
  return NextResponse.json({ user: publicUser(row) });
}
