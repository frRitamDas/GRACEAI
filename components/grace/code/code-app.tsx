"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Code2,
  FolderPlus,
  Loader2,
  MessagesSquare,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { CodeViewer, EmptyViewer } from "@/components/grace/code/code-viewer";
import { FileTree } from "@/components/grace/code/file-tree";
import { GithubSheet } from "@/components/grace/code/github-sheet";
import { GithubMark } from "@/components/grace/github-mark";
import { GraceMark } from "@/components/grace/logo";
import { ModelSheet, type CatalogModel } from "@/components/grace/model-sheet";
import type { CodeMessage, Project, ProjectFile } from "@/lib/code/store";

/**
 * Grace Code: a coding workspace, not a chat window with code in it.
 *
 * Three panels on a desktop — files, conversation, editor — because that is the
 * shape of the job: you look at what exists, say what should change, and read
 * the result. On a phone the panels become tabs rather than stacking, since a
 * 300px editor under a 300px chat is worse than either alone.
 */

type Props = {
  initialProjects: Project[];
  initialModels: CatalogModel[];
  userModel: string | null;
};

type Panel = "chat" | "files" | "editor";

const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "html", label: "HTML / CSS" },
  { id: "go", label: "Go" },
];

export function CodeApp({ initialProjects, initialModels, userModel }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [project, setProject] = useState<Project | null>(initialProjects[0] ?? null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("chat");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [touched, setTouched] = useState<string[]>([]);
  // A file the *user* opened. Only that one is worth telling the model to read
  // first — a file the project happened to load is not a decision.
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [pushing, setPushing] = useState(false);

  // Model choice is per session, like chat: pick once and every turn after uses
  // it. Auto means "let Grace pick the strongest coding model available".
  const [models] = useState<CatalogModel[]>(initialModels);
  const [model, setModel] = useState<string | null>(userModel);
  const [modelsOpen, setModelsOpen] = useState(false);

  // The OAuth callback returns to /code?github=…; the sheet was unmounted while
  // the browser was away on github.com, so reopen it and explain the result.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("github");
    if (!result) return;
    window.history.replaceState({}, "", "/code");
    const reasons: Record<string, string> = {
      denied: "GitHub access was declined. Nothing was changed.",
      state: "That sign-in did not come from this browser. Try connecting again.",
      unreachable: "GitHub could not be reached. Try again in a moment.",
      unavailable: "GitHub OAuth is not configured on this deployment. Paste a token instead.",
      failed: "GitHub could not finish the connection. Try again, or paste a token.",
    };
    // Deferred a tick so the first paint is not interrupted by a state update,
    // which is also what the lint rule asks for.
    const timer = window.setTimeout(() => {
      setGithubOpen(true);
      setNotice(
        result === "connected" || result === "imported"
          ? "GitHub connected. Pick a repository to import."
          : (reasons[result] ?? "GitHub could not finish the connection.")
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openFile = useMemo(
    () => files.find((f) => f.path === openPath) ?? null,
    [files, openPath]
  );

  /** Loads one project's files and transcript. */
  const loadProject = useCallback(async (id: string, keepOpen?: string | null) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/code/projects/${id}`, { cache: "no-store" });
      if (!response.ok) {
        setNotice("That project could not be opened.");
        return;
      }
      const data = (await response.json()) as {
        project: Project;
        files: ProjectFile[];
        messages: CodeMessage[];
      };
      setProject(data.project);
      setFiles(data.files);
      setMessages(data.messages);
      // Respect an explicit selection (the file the agent changed), otherwise
      // keep whatever was open, otherwise open the first file.
      setOpenPath((previous) => {
        const wanted = keepOpen ?? previous;
        if (wanted && data.files.some((f) => f.path === wanted)) return wanted;
        return data.files[0]?.path ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    void (async () => {
      await loadProject(activeId);
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [activeId, loadProject]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Follow the tail of the conversation while the agent writes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, liveText]);

  const createProject = async (name: string, language: string) => {
    setCreating(false);
    const response = await fetch("/api/code/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, language }),
    });
    if (!response.ok) {
      setNotice("That project could not be created.");
      return;
    }
    const data = (await response.json()) as { project: Project };
    setProjects((prev) => [data.project, ...prev]);
    setActiveId(data.project.id);
    setProject(data.project);
    setMessages([]);
    setOpenPath(null);
    setPanel("chat");
  };

  const deleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (id === activeId) {
      const next = projects.find((p) => p.id !== id) ?? null;
      setActiveId(next?.id ?? null);
      setProject(next);
      setFiles([]);
      setMessages([]);
      setOpenPath(null);
    }
    await fetch(`/api/code/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
      () => undefined
    );
  };

  /** Direct file writes from the editor and the tree, without a model turn. */
  const patchFile = async (file: { path: string; content?: string; remove?: boolean }) => {
    if (!project) return;
    const response = await fetch(`/api/code/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    });
    if (!response.ok) {
      setNotice("That file change did not save.");
      return;
    }
    const data = (await response.json()) as { files: ProjectFile[]; messages: CodeMessage[] };
    setFiles(data.files);
    if (file.remove && openPath === file.path) setOpenPath(data.files[0]?.path ?? null);
  };

  /** Commits the files the last turn touched to the linked repository. */
  const pushToGithub = async () => {
    if (!project?.repo || touched.length === 0) return;
    setPushing(true);
    try {
      const response = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, paths: touched }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        written?: string[];
      };
      if (!response.ok) {
        setNotice(data.error ?? "That push did not go through.");
        return;
      }
      const count = data.written?.length ?? 0;
      setNotice(
        `Pushed ${count} file${count === 1 ? "" : "s"} to ${project.repo.owner}/${project.repo.name}.`
      );
      setTouched([]);
    } finally {
      setPushing(false);
    }
  };

  const saveInstructions = async (instructions: string) => {
    if (!project) return;
    setProject({ ...project, instructions });
    await fetch(`/api/code/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions }),
    }).catch(() => undefined);
  };

  const stop = () => abortRef.current?.abort();

  /** One agent turn: POST, read NDJSON, apply the result. */
  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !project) return;

    setInput("");
    setStreaming(true);
    setLiveText("");
    setStatus("Reading the project");
    setPanel("chat");
    setMessages((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        projectId: project.id,
        role: "user",
        content: text,
        touched: [],
        createdAt: new Date().toISOString(),
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/code/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          message: text,
          model,
          focus: pickedPath,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setNotice(data.error ?? "Grace Code could not start that turn.");
        setStreaming(false);
        setStatus(null);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            try {
              const event = JSON.parse(line) as Record<string, unknown>;
              if (event.type === "status") setStatus(String(event.label ?? ""));
              if (event.type === "delta") {
                accumulated += String(event.text ?? "");
                setLiveText(accumulated);
              }
              if (event.type === "done") {
                const message = event.message as CodeMessage;
                setMessages((prev) => [...prev, message]);
                setTouched(Array.isArray(event.applied) ? (event.applied as string[]) : []);
                setLiveText("");
                setStatus(null);
                // A turn that wrote files should land you on one of them.
                const applied = (event.applied as string[]) ?? [];
                if (applied.length > 0) {
                  setOpenPath(applied[0]);
                  void loadProject(project.id, applied[0]);
                }
              }
              if (event.type === "error") {
                setNotice(String(event.message ?? "That turn failed."));
                setStatus(null);
                setLiveText("");
              }
            } catch {
              // A malformed line is not worth failing the whole reply over.
            }
          }
          newline = buffer.indexOf("\n");
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setNotice("The connection dropped mid-turn.");
      }
      setStatus(null);
      setLiveText("");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };


  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg text-ink">
      {/* ---------------------------------------------------------------- top */}
      <header className="glass-bar relative z-20 flex h-[52px] shrink-0 items-center gap-1.5 border-b border-hairline px-2 sm:gap-2 sm:px-3">
        <Link
          href="/"
          aria-label="Back to chat"
          title="Back to chat"
          className="press grid h-8 w-8 shrink-0 place-items-center rounded-[7px] text-sub transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <ArrowLeft size={16} />
        </Link>

        <span className="flex shrink-0 items-center gap-1.5">
          <Code2 size={14} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="hidden text-[13.5px] font-semibold tracking-[-0.01em] xs:inline">
            Grace Code
          </span>
        </span>

        {project && (
          <span className="hidden min-w-0 items-center gap-1.5 truncate text-[12px] text-muted sm:flex">
            <span aria-hidden="true" className="text-white/15">/</span>
            <span className="truncate">{project.name}</span>
            {streaming && (
              <span className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-text">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                working
              </span>
            )}
          </span>
        )}

        <div className="ml-auto flex min-w-0 items-center gap-1">
          <ProjectPicker
            projects={projects}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setOpenPath(null);
              setTouched([]);
              setMessages([]);
            }}
            onDelete={deleteProject}
          />
          <button
            type="button"
            onClick={() => setGithubOpen(true)}
            aria-label="GitHub"
            title="GitHub"
            className="press grid h-8 w-8 shrink-0 place-items-center rounded-[7px] text-sub transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <GithubMark size={14} />
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="press flex h-8 items-center gap-1.5 rounded-[7px] bg-ink px-2.5 text-[12px] font-semibold text-black"
          >
            <FolderPlus size={13} strokeWidth={2.6} aria-hidden="true" />
            <span className="hidden xs:inline">New</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            aria-pressed={showSettings}
            aria-label="Project settings"
            title="Project settings"
            className={`press grid h-8 w-8 place-items-center rounded-[7px] transition-colors ${
              showSettings ? "bg-white/[0.09] text-ink" : "text-sub hover:bg-white/[0.06] hover:text-ink"
            }`}
          >
            <Settings2 size={14} />
          </button>
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className="animate-fade-in flex shrink-0 items-center gap-2 border-b border-hairline bg-surface px-4 py-1.5 text-[12.5px] text-sub"
        >
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="rounded-full p-1 text-muted hover:text-ink"
          >
            <X size={13} />
          </button>
        </p>
      )}

      {/* --------------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        {projects.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <>
            {/* files — a rail on desktop, a tab on a phone */}
            <aside
              aria-label="Project files"
              className={`min-h-0 w-full shrink-0 flex-col border-r border-hairline bg-panel lg:flex lg:w-[228px] ${
                panel === "files" ? "flex" : "hidden"
              }`}
            >
              <FileTree
                files={files}
                activePath={openPath}
                touched={touched}
                onOpen={(path) => {
                  setOpenPath(path);
                  setPickedPath(path);
                  setPanel("editor");
                }}
                onDelete={(path) => void patchFile({ path, remove: true })}
                onNewFile={() => {
                  const name = window.prompt("New file path", "src/new-file.js");
                  if (name) void patchFile({ path: name, content: "" });
                }}
              />
            </aside>

            {/* conversation */}
            <section
              aria-label="Conversation"
              className={`min-h-0 flex-1 flex-col border-r border-hairline lg:flex lg:w-[420px] lg:flex-none xl:w-[460px] ${
                panel === "chat" ? "flex" : "hidden"
              }`}
            >
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-hairline px-3">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <MessagesSquare size={11} aria-hidden="true" />
                  Session
                </span>
                {messages.length > 0 && (
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-sub">
                    {messages.length}
                  </span>
                )}
                <span className="ml-auto truncate text-[10.5px] text-muted">
                  {files.length} file{files.length === 1 ? "" : "s"} in context
                </span>
              </div>

              <div ref={scrollRef} className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {loading && (
                  <p className="flex items-center gap-2 text-[13px] text-sub">
                    <Loader2 size={14} className="animate-spin" /> Opening project
                  </p>
                )}

                {!loading && messages.length === 0 && (
                  <div className="animate-fade-up flex flex-col items-start pt-5">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] border border-hairline bg-surface">
                      <GraceMark className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink">
                      What are we building?
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-sub">
                      Grace reads every file in {project?.name ?? "this project"} and writes the
                      changes back. Ask for a feature, a fix, or an explanation.
                    </p>
                    <div className="mt-3.5 flex w-full flex-col gap-1.5">
                      {[
                        "Explain what this project does",
                        "Add error handling to the entry point",
                        "Add a README with setup steps",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setInput(prompt)}
                          className="surface surface-hover flex h-9 items-center gap-2 px-2.5 text-left text-[12.5px] text-sub hover:text-ink"
                        >
                          <span className="text-muted" aria-hidden="true">↗</span>
                          <span className="truncate">{prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <ul className="space-y-4">
                  {messages.map((message) => (
                    <CodeBubble key={message.id} message={message} onOpen={setOpenPath} />
                  ))}
                </ul>

                {streaming && (
                  <div className="mt-4">
                    {status && (
                      <p className="flex items-center gap-2 text-[12.5px] text-accent-text">
                        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        {status}…
                      </p>
                    )}
                    {liveText && (
                      <pre className="scroll-quiet mt-2 max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[18px] text-sub">
                        {liveText}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-hairline bg-panel/60 px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm">
                {pickedPath && (
                  <p className="mb-1.5 flex items-center gap-1.5 px-1.5 text-[10.5px] text-muted">
                    <Code2 size={10} aria-hidden="true" />
                    <span className="truncate font-mono text-sub">{pickedPath}</span>
                    <button
                      type="button"
                      onClick={() => setPickedPath(null)}
                      className="shrink-0 underline decoration-dotted hover:text-ink"
                    >
                      clear
                    </button>
                  </p>
                )}
                <div className="flex items-end gap-1.5 rounded-[18px] border border-hairline bg-surface px-1.5 py-1.5 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] transition-colors focus-within:border-[#3A3A3F]">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    rows={1}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Describe a change"
                    aria-label="Describe a change"
                    className="scroll-quiet max-h-[140px] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-[14.5px] leading-[22px] text-ink outline-none placeholder:text-muted"
                  />
                  {streaming ? (
                    <button
                      type="button"
                      onClick={stop}
                      aria-label="Stop"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-black"
                    >
                      <Square size={14} fill="currentColor" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={!input.trim()}
                      aria-label="Send"
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                        input.trim() ? "bg-ink text-black" : "bg-disabled text-muted"
                      }`}
                    >
                      <ArrowUp size={17} strokeWidth={2.6} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 px-0.5">
                  <button
                    type="button"
                    onClick={() => setModelsOpen(true)}
                    className="press flex h-6 items-center gap-1 rounded-full border border-hairline bg-control px-2 text-[11px] font-medium text-sub transition-colors hover:border-[#333338] hover:text-ink"
                    aria-label={`Model: ${model ? (models.find((m) => m.id === model)?.name ?? model) : "Auto"}`}
                  >
                    <Sparkles size={10} className="text-accent" aria-hidden="true" />
                    <span className="max-w-[150px] truncate">
                      {model ? (models.find((m) => m.id === model)?.name ?? model) : "Auto"}
                    </span>
                  </button>
                  <span className="min-w-0 flex-1 truncate text-right text-[10.5px] leading-4 text-muted">
                    Files are replaced whole. Review what changed.
                  </span>
                </div>
              </div>
            </section>

            {/* editor */}
            <section
              aria-label="File contents"
              className={`min-h-0 flex-1 flex-col bg-bg lg:flex ${
                panel === "editor" ? "flex" : "hidden"
              }`}
            >
              {project?.repo && (
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-hairline bg-panel px-3">
                  <GithubMark size={12} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-sub">
                    {project.repo.owner}/{project.repo.name}
                    <span className="text-muted"> · {project.repo.branch}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void pushToGithub()}
                    disabled={pushing || touched.length === 0}
                    className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-white/[0.12] disabled:opacity-40"
                  >
                    {pushing ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Upload size={11} aria-hidden="true" />
                    )}
                    {touched.length > 0 ? `Push ${touched.length}` : "Push"}
                  </button>
                </div>
              )}

              {showSettings && project ? (
                <ProjectSettings
                  project={project}
                  onClose={() => setShowSettings(false)}
                  onChange={saveInstructions}
                />
              ) : openFile ? (
                <CodeViewer
                  path={openFile.path}
                  content={openFile.content}
                  onSave={(next) => void patchFile({ path: openFile.path, content: next })}
                />
              ) : (
                <EmptyViewer />
              )}
            </section>
          </>
        )}
      </div>

      {/* phone tabs */}
      {projects.length > 0 && (
        <nav
          aria-label="Workspace panels"
          className="glass-bar grid h-[52px] shrink-0 grid-cols-3 border-t border-hairline pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {(
            [
              ["files", "Files", FolderPlus],
              ["chat", "Grace", MessagesSquare],
              ["editor", "Code", Code2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              aria-pressed={panel === id}
              className={`flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors ${
                panel === id ? "text-ink" : "text-muted"
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      )}

      {creating && (
        <NewProjectDialog onCancel={() => setCreating(false)} onCreate={createProject} />
      )}

      <ModelSheet
        open={modelsOpen}
        onClose={() => setModelsOpen(false)}
        models={models}
        selected={model}
        onSelect={(id) => {
          setModel(id);
          setModelsOpen(false);
        }}
        anyConfigured={models.some((m) => m.available)}
        isAdmin={false}
      />

      <GithubSheet
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        onImported={(id) => {
          setActiveId(id);
          setNotice("Repository imported. Grace can read every file in it.");
        }}
      />
    </div>
  );
}

/** Projects are a popover, not a page: switching is a small act. */
function ProjectPicker({
  projects,
  activeId,
  onSelect,
  onDelete,
}: {
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = projects.find((p) => p.id === activeId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 max-w-[42vw] items-center gap-1.5 rounded-full border border-hairline px-3 text-[12.5px] text-sub transition-colors hover:text-ink sm:max-w-[220px]"
      >
        <span className="truncate">{active?.name ?? "No project"}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onMouseDown={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-10 z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
          >
            <ul className="scroll-quiet max-h-[280px] overflow-y-auto p-1">
              {projects.map((project) => (
                <li key={project.id} className="group relative">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(project.id);
                      setOpen(false);
                    }}
                    className={`flex h-9 w-full items-center rounded-[8px] px-2.5 pr-8 text-left text-[13px] ${
                      project.id === activeId ? "bg-raised text-ink" : "text-sub hover:bg-[#1F1F22]"
                    }`}
                  >
                    <span className="truncate">{project.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(project.id)}
                    aria-label={`Delete ${project.name}`}
                    className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={11} />
                  </button>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="px-2.5 py-2 text-[12.5px] text-muted">No projects yet.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Renders the agent's prose with inline code and fenced blocks handled.
 *
 * The model writes Markdown whether or not it is asked to, and literal
 * backticks in a chat bubble look like a bug. This is deliberately small: no
 * full Markdown parser, just the two constructs that actually appear.
 */
function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const blocks = text.split(/```[^\n`]*\n([\s\S]*?)```/g);

  blocks.forEach((part, index) => {
    // Odd indices are fenced bodies, which stay monospaced and scroll.
    if (index % 2 === 1) {
      parts.push(
        <pre
          key={`b${index}`}
          className="scroll-quiet my-2 overflow-x-auto rounded-[10px] border border-hairline bg-control p-2.5 font-mono text-[11.5px] leading-[18px] text-sub"
        >
          {part.replace(/\n$/, "")}
        </pre>
      );
      return;
    }
    const inline = part.split(/(`[^`]+`)/g);
    parts.push(
      <span key={`t${index}`}>
        {inline.map((chunk, chunkIndex) =>
          chunk.startsWith("`") && chunk.endsWith("`") && chunk.length > 2 ? (
            <code
              key={chunkIndex}
              className="rounded-[4px] bg-control px-1 py-0.5 font-mono text-[12px] text-accent-text"
            >
              {chunk.slice(1, -1)}
            </code>
          ) : (
            <span key={chunkIndex}>{chunk}</span>
          )
        )}
      </span>
    );
  });

  return <p className="whitespace-pre-wrap break-words">{parts}</p>;
}

/** One message in the transcript. */
function CodeBubble({
  message,
  onOpen,
}: {
  message: CodeMessage;
  onOpen: (path: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <li className={isUser ? "flex justify-end" : ""}>
      <div className={isUser ? "max-w-[86%]" : "w-full"}>
        {!isUser && (
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <GraceMark className="h-3 w-3" />
            Grace
          </p>
        )}
        <div
          className={
            isUser
              ? "rounded-[14px] rounded-br-[5px] bg-[#1d1d22] px-3 py-2 text-[13.5px] leading-[21px] text-ink"
              : "text-[14px] leading-[22px] text-ink"
          }
        >
          <RichText text={message.content} />
        </div>
        {message.touched.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.touched.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => onOpen(path)}
                className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[11px] text-accent-text transition-opacity hover:opacity-80"
              >
                <Check size={10} strokeWidth={3} aria-hidden="true" />
                {path}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function ProjectSettings({
  project,
  onClose,
  onChange,
}: {
  project: Project;
  onClose: () => void;
  onChange: (instructions: string) => void;
}) {
  const [draft, setDraft] = useState(project.instructions);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <p className="text-[12px] font-semibold text-sub">Project instructions</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-control hover:text-ink"
        >
          <X size={13} />
        </button>
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-[12.5px] leading-4 text-muted">
          Standing rules for {project.name}. Grace reads these on every turn — house style, a
          framework it should not reach for, a file that must not change.
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Use TypeScript strict mode. Never edit migrations."
          className="h-[180px] w-full resize-none rounded-[12px] border border-hairline bg-control p-3 text-[13px] leading-5 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="button"
          onClick={() => {
            onChange(draft);
            onClose();
          }}
          className="mt-2 h-9 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black"
        >
          Save instructions
        </button>
      </div>
    </div>
  );
}

function NewProjectDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string, language: string) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("javascript");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" onMouseDown={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="relative w-full max-w-[380px] rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
      >
        <h2 id="new-project-title" className="text-[17px] font-semibold text-ink">
          New project
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-sub">
          Grace will scaffold a few starter files. You can delete them.
        </p>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11.5px] font-medium text-muted">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Weather CLI"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim()) onCreate(name, language);
            }}
            className="h-10 w-full rounded-[10px] border border-hairline bg-control px-3 text-[14px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
        </label>

        <p className="mb-1 mt-3 text-[11.5px] font-medium text-muted">Language</p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLanguage(option.id)}
              aria-pressed={language === option.id}
              className={`h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                language === option.id
                  ? "bg-ink text-black"
                  : "bg-control text-sub hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full px-3.5 text-[13px] font-medium text-sub hover:bg-control hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate(name.trim() || "Untitled project", language)}
            className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-black"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-[18px] border border-hairline bg-control">
        <Code2 size={24} className="text-accent" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.02em] text-ink">Grace Code</h1>
      <p className="mt-2 max-w-[26rem] text-[14px] leading-[22px] text-sub">
        A project is a set of files Grace can read and rewrite. Start one, describe the change, and
        read the result — every file it touches opens for you.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-black"
      >
        <Plus size={16} strokeWidth={3} aria-hidden="true" />
        Create a project
      </button>
    </div>
  );
}
