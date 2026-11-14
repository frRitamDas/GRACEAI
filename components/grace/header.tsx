"use client";

import { Menu } from "lucide-react";

import { CreditsRing } from "@/components/grace/credits-ring";
import { GraceMark } from "@/components/grace/logo";

type Props = {
  remainingPct: number;
  onMenu: () => void;
  onUsage: () => void;
  agentName?: string;
  /** Shown beside the wordmark on wide screens, e.g. the current model. */
  subtitle?: string;
};

/**
 * A slim glass bar, not a floating avatar.
 *
 * The previous version was an 88px header with a 72px avatar and a name pill
 * hanging below it. On a phone that stack sat directly on top of the first
 * messages, and the word "Grace" was the thing covering the conversation.
 *
 * This bar is 56px, pinned, and opaque-blurred so content scrolls *under* it
 * rather than through it. The avatar lives in the rail and the drawer, where
 * identity belongs; here it only needs to say where you are.
 */
export function Header({
  remainingPct,
  onMenu,
  onUsage,
  agentName = "Grace",
  subtitle,
}: Props) {
  return (
    <header className="glass-bar relative z-20 flex h-[56px] shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 lg:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-full text-sub transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:scale-[0.96] lg:hidden"
      >
        <Menu size={19} strokeWidth={2} aria-hidden="true" />
      </button>

      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
          <GraceMark className="h-[22px] w-[22px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold leading-[18px] tracking-[-0.012em] text-ink">
            {agentName}
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] leading-[14px] text-muted">{subtitle}</span>
          )}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <CreditsRing percent={remainingPct} label="Credits" onClick={onUsage} size={34} />
      </div>
    </header>
  );
}
