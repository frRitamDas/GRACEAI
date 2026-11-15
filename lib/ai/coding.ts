import "server-only";

/**
 * How Grace works on code.
 *
 * One doctrine, shared by the chat agent and by Grace Code, because two
 * different personalities for "write this for me" is a bug in the product
 * rather than a feature. Everything here is chosen for long-horizon work: the
 * expensive failures are not typos, they are a model that rewrites a file it
 * did not need to touch, drops an edge case it never mentioned, or claims a fix
 * it could not have verified.
 *
 * The rules are written as instructions a model can follow, not as advice.
 */

/** The house style every turn carries. */
export const CODING_RULES = `## How you work

You are a senior engineer pairing with someone who owns this codebase. Behave like one: read before you write, change as little as possible, and say what you actually verified.

**Read first.** You are given the project's files. Read the ones that matter before proposing anything. If a change touches three files, understand all three. Never guess at an API that is visible in the files you were handed.

**Prefer the smallest correct change.** A rewrite is a last resort, not a first move. If a two-line edit fixes it, make the two-line edit. Do not reformat, rename, or "clean up" code you were not asked to touch — every unnecessary line is a diff someone has to review.

**Take the whole job.** If the request implies follow-on work — a new endpoint needs a route, a handler, and validation — do all of it in this turn rather than leaving a trail of half-wired pieces. But if the request is genuinely large, do the coherent first slice and say plainly what is left.

**Handle the unhappy paths.** Things fail: the network drops, the field is missing, the array is empty, the user is not signed in. Handle what is reachable from the code in front of you. Do not invent elaborate error machinery for situations that cannot occur.

**Keep types and contracts honest.** Match the existing style of the file you are editing — its indentation, its quote style, its error handling, its naming. A file that looks like it was written by two people is worse than one written badly by one person.

**Never claim what you did not verify.** You cannot run this project. So do not write "tested", "works", or "this fixes it". Write what you changed and what it assumes. If something is a guess, mark it as one in a single short sentence.`;

/** The file-block protocol, so the server can apply changes deterministically. */
export const PATCH_PROTOCOL = `## Writing files back

When you change or create a file, end your reply with one fenced block per file whose info string is the file's path:

\`\`\`src/app/route.ts
<the complete new contents of the file>
\`\`\`

Rules for those blocks:
- Send the **whole file**. A block replaces the file; it does not patch it.
- Use the exact path from the file list. New files get a path that fits the project.
- Only include files you are actually changing. Explaining a file is not changing it.
- A block must be complete and syntactically valid. A truncated block is worse than no block, because it will be written.
- Put your explanation **before** the blocks, as prose. Short: what you changed and why, in the order a reviewer would read it.`;

/**
 * Builds the system prompt for a coding turn.
 *
 * `files` are the real contents the agent can see, so the manifest doubles as
 * its map of the project. Context is capped: a model handed 200k characters of
 * a repository spends its budget reading instead of thinking.
 */
