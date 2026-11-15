"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { GraceMark } from "@/components/grace/logo";

/**
 * The account dialog.
 *
 * One card over the public page, two modes, plain-language errors. It lives
 * inside the paper theme, so it is built from the same tokens as the marketing
 * page rather than the dark chat palette; opening it must not look like leaving
 * the page you were reading.
 *
 * `prompt` carries whatever the visitor typed into the hero composer. On
 * success it is handed to the chat as `?prompt=`, so the first thing they see
 * after signing up is their own question being answered — not an empty box.
 */

type Mode = "signin" | "signup";

export function AuthDialog({
  open,
  initialMode,
  signupEnabled,
  prompt,
  dismissHref,
}: {
  open: boolean;
  initialMode: Mode;
  signupEnabled: boolean;
  prompt: string;
  dismissHref: string;
}) {
  const router = useRouter();
  const firstField = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>(signupEnabled ? initialMode : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => firstField.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) router.push(dismissHref);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, dismissHref, router]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That did not work. Try again.");
        return;
      }
      const target = prompt.trim()
        ? `/?prompt=${encodeURIComponent(prompt.trim())}`
        : "/";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Grace could not reach the server. Check the connection.");
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <div
      data-theme="paper"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2E2B29]/32 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) router.push(dismissHref);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="paper-rise w-full max-w-[420px] rounded-t-[20px] border border-hairline bg-surface p-5 shadow-[0_24px_60px_rgba(46,43,41,0.18)] sm:rounded-[16px] sm:p-6"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#252523] text-[#FCFAF8]">
            <GraceMark className="h-[20px] w-[20px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="auth-title" className="font-display text-[23px] leading-tight tracking-[-0.02em] text-ink">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-[18px] text-sub">
              {mode === "signup"
                ? "One account, every conversation you start."
                : "Sign in to pick up where you left off."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(dismissHref)}
            aria-label="Close"
            className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {signupEnabled && (
          <div className="mb-4 flex rounded-[7px] bg-surface-raised p-0.5" role="tablist" aria-label="Account mode">
            {(
              [
                ["signup", "Create account"],
                ["signin", "Sign in"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => switchTo(id)}
                className={`flex-1 rounded-[5px] py-1.5 text-[12.5px] font-medium transition-colors ${
                  mode === id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(46,43,41,0.08)]" : "text-sub hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {prompt.trim() && (
          <div className="mb-4 rounded-[8px] border border-hairline bg-bg px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Your question</p>
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-[18px] text-ink">{prompt.trim()}</p>
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-2.5">
          {mode === "signup" && (
            <Field
              ref={firstField}
              id="auth-name"
              label="Name"
              value={name}
              onChange={setName}
              autoComplete="name"
              placeholder="Your name"
            />
          )}
          <Field
            ref={mode === "signin" ? firstField : undefined}
            id="auth-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="you@example.com"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className="text-[12px] font-medium text-sub">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={show ? "text" : "password"}
                required
                minLength={8}
                maxLength={200}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                className="h-10 w-full rounded-[6px] border border-[#E3DED8] bg-surface px-3 pr-10 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-[#252523]"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-1 top-1 grid size-8 place-items-center rounded-[5px] text-muted hover:text-ink"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
                  {show ? (
                    <>
                      <path d="M3 3l18 18" strokeLinecap="round" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
                      <path d="M6.2 6.5C4.4 7.7 3 9.4 2 12c1.6 4.2 5.4 7 10 7 1.7 0 3.3-.4 4.7-1.2M9.9 5.2A11 11 0 0 1 12 5c4.6 0 8.4 2.8 10 7a12.4 12.4 0 0 1-2.2 3.3" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12c1.6-4.2 5.4-7 10-7s8.4 2.8 10 7c-1.6 4.2-5.4 7-10 7S3.6 16.2 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-[6px] bg-[#B4372C]/8 px-2.5 py-2 text-[12px] leading-[17px] text-[#B4372C]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 h-10 rounded-[4px] bg-[#252523] text-[13.5px] font-medium text-[#FCFAF8] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-3.5 text-center text-[10.5px] leading-[15px] text-muted">
          By continuing you agree to keep this account to yourself. Grace can make mistakes — check
          anything important.
        </p>
      </div>
    </div>
  );
}

function Field({
  ref,
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  ref?: React.Ref<HTMLInputElement>;
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-sub">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        maxLength={200}
        className="h-10 w-full rounded-[6px] border border-[#E3DED8] bg-surface px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-muted focus:border-[#252523]"
      />
    </div>
  );
}
