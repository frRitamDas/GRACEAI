"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Crown, Loader2, Minus, Search, ShieldCheck, UserPlus } from "lucide-react";

import type { Member } from "@/components/grace/admin/types";

/**
 * Membership, by email.
 *
 * The owner's mental model is "I know their address, give them access" — not
 * "find the id, open a record, pick a role". So the first control on this panel
 * is an address, and the answer is either granted or explained. Everything else
 * (revoking, promoting, scanning usage) is the same list, one row per account.
 *
 * The server refuses two things on purpose and this panel surfaces both:
 * changing your own role, and removing the last owner.
 */

export function MembersPanel({
  members,
  loading,
  onReload,
  onMessage,
  ownerEmail,
}: {
  members: Member[];
  loading: boolean;
  onReload: () => Promise<void>;
  onMessage: (text: string, ok: boolean) => void;
  ownerEmail: string;
}) {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"apex" | "apex-pro">("apex");
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const act = useCallback(
    async (body: Record<string, unknown>, key: string, success: string) => {
      setBusy(key);
      try {
        const response = await fetch("/api/admin/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          onMessage(data.error ?? "That did not save.", false);
          return false;
        }
        onMessage(success, true);
        await onReload();
        return true;
      } catch {
        onMessage("Grace could not reach the server. Nothing changed.", false);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [onMessage, onReload]
  );

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    const ok = await act({ email: address, action: "grant", plan }, `grant:${address}`, `${address} now has ${plan}.`);
    if (ok) setEmail("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.email.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }, [members, query]);

  const counts = useMemo(
    () => ({
      total: members.length,
      granted: members.filter((m) => m.plan !== "free" || m.unlimited).length,
      owners: members.filter((m) => m.isAdmin).length,
      conversations: members.reduce((sum, m) => sum + m.conversations, 0),
    }),
    [members]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------- grant */}
      <section className="rounded-[20px] border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            <UserPlus size={15} className="text-accent" /> Grant membership
          </h2>
          <p className="mt-0.5 max-w-[62ch] text-[12.5px] leading-[18px] text-sub">
            Type the address they signed up with. They keep their account, history and credits; this
            only changes what they are allowed to do.
          </p>
        </div>
        <form onSubmit={grant} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <label className="sr-only" htmlFor="grant-email">
            Email address
          </label>
          <input
            id="grant-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={ownerEmail}
            className="h-10 min-w-0 flex-1 rounded-[8px] border border-hairline bg-control px-3 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <div className="flex rounded-[8px] bg-control p-0.5" role="group" aria-label="Plan">
              {(["apex", "apex-pro"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={plan === id}
                  onClick={() => setPlan(id)}
                  className={`h-8 rounded-[6px] px-2.5 text-[12px] font-medium capitalize transition-colors ${
                    plan === id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.4)]" : "text-sub hover:text-ink"
                  }`}
                >
                  {id === "apex-pro" ? "Apex Pro" : "Apex"}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={busy?.startsWith("grant:") === true || email.trim().length === 0}
              className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-black disabled:opacity-40"
            >
              {busy?.startsWith("grant:") ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Grant
            </button>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------------------- list */}
      <section className="overflow-hidden rounded-[20px] border border-hairline bg-surface">
        <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Members</h2>
            <p className="mt-0.5 text-[12.5px] text-sub">
              {counts.total} accounts · {counts.granted} with membership · {counts.owners} owner
              {counts.owners === 1 ? "" : "s"} · {counts.conversations} chats
            </p>
          </div>
          <div className="relative sm:w-[220px]">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by email or name"
              aria-label="Search members"
              className="h-8 w-full rounded-[8px] border border-hairline bg-control pl-7 pr-2.5 text-[12.5px] text-ink outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 px-5 py-8 text-[13px] text-sub">
            <Loader2 size={14} className="animate-spin" /> Reading accounts
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-sub">
            {members.length === 0 ? "No one has signed up yet." : "Nothing matches that search."}
          </p>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {filtered.map((member) => {
              const isOwner = member.isAdmin;
              const granted = member.plan !== "free" || member.unlimited;
              return (
                <li key={member.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                        isOwner ? "bg-[#F4C406] text-[#252523]" : "bg-control text-sub"
                      }`}
                      aria-hidden="true"
                    >
                      {(member.name || member.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-ink">
                        <span className="truncate">{member.name || member.email.split("@")[0]}</span>
                        {isOwner && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#F4C406]/15 px-1.5 py-px text-[10px] font-semibold text-[#E0B341]">
                            <ShieldCheck size={9} /> owner
                          </span>
                        )}
                        {granted && !isOwner && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent-text">
                            <Crown size={9} /> {member.plan}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11.5px] text-muted">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 pl-10 text-[11px] tabular-nums text-muted sm:pl-0">
                    <span title="Conversations">{member.conversations} chats</span>
                    <span title="Credits used this month">{member.used} used</span>
                    <span title="Credits remaining">{member.unlimited ? "∞" : member.credits} left</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 pl-10 sm:pl-0">
                    {!isOwner && (
                      <>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            granted
                              ? void act(
                                  { email: member.email, action: "revoke" },
                                  `plan:${member.id}`,
                                  `${member.email} is back on Free.`
                                )
                              : void act(
                                  { email: member.email, action: "grant", plan },
                                  `plan:${member.id}`,
                                  `${member.email} now has ${plan}.`
                                )
                          }
                          className="h-7 rounded-full px-2.5 text-[11.5px] font-medium text-sub transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
                        >
                          {granted ? "Revoke" : "Grant"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void act(
                              { email: member.email, action: "promote" },
                              `role:${member.id}`,
                              `${member.email} is now an owner.`
                            )
                          }
                          className="h-7 rounded-full px-2.5 text-[11.5px] font-medium text-sub transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
                        >
                          Make owner
                        </button>
                      </>
                    )}
                    {isOwner && member.email.toLowerCase() !== ownerEmail.toLowerCase() && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void act(
                            { email: member.email, action: "demote" },
                            `role:${member.id}`,
                            `${member.email} is no longer an owner.`
                          )
                        }
                        className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium text-sub transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
                      >
                        <Minus size={11} /> Demote
                      </button>
                    )}
                    {member.email.toLowerCase() === ownerEmail.toLowerCase() && (
                      <span className="px-2 text-[11px] text-muted">you</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
