"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";

import { PROVIDERS, type ProviderId } from "@/lib/ai/catalog";

/**
 * The owner's model manager.
 *
 * This is the console's centre of gravity: one row per model with an on/off
 * switch, because the owner — not the user — decides what answers. A model that
 * is off is off everywhere: the router skips it, Grace Code skips it, and no
 * user surface can name it, since users are never shown a model list at all.
 *
 * Everything else on a row (name, tier, price, blurb) is editable in place and
 * survives a provider refresh, because the edits are stored as overrides rather
 * than mutations of the discovered catalog.
 *
 * `serving` marks the single model pinned to answer chat; picking one clears
 * every other pick.
 */

type Override = {
  id: string;
  hidden: boolean;
  name: string | null;
  tier: number | null;
  credits: number | null;
  blurb: string | null;
  contextLabel: string | null;
  free: boolean;
  custom: boolean;
} | null;

type Row = {
  id: string;
  name: string;
  provider: ProviderId;
  providerLabel: string;
  tier: number;
  credits: number;
  contextLabel: string;
  blurb: string;
  free: boolean;
  upstream: string;
  override: Override;
};

type Draft = { name: string; tier: number; credits: number; blurb: string; free: boolean };

type Filter = "all" | "free" | "paid" | "edited" | "hidden" | ProviderId;

const TIERS = ["Small", "Small", "Medium", "Large", "Frontier"];

