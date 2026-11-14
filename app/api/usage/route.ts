import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { periodResetLabel } from "@/lib/db/local";
import { getUsage, getUserById } from "@/lib/db/store";

/** Powers the header credits ring and the Usage & Limits modal. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null, usage: null });

  const [usage, fresh] = await Promise.all([getUsage(user.id), getUserById(user.id)]);
  const credits = fresh?.credits ?? user.credits;
  const unlimited = Boolean(fresh?.unlimited ?? user.unlimited);
  const allowance = allowanceFor(fresh?.plan ?? user.plan);
  // An unlimited owner's ring reads full: the number is headroom, not a budget.
  const usedPct = unlimited ? 0 : total0(allowance, usage.used, credits);

  return NextResponse.json(
    {
      user: fresh ?? user,
      usage: {
        ...usage,
        credits,
        allowance: unlimited ? Number.POSITIVE_INFINITY : allowance,
        unlimited,
        usedPct: Math.min(100, Math.max(0, usedPct)),
        remainingPct: unlimited ? 100 : Math.min(100, Math.max(0, 100 - usedPct)),
        resets: periodResetLabel(),
        plan: fresh?.plan ?? user.plan,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function total0(allowance: number, used: number, credits: number): number {
  const total = Math.max(allowance, used + credits);
  return total === 0 ? 0 : Math.round((used / total) * 100);
}

function allowanceFor(plan: string): number {
  if (plan === "apex-pro") return 12000;
  if (plan === "apex") return 3000;
  return 250;
}
