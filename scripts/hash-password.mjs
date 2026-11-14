#!/usr/bin/env node
/**
 * Prints a `scrypt$salt$hash` value for the given password, matching what
 * lib/auth/password.ts verifies. Use it to set or rotate an account password:
 *
 *   node scripts/hash-password.mjs 'a new password'
 *   update grace_users set password_hash = '<printed value>'
 *     where email = 'someone@example.com';
 *
 * Never store the plaintext anywhere.
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Use at least 8 characters, like the sign-up form does.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password.normalize("NFKC"), salt, 64);
console.log(`scrypt$${salt.toString("base64")}$${hash.toString("base64")}`);
