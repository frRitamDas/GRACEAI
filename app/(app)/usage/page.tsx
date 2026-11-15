import { redirect } from "next/navigation";

import { UsageView } from "@/components/grace/usage-view";
import { getCurrentUser } from "@/lib/auth/session";
import { loadShell } from "@/lib/shell";

export const instant = false;

export const metadata = { title: "Usage & limits" };

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  const shell = await loadShell();
  if (!shell) redirect("/welcome");

  return (
    <UsageView
      usage={shell.usage}
      showPercentage={shell.user.showCreditPercentage}
      plan={shell.user.plan}
      apex={shell.user.unlimited || shell.user.plan.startsWith("apex")}
      credits={shell.user.credits}
    />
  );
}
