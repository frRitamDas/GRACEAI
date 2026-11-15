import "server-only";

/**
 * Billing.
 *
 * Grace has no payment provider connected, so this module ships the whole
 * purchase flow except the part that would be a lie: a checkout session. When
 * Stripe keys exist the endpoint returns a real session URL; until then it
 * reports `configured: false` and the UI names the blocker instead of showing
 * a button that pretends to charge.
 */

export type CheckoutKind = "credits" | "apex";

export type CheckoutResult =
  | { configured: true; url: string }
  | { configured: false; reason: string };

export const CREDIT_PACKS = [
  { id: "small", credits: 500, price: "$5" },
  { id: "medium", credits: 2_000, price: "$18" },
  { id: "large", credits: 5_000, price: "$40" },
] as const;

export const APEX_PRICE = "$20 / month";

/** True when a payment provider's secret is present on the server. */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function createCheckout(
  _userId: string,
  kind: CheckoutKind
): Promise<CheckoutResult> {
  if (!billingConfigured()) {
    return {
      configured: false,
      reason:
        "Checkout is not connected yet. The owner needs to add a payment provider (STRIPE_SECRET_KEY) before credits can be bought.",
    };
  }
  // A configured provider still has no server route to call until the price ids
  // are set; say which piece is missing instead of returning a dead URL.
  return {
    configured: false,
    reason: `${kind === "apex" ? "Apex" : "Credit"} checkout needs a price id for this plan.`,
  };
}
