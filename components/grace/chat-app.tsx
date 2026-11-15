"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDown, X } from "lucide-react";

import { ChatHeader } from "@/components/grace/chat-header";
import { Composer } from "@/components/grace/composer";
import { EffortPanel } from "@/components/grace/effort-panel";
import { Greeting } from "@/components/grace/greeting";
import { MessageRow, ScrollToBottom, type ChatMessage } from "@/components/grace/message";
import {
  WorkspacePanel,
  type WorkspaceFileInfo,
  type WorkspaceRepo,
} from "@/components/grace/workspace-panel";
import { UsageModal, type UsageData } from "@/components/grace/usage-modal";
import { EFFORT_LEVELS } from "@/lib/ai/catalog";
import type { AttachmentView, ConversationSummary, SessionUserView } from "@/lib/client/types";

type Props = {
  initialUser: SessionUserView;
  initialUsage: UsageData;
  initialConversations: ConversationSummary[];
  anyConfigured: boolean;
  /** Product name from the deployment settings, so the header chip is the brand. */
  brandName: string;
  /** Whether the owner has chat switched on; off shows an honest paused state. */
  chatEnabled: boolean;
  greetings: [string, string, string];
  footerNote: string;
  features: {
    graceCode: boolean;
    projects: boolean;
    memory: boolean;
    apex: boolean;
    attachments: boolean;
    deepResearch: boolean;
  };
  /** From `?c=` on a cold load from the sidebar. */
  initialConversationId?: string | null;
};

function firstName(name: string, email: string) {
  const first = name.trim().split(/\s+/)[0];
  if (first) return first;
  const local = email.split("@")[0]?.replace(/[^a-zA-Z]/g, " ") ?? "";
  const word = local.trim().split(/\s+/)[0];
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "there";
}

