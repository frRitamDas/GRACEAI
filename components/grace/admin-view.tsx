"use client";

import { ArrowLeft, Check, ExternalLink, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { KeyModelsDialog } from "@/components/grace/key-models-dialog";
import { ModelManager } from "@/components/grace/model-manager";
import type { ProviderId } from "@/lib/ai/catalog";

type AdminData = {
  providers: {
    id: string;
    label: string;
    blurb: string;
    envKey: string;
    docsUrl: string;
    configured: boolean;
    source: "env" | "console" | "none";
  }[];
  models: { id: string; name: string; providerLabel: string; tier: number; credits: number; available: boolean }[];
  backend: string;
  ephemeral: boolean;
};

/**
 * Owner-only console: connect OpenRouter, Groq and Google AI Studio, and see
 * which catalog entries each key unlocks. Keys are write-only from the browser:
 * the server stores them and reports only whether one exists.
 */
export function AdminView() {
  const [data, setData] = useState<AdminData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [keyDialog, setKeyDialog] = useState<ProviderId | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (!response.ok) return;
    setData((await response.json()) as AdminData);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const response = await fetch("/api/admin", { cache: "no-store" });
      if (!response.ok || !alive) return;
      setData((await response.json()) as AdminData);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async (provider: string) => {
    const apiKey = (drafts[provider] ?? "").trim();
    if (apiKey.length < 12) {
      setMessage({ text: "That key looks too short.", ok: false });
      return;
    }
    setBusy(provider);
    try {
      const response = await fetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ text: result.error ?? "That key was not saved.", ok: false });
        return;
      }
      setDrafts((prev) => ({ ...prev, [provider]: "" }));
      setMessage({ text: "Key saved. Models are live now.", ok: true });
      await load();
      // The natural moment to decide what this key may serve.
      setKeyDialog(provider as ProviderId);
    } finally {
      setBusy(null);
      window.setTimeout(() => setMessage(null), 3500);
    }
  };

  const remove = async (provider: string) => {
    setBusy(provider);
    try {
      await fetch("/api/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      setMessage({ text: "Key removed.", ok: true });
      await load();
    } finally {
      setBusy(null);
      window.setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-16">
      <header className="flex h-[88px] items-center gap-3">
        <Link
          href="/"
          aria-label="Back to chat"
          className="grid h-14 w-14 place-items-center rounded-full bg-control text-ink"
        >
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-[24px] font-bold leading-8 text-ink">
            <ShieldCheck size={20} className="text-accent" /> Admin console
          </h1>
          <p className="text-[14px] leading-5 text-sub">
            Provider keys, the model catalog and storage. Owner only.
          </p>
        </div>
      </header>

      {message && (
        <p
          role="status"
          className={`mb-4 flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5 text-[14px] ${
            message.ok
              ? "border-accent/40 bg-accent-soft text-accent-text"
              : "border-hairline bg-control text-ink"
          }`}
        >
          {message.ok && <Check size={14} />} {message.text}
        </p>
      )}

      {!data ? (
        <p className="flex items-center gap-2 text-[15px] text-sub">
          <Loader2 size={16} className="animate-spin" /> Loading console data
        </p>
      ) : (
        <>
          <section className="rounded-[20px] border border-hairline bg-surface p-4">
            <p className="text-[13px] font-semibold tracking-[0.01em] text-muted">Storage</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[16px] leading-6 text-ink">
              {data.backend === "local" ? "This machine only" : "Supabase"}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  data.backend === "local" && data.ephemeral
                    ? "bg-[#3A2A16] text-[#E0B341]"
                    : "bg-accent-soft text-accent-text"
                }`}
              >
                {data.backend === "local" ? (data.ephemeral ? "Temporary" : "Local") : "Synced"}
              </span>
            </p>
            <p className="mt-1 break-all font-mono text-[11.5px] leading-4 text-muted">
              {data.backend === "local"
                ? ".data/grace-local.json"
                : "Service-role connection, server side only"}
            </p>
            <p className="mt-1 text-[14px] leading-5 text-sub">
              {data.backend === "local"
                ? data.ephemeral
                  ? "No database is connected, so accounts and chats are lost when the server restarts. Connect Supabase before inviting anyone."
                  : "Accounts, chats and keys live in a file on this machine. Add a Supabase project to share them across deploys."
                : "Accounts, chats and keys are stored in your Supabase project, so they survive deploys."}
            </p>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-[0.01em] text-muted">
              Provider keys
            </h2>
            <div className="space-y-3">
              {data.providers.map((provider) => (
                <div key={provider.id} className="rounded-[20px] border border-hairline bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 text-[17px] font-bold text-ink">
                        {provider.label}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
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
                      <p className="mt-1 text-[14px] leading-5 text-sub">{provider.blurb}</p>
                    </div>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] font-bold text-accent-text hover:underline"
                    >
                      Create key <ExternalLink size={12} />
                    </a>
                  </div>

                  {provider.source === "env" ? (
                    <p className="mt-3 rounded-[12px] border border-hairline bg-control px-3 py-2 text-[13px] text-sub">
                      Set from the <span className="font-mono text-ink">{provider.envKey}</span>{" "}
                      environment variable. Change it in Vercel to rotate.
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
                        onChange={(event) =>
                          setDrafts((prev) => ({ ...prev, [provider.id]: event.target.value }))
                        }
                        placeholder={provider.configured ? "Replace the saved key" : "Paste the API key"}
                        className="h-[48px] min-w-0 flex-1 rounded-full border border-hairline bg-control px-4 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => void save(provider.id)}
                        disabled={busy === provider.id}
                        className="h-[48px] shrink-0 rounded-full bg-accent px-5 text-[15px] font-bold text-white disabled:opacity-60"
                      >
                        {busy === provider.id ? "Saving…" : "Save key"}
                      </button>
                      {provider.configured && (
                        <button
                          type="button"
                          onClick={() => void remove(provider.id)}
                          disabled={busy === provider.id}
                          aria-label={`Remove ${provider.label} key`}
                          className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full border border-hairline bg-control text-sub hover:text-ink"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6">
            <ModelManager
              onMessage={(text, ok) => {
                setMessage({ text, ok });
                window.setTimeout(() => setMessage(null), 4000);
              }}
            />
          </div>
        </>
      )}
      <KeyModelsDialog
        open={keyDialog !== null}
        provider={keyDialog}
        onClose={() => setKeyDialog(null)}
        onSaved={(count) =>
          setMessage({
            text: `This key now serves ${count} model${count === 1 ? "" : "s"}.`,
            ok: true,
          })
        }
      />
    </div>
  );
}
