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
    <div className="w-full rounded-[28px] border border-hairline bg-surface p-5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
      <div className="mb-4 flex rounded-full bg-control p-1" role="tablist" aria-label="Account">
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
            className={`h-10 flex-1 rounded-full text-[15px] font-bold transition-colors ${
              mode === id ? "bg-ink text-black" : "text-sub hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3" noValidate>
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
          <label htmlFor="password" className="mb-1.5 block text-[14px] font-bold text-sub">
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
              className="h-[52px] w-full rounded-[16px] border border-hairline bg-control px-4 pr-16 text-[17px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-full px-3 text-[13px] font-bold text-sub hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[14px] leading-5 text-[#F2A0A0]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-[52px] w-full rounded-full bg-accent text-[18px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "One moment…" : mode === "signup" ? "Start with 250 credits" : "Sign in"}
        </button>
      </form>

      <p className="mt-3 text-center text-[13px] leading-5 text-muted">
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
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-bold text-sub">
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
        className="h-[52px] w-full rounded-[16px] border border-hairline bg-control px-4 text-[17px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
