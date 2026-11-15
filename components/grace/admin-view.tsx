"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ExternalLink,
  Gauge,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { DeploymentPanel } from "@/components/grace/admin/deployment-panel";
import { MembersPanel } from "@/components/grace/admin/members-panel";
import type { ConsoleData, Member } from "@/components/grace/admin/types";
import { KeyModelsDialog } from "@/components/grace/key-models-dialog";
import { ModelManager } from "@/components/grace/model-manager";
import type { ProviderId } from "@/lib/ai/catalog";
import type { DeploymentSettings } from "@/lib/settings";

/**
 * The owner's console.
 *
 * One page, four tabs, nothing hidden behind a second click:
 *
 *   Overview  — is Grace able to answer at all, and what is it costing
 *   Models    — the on/off switch per model, and which one answers chat
 *   Site      — brand, greetings, availability, surfaces, announcement
 *   Members   — grant membership by email, promote, revoke
 *
 * Keys are write-only from the browser: the server stores them and reports only
 * whether one exists. Every successful write returns the saved record, so the
 * panel renders server truth instead of optimistic guesses.
 */

type Tab = "overview" | "models" | "site" | "members";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Gauge size={14} /> },
  { id: "models", label: "Models", icon: <Sparkles size={14} /> },
  { id: "site", label: "Site", icon: <BadgeCheck size={14} /> },
  { id: "members", label: "Members", icon: <Users size={14} /> },
];

export function AdminView() {
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [console_, setConsole] = useState<ConsoleData | null>(null);
  const [settings, setSettings] = useState<DeploymentSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [keyDialog, setKeyDialog] = useState<ProviderId | null>(null);

  const notify = useCallback((text: string, ok: boolean) => {
    setMessage({ text, ok });
    window.setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadConsole = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (response.ok) setConsole((await response.json()) as ConsoleData);
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { settings: DeploymentSettings };
      setSettings(data.settings);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const response = await fetch("/api/admin/members", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { members: Member[] };
        setMembers(data.members);
      }
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.all([loadConsole(), loadSettings()]);
      if (!alive) return;
      await loadMembers();
    })();
    // Who "you" are, for the one row that must not offer to demote itself.
    void (async () => {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { user?: { email?: string } | null };
      if (alive && data.user?.email) setOwnerEmail(data.user.email);
    })();
    return () => {
      alive = false;
    };
  }, [loadConsole, loadSettings, loadMembers]);

  const saveKey = async (provider: string) => {
    const apiKey = (drafts[provider] ?? "").trim();
    if (apiKey.length < 12) {
      notify("That key looks too short.", false);
      return;
    }
    setBusyKey(provider);
    try {
      const response = await fetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notify(result.error ?? "That key was not saved.", false);
        return;
      }
      setDrafts((prev) => ({ ...prev, [provider]: "" }));
      notify("Key saved. Models are live now.", true);
      await loadConsole();
      setKeyDialog(provider as ProviderId);
    } finally {
      setBusyKey(null);
    }
  };

  const removeKey = async (provider: string) => {
    setBusyKey(provider);
    try {
      const response = await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) {
        notify("That key was not removed.", false);
        return;
      }
      notify("Key removed.", true);
      await loadConsole();
    } finally {
      setBusyKey(null);
    }
  };

  const connected = console_?.providers.filter((p) => p.configured).length ?? 0;
  const granted = members.filter((m) => m.plan !== "free" || m.unlimited).length;

  return (
    <div className="scroll-quiet mx-auto h-full w-full max-w-[820px] overflow-y-auto px-3 pb-20 sm:px-6">
      <header className="sticky top-0 z-20 -mx-3 flex flex-col gap-2 bg-bg/92 px-3 pb-2 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to chat"
            className="press grid size-8 shrink-0 place-items-center rounded-[8px] text-sub hover:bg-white/[0.06] hover:text-ink"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <ShieldCheck size={15} className="text-accent" /> Console
            </h1>
            <p className="truncate text-[12px] leading-4 text-muted">
              {settings?.brandName ?? "Grace"} · owner only
            </p>
          </div>
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-0.5" aria-label="Console sections">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                  active ? "bg-ink text-black" : "text-sub hover:bg-control hover:text-ink"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {message && (
        <p
          role="status"
          className={`mt-3 flex items-center gap-2 rounded-[12px] border px-3 py-2 text-[12.5px] ${
            message.ok
              ? "border-accent/40 bg-accent-soft text-accent-text"
              : "border-hairline bg-control text-ink"
          }`}
        >
          {message.ok ? <Check size={13} /> : null}
          {message.text}
        </p>
      )}

      <div className="mt-4">
        {tab === "overview" && (
          <Overview
            data={console_}
            settings={settings}
            members={members}
            connected={connected}
            granted={granted}
            drafts={drafts}
            busyKey={busyKey}
            onDraft={(provider, value) => setDrafts((prev) => ({ ...prev, [provider]: value }))}
            onSaveKey={(provider) => void saveKey(provider)}
            onRemoveKey={(provider) => void removeKey(provider)}
            onOpenModels={() => setTab("models")}
            onOpenSite={() => setTab("site")}
          />
        )}

        {tab === "models" && (
          <ModelManager
            onMessage={(text, ok) => {
              notify(text, ok);
              if (ok) void loadSettings();
            }}
          />
        )}

        {tab === "site" &&
          (settings ? (
            <DeploymentPanel settings={settings} onChange={setSettings} onMessage={notify} />
          ) : (
            <Loading label="Reading the deployment settings" />
          ))}

        {tab === "members" && (
          <MembersPanel
            members={members}
            loading={loadingMembers}
            onReload={loadMembers}
            onMessage={notify}
            ownerEmail={ownerEmail}
          />
        )}
      </div>

      <KeyModelsDialog
        open={keyDialog !== null}
        provider={keyDialog}
        onClose={() => setKeyDialog(null)}
        onSaved={(count) => notify(`This key now serves ${count} model${count === 1 ? "" : "s"}.`, true)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Loading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 py-8 text-[13px] text-sub">
      <Loader2 size={14} className="animate-spin" /> {label}
    </p>
  );
}

