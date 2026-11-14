"use client";

import { Code2, LogOut, MessageSquarePlus, Search, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { GraceMark } from "@/components/grace/logo";
import type { ConversationSummary } from "@/components/grace/drawer";

type Props = {
  user: { name: string; plan: string; isAdmin: boolean; unlimited: boolean } | null;
  conversations: ConversationSummary[];
  activeId: string | null;
  collapsed?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
};

/**
 * Desktop history rail.
 *
 * Sections are grouped by age rather than one long list — a hundred chats in
 * date order is a haystack. It collapses to zero width (the header owns the
 * toggle) so the conversation can use the whole window, which is what you want
 * while reading a long answer.
 */
export function SideRail({
  user,
  conversations,
  activeId,
  collapsed = false,
  onSelect,
  onNew,
  onDelete,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? conversations.filter((c) => c.title.toLowerCase().includes(needle))
      : conversations;

    // Sorted newest-first by the server, and bucketed by a recentness key that
    // does not need the wall clock: the most recent day, the week before it,
    // then everything else. Labels stay honest without a re-render at midnight.
    const dayKeys = Array.from(
      new Set(filtered.map((c) => new Date(c.updatedAt).toDateString()))
    );
    const recent = new Set(dayKeys.slice(0, 1));
    const week = new Set(dayKeys.slice(0, 7));

    const buckets: { label: string; items: ConversationSummary[] }[] = [
      { label: "Today", items: [] },
      { label: "Earlier this week", items: [] },
      { label: "Older", items: [] },
    ];
    for (const conversation of filtered) {
      const key = new Date(conversation.updatedAt).toDateString();
      if (recent.has(key)) buckets[0].items.push(conversation);
      else if (week.has(key)) buckets[1].items.push(conversation);
      else buckets[2].items.push(conversation);
    }
    return buckets.filter((b) => b.items.length > 0);
  }, [conversations, query]);

  return (
    <aside
      aria-label="Chat history"
      aria-hidden={collapsed}
      className={`hidden shrink-0 overflow-hidden border-r border-hairline bg-panel transition-[width] duration-200 lg:flex lg:flex-col ${
        collapsed ? "w-0 border-r-0" : "w-[264px] xl:w-[280px]"
      }`}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-white/[0.08] bg-white/[0.04]">
          <GraceMark className="h-[17px] w-[17px]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">Grace</p>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em] ${
            user?.unlimited ? "bg-accent-soft text-accent-text" : "bg-white/[0.06] text-muted"
          }`}
        >
          {user?.unlimited ? "Owner" : "Free"}
        </span>
      </div>

      <div className="px-2.5 pb-1.5">
        <button
          type="button"
          onClick={onNew}
          className="press flex h-8 w-full items-center gap-2 rounded-[8px] border border-white/[0.07] bg-white/[0.03] px-2.5 text-[12.5px] font-medium text-ink hover:border-white/[0.13] hover:bg-white/[0.06]"
        >
          <MessageSquarePlus size={14} strokeWidth={2.2} aria-hidden="true" />
          New chat
        </button>
      </div>

      <div className="px-2.5 pb-1">
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-7 w-full rounded-[7px] border border-transparent bg-transparent pl-6 pr-2 text-[12px] text-ink outline-none placeholder:text-muted hover:border-white/[0.07] focus:border-white/[0.12] focus:bg-white/[0.03]"
          />
        </div>
      </div>

      <nav className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-[12px] leading-5 text-muted">
            Your chats collect here.
          </p>
        )}
        {conversations.length > 0 && groups.length === 0 && (
          <p className="px-2 py-4 text-[12px] leading-5 text-muted">Nothing matches that.</p>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-1.5">
            <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map((conversation) => {
                const active = conversation.id === activeId;
                return (
                  <li key={conversation.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-[30px] w-full items-center rounded-[7px] px-2 pr-7 text-left text-[12.5px] transition-colors duration-100 ${
                        active
                          ? "bg-white/[0.08] font-medium text-ink"
                          : "text-sub hover:bg-white/[0.045] hover:text-ink"
                      }`}
                    >
                      <span className="truncate">{conversation.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      aria-label={`Delete ${conversation.title}`}
                      className="press absolute right-0.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-[6px] text-muted opacity-0 hover:bg-white/[0.08] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-px border-t border-hairline p-2">
        <Link
          href="/code"
          className="press flex h-8 items-center gap-2 rounded-[7px] px-2 text-[12.5px] text-sub transition-colors hover:bg-white/[0.045] hover:text-ink"
        >
          <Code2 size={14} aria-hidden="true" />
          <span className="flex-1">Grace Code</span>
          <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-accent-text">
            Code
          </span>
        </Link>
        <Link
          href="/settings"
          className="press flex h-8 items-center gap-2 rounded-[7px] px-2 text-[12.5px] text-sub transition-colors hover:bg-white/[0.045] hover:text-ink"
        >
          <Settings2 size={14} aria-hidden="true" />
          Settings
        </Link>
        {user?.isAdmin && (
          <Link
            href="/admin"
            className="press flex h-8 items-center gap-2 rounded-[7px] px-2 text-[12.5px] text-sub transition-colors hover:bg-white/[0.045] hover:text-ink"
          >
            <ShieldCheck size={14} aria-hidden="true" />
            Admin
          </Link>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className="press flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-[12.5px] text-sub transition-colors hover:bg-white/[0.045] hover:text-ink"
        >
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
