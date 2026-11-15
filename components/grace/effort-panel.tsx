"use client";

import { SlidersHorizontal } from "lucide-react";

import { EffortSlider } from "@/components/grace/effort-slider";

type Props = {
  open: boolean;
  onClose: () => void;
  value: number;
  modelName: string | null;
  onChange: (index: number) => void;
  onCommit: (index: number) => void;
  onOpenModels: () => void;
};

/**
 * The effort panel that opens above the composer (DESIGN.md §6.5).
 *
 * No card and no dimmer: the two-tone label and the slider are part of the
 * composer stack, which is how the reference reads. The model row above it is
 * the desktop addition — it answers "which model is this effort buying" in the
 * place the question is asked.
 */
export function EffortPanel({
  open,
  onClose,
  value,
  modelName,
  onChange,
  onCommit,
  onOpenModels,
}: Props) {
  if (!open) return null;
  return (
    <div className="animate-sheet-up pb-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11.5px] font-semibold tracking-[0.01em] text-muted">Effort</span>
        <button
          type="button"
          onClick={onOpenModels}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-semibold text-sub transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <SlidersHorizontal size={12.5} aria-hidden="true" />
          {modelName ?? "Choose model"}
        </button>
      </div>
      <EffortSlider value={value} onChange={onChange} onCommit={onCommit} />
      <button type="button" onClick={onClose} className="sr-only">
        Close effort slider
      </button>
    </div>
  );
}
