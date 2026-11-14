"use client";

/**
 * A switch that reads as a switch: a small track, a thumb that slides, and the
 * accent colour when it is on. Sized for touch (44px hit area with the padding
 * on the wrapper) without looking like a toolbar button.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-white/[0.14]"
      }`}
    >
      <span
        className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-200 ${
          checked ? "left-[18px] bg-white" : "left-[2px] bg-white/85"
        }`}
      />
    </button>
  );
}
