import { redirect } from "next/navigation";

import { Landing } from "@/components/marketing/landing";
import { getCurrentUser } from "@/lib/auth/session";
import { getProviderStatus } from "@/lib/ai/env";

/**
 * The signed-out page. It lives outside the `(app)` group so it never mounts
 * the sidebar, and "/" sends a visitor here rather than rendering two shells.
 */
export const instant = false;

export const metadata = {
  title: "Grace — an AI that keeps things clear",
};

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const status = await getProviderStatus();
  return <Landing providers={status.map((s) => ({ label: s.label, configured: s.configured }))} />;
}
