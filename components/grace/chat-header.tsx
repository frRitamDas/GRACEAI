"use client";

import { PanelLeft, Plus } from "lucide-react";
import Link from "next/link";

import { CreditsRing } from "@/components/grace/credits-ring";
import { GraceMark } from "@/components/grace/logo";

type Props = {
  remainingPct: number;
  onUsage: () => void;
  onNewChat: () => void;
  /** Model label under the mark. The reference shows the agent, not a brand. */
  /** The product name shown beside the mark. Never a model name. */
  brandName?: string;
  /** Desktop: the sidebar rail is hidden below `md`. */
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
};

/**
 * The chat header.
 *
 * Three elements, exactly as in the reference: the history button, the agent
 * mark with its model chip, and the credits ring. Nothing else — every other
 * action lives in the sidebar or the composer, which is what keeps the top of
 * a long conversation quiet.
 *
 * On desktop the mark sits inline in the top-left of the column rather than
 * centered over it: a centered column header would drift as the sidebar
 * collapses, and the reference's centering is a phone convention.
 */
export function ChatHeader({
  remainingPct,
  onUsage,
  onNewChat,
  brandName = "GRACE AI",
  onToggleSidebar,
  sidebarCollapsed,
}: Props) {
  return (
    <header className="relative z-20 flex h-[64px] shrink-0 items-center gap-2 px-3 sm:px-5">
      {/* Phone: the reference centers the mark and its chip between the menu
          button and the credits ring. Desktop: the column is left-aligned, so
          the mark sits beside the history button instead of drifting with the
          viewport. */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Open sidebar" : "Hide sidebar"}
        className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-control text-ink hover:bg-white/[0.08] md:hidden"
      >
        <PanelLeft size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-center gap-2 md:pointer-events-auto md:flex-none">
        <span className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-control">
          <GraceMark className="h-[21px] w-[21px] text-[#dcdcdf]" />
        </span>
        <span className="pointer-events-auto max-w-[34vw] truncate rounded-full bg-control px-3 py-1 text-[12.5px] font-semibold text-ink">
          {brandName}
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          title="New chat"
          className="press grid h-10 w-10 place-items-center rounded-full bg-control text-ink hover:bg-white/[0.08] sm:hidden"
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <CreditsRing percent={remainingPct} label="Credits remaining" onClick={onUsage} size={40} />
      </div>
    </header>
  );
}

/** Compact header used on documents (projects, memory, apex…). */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-hairline px-4 sm:px-7">
      {back && (
        <Link
          href={back.href}
          className="press -ml-1 flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] text-sub hover:bg-white/[0.06] hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold text-ink">{title}</h1>
        {subtitle && <p className="truncate text-[11.5px] text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
