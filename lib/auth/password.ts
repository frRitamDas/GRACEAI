import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const KEYLEN = 64;

/** scrypt hash: `scrypt$<salt b64>$<hash b64>` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltB64, "base64"),
    expected.length
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}
