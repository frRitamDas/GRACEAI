"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Public-page composer. It looks and behaves like Grace's chat input, while
 * carrying a visitor's first question through account creation instead of
 * discarding it at the sign-in step.
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

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const send = () => {
    const text = value.trim();
    if (!text || !chatEnabled) return;

    if (signedIn) {
      router.push(`/?prompt=${encodeURIComponent(text)}`);
      return;
    }

    const mode = signupEnabled ? "signup" : "signin";
    router.push(`/welcome?mode=${mode}&prompt=${encodeURIComponent(text)}`);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  if (!chatEnabled) {
    return (
      <div className="rounded-[22px] border border-hairline bg-control px-5 py-7 text-center sm:py-8">
        <p className="text-[15px] font-medium text-ink">Chat is paused for a moment</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-[13px] leading-[21px] text-sub">
          The owner has switched messaging off while setup is finished. Your conversations will be here when it is back.
        </p>
      </div>
    );
  }

  const canSend = value.trim().length > 0;

  return (
    <form
      onSubmit={submit}
      className="group rounded-[22px] border border-hairline bg-control p-2.5 transition-colors focus-within:border-hairline-strong sm:rounded-[24px] sm:p-3"
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
        placeholder="Ask Grace anything…"
        autoComplete="off"
        spellCheck
        enterKeyHint="send"
        className="scroll-quiet block max-h-[200px] min-h-[56px] w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-[24px] text-ink outline-none placeholder:text-muted sm:min-h-[68px] sm:text-[16px]"
      />

      <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
        <p className="min-w-0 truncate text-[11px] leading-4 text-muted sm:text-[11.5px]">
          {signedIn ? "Enter to send · Shift+Enter for a new line" : "Your question can come with you when you sign in"}
        </p>
        <button
          type="submit"
          disabled={!canSend}
          className={`press grid size-10 shrink-0 place-items-center rounded-full transition-colors ${
            canSend ? "bg-ink text-bg hover:opacity-85" : "cursor-not-allowed bg-surface text-muted"
          }`}
          aria-label="Send to Grace"
        >
          <ArrowUp size={18} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
