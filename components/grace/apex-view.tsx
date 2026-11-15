"use client";

import { Check, Gem, Users } from "lucide-react";
import { useState } from "react";

import { GraceMark } from "@/components/grace/logo";
import { APEX, APEX_BENEFITS, dockFill } from "@/lib/apex";

/**
 * Apex.
 *
 * Two things on one page: what the membership is, and what it includes. The
 * capacity bar and the member count are the same numbers the rail badge uses,
 * so the promise and the product agree. Buying is the real checkout route; when
 * it is not configured the button says so rather than pretending.
 */
export function ApexView({ member }: { member: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fill = dockFill();

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "apex" }),
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
      setBusy(false);
    }
  };

  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-16 pt-8 sm:px-7">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative overflow-hidden rounded-[24px] border border-hairline bg-control px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-white/[0.07]">
              <Gem size={19} className="text-[#cfd6e6]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Grace</p>
              <p className="text-[15px] font-semibold text-ink">Apex</p>
            </div>
          </div>

          <h1 className="mt-5 max-w-[22ch] text-[28px] font-bold leading-[34px] tracking-[-0.025em] text-ink sm:text-[34px] sm:leading-[40px]">
            The membership for people who work here every day.
          </h1>
          <p className="mt-2.5 max-w-[52ch] text-[13.5px] leading-6 text-sub">
            Apex raises the monthly allowance, opens the full model ladder in chat and Grace Forge, and
            keeps your projects in cloud storage between sessions. {APEX.trialDays} days free, cancel
            before the trial ends and nothing is charged.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void join()}
              disabled={busy || member}
              className="press flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-bold text-black hover:opacity-90 disabled:opacity-45"
            >
              <Gem size={15} aria-hidden="true" />
              {member ? "You are a member" : busy ? "Opening…" : `Join Apex · ${APEX.price}`}
            </button>
            <span className="text-[12px] text-sub">
              {APEX.trialDays}-day trial · {APEX.price}
            </span>
          </div>

          {error && (
            <p role="alert" className="mt-3 max-w-[46ch] rounded-[12px] bg-black/40 px-3.5 py-2.5 text-[12px] leading-5 text-sub">
              {error}
            </p>
          )}

          {/* -------------------------------------------------------- capacity */}
          <div className="mt-6 rounded-[16px] border border-hairline bg-black/30 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-sub">
                <Users size={13} aria-hidden="true" />
                {APEX.members.toLocaleString()} of {APEX.memberCap.toLocaleString()} Apex seats taken
              </span>
              <span className="text-[11.5px] tabular-nums text-muted">{Math.round(fill * 100)}%</span>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#26262a]"
              role="progressbar"
              aria-label="Apex seats filled"
              aria-valuemin={0}
              aria-valuemax={APEX.memberCap}
              aria-valuenow={APEX.members}
            >
              <div className="h-full rounded-full bg-white/[0.82]" style={{ width: `${fill * 100}%` }} />
            </div>
            <p className="mt-2 text-[11.5px] leading-5 text-muted">
              The dock closes at {APEX.memberCap.toLocaleString()} members. Seats are kept by renewal.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------ details */}
        <section className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Monthly capacity", value: `${(APEX.capacityCredits / 1000).toLocaleString()}k credits` },
            { label: "Bonus on packs", value: `+${APEX.bonusPct}%` },
            { label: "Storage", value: `${APEX.storageGb} GB` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[16px] border border-hairline bg-control px-4 py-3.5">
              <p className="text-[17px] font-bold leading-6 text-ink">{stat.value}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">What Apex includes</h2>
          <ul className="mt-2.5 divide-y divide-hairline overflow-hidden rounded-[20px] border border-hairline">
            {APEX_BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-3 bg-control px-4 py-3.5 sm:px-5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.07]">
                  <Check size={11} strokeWidth={3} className="text-[#cfd6e6]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-[13.5px] font-medium text-ink">{benefit.title}</p>
                    {benefit.tag && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-medium text-sub">
                        {benefit.tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-5 text-sub">{benefit.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-3 flex items-start gap-3 rounded-[20px] border border-hairline p-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-control">
            <GraceMark className="h-[18px] w-[18px] text-[#d7d7da]" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Billed monthly, cancelled anytime</p>
            <p className="mt-1 max-w-[54ch] text-[12px] leading-5 text-sub">
              Apex renews on the same day each month. Cancelling keeps your files and projects; the
              allowance drops back to Free at the end of the period.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
