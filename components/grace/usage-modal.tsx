"use client";

import { useState } from "react";

import { Overlay } from "@/components/grace/sheet";
import { Toggle } from "@/components/grace/toggle";

export type UsageData = {
  used: number;
  credits: number;
  /** null for owner accounts, who have no allowance to count against. */
  allowance: number | null;
  unlimited?: boolean;
  usedPct: number;
  remainingPct: number;
  resets: string;
  plan: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  usage: UsageData | null;
  showPercentage: boolean;
  onTogglePercentage: (next: boolean) => void;
  onBuyCredits: () => void;
  onBuyApex: () => void;
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  apex: "Apex",
  "apex-pro": "Apex Pro",
};

/**
 * Usage & Limits modal (DESIGN.md §6.6). Dark card on a dimmed backdrop,
 * 28px radius, a usage card, the percentage toggle, two actions and a
 * separated Done row.
 */
export function UsageModal({
  open,
  onClose,
  usage,
  showPercentage,
  onTogglePercentage,
  onBuyCredits,
  onBuyApex,
}: Props) {
  const [buying, setBuying] = useState<"credits" | "apex" | null>(null);

  const usedPct = usage?.usedPct ?? 0;
  const remaining = usage?.credits ?? 0;
  const plan = usage?.plan ?? "free";
  const unlimited = Boolean(usage?.unlimited);

  return (
    <Overlay open={open} onClose={onClose} variant="center" labelledBy="usage-title" className="w-full max-w-[420px] animate-modal-in">
      <div className="glass-strong overflow-hidden rounded-[28px]">
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="usage-title" className="text-[19px] font-semibold leading-7 tracking-[-0.015em] text-ink">
              Usage &amp; limits
            </h2>
            <span
              className={
                unlimited
                  ? "rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-text"
                  : "rounded-full bg-control px-2.5 py-1 text-[11px] font-semibold text-sub"
              }
            >
              {unlimited ? "Owner" : (PLAN_LABEL[plan] ?? plan)}
            </span>
          </div>

          <div className="rounded-[14px] border border-hairline bg-surface px-3.5 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] leading-5 text-sub">This month</span>
              <span className="text-[13px] font-semibold leading-5 text-ink tabular-nums">
                {unlimited
                  ? "No limits"
                  : showPercentage
                    ? `${usedPct}% used`
                    : `${remaining} credits left`}
              </span>
            </div>
            <div
              className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-hairline"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={unlimited ? 0 : usedPct}
              aria-label="Credits used this month"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(usedPct, usedPct > 0 ? 3 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] leading-[18px] text-muted">
              {unlimited
                ? `Owner account: every model, every effort, no credit checks. ${usage ? `${usage.used} credits used this month for reference.` : ""}`
                : `${usage ? `${remaining} of ${usage.allowance} credits left.` : "Loading your allowance…"} Resets ${usage?.resets ?? "next month"}.`}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 rounded-[14px] border border-hairline bg-surface px-3.5 py-3">
            <span className="text-[13px] font-medium leading-5 text-ink">Show credit percentage</span>
            <Toggle checked={showPercentage} onChange={onTogglePercentage} label="Show credit percentage" />
          </div>

          {/* An owner can never be charged, so purchase buttons would be a dead end. */}
          {!unlimited && (
            <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setBuying("apex");
                onBuyApex();
                setBuying(null);
              }}
              className="press h-10 rounded-[10px] border border-accent/40 bg-accent-soft text-[13px] font-semibold text-accent-text transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
              aria-busy={buying === "apex"}
            >
              Buy Apex
            </button>
            <button
              type="button"
              onClick={() => {
                setBuying("credits");
                onBuyCredits();
                setBuying(null);
              }}
              className="press h-10 rounded-[10px] bg-accent text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
              aria-busy={buying === "credits"}
            >
              Buy credits
            </button>
            </div>
          )}
        </div>

        <div className="border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="press h-11 w-full text-[13px] font-semibold text-sub transition-colors hover:bg-white/[0.03] hover:text-ink"
          >
            Done
          </button>
        </div>
      </div>
    </Overlay>
  );
}
