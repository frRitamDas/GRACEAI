"use client";

import { useSyncExternalStore } from "react";

/**
 * Greeting (DESIGN.md §6.2). One fade-up on load, centered, secondary gray,
 * first name at the end. The reference has exactly one line; the rotation that
 * used to live here was our own invention and is gone, so the empty state
 * always reads the same on every load.
 */
const VARIANTS = ["Where should we start, {name}?"];

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

  return (
    <h1 className="animate-fade-up mx-auto max-w-[24ch] text-center text-[21px] font-medium leading-[29px] tracking-[-0.02em] text-sub sm:text-[26px] sm:leading-[34px]">
      {line}
    </h1>
  );
}
