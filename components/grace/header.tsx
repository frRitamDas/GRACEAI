"use client";

import { ChevronDown, Menu, PanelLeft, Sparkles } from "lucide-react";

import { CreditsRing } from "@/components/grace/credits-ring";
import { GithubMark } from "@/components/grace/github-mark";
import { GraceMark } from "@/components/grace/logo";

type Props = {
  remainingPct: number;
  onMenu: () => void;
  onUsage: () => void;
  /** Current model, shown where a doc title would be. */
  subtitle?: string;
  /** Renders a rail button on desktop when the rail is collapsible. */
  onToggleRail?: () => void;
  railCollapsed?: boolean;
  /** Workspace status: whether code mode is on, and where it points. */
  workspace?: {
    enabled: boolean;
    repo: string | null;
    files: number;
    /** Turns code mode on or off — the read/write switch for this chat. */
    onToggle: () => void;
    /** Opens the workspace drawer (repo, files, push). */
    onOpen: () => void;
  };
};

/**
 * The top bar.
 *
 * It is a toolbar, not a title card: identity on the left, the current model
 * beside it, and the two things that change a turn — workspace and credits — on
 * the right. 52px, blurred, and content scrolls underneath it rather than
 * through it.
 */
export function Header({
  remainingPct,
  onMenu,
  onUsage,
  subtitle,
  onToggleRail,
  railCollapsed,
  workspace,
}: Props) {
  return (
    <header className="glass relative z-30 flex h-[52px] shrink-0 items-center gap-1 border-b border-white/[0.06] px-2 sm:gap-2 sm:px-3">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="press grid h-9 w-9 place-items-center rounded-[10px] text-sub hover:bg-white/[0.06] hover:text-ink lg:hidden"
      >
        <Menu size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      {onToggleRail && (
        <button
          type="button"
          onClick={onToggleRail}
          aria-label={railCollapsed ? "Show history" : "Hide history"}
          aria-pressed={!railCollapsed}
          className="press hidden h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-white/[0.06] hover:text-ink lg:grid"
        >
          <PanelLeft size={17} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      <div className="flex min-w-0 items-center gap-2 pl-0.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border border-white/[0.08] bg-white/[0.04]">
          <GraceMark className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[13.5px] font-semibold tracking-[-0.012em] text-ink">
            Grace
          </span>
          {subtitle && (
            <span className="mt-[3px] block truncate text-[10.5px] leading-none text-muted">
              {subtitle}
            </span>
          )}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {workspace && (
          // Two jobs, two targets: the pill turns code mode on and off, the
          // chevron beside it opens the workspace. A single control that does
          // both makes the drawer impossible to find.
          <span
            className={`flex h-8 items-center rounded-full border ${
              workspace.enabled
                ? "border-accent/40 bg-accent-soft text-accent-text"
                : "border-white/[0.08] text-sub"
            }`}
          >
          <button
            type="button"
            onClick={workspace.onToggle}
            aria-pressed={workspace.enabled}
            title={
              workspace.enabled
                ? "Code mode is on: Grace reads and writes this chat's files"
                : "Turn on code mode to let Grace read and write files"
            }
            className={`press flex h-full items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium sm:px-2.5 ${
              workspace.enabled ? "" : "hover:text-ink"
            }`}
          >
            {workspace.enabled ? (
              <CodeGlyph />
            ) : (
              <Sparkles size={12} strokeWidth={2.2} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {workspace.enabled ? "Code on" : "Code off"}
            </span>
            {workspace.enabled && workspace.repo && (
              <span className="hidden max-w-[120px] truncate font-mono text-[10.5px] text-accent-text/70 md:inline">
                {workspace.repo}
              </span>
            )}
            {workspace.enabled && !workspace.repo && workspace.files > 0 && (
              <span className="hidden text-[10.5px] text-accent-text/70 sm:inline">
                {workspace.files} {workspace.files === 1 ? "file" : "files"}
              </span>
            )}
          </button>
          <span className="h-4 w-px bg-current opacity-15" aria-hidden="true" />
          <button
            type="button"
            onClick={workspace.onOpen}
            aria-label="Open workspace"
            title="Open workspace"
            className="press grid h-full w-7 place-items-center rounded-full hover:bg-white/[0.08]"
          >
            <ChevronDown size={11} aria-hidden="true" />
          </button>
          </span>
        )}

        {workspace?.enabled && workspace.repo && (
          <span className="hidden items-center text-muted sm:flex" aria-hidden="true">
            <GithubMark size={13} />
          </span>
        )}

        <CreditsRing percent={remainingPct} label="Credits" onClick={onUsage} size={32} />
      </div>
    </header>
  );
}

function CodeGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m8 6-5 6 5 6M16 6l5 6-5 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
