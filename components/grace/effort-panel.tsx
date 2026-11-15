"use client";

import { EffortSlider } from "@/components/grace/effort-slider";

type Props = {
  open: boolean;
  onClose: () => void;
  value: number;
  onChange: (index: number) => void;
  onCommit: (index: number) => void;
};

/**
 * The effort panel that opens above the composer (DESIGN.md §6.5).
 *
 * No card and no dimmer: the two-tone label and the slider are part of the
 * composer stack, which is how the reference reads.
 *
 * There is deliberately no model row. Effort says how hard Grace should think;
 * which model does the thinking is the owner's business, set once in the console
 * and never surfaced here.
 */
export function EffortPanel({
  open,
  onClose,
  value,
  onChange,
  onCommit,
}: Props) {
  if (!open) return null;
  return (
    <div className="animate-sheet-up pb-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11.5px] font-semibold tracking-[0.01em] text-muted">Effort</span>
        <span className="pr-1 text-[11.5px] text-muted/80">How hard Grace thinks</span>
      </div>
      <EffortSlider value={value} onChange={onChange} onCommit={onCommit} />
      <button type="button" onClick={onClose} className="sr-only">
        Close effort slider
      </button>
    </div>
  );
}
