import { redirect } from "next/navigation";

import { ApexView } from "@/components/grace/apex-view";
import { getCurrentUser } from "@/lib/auth/session";
import { loadShell } from "@/lib/shell";

export const instant = false;

export const metadata = { title: "Apex — Grace" };

export default async function ApexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  const shell = await loadShell();
  const member = Boolean(shell?.user.unlimited || shell?.user.plan.startsWith("apex"));

  return <ApexView member={member} />;
}
