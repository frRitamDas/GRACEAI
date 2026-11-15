import { redirect } from "next/navigation";

import { SettingsView } from "@/components/grace/settings-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

// Session cookies are read on every request, so this route blocks by design.
export const instant = false;

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const settings = await getSettings();

  return (
    <SettingsView
      user={{
        name: user.name,
        email: user.email,
        plan: user.plan,
        credits: user.credits,
        effort: user.effort,
        isAdmin: user.isAdmin,
        unlimited: user.unlimited,
        showCreditPercentage: user.showCreditPercentage,
      }}
      graceCodeEnabled={settings.features.graceCode}
      projectsEnabled={settings.features.projects}
    />
  );
}
