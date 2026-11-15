import { redirect } from "next/navigation";

import { AppShell } from "@/components/grace/app-shell";
import { loadShell } from "@/lib/shell";
import { getSettings } from "@/lib/settings";

/**
 * The signed-in frame.
 *
 * Every page under `(app)` gets the same sidebar, search, floating chat and
 * session, so none of them mount their own chrome and none of them can drift
 * from the others. Signed-out visitors fall through to the landing page, which
 * lives outside this group.
 */
export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [shell, settings] = await Promise.all([loadShell(), getSettings()]);
  if (!shell) redirect("/welcome");

  return (
    <AppShell
      user={{
        id: shell.user.id,
        name: shell.user.name,
        email: shell.user.email,
        isAdmin: shell.user.isAdmin,
        unlimited: shell.user.unlimited,
        plan: shell.user.plan,
        credits: shell.user.credits,
        effort: shell.account.effort,
        showCreditPercentage: shell.user.showCreditPercentage,
      }}
      usage={shell.usage}
      conversations={shell.conversations}
      brandName={settings.brandName}
      features={{
        projects: settings.features.projects,
        memory: settings.features.memory,
        apex: settings.features.apex,
        graceCode: settings.features.graceCode,
      }}
    >
      {children}
    </AppShell>
  );
}
