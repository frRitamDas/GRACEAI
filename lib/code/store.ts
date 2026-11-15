import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  localMode,
  newId,
  nowIso,
  readLocalDb,
  withLocalDb,
} from "@/lib/db/local";
import { getModel, type ModelDef } from "@/lib/ai/catalog";
import { cachedCatalog, storeCatalog } from "@/lib/ai/catalog-cache";
import { loadCatalog } from "@/lib/ai/discovery";
import { getProviderKey } from "@/lib/ai/env";
import { streamChat, type ChatTurn } from "@/lib/ai/chat";
import { codingSystemPrompt, extractFileBlocks } from "@/lib/ai/coding";

/**
 * Grace Code: projects, and the rules the agent works under.
 *
 * A project is the unit the agent is allowed to touch. Files live in the store
 * as text, and the agent proposes changes rather than writing them, so this
 * module also owns the "safe patch" logic: every proposed file has to be
 * validated and applied in one place, and that place has to be boring enough to
 * trust.
 */

export type Project = {
  id: string;
  userId: string;
  name: string;
  language: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  /** Present when this project is backed by a GitHub repository. */
  repo: { owner: string; name: string; branch: string } | null;
  /**
   * `owner` when this user made the project, `shared` when someone else did.
   * Grace Code only writes for the owner; a shared project opens read-only.
   */
  access?: "owner" | "shared";
};

export type ProjectFile = {
  path: string;
  content: string;
  updatedAt: string;
  /** GitHub blob sha when the file came from a repository. */
  sha?: string | null;
};

export type ChatRole = "user" | "assistant";

export type CodeMessage = {
  id: string;
  projectId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** Files the agent proposed in this turn, already applied. */
  touched: string[];
};

type LocalProjectRow = {
  id: string;
  user_id: string;
  name: string;
  language: string;
  instructions: string;
  created_at: string;
  updated_at: string;
  repo_owner?: string | null;
  repo_name?: string | null;
  repo_branch?: string | null;
  created_by?: string | null;
  shared_with?: string[] | null;
};

type LocalCodeMessageRow = {
  id: string;
  project_id: string;
  role: ChatRole;
  content: string;
  touched: string[];
  created_at: string;
};


const toProject = (row: LocalProjectRow): Project => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  language: row.language,
  instructions: row.instructions,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  repo:
    row.repo_owner && row.repo_name
      ? {
          owner: row.repo_owner,
          name: row.repo_name,
          branch: row.repo_branch || "main",
        }
      : null,
  access: "owner",
});

const toMessage = (row: LocalCodeMessageRow): CodeMessage => ({
  id: row.id,
  projectId: row.project_id,
  role: row.role,
  content: row.content,
  touched: Array.isArray(row.touched) ? row.touched : [],
  createdAt: row.created_at,
});

// ------------------------------------------------------------------ projects

