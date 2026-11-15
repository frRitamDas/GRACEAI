import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { billingConfigured, createCheckout } from "@/lib/billing";

/**
 * Starts a purchase, or says why it cannot.
 *
 * Never returns success without a provider: an unconfigured checkout is a 503
 * with a plain reason, so the modal can show it instead of a fake confirmation.
 */

const schema = z.object({ kind: z.enum(["credits", "apex"]) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Pick what to buy." }, { status: 400 });
  }

  const result = await createCheckout(user.id, body.kind);
  if (!result.configured) {
    return NextResponse.json(
      { error: result.reason, code: "billing_unconfigured", configured: false },
      { status: 503 }
    );
  }
  return NextResponse.json({ url: result.url, configured: billingConfigured() });
}

export async function GET() {
  return NextResponse.json({ configured: billingConfigured() });
}
