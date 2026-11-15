"use client";

import {
  ArrowUpRight,
  Folder,
  FolderPlus,
  Loader2,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type ProjectItem = {
  id: string;
  name: string;
  language: string;
  updatedAt: string;
  access?: "owner" | "shared";
  fileCount?: number;
};

type Filter = "all" | "mine" | "shared";

const LANGUAGES = ["javascript", "typescript", "python", "html", "go"] as const;

/**
 * Projects.
 *
 * A real list over the existing Grace Code projects, with the three filters the
 * brief asks for (All / Created by you / Shared with you), live search, create,
 * open, share and delete. "Shared with you" is backed by the sharing column on
 * the project row — there is no fake state here: an account with nothing shared
 * sees the empty state, not a placeholder card.
 */
export function ProjectsView({ initial }: { initial: ProjectItem[] }) {
  const [projects, setProjects] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("javascript");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<ProjectItem | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareState, setShareState] = useState<"idle" | "busy" | "done">("idle");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (filter === "mine" && project.access === "shared") return false;
      if (filter === "shared" && project.access !== "shared") return false;
      if (needle && !project.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [projects, filter, query]);

  const mineCount = projects.filter((p) => p.access !== "shared").length;
  const sharedCount = projects.filter((p) => p.access === "shared").length;

  const create = async () => {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/code/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, language }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        project?: ProjectItem;
        error?: string;
      };
      if (!response.ok || !data.project) {
        setError(data.error ?? "That project could not be created.");
        return;
      }
      setProjects((prev) => [{ ...data.project!, access: "owner" }, ...prev]);
      setCreating(false);
      setName("");
      setFilter("all");
    } catch {
      setError("That project could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (project: ProjectItem) => {
    if (!window.confirm(`Delete "${project.name}"? Its files and chats go with it.`)) return;
    const before = projects;
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    const response = await fetch(`/api/code/projects?id=${encodeURIComponent(project.id)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setProjects(before);
      const data = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(data?.error ?? "That project could not be deleted.");
    }
  };

  const share = async () => {
    if (!sharing || !shareEmail.trim()) return;
    setShareState("busy");
    const response = await fetch(`/api/code/projects?id=${encodeURIComponent(sharing.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail.trim() }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!response?.ok) {
      setShareState("idle");
      setError(data?.error ?? "That project could not be shared.");
      return;
    }
    setShareState("done");
    window.setTimeout(() => {
      setSharing(null);
      setShareEmail("");
      setShareState("idle");
    }, 1200);
  };

  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[980px] px-4 pb-16 pt-8 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-ink">Projects</h1>
            <p className="mt-1 text-[13px] leading-5 text-sub">
              Workspaces Grace can read and change. Each one keeps its own files and chat.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="press flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-black hover:opacity-90"
          >
            <Plus size={15} strokeWidth={2.6} aria-hidden="true" />
            New project
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-control p-1">
            {(
              [
                { id: "all", label: "All", count: projects.length },
                { id: "mine", label: "Created by you", count: mineCount },
                { id: "shared", label: "Shared with you", count: sharedCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                aria-pressed={filter === tab.id}
                className={`press flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                  filter === tab.id ? "bg-white/[0.12] text-ink" : "text-sub hover:text-ink"
                }`}
              >
                {tab.label}
                <span className="text-[11px] tabular-nums text-muted">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="relative ml-auto w-full xs:w-[230px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="h-9 w-full rounded-full border border-hairline bg-control pl-8 pr-8 text-[13px] text-ink outline-none transition-colors placeholder:text-muted hover:border-hairline-strong focus:border-accent/60"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-white/[0.08] hover:text-ink"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-[10px] border border-hairline bg-control px-3 py-2 text-[12.5px] text-sub">
            {error}
          </p>
        )}

        {visible.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-[20px] border border-hairline bg-control text-muted">
              <Folder size={27} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-medium text-ink">
              {query
                ? "No project matches that."
                : filter === "shared"
                  ? "Nothing has been shared with you yet."
                  : "No projects yet"}
            </p>
            <p className="mt-1 max-w-[38ch] text-[12.5px] leading-5 text-sub">
              {filter === "shared"
                ? "When someone shares a project, it appears here with read-only access."
                : "A project gives Grace a set of files to work in. Start one and ask for the first change."}
            </p>
            {filter !== "shared" && !query && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="press mt-4 flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black"
              >
                <FolderPlus size={14} aria-hidden="true" />
                New project
              </button>
            )}
          </div>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {visible.map((project) => (
              <li key={project.id} className="group relative border-b border-hairline">
                <Link
                  href={`/code?project=${project.id}`}
                  className="press flex h-[104px] flex-col rounded-[12px] px-1 py-3.5 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-control text-sub">
                      {project.access === "shared" ? (
                        <Share2 size={15} strokeWidth={1.8} aria-hidden="true" />
                      ) : (
                        <Folder size={15} strokeWidth={1.8} aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{project.name}</span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {project.access === "shared" ? "Shared with you" : capitalize(project.language)}
                        {typeof project.fileCount === "number"
                          ? ` · ${project.fileCount} ${project.fileCount === 1 ? "file" : "files"}`
                          : ""}
                      </span>
                    </span>
                    <ArrowUpRight
                      size={13}
                      className="mt-1 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="mt-auto flex items-center text-[11px] text-muted transition-opacity group-hover:opacity-0">
                    Updated {relative(project.updatedAt)}
                  </span>
                </Link>
                {project.access !== "shared" && (
                  <span className="absolute bottom-3.5 right-1 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSharing(project);
                        setShareEmail("");
                        setShareState("idle");
                      }}
                      aria-label={`Share ${project.name}`}
                      className="press grid h-7 w-7 place-items-center rounded-[7px] bg-black/70 text-muted hover:text-ink"
                    >
                      <Share2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(project)}
                      aria-label={`Delete ${project.name}`}
                      className="press grid h-7 w-7 place-items-center rounded-[7px] bg-black/70 text-muted hover:text-ink"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* create dialog */}
      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center px-4" role="presentation">
          <div className="animate-fade-in absolute inset-0 bg-black/60" onMouseDown={() => setCreating(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="float-modal animate-modal-in relative w-full max-w-[400px] rounded-[22px] p-5"
          >
            <h2 id="new-project-title" className="text-[18px] font-bold text-ink">
              New project
            </h2>
            <p className="mt-1 text-[12.5px] leading-5 text-sub">
              Grace starts it with a README and one source file.
            </p>
            <label htmlFor="project-name" className="mt-4 block text-[11.5px] font-semibold text-muted">
              Name
            </label>
            <input
              id="project-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
                if (event.key === "Escape") setCreating(false);
              }}
              maxLength={80}
              placeholder="Landing page refresh"
              className="mt-1 h-10 w-full rounded-[10px] border border-hairline bg-black px-3 text-[13.5px] text-ink outline-none focus:border-accent/60"
            />
            <p className="mt-3 text-[11.5px] font-semibold text-muted">Language</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`press h-8 rounded-full px-3 text-[12px] font-medium ${
                    language === lang
                      ? "bg-white/[0.14] text-ink"
                      : "border border-hairline text-sub hover:text-ink"
                  }`}
                >
                  {capitalize(lang)}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="press h-9 rounded-full px-4 text-[12.5px] font-semibold text-sub hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void create()}
                disabled={!name.trim() || busy}
                className="press flex h-9 min-w-[104px] items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black disabled:opacity-40"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                {busy ? "Creating" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* share dialog */}
      {sharing && (
        <div className="fixed inset-0 z-50 grid place-items-center px-4" role="presentation">
          <div className="animate-fade-in absolute inset-0 bg-black/60" onMouseDown={() => setSharing(null)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            className="float-modal animate-modal-in relative w-full max-w-[400px] rounded-[22px] p-5"
          >
            <h2 id="share-title" className="text-[18px] font-bold text-ink">
              Share “{sharing.name}”
            </h2>
            <p className="mt-1 text-[12.5px] leading-5 text-sub">
              They can open the project and its chat. Only you can change files or delete it.
            </p>
            <label htmlFor="share-email" className="mt-4 block text-[11.5px] font-semibold text-muted">
              Their Grace email
            </label>
            <input
              id="share-email"
              autoFocus
              type="email"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void share();
                if (event.key === "Escape") setSharing(null);
              }}
              placeholder="teammate@example.com"
              className="mt-1 h-10 w-full rounded-[10px] border border-hairline bg-black px-3 text-[13.5px] text-ink outline-none focus:border-accent/60"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              {shareState === "done" && <span className="mr-auto text-[12px] text-sub">Shared.</span>}
              <button
                type="button"
                onClick={() => setSharing(null)}
                className="press h-9 rounded-full px-4 text-[12.5px] font-semibold text-sub hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void share()}
                disabled={!shareEmail.trim() || shareState === "busy"}
                className="press flex h-9 min-w-[92px] items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black disabled:opacity-40"
              >
                {shareState === "busy" ? <Loader2 size={13} className="animate-spin" /> : null}
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function relative(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
