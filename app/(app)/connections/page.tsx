import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ConnectionsView } from "@/components/grace/connections-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getGithubAccount, githubOAuthConfigured } from "@/lib/github/client";
import { configuredProviders } from "@/lib/ai/env";
import { loadCatalog } from "@/lib/ai/discovery";

export const instant = false;

export const metadata = { title: "Connections — Grace" };

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const [account, ready, catalog] = await Promise.all([
    getGithubAccount(user.id).catch(() => null),
    configuredProviders(),
    loadCatalog().catch(() => ({ models: [] as { provider: string }[] })),
  ]);

  const gemini = catalog.models.filter((m) => m.provider === "google").length;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";

  return (
    <Suspense fallback={null}>
      <ConnectionsView
        initial={{
          google: {
            // Sign-in with Google needs an OAuth client, not just a model key.
            configured: Boolean(clientId && process.env.GOOGLE_CLIENT_SECRET?.trim()),
            clientIdHint: clientId ? clientId.slice(0, 12) : null,
            models: ready.has("google") ? gemini : 0,
          },
          github: {
            connected: Boolean(account),
            login: account?.login ?? null,
            name: account?.name ?? null,
            avatarUrl: account?.avatarUrl ?? null,
            oauthConfigured: githubOAuthConfigured(),
          },
          env: { appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "" },
        }}
      />
    </Suspense>
  );
}
