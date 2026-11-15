import { redirect } from "next/navigation";

import { AuthDialog } from "@/components/marketing/auth-panel";
import { Landing } from "@/components/marketing/landing";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

/**
 * The public page.
 *
 * `/welcome` holds the marketing page and the account dialog; `/` is the chat
 * for signed-in people. A guest who lands on `/` is redirected here, and a
 * signed-in visitor who opens this page is sent to the chat — unless they came
 * to sign in to a different account, which `?mode=` says explicitly.
 *
 * With `?mode=signin|signup` the dialog opens over the page instead of being a
 * route of its own: no second full page load, and the hero stays visible behind
 * it so signing up still reads as joining the product you just saw.
 */
export const instant = false;

/**
 * Keep the browser chrome and mobile status bar aligned with Grace's dark
 * public surface.
 */
export const viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; prompt?: string }>;
}) {
  const [user, params, settings] = await Promise.all([
    getCurrentUser(),
    searchParams,
    getSettings(),
  ]);

  const mode = params.mode === "signup" || params.mode === "signin" ? params.mode : null;
  if (user && !mode) redirect("/");

  return (
    <>
      <Landing
        brandName={settings.brandName}
        tagline={settings.tagline}
        signupEnabled={settings.signupEnabled}
        chatEnabled={settings.chatEnabled}
        announcement={settings.announcement}
        footerNote={settings.footerNote}
        signedIn={Boolean(user)}
      />
      {mode && (
        <AuthDialog
          open
          initialMode={mode === "signin" ? "signin" : "signup"}
          signupEnabled={settings.signupEnabled || Boolean(user)}
          prompt={params.prompt ?? ""}
          dismissHref={user ? "/" : "/welcome"}
        />
      )}
    </>
  );
}
