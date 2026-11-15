"use client";

import { useSyncExternalStore } from "react";

const DEFAULT_GREETINGS: [string, string, string] = [
  "Where should we start, {name}?",
  "What should Grace look into, {name}?",
  "What needs clarity, {name}?",
];

/** Re-render on the minute boundary so the deployment's greeting rotates. */
const subscribe = (notify: () => void) => {
  const delay = 60_000 - (Date.now() % 60_000);
  let interval: number | undefined;
  const first = window.setTimeout(() => {
    notify();
    interval = window.setInterval(notify, 60_000);
  }, delay);
  return () => {
    window.clearTimeout(first);
    if (interval !== undefined) window.clearInterval(interval);
  };
};

function clientMinute() {
  return Math.floor(Date.now() / 60_000);
}

export function Greeting({
  name,
  lines = DEFAULT_GREETINGS,
  initialIndex = 0,
}: {
  name: string;
  lines?: [string, string, string];
  /** Match the server's first render and then follow the local clock. */
  initialIndex?: number;
}) {
  const minute = useSyncExternalStore(subscribe, clientMinute, () => initialIndex);
  const template = lines[minute % lines.length] ?? lines[0];
  const line = template.replaceAll("{name}", name || "there");

  return (
    <h1 className="animate-fade-up mx-auto max-w-[36ch] text-center text-[24px] font-medium leading-[31px] tracking-[-0.025em] text-sub sm:text-[30px] sm:leading-[38px]">
      {line}
    </h1>
  );
}
