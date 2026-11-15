"use client";

import { BookOpen, Camera, ImageIcon, Paperclip } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onAttachFiles: () => void;
  onTakePhoto: () => void;
  onDeepResearch: () => void;
  deepResearchOn: boolean;
};

/**
 * Attach menu.
 *
 * Floats directly above the composer's plus button, aligned to its left edge,
 * on desktop and phone alike. 24px radius, 56px rows, and the fourth row keeps
 * its cost on the right so a credit price is never a surprise.
 */
export function AttachMenu({
  open,
  onClose,
  onAttachFiles,
  onTakePhoto,
  onDeepResearch,
  deepResearchOn,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      // The plus/X button toggles the menu itself; swallowing that click would
      // make the button appear dead.
      if ((target as HTMLElement).closest?.("[data-attach-toggle]")) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointer);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Add to your message"
      className="float-menu animate-sheet-up absolute bottom-full left-0 z-40 mb-2.5 w-[min(340px,calc(100vw-40px))] overflow-hidden rounded-[24px] p-1"
    >
      <Row
        icon={<Paperclip size={21} strokeWidth={1.8} />}
        label="Attach files"
        onClick={onAttachFiles}
      />
      <Row icon={<Camera size={21} strokeWidth={1.8} />} label="Take photo" onClick={onTakePhoto} />
      <Row
        icon={<ImageIcon size={21} strokeWidth={1.8} />}
        label="Create an image"
        disabled
        trailing={<span className="text-[13px] text-muted">Soon</span>}
      />
      <Row
        icon={<BookOpen size={21} strokeWidth={1.8} />}
        label="Deep Research"
        onClick={onDeepResearch}
        active={deepResearchOn}
        trailing={<span className="text-[13px] text-sub">25 credits</span>}
      />
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
  trailing,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  if (disabled) {
    return (
      <div
        role="menuitem"
        aria-disabled="true"
        className="flex h-14 cursor-default items-center gap-3.5 rounded-[18px] px-3 text-[16px] font-medium text-muted"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center text-muted">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {trailing}
      </div>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-14 w-full items-center gap-3.5 rounded-[18px] px-3 text-left text-[16px] font-medium transition-colors hover:bg-white/[0.055] ${
        active ? "text-accent-text" : "text-ink"
      }`}
    >
      <span className={`grid h-6 w-6 shrink-0 place-items-center ${active ? "text-accent" : ""}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active ? <span className="text-[13px] font-medium text-accent-text">On</span> : trailing}
    </button>
  );
}