export function codingSystemPrompt(options: {
  projectName: string;
  language?: string;
  files: { path: string; content: string }[];
  instructions?: string;
  /** Extra context, e.g. "this workspace is linked to owner/repo@main". */
  context?: string;
  /** Files the user currently has open, worth reading first. */
  focus?: string | null;
  maxChars?: number;
}): string {
  const maxChars = options.maxChars ?? 120_000;
  const manifest = options.files
    .map((f) => `- ${f.path} (${f.content.split("\n").length} lines)`)
    .join("\n");

  // Whole files, smallest first, until the budget is gone. Smallest-first keeps
  // the number of usable files high; a single 90k-line dump would crowd out
  // everything else and still not be readable.
  const ordered = [...options.files].sort((a, b) => a.content.length - b.content.length);
  const picked: string[] = [];
  let budget = maxChars;
  const skipped: string[] = [];
  for (const file of ordered) {
    const block = `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``;
    if (block.length > budget) {
      skipped.push(file.path);
      continue;
    }
    picked.push(block);
    budget -= block.length;
  }

  return [
    `You are Grace, working inside the project "${options.projectName}"${options.language ? ` (${options.language})` : ""}.`,
    "",
    CODING_RULES,
    "",
    PATCH_PROTOCOL,
    "",
    "## Project files",
    manifest || "(no files yet)",
    options.focus ? `\nThe user has \`${options.focus}\` open right now.` : "",
    "",
    "## Contents",
    picked.join("\n\n") || "(no file contents yet)",
    skipped.length
      ? `\nNot included, to stay within context: ${skipped.slice(0, 20).join(", ")}. Ask if you need one.`
      : "",
    options.context ? `\n## Workspace\n${options.context}` : "",
    options.instructions?.trim()
      ? `\n## House rules for this project\n${options.instructions.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pulls `path`-tagged fenced blocks out of a reply.
 *
 * Models are inconsistent about fences, so this is forgiving on purpose: an
 * unterminated block still counts, and a tag that looks like a path is enough.
 * What is left behind is what the user reads as the explanation.
 */
/** Tags models are known to write, which must never be read as a file path. */
const LANGUAGE_TAGS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "javascript", "typescript", "json", "jsonc",
  "html", "css", "scss", "sass", "less", "md", "mdx", "txt", "yaml", "yml", "toml",
  "py", "python", "rb", "ruby", "go", "rs", "rust", "java", "kt", "swift", "php",
  "c", "h", "cpp", "cc", "hpp", "cs", "sh", "bash", "zsh", "sql", "graphql", "gql",
  "xml", "svg", "ini", "env", "dockerfile", "makefile", "diff", "patch", "text",
  "console", "shell", "terminal", "output", "plaintext",
]);

/**
 * Turns a fence tag into a file path, or null when the block is not a file.
 *
 * Models announce a file block in whatever order they like — `js src/a.js`,
 * `src/a.js`, `src/a.js title="…"`, occcasionally `./src/a.js`. So each token is
 * judged on its own: known files win first, then anything with a slash or an
 * extension that is not itself a language name.
 */
function pickPath(rawTag: string, known: Set<string>): string | null {
  let tag = rawTag.replace(/[`]/g, "").trim();
  if (!tag) return null;

  const normalise = (token: string) =>
    token
      .replace(/^["']|["']$/g, "")
      .replace(/^\.?\/+/, "")
      .replace(/[:;,]+$/, "")
      .trim();

  const accept = (candidate: string): string | null => {
    const path = normalise(candidate);
    if (!path || path.includes("..")) return null;
    if (LANGUAGE_TAGS.has(path.toLowerCase())) return null;
    return /[/.]/.test(path) ? path : null;
  };

  // An explicit attribute wins: ```` ```tsx title="app/page.tsx" ````.
  const attributed = tag.match(/(?:title|file|filename|path)\s*=\s*["']?([^"'\s]+)/i);
  if (attributed) {
    const path = accept(attributed[1]);
    tag = tag.replace(attributed[0], " ");
    if (path) return path;
  }

  const tokens = tag.split(/[\s,]+/).filter(Boolean);

  // 1. an exact known file, in any position
  for (const token of tokens) {
    const path = normalise(token);
    if (path && known.has(path)) return path;
  }

  // 2. the first token that looks like a relative path rather than a language
  for (const token of tokens) {
    const path = accept(token);
    if (path) return path;
  }

  return null;
}

export function extractFileBlocks(
  reply: string,
  known: string[]
): { text: string; patches: { path: string; content: string }[] } {
  const patches: { path: string; content: string }[] = [];
  const knownSet = new Set(known);

  const fence = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g;
  let match: RegExpExecArray | null;
  let text = reply;

  while ((match = fence.exec(reply)) !== null) {
    const body = match[2].replace(/\n$/, "");
    const path = pickPath(match[1], knownSet);
    // A bare language tag (`js`, `python`) is an illustration, not a file.
    if (!path) continue;
    // Two blocks for one path should not both be applied; the last wins.
    const existing = patches.findIndex((p) => p.path === path);
    if (existing >= 0) patches.splice(existing, 1);
    patches.push({ path, content: body });
    text = text.replace(match[0], "");
  }

  return { text: text.replace(/\n{3,}/g, "\n\n").trim() as string, patches };
}
