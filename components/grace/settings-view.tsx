"use client";

import { ArrowLeft, Check, ExternalLink, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EFFORT_LEVELS } from "@/lib/ai/catalog";
import { Toggle } from "@/components/grace/toggle";

type ProviderStatusView = {
  id: string;
  label: string;
  blurb: string;
  envKey: string;
  docsUrl: string;
  configured: boolean;
};

type Props = {
  user: {
    name: string;
    email: string;
    plan: string;
    credits: number;
    effort: number;
    isAdmin: boolean;
    unlimited: boolean;
    showCreditPercentage: boolean;
  };
  providers: ProviderStatusView[];
  models: { id: string; name: string; providerLabel: string; credits: number; tier: number; available: boolean }[];
  isAdmin: boolean;
};

export function SettingsView({ user, providers, models, isAdmin }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [effort, setEffort] = useState(user.effort);
  const [showPct, setShowPct] = useState(user.showCreditPercentage);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setSaved(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), 2200);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-16">
      <header className="flex h-[88px] items-center gap-3">
        <Link
          href="/"
          aria-label="Back to chat"
          className="grid h-14 w-14 place-items-center rounded-full bg-control text-ink transition-opacity hover:opacity-90"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-8 text-ink">Settings</h1>
          <p className="truncate text-[14px] leading-5 text-sub">{user.email}</p>
        </div>
        {saved && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-control px-3 py-1.5 text-[13px] font-bold text-accent-text">
            <Check size={14} /> Saved
          </span>
        )}
      </header>

      <Section title="Profile">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-bold text-sub">Your first name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => name.trim() && name !== user.name && void save({ name: name.trim() })}
              className="h-[52px] w-full rounded-[16px] border border-hairline bg-control px-4 text-[17px] text-ink outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-center justify-between rounded-[16px] border border-hairline bg-control px-4 py-3">
            <div>
              <p className="text-[16px] font-bold text-ink">Plan</p>
              <p className="text-[14px] text-sub">
                {user.unlimited ? "Owner: no limits, nothing charged" : `${user.credits} credits left`}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
                user.unlimited ? "border-accent bg-accent-soft text-accent-text" : "border-hairline text-ink"
              }`}
            >
              {user.unlimited ? "Owner" : user.plan}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Answers">
        <div className="space-y-3">
          <div className="rounded-[16px] border border-hairline bg-control p-3">
            <p className="px-1 pb-2 text-[14px] font-bold text-sub">Default effort</p>
            <div className="grid gap-1.5">
              {EFFORT_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  aria-pressed={effort === level.index}
                  onClick={() => {
                    setEffort(level.index);
                    void save({ effort: level.index });
                  }}
                  className={`flex h-12 w-full items-center justify-between rounded-[12px] px-3 text-[16px] transition-colors ${
                    effort === level.index ? "bg-raised text-ink" : "text-sub hover:bg-raised hover:text-ink"
                  }`}
                >
                  {/* The section is already "Default effort", so the row only
                      needs the level. The hint carries the meaning. */}
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className={`w-[74px] shrink-0 ${effort === level.index ? "text-accent" : ""}`}>
                      {level.name.split(" ")[0]}
                    </span>
                    <span className="line-clamp-1 text-[13.5px] text-muted">{level.hint}</span>
                  </span>
                  {effort === level.index && <Check size={16} className="text-accent" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[16px] border border-hairline bg-control px-4 py-3.5">
            <span className="text-[16px] font-bold text-ink">Show credit percentage</span>
            <Toggle
              checked={showPct}
              label="Show credit percentage"
              onChange={(next) => {
                setShowPct(next);
                void save({ showCreditPercentage: next });
              }}
            />
          </div>
        </div>
      </Section>

      <Section title="Providers">
        {/* Keys are deployment-wide and owner-managed. A regular account cannot
            add one, so the section states who can and what it means for them,
            rather than showing an input that would be rejected. */}
        <p className="mb-3 rounded-[14px] border border-hairline bg-control px-3.5 py-2.5 text-[13px] leading-5 text-sub">
          {isAdmin
            ? "You manage the keys everyone shares. Add, replace or remove them in the admin console."
            : "Keys are managed by the workspace owner. Everything they connect is available to you here."}
        </p>
        <div className="space-y-3">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-[16px] border border-hairline bg-control p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
                    {provider.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        provider.configured
                          ? "bg-accent-soft text-accent-text"
                          : "border border-hairline text-muted"
                      }`}
                    >
                      {provider.configured ? "Connected" : isAdmin ? "Key needed" : "Unavailable"}
                    </span>
                  </p>
                  <p className="mt-1 text-[14px] leading-5 text-sub">{provider.blurb}</p>
                  {isAdmin && (
                    <p className="mt-2 break-all font-mono text-[12px] text-muted">{provider.envKey}</p>
                  )}
                </div>
                {isAdmin && (
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-accent-text hover:underline"
                  >
                    Get key <ExternalLink size={12} />
                  </a>
                )}
              </div>
              {!provider.configured && (
                <p className="mt-2 text-[13px] leading-5 text-muted">
                  {isAdmin
                    ? "Not connected yet. Add the key in the admin console to switch this provider on."
                    : "Not available yet. The owner can switch this provider on for everyone."}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Model catalog">
        <ul className="divide-y divide-hairline rounded-[16px] border border-hairline bg-control">
          {models.map((model) => (
            <li key={model.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className={`line-clamp-2 text-[15.5px] leading-5 ${model.available ? "text-ink" : "text-muted"}`}>
                  {model.name}
                </p>
                <p className="text-[13px] text-sub">
                  {model.providerLabel} · tier {model.tier}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-bold text-sub tabular-nums">{model.credits} cr</span>
            </li>
          ))}
        </ul>
      </Section>

      {user.isAdmin && (
        <Section title="Deployment owner">
          <div className="rounded-[16px] border border-hairline bg-control p-4">
            <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
              <KeyRound size={16} className="text-accent" /> Admin console
            </p>
            <p className="mt-1 text-[14px] leading-5 text-sub">
              Add provider keys without a redeploy, and edit or remove any model in the catalog.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex h-11 items-center rounded-full bg-accent px-4 text-[15px] font-bold text-white"
            >
              Open console
            </Link>
          </div>
        </Section>
      )}

      <p className="mt-8 text-center text-[13px] text-muted">
        Grace can make mistakes. {busy ? "Saving…" : "Changes save as you go."}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-[0.01em] text-muted">{title}</h2>
      {children}
    </section>
  );
}