export function ChatApp({
  initialUser,
  initialUsage,
  initialConversations,
  anyConfigured,
  brandName,
  chatEnabled,
  greetings,
  footerNote,
  features,
  initialConversationId = null,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();

  const [user, setUser] = useState(initialUser);
  const [usage, setUsage] = useState(initialUsage);
  const [providerReady, setProviderReady] = useState(anyConfigured);
  const [conversations, setConversations] = useState(initialConversations);

  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [sending, setSending] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);

  const [usageOpen, setUsageOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; action?: { label: string; href: string } } | null>(null);

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [workspaceRepo, setWorkspaceRepo] = useState<WorkspaceRepo | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileInfo[]>([]);
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const effortLabel = EFFORT_LEVELS[user.effort]?.name ?? EFFORT_LEVELS[0].name;
  const greetingName = useMemo(() => firstName(user.name, user.email), [user.name, user.email]);

  const refreshUsage = useCallback(async () => {
    try {
      const response = await fetch("/api/usage", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { user: SessionUserView | null; usage: UsageData | null };
      if (data.user) setUser((prev) => ({ ...prev, ...data.user! }));
      if (data.usage) setUsage(data.usage);
    } catch {
      /* offline: keep the last known numbers */
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { conversations: ConversationSummary[] };
      setConversations(data.conversations);
    } catch {
      /* keep the list we have */
    }
  }, []);

  const loadWorkspace = useCallback(async (id: string) => {
    if (!features.graceCode) return;
    try {
      const response = await fetch(`/api/workspace/${id}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { repo: WorkspaceRepo | null; files: WorkspaceFileInfo[] };
      setWorkspaceRepo(data.repo);
      setWorkspaceFiles(data.files);
      if (data.repo || data.files.length > 0) setCodeMode(true);
    } catch {
      /* the chat still works without its workspace */
    }
  }, [features.graceCode]);

  // Model catalog: refresh once on mount so an admin key change appears.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/models", { cache: "no-store" });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as { anyConfigured?: boolean };
        setProviderReady(Boolean(data.anyConfigured));
      } catch {
        /* the server render already told us */
      }
    })();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUsage();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshUsage]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    stickToBottom.current = true;
    setShowJump(false);
  }, []);

  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottom.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const persistSettings = useCallback(async (patch: Record<string, unknown>) => {
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const data = (await response.json()) as { user: SessionUserView };
        setUser((prev) => ({ ...prev, ...data.user }));
      }
    } catch {
      /* settings are also kept in local state */
    }
  }, []);

  // -------------------------------------------------------------------- send
  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if ((!text && attachments.length === 0) || sending) return;

      if (!providerReady) {
        setNotice(
          user.isAdmin
            ? {
                text: "No AI service is connected yet, so there is nothing to send to.",
                action: { label: "Open the console", href: "/admin" },
              }
            : { text: "Grace is not connected yet. The owner needs to finish setup." }
        );
        return;
      }

      setNotice(null);
      let startId = conversationId;
      if (codeMode && !startId) {
        try {
          const made = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: text ? text.slice(0, 56) : "New chat" }),
          });
          if (made.ok) {
            const data = (await made.json()) as { conversation?: { id: string } };
            if (data.conversation?.id) {
              startId = data.conversation.id;
              setConversationId(startId);
              refreshConversations();
            }
          }
        } catch {
          /* the turn still works, just without files */
        }
      }

      const optimisticId = `pending-${Date.now()}`;
      const outbound = attachments;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: "user",
          content: text || "Review the attached files.",
          attachments: outbound.map((a) => ({ name: a.name, mime: a.mime })),
        },
        {
          id: `${optimisticId}-reply`,
          role: "assistant",
          content: "",
          pending: true,
          status: "Thinking",
        },
      ]);
      setInput("");
      setAttachments([]);
      setSending(true);
      stickToBottom.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      let streamConversationId: string | null = null;
      let accumulated = "";
      let streamError = false;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId: startId,
            message: text,
            attachments: outbound.map((a) => ({
              name: a.name,
              mime: a.mime,
              text: a.text,
              dataUrl: a.mime.startsWith("image/") ? a.dataUrl : undefined,
            })),
            effort: user.effort,
            deepResearch,
            workspace: codeMode,
            focus: openFilePath,
          }),
        });

        if (!response.ok) {
          const problem = (await response.json().catch(() => ({ error: "That did not go through." }))) as {
            error?: string;
            code?: string;
            needed?: number;
          };
          streamError = true;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === `${optimisticId}-reply`
                ? {
                    ...m,
                    pending: false,
                    error: true,
                    content:
                      problem.code === "out_of_credits"
                        ? "You're out of credits this month. Buy more to keep going."
                        : problem.error ?? "That did not go through. Try again.",
                  }
                : m
            )
          );
          if (problem.code === "out_of_credits") setUsageOpen(true);
          if (problem.code === "no_provider") setProviderReady(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("no body");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index = buffer.indexOf("\n");
          while (index >= 0) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            index = buffer.indexOf("\n");
            if (!line) continue;

            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (event.type === "meta") {
              streamConversationId = String(event.conversationId ?? "");
              if (streamConversationId) setConversationId(streamConversationId);
              refreshConversations();
              window.dispatchEvent(new CustomEvent("grace:refresh"));
            }
            if (event.type === "status") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `${optimisticId}-reply` ? { ...m, status: String(event.label) } : m
                )
              );
            }
            if (event.type === "delta") {
              accumulated += String(event.text ?? "");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `${optimisticId}-reply`
                    ? { ...m, content: accumulated, pending: true, status: null }
                    : m
                )
              );
            }
            if (event.type === "error") {
              streamError = true;
              const messageText = String(event.message ?? "That did not go through.");
              if (!accumulated) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === `${optimisticId}-reply`
                      ? { ...m, pending: false, error: true, content: messageText }
                      : m
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === `${optimisticId}-reply` ? { ...m, pending: false, status: null } : m
                  )
                );
                setNotice({ text: messageText });
              }
            }
            if (event.type === "files") {
              const cleaned = typeof event.text === "string" ? event.text : null;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `${optimisticId}-reply` && cleaned
                    ? {
                        ...m,
                        content: cleaned,
                        files: Array.isArray(event.paths) ? (event.paths as string[]) : m.files,
                      }
                    : m
                )
              );
              if (streamConversationId) void loadWorkspace(streamConversationId);
            }
            if (event.type === "saved") refreshUsage();
            if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `${optimisticId}-reply` ? { ...m, pending: false, status: null } : m
                )
              );
            }
          }
        }
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `${optimisticId}-reply`
              ? {
                  ...m,
                  pending: false,
                  status: null,
                  error: !accumulated,
                  content: accumulated || (aborted ? "Stopped." : "That did not go through. Try again."),
                }
              : m
          )
        );
      } finally {
        setSending(false);
        abortRef.current = null;
        if (!streamError) refreshUsage();
      }
    },
    [
      attachments,
      conversationId,
      deepResearch,
      input,
      providerReady,
      user.isAdmin,
      user.effort,
      refreshConversations,
      refreshUsage,
      sending,
      codeMode,
      openFilePath,
      loadWorkspace,
    ]
  );

  const stop = () => {
    abortRef.current?.abort();
    setSending(false);
  };

  const regenerate = useCallback(() => {
    if (sending) return;
    let prompt: string | null = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === "user") {
        prompt = message.content;
        break;
      }
    }
    if (!prompt) return;
    let trimmed = messages;
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].role !== "user") {
      trimmed = trimmed.slice(0, -1);
    }
    trimmed = trimmed.slice(0, -1);
    setMessages(trimmed);
    void send(prompt);
  }, [messages, send, sending]);

  // -------------------------------------------------------------- uploads
  const uploadFiles = async (files: FileList | null) => {
    if (!features.attachments || !files || files.length === 0) return;
    const remaining = Math.max(0, 6 - attachments.length);
    if (files.length > remaining) {
      setNotice({ text: `Six files per message. ${files.length - remaining} were not added.` });
    }
    const chosen = Array.from(files).slice(0, remaining);
    for (const file of chosen) {
      const form = new FormData();
      form.append("file", file);
      if (conversationId) form.append("conversationId", conversationId);
      try {
        const response = await fetch("/api/upload", { method: "POST", body: form });
        if (!response.ok) {
          const problem = (await response.json().catch(() => ({ error: "Upload failed." }))) as { error?: string };
          setNotice({ text: problem.error ?? "That file did not upload." });
          continue;
        }
        const data = (await response.json()) as AttachmentView;
        setAttachments((prev) => [...prev, data]);
      } catch {
        setNotice({ text: "That file did not upload." });
      }
    }
  };

  // -------------------------------------------------------- conversations
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setInput("");
    setAttachments([]);
    setNotice(null);
    setSending(false);
    setWorkspaceRepo(null);
    setWorkspaceFiles([]);
    setOpenFilePath(null);
    setEffortOpen(false);
    window.history.replaceState(null, "", "/");
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setSending(false);
      try {
        const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
        if (!response.ok) {
          setNotice({ text: "That chat could not be opened." });
          return;
        }
        const data = (await response.json()) as {
          conversation: { id: string; title: string };
          messages: {
            id: string;
            role: "user" | "assistant" | "system";
            content: string;
            attachments: { name: string; mime: string }[];
            error: boolean;
          }[];
        };
        setConversationId(data.conversation.id);
        setMessages(
          data.messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              attachments: m.attachments as { name: string; mime: string }[],
              error: m.error,
            }))
        );
        setNotice(null);
        stickToBottom.current = true;
        window.history.replaceState(null, "", `/?c=${data.conversation.id}`);
        void loadWorkspace(data.conversation.id);
        requestAnimationFrame(() => scrollToBottom("auto"));
      } catch {
        setNotice({ text: "That chat could not be opened." });
      }
    },
    [loadWorkspace, scrollToBottom]
  );

  // Open a chat from ?c= on a full load (sidebar navigation from another page).
  const openedInitial = useRef(false);
  useEffect(() => {
    if (openedInitial.current) return;
    openedInitial.current = true;
    const id = initialConversationId ?? search.get("c");
    if (!id) return;
    const timer = window.setTimeout(() => void openConversation(id), 0);
    return () => window.clearTimeout(timer);
  }, [initialConversationId, search, openConversation]);

  // A question typed into the public page's composer arrives as ?prompt=. It is
  // sent as the first message of a fresh chat and the parameter is then removed
  // from the URL, so a refresh does not ask it a second time.
  const sentInitialPrompt = useRef(false);
  useEffect(() => {
    if (sentInitialPrompt.current) return;
    const carried = search.get("prompt");
    if (!carried || carried.trim().length === 0) return;
    if (initialConversationId || search.get("c")) return;
    sentInitialPrompt.current = true;
    const timer = window.setTimeout(() => {
      router.replace("/", { scroll: false });
      if (chatEnabled) void send(carried);
      else setInput(carried);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [search, send, router, initialConversationId, chatEnabled]);

  // The shell dispatches these because it owns the sidebar.
  useEffect(() => {
    const onOpen = (event: Event) => void openConversation(String((event as CustomEvent).detail));
    const onNew = () => newChat();
    const onDeleted = (event: Event) => {
      if (String((event as CustomEvent).detail) === conversationId) newChat();
    };
    window.addEventListener("grace:open", onOpen);
    window.addEventListener("grace:new", onNew);
    window.addEventListener("grace:deleted", onDeleted);
    return () => {
      window.removeEventListener("grace:open", onOpen);
      window.removeEventListener("grace:new", onNew);
      window.removeEventListener("grace:deleted", onDeleted);
    };
  }, [openConversation, newChat, conversationId]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/welcome");
    router.refresh();
  };

  const setEffort = (index: number) => {
    setUser((prev) => ({ ...prev, effort: index }));
    void persistSettings({ effort: index });
  };

  const onTogglePercentage = (next: boolean) => {
    setUser((prev) => ({ ...prev, showCreditPercentage: next }));
    setUsage((prev) => ({ ...prev }));
    void persistSettings({ showCreditPercentage: next });
  };

  /** Both buy buttons post to the real checkout route and surface its reason. */
  const buy = async (kind: "credits" | "apex") => {
    const response = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = (await response.json().catch(() => ({ error: "That did not open." }))) as {
      url?: string;
      error?: string;
    };
    if (response.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    throw new Error(data.error ?? "Checkout did not open.");
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col">
      <ChatHeader
        remainingPct={usage.remainingPct}
        onUsage={() => setUsageOpen(true)}
        onNewChat={newChat}
        brandName={brandName}
        onToggleSidebar={() => setDrawerOpen(true)}
        sidebarCollapsed={false}
      />

      <main
        ref={scrollRef}
        onScroll={onScroll}
        aria-live="off"
        className="scroll-quiet relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {empty ? (
          <div className="flex h-full flex-col px-4">
            {/* The reference puts the greeting directly under the header —
                measured at ~13 CSS px below it at 852px tall — and leaves the
                rest of the column open. Starters hang below it; they are hidden
                on short windows so they can never crowd the composer. */}
            <div className="mx-auto w-full max-w-[var(--thread-w)]">
              <div className="flex flex-col items-center px-1 pt-[14px] sm:px-5 sm:pt-9">
                <Greeting name={greetingName} lines={greetings} />

                <div className="animate-fade-up mt-6 grid w-full max-w-[620px] grid-cols-1 gap-2 xs:grid-cols-2 [@media(max-height:600px)]:hidden">
                  {(codeMode
                    ? [
                        { title: "Read a repository", body: "Attach a repo and explain how it fits together." },
                        { title: "Plan a change", body: "Outline the files to touch before anything is written." },
                        { title: "Fix a failing path", body: "Paste an error and trace it to the cause." },
                        { title: "Write the README", body: "Setup, usage, and the parts that are easy to get wrong." },
                      ]
                    : [
                        { title: "Explain something", body: "A concept, a document, or a piece of code." },
                        { title: "Draft and revise", body: "Write it, then tighten it until it reads well." },
                        { title: "Work through a problem", body: "Lay out the options and argue for one." },
                        { title: "Build something small", body: "A script, a page, or a fix — end to end." },
                      ]
                  ).map((starter) => (
                    <button
                      key={starter.title}
                      type="button"
                      onClick={() => {
                        setInput(`${starter.title}: `);
                        composerInputRef.current?.focus();
                      }}
                      className="press rounded-[16px] border border-hairline bg-control px-3.5 py-3 text-left transition-colors hover:border-hairline-strong hover:bg-surface"
                    >
                      <p className="text-[13px] font-semibold text-ink">{starter.title}</p>
                      <p className="mt-0.5 text-[12px] leading-[17px] text-muted">{starter.body}</p>
                    </button>
                  ))}
                </div>

                {!providerReady && (
                  <p className="animate-fade-up mt-4 flex max-w-[min(100%,28rem)] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-[14px] border border-hairline bg-control px-3.5 py-2 text-center text-[12.5px] leading-5 text-sub">
                    {user.isAdmin ? (
                      <>
                        Add an AI service key in{" "}
                        <Link href="/admin" className="font-semibold text-accent-text hover:underline">
                          the admin console
                        </Link>{" "}
                        to start chatting
                      </>
                    ) : (
                      "Grace is not connected yet. The owner needs to finish setup."
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[var(--thread-w)] flex-col gap-6 px-4 pb-6 pt-2 sm:px-5">
            {messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                onRetry={regenerate}
                isLast={index === messages.length - 1}
                onOpenFile={(path) => {
                  setOpenFilePath(path);
                  setWorkspaceOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {showJump && !empty && (
        <div className="pointer-events-none relative z-20 mx-auto w-full max-w-[var(--thread-w)] shrink-0 px-3 sm:px-5">
          <div className="pointer-events-auto absolute inset-x-0 -top-3 flex justify-center">
            <ScrollToBottom onClick={() => scrollToBottom()} />
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-[var(--thread-w)] shrink-0 px-3 pb-2 pt-1 sm:px-5 sm:pb-3">
        {notice && (
          <div
            role="status"
            className="animate-fade-in mb-2 flex items-center gap-2 rounded-[14px] border border-hairline bg-control px-3.5 py-2.5 text-[13px] text-sub"
          >
            <span className="flex-1">{notice.text}</span>
            {notice.action && (
              <Link href={notice.action.href} className="shrink-0 font-semibold text-accent-text hover:underline">
                {notice.action.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="shrink-0 rounded-full p-1 text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <EffortPanel
          open={effortOpen}
          onClose={() => setEffortOpen(false)}
          value={user.effort}
          onChange={(index) => setUser((prev) => ({ ...prev, effort: index }))}
          onCommit={setEffort}
        />

        {chatEnabled ? (
        <Composer
          inputRef={composerInputRef}
          value={input}
          onChange={setInput}
          onSend={() => void send()}
          onStop={stop}
          sending={sending}
          attachmentsEnabled={features.attachments}
          deepResearchEnabled={features.deepResearch}
          onAttachFiles={() => fileInputRef.current?.click()}
          onTakePhoto={() => photoInputRef.current?.click()}
          onOpenEffort={() => setEffortOpen((v) => !v)}
          effortLabel={effortLabel}
          mode={codeMode ? "code" : "chat"}
          deepResearchOn={deepResearch}
          onToggleDeepResearch={() => setDeepResearch((v) => !v)}
          attachments={attachments.map((a) => ({ id: a.id, name: a.name }))}
          onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
        />
        ) : (
          /* The owner can pause chat. A dead composer would look broken, so the
             field is replaced by a plain statement of what is happening. */
          <div
            role="status"
            className="flex flex-col gap-1 rounded-[22px] border border-hairline bg-control px-4 py-3.5 sm:rounded-[24px]"
          >
            <p className="text-[13.5px] font-semibold text-ink">Chat is paused</p>
            <p className="text-[12.5px] leading-5 text-muted">
              The owner has switched messaging off for now. Your conversations are safe and nothing was lost.
            </p>
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-center gap-2 px-1">
          {features.graceCode && codeMode &&
          !workspaceRepo &&
          workspaceFiles.length === 0 ? (
            <button
              type="button"
              onClick={() => setWorkspaceOpen(true)}
              className="text-[11px] leading-4 text-accent-text/85 hover:text-accent-text"
            >
              Code mode is on · attach a repository
            </button>
          ) : (
            <p className="text-[12px] leading-4 text-muted">{footerNote}</p>
          )}
          {features.graceCode && (codeMode || workspaceRepo || workspaceFiles.length > 0) && (
            <button
              type="button"
              onClick={() => setWorkspaceOpen(true)}
              className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10.5px] text-sub hover:border-hairline-strong hover:text-ink"
            >
              Workspace
              {workspaceFiles.length > 0 && <span className="tabular-nums">{workspaceFiles.length}</span>}
            </button>
          )}
        </div>
      </div>

      {features.attachments && <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.sql,.yml,.yaml"
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.target.value = "";
        }}
      />}
      {features.attachments && <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.target.value = "";
        }}
      />}

      {features.graceCode && <WorkspacePanel
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        conversationId={conversationId}
        repo={workspaceRepo}
        files={workspaceFiles}
        codeMode={codeMode}
        onToggleCodeMode={() => setCodeMode((v) => !v)}
        onChanged={({ repo, files }) => {
          setWorkspaceRepo(repo);
          setWorkspaceFiles(files);
        }}
        onConversation={(id) => {
          setConversationId(id);
          refreshConversations();
        }}
      />}

      <UsageModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        usage={usage}
        showPercentage={user.showCreditPercentage}
        onTogglePercentage={onTogglePercentage}
        onBuyCredits={() => buy("credits")}
        onBuyApex={() => buy("apex")}
        apexEnabled={features.apex}
      />

      <MobileSheet
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeId={conversationId}
        onSelect={(id) => {
          setDrawerOpen(false);
          void openConversation(id);
        }}
        onNew={() => {
          setDrawerOpen(false);
          newChat();
        }}
        onSignOut={() => void signOut()}
        features={features}
        isAdmin={user.isAdmin}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Phone navigation. The desktop sidebar is hidden below md, so this sheet     */
/* carries the same destinations. It is deliberately small: phones get the     */
/* conversation, not a second copy of the whole console.                       */
/* -------------------------------------------------------------------------- */

function MobileSheet({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onSignOut,
  features,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSignOut: () => void;
  features: { projects: boolean; memory: boolean; apex: boolean; graceCode: boolean; attachments: boolean; deepResearch: boolean };
  isAdmin: boolean;
}) {
  const links = [
    ...(features.projects ? [{ href: "/projects", label: "Projects" }] : []),
    { href: "/usage", label: "Usage & limits" },
    ...(features.memory ? [{ href: "/memory", label: "Memory" }] : []),
    { href: "/upcoming", label: "Upcoming" },
    { href: "/connections", label: "Connections" },
    ...(features.apex ? [{ href: "/apex", label: "Apex" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin console" }] : []),
    { href: "/settings", label: "Settings" },
  ];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <div className="animate-fade-in absolute inset-0 bg-black/70" onMouseDown={onClose} aria-hidden="true" />
      <div className="animate-sheet-up relative max-h-[86dvh] overflow-y-auto rounded-t-[26px] border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="text-[15px] font-semibold text-ink">Menu</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-9 w-9 place-items-center rounded-full bg-control text-ink"
          >
            <ArrowDown size={17} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={onNew}
            className="h-11 rounded-full bg-ink text-[14px] font-bold text-black"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="h-11 rounded-full border border-hairline bg-control text-[14px] font-bold text-ink"
          >
            Sign out
          </button>
        </div>
        <div className="px-4 pb-1">
          <div className="grid grid-cols-2 gap-1.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="flex h-10 items-center rounded-[10px] bg-control px-3 text-[13px] text-sub"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="px-4 pb-1 pt-3 text-[11px] font-semibold text-muted">Recent</p>
        <ul className="px-2 pb-3">
          {conversations.slice(0, 20).map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`h-10 w-full truncate rounded-[8px] px-3 text-left text-[13.5px] ${
                  conversation.id === activeId ? "bg-white/[0.09] text-ink" : "text-sub"
                }`}
              >
                {conversation.title}
              </button>
            </li>
          ))}
          {conversations.length === 0 && (
            <li className="px-3 py-2 text-[12.5px] text-muted">Your chats will appear here.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
