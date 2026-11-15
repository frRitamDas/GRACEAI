"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EFFORT_LEVELS } from "@/lib/ai/catalog";

type Props = {
  value: number;
  onChange: (index: number) => void;
  /** Called once when a drag or key press settles. */
  onCommit?: (index: number) => void;
};

/**
 * The effort slider (DESIGN.md §6.5).
 *
 * Measured from the reference: a 56px pill track, a 72px white thumb with a
 * 4px accent ring, the accent filling the track up to the thumb, and a small
 * dot at the far end when Ultra is not selected. The label is the two-tone
 * title above it — accent first word, white second.
 *
 * Smoothness is the whole point, so the thumb is driven by a continuous 0..1
 * position rather than an integer index: while dragging it follows the pointer
 * with no transition, and on release it glides to the chosen stop.
 */
export function EffortSlider({ value, onChange, onCommit }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastIndex = EFFORT_LEVELS.length - 1;
  const [free, setFree] = useState<number | null>(null);
  const dragging = free !== null;
  const position = free ?? value / lastIndex;

  const positionFromClientX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    // 40px = 2px track inset + half of the 76px thumb shell.
    const inset = 40;
    const usable = Math.max(1, rect.width - inset * 2);
    return Math.min(1, Math.max(0, (clientX - rect.left - inset) / usable));
  }, []);

  const snap = useCallback(
    (next: number) => Math.round(next * lastIndex),
    [lastIndex]
  );

  const commit = useCallback(
    (next: number) => {
      if (next !== value) onChange(next);
      onCommit?.(next);
    },
    [onChange, onCommit, value]
  );

  useEffect(() => {
    if (free === null) return;
    const move = (event: PointerEvent) => {
      const next = positionFromClientX(event.clientX);
      setFree(next);
      const index = snap(next);
      if (index !== value) onChange(index);
    };
    const up = (event: PointerEvent) => {
      const index = snap(positionFromClientX(event.clientX));
      setFree(null);
      commit(index);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [free, positionFromClientX, snap, onChange, commit, value]);

  const [accentWord, restWord] = useMemo(() => {
    const name = EFFORT_LEVELS[value]?.name ?? "Instant effort";
    const [first, ...rest] = name.split(" ");
    return [first, rest.join(" ")];
  }, [value]);

  const keyDown = (event: React.KeyboardEvent) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(lastIndex, value + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, value - 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = lastIndex;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div className="w-full select-none">
      <p
        className="mb-5 text-center text-[28px] font-bold leading-9 tracking-[-0.02em] sm:text-[32px] sm:leading-10"
        aria-hidden="true"
      >
        <span className="text-accent">{accentWord}</span> <span className="text-ink">{restWord}</span>
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {EFFORT_LEVELS[value]?.name}
      </p>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Effort"
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={value}
        aria-valuetext={EFFORT_LEVELS[value]?.name}
        data-dragging={dragging ? "true" : "false"}
        onKeyDown={keyDown}
        onPointerDown={(event) => {
          event.preventDefault();
          const next = positionFromClientX(event.clientX);
          setFree(next);
          onChange(snap(next));
          trackRef.current?.focus({ preventScroll: true });
        }}
        className="relative h-[56px] w-full cursor-grab touch-none rounded-full bg-[#1d1d20]"
      >
        {/* Accent fill — same position as the thumb, so they never disagree. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{
            width: `calc(40px + (100% - 80px) * ${position})`,
            transition: dragging ? "none" : "width var(--dur-base) var(--ease-out)",
            willChange: "width",
          }}
        />
        {/* Unselected end dot, as in the reference. */}
        <span
          className="pointer-events-none absolute right-[30px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/50"
          aria-hidden="true"
        />
        {/* Thumb: 72px white disc inside a 4px accent ring. */}
        <span
          className="pointer-events-none absolute top-1/2 grid h-[72px] w-[72px] -translate-y-1/2 place-items-center rounded-full border-4 border-accent bg-white"
          style={{
            left: `calc(2px + ${position} * (100% - 80px))`,
            transition: dragging
              ? "none"
              : "left var(--dur-slow) var(--ease-spring), box-shadow var(--dur-fast) ease",
            willChange: "left",
            boxShadow: dragging ? "0 0 0 6px rgba(59,130,246,0.18)" : "0 0 0 0 rgba(59,130,246,0)",
          }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-3 flex justify-between px-1 text-[12.5px] font-medium text-muted">
        <span>Instant</span>
        <span>Ultra</span>
      </div>
    </div>
  );
}
