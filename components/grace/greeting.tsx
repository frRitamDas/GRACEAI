"use client";

import { useSyncExternalStore } from "react";

/**
 * Greeting (DESIGN.md §6.2). One fade-up on load, centered, secondary gray,
 * first name at the end. Variants rotate hourly so a returning user sees a
 * fresh question without the copy feeling random.
 */
const VARIANTS = [
  "Where should we start, {name}?",
  "What needs clarity, {name}?",
  "What are we building today, {name}?",
  "What should Grace look into, {name}?",
];

const subscribe = () => () => {};
/** Prerender and first paint agree; the live hour arrives on hydration. */
const serverHour = () => 0;
let cachedHour: number | null = null;
const clientHour = () => {
  if (cachedHour === null) cachedHour = Math.floor(Date.now() / 3_600_000);
  return cachedHour;
};

export function Greeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(subscribe, clientHour, serverHour);
  const line = VARIANTS[hour % VARIANTS.length].replace("{name}", name || "there");
  // The name is the only bright part: it reads as a greeting rather than as
  // placeholder copy, and gives the empty state a focal point.
  const [before, after] = line.split(name || "\u0000");

  return (
    <h1 className="animate-fade-up mx-auto max-w-[26ch] font-display text-[30px] font-medium leading-[38px] tracking-[-0.022em] text-sub sm:text-[38px] sm:leading-[46px]">
      {before}
      <span className="text-ink">{name || "there"}</span>
      {after}
    </h1>
  );
}
