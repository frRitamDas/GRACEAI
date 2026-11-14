"use client";

import { MessageSquarePlus, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";

import { GraceMark } from "@/components/grace/logo";
import type { ConversationSummary } from "@/components/grace/drawer";

type Props = {
  user: { name: string; plan: string; isAdmin: boolean; unlimited: boolean } | null;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

/**
 * The wide-screen rail. On a phone the same history lives in the drawer; on a
 * desktop the drawer would be a wasted click, so the list sits permanently
 * beside the conversation and the chat column keeps its comfortable measure.
 */
export function SideRail({ user, conversations, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside
      aria-label="Chat history"
      className="hidden w-[260px] shrink-0 flex-col border-r border-hairline bg-black px-3 pb-4 pt-4 lg:flex xl:w-[288px]"
    >
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-control text-[#C9C9CC]">
          <GraceMark className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-5 text-ink">Grace 3</p>
          <p className="flex items-center gap-1.5 text-[12px] leading-4 text-muted">
            {user?.unlimited ? (
              <span className="font-semibold text-accent-text">Owner</span>
            ) : (
              "Free plan"
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="press mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-black"
      >
        <MessageSquarePlus size={17} strokeWidth={2.4} aria-hidden="true" />
        New chat
      </button>

      <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold tracking-[0.01em] text-muted">
        Recent
      </p>

      <nav className="scroll-quiet -mx-1 flex-1 overflow-y-auto px-1">
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-[13px] leading-5 text-muted">
            Your chats will collect here.
          </p>
        )}
        <ul className="space-y-0.5">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 w-full items-center rounded-[10px] px-2.5 pr-9 text-left text-[13.5px] transition-colors duration-100 ${
                    active
                      ? "bg-raised font-medium text-ink"
                      : "text-sub hover:bg-[#161618] hover:text-ink"
                  }`}
                >
                  <span className="truncate">{conversation.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(conversation.id)}
                  aria-label={`Delete ${conversation.title}`}
                  className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-control hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-3 space-y-0.5 border-t border-hairline pt-3">
        <Link
          href="/settings"
          className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] text-sub transition-colors hover:bg-[#161618] hover:text-ink"
        >
          <Settings2 size={15} aria-hidden="true" />
          Settings
        </Link>
        {user?.isAdmin && (
          <Link
            href="/admin"
            className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] text-sub transition-colors hover:bg-[#161618] hover:text-ink"
          >
            <ShieldCheck size={15} aria-hidden="true" />
            Admin console
          </Link>
        )}
      </div>
    </aside>
  );
}
