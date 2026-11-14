import { ChatApp } from "@/components/grace/chat-app";
import { getCurrentUser } from "@/lib/auth/session";
import { periodResetLabel } from "@/lib/db/local";
import { getUsage, getUserById, listConversations } from "@/lib/db/store";
import { MODELS, PROVIDERS } from "@/lib/ai/catalog";
import { getProviderStatus } from "@/lib/ai/env";
import { Landing } from "@/components/marketing/landing";

/**
 * "/" is the chat when signed in and the welcome page when not. Both are
 * request-time because they read the session cookie.
 */
// Session cookies are read on every request, so this route blocks by design.
export const instant = false;

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    const status = await getProviderStatus();
    return <Landing providers={status.map((s) => ({ label: s.label, configured: s.configured }))} />;
  }

  const [usage, conversations, fresh, status] = await Promise.all([
    getUsage(user.id),
    listConversations(user.id),
    getUserById(user.id),
    getProviderStatus(),
  ]);

  const current = fresh ?? user;
  const allowance = current.plan === "apex-pro" ? 12_000 : current.plan === "apex" ? 3_000 : 250;
  const total = Math.max(allowance, usage.used + current.credits);
  const usedPct = current.unlimited ? 0 : total === 0 ? 0 : Math.round((usage.used / total) * 100);

  return (
    <ChatApp
      initialUser={{
        id: current.id,
        email: current.email,
        name: current.name,
        isAdmin: current.isAdmin,
        unlimited: current.unlimited,
        plan: current.plan,
        credits: current.credits,
        effort: current.effort,
        provider: current.provider,
        model: current.model,
        showCreditPercentage: current.showCreditPercentage,
      }}
      initialUsage={{
        used: usage.used,
        credits: current.credits,
        allowance,
        unlimited: current.unlimited,
        usedPct,
        remainingPct: current.unlimited ? 100 : Math.max(0, 100 - usedPct),
        resets: periodResetLabel(),
        plan: current.plan,
      }}
      initialConversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
      }))}
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
    />
  );
}
