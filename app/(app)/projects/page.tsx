import { redirect } from "next/navigation";

import { ProjectsView } from "@/components/grace/projects-view";
import { getCurrentUser } from "@/lib/auth/session";
import { listFiles, listProjects } from "@/lib/code/store";

export const instant = false;

export const metadata = { title: "Projects — Grace" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");

  const projects = await listProjects(user.id);
  // File counts are only meaningful for the few dozen a person owns; cap the
  // fan-out so a large account cannot turn this page into a hundred queries.
  const withCounts = await Promise.all(
    projects.slice(0, 60).map(async (project) => {
      const files = await listFiles(project.id).catch(() => []);
      return {
        id: project.id,
        name: project.name,
        language: project.language,
        updatedAt: project.updatedAt,
        access: project.access ?? "owner",
        fileCount: files.length,
      };
    })
  );

  return (
    <ProjectsView
      initial={[
        ...withCounts,
        ...projects.slice(60).map((project) => ({
          id: project.id,
          name: project.name,
          language: project.language,
          updatedAt: project.updatedAt,
          access: project.access ?? "owner" as const,
        })),
      ]}
    />
  );
}
