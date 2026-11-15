#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the database in POSTGRES_URL.
 * Run with: npm run db:push
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.POSTGRES_URL ?? process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Set POSTGRES_URL (Supabase → Project settings → Database → Connection string) first."
  );
  process.exit(1);
}

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: url.includes("sslmode=disable") ? false : "require",
  onnotice: () => {},
});

try {
  for (const file of files) {
    const body = await readFile(path.join(dir, file), "utf8");
    console.log(`→ ${file}`);
    await sql.unsafe(body);
  }
  console.log("Done. Tables are ready.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
