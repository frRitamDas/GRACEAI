"use client";

import { ArrowUpRight, MessageSquare, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationSummary } from "@/lib/client/types";


type Props = {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

/**
 * Search.
 *
 * A centered sheet on a dimmed backdrop, matching the menus elsewhere. It
 * searches titles live, groups by recency, and never hides a chat because a
 * search is active: the goal is finding the thing, not filtering the product.
 */
export function SearchSheet({ open, onClose, conversations, onSelect, onNew, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const reset = window.setTimeout(() => {
      setQuery("");
      setCursor(0);
      inputRef.current?.focus();
    }, 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(reset);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? conversations.filter((c) => c.title.toLowerCase().includes(needle))
      : conversations;

    const dayKeys = Array.from(new Set(filtered.map((c) => new Date(c.updatedAt).toDateString())));
    const recent = new Set(dayKeys.slice(0, 1));
    const week = new Set(dayKeys.slice(0, 7));

    const buckets: { label: string; items: ConversationSummary[] }[] = [
      { label: "Today", items: [] },
      { label: "This week", items: [] },
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

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  if (!open) return null;

  const move = (delta: number) => {
    if (flat.length === 0) return;
    const next = Math.min(flat.length - 1, Math.max(0, cursor + delta));
    setCursor(next);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-start justify-center pt-[12vh]" role="presentation">
      <div
        className="animate-fade-in absolute inset-0 bg-black/60"
        aria-hidden="true"
        onMouseDown={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search chats"
        className="float-modal animate-modal-in relative mx-4 w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-[20px]"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-3.5">
          <Search size={17} className="shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
              }
              if (event.key === "Enter" && flat[cursor]) {
                event.preventDefault();
                onSelect(flat[cursor].id);
              }
            }}
            placeholder="Search your chats"
            aria-label="Search your chats"
            className="h-0 flex-1 bg-transparent py-4 text-[14.5px] text-ink outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-white/[0.07] hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>

        <div ref={listRef} className="scroll-quiet max-h-[52vh] overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={onNew}
            className="flex h-10 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] font-medium text-accent-text hover:bg-white/[0.06]"
          >
            <Plus size={15} aria-hidden="true" />
            Start a new chat
          </button>
          <div className="my-1 h-px bg-hairline" />

          {flat.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-[13px] text-muted">
              {conversations.length === 0
                ? "No chats yet. The first one starts above."
                : "No chat matches that."}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="pb-1">
                <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold tracking-[0.02em] text-muted">
                  {group.label}
                </p>
                {group.items.map((conversation) => {
                  const index = flat.findIndex((c) => c.id === conversation.id);
                  const selected = index === cursor;
                  return (
                    <div
                      key={conversation.id}
                      data-index={index}
                      className={`group flex h-9 items-center rounded-[8px] ${
                        selected ? "bg-white/[0.075]" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(conversation.id)}
                        onMouseEnter={() => setCursor(index)}
                        className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-2.5 text-left"
                      >
                        <MessageSquare size={13} className="shrink-0 text-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                          {conversation.title}
                        </span>
                        {selected && (
                          <ArrowUpRight size={12} className="shrink-0 text-muted" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(conversation.id)}
                        aria-label={`Delete ${conversation.title}`}
                        className="mr-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-[5px] text-muted opacity-0 hover:bg-white/[0.08] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-hairline px-3.5 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> to open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>Esc</Kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[4px] border border-hairline bg-control px-1 py-px font-sans text-[10px] leading-4 text-sub">
      {children}
    </kbd>
  );
}
