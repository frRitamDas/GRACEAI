"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Lock, Search, Upload } from "lucide-react";

import { GithubMark } from "@/components/grace/github-mark";

/**
 * GitHub, inside Grace Code.
 *
 * Two states, because they are different jobs: connecting an account, and
 * choosing what to work on. The connect panel explains both routes (OAuth when
 * the deployment has an app, a token otherwise) rather than showing a button
 * that cannot work.
 */

type Account = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  scopes: string[];
  connectedAt: string;
};

type Repo = {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  updatedAt: string;
  language: string | null;
};

type State = {
  connected: boolean;
  account: Account | null;
  oauthConfigured: boolean;
  repos: Repo[];
};

export function GithubSheet({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (projectId: string, name: string) => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/github", { cache: "no-store" });
    if (response.ok) setState((await response.json()) as State);
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const response = await fetch("/api/github", { cache: "no-store" });
      if (!alive || !response.ok) return;
      setState((await response.json()) as State);
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const connect = async () => {
    setError(null);
    setBusy("connect");
    try {
      const response = await fetch("/api/github", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "GitHub rejected that token.");
        return;
      }
      setToken("");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await fetch("/api/github", { method: "DELETE" });
      setState({ connected: false, account: null, oauthConfigured: false, repos: [] });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const importRepo = async (repo: Repo) => {
    setError(null);
    setImporting(repo.fullName);
    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          branch: repo.defaultBranch,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        project?: { id: string; name: string };
      };
      if (!response.ok || !data.project) {
        setError(data.error ?? "That repository could not be imported.");
        return;
      }
      onImported(data.project.id, data.project.name);
      onClose();
    } finally {
      setImporting(null);
    }
  };

  const repos = (state?.repos ?? []).filter((repo) =>
    query.trim()
      ? repo.fullName.toLowerCase().includes(query.trim().toLowerCase())
      : true
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="github-title"
        className="float-panel animate-sheet-up relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[24px] sm:max-w-[520px] sm:rounded-[24px]"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5">
            <GithubMark size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="github-title" className="text-[15px] font-semibold leading-5 text-ink">
              {state?.connected ? state.account?.login : "Connect GitHub"}
            </h2>
            <p className="truncate text-[12px] leading-4 text-muted">
              {state?.connected
                ? "Pick a repository to open in Grace Code"
                : "Grace can read a repo and commit changes back"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2.5 py-1 text-[12.5px] font-medium text-sub hover:bg-white/5 hover:text-ink"
          >
            Close
          </button>
        </div>

        {error && (
          <p role="alert" className="mx-4 mt-3 rounded-[10px] border border-[#5A2A2A] bg-[#2A1618] px-3 py-2 text-[12.5px] leading-4 text-[#F0A0A0]">
            {error}
          </p>
        )}

        {!state ? (
          <p className="flex items-center justify-center gap-2 py-12 text-[13px] text-sub">
            <Loader2 size={14} className="animate-spin" /> Checking GitHub
          </p>
        ) : !state.connected ? (
          <div className="scroll-quiet overflow-y-auto p-4">
            {state.oauthConfigured && (
              <a
                href="/api/github/oauth/start"
                className="mb-3 flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-semibold text-black"
              >
                <GithubMark size={15} />
                Continue with GitHub
              </a>
            )}

            <div className="rounded-[14px] border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[13px] font-medium text-ink">Use a personal access token</p>
              <p className="mt-1 text-[12.5px] leading-[18px] text-sub">
                GitHub → Settings → Developer settings → Tokens. A fine-grained token needs{" "}
                <span className="font-mono text-[11.5px] text-accent-text">Contents: read and write</span>{" "}
                on the repositories you want Grace to touch.
              </p>
              <label className="mt-2.5 block">
                <span className="sr-only">GitHub token</span>
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  autoComplete="off"
                  className="h-10 w-full rounded-[10px] border border-white/10 bg-black/40 px-3 font-mono text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-accent"
                />
              </label>
              <button
                type="button"
                onClick={() => void connect()}
                disabled={busy === "connect" || token.trim().length < 8}
                className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[13px] font-semibold text-white disabled:opacity-40"
              >
                {busy === "connect" && <Loader2 size={13} className="animate-spin" />}
                Connect
              </button>
              <p className="mt-2 text-[11.5px] leading-4 text-muted">
                Stored on the server and never sent back to the browser. Disconnect any time.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-3">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search repositories"
                  aria-label="Search repositories"
                  className="h-9 w-full rounded-full border border-white/10 bg-black/40 pl-8 pr-3 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
            </div>

            <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {repos.length === 0 && (
                <p className="px-2 py-8 text-center text-[13px] text-sub">
                  {query ? "No repository matches that." : "No repositories available to this token."}
                </p>
              )}
              <ul className="space-y-0.5">
                {repos.map((repo) => (
                  <li key={repo.fullName}>
                    <button
                      type="button"
                      onClick={() => void importRepo(repo)}
                      disabled={importing !== null}
                      className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-ink">
                            {repo.name}
                          </span>
                          {repo.private && <Lock size={10} className="shrink-0 text-muted" />}
                        </span>
                        <span className="block truncate text-[11.5px] leading-4 text-muted">
                          {repo.owner} · {repo.language ?? "unknown"} · {repo.defaultBranch}
                        </span>
                      </span>
                      {importing === repo.fullName ? (
                        <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
                      ) : (
                        <Upload size={13} className="shrink-0 text-muted" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5">
              <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
                <Check size={11} className="text-accent" aria-hidden="true" />
                Reading a repo copies its text files
              </p>
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={busy === "disconnect"}
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-sub hover:bg-white/5 hover:text-ink"
              >
                <ArrowLeft size={11} aria-hidden="true" />
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