export function ModelManager({ onMessage }: { onMessage: (text: string, ok: boolean) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [live, setLive] = useState<ProviderId[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** The model pinned to answer chat. Empty means effort routing decides. */
  const [serving, setServing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settingsResponse, modelsResponse] = await Promise.all([
        fetch("/api/admin/settings", { cache: "no-store" }),
        fetch("/api/admin/models", { cache: "no-store" }),
      ]);
      if (settingsResponse.ok) {
        const settings = (await settingsResponse.json()) as { settings?: { chatModel?: string } };
        setServing(settings.settings?.chatModel || null);
      }
      if (!modelsResponse.ok) return;
      const data = (await modelsResponse.json()) as { models?: Row[]; liveProviders?: ProviderId[] };
      setRows(data.models ?? []);
      setLive(data.liveProviders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Pins this model for chat (or unpins it when it is already serving). */
  const pinModel = useCallback(
    async (id: string) => {
      setBusy(id);
      const next = serving === id ? "" : id;
      try {
        const response = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatModel: next }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          onMessage(data.error ?? "That did not save.", false);
          return;
        }
        setServing(next || null);
        onMessage(
          next
            ? `${rows.find((r) => r.id === id)?.name ?? "That model"} now answers every chat.`
            : "Routing goes back to the effort level.",
          true
        );
      } finally {
        setBusy(null);
      }
    },
    [serving, rows, onMessage]
  );

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  /** Writes one field change and updates the row from the server's answer. */
  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setBusy(id);
      try {
        const response = await fetch("/api/admin/models", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...body }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          onMessage(data.error ?? "That change did not save.", false);
          return false;
        }
        await load();
        return true;
      } finally {
        setBusy(null);
      }
    },
    [load, onMessage]
  );

  const reset = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        const response = await fetch("/api/admin/models", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; removed?: string };
        if (!response.ok) {
          onMessage(data.error ?? "That override could not be removed.", false);
          return;
        }
        await load();
        onMessage(
          data.removed === "model" ? "Custom model removed." : "Restored the discovered values.",
          true
        );
      } finally {
        setBusy(null);
      }
    },
    [load, onMessage]
  );

  const counts = useMemo(() => {
    return {
      all: rows.length,
      free: rows.filter((r) => r.free).length,
      paid: rows.filter((r) => !r.free).length,
      edited: rows.filter((r) => r.override).length,
      hidden: rows.filter((r) => r.override?.hidden).length,
      openrouter: rows.filter((r) => r.provider === "openrouter").length,
      groq: rows.filter((r) => r.provider === "groq").length,
      google: rows.filter((r) => r.provider === "google").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "free" && !row.free) return false;
      if (filter === "paid" && row.free) return false;
      if (filter === "edited" && !row.override) return false;
      if (filter === "hidden" && !row.override?.hidden) return false;
      if (
        (filter === "openrouter" || filter === "groq" || filter === "google") &&
        row.provider !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.providerLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const grouped = useMemo(() => {
    const order: ProviderId[] = ["openrouter", "groq", "nvidia", "google"];
    return order
      .map((provider) => ({
        provider,
        label: rows.find((r) => r.provider === provider)?.providerLabel ?? provider,
        rows: visible.filter((r) => r.provider === provider),
      }))
      .filter((group) => group.rows.length > 0);
  }, [visible, rows]);

  const startEdit = (row: Row) => {
    setEditing(row.id);
    setDraft({
      name: row.name,
      tier: row.tier,
      credits: row.credits,
      blurb: row.blurb,
      free: row.free,
    });
  };

  const commitEdit = async (row: Row) => {
    if (!draft) return;
    const changed: Record<string, unknown> = {};
    if (draft.name !== row.name) changed.name = draft.name;
    if (draft.tier !== row.tier) changed.tier = draft.tier;
    if (draft.credits !== row.credits) changed.credits = draft.credits;
    if (draft.blurb !== row.blurb) changed.blurb = draft.blurb;
    if (draft.free !== row.free) changed.free = draft.free;

    if (Object.keys(changed).length === 0) {
      setEditing(null);
      setDraft(null);
      return;
    }
    const ok = await patch(row.id, changed);
    if (ok) {
      setEditing(null);
      setDraft(null);
      onMessage(`${draft.name || row.name} updated.`, true);
    }
  };

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "free", label: "Free", count: counts.free },
    { id: "paid", label: "Paid", count: counts.paid },
    { id: "edited", label: "Edited", count: counts.edited },
    { id: "hidden", label: "Hidden", count: counts.hidden },
  ];

  return (
    <section aria-labelledby="models-heading" className="rounded-[20px] border border-hairline bg-surface">
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="models-heading" className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
              Models
            </h2>
            <p className="mt-1 max-w-[54ch] text-[13.5px] leading-5 text-sub">
              {loading
                ? "Reading the catalog…"
                : `${counts.all} models from ${live.length > 0 ? `${live.map((provider) => PROVIDERS[provider].label).join(", ")} (live)` : "the bundled catalog"}. A switch removes a model from Grace entirely; the star makes one answer every chat.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((previous) => !previous)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13.5px] font-semibold text-black"
          >
            {adding ? <X size={14} /> : <Plus size={14} />}
            {adding ? "Cancel" : "Add model"}
          </button>
        </div>

        {adding && <AddModelForm onDone={() => setAdding(false)} onMessage={onMessage} reload={load} />}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or id"
              aria-label="Search models"
              className="h-9 w-full rounded-full border border-hairline bg-control pl-8 pr-3 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
            />
          </div>
          {/* Wrap instead of scrolling sideways: a clipped chip reads as a bug,
              and there is room for two rows on a phone. */}
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const active = filter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  aria-pressed={active}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                    active ? "bg-ink text-black" : "bg-control text-sub hover:text-ink"
                  }`}
                >
                  {chip.label}
                  <span className={`tabular-nums ${active ? "text-black/45" : "text-muted"}`}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="scroll-quiet max-h-[560px] overflow-y-auto">
        {loading && (
          <p className="flex items-center justify-center gap-2 py-12 text-[13.5px] text-sub">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            Loading models…
          </p>
        )}

        {!loading && visible.length === 0 && (
          <p className="px-5 py-10 text-center text-[13.5px] text-sub">
            Nothing matches that filter.
          </p>
        )}

        {grouped.map((group) => (
          <div key={group.provider}>
            <p className="sticky top-0 z-10 border-b border-hairline bg-surface/95 px-5 py-1.5 text-[11.5px] font-semibold text-muted backdrop-blur">
              {group.label} · {group.rows.length}
              {live.includes(group.provider) && (
                <span className="ml-1.5 font-normal text-accent-text">live</span>
              )}
            </p>
            <ul className="divide-y divide-hairline/60">
              {group.rows.map((row) => {
                const isEditing = editing === row.id;
                const isHidden = row.override?.hidden === true;
                return (
                  <li key={row.id} className={`px-4 py-2 ${isHidden ? "opacity-55" : ""}`}>
                    {isEditing && draft ? (
                      <div className="space-y-2 py-1">
                        <div className="grid gap-2 sm:grid-cols-[1fr_120px_100px]">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-muted">Name</span>
                            <input
                              value={draft.name}
                              onChange={(event) =>
                                setDraft({ ...draft, name: event.target.value })
                              }
                              className="h-9 w-full rounded-[10px] border border-hairline bg-control px-2.5 text-[13.5px] text-ink outline-none focus:border-accent"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-muted">Tier</span>
                            <select
                              value={draft.tier}
                              onChange={(event) =>
                                setDraft({ ...draft, tier: Number(event.target.value) })
                              }
                              className="h-9 w-full rounded-[10px] border border-hairline bg-control px-2 text-[13.5px] text-ink outline-none focus:border-accent"
                            >
                              {[1, 2, 3, 4, 5].map((tier) => (
                                <option key={tier} value={tier}>
                                  {TIERS[tier - 1]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-medium text-muted">Credits</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={draft.credits}
                              onChange={(event) =>
                                setDraft({ ...draft, credits: Number(event.target.value) })
                              }
                              className="h-9 w-full rounded-[10px] border border-hairline bg-control px-2.5 text-[13.5px] tabular-nums text-ink outline-none focus:border-accent"
                            />
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-medium text-muted">
                            One-line description
                          </span>
                          <input
                            value={draft.blurb}
                            onChange={(event) => setDraft({ ...draft, blurb: event.target.value })}
                            className="h-9 w-full rounded-[10px] border border-hairline bg-control px-2.5 text-[13.5px] text-ink outline-none focus:border-accent"
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-control px-3 text-[12.5px] text-ink">
                            <input
                              type="checkbox"
                              checked={draft.free}
                              onChange={(event) =>
                                setDraft({ ...draft, free: event.target.checked })
                              }
                              className="accent-accent"
                            />
                            Free
                          </label>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(null);
                                setDraft(null);
                              }}
                              className="h-8 rounded-full px-3 text-[12.5px] font-medium text-sub hover:bg-control hover:text-ink"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void commitEdit(row)}
                              disabled={busy === row.id}
                              className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-black disabled:opacity-50"
                            >
                              {busy === row.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} strokeWidth={3} />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-baseline gap-1.5">
                            <span className="truncate text-[13.5px] font-medium text-ink">
                              {row.name}
                            </span>
                            {row.free && (
                              <span className="shrink-0 text-[10.5px] font-semibold text-accent-text">
                                Free
                              </span>
                            )}
                            {row.override && !isHidden && (
                              <span className="shrink-0 text-[10.5px] font-medium text-[#E0B341]">
                                edited
                              </span>
                            )}
                            {isHidden && (
                              <span className="shrink-0 text-[10.5px] font-medium text-muted">off</span>
                            )}
                            {serving === row.id && (
                              <span className="shrink-0 text-[10.5px] font-medium text-[#E0B341]">
                                serving
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[11.5px] leading-4 text-muted">
                            {TIERS[row.tier - 1] ?? "Medium"} · {row.credits} cr ·{" "}
                            {row.contextLabel || "context varies"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void pinModel(row.id)}
                          disabled={busy === row.id || isHidden}
                          aria-pressed={serving === row.id}
                          aria-label={
                            serving === row.id
                              ? `${row.name} is serving chat. Stop pinning it.`
                              : `Use ${row.name} for chat`
                          }
                          title={serving === row.id ? "Serving every chat" : "Use for chat"}
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${
                            serving === row.id
                              ? "bg-[#F4C406] text-[#252523]"
                              : "text-muted hover:bg-control hover:text-ink"
                          }`}
                        >
                          <Star size={13} fill={serving === row.id ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void patch(row.id, { hidden: !isHidden })}
                          disabled={busy === row.id}
                          role="switch"
                          aria-checked={!isHidden}
                          aria-label={`${row.name} available to Grace`}
                          title={isHidden ? "Off — Grace cannot use this" : "On — Grace can use this"}
                          className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                            isHidden ? "bg-[#3a3a3f]" : "bg-accent"
                          }`}
                        >
                          <span
                            className={`absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full transition-all duration-200 ${
                              isHidden ? "left-[3px] bg-[#e9e9ec]" : "left-[19px] bg-white"
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          aria-label={`Edit ${row.name}`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-control hover:text-ink"
                        >
                          <Pencil size={13} />
                        </button>
                        {row.override && (
                          <button
                            type="button"
                            onClick={() => void reset(row.id)}
                            disabled={busy === row.id}
                            aria-label={`Reset ${row.name}`}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Adds a model that discovery cannot produce, e.g. a gateway with its own id. */
function AddModelForm({
  onDone,
  onMessage,
  reload,
}: {
  onDone: () => void;
  onMessage: (text: string, ok: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [provider, setProvider] = useState<ProviderId>("openrouter");
  const [upstream, setUpstream] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState(3);
  const [credits, setCredits] = useState(2);
  const [free, setFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = `${provider}/${upstream.trim().replace(/^\/+/, "")}`;
      const response = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: name.trim() || upstream.trim(),
          provider,
          upstream: upstream.trim(),
          tier,
          credits,
          free,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That model could not be added.");
        return;
      }
      await reload();
      onMessage(`${name.trim() || upstream.trim()} added.`, true);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-[14px] border border-hairline bg-control p-3">
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">Provider</span>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as ProviderId)}
            className="h-9 w-full rounded-[10px] border border-hairline bg-surface px-2 text-[13px] text-ink outline-none focus:border-accent"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="groq">Groq</option>
            <option value="google">Google</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">
            Upstream id (as the provider names it)
          </span>
          <input
            value={upstream}
            onChange={(event) => setUpstream(event.target.value)}
            placeholder="vendor/model"
            className="h-9 w-full rounded-[10px] border border-hairline bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">Display name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional"
            className="h-9 w-full rounded-[10px] border border-hairline bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-accent"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">Tier</span>
          <select
            value={tier}
            onChange={(event) => setTier(Number(event.target.value))}
            className="h-9 rounded-[10px] border border-hairline bg-surface px-2 text-[13px] text-ink outline-none focus:border-accent"
          >
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                {TIERS[t - 1]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">Credits</span>
          <input
            type="number"
            min={0}
            max={100}
            value={credits}
            disabled={free}
            onChange={(event) => setCredits(Number(event.target.value))}
            className="h-9 w-[90px] rounded-[10px] border border-hairline bg-surface px-2.5 text-[13px] tabular-nums text-ink outline-none focus:border-accent disabled:opacity-40"
          />
        </label>
        <label className="mt-5 flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3 text-[12.5px] text-ink">
          <input
            type="checkbox"
            checked={free}
            onChange={(event) => setFree(event.target.checked)}
            className="accent-accent"
          />
          Free
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || upstream.trim().length === 0}
          className="mt-5 flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-black disabled:opacity-40"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          Add
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12.5px] text-[#FF9A9A]">
          {error}
        </p>
      )}
    </div>
  );
}
