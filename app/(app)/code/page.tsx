import { redirect } from "next/navigation";

import { CodeApp } from "@/components/grace/code/code-app";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { listProjects } from "@/lib/code/store";

// Sessions are read per request, so this page cannot be static.
export const instant = false;

export const metadata = {
  title: "Code",
  description: "A coding workspace where Grace reads your files and writes the changes back.",
};

export default async function CodePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  // The owner can remove this surface. A URL is not a way around that.
  const settings = await getSettings();
  if (!settings.features.graceCode || !settings.features.projects) redirect("/");

  const projects = await listProjects(user.id);

  return <CodeApp initialProjects={projects} />;
}
