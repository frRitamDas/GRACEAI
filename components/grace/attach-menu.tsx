"use client";

import { BookOpen, Camera, ImageIcon, Paperclip, X } from "lucide-react";
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
 * Attach menu (DESIGN.md §6.4). Floats above the input bar as a 24px-radius
 * panel, rows 56px tall, disabled row keeps its label with a "Soon" badge.
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
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Defer so the opening click does not immediately close the menu.
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
      aria-label="Attach"
      className="animate-sheet-up absolute bottom-full left-0 z-40 mb-3 w-[300px] overflow-hidden rounded-[24px] border border-hairline bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
    >
      <Row icon={<Paperclip size={20} />} label="Attach files" onClick={onAttachFiles} />
      <Row icon={<Camera size={20} />} label="Take photo" onClick={onTakePhoto} />
      <Row
        icon={<ImageIcon size={20} />}
        label="Create an image"
        disabled
        trailing={<span className="text-[14px] text-muted">Soon</span>}
      />
      <Row
        icon={<BookOpen size={20} />}
        label="Deep Research"
        onClick={onDeepResearch}
        active={deepResearchOn}
        trailing={<span className="text-[14px] text-sub">25 credits</span>}
      />
      <button
        type="button"
        onClick={onClose}
        className="sr-only"
        aria-label="Close attach menu"
      >
        <X size={16} /> Close
      </button>
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
  trailing,
  disabled = false,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
      className={`flex h-14 w-full items-center gap-3 rounded-[18px] px-3 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed text-muted"
          : "text-ink hover:bg-raised active:bg-raised"
      } ${active ? "bg-raised" : ""}`}
    >
      <span className={`grid h-6 w-6 place-items-center ${disabled ? "text-muted" : "text-ink"}`} aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 text-[20px] font-medium leading-6">{label}</span>
      {trailing}
    </button>
  );
}
