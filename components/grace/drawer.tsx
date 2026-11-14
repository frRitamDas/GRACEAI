"use client";

import { Code2, LogOut, MessageSquarePlus, Settings2, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";

import { Overlay } from "@/components/grace/sheet";

export type ConversationSummary = { id: string; title: string; updatedAt: string };

type Props = {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string; plan: string; isAdmin: boolean; unlimited: boolean } | null;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
  onOpenUsage: () => void;
};

/** Side drawer behind the menu button: history, settings, sign out. */
export function Drawer({
  open,
  onClose,
  user,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onSignOut,
  onOpenUsage,
}: Props) {
  return (
    <Overlay open={open} onClose={onClose} variant="bottom" labelledBy="drawer-title" transparent>
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" onMouseDown={onClose} />
      <div className="animate-sheet-up relative flex h-[86vh] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-hairline glass-strong pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div className="min-w-0">
            <h2 id="drawer-title" className="flex items-center gap-2 text-[22px] font-bold leading-7 text-ink">
              <span className="truncate">{user?.name || "Grace"}</span>
              {user?.unlimited && (
                <span className="shrink-0 rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
                  Owner
                </span>
              )}
            </h2>
            <p className="truncate text-[14px] leading-5 text-sub">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-control text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pt-2">
          <button
            type="button"
            onClick={() => {
              onNew();
              onClose();
            }}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink text-[16px] font-bold text-black"
          >
            <MessageSquarePlus size={18} aria-hidden="true" /> New chat
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenUsage();
              onClose();
            }}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full border border-hairline bg-control text-[16px] font-bold text-ink"
          >
            Usage
          </button>
        </div>

        <p className="px-5 pb-1 pt-5 text-[12px] font-semibold tracking-[0.01em] text-muted">
          Recent
        </p>
        <div className="scroll-quiet flex-1 overflow-y-auto px-3 pb-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-6 text-[15px] text-sub">Your chats will appear here.</p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((conversation) => {
                const active = conversation.id === activeId;
                return (
                  <li key={conversation.id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(conversation.id);
                        onClose();
                      }}
                      aria-current={active ? "true" : undefined}
                      className={`min-w-0 flex-1 truncate rounded-[14px] px-3 py-3 text-left text-[16px] leading-6 transition-colors ${
                        active ? "bg-raised text-ink" : "text-sub hover:bg-raised hover:text-ink"
                      }`}
                    >
                      {conversation.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(conversation.id)}
                      aria-label={`Delete ${conversation.title}`}
                      className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-control hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-hairline px-3 py-2">
          <Link
            href="/code"
            onClick={onClose}
            className="flex h-12 items-center gap-3 rounded-[14px] px-3 text-[16px] text-sub transition-colors hover:bg-raised hover:text-ink"
          >
            <Code2 size={18} aria-hidden="true" /> Grace Code
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-text">
              New
            </span>
          </Link>
          <Link
            href="/settings"
            onClick={onClose}
            className="flex h-12 items-center gap-3 rounded-[14px] px-3 text-[16px] text-sub transition-colors hover:bg-raised hover:text-ink"
          >
            <Settings2 size={18} aria-hidden="true" /> Settings
          </Link>
          {user?.isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex h-12 items-center gap-3 rounded-[14px] px-3 text-[16px] text-sub transition-colors hover:bg-raised hover:text-ink"
            >
              <ShieldCheck size={18} aria-hidden="true" /> Admin console
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="flex h-12 w-full items-center gap-3 rounded-[14px] px-3 text-[16px] text-sub transition-colors hover:bg-raised hover:text-ink"
          >
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    </Overlay>
  );
}
