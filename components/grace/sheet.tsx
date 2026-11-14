"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Overlay plumbing shared by the attach menu, the effort slider, the modals
 * and the drawer: dimmed backdrop (rgba(0,0,0,0.6)), Escape to close, focus
 * trap, and a click-outside that never swallows a drag.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Center dialogs scale in; bottom sheets slide up; right is a side panel. */
  variant?: "center" | "bottom" | "right";
  labelledBy?: string;
  className?: string;
  /** Skip the dimmer (used by the attach menu, which floats over the input). */
  transparent?: boolean;
};

export function Overlay({
  open,
  onClose,
  children,
  variant = "bottom",
  labelledBy,
  className = "",
  transparent = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the panel without yanking the page.
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], button, [href], input, textarea"
      );
      target?.focus({ preventScroll: true });
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  const shell =
    variant === "center"
      ? "grid place-items-center px-4"
      : variant === "right"
        ? "flex justify-end"
        : "flex flex-col justify-end";

  return (
    <div
      className={`fixed inset-0 z-50 ${shell}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {!transparent && (
        <div
          className="absolute inset-0 animate-fade-in bg-black/75 backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative ${
          variant === "right"
            ? "animate-sheet-up h-full w-full max-w-[min(26rem,100vw)] border-l border-white/[0.07] bg-[#0c0c0f] sm:rounded-l-[16px]"
            : ""
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
