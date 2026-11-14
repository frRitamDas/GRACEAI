"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCode2, Loader2, Plus, RotateCw, Trash2, Upload, X } from "lucide-react";

import { GithubMark } from "@/components/grace/github-mark";
import { Overlay } from "@/components/grace/sheet";

export type WorkspaceFileInfo = { path: string; content: string; updatedAt: string };
export type WorkspaceRepo = { owner: string; name: string; branch: string };

type RepoState = {
  connected: boolean;
  account: { login: string; avatarUrl: string | null } | null;
  oauthConfigured: boolean;
  /** Shape returned by /api/github: a display name plus the repo's default branch. */
  repos: {
    owner: string;
    name: string;
    defaultBranch: string;
    private: boolean;
    language: string | null;
    updatedAt: string;
  }[];
};

/**
 * The workspace drawer for a chat.
 *
 * This is where "code mode" becomes concrete: connect GitHub once, attach a
 * repository to *this* conversation, and Grace can read it. Files that the
 * agent writes live here too, so nothing is invisible — you can open one, see
 * what changed, and push what you kept.
 *
 * Push is deliberately manual. An agent that commits on its own is an agent
 * that can push a mistake into a real branch while you are reading the diff.
 */
export function WorkspacePanel({
  open,
  onClose,
  conversationId,
  repo,
  files,
  onChanged,
  onToggleCodeMode,
  onConversation,
  codeMode,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
  repo: WorkspaceRepo | null;
  files: WorkspaceFileInfo[];
  onChanged: (next: { repo: WorkspaceRepo | null; files: WorkspaceFileInfo[] }) => void;
  /** Called with the id of a conversation created to hold a newly attached repo. */
  onConversation: (id: string) => void;
  codeMode: boolean;
  onToggleCodeMode: () => void;
}) {
  const [state, setState] = useState<RepoState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState<{
    count: number;
    url: string | null;
    failed: { path: string; error: string }[];
  } | null>(null);
  // Pushing writes a commit to someone's repository, so it asks first. The
  // panel arms the button and explains what will happen; a second click commits.
  const [confirmPush, setConfirmPush] = useState(false);

  const loadRepos = useCallback(async () => {
    try {
      const response = await fetch("/api/github", { cache: "no-store" });
      if (!response.ok) return;
      setState((await response.json()) as RepoState);
    } catch {
      /* offline: the panel still shows whatever is already attached */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const response = await fetch("/api/github", { cache: "no-store" }).catch(() => null);
      if (!alive || !response?.ok) return;
      setState((await response.json()) as RepoState);
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const attach = async (choice: { owner: string; name: string; branch: string }) => {
    setBusy(`${choice.owner}/${choice.name}`);
    setError(null);
    try {
      // A workspace belongs to a conversation, so a brand-new chat has to have
      // one before a repo can land in it. Creating it here is invisible to the
      // user and saves them from "open a chat first".
      let id = conversationId;
      if (!id) {
        const made = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `${choice.name} workspace` }),
        }).catch(() => null);
        const data = made?.ok
          ? ((await made.json()) as { conversation?: { id: string } })
          : null;
        id = data?.conversation?.id ?? null;
        if (!id) {
          setError("That repository could not be attached. Try again.");
          return;
        }
        onConversation(id);
      }

      const response = await fetch(`/api/workspace/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: choice }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        repo?: WorkspaceRepo | null;
        files?: WorkspaceFileInfo[];
        imported?: number;
        truncated?: boolean;
      };
      if (!response.ok) {
        setError(data.error ?? "That repository could not be read.");
        return;
      }
      onChanged({ repo: data.repo ?? null, files: data.files ?? [] });
      if (!codeMode) onToggleCodeMode();
      setError(
        data.truncated
          ? "This repo is large, so Grace read the first slice. Ask about a specific file if something seems missing."
          : null
      );
    } finally {
      setBusy(null);
    }
  };

  const detach = async () => {
    if (!conversationId) return;
    setBusy("detach");
    try {
      await fetch(`/api/workspace/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: null }),
      });
      onChanged({ repo: null, files: [] });
      setSelectedPath(null);
    } finally {
      setBusy(null);
    }
  };

  const removeFile = async (path: string) => {
    if (!conversationId) return;
    setBusy(`rm:${path}`);
    try {
      await fetch(`/api/workspace/${conversationId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      onChanged({ repo, files: files.filter((f) => f.path !== path) });
      if (selectedPath === path) setSelectedPath(null);
    } finally {
      setBusy(null);
    }
  };

  const addFile = async () => {
    if (!conversationId) return;
    const path = window.prompt("New file path", "notes.md");
    if (!path) return;
    setBusy("new");
    try {
      const response = await fetch(`/api/workspace/${conversationId}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content: "" }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        files?: WorkspaceFileInfo[];
      };
      if (!response.ok) {
        setError(data.error ?? "That file could not be added.");
        return;
      }
      onChanged({ repo, files: data.files ?? files });
      setSelectedPath(path);
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    if (!conversationId || !repo) return;
    setPushing(true);
    setError(null);
    setPushed(null);
    try {
      const response = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        written?: string[];
        failed?: { path: string; error: string }[];
        url?: string | null;
      };
      setConfirmPush(false);
      if (!response.ok) {
        setError(data.error ?? "That push did not go through.");
        return;
      }
      setPushed({
        count: data.written?.length ?? 0,
        url: data.url ?? null,
        failed: data.failed ?? [],
      });
    } finally {
      setPushing(false);
    }
  };

  const filtered = (state?.repos ?? []).filter((r) =>
    `${r.owner}/${r.name}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selected = files.find((f) => f.path === selectedPath) ?? null;

  // Every way out of the drawer disarms a pending push: backdrop, Escape, the
  // close button. Otherwise a second click elsewhere could still commit.
  const close = () => {
    setConfirmPush(false);
    onClose();
  };

  return (
    <Overlay open={open} onClose={close} labelledBy="workspace-title" variant="right">
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/[0.07] bg-white/[0.03]">
            <GithubMark size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="workspace-title" className="text-[14px] font-semibold text-ink">
              Workspace
            </h2>
            <p className="text-[11.5px] leading-4 text-muted">
              {repo
                ? `${repo.owner}/${repo.name} · ${repo.branch}`
                : "No repository attached to this chat"}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close workspace"
            className="press grid h-8 w-8 place-items-center rounded-[9px] text-muted hover:bg-white/[0.06] hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* code mode */}
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
          <button
            type="button"
            onClick={onToggleCodeMode}
            aria-pressed={codeMode}
            className={`flex w-full items-center gap-3 rounded-[12px] border p-3 text-left transition-colors ${
              codeMode
                ? "border-accent/35 bg-accent-soft/50"
                : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]"
            }`}
          >
            <span
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                codeMode ? "bg-accent" : "bg-white/[0.12]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  codeMode ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">
                Let Grace work on code here
              </span>
              <span className="block text-[11.5px] leading-4 text-sub">
                {codeMode
                  ? "Reading and writing this chat's files."
                  : "Off: Grace answers in plain chat and does not touch files."}
              </span>
            </span>
          </button>
        </div>

        {error && (
          <p className="shrink-0 border-b border-white/[0.06] bg-warning/[0.06] px-4 py-2 text-[12px] leading-4 text-warning">
            {error}
          </p>
        )}

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
          {/* files first: they are what the turn actually touched */}
          {files.length > 0 && (
            <section className="border-b border-white/[0.06] px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <p className="flex-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted">
                  Files · {files.length}
                </p>
                <button
                  type="button"
                  onClick={() => void addFile()}
                  disabled={busy !== null || !conversationId}
                  className="press flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-sub hover:bg-white/[0.06] hover:text-ink"
                >
                  <Plus size={11} strokeWidth={2.6} /> Add
                </button>
                {repo && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmPush) {
                        setConfirmPush(true);
                        return;
                      }
                      setConfirmPush(false);
                      void push();
                    }}
                    disabled={pushing}
                    className={`press flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${
                      confirmPush
                        ? "bg-accent text-white"
                        : "bg-white/[0.07] text-ink hover:bg-white/[0.12]"
                    }`}
                  >
                    {pushing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Upload size={10} aria-hidden="true" />
                    )}
                    {pushing ? "Pushing" : confirmPush ? "Confirm" : "Push"}
                  </button>
                )}
              </div>

              {confirmPush && repo && (
                <p className="mb-1.5 rounded-[8px] bg-white/[0.05] px-2 py-1.5 text-[11.5px] leading-4 text-sub">
                  This writes a commit to{" "}
                  <span className="font-mono text-ink">
                    {repo.owner}/{repo.name}
                  </span>{" "}
                  on <span className="font-mono text-ink">{repo.branch}</span>, with only the files
                  changed here.{" "}
                  <button
                    type="button"
                    onClick={() => setConfirmPush(false)}
                    className="underline decoration-dotted hover:text-ink"
                  >
                    Cancel
                  </button>
                </p>
              )}

              {pushed && (
                <div className="mb-1.5 space-y-1">
                  <p className="rounded-[8px] bg-success/10 px-2 py-1.5 text-[11.5px] leading-4 text-success">
                    Pushed {pushed.count} {pushed.count === 1 ? "file" : "files"}
                    {pushed.url ? " to GitHub." : "."}
                  </p>
                  {/* Say which files GitHub refused rather than reporting a flat
                      success: the changed shas stay changed until re-read. */}
                  {pushed.failed.length > 0 && (
                    <p className="rounded-[8px] bg-warning/10 px-2 py-1.5 text-[11.5px] leading-4 text-warning">
                      {pushed.failed.length} not written:{" "}
                      <span className="font-mono">{pushed.failed.map((f) => f.path).join(", ")}</span>
                      . {pushed.failed[0].error}
                    </p>
                  )}
                </div>
              )}

              <ul className="space-y-px">
                {files.map((file) => (
                  <li key={file.path} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedPath(file.path === selectedPath ? null : file.path)}
                      aria-expanded={file.path === selectedPath}
                      className={`flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[7px] px-2 text-left font-mono text-[11.5px] ${
                        file.path === selectedPath
                          ? "bg-white/[0.07] text-ink"
                          : "text-sub hover:bg-white/[0.04] hover:text-ink"
                      }`}
                    >
                      <FileCode2 size={11} className="shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{file.path}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeFile(file.path)}
                      aria-label={`Remove ${file.path}`}
                      className="press grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted opacity-0 hover:bg-white/[0.06] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>

              {selected && (
                <div className="mt-2 overflow-hidden rounded-[10px] border border-white/[0.07]">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">
                      {selected.path}
                    </span>
                    <span className="text-[10.5px] text-muted">
                      {selected.content.split("\n").length} lines
                    </span>
                  </div>
                  <pre className="scroll-quiet max-h-[240px] overflow-auto bg-[#0a0a0c] p-2.5 font-mono text-[11px] leading-[17px] text-sub">
                    {selected.content || "(empty file)"}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* repository */}
          <section className="px-3 py-3">
            <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted">
              {repo ? "Repository" : "Attach a repository"}
            </p>

            {repo ? (
              <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.02] p-2.5">
                <p className="font-mono text-[12px] text-ink">
                  {repo.owner}/{repo.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Branch {repo.branch} · writes stay local until you push
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void detach()}
                    disabled={busy !== null}
                    className="press flex h-7 items-center gap-1 rounded-full border border-white/[0.08] px-2.5 text-[11.5px] text-sub hover:border-white/[0.16] hover:text-ink"
                  >
                    <X size={10} /> Detach
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadRepos()}
                    className="press flex h-7 items-center gap-1 rounded-full border border-white/[0.08] px-2.5 text-[11.5px] text-sub hover:border-white/[0.16] hover:text-ink"
                  >
                    <RotateCw size={10} /> Refresh
                  </button>
                </div>
              </div>
            ) : state && !state.connected ? (
              <ConnectPrompt oauthConfigured={state.oauthConfigured} onConnected={loadRepos} />
            ) : (
              <>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your repositories"
                  className="mb-1.5 h-8 w-full rounded-[8px] border border-white/[0.07] bg-white/[0.03] px-2.5 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-accent/50"
                />
                <ul className="space-y-px">
                  {filtered.slice(0, 40).map((option) => {
                    const busyThis = busy === `${option.owner}/${option.name}`;
                    return (
                      <li key={`${option.owner}/${option.name}`}>
                        <button
                          type="button"
                          onClick={() =>
                            void attach({
                              owner: option.owner,
                              name: option.name,
                              branch: option.defaultBranch || "main",
                            })
                          }
                          disabled={busy !== null}
                          className="press flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left hover:bg-white/[0.05] disabled:opacity-50"
                        >
                          <GithubMark size={12} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] text-ink">
                              {option.name}
                              {option.private && (
                                <span className="ml-1.5 text-[10px] text-muted">private</span>
                              )}
                            </span>
                            <span className="block truncate text-[10.5px] text-muted">
                              {option.owner} · {option.defaultBranch}
                              {option.language ? ` · ${option.language}` : ""}
                            </span>
                          </span>
                          {busyThis && <Loader2 size={12} className="animate-spin text-accent" />}
                        </button>
                      </li>
                    );
                  })}
                  {filtered.length === 0 && (
                    <li className="px-2 py-3 text-[12px] text-muted">
                      {state?.repos.length === 0
                        ? "No repositories on this account yet."
                        : "No repository matches that search."}
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        </div>

        <p className="shrink-0 border-t border-white/[0.06] px-4 py-2.5 text-[11px] leading-4 text-muted">
          Attaching a repo copies its text files into this chat. Grace can read them and write
          back locally; pushing is always your click.
        </p>
      </div>
    </Overlay>
  );
}

function ConnectPrompt({
  oauthConfigured,
  onConnected,
}: {
  oauthConfigured: boolean;
  onConnected: () => void;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    if (!token.trim()) {
      setError("Paste a token first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/github", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "GitHub rejected that token.");
        return;
      }
      setToken("");
      onConnected();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="text-[12.5px] leading-[18px] text-sub">
        Connect a GitHub account to pull a repository into this chat.
      </p>
      {oauthConfigured && (
        <a
          href="/api/github/oauth/start"
          className="press mt-2.5 flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-ink text-[12.5px] font-semibold text-black"
        >
          <GithubMark size={13} /> Connect GitHub
        </a>
      )}
      <label className="mt-2.5 block">
        <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
          Or paste a token
        </span>
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void connect();
          }}
          placeholder="ghp_… or github_pat_…"
          autoComplete="off"
          className="h-8 w-full rounded-[8px] border border-white/[0.07] bg-white/[0.03] px-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-muted focus:border-accent/50"
        />
      </label>
      {error && <p className="mt-1.5 text-[11.5px] leading-4 text-warning">{error}</p>}
      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy}
        className="press mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-white/[0.08] text-[12.5px] font-medium text-ink hover:border-white/[0.16] disabled:opacity-50"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        Save token
      </button>
      <p className="mt-2 text-[10.5px] leading-4 text-muted">
        A fine-grained token needs <span className="font-mono">Contents: Read and write</span>.
      </p>
    </div>
  );
}
