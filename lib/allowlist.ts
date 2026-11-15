/**
 * The owner's address.
 *
 * Two things need to know it without a database read:
 *
 *   1. The very first account on a fresh deployment should be the owner, not
 *      whoever happens to sign up first.
 *   2. This address should land as Apex without a console click.
 *
 * It is a constant rather than a secret: the address is the deployment owner,
 * which the console already shows. Override it with GRACE_OWNER_EMAIL when the
 * deployment belongs to someone else.
 */
export const OWNER_EMAIL = (process.env.GRACE_OWNER_EMAIL ?? "ritam73592@gmail.com").trim().toLowerCase();

export function isOwnerEmail(email: string): boolean {
  return email.trim().toLowerCase() === OWNER_EMAIL;
}
