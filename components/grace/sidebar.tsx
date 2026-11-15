"use client";

import {
  ArrowUpRight,
  Blocks,
  ChevronLeft,
  ChevronsUpDown,
  ChevronRight,
  Gem,
  LayoutGrid,
  MessagesSquare,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Brain,
  Gauge,
  ShieldCheck,
  PencilLine,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { GraceMark } from "@/components/grace/logo";
import type { ConversationSummary } from "@/lib/client/types";

export type SidebarUser = {
  name: string;
  email: string;
  plan: string;
  isAdmin: boolean;
  unlimited: boolean;
} | null;

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** A count or badge shown at the right edge. */
  badge?: React.ReactNode;
  /** The deployment switch that governs this destination, if any. */
  feature?: keyof SidebarFeatures;
};

/** Which destinations the owner has left switched on. */
export type SidebarFeatures = {
  projects: boolean;
  memory: boolean;
  apex: boolean;
  graceCode: boolean;
};

type Props = {
  user: SidebarUser;
  conversations: ConversationSummary[];
  activeId: string | null;
  collapsed: boolean;
  remainingPct: number;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSearch: () => void;
  onOpenUsage: () => void;
  onOpenApex: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  /** Opens the floating chat panel. Only rendered when chat is docked. */
  onOpenChat?: () => void;
  features?: SidebarFeatures;
  brandName?: string;
};

/**
 * The desktop sidebar.
 *
 * Written for a 1280px-and-up window first: fixed 264px, the product name at
 * the top, the six destinations that are not a conversation, then history. It
 * collapses to a rail (not a drawer) because at 1024px the conversation needs
 * every pixel it can get, and losing history entirely is worse than losing the
 * labels.
 */
