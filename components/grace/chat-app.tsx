"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

import { Composer } from "@/components/grace/composer";
import { Drawer, type ConversationSummary } from "@/components/grace/drawer";
import { EffortSheet } from "@/components/grace/effort-sheet";
import { Greeting } from "@/components/grace/greeting";
import { Header } from "@/components/grace/header";
import { MessageRow, ScrollToBottom, type ChatMessage } from "@/components/grace/message";
import { ModelSheet, type CatalogModel } from "@/components/grace/model-sheet";
import { SideRail } from "@/components/grace/side-rail";
import { UsageModal, type UsageData } from "@/components/grace/usage-modal";
import { EFFORT_LEVELS, type ProviderId } from "@/lib/ai/catalog";
import type { AttachmentView, SessionUserView } from "@/lib/client/types";

type Props = {
  initialUser: SessionUserView;
  initialUsage: UsageData;
  initialConversations: ConversationSummary[];
  initialModels: CatalogModel[];
  anyConfigured: boolean;
};

type StreamMeta = {
  conversationId: string;
  model: { id: string; name: string; provider: ProviderId; providerLabel: string };
  cost: number;
};

function firstName(name: string, email: string) {
  const first = name.trim().split(/\s+/)[0];
  if (first) return first;
  const local = email.split("@")[0]?.replace(/[^a-zA-Z]/g, " ") ?? "";
  const word = local.trim().split(/\s+/)[0];
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "there";
}

