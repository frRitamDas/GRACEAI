import { redirect } from "next/navigation";

import { ChatApp } from "@/components/grace/chat-app";
import { getCurrentUser } from "@/lib/auth/session";
import { getProviderStatus } from "@/lib/ai/env";
import { MODELS, PROVIDERS } from "@/lib/ai/catalog";
import { loadShell } from "@/lib/shell";

/**
 * The chat. Effort, model and credits all come from the shell load, so this
 * page only has to add the model catalog and whether any provider is awake.
 */
export const instant = false;

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const [shell, status, params] = await Promise.all([
    loadShell(),
    getProviderStatus(),
    searchParams,
  ]);
  if (!shell) redirect("/welcome");

  return (
    <ChatApp
      initialUser={{
        id: shell.user.id,
        email: shell.user.email,
        name: shell.user.name,
        isAdmin: shell.user.isAdmin,
        unlimited: shell.user.unlimited,
        plan: shell.user.plan,
        credits: shell.user.credits,
        effort: shell.account.effort,
        provider: shell.account.provider,
        model: shell.account.model,
        showCreditPercentage: shell.user.showCreditPercentage,
      }}
      initialUsage={shell.usage}
      initialConversations={shell.conversations}
      initialModels={MODELS.map((m) => ({
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
      anyConfigured={status.some((s) => s.configured)}
      initialConversationId={params.c ?? null}
    />
  );
}
