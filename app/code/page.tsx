import { redirect } from "next/navigation";

import { CodeApp } from "@/components/grace/code/code-app";
import { getCurrentUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/code/store";
import { MODELS, PROVIDERS } from "@/lib/ai/catalog";
import { getProviderStatus } from "@/lib/ai/env";
import { catalogWithOverrides } from "@/lib/ai/overrides";

// Sessions are read per request, so this page cannot be static.
export const instant = false;

export const metadata = {
  title: "Grace Code",
  description: "A coding workspace where Grace reads your files and writes the changes back.",
};

export default async function CodePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [projects, status, catalog] = await Promise.all([
    listProjects(user.id),
    getProviderStatus(),
    catalogWithOverrides(MODELS),
  ]);

  return (
    <CodeApp
      initialProjects={projects}
      userModel={user.model}
      initialModels={catalog
        // Coding needs a model that can hold a large file set; the smallest
        // tiers cannot, so they are not offered here rather than failing late.
        .filter((m) => m.tier >= 2)
        .map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          providerLabel: PROVIDERS[m.provider].label,
          tier: m.tier,
          credits: m.credits,
          contextLabel: m.contextLabel,
          blurb: m.blurb,
          free: Boolean(m.free),
          available: status.find((s) => s.id === m.provider)?.configured ?? false,
        }))}
    />
  );
}
