"use client";

import { AlertCircle, Check, ExternalLink, Loader2, Mail, ShieldCheck, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { GithubMark } from "@/components/grace/github-mark";
import { GoogleMark } from "@/components/grace/google-mark";

type Props = {
  initial: {
    google: {
      configured: boolean;
      /** OAuth client id's public prefix, so the page can name the project. */
      clientIdHint: string | null;
      /** Gemini models available to the deployment, if the key is live. */
      models: number;
    };
    github: {
      connected: boolean;
      login: string | null;
      name: string | null;
      avatarUrl: string | null;
      oauthConfigured: boolean;
    };
    env: { appUrl: string };
  };
};

/**
 * Connections.
 *
 * One card per account Grace can use on your behalf. A card states one of three
 * things and never a fourth: connected (with the account), available to
 * connect, or not configured on this deployment — and in that last case it names
 * the exact variable that is missing instead of showing a dead button.
 *
 * Nothing here simulates success. GitHub's Connect button goes to the real
 * OAuth start route, which itself refuses when the client id and secret are
 * absent.
 */
export function ConnectionsView({ initial }: Props) {
  const params = useSearchParams();
  const justRefused = params.get("github") === "unavailable";

  const [github, setGithub] = useState(initial.github);
  const [token, setToken] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [busy, setBusy] = useState<"token" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(
    justRefused ? "GitHub OAuth is not configured on this deployment yet." : null
  );

  const connectWithToken = async () => {
    if (!token.trim() || busy) return;
    setBusy("token");
    setError(null);
    try {
      const response = await fetch("/api/github", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        connected?: boolean;
        account?: { login: string; name: string | null; avatarUrl: string | null };
      };
      if (!response.ok || !data.connected) {
        setError(data.error ?? "GitHub rejected that token.");
        return;
      }
      setGithub({
        connected: true,
        login: data.account?.login ?? null,
        name: data.account?.name ?? null,
        avatarUrl: data.account?.avatarUrl ?? null,
        oauthConfigured: github.oauthConfigured,
      });
      setToken("");
      setTokenOpen(false);
    } catch {
      setError("That token could not be checked.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect GitHub? Grace will stop being able to push to your repositories.")) return;
    setBusy("disconnect");
    const response = await fetch("/api/github", { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setError("GitHub could not be disconnected.");
      setBusy(null);
      return;
    }
    setGithub((prev) => ({ ...prev, connected: false, login: null, name: null, avatarUrl: null }));
    setBusy(null);
  };

  return (
    <div className="scroll-quiet flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 sm:px-7">
        <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-ink">Connections</h1>
        <p className="mt-1 max-w-[58ch] text-[13px] leading-5 text-sub">
          Accounts Grace can read or act with on your behalf. A connection reads “connected” only
          after the provider confirms it.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-[12px] border border-hairline bg-control px-3.5 py-2.5 text-[12.5px] leading-5 text-sub"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            {error}
          </p>
        )}

        <ul className="mt-5 space-y-2.5">
          {/* ------------------------------------------------------- Google */}
          <li className="rounded-[20px] border border-hairline bg-control p-4 sm:p-5">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white">
                <GoogleMark className="h-[21px] w-[21px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-ink">Google</p>
                  <Status
                    ok={initial.google.configured}
                    okLabel="Available"
                    offLabel="Not configured"
                  />
                </div>
                <p className="mt-1 max-w-[58ch] text-[12.5px] leading-5 text-sub">
                  Signs you in with a Google account and unlocks the Gemini models. Grace reads your
                  name, email and profile photo. It does not read your mail, files or calendar — those
                  scopes are never requested.
                </p>

                {initial.google.configured ? (
                  <div className="mt-3">
                    <a
                      href="/api/auth/google/start"
                      className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black hover:opacity-90"
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      Connect Google
                    </a>
                    <p className="mt-2 text-[11px] leading-5 text-muted">
                      {initial.google.models > 0
                        ? `${initial.google.models} Gemini models are live for this deployment.`
                        : "No Gemini model is live yet; the key is present but discovery found none."}
                      {initial.google.clientIdHint && ` OAuth client ${initial.google.clientIdHint}…`}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[12px] border border-hairline bg-black/40 px-3.5 py-2.5">
                    <p className="text-[11.5px] font-semibold text-ink">What is missing</p>
                    <p className="mt-1 text-[11.5px] leading-5 text-sub">
                      {initial.google.models > 0
                        ? `Gemini answers are live (${initial.google.models} models), but signing in with a Google account needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.`
                        : "Add GOOGLE_AI_API_KEY for Gemini, and GOOGLE_CLIENT_ID plus GOOGLE_CLIENT_SECRET for account sign-in. Until then the Connect button stays off."}
                    </p>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-text hover:underline"
                    >
                      Google Cloud credentials
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </li>

          {/* ------------------------------------------------------- GitHub */}
          <li className="rounded-[20px] border border-hairline bg-control p-4 sm:p-5">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white/[0.06] text-ink">
                <GithubMark size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-ink">GitHub</p>
                  <Status
                    ok={github.connected}
                    okLabel="Connected"
                    offLabel={github.oauthConfigured ? "Available" : "Not configured"}
                  />
                </div>
                <p className="mt-1 max-w-[58ch] text-[12.5px] leading-5 text-sub">
                  Lets Grace read a repository into a workspace and push the files you approve. The
                  token is stored server-side and never sent to the browser. Access is limited to the
                  repositories you choose to import.
                </p>

                {github.connected ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex h-9 items-center gap-2 rounded-full bg-white/[0.06] px-3 text-[12.5px] text-ink">
                      <Check size={13} className="text-accent" aria-hidden="true" />
                      @{github.login}
                    </span>
                    <a
                      href="/code"
                      className="press flex h-9 items-center rounded-full px-3 text-[12px] font-semibold text-sub hover:text-ink"
                    >
                      Import a repo
                    </a>
                    <button
                      type="button"
                      onClick={() => void disconnect()}
                      disabled={busy === "disconnect"}
                      className="press ml-auto flex h-8 items-center gap-1.5 rounded-full border border-hairline px-3 text-[11.5px] font-medium text-sub hover:text-ink disabled:opacity-50"
                    >
                      {busy === "disconnect" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Unplug size={12} />
                      )}
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    {github.oauthConfigured ? (
                      <a
                        href="/api/github/oauth/start"
                        className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-black hover:opacity-90"
                      >
                        <GithubMark size={13} />
                        Connect GitHub
                      </a>
                    ) : (
                      <div className="rounded-[12px] border border-hairline bg-black/40 px-3.5 py-2.5">
                        <p className="text-[11.5px] font-semibold text-ink">What is missing</p>
                        <p className="mt-1 text-[11.5px] leading-5 text-sub">
                          GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set on this deployment, so
                          OAuth cannot start. You can still connect with a personal access token below.
                        </p>
                        <a
                          href="https://github.com/settings/developers"
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-text hover:underline"
                        >
                          Create an OAuth app
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setTokenOpen((v) => !v)}
                      className="mt-2.5 text-[11.5px] font-semibold text-sub hover:text-ink"
                    >
                      {tokenOpen ? "Hide token option" : "Use a personal access token instead"}
                    </button>

                    {tokenOpen && (
                      <div className="mt-2 rounded-[12px] border border-hairline bg-black/40 p-3">
                        <label htmlFor="gh-token" className="block text-[11px] font-semibold text-muted">
                          Token with repo scope
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id="gh-token"
                            type="password"
                            value={token}
                            onChange={(event) => setToken(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void connectWithToken();
                            }}
                            placeholder="ghp_…"
                            autoComplete="off"
                            className="h-9 min-w-0 flex-1 rounded-[8px] border border-hairline bg-black px-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent/60"
                          />
                          <button
                            type="button"
                            onClick={() => void connectWithToken()}
                            disabled={!token.trim() || busy === "token"}
                            className="press flex h-9 min-w-[86px] items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-semibold text-black disabled:opacity-40"
                          >
                            {busy === "token" ? <Loader2 size={12} className="animate-spin" /> : null}
                            Connect
                          </button>
                        </div>
                        <p className="mt-1.5 text-[10.5px] leading-4 text-muted">
                          Checked against the GitHub API before it is saved. Nothing is stored if it is
                          rejected.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>

          {/* ------------------------------------------------------- Email */}
          <li className="rounded-[20px] border border-hairline p-4 sm:p-5">
            <div className="flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white/[0.06] text-ink">
                <Mail size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold text-ink">Email and password</p>
                  <Status ok okLabel="Active" offLabel="" />
                </div>
                <p className="mt-1 max-w-[58ch] text-[12.5px] leading-5 text-sub">
                  The account you signed in with. Passwords are stored as a hash, and the session is a
                  single httpOnly cookie.
                </p>
              </div>
            </div>
          </li>
        </ul>

        <p className="mt-6 flex items-start gap-2 text-[11.5px] leading-5 text-muted">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          Provider keys and tokens live in server environment variables or the encrypted connection
          table. They are never included in a page, a bundle, or an API response.
        </p>
      </div>
    </div>
  );
}

function Status({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
        ok ? "bg-accent-soft text-accent-text" : "bg-white/[0.06] text-sub"
      }`}
    >
      {ok ? okLabel : offLabel}
    </span>
  );
}
