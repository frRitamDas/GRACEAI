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
 * The effort panel that sits directly above the input bar (DESIGN.md §6.5).
 * No card and no dimmer: the slider is part of the composer stack, which is
 * how the reference screenshots read. The label sits above the track.
 */
export function EffortSheet({
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
    <div className="animate-sheet-up pb-1">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[12px] font-semibold tracking-[0.01em] text-muted">Effort</span>
        <button
          type="button"
          onClick={onOpenModels}
          className="flex items-center gap-1.5 py-1 text-[13px] font-bold text-sub transition-colors hover:text-ink"
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
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
