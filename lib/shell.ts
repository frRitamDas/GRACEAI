/**
 * Shell data shared by every signed-in page.
 *
 * The sidebar appears on all of them, and it needs the same three facts
 * everywhere: who is signed in, their recent chats, and how much of the month
 * they have used. Loading it once here keeps the pages from drifting apart.
 */

import "server-only";

import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { periodResetLabel } from "@/lib/db/local";
import { getUsage, getUserById, listConversations } from "@/lib/db/store";
import type { ConversationSummary } from "@/lib/client/types";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  plan: string;
  isAdmin: boolean;
  unlimited: boolean;
  credits: number;
  showCreditPercentage: boolean;
};

export type ShellUsage = {
  used: number;
  credits: number;
  allowance: number;
  unlimited: boolean;
  usedPct: number;
  remainingPct: number;
  resets: string;
  plan: string;
};

export type Shell = {
  user: ShellUser;
  usage: ShellUsage;
  conversations: ConversationSummary[];
  /** Full record; pages that need effort or model read it from here. */
  account: SessionUser;
};

export function allowanceFor(plan: string): number {
  if (plan === "apex-pro") return 12_000;
  if (plan === "apex") return 3_000;
  return 250;
}

/**
 * 0..100 of the monthly allowance that has been spent.
 *
 * The denominator is the allowance alone. Folding the credit balance into it
 * (as the old ring did) made a fresh Apex account read 0% forever, which is
 * the one number the reference screenshot makes a promise about.
 */
export function usedPercent(account: SessionUser, used: number): number {
  if (account.unlimited) return 0;
  const allowance = allowanceFor(account.plan);
  if (allowance <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / allowance) * 100)));
}

export async function loadShell(): Promise<Shell | null> {
  const session = await getCurrentUser();
  if (!session) return null;

  const [usage, conversations, fresh] = await Promise.all([
    getUsage(session.id),
    listConversations(session.id),
    getUserById(session.id),
  ]);
  const account = fresh ?? session;
  const pct = usedPercent(account, usage.used);

  return {
    account,
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      plan: account.plan,
      isAdmin: account.isAdmin,
      unlimited: account.unlimited,
      credits: account.credits,
      showCreditPercentage: account.showCreditPercentage,
    },
    usage: {
      used: usage.used,
      credits: account.credits,
      allowance: account.unlimited ? Number.POSITIVE_INFINITY : allowanceFor(account.plan),
      unlimited: account.unlimited,
      usedPct: pct,
      remainingPct: account.unlimited ? 100 : Math.max(0, 100 - pct),
      resets: periodResetLabel(),
      plan: account.plan,
    },
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
    })),
  };
}
