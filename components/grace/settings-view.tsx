"use client";

import { ArrowLeft, Check, ChevronRight, Code2, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EFFORT_LEVELS } from "@/lib/ai/catalog";
import { Toggle } from "@/components/grace/toggle";

type Props = {
  user: {
    name: string;
    email: string;
    plan: string;
    credits: number;
    effort: number;
    isAdmin: boolean;
    unlimited: boolean;
    showCreditPercentage: boolean;
  };
  /** Whether the owner left the coding workspace switched on. */
  graceCodeEnabled: boolean;
  projectsEnabled: boolean;
};

/**
 * Settings.
 *
 * One column of labelled groups, each group a single bordered card with rows
 * divided by hairlines — the shape people already know from macOS and GitHub.
 * Rows that do something behave like links; rows that only report state have no
 * hover, so nothing looks clickable that is not.
 */
export function SettingsView({ user, graceCodeEnabled, projectsEnabled }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [effort, setEffort] = useState(user.effort);
  const [showPct, setShowPct] = useState(user.showCreditPercentage);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setSaved(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), 2200);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="scroll-quiet h-full w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[640px] px-4 pb-20 sm:px-7">
        <header className="sticky top-0 z-10 -mx-4 mb-2 flex h-[64px] items-center gap-2 bg-black px-4 sm:-mx-7 sm:px-7">
          <Link
            href="/"
            aria-label="Back to chat"
            className="press grid h-8 w-8 place-items-center rounded-[7px] text-sub transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-[15px] font-semibold text-ink">Settings</h1>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
            {busy ? (
              "Saving…"
            ) : saved ? (
              <>
                <Check size={12} className="text-success" aria-hidden="true" />
                <span className="text-success">Saved</span>
              </>
            ) : (
              "Saves as you go"
            )}
          </span>
        </header>

        <p className="mb-5 truncate text-[12px] text-muted">{user.email}</p>

        <Group title="Profile">
          <label className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="w-[110px] shrink-0 text-[12.5px] text-sub">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => name.trim() && name !== user.name && void save({ name: name.trim() })}
              className="h-8 min-w-0 flex-1 rounded-[7px] border border-transparent bg-white/[0.03] px-2.5 text-[12.5px] text-ink outline-none transition-colors hover:border-white/[0.07] focus:border-accent/50 focus:bg-white/[0.05]"
            />
          </label>
          <Row label="Plan" detail={user.unlimited ? "Owner: nothing is charged" : `${user.credits} credits left`}>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                user.unlimited ? "bg-accent-soft text-accent-text" : "bg-white/[0.06] text-sub"
              }`}
            >
              {user.unlimited ? "Owner" : user.plan}
            </span>
          </Row>
        </Group>

        <Group title="Answers">
          <div className="px-3.5 py-3">
            <p className="mb-2 text-[12.5px] text-sub">Default effort</p>
            <div className="grid gap-1">
              {EFFORT_LEVELS.map((level) => {
                const active = effort === level.index;
                return (
                  <button
                    key={level.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setEffort(level.index);
                      void save({ effort: level.index });
                    }}
                    className={`press flex h-9 items-center gap-2 rounded-[7px] px-2 text-left transition-colors ${
                      active ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"
                    }`}
                  >
                    <span
                      className={`w-[68px] shrink-0 text-[12.5px] ${
                        active ? "font-medium text-accent-text" : "text-sub"
                      }`}
                    >
                      {level.name.split(" ")[0]}
                    </span>
                    <span className="line-clamp-1 flex-1 text-[11.5px] text-muted">{level.hint}</span>
                    {active && <Check size={13} className="shrink-0 text-accent" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
          <Row label="Show credit percentage" detail="Percent instead of credits remaining">
            <Toggle
              checked={showPct}
              label="Show credit percentage"
              onChange={(next) => {
                setShowPct(next);
                void save({ showCreditPercentage: next });
              }}
            />
          </Row>
        </Group>

        {user.isAdmin && (
          <Group title="Deployment owner">
            <Link
              href="/admin"
              className="press flex items-center gap-3 px-3.5 py-2.5 first:rounded-t-[13px] last:rounded-b-[13px] hover:bg-white/[0.035]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-accent-text">
                <KeyRound size={13} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-ink">Admin console</span>
                <span className="block text-[11.5px] text-muted">
                  Provider keys and the model catalog, without a redeploy.
                </span>
              </span>
              <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />
            </Link>
          </Group>
        )}

        <Group title="Workspace">
          {graceCodeEnabled && projectsEnabled && (
            <Link
              href="/code"
              className="press flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.035]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-accent-text">
                <Code2 size={13} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-ink">Grace Code</span>
                <span className="block text-[11.5px] text-muted">
                  A coding workspace that reads files and writes changes back.
                </span>
              </span>
              <ChevronRight size={13} className="shrink-0 text-muted" aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              router.replace("/");
              router.refresh();
            }}
            className={`press flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.035] ${
              graceCodeEnabled ? "border-t border-hairline" : ""
            }`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-danger/10 text-danger">
              <LogOut size={13} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-ink">Sign out</span>
              <span className="block text-[11.5px] text-muted">
                You will need your password to come back.
              </span>
            </span>
          </button>
        </Group>

        <p className="mt-8 text-center text-[11px] text-muted">Grace can make mistakes.</p>
      </div>
    </main>
  );
}

/** One labelled group: a heading and a single bordered card of rows. */
function Group({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          {title}
        </h2>
        {action}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface">
        {children}
      </div>
    </section>
  );
}

/** A report row: a label, an optional second line, and a trailing value. */
function Row({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline px-3.5 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-ink">{label}</span>
        {detail && <span className="mt-0.5 block truncate text-[11.5px] text-muted">{detail}</span>}
      </span>
      {children}
    </div>
  );
}
