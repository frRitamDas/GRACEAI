import { redirect } from "next/navigation";

import { SettingsView } from "@/components/grace/settings-view";
import { getCurrentUser } from "@/lib/auth/session";
import { PROVIDERS } from "@/lib/ai/catalog";
import { loadCatalog } from "@/lib/ai/discovery";
import { getProviderStatus } from "@/lib/ai/env";

// Session cookies are read on every request, so this route blocks by design.
export const instant = false;

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [status, catalog] = await Promise.all([getProviderStatus(), loadCatalog()]);

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
      providers={status}
      models={catalog.models.map((m) => ({
        id: m.id,
        name: m.name,
        providerLabel: PROVIDERS[m.provider].label,
        credits: m.credits,
        tier: m.tier,
        available: status.find((s) => s.id === m.provider)?.configured ?? false,
      }))}
      isAdmin={user.isAdmin}
    />
  );
}
