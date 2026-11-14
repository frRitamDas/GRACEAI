"use client";

import { Menu } from "lucide-react";

import { CreditsRing } from "@/components/grace/credits-ring";
import { GraceMark } from "@/components/grace/logo";

type Props = {
  remainingPct: number;
  onMenu: () => void;
  onUsage: () => void;
  agentName?: string;
};

/**
 * Header (DESIGN.md §6.1): 56px menu circle, a 72px avatar with the name pill
 * centered, and the credits ring on the right.
 *
 * On wide screens the history is already visible in the rail, so the menu
 * button gives way to the product name — a hamburger that opens a duplicate
 * list is the clearest sign of a phone layout stretched onto a desktop.
 */
export function Header({ remainingPct, onMenu, onUsage, agentName = "Grace" }: Props) {
  return (
    <header className="relative z-20 h-[88px] shrink-0 bg-black px-4 pt-4 lg:px-8">
      <div className="flex items-start justify-between">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="grid h-12 w-12 place-items-center rounded-full bg-control text-ink transition-colors duration-150 hover:bg-raised active:scale-[0.97] lg:hidden"
        >
          <Menu size={22} strokeWidth={2} aria-hidden="true" />
        </button>

        {/* Desktop: the rail already carries the wordmark, so this corner stays
            empty rather than repeating it. Keeps the header balanced. */}
        <div className="hidden h-12 lg:block" aria-hidden="true" />

        <CreditsRing percent={remainingPct} label="Credits" onClick={onUsage} />
      </div>

      <div className="pointer-events-none absolute left-1/2 top-2 flex -translate-x-1/2 flex-col items-center">
        <div
          className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border border-hairline bg-control text-[#C9C9CC]"
          aria-hidden="true"
        >
          <GraceMark className="h-[52px] w-[52px]" />
        </div>
        <span className="mt-1 rounded-full border border-hairline bg-control px-3 py-0.5 text-[17px] font-semibold leading-6 text-ink">
          {agentName}
        </span>
      </div>
    </header>
  );
}
