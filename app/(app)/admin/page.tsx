import { redirect } from "next/navigation";

import { AdminView } from "@/components/grace/admin-view";
import { getCurrentUser } from "@/lib/auth/session";

// Session cookies are read on every request, so this route blocks by design.
export const instant = false;

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.isAdmin) redirect("/");

  return <AdminView />;
}
