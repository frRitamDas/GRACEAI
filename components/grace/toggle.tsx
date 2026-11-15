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
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-ink" : "bg-[#3a3a3f]"
      }`}
    >
      <span
        className={`absolute top-1/2 h-[20px] w-[20px] -translate-y-1/2 rounded-full transition-all duration-200 ${
          checked ? "left-[24px] bg-[#0b0b0c]" : "left-[3px] bg-[#e9e9ec]"
        }`}
      />
    </button>
  );
}
