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
 * Smoothness is the whole point here, so the thumb is driven by a continuous
 * 0..1 position rather than an integer index:
 *
 *   - while dragging, the thumb follows the pointer with zero transition and
 *     no snapping, so it never stutters between stops;
 *   - the selected level is derived from proximity, with a magnetic pull that
 *     widens a stop's catchment as you approach it;
 *   - on release the thumb glides to the chosen stop on a spring curve.
 *
 * The accent fill tracks the same position, so the two never disagree.
 */
export function EffortSlider({ value, onChange, onCommit }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastIndex = EFFORT_LEVELS.length - 1;
  // While dragging, the free 0..1 pointer position; null means "not dragging",
  // in which case the thumb follows the committed index. Deriving it this way
  // avoids writing state from an effect, so there is no extra render per move.
  const [free, setFree] = useState<number | null>(null);
  const dragging = free !== null;
  const position = free ?? value / lastIndex;

  const positionFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      // The thumb has real width, so map its usable travel, not the raw box.
      // 24px = 4px track inset + half of the 40px thumb.
      const inset = 24;
      const usable = Math.max(1, rect.width - inset * 2);
      return Math.min(1, Math.max(0, (clientX - rect.left - inset) / usable));
    },
    []
  );

  /**
   * Nearest stop for a free position, with magnetism: within a stop's radius
   * it wins outright, which makes picking one feel deliberate instead of
   * fiddly. Between them, plain rounding decides.
   */
  const snap = useCallback(
    (free: number) => {
      const exact = free * lastIndex;
      const nearest = Math.round(exact);
      const distance = Math.abs(exact - nearest);
      // 0.34 of a step is a comfortable magnet, not a feeling of stuckness.
      if (distance <= 0.34) return nearest;
      return Math.round(exact);
    },
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
      const next = positionFromClientX(event.clientX);
      const index = snap(next);
      // Releasing clears the free position, so the thumb springs to the stop
      // chosen by `value` through the normal CSS transition.
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

  const hint = EFFORT_LEVELS[value]?.hint ?? "";

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
        className="mb-1 text-center font-display text-[26px] font-semibold leading-8 tracking-[-0.02em] sm:text-[30px] sm:leading-9"
        aria-hidden="true"
      >
        <span className="text-accent">{accentWord}</span>{" "}
        <span className="text-ink">{restWord}</span>
      </p>
      {/* One line that changes with the level; fixed height so nothing jumps. */}
      <p className="mb-3 h-5 text-center text-[13px] leading-5 text-sub" aria-hidden="true">
        {hint}
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
        data-dragging={dragging}
        onKeyDown={keyDown}
        onPointerDown={(event) => {
          event.preventDefault();
          const next = positionFromClientX(event.clientX);
          setFree(next);
          onChange(snap(next));
          trackRef.current?.focus({ preventScroll: true });
        }}
        className="group relative h-[48px] w-full cursor-grab touch-none rounded-full border border-hairline bg-surface active:cursor-grabbing"
      >
        {/* accent fill — same position as the thumb, so they can never disagree */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{
            width: `calc(24px + (100% - 48px) * ${position})`,
            transition: dragging ? "none" : "width var(--dur-base) var(--ease-out)",
            willChange: "width",
          }}
        />
        {/* stop ticks: quiet until reached, then they read as progress */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[26px]" aria-hidden="true">
          {EFFORT_LEVELS.map((level, index) => (
            <span
              key={level.id}
              className="h-1.5 w-1.5 rounded-full transition-colors duration-150"
              style={{
                background:
                  index <= value && !dragging
                    ? "rgba(255,255,255,0.85)"
                    : index / lastIndex <= position
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(255,255,255,0.28)",
              }}
            />
          ))}
        </div>
        {/* thumb */}
        <span
          className="pointer-events-none absolute top-1/2 grid h-[40px] w-[40px] -translate-y-1/2 place-items-center rounded-full bg-white"
          style={{
            left: `calc(4px + ${position} * (100% - 48px))`,
            transition: dragging
              ? "none"
              : `left var(--dur-slow) var(--ease-spring), box-shadow var(--dur-fast) ease`,
            willChange: "left",
            boxShadow: dragging
              ? "0 0 0 6px rgba(59,130,246,0.20)"
              : "0 0 0 0 rgba(59,130,246,0)",
          }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex justify-between px-1 text-[11.5px] font-medium tracking-[0.01em] text-muted">
        <span>Instant</span>
        <span>Ultra</span>
      </div>
    </div>
  );
}
