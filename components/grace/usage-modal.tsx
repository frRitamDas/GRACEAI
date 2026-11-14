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
      <div className="overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
        <div className="p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="usage-title" className="text-[26px] font-bold leading-8 tracking-[-0.01em] text-ink">
              Usage &amp; Limits
            </h2>
            <span
              className={
                unlimited
                  ? "rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-accent-text"
                  : "rounded-full bg-control px-3 py-1.5 text-[12px] font-semibold text-ink"
              }
            >
              {unlimited ? "Owner" : (PLAN_LABEL[plan] ?? plan)}
            </span>
          </div>

          <div className="rounded-[20px] border border-hairline bg-control px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[18px] leading-6 text-sub">This month</span>
              <span className="text-[18px] font-bold leading-6 text-ink tabular-nums">
                {unlimited
                  ? "No limits"
                  : showPercentage
                    ? `${usedPct}% used`
                    : `${remaining} credits left`}
              </span>
            </div>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full bg-hairline"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={unlimited ? 0 : usedPct}
              aria-label="Credits used this month"
            >
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(usedPct, usedPct > 0 ? 3 : 0)}%` }}
              />
            </div>
            <p className="mt-2.5 text-[14px] leading-5 text-sub">
              {unlimited
                ? `Owner account: every model, every effort, no credit checks. ${usage ? `${usage.used} credits used this month for reference.` : ""}`
                : `${usage ? `${remaining} of ${usage.allowance} credits left.` : "Loading your allowance…"} Resets ${usage?.resets ?? "next month"}.`}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-[20px] border border-hairline bg-control px-4 py-3.5">
            <span className="text-[18px] font-bold leading-6 text-ink">Show credit percentage</span>
            <Toggle checked={showPercentage} onChange={onTogglePercentage} label="Show credit percentage" />
          </div>

          {/* An owner can never be charged, so purchase buttons would be a dead end. */}
          {!unlimited && (
            <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setBuying("apex");
                onBuyApex();
                setBuying(null);
              }}
              className="h-[52px] rounded-full border border-accent bg-accent-soft text-[18px] font-bold text-accent-text transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
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
              className="h-[52px] rounded-full bg-accent text-[18px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
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
            className="h-[56px] w-full text-[18px] font-bold text-sub transition-colors hover:text-ink"
          >
            Done
          </button>
        </div>
      </div>
    </Overlay>
  );
}