export function Sidebar({
  user,
  conversations,
  activeId,
  collapsed,
  remainingPct,
  onToggleCollapse,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onSearch,
  onOpenUsage,
  onOpenApex,
  onOpenProfile,
  onSignOut,
  features,
  brandName = "Grace",
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  // Destinations the owner has removed never appear. Usage, Upcoming and
  // Connections have no switch: they are part of every deployment.
  const allNav: NavItem[] = [
    { href: "/projects", label: "Projects", icon: <LayoutGrid size={17} />, feature: "projects" },
    { href: "/usage", label: "Usage & limits", icon: <Gauge size={17} />, badge: `${remainingPct}%` },
    { href: "/memory", label: "Memory", icon: <Brain size={17} />, feature: "memory" },
    { href: "/upcoming", label: "Upcoming", icon: <Sparkles size={17} /> },
    { href: "/connections", label: "Connections", icon: <Blocks size={17} /> },
    { href: "/apex", label: "Apex", icon: <Gem size={17} />, feature: "apex" },
  ];
  const nav = allNav.filter((item) => !item.feature || !features || features[item.feature]);

  // Newest first, cut at a scannable length; the search sheet holds everything.
  const recent = useMemo(() => conversations.slice(0, 8), [conversations]);

  const planLabel = user?.unlimited ? "Apex" : user?.plan === "free" ? "Free" : "Apex";
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <aside
      aria-label={`${brandName} navigation`}
      className={`relative z-30 hidden h-[100dvh] shrink-0 flex-col border-r border-hairline bg-black transition-[width] duration-200 ease-[var(--ease-out)] md:flex ${
        collapsed ? "w-[68px]" : "w-[264px]"
      }`}
    >
      {/* -------------------------------------------------------- brand row */}
      {collapsed ? (
        <div className="flex h-[60px] shrink-0 items-center justify-center px-2">
          <Link
            href="/"
            aria-label={`${brandName} home`}
            title={brandName}
            className="press grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-control"
          >
            <GraceMark className="h-[19px] w-[19px] shrink-0 text-[#d7d7da]" />
          </Link>
        </div>
      ) : (
        <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-3.5">
          <Link
            href="/"
            aria-label={`${brandName} home`}
            className="press grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-control"
          >
            <GraceMark className="h-[19px] w-[19px] shrink-0 text-[#d7d7da]" />
          </Link>
          <span className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="text-[14.5px] font-semibold leading-[18px] tracking-[-0.01em] text-ink">
              {brandName}
            </span>
            <span className="text-[10.5px] leading-[14px] text-muted">One assistant</span>
          </span>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="press grid h-8 w-8 shrink-0 place-items-center rounded-[7px] text-muted hover:bg-white/[0.06] hover:text-ink"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------- new + search */}
      <div className={`shrink-0 space-y-1 ${collapsed ? "px-2" : "px-2.5"}`}>
        <button
          type="button"
          onClick={onNew}
          title="New chat"
          className={`press flex h-9 w-full items-center gap-2.5 rounded-[9px] bg-white/[0.055] text-[13.5px] font-medium text-ink hover:bg-white/[0.09] ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          <Plus size={17} className="shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">New chat</span>}
          {!collapsed && (
            <kbd className="ml-auto rounded-[5px] border border-white/[0.08] px-1 py-px font-sans text-[9.5px] font-medium text-muted">
              {modKey()}K
            </kbd>
          )}
        </button>
        <button
          type="button"
          onClick={onSearch}
          title="Search chats"
          className={`press flex h-9 w-full items-center gap-2.5 rounded-[9px] text-[13.5px] text-sub hover:bg-white/[0.055] hover:text-ink ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          <Search size={16} className="shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">Search</span>}
        </button>
      </div>

      {/* ------------------------------------------------------------- nav */}
      <nav className={`mt-3 shrink-0 space-y-0.5 ${collapsed ? "px-2" : "px-2.5"}`} aria-label="Sections">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`press group flex h-9 items-center gap-2.5 rounded-[9px] text-[13.5px] transition-colors ${
                collapsed ? "justify-center px-0" : "px-2.5"
              } ${
                active
                  ? "bg-white/[0.085] font-medium text-ink"
                  : "text-sub hover:bg-white/[0.055] hover:text-ink"
              }`}
            >
              <span className={`shrink-0 ${active ? "text-ink" : "text-sub group-hover:text-ink"}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-muted">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* --------------------------------------------------------- history */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {!collapsed && (
          <div className="flex shrink-0 items-center justify-between px-3.5 pb-1">
            <p className="text-[11px] font-semibold tracking-[0.02em] text-muted">Recent</p>
            <button
              type="button"
              onClick={onSearch}
              className="press grid h-5 w-5 place-items-center rounded-[5px] text-muted hover:bg-white/[0.07] hover:text-ink"
              aria-label="Search all chats"
            >
              <Search size={12} />
            </button>
          </div>
        )}
        <div className={`scroll-quiet min-h-0 flex-1 overflow-y-auto pb-2 ${collapsed ? "px-2" : "px-2.5"}`}>
          {conversations.length === 0 && !collapsed && (
            <p className="px-2 py-3 text-[12.5px] leading-5 text-muted">
              Your chats collect here.
            </p>
          )}
          <ul className="space-y-px">
            {recent.map((conversation) => {
              const active = conversation.id === activeId && pathname === "/";
              const isRenaming = renaming === conversation.id;
              return (
                <li key={conversation.id} className="group/row relative">
                  {isRenaming ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const next = draft.trim();
                        if (next && next !== conversation.title) onRename(conversation.id, next);
                        setRenaming(null);
                      }}
                      className="px-1"
                    >
                      <input
                        ref={renameRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => setRenaming(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setRenaming(null);
                        }}
                        aria-label={`Rename ${conversation.title}`}
                        maxLength={120}
                        className="h-8 w-full rounded-[7px] border border-accent/60 bg-black px-2 text-[13px] text-ink outline-none"
                      />
                    </form>
                  ) : (
                    <div
                      className={`flex h-8 items-center rounded-[7px] transition-colors ${
                        active ? "bg-white/[0.085]" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(conversation.id)}
                        onDoubleClick={() => {
                          setDraft(conversation.title);
                          setRenaming(conversation.id);
                        }}
                        title={conversation.title}
                        aria-current={active ? "page" : undefined}
                        className={`min-w-0 flex-1 text-left ${
                          collapsed ? "px-0 text-center" : "pl-2 pr-0.5"
                        }`}
                      >
                        {collapsed ? (
                          <MessagesSquare size={15} className="mx-auto text-sub" aria-hidden="true" />
                        ) : (
                          <span
                            className={`block truncate text-[13px] ${
                              active ? "font-medium text-ink" : "text-sub group-hover/row:text-ink"
                            }`}
                          >
                            {conversation.title}
                          </span>
                        )}
                      </button>
                      {!collapsed && (
                        <span className="mr-1 flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setDraft(conversation.title);
                              setRenaming(conversation.id);
                            }}
                            aria-label={`Rename ${conversation.title}`}
                            className="press grid h-6 w-6 place-items-center rounded-[5px] text-muted hover:bg-white/[0.09] hover:text-ink"
                          >
                            <PencilLine size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(conversation.id)}
                            aria-label={`Delete ${conversation.title}`}
                            className="press grid h-6 w-6 place-items-center rounded-[5px] text-muted hover:bg-white/[0.09] hover:text-ink"
                          >
                            <Trash2 size={12} />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {!collapsed && conversations.length > recent.length && (
            <button
              type="button"
              onClick={onSearch}
              className="mt-1 flex h-8 w-full items-center gap-1.5 rounded-[7px] px-2 text-[12.5px] text-muted hover:bg-white/[0.05] hover:text-sub"
            >
              All chats
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------- footer */}
      <div className={`shrink-0 space-y-1 border-t border-hairline py-2 ${collapsed ? "px-2" : "px-2.5"}`}>
        {/* An owner already has everything, so selling them Apex is noise. They
            get the console instead; everyone else keeps the upgrade path. */}
        {user?.isAdmin ? (
          <Link
            href="/admin"
            title="Open the console"
            className={`press flex w-full items-center gap-2.5 rounded-[9px] bg-accent/[0.12] text-[13px] font-medium text-accent-text hover:bg-accent/[0.18] ${
              collapsed ? "h-9 justify-center px-0" : "h-9 px-2.5"
            }`}
          >
            <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">Console</span>}
            {!collapsed && <ArrowUpRight size={13} className="ml-auto shrink-0 opacity-70" />}
          </Link>
        ) : features?.apex !== false ? (
          <button
            type="button"
            onClick={onOpenApex}
            title="Get Apex"
            className={`press flex w-full items-center gap-2.5 rounded-[9px] bg-accent/[0.12] text-[13px] font-medium text-accent-text hover:bg-accent/[0.18] ${
              collapsed ? "h-9 justify-center px-0" : "h-9 px-2.5"
            }`}
          >
            <Sparkles size={16} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">Get Apex</span>}
            {!collapsed && <ArrowUpRight size={13} className="ml-auto shrink-0 opacity-70" />}
          </button>
        ) : null}

        {user?.isAdmin && (
          <Link
            href="/admin"
            title="Admin console"
            className={`press flex h-9 items-center gap-2.5 rounded-[9px] text-[13px] text-sub hover:bg-white/[0.055] hover:text-ink ${
              collapsed ? "justify-center px-0" : "px-2.5"
            }`}
          >
            <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">Admin console</span>}
          </Link>
        )}

        {collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="press mb-1 grid h-9 w-full place-items-center rounded-[9px] text-muted hover:bg-white/[0.055] hover:text-ink"
          >
            <ChevronsUpDown size={15} />
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={user?.name ?? "Account"}
            className={`press flex w-full items-center gap-2.5 rounded-[9px] py-1.5 hover:bg-white/[0.055] ${
              collapsed ? "justify-center px-0" : "px-1.5"
            }`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.1] text-[12px] font-semibold text-ink">
              {initial}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {user?.name || "Your account"}
                  </span>
                  <span className="block truncate text-[11px] text-muted">{planLabel} plan</span>
                </span>
                <ChevronsUpDown size={13} className="shrink-0 text-muted" aria-hidden="true" />
              </>
            )}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="float-menu animate-sheet-up absolute bottom-full left-0 z-50 mb-1.5 w-[228px] overflow-hidden rounded-[14px] p-1"
              >
                <div className="px-2.5 py-2">
                  <p className="truncate text-[13px] font-medium text-ink">{user?.name || "Account"}</p>
                  <p className="truncate text-[11.5px] text-muted">{user?.email}</p>
                </div>
                <div className="my-1 h-px bg-hairline" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenUsage();
                  }}
                  className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2.5 text-[13px] text-sub hover:bg-white/[0.06] hover:text-ink"
                >
                  <Gauge size={14} aria-hidden="true" /> Usage & limits
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2.5 text-[13px] text-sub hover:bg-white/[0.06] hover:text-ink"
                >
                  <Settings2 size={14} aria-hidden="true" /> Account settings
                </button>
                <div className="my-1 h-px bg-hairline" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2.5 text-[13px] text-sub hover:bg-white/[0.06] hover:text-ink"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

/** "⌘K" on Apple, "Ctrl K" elsewhere. Rendered client-side only. */
function modKey() {
  if (typeof navigator === "undefined") return "Ctrl ";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ";
}
