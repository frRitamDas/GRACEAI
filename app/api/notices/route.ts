import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { dismissNotice, listDismissals } from "@/lib/db/social";

/** Which Upcoming notices this account has cleared. */

const schema = z.object({ id: z.string().trim().min(1).max(80) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ dismissed: [] });
  return NextResponse.json(
    { dismissed: await listDismissals(user.id) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Send a notice id." }, { status: 400 });
  }

  const ok = await dismissNotice(user.id, body.id);
  if (!ok) return NextResponse.json({ error: "That could not be saved." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
