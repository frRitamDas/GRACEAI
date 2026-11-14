"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { Overlay } from "@/components/grace/sheet";
import type { ProviderId } from "@/lib/ai/catalog";

type KeyModel = { id: string; name: string; tier: number; contextLabel: string };

type Props = {
  open: boolean;
  provider: ProviderId | null;
  onClose: () => void;
  onSaved?: (count: number) => void;
};

const TIER_WORD = ["", "Small", "Medium", "Large", "Large", "Frontier"];

/**
 * "Which models should this key serve?"
 *
 * Shown right after a provider key is added, because that is the only moment the
 * question is worth asking. The default is everything — the note at the bottom
 * says so plainly, including that models added to the catalog later will also
 * use this key, so the dialog never implies more control than it gives.
 *
 * Saving an empty list is allowed and meaningful: the key then serves nothing,
 * which is what someone unticking every box is asking for.
 */
export function KeyModelsDialog({ open, provider, onClose, onSaved }: Props) {
  const [models, setModels] = useState<KeyModel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("provider");

  useEffect(() => {
    if (!open || !provider) return;
    let cancelled = false;

    // Every state write happens after an await, so React never sees a
    // synchronous setState inside the effect.
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/key-models?provider=${provider}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          models?: KeyModel[];
          selected?: string[];
          provider?: { label?: string };
        };
        if (cancelled) return;
        const rows = data.models ?? [];
        setModels(rows);
        setSelected(new Set(data.selected ?? []));
        setLabel(data.provider?.label ?? "provider");
      } catch {
        if (!cancelled) setError("The model list could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, provider]);

  const allSelected = models.length > 0 && selected.size === models.length;
  const nothingSaved = allSelected;

  const summary = useMemo(
    () => `${selected.size} of ${models.length} selected`,
    [selected.size, models.length]
  );

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!provider) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/key-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, models: [...selected] }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "The key could not be updated.");
      }
      onSaved?.(selected.size);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The key could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  if (!provider) return null;

  return (
    <Overlay open={open} onClose={onClose} variant="center" labelledBy="key-models-title">
      <div className="animate-modal-in flex max-h-[86vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
        <div className="px-6 pb-4 pt-6">
          <h2
            id="key-models-title"
            className="font-display text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink"
          >
            Which models should this key serve?
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-5 text-sub">
            Your {label} key was added and currently serves every model below. Untick any this
            key isn&apos;t allowed to use — the router will skip it for those.
          </p>
        </div>

        <div className="flex items-center justify-between border-y border-hairline bg-control/40 px-6 py-2.5">
          <button
            type="button"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(models.map((m) => m.id)))
            }
            disabled={loading || models.length === 0}
            className="flex items-center gap-2.5 text-[13.5px] font-medium text-ink transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            <Box checked={allSelected} />
            Select all
          </button>
          <span className="text-[12.5px] tabular-nums text-muted">{summary}</span>
        </div>

        <div className="scroll-quiet min-h-[180px] flex-1 overflow-y-auto px-2 py-2">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-12 text-[13.5px] text-sub">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Asking {label} what it serves…
            </p>
          )}
          {!loading && models.length === 0 && (
            <p className="px-4 py-10 text-center text-[13.5px] leading-5 text-sub">
              This key has no models to show yet. Check it in Settings, then reopen this dialog.
            </p>
          )}
          {!loading && models.length > 0 && (
            <ul className="stagger">
              {models.map((model) => {
                const on = selected.has(model.id);
                return (
                  <li key={model.id}>
                    <button
                      type="button"
                      onClick={() => toggle(model.id)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 rounded-[12px] px-4 py-2.5 text-left transition-colors duration-100 hover:bg-raised"
                    >
                      <Box checked={on} />
                      <span className="min-w-0 flex-1">
                        <span className={`line-clamp-2 block text-[13.5px] leading-5 ${on ? "text-ink" : "text-sub"}`}>
                          {model.name}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Pill>{TIER_WORD[model.tier] ?? "Medium"}</Pill>
                        <Pill>{model.contextLabel || "—"}</Pill>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-hairline px-6 pb-5 pt-4">
          <p className="mb-4 text-[12px] leading-[18px] text-muted">
            {nothingSaved
              ? "Everything selected — nothing is saved, and models added to the catalog later will use this key too."
              : `${selected.size} of ${models.length} models will use this key. Models added later start switched off.`}
          </p>
          {error && (
            <p role="alert" className="mb-3 rounded-[12px] border border-[#4A2020] bg-[#2A1516] px-3 py-2 text-[12.5px] leading-4 text-[#FF9A9A]">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full px-4 text-[14px] font-medium text-sub transition-colors hover:bg-control hover:text-ink"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors duration-150 ${
        checked ? "border-accent bg-accent text-white" : "border-[#3A3A3F] text-transparent"
      }`}
    >
      <Check size={11} strokeWidth={3.5} />
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[6px] border border-hairline px-1.5 py-0.5 text-[10.5px] font-medium leading-[14px] text-muted">
      {children}
    </span>
  );
}
