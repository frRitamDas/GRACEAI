"use client";

import { useMemo, useState } from "react";
import { Check, Search, Sparkles, X, Zap } from "lucide-react";

import { Overlay } from "@/components/grace/sheet";
import type { ProviderId } from "@/lib/ai/catalog";

export type CatalogModel = {
  id: string;
  name: string;
  provider: ProviderId;
  providerLabel: string;
  tier: number;
  credits: number;
  contextLabel: string;
  blurb: string;
  free: boolean;
  available: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  models: CatalogModel[];
  selected: string | null;
  onSelect: (id: string) => void;
  anyConfigured: boolean;
  /** The owner sees console instructions; everyone else sees a status line. */
  isAdmin: boolean;
};

type Scope = "free" | "all" | ProviderId;

const TIER_WORD = ["", "Small", "Medium", "Large", "Large", "Frontier"];

/**
 * Model picker.
 *
 * The job is to make the free ones obvious and the paid ones honest. So the
 * default scope is Free, each row leads with what the model is good at rather
 * than an internal id, and the cost column says "Free" instead of "0 cr".
 * Grouping only appears when the user is browsing everything — a chipped filter
 * list plus headings for three providers is two navigation systems at once.
 */
export function ModelSheet({
  open,
  onClose,
  models,
  selected,
  onSelect,
  anyConfigured,
  isAdmin,
}: Props) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("free");

  const counts = useMemo(
    () => ({
      free: models.filter((m) => m.free).length,
      all: models.length,
      openrouter: models.filter((m) => m.provider === "openrouter").length,
      groq: models.filter((m) => m.provider === "groq").length,
      google: models.filter((m) => m.provider === "google").length,
    }),
    [models],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A search is an explicit question ("where is Nemotron?"), so it searches the
    // whole catalog. Chips still narrow the unfiltered browse list.
    return models
      .filter((m) => {
        if (!q) {
          if (scope === "free" && !m.free) return false;
          if (scope !== "all" && scope !== "free" && m.provider !== scope)
            return false;
          return true;
        }
        return (
          m.name.toLowerCase().includes(q) ||
          m.providerLabel.toLowerCase().includes(q) ||
          m.blurb.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Available first, then free, then capability.
        if (a.available !== b.available) return a.available ? -1 : 1;
        if (a.free !== b.free) return a.free ? -1 : 1;
        return b.tier - a.tier;
      });
  }, [models, query, scope]);

  const close = () => {
    setQuery("");
    setScope("free");
    onClose();
  };

  const chips: { id: Scope; label: string; count: number }[] = [
    { id: "free", label: "Free", count: counts.free },
    { id: "all", label: "All", count: counts.all },
    { id: "openrouter", label: "OpenRouter", count: counts.openrouter },
    { id: "groq", label: "Groq", count: counts.groq },
    { id: "google", label: "Google", count: counts.google },
  ];

  return (
    <Overlay
      open={open}
      onClose={close}
      variant="bottom"
      labelledBy="model-title"
      className="animate-sheet-up px-3 pb-3"
    >
      <div className="glass-strong mx-auto flex max-h-[82vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[28px]">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2
              id="model-title"
              className="font-display text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink"
            >
              Choose a model
            </h2>
            <p className="mt-0.5 text-[13.5px] leading-5 text-sub">
              Effort picks one for you. Override it any time.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close model list"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-control text-sub transition-colors hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
              aria-label="Search models"
              className="h-10 w-full rounded-full border border-hairline bg-control pl-9 pr-4 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
            />
          </div>

          {query.trim() ? (
            // Searching ignores the chips, so the chips step aside instead of
            // claiming a filter they are not applying.
            <p className="mt-3 text-[12.5px] text-muted" role="status">
              {visible.length === 0
                ? "No model matches that search."
                : `${visible.length} ${visible.length === 1 ? "model matches" : "models match"}`}
            </p>
          ) : (
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Filter models"
            >
              {chips.map((chip) => {
                const active = scope === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setScope(chip.id)}
                    className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 ${
                      active
                        ? "bg-ink text-black"
                        : "bg-control text-sub hover:text-ink"
                    }`}
                  >
                    {chip.id === "free" && (
                      <Sparkles
                        size={12}
                        className={active ? "text-accent" : "text-accent-text"}
                        aria-hidden="true"
                      />
                    )}
                    {chip.label}
                    <span
                      className={`tabular-nums ${active ? "text-black/45" : "text-muted"}`}
                    >
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!anyConfigured && (
          <p className="mx-5 mt-3 flex items-start gap-2 rounded-[14px] border border-hairline bg-control px-3.5 py-2.5 text-[13px] leading-5 text-sub">
            <Zap
              size={14}
              className="mt-0.5 shrink-0 text-accent"
              aria-hidden="true"
            />
            {isAdmin
              ? "No provider is connected yet. Add a key in the admin console and every model here unlocks."
              : "No provider is connected yet. The owner needs to enable one before models can answer."}
          </p>
        )}

        <p className="px-5 pt-3 text-[12.5px] leading-4 text-muted">
          {scope === "free"
            ? "Free models cost no money to run. Grace still tracks usage against your credits."
            : `Free models are marked Free. ${counts.free} of ${counts.all} cost nothing.`}
        </p>

        <div className="scroll-quiet mt-2 flex-1 overflow-y-auto px-2 pb-2">
          {visible.length === 0 && (
            <p className="px-3 py-8 text-center text-[14px] text-sub">
              Nothing matches that. Try another search or scope.
            </p>
          )}
          <ul className="stagger space-y-0.5">
            {visible.map((model) => {
              const active = selected === model.id;
              return (
                <li key={model.id}>
                  <button
                    type="button"
                    disabled={!model.available && anyConfigured}
                    onClick={() => {
                      onSelect(model.id);
                      close();
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-100 ${
                      model.available || !anyConfigured
                        ? "hover:bg-raised"
                        : "cursor-not-allowed opacity-40"
                    } ${active ? "bg-accent-soft" : ""}`}
                  >
                    <span
                      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors ${
                        active
                          ? "border-accent bg-accent text-white"
                          : "border-[#3A3A3F] text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      <Check size={11} strokeWidth={3.5} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        {/* Wrap rather than cut: provider names can run long and
                            a clipped model name is worse than two lines. */}
                        <span
                          className={`line-clamp-2 text-[14.5px] leading-5 ${active ? "font-semibold text-ink" : "font-medium text-ink"}`}
                        >
                          {model.name}
                        </span>
                        {model.free && (
                          <span className="shrink-0 text-[11px] font-semibold text-accent-text">
                            Free
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-4 text-muted">
                        <span>{model.providerLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{model.contextLabel || "Context varies"}</span>
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="block text-[11.5px] font-medium text-sub">
                        {TIER_WORD[model.tier] ?? "Medium"}
                      </span>
                      <span
                        className={`block text-[11px] tabular-nums ${model.free ? "text-accent-text" : "text-muted"}`}
                      >
                        {model.free ? "no cost" : `${model.credits} cr`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Overlay>
  );
}
