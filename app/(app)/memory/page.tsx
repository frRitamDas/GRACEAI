import { redirect } from "next/navigation";

import { MemoryView } from "@/components/grace/memory-view";
import { getCurrentUser } from "@/lib/auth/session";
import { listMemories } from "@/lib/db/social";

export const instant = false;

export const metadata = { title: "Memory — Grace" };

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const memories = await listMemories(user.id);
  return <MemoryView initial={memories} />;
}
