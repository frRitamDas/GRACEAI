import { redirect } from "next/navigation";

import { AppShell } from "@/components/grace/app-shell";
import { loadShell } from "@/lib/shell";

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
  const shell = await loadShell();
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
        provider: shell.account.provider,
        model: shell.account.model,
        showCreditPercentage: shell.user.showCreditPercentage,
      }}
      usage={shell.usage}
      conversations={shell.conversations}
    >
      {children}
    </AppShell>
  );
}
