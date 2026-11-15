"use client";

import { MessageCircle, Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { SearchSheet } from "@/components/grace/search-sheet";
import { Sidebar } from "@/components/grace/sidebar";
import type { UsageData } from "@/components/grace/usage-modal";
import type { ConversationSummary, SessionUserView } from "@/lib/client/types";

type Props = {
  user: SessionUserView;
  usage: UsageData;
  conversations: ConversationSummary[];
  children: React.ReactNode;
};

/**
 * The app frame.
 *
 * One sidebar, one scroll area, one place that owns search and the floating
 * chat button. Pages render into `children` and never position themselves
 * against the viewport, so the shell can change shape (collapsed rail on a
 * 1024px laptop) without any page knowing.
 *
 * Chat lives at "/" and is docked into `children`; every other route is a
 * document, and the floating button opens a real chat panel on top of it.
 */
export function AppShell({ user, usage, conversations: initial, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState(initial);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);

  const isChat = pathname === "/";

  // The server sends a fresh list after a navigation; adopting it is a sync
  // with an external system, so it is deferred out of the effect body.
  useEffect(() => {
    const timer = window.setTimeout(() => setConversations(initial), 0);
    return () => window.clearTimeout(timer);
  }, [initial]);

  // Remember the rail choice: a collapsed rail is a preference, not a state.
  useEffect(() => {
    const saved = window.localStorage.getItem("grace.sidebar");
    if (saved !== "collapsed") return;
    const timer = window.setTimeout(() => setCollapsed(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("grace.sidebar", next ? "collapsed" : "open");
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { conversations: ConversationSummary[] };
      setConversations(data.conversations);
    } catch {
      /* keep the list we have */
    }
  }, []);

  const openConversation = useCallback(
    (id: string) => {
      if (isChat) {
        // Chat already owns the id; hand it the request without a reload.
        window.dispatchEvent(new CustomEvent("grace:open", { detail: id }));
      } else {
        router.push(`/?c=${id}`);
      }
      setSearchOpen(false);
    },
    [isChat, router]
  );

  const newChat = useCallback(() => {
    if (isChat) {
      window.dispatchEvent(new CustomEvent("grace:new"));
    } else {
      router.push("/");
    }
    setSearchOpen(false);
  }, [isChat, router]);

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => undefined);
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this chat? This cannot be undone.")) return;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (isChat) window.dispatchEvent(new CustomEvent("grace:deleted", { detail: id }));
      await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => undefined);
    },
    [isChat]
  );

  const signOut = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/");
    router.refresh();
    pending.current = false;
  }, [router]);

  const toast = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  // Command palette: Ctrl/Cmd K opens search, Ctrl/Cmd J starts a chat.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  // Other pages ask the shell for things through the DOM, so a page never has
  // to know the sidebar's props: open search, open chat, show a toast.
  useEffect(() => {
    const onSearch = () => setSearchOpen(true);
    const onChat = () => setChatOpen(true);
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      toast(String(detail));
    };
    const onRefresh = () => void refresh();
    window.addEventListener("grace:search", onSearch);
    window.addEventListener("grace:shell-chat", onChat);
    window.addEventListener("grace:toast", onToast as EventListener);
    window.addEventListener("grace:refresh", onRefresh);
    return () => {
      window.removeEventListener("grace:search", onSearch);
      window.removeEventListener("grace:shell-chat", onChat);
      window.removeEventListener("grace:toast", onToast as EventListener);
      window.removeEventListener("grace:refresh", onRefresh);
    };
  }, [toast, refresh]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg">
      <Sidebar
        user={user}
        conversations={conversations}
        activeId={null}
        collapsed={collapsed}
        remainingPct={usage.remainingPct}
        onToggleCollapse={toggleCollapsed}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={(id) => void deleteConversation(id)}
        onRename={(id, title) => void renameConversation(id, title)}
        onSearch={() => setSearchOpen(true)}
        onOpenUsage={() => router.push("/usage")}
        onOpenApex={() => router.push("/apex")}
        onOpenProfile={() => router.push("/settings")}
        onSignOut={() => void signOut()}
      />

      <div className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {/* Floating chat: only where chat is not already the page. */}
      {!isChat && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open chat with Grace"
          className="press fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-[13.5px] font-semibold text-black shadow-[0_12px_32px_rgba(0,0,0,0.55)] hover:opacity-90"
        >
          <MessageCircle size={17} strokeWidth={2.2} aria-hidden="true" />
          Chat
        </button>
      )}

      {chatOpen && !isChat && (
        <div className="fixed inset-0 z-50" role="presentation">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60"
            aria-hidden="true"
            onMouseDown={() => setChatOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chat with Grace"
            className="float-panel animate-sheet-up absolute bottom-5 right-5 flex h-[min(680px,calc(100dvh-88px))] w-[min(430px,calc(100vw-40px))] flex-col overflow-hidden rounded-[22px]"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
              <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">Grace 3</span>
              <button
                type="button"
                onClick={newChat}
                aria-label="New chat"
                className="press grid h-8 w-8 place-items-center rounded-full text-sub hover:bg-white/[0.06] hover:text-ink"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="press grid h-8 w-8 place-items-center rounded-full text-sub hover:bg-white/[0.06] hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[15px] font-medium text-ink">
                Grace is docked beside this page.
              </p>
              <p className="max-w-[30ch] text-[12.5px] leading-5 text-sub">
                The full conversation lives in the main chat. Open it to keep your history and
                credits in one place.
              </p>
              <button
                type="button"
                onClick={() => {
                  setChatOpen(false);
                  router.push("/");
                }}
                className="press mt-1 h-9 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black hover:opacity-90"
              >
                Open chat
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={(id) => void deleteConversation(id)}
      />

      {notice && (
        <div
          role="status"
          className="float-menu animate-sheet-up fixed bottom-5 left-1/2 z-50 flex max-w-[min(440px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] text-ink md:left-[calc(50%+132px)]"
        >
          <span className="min-w-0 flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="shrink-0 text-muted hover:text-ink"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
