"use client";

import { Brain, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export type MemoryItem = { id: string; body: string; createdAt: string };

/**
 * Memory.
 *
 * Only what the user typed. Each line is sent to the model as part of the
 * system prompt, so this page is the whole record of what Grace has been told
 * to remember — no hidden extraction, no inferred facts.
 */
export function MemoryView({ initial }: { initial: MemoryItem[] }) {
  const [memories, setMemories] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        memory?: MemoryItem;
        error?: string;
      };
      if (!response.ok || !data.memory) {
        setError(data.error ?? "That could not be saved.");
        return;
      }
      setMemories((prev) => {
        const exists = prev.some((m) => m.id === data.memory!.id);
        return exists ? prev : [data.memory!, ...prev];
      });
      setDraft("");
    } catch {
      setError("That could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const before = memories;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    const response = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setMemories(before);
      setError("That memory could not be removed.");
    }
  };

  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-8 sm:px-7">
        <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-ink">Memory</h1>
        <p className="mt-1 max-w-[58ch] text-[13px] leading-5 text-sub">
          Things Grace should keep in mind. Each line is added to every new conversation — write it as
          a fact about you, not as an instruction to one chat.
        </p>

        <div className="mt-5 rounded-[18px] border border-hairline bg-control p-3">
          <label htmlFor="memory-input" className="sr-only">
            Add a memory
          </label>
          <textarea
            id="memory-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void add();
              }
            }}
            rows={2}
            maxLength={400}
            placeholder="I work in TypeScript and prefer short answers."
            className="scroll-quiet block w-full resize-none bg-transparent px-1.5 py-1.5 text-[13.5px] leading-6 text-ink outline-none placeholder:text-muted"
          />
          <div className="mt-1 flex items-center justify-between gap-3 px-1">
            <span className="text-[11px] tabular-nums text-muted">{draft.length}/400</span>
            <button
              type="button"
              onClick={() => void add()}
              disabled={!draft.trim() || busy}
              className="press flex h-8 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-black disabled:opacity-40"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={3} />}
              Remember
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-[10px] border border-hairline bg-control px-3 py-2 text-[12.5px] text-sub">
            {error}
          </p>
        )}

        {memories.length === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <span className="grid h-16 w-16 place-items-center rounded-[20px] border border-hairline bg-control text-muted">
              <Brain size={26} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-medium text-ink">Nothing remembered yet</p>
            <p className="mt-1 max-w-[40ch] text-[12.5px] leading-5 text-sub">
              Add a line above and it will be part of every conversation from the next message on.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="group flex items-start gap-3 rounded-[14px] border border-hairline bg-control px-4 py-3"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-[13.5px] leading-6 text-ink">{memory.body}</p>
                <button
                  type="button"
                  onClick={() => void remove(memory.id)}
                  aria-label={`Forget: ${memory.body.slice(0, 40)}`}
                  className="press mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-muted opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