function Overview({
  data,
  settings,
  members,
  connected,
  granted,
  drafts,
  busyKey,
  onDraft,
  onSaveKey,
  onRemoveKey,
  onOpenModels,
  onOpenSite,
}: {
  data: ConsoleData | null;
  settings: DeploymentSettings | null;
  members: Member[];
  connected: number;
  granted: number;
  drafts: Record<string, string>;
  busyKey: string | null;
  onDraft: (provider: string, value: string) => void;
  onSaveKey: (provider: string) => void;
  onRemoveKey: (provider: string) => void;
  onOpenModels: () => void;
  onOpenSite: () => void;
}) {
  if (!data || !settings) return <Loading label="Reading the console" />;

  const chats = members.reduce((sum, m) => sum + m.conversations, 0);
  const used = members.reduce((sum, m) => sum + m.used, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Four numbers, the state of the deployment at a glance. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Providers" value={`${connected}/${data.providers.length}`} hint="connected" />
        <Stat label="Accounts" value={String(members.length)} hint={`${granted} with membership`} />
        <Stat label="Chats" value={String(chats)} hint={`${used} credits used`} />
        <Stat
          label="Chat"
          value={settings.chatEnabled ? "Open" : "Paused"}
          hint={settings.chatEnabled ? "accepting messages" : "composer hidden"}
        />
      </div>

      {connected === 0 && (
        <p className="rounded-[14px] border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-[12.5px] leading-[19px] text-warning">
          No provider is connected, so Grace cannot answer yet. Add one key below; everything else in
          the product already works and will start answering the moment a key is saved.
        </p>
      )}

      {/* What is answering, and what that means for users. */}
      <section className="rounded-[20px] border border-hairline bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Answering</h2>
            <p className="mt-0.5 max-w-[52ch] text-[12.5px] leading-[18px] text-sub">
              Users never choose a model. Pin one and it answers every chat; leave it unpinned and
              the effort level decides.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenModels}
            className="h-8 shrink-0 rounded-full border border-hairline px-3 text-[12.5px] font-medium text-ink transition-colors hover:bg-control"
          >
            Manage
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Fact label="Pinned" value={settings.chatModel ? shorten(settings.chatModel) : "Effort routing"} />
          <Fact label="Allowlist" value={settings.allowedModels.length === 0 ? "Every model" : `${settings.allowedModels.length} models`} />
          <Fact label="Switched off" value={String(settings.hiddenModels.length)} />
        </div>
      </section>

      {/* The switches that matter on a bad day. */}
      <section className="rounded-[20px] border border-hairline bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Site</h2>
            <p className="mt-0.5 text-[12.5px] leading-[18px] text-sub">
              Brand, greetings, announcements and which surfaces are reachable.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSite}
            className="h-8 shrink-0 rounded-full border border-hairline px-3 text-[12.5px] font-medium text-ink transition-colors hover:bg-control"
          >
            Open
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Fact label="Name" value={settings.brandName} />
          <Fact label="Sign-ups" value={settings.signupEnabled ? "Open" : "Closed"} />
          <Fact label="Banner" value={settings.announcement ? "Showing" : "None"} />
          <Fact
            label="Surfaces"
            value={`${Object.values(settings.features).filter(Boolean).length}/${Object.keys(settings.features).length} on`}
          />
        </div>
      </section>

      {/* Storage, stated plainly. */}
      <section className="rounded-[20px] border border-hairline bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-ink">Storage</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
              data.backend === "local" && data.ephemeral
                ? "bg-warning/10 text-warning"
                : "bg-accent-soft text-accent-text"
            }`}
          >
            {data.backend === "local" ? (data.ephemeral ? "Temporary" : "Local") : "Supabase"}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-[19px] text-sub">
          {data.backend === "local"
            ? data.ephemeral
              ? "No database is connected, so accounts and chats are lost when the server restarts. Connect Supabase before inviting anyone."
              : "Accounts, chats and keys live in a file on this machine. Add a Supabase project to share them across deploys."
            : "Accounts, chats, keys and these settings live in your Supabase project, so they survive deploys."}
        </p>
      </section>

      {/* Keys. */}
      <section>
        <h2 className="mb-2 px-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
          <KeyRound size={12} /> Provider keys
        </h2>
        <div className="flex flex-col gap-2.5">
          {data.providers.map((provider) => (
            <div key={provider.id} className="rounded-[20px] border border-hairline bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                    {provider.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        provider.configured
                          ? "bg-accent-soft text-accent-text"
                          : "border border-hairline text-muted"
                      }`}
                    >
                      {provider.configured
                        ? provider.source === "env"
                          ? "Env var"
                          : "Connected"
                        : "Not connected"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-[18px] text-sub">{provider.blurb}</p>
                </div>
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent-text hover:underline"
                >
                  Create key <ExternalLink size={11} />
                </a>
              </div>

              {provider.source === "env" ? (
                <p className="mt-3 rounded-[10px] border border-hairline bg-control px-3 py-2 text-[12px] text-sub">
                  Set from the <span className="font-mono text-ink">{provider.envKey}</span> environment
                  variable. Change it in Vercel to rotate.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor={`key-${provider.id}`}>
                    {provider.label} API key
                  </label>
                  <input
                    id={`key-${provider.id}`}
                    type="password"
                    autoComplete="off"
                    value={drafts[provider.id] ?? ""}
                    onChange={(event) => onDraft(provider.id, event.target.value)}
                    placeholder={provider.configured ? "Replace the saved key" : "Paste the API key"}
                    className="h-10 min-w-0 flex-1 rounded-[8px] border border-hairline bg-control px-3 font-mono text-[13px] text-ink outline-none placeholder:font-sans placeholder:text-muted focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => onSaveKey(provider.id)}
                    disabled={busyKey === provider.id}
                    className="h-10 shrink-0 rounded-full bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    {busyKey === provider.id ? "Saving…" : "Save key"}
                  </button>
                  {provider.configured && provider.source === "console" && (
                    <button
                      type="button"
                      onClick={() => onRemoveKey(provider.id)}
                      disabled={busyKey === provider.id}
                      aria-label={`Remove ${provider.label} key`}
                      className="grid size-10 shrink-0 place-items-center rounded-full border border-hairline bg-control text-sub hover:text-ink"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[14px] border border-hairline bg-surface px-3 py-2.5">
      <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className="mt-0.5 truncate text-[17px] font-semibold leading-6 text-ink">{value}</p>
      <p className="truncate text-[10.5px] text-muted">{hint}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex min-w-0 items-baseline gap-1.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="truncate font-medium text-ink">{value}</span>
    </p>
  );
}

/** Model ids are long; the console shows the tail, which is the readable half. */
function shorten(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] ?? id;
}
