#!/usr/bin/env node
/**
 * Seeds the local developer store with an owner account so the unlimited path
 * can be exercised without Supabase.
 *
 *   node scripts/seed-local.mjs <email> <password> [name]
 *
 * Only touches `.data/grace-local.json`. Production never uses this store when
 * SUPABASE_URL / POSTGRES_URL is set.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes, randomUUID, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const email = (process.argv[2] ?? "").trim().toLowerCase();
const password = process.argv[3] ?? "";
const name = process.argv[4] ?? "Owner";

if (!email || !password) {
  console.error("Usage: node scripts/seed-local.mjs <email> <password> [name]");
  process.exit(1);
}

const dir = process.env.VERCEL ? path.join(os.tmpdir(), "grace") : path.join(process.cwd(), ".data");
const file = path.join(dir, "grace-local.json");

const empty = {
  users: [],
  sessions: [],
  conversations: [],
  messages: [],
  files: [],
  usage: [],
  providerKeys: [],
};

let db = structuredClone(empty);
try {
  db = { ...empty, ...JSON.parse(await fs.readFile(file, "utf8")) };
} catch {
  // first run
}

const salt = randomBytes(16);
const hash = await scrypt(password.normalize("NFKC"), salt, 64);
const passwordHash = `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;

const existing = db.users.find((u) => u.email === email);
if (existing) {
  existing.name = name;
  existing.password_hash = passwordHash;
  existing.is_admin = true;
  existing.unlimited = true;
  existing.plan = "apex-pro";
  existing.credits = 12000;
} else {
  db.users.push({
    id: randomUUID(),
    email,
    name,
    password_hash: passwordHash,
    is_admin: true,
    unlimited: true,
    plan: "apex-pro",
    credits: 12000,
    effort: 0,
    provider: "openrouter",
    model: null,
    show_credit_percentage: true,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  });
}

await fs.mkdir(dir, { recursive: true });
await fs.writeFile(file, JSON.stringify(db), "utf8");
console.log(`Owner ready in ${file}: ${email} (unlimited, admin)`);
