"use client";

import { Check, Gem, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Toggle } from "@/components/grace/toggle";
import type { UsageData } from "@/components/grace/usage-modal";

type Props = {
  usage: UsageData;
  showPercentage: boolean;
  plan: string;
  /** True when the account is Apex (or the owner, who has everything). */
  apex: boolean;
  credits: number;
};

/**
 * Usage & limits, full page.
 *
 * The same numbers as the modal, with room to explain them: what the allowance
 * is, what is left, what resets and when, and the credit packs. The modal still
 * exists for a quick look from the header; this is the page the sidebar links.
 */
export function UsageView({ usage, showPercentage, plan, apex, credits }: Props) {
  const [percentage, setPercentage] = useState(showPercentage);
  const [busy, setBusy] = useState<"credits" | "apex" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: boolean) => {
    setPercentage(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showCreditPercentage: next }),
    }).catch(() => undefined);
  };

  const buy = async (kind: "credits" | "apex") => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Checkout did not open.");
    } catch {
      setError("Checkout did not open.");
    } finally {
      setBusy(null);
    }
  };

  const unlimited = usage.unlimited || plan.startsWith("apex");
  const usedPct = usage.usedPct;

  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-ink">Usage &amp; limits</h1>
            <p className="mt-1 text-[13px] leading-5 text-sub">
              Everything that counts against the month, and what happens when it runs out.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-control px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.03em] text-ink">
            {unlimited ? "APEX" : plan === "free" ? "Free" : plan}
          </span>
        </div>

        <section className="mt-5 rounded-[20px] bg-control px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] leading-6 text-sub">This month</span>
            <span className="text-[15px] font-bold leading-6 text-ink tabular-nums">
              {percentage ? `${usedPct}% used` : `${usedPct}%`}
            </span>
          </div>
          <div
            className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#2c2c2f]"
            role="progressbar"
            aria-valuenow={usedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Monthly allowance used"
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[12.5px] text-sub">
            <span>{usage.resets}</span>
            <span className="tabular-nums text-muted">
              {unlimited ? "Unlimited" : `${credits.toLocaleString()} credits left`}
            </span>
          </div>
        </section>

        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[20px] bg-control px-5 py-4">
          <div>
            <p className="text-[14.5px] font-medium text-ink">Show credit percentage</p>
            <p className="mt-0.5 text-[12px] text-muted">
              The ring in the header shows what is left, either way.
            </p>
          </div>
          <Toggle checked={percentage} onChange={(next) => void save(next)} label="Show credit percentage" />
        </div>

        <section className="mt-6">
          <h2 className="text-[13px] font-semibold text-ink">Credit packs</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-sub">
            Credits never expire and are only used when the monthly allowance runs out.
          </p>
          <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { credits: "500", price: "$5" },
              { credits: "2,000", price: "$18" },
              { credits: "5,000", price: "$40" },
            ].map((pack) => (
              <li key={pack.credits} className="rounded-[16px] border border-hairline bg-control p-3.5">
                <p className="text-[19px] font-bold leading-6 text-ink tabular-nums">{pack.credits}</p>
                <p className="text-[11.5px] text-muted">credits</p>
                <p className="mt-2 text-[13px] font-medium text-sub">{pack.price}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void buy("apex")}
            disabled={busy !== null}
            className="press flex h-[52px] items-center justify-center gap-2 rounded-full border border-accent/60 bg-accent-soft text-[14px] font-bold text-accent-text hover:bg-accent/[0.18] disabled:opacity-60"
          >
            <Gem size={16} aria-hidden="true" />
            {busy === "apex" ? "Opening…" : "Buy Apex"}
          </button>
          <button
            type="button"
            onClick={() => void buy("credits")}
            disabled={busy !== null}
            className="press h-[52px] rounded-full bg-accent text-[14px] font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            {busy === "credits" ? "Opening…" : "Buy credits"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-[12px] border border-hairline bg-control px-3.5 py-2.5 text-[12.5px] leading-5 text-sub">
            {error}
          </p>
        )}

        <section className="mt-7 rounded-[20px] border border-hairline p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent" aria-hidden="true" />
            <h2 className="text-[13.5px] font-semibold text-ink">
              {apex ? "You are on Apex" : "Apex is the membership"}
            </h2>
          </div>
          <ul className="mt-3 space-y-2">
            {[
              "Grace in chat and Grace Forge",
              "20% bonus on credit packs",
              "4 GB uploads and 20 GB storage",
              "Animated and expanded reactions",
              "Custom profiles, banners and the Apex badge",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12.5px] leading-5 text-sub">
                <Check size={13} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href="/apex"
            className="press mt-4 inline-flex h-9 items-center rounded-full bg-white/[0.08] px-4 text-[12.5px] font-semibold text-ink hover:bg-white/[0.12]"
          >
            {apex ? "See your Apex benefits" : "See what Apex includes"}
          </Link>
        </section>
      </div>
    </div>
  );
}
