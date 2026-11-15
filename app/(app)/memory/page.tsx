import { redirect } from "next/navigation";

import { MemoryView } from "@/components/grace/memory-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { listMemories } from "@/lib/db/social";

export const instant = false;

export const metadata = { title: "Memory" };

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  // The owner can remove this surface. A URL is not a way around that.
  if (!(await getSettings()).features.memory) redirect("/");

  const memories = await listMemories(user.id);
  return <MemoryView initial={memories} />;
}
