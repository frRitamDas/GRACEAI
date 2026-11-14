"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sign in / create account. One card, two modes, plain-language errors.
 * On success the server session cookie is set and the chat page reloads.
 */
export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That did not work. Try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Grace could not reach the server. Check the connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full rounded-[16px] border border-hairline bg-surface p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
      <div className="mb-3.5 flex rounded-[9px] bg-white/[0.04] p-0.5" role="tablist" aria-label="Account">
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
            onClick={() => {
              setMode(id);
              setError(null);
            }}
            className={`h-8 flex-1 rounded-[7px] text-[12.5px] font-semibold transition-colors ${
              mode === id ? "bg-ink text-black" : "text-sub hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-2.5" noValidate>
        {mode === "signup" && (
          <Field
            label="Name"
            value={name}
            onChange={setName}
            autoComplete="given-name"
            placeholder="Ritam"
            required
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
        <div>
          <label htmlFor="password" className="mb-1 block text-[11.5px] font-medium text-sub">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              required
              className="h-10 w-full rounded-[9px] border border-hairline bg-control px-3 pr-14 text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-[6px] px-2 text-[11.5px] font-semibold text-sub hover:bg-white/[0.06] hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[12px] leading-[18px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="press h-10 w-full rounded-[9px] bg-accent text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "One moment…" : mode === "signup" ? "Start with 250 credits" : "Sign in"}
        </button>
      </form>

      <p className="mt-2.5 text-center text-[11px] leading-4 text-muted">
        {mode === "signup"
          ? "Free to start. No card, no trial timer."
          : "Welcome back. Your chats are exactly where you left them."}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11.5px] font-medium text-sub">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="h-10 w-full rounded-[9px] border border-hairline bg-control px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
