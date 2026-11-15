"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The composer on the public page.
 *
 * It is the reference's composer, honestly wired: a signed-in visitor's first
 * message is carried into the real chat (which sends it once it mounts); a
 * guest gets the account dialog with their words kept, so nothing they typed is
 * thrown away at the moment they are asked to sign in.
 *
 * When chat is paused the field is replaced by a statement of that fact rather
 * than a box that silently refuses input.
 */
export function HeroComposer({
  chatEnabled,
  signedIn,
  signupEnabled,
}: {
  chatEnabled: boolean;
  signedIn: boolean;
  signupEnabled: boolean;
}) {
  const router = useRouter();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  // Grow with the text, up to a ceiling, the way the real composer does.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (text.length === 0) return;
    if (!chatEnabled) return;

    if (signedIn) {
      router.push(`/?prompt=${encodeURIComponent(text)}`);
      return;
    }
    // The account panel reads `next` so it can land in the chat with the text.
    router.push(`/welcome?mode=${signupEnabled ? "signup" : "signin"}&prompt=${encodeURIComponent(text)}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  if (!chatEnabled) {
    return (
      <div className="rounded-[14px] border border-hairline bg-surface px-4 py-8 text-center">
        <p className="text-[15px] font-medium text-ink">Grace is paused for a moment</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-[13.5px] leading-[21px] text-sub">
          The owner has switched chat off while they finish setting things up. Everything will be
          exactly where you left it when it comes back.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="group rounded-[14px] border border-hairline bg-surface p-2 transition-colors focus-within:border-border-strong"
    >
      <label htmlFor="hero-prompt" className="sr-only">
        Ask Grace anything
      </label>
      <textarea
        id="hero-prompt"
        ref={areaRef}
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything…"
        autoComplete="off"
        spellCheck={false}
        className="block max-h-[200px] w-full resize-none bg-transparent px-2.5 py-2.5 text-[16px] leading-[24px] text-ink outline-none placeholder:text-muted sm:min-h-[64px]"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span
            className="grid size-8 place-items-center rounded-[6px] text-sub"
            aria-hidden="true"
            title="Attach a file once you are signed in"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="truncate rounded-full px-2 py-1 text-[12.5px] text-sub">
            {signedIn ? "Grace answers in one voice" : "Letters and files, once you are in"}
          </span>
        </div>

        <button
          type="submit"
          disabled={value.trim().length === 0}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#252523] text-[#FCFAF8] transition-opacity disabled:opacity-35"
          aria-label="Send to Grace"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
            <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
