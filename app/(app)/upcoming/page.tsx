import { redirect } from "next/navigation";

import { UpcomingView } from "@/components/grace/upcoming-view";
import { getCurrentUser } from "@/lib/auth/session";
import { listDismissals } from "@/lib/db/social";
import { UPCOMING } from "@/lib/upcoming";

export const instant = false;

export const metadata = { title: "Upcoming" };

export default async function UpcomingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const dismissed = await listDismissals(user.id);
  return <UpcomingView items={UPCOMING} dismissed={dismissed} />;
}