export async function listProjects(userId: string): Promise<Project[]> {
  if (localMode()) {
    const rows = await readLocalDb((db) => db.codeProjects ?? []);
    return rows
      .filter((r) => r.user_id === userId || (r.shared_with ?? []).includes(userId))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((r) => ({
        ...toProject(r),
        access: r.user_id === userId ? "owner" : "shared",
      }));
  }
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const [owned, shared] = await Promise.all([
      supabase
        .from("grace_code_projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("grace_code_projects")
        .select("*")
        .contains("shared_with", [userId])
        .order("updated_at", { ascending: false }),
    ]);
    const seen = new Set<string>();
    const merged: Project[] = [];
    for (const row of (owned.data ?? []) as LocalProjectRow[]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push({ ...toProject(row), access: "owner" });
    }
    for (const row of (shared.data ?? []) as LocalProjectRow[]) {
      if (seen.has(row.id) || row.user_id === userId) continue;
      seen.add(row.id);
      merged.push({ ...toProject(row), access: "shared" });
    }
    return merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return [];
}

export async function getProject(userId: string, id: string): Promise<Project | null> {
  if (localMode()) {
    const rows = await readLocalDb((db) => db.codeProjects ?? []);
    const row = rows.find(
      (r) => r.id === id && (r.user_id === userId || (r.shared_with ?? []).includes(userId))
    );
    if (!row) return null;
    return { ...toProject(row), access: row.user_id === userId ? "owner" : "shared" };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("grace_code_projects")
    .select("*")
    .eq("id", id)
    .or(`user_id.eq.${userId},shared_with.cs.{${userId}}`)
    .maybeSingle();
  if (!data) return null;
  const row = data as LocalProjectRow;
  return { ...toProject(row), access: row.user_id === userId ? "owner" : "shared" };
}

/** Starter files so a new project is never an empty void. */
function starterFiles(name: string, language: string): { path: string; content: string }[] {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-|-$/g, "") || "project";
  if (language === "python") {
    return [
      {
        path: "main.py",
        content: `"""${name}\n\nDescribe what this does in a sentence. Run it with \`python main.py\`.\n"""\n\n\ndef main() -> None:\n    print("Hello from ${name}")\n\n\nif __name__ == "__main__":\n    main()\n`,
      },
      {
        path: "README.md",
        content: `# ${name}\n\nA Python project scaffolded in Grace Code.\n`,
      },
      { path: ".gitignore", content: "__pycache__/\n*.pyc\n.venv/\n.env\n" },
    ];
  }
  if (language === "typescript") {
    return [
      {
        path: "src/index.ts",
        content: `/** ${name}. Run with \`npx tsx src/index.ts\`. */\n\nexport function main(): void {\n  console.log("Hello from ${name}");\n}\n\nmain();\n`,
      },
      { path: "README.md", content: `# ${name}\n\nA TypeScript project scaffolded in Grace Code.\n` },
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n" },
    ];
  }
  if (language === "go") {
    return [
      {
        path: "main.go",
        content: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from ${name}")\n}\n`,
      },
      { path: "README.md", content: `# ${name}\n\nA Go project scaffolded in Grace Code.\n` },
    ];
  }
  if (language === "html") {
    return [
      {
        path: "index.html",
        content: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${name}</title>\n    <link rel="stylesheet" href="style.css" />\n  </head>\n  <body>\n    <h1>${name}</h1>\n    <script src="script.js"></script>\n  </body>\n</html>\n`,
      },
      {
        path: "style.css",
        content: `:root {\n  color-scheme: dark;\n  font-family: system-ui, sans-serif;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #000;\n  color: #fff;\n}\n`,
      },
      { path: "script.js", content: `console.log("${slug} ready");\n` },
    ];
  }
  return [
    {
      path: "main.js",
      content: `/** ${name}. Run with \`node main.js\`. */\n\nfunction main() {\n  console.log("Hello from ${name}");\n}\n\nmain();\n`,
    },
    { path: "README.md", content: `# ${name}\n\nA JavaScript project scaffolded in Grace Code.\n` },
    { path: ".gitignore", content: "node_modules/\n.env\n" },
  ];
}

export async function createProject(
  userId: string,
  input: {
    name: string;
    language: string;
    instructions?: string;
    repo?: { owner: string; name: string; branch: string } | null;
  }
): Promise<Project> {
  const now = nowIso();
  const project: Project = {
    id: newId(),
    userId,
    name: input.name.trim().slice(0, 80) || "Untitled project",
    language: input.language,
    instructions: (input.instructions ?? "").slice(0, 2000),
    createdAt: now,
    updatedAt: now,
    repo: input.repo ?? null,
  };
  const files = starterFiles(project.name, project.language);

  if (localMode()) {
    await withLocalDb((db) => {
      db.codeProjects = [...(db.codeProjects ?? []), {
        id: project.id,
        user_id: project.userId,
        name: project.name,
        language: project.language,
        instructions: project.instructions,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        repo_owner: project.repo?.owner ?? null,
        repo_name: project.repo?.name ?? null,
        repo_branch: project.repo?.branch ?? null,
      }];
      db.codeFiles = [
        ...(db.codeFiles ?? []),
        ...files.map((f) => ({
          project_id: project.id,
          path: f.path,
          content: f.content,
          updated_at: now,
        })),
      ];
    });
    return project;
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("grace_code_projects").insert({
      id: project.id,
      user_id: project.userId,
      name: project.name,
      language: project.language,
      instructions: project.instructions,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
      repo_owner: project.repo?.owner ?? null,
      repo_name: project.repo?.name ?? null,
      repo_branch: project.repo?.branch ?? null,
    });
    await supabase.from("grace_code_files").insert(
      files.map((f) => ({
        project_id: project.id,
        path: f.path,
        content: f.content,
        updated_at: now,
      }))
    );
  }
  return project;
}

export async function updateProject(
  userId: string,
  id: string,
  patch: { name?: string; instructions?: string }
) {
  const now = nowIso();
  if (localMode()) {
    await withLocalDb((db) => {
      const row = (db.codeProjects ?? []).find((r) => r.id === id && r.user_id === userId);
      if (!row) return;
      if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 80) || row.name;
      if (patch.instructions !== undefined) row.instructions = patch.instructions.slice(0, 2000);
      row.updated_at = now;
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const update: Record<string, unknown> = { updated_at: now };
  if (patch.name !== undefined) update.name = patch.name.trim().slice(0, 80);
  if (patch.instructions !== undefined) update.instructions = patch.instructions.slice(0, 2000);
  await supabase.from("grace_code_projects").update(update).eq("id", id).eq("user_id", userId);
}

export async function deleteProject(userId: string, id: string) {
  if (localMode()) {
    await withLocalDb((db) => {
      db.codeProjects = (db.codeProjects ?? []).filter((r) => !(r.id === id && r.user_id === userId));
      db.codeFiles = (db.codeFiles ?? []).filter((r) => r.project_id !== id);
      db.codeMessages = (db.codeMessages ?? []).filter((r) => r.project_id !== id);
    });
    return;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const owned = await getProject(userId, id);
  if (!owned) return;
  await supabase.from("grace_code_files").delete().eq("project_id", id);
  await supabase.from("grace_code_messages").delete().eq("project_id", id);
  await supabase.from("grace_code_projects").delete().eq("id", id);
}

// --------------------------------------------------------------------- files

export async function listFiles(projectId: string): Promise<ProjectFile[]> {
  if (localMode()) {
    const rows = await readLocalDb((db) => db.codeFiles ?? []);
    return rows
      .filter((r) => r.project_id === projectId)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((r) => ({
        path: r.path,
        content: r.content,
        updatedAt: r.updated_at,
        sha: r.sha ?? null,
      }));
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("grace_code_files")
    .select("path, content, updated_at, sha")
    .eq("project_id", projectId)
    .order("path");
  return (data ?? []).map((r) => ({
    path: String(r.path),
    content: String(r.content ?? ""),
    updatedAt: String(r.updated_at ?? nowIso()),
    sha: (r.sha as string | null) ?? null,
  }));
}

/**
 * Paths are the agent's handle on a file, so they get tightened, not trusted.
 *
 * A leading slash is stripped rather than rejected: models write `/src/app.js`
 * when they mean the project root, and that is a reasonable thing to mean. `..`
 * is rejected outright — there is no parent directory here to reach.
 */
export function safePath(input: string): string | null {
  const cleaned = input.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.length > 200) return null;
  if (cleaned.split("/").some((part) => part === ".." || part === "." || part === "")) return null;
  if (!/^[a-zA-Z0-9._\-/]+$/.test(cleaned)) return null;
  return cleaned;
}

export async function writeFile(
  projectId: string,
  path: string,
  content: string,
  sha?: string | null
) {
  const safe = safePath(path);
  if (!safe) return false;
  const now = nowIso();
  if (localMode()) {
    await withLocalDb((db) => {
      db.codeFiles = db.codeFiles ?? [];
      const existing = db.codeFiles.find((r) => r.project_id === projectId && r.path === safe);
      if (existing) {
        existing.content = content;
        existing.updated_at = now;
        if (sha !== undefined) existing.sha = sha;
      } else {
        db.codeFiles.push({
          project_id: projectId,
          path: safe,
          content,
          updated_at: now,
          sha: sha ?? null,
        });
      }
    });
    return true;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("grace_code_files")
    .upsert(
      { project_id: projectId, path: safe, content, updated_at: now, sha: sha ?? null },
      { onConflict: "project_id,path" }
    );
  return !error;
}

export async function deleteFile(projectId: string, path: string) {
  const safe = safePath(path);
  if (!safe) return false;
  if (localMode()) {
    await withLocalDb((db) => {
      db.codeFiles = (db.codeFiles ?? []).filter(
        (r) => !(r.project_id === projectId && r.path === safe)
      );
    });
    return true;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("grace_code_files")
    .delete()
    .eq("project_id", projectId)
    .eq("path", safe);
  return !error;
}

// ------------------------------------------------------------------ messages

export async function listMessages(projectId: string): Promise<CodeMessage[]> {
  if (localMode()) {
    const rows = await readLocalDb((db) => db.codeMessages ?? []);
    return rows
      .filter((r) => r.project_id === projectId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(toMessage);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("grace_code_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  return (data ?? []).map((r) => toMessage(r as LocalCodeMessageRow));
}

export async function addMessage(input: {
  projectId: string;
  role: ChatRole;
  content: string;
  touched?: string[];
}): Promise<CodeMessage> {
  const row: LocalCodeMessageRow = {
    id: newId(),
    project_id: input.projectId,
    role: input.role,
    content: input.content,
    touched: input.touched ?? [],
    created_at: nowIso(),
  };
  if (localMode()) {
    await withLocalDb((db) => {
      db.codeMessages = [...(db.codeMessages ?? []), row];
    });
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) await supabase.from("grace_code_messages").insert(row);
  }
  return toMessage(row);
}

// ------------------------------------------------------------------ the agent

/**
 * System prompt for the coding agent.
 *
 * The contract that matters: it answers with prose *and* fenced blocks tagged
 * with a path, because that is the only format the app knows how to apply. It
 * is told to keep existing code working, to say when it is unsure, and never to
 * claim it ran anything — it cannot.
 */
/**
 * Grace Code's turn prompt. The doctrine lives in `lib/ai/coding` so the chat
 * workspace and this app give the same answers to "how do you work".
 */
function systemPrompt(project: Project, files: ProjectFile[], focus?: string | null): string {
  return codingSystemPrompt({
    projectName: project.name,
    language: project.language,
    files: files.map((f) => ({ path: f.path, content: f.content })),
    instructions: project.instructions,
    focus: focus ?? null,
    context: project.repo
      ? `This project is linked to GitHub \`${project.repo.owner}/${project.repo.name}\` on branch \`${project.repo.branch}\`. Changes you write are local until the user pushes them; say so if a task would need a commit.`
      : undefined,
    // Grace Code shows whole files in an editor, so it can afford more context
    // than a chat turn where the reply has to stay readable.
    maxChars: 160_000,
  });
}

/**
 * Pulls `path`-tagged fenced blocks out of a reply.
 *
 * Models are inconsistent about fences, so this is deliberately forgiving: an
 * unterminated block still counts, and a tag that looks like a path is enough.
 * The text left behind is what the user reads as the explanation.
 */
export function extractPatches(
  reply: string,
  known: string[]
): { text: string; patches: { path: string; content: string }[] } {
  // Delegated: the chat workspace applies the same blocks, so there is one
  // parser to keep correct rather than two that drift apart.
  const { text, patches } = extractFileBlocks(reply, known);
  return {
    text,
    patches: patches
      .map((p) => ({ path: safePath(p.path) ?? "", content: p.content }))
      .filter((p) => p.path.length > 0) as { path: string; content: string }[],
  };
}

async function pickCodeModel(preferred: string | null): Promise<{ model: ModelDef; key: string } | null> {
  const cached = cachedCatalog();
  const catalog = cached ?? (await (async () => {
    const built = await loadCatalog();
    storeCatalog(built);
    return built;
  })());
  const candidates: ModelDef[] = [];
  if (preferred) {
    const chosen = getModel(preferred, catalog.models);
    if (chosen) candidates.push(chosen);
  }
  // Coding wants reasoning, but availability beats preference: try the strongest
  // models first and fall back to whatever the deployment can actually reach.
  candidates.push(
    ...catalog.models
      .filter((m) => m.tier >= 3 && !m.free)
      .sort((a, b) => b.tier - a.tier || a.credits - b.credits)
  );
  candidates.push(...catalog.models.filter((m) => m.free).sort((a, b) => b.tier - a.tier));

  for (const model of candidates) {
    const key = await getProviderKey(model.provider);
    if (key) return { model, key };
  }
  return null;
}

export type CodeStreamEvent =
  | { type: "meta"; modelName: string; patches: string[] }
  | { type: "status"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: CodeMessage; applied: string[] }
  | { type: "error"; message: string };

/**
 * Runs one agent turn: build the prompt, stream the model, then apply whatever
 * the model asked to change and record the turn.
 *
 * Applying only after the stream finishes keeps a half-written reply from
 * leaving a project in a state nobody chose.
 */
export async function* runCodeTurn(options: {
  project: Project;
  files: ProjectFile[];
  history: CodeMessage[];
  prompt: string;
  preferredModel: string | null;
  /** File the user is looking at, so the agent reads it first. */
  focus?: string | null;
  signal?: AbortSignal;
}): AsyncGenerator<CodeStreamEvent> {
  const { project, files, history, prompt, preferredModel, focus, signal } = options;

  const picked = await pickCodeModel(preferredModel);
  if (!picked) {
    yield {
      type: "error",
      message:
        "No model is available for coding yet. The owner needs to connect a provider before Grace Code can run.",
    };
    return;
  }

  const turns: ChatTurn[] = [
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: prompt },
  ];

  yield { type: "meta", modelName: picked.model.name, patches: files.map((f) => f.path) };

  let reply = "";
  for await (const event of streamChat({
    key: picked.key,
    model: picked.model,
    // Coding is reasoning work: never run the cheapest effort level for it.
    effortIndex: 3,
    turns,
    attachments: [],
    systemPrompt: systemPrompt(project, files, focus),
    signal,
  })) {
    if (event.type === "status") yield { type: "status", label: event.label };
    if (event.type === "delta") {
      reply += event.text;
      yield { type: "delta", text: event.text };
    }
    if (event.type === "error") {
      yield { type: "error", message: event.message };
      return;
    }
  }

  const { text, patches } = extractPatches(reply, files.map((f) => f.path));

  const applied: string[] = [];
  for (const patch of patches) {
    // Replacing a file wholesale is what the prompt asks for, but an empty body
    // is almost always a truncated stream, not an intent to erase.
    if (patch.content.trim().length === 0) continue;
    if (await writeFile(project.id, patch.path, patch.content)) applied.push(patch.path);
  }

  const stored = await addMessage({
    projectId: project.id,
    role: "assistant",
    content: text || (applied.length ? `Updated ${applied.join(", ")}.` : reply.trim()),
    touched: applied,
  });

  yield { type: "done", message: stored, applied };
}
