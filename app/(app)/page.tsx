import { redirect } from "next/navigation";

import { ChatApp } from "@/components/grace/chat-app";
import { getCurrentUser } from "@/lib/auth/session";
import { getProviderStatus } from "@/lib/ai/env";
import { loadShell } from "@/lib/shell";
import { getSettings } from "@/lib/settings";

/**
 * The chat. Effort, credits and conversations come from the shell load; this
 * page only adds the brand copy from the console and whether any provider is
 * awake. No model is ever passed to the client: the owner picks it.
 */
export const instant = false;

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const [shell, status, params, settings] = await Promise.all([
    loadShell(),
    getProviderStatus(),
    searchParams,
    getSettings(),
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
        showCreditPercentage: shell.user.showCreditPercentage,
      }}
      initialUsage={shell.usage}
      initialConversations={shell.conversations}
      anyConfigured={status.some((s) => s.configured)}
      announcement={settings.announcement}
      brandName={settings.brandName}
      chatEnabled={settings.chatEnabled}
      greetings={settings.greetings}
      footerNote={settings.footerNote}
      features={settings.features}
      initialConversationId={params.c ?? null}
    />
  );
}