export function ChatApp({ initialUser, initialUsage, initialConversations, initialModels, anyConfigured }: Props) {
  const router = useRouter();

  const [user, setUser] = useState(initialUser);
  const [usage, setUsage] = useState(initialUsage);
  const [models, setModels] = useState(initialModels);
  const [providerReady, setProviderReady] = useState(anyConfigured);
  const [conversations, setConversations] = useState(initialConversations);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentView[]>([]);
  const [sending, setSending] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(initialUser.model);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; action?: { label: string; href: string } } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const refreshModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { models: CatalogModel[]; anyConfigured: boolean };
      setModels(data.models);
      setProviderReady(data.anyConfigured);
    } catch {
      /* keep the bundled catalog */
    }
  }, []);

  // A key added in the admin console unlocks the composer without a reload.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/models", { cache: "no-store" });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as { models: CatalogModel[]; anyConfigured: boolean };
        setModels(data.models);
        setProviderReady(data.anyConfigured);
      } catch {
        /* the server render already told us */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { conversations: ConversationSummary[] };
      setConversations(data.conversations);
    } catch {
      /* keep the last list */
    }
  }, []);

  // Keep scroll pinned while streaming, unless the user scrolled up.
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

  // ------------------------------------------------------------------ send
  const send = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if ((!text && attachments.length === 0) || sending) return;

      if (!providerReady) {
        // Same rule as the empty state: only the owner is told where a key goes.
        setNotice(
          user.isAdmin
            ? {
                text: "No provider is connected yet, so there is nothing to send to.",
                action: { label: "Open the console", href: "/admin" },
              }
            : { text: "Grace is not connected yet. The owner needs to enable a provider." }
        );
        return;
      }

      setNotice(null);
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
      let meta: StreamMeta | null = null;
      let accumulated = "";
      let streamError = false;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId,
            message: text,
            attachments: outbound.map((a) => ({
              name: a.name,
              mime: a.mime,
              text: a.text,
              dataUrl: a.mime.startsWith("image/") ? a.dataUrl : undefined,
            })),
            effort: user.effort,
            model: selectedModel,
            deepResearch,
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
              meta = event as unknown as StreamMeta;
              setConversationId(meta.conversationId);
              if (!conversationId) refreshConversations();
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `${optimisticId}-reply`
                    ? {
                        ...m,
                        modelName: meta!.model.name,
                        providerLabel: meta!.model.providerLabel,
                      }
                    : m
                )
              );
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
            if (event.type === "saved") {
              refreshUsage();
            }
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
      refreshConversations,
      refreshUsage,
      selectedModel,
      sending,
      user.effort,
    ]
  );

  const stop = () => {
    abortRef.current?.abort();
    setSending(false);
  };

  /**
   * Regenerate drops the trailing assistant turn (answer or error) and asks
   * again with the same prompt. The user's message stays where it is.
   */
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
    // Drop the user turn too: send() re-adds it optimistically.
    trimmed = trimmed.slice(0, -1);
    setMessages(trimmed);
    void send(prompt);
  }, [messages, send, sending]);

  // --------------------------------------------------------------- uploads
  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = Math.max(0, 6 - attachments.length);
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

  // ----------------------------------------------------------- conversations
  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setInput("");
    setAttachments([]);
    setNotice(null);
    setSending(false);
  };

  const openConversation = async (id: string) => {
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
          modelName: string | null;
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
            modelName: m.modelName,
            attachments: m.attachments as { name: string; mime: string }[],
            error: m.error,
          }))
      );
      setNotice(null);
      stickToBottom.current = true;
      requestAnimationFrame(() => scrollToBottom("auto"));
    } catch {
      setNotice({ text: "That chat could not be opened." });
    }
  };

  const deleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) newChat();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/");
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

  const pickModel = (id: string) => {
    setSelectedModel(id);
    void persistSettings({ model: id });
  };

  const buying = (kind: "credits" | "apex") => {
    // Billing is the next milestone; say so instead of pretending.
    setNotice({
      text:
        kind === "apex"
          ? "Apex checkout is not wired to a payment provider yet."
          : "Credit checkout is not wired to a payment provider yet.",
    });
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-black">
      {/* Wide screens get a real rail; the drawer below covers phones. */}
      <SideRail
        user={user}
        conversations={conversations}
        activeId={conversationId}
        onSelect={(id) => void openConversation(id)}
        onNew={newChat}
        onDelete={(id) => void deleteConversation(id)}
        onSignOut={() => void signOut()}
      />

      <div className="relative mx-auto flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden bg-black">
      <Header
        remainingPct={usage.remainingPct}
        onMenu={() => setDrawerOpen(true)}
        onUsage={() => setUsageOpen(true)}
        subtitle={
          selectedModel
            ? (models.find((m) => m.id === selectedModel)?.name ?? "Auto")
            : "Auto model"
        }
      />

      <main
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-quiet relative z-0 flex-1 overflow-y-auto overscroll-contain px-4 lg:px-8"
        aria-live="off"
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 pb-16 pt-4">
            <Greeting name={greetingName} />
            {!providerReady && (
              // Keys are deployment-wide, so this tells people what is missing
              // and, only for the owner, where to fix it. A regular account is
              // pointed at the owner rather than an input it cannot use.
              <p className="mt-5 flex max-w-[min(100%,26rem)] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-[16px] border border-hairline bg-surface px-3.5 py-2 text-center text-[13px] leading-5 text-sub">
                <Sparkles size={14} className="shrink-0 text-accent" aria-hidden="true" />
                {user.isAdmin ? (
                  <>
                    Add a provider key in{" "}
                    <Link href="/admin" className="font-bold text-accent-text hover:underline">
                      the admin console
                    </Link>{" "}
                    to start chatting
                  </>
                ) : (
                  "Grace is not connected yet. The owner needs to enable a provider."
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 pb-4 pt-1">
            {messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                onRetry={regenerate}
                isLast={index === messages.length - 1}
              />
            ))}
          </div>
        )}
      </main>

      {showJump && !empty && <ScrollToBottom onClick={() => scrollToBottom()} />}

      <div className="relative z-10 mx-auto w-full max-w-[720px] shrink-0 bg-black px-4 pb-2 pt-2 lg:px-0">
        {notice && (
          <div
            role="status"
            className="animate-fade-in mb-2 flex items-center gap-2 rounded-[16px] border border-hairline bg-surface px-3.5 py-2.5 text-[14px] text-sub"
          >
            <span className="flex-1">{notice.text}</span>
            {notice.action && (
              <Link href={notice.action.href} className="shrink-0 font-bold text-accent-text hover:underline">
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
        <EffortSheet
          open={effortOpen}
          onClose={() => setEffortOpen(false)}
          value={user.effort}
          modelName={
            selectedModel
              ? models.find((m) => m.id === selectedModel)?.name ?? null
              : null
          }
          onChange={(index) => setUser((prev) => ({ ...prev, effort: index }))}
          onCommit={setEffort}
          onOpenModels={() => {
            setEffortOpen(false);
            setModelOpen(true);
          }}
        />
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void send()}
          onStop={stop}
          sending={sending}
          onAttachFiles={() => fileInputRef.current?.click()}
          onTakePhoto={() => photoInputRef.current?.click()}
          onOpenEffort={() => setEffortOpen((v) => !v)}
          onOpenModels={() => setModelOpen(true)}
          effortLabel={effortLabel}
          deepResearchOn={deepResearch}
          onToggleDeepResearch={() => setDeepResearch((v) => !v)}
          attachments={attachments.map((a) => ({ id: a.id, name: a.name }))}
          onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          menuOpen={menuOpen}
          onMenuOpenChange={setMenuOpen}
        />
        <p className="mt-2 pb-[env(safe-area-inset-bottom)] text-center text-[14px] leading-5 text-muted">
          Grace can make mistakes.
        </p>
      </div>

      </div>

      <input
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
      />
      <input
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
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        conversations={conversations}
        activeId={conversationId}
        onSelect={(id) => void openConversation(id)}
        onNew={newChat}
        onDelete={(id) => void deleteConversation(id)}
        onSignOut={() => void signOut()}
        onOpenUsage={() => setUsageOpen(true)}
      />

      <UsageModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        usage={usage}
        showPercentage={user.showCreditPercentage}
        onTogglePercentage={onTogglePercentage}
        onBuyCredits={() => buying("credits")}
        onBuyApex={() => buying("apex")}
      />

      <ModelSheet
        open={modelOpen}
        onClose={() => setModelOpen(false)}
        models={models}
        selected={selectedModel}
        onSelect={pickModel}
        anyConfigured={providerReady}
        isAdmin={user.isAdmin}
      />

      {/* Refresh the catalog when Settings changes a key and the tab returns. */}
      <VisibilityRefresh onVisible={() => {
        void refreshModels();
        void refreshUsage();
      }} />
    </div>
  );
}

function VisibilityRefresh({ onVisible }: { onVisible: () => void }) {
  const saved = useRef(onVisible);
  useEffect(() => {
    saved.current = onVisible;
  }, [onVisible]);
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") saved.current();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return null;
}
