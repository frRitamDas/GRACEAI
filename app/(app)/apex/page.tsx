import { redirect } from "next/navigation";

import { ApexView } from "@/components/grace/apex-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { loadShell } from "@/lib/shell";

export const instant = false;

export const metadata = { title: "Apex" };

export default async function ApexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  // The owner can remove this surface. A URL is not a way around that.
  if (!(await getSettings()).features.apex) redirect("/");
  const shell = await loadShell();
  const member = Boolean(shell?.user.unlimited || shell?.user.plan.startsWith("apex"));

  return <ApexView member={member} />;
}
