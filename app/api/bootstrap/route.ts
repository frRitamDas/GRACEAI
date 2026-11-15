import { NextResponse } from "next/server";

import { getCurrentUser, displayName } from "@/lib/auth/session";
import { EFFORT_LEVELS } from "@/lib/ai/catalog";
import { getSettings, fillGreeting } from "@/lib/settings";

/**
 * What every surface needs before it can draw itself.
 *
 * The public half (brand, copy, kill switch, announcements, which features are
 * on) is what a signed-out visitor may see. The private half is added only when
 * a session exists. Nothing here exposes a provider key, a model id or a plan
 * list — the console reads those from `/api/admin/*`.
 *
 * `no-store` because these values are the console's switches: a cached copy
 * would leave a banner up after the owner dismissed it, or a composer open
 * after chat was paused.
 */
const HEADERS = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);

  const name = user ? displayName(user) : "";
  const index = Math.floor(Date.now() / 1000 / 60) % Math.max(1, settings.greetings.length);

  return NextResponse.json(
    {
      public: {
        brandName: settings.brandName,
        tagline: settings.tagline,
        chatEnabled: settings.chatEnabled,
        signupEnabled: settings.signupEnabled,
        announcement: settings.announcement,
        footerNote: settings.footerNote,
        features: settings.features,
        greeting: fillGreeting(settings.greetings[index] ?? settings.greetings[0], name),
        greetings: settings.greetings.map((g) => fillGreeting(g, name)),
        effort: EFFORT_LEVELS.map((e) => ({ id: e.id, name: e.name, hint: e.hint })),
      },
      user: user
        ? {
            id: user.id,
            name: user.name,
            firstName: name,
            email: user.email,
            isAdmin: user.isAdmin,
            plan: user.plan,
            unlimited: user.unlimited,
            credits: user.credits,
            effort: user.effort,
            showCreditPercentage: user.showCreditPercentage,
          }
        : null,
    },
    { headers: HEADERS }
  );
}
