"use client";


type Props = {
  /** 0..100. What the ring fills, and the number in the middle. */
  percent: number;
  label: string;
  onClick: () => void;
  size?: number;
};

/**
 * The header credits ring (DESIGN.md §6.1): a thin arc on a 56px control
 * circle with the remaining percentage in the middle. The arc turns accent
 * once usage climbs, so the ring reads as a warning without extra chrome.
 */
export function CreditsRing({ percent, label, onClick, size = 56 }: Props) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const hot = value <= 20;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value} percent credits remaining. Show usage and limits.`}
      className="group relative grid shrink-0 place-items-center rounded-full bg-control transition-opacity duration-150 hover:opacity-90 active:scale-[0.97]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={hot ? "var(--color-accent)" : "var(--color-text-secondary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease, stroke 200ms ease" }}
        />
      </svg>
      <span className="relative text-[12px] font-bold leading-none text-ink tabular-nums">
        {value}
      </span>
    </button>
  );
}
