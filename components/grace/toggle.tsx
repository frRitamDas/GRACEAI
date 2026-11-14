"use client";

/** Pill toggle (DESIGN.md §6.8): white track with a dark thumb when on. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-ink" : "bg-hairline"
      }`}
    >
      <span
        className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full transition-all duration-200 ${
          checked ? "right-1 bg-[#101014]" : "left-1 bg-white"
        }`}
      />
    </button>
  );
}
