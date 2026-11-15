"use client";

import { useState } from "react";

import { Overlay } from "@/components/grace/sheet";
import { Toggle } from "@/components/grace/toggle";

export type UsageData = {
  used: number;
  credits: number;
  /** Infinity for owner accounts, who have no allowance to count against. */
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
  onBuyCredits: () => Promise<void> | void;
  onBuyApex: () => Promise<void> | void;
  apexEnabled?: boolean;
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  apex: "Apex",
  "apex-pro": "Apex Pro",
};

/**
 * Usage & Limits (DESIGN.md §6.6).
 *
 * The reference card, measured: 28px radius on a #1D1D1F surface, the title
 * left and an APEX pill right, one usage card, one toggle card, two equal
 * buttons, and a Done row separated by a hairline. On a phone it is a bottom
 * sheet; on desktop it stays the same compact card, centered.
 */
export function UsageModal({
  open,
  onClose,
  usage,
  showPercentage,
  onTogglePercentage,
  onBuyCredits,
  onBuyApex,
  apexEnabled = true,
}: Props) {
  const [busy, setBusy] = useState<"credits" | "apex" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usedPct = usage?.usedPct ?? 0;
  const plan = usage?.plan ?? "free";
  const unlimited = Boolean(usage?.unlimited) || plan.startsWith("apex");

  const run = async (kind: "credits" | "apex") => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === "credits" ? onBuyCredits() : onBuyApex());
    } catch (problem) {
      // Callers throw with the server's plain reason; show it instead of a
      // dead button. A thrown string is the common shape here.
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="center"
      labelledBy="usage-title"
      className="w-full max-w-[calc(100vw-24px)] animate-modal-in sm:max-w-[440px]"
    >
      <div className="float-modal overflow-hidden rounded-[28px]">
        <div className="px-4 pb-4 pt-5 sm:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="usage-title" className="text-[24px] font-bold leading-8 tracking-[-0.02em] text-ink sm:text-[26px]">
              Usage &amp; Limits
            </h2>
            <span className="shrink-0 rounded-full bg-control px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.03em] text-ink">
              {unlimited ? "APEX" : (PLAN_LABEL[plan] ?? plan)}
            </span>
          </div>

          <div className="rounded-[20px] bg-control px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] leading-6 text-sub">This month</span>
              <span className="text-[15px] font-bold leading-6 text-ink tabular-nums">
                {showPercentage ? `${usedPct}% used` : `${Math.round(usedPct)}%`}
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#2c2c2f]"
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
            <p className="mt-2 text-[13px] leading-5 text-sub">{usage?.resets ?? "Resets next month"}</p>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[20px] bg-control px-4 py-3.5">
            <span className="text-[15px] font-medium leading-6 text-ink">Show credit percentage</span>
            <Toggle
              checked={showPercentage}
              onChange={onTogglePercentage}
              label="Show credit percentage"
            />
          </div>

          <div className={`mt-3 grid gap-3 ${apexEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
            {apexEnabled && (
              <button
                type="button"
                onClick={() => void run("apex")}
                disabled={busy !== null}
                className="press h-[52px] rounded-full border border-accent/60 bg-accent-soft text-[15px] font-bold text-accent-text hover:bg-accent/[0.18] disabled:opacity-60"
              >
                {busy === "apex" ? "Opening…" : "Buy Apex"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void run("credits")}
              disabled={busy !== null}
              className="press h-[52px] rounded-full bg-accent text-[15px] font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {busy === "credits" ? "Opening…" : "Buy credits"}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-2.5 text-center text-[12.5px] leading-5 text-sub">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="press h-[52px] w-full border-t border-hairline text-[16px] font-bold text-sub hover:bg-white/[0.03] hover:text-ink"
        >
          Done
        </button>
      </div>
    </Overlay>
  );
}
