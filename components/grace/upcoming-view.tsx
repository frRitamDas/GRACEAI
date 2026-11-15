"use client";

import { BellOff, Check, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import type { UpcomingItem } from "@/lib/upcoming";

/**
 * Upcoming.
 *
 * A short list, not a roadmap deck. Two states per item — active, or cleared —
 * and clearing is persisted per account, so the page is the same on the next
 * device and a cleared item does not silently disappear.
 */
export function UpcomingView({
  items,
  dismissed: initialDismissed,
}: {
  items: UpcomingItem[];
  dismissed: string[];
}) {
  const [dismissed, setDismissed] = useState<string[]>(initialDismissed);
  const [showCleared, setShowCleared] = useState(false);

  const toggle = async (id: string) => {
    const cleared = dismissed.includes(id);
    const next = cleared ? dismissed.filter((d) => d !== id) : [...dismissed, id];
    setDismissed(next);
    if (!cleared) {
      await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => undefined);
    }
  };

  const visible = items.filter((item) => (showCleared ? true : !dismissed.includes(item.id)));
  const clearedCount = items.filter((item) => dismissed.includes(item.id)).length;

  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-8 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-ink">Upcoming</h1>
            <p className="mt-1 max-w-[56ch] text-[13px] leading-5 text-sub">
              What is being built, in the order it is likely to land. Nothing here is counted as
              available until it ships.
            </p>
          </div>
          {clearedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCleared((v) => !v)}
              className="press flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3 text-[11.5px] font-medium text-sub hover:text-ink"
            >
              {showCleared ? <BellOff size={12} /> : <RotateCcw size={12} />}
              {showCleared ? "Hide cleared" : `Show cleared (${clearedCount})`}
            </button>
          )}
        </div>

        <ul className="mt-5 space-y-2">
          {visible.map((item) => {
            const cleared = dismissed.includes(item.id);
            const shipped = item.tag === "Shipped";
            return (
              <li
                key={item.id}
                className={`rounded-[16px] border border-hairline bg-control px-4 py-3.5 transition-opacity sm:px-5 ${
                  cleared ? "opacity-45" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${
                      shipped ? "bg-accent-soft text-accent-text" : "bg-white/[0.06] text-sub"
                    }`}
                  >
                    {shipped ? <Check size={15} strokeWidth={2.6} /> : <Sparkles size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                          shipped ? "bg-accent-soft text-accent-text" : "bg-white/[0.06] text-sub"
                        }`}
                      >
                        {item.tag}
                      </span>
                      {item.when !== item.tag && (
                        <span className="text-[11px] text-muted">{item.when}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-5 text-sub">{item.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggle(item.id)}
                    className="press ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-muted hover:bg-white/[0.07] hover:text-ink"
                    aria-label={cleared ? `Restore ${item.title}` : `Clear ${item.title}`}
                  >
                    {cleared ? <RotateCcw size={12} /> : <BellOff size={13} />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {visible.length === 0 && (
          <p className="mt-12 text-center text-[13px] text-sub">
            Everything is cleared. New notices will show up here.
          </p>
        )}
      </div>
    </div>
  );
}
