/**
 * Apex.
 *
 * Apex is the membership tier this product shows everywhere: the plan badge in
 * the usage modal, the "Get Apex" rail button, the benefits list on /apex.
 * These are the facts behind those surfaces. They are constants rather than
 * database rows because capacity and member count are the same for everyone.
 */

export const APEX = {
  name: "Apex",
  price: "$20 / month",
  /** Gracees of monthly capacity a member gets. */
  capacityCredits: 6_000,
  /** How many people can be in the dock before the next cohort opens. */
  memberCap: 10_000,
  /** Seats taken. A fixed, honest demo number until billing exists. */
  members: 9_412,
  trialDays: 7,
  /** Share of extra credits a member gets on a pack. */
  bonusPct: 20,
  uploadGb: 4,
  storageGb: 20,
} as const;

export type ApexBenefit = {
  title: string;
  body: string;
  /** Small label on the right of the row. */
  tag?: string;
};

export const APEX_BENEFITS: ApexBenefit[] = [
  {
    title: "Grace in chat and Grace Forge",
    body: "The full model ladder in both surfaces, with effort up to Ultra.",
    tag: "Included",
  },
  {
    title: "20% bonus on credit packs",
    body: "Every pack you buy lands with a fifth more credits in your balance.",
    tag: "+20%",
  },
  {
    title: "Animated emojis and reactions",
    body: "Reactions move in conversations instead of sitting still.",
  },
  {
    title: "Expanded reactions",
    body: "The whole reaction set, not the short default row.",
    tag: "Full set",
  },
  {
    title: "4 GB uploads",
    body: "One file, four gigabytes — enough for a dataset or a long recording.",
    tag: "4 GB",
  },
  {
    title: "20 GB cloud storage",
    body: "Projects, uploads and workspace files kept between sessions.",
    tag: "20 GB",
  },
  {
    title: "Custom profiles and banners",
    body: "A display name, an avatar and a banner on your shared work.",
  },
  {
    title: "Apex badge",
    body: "The badge sits beside your name wherever your work is shown.",
  },
  {
    title: "Join a 10,000 member dock",
    body: "The Apex dock: early builds, direct threads, and the roadmap.",
    tag: "10,000 seats",
  },
];

/** 0..1 of the dock that is taken, for the capacity bar. */
export function dockFill(members = APEX.members): number {
  return Math.min(1, Math.max(0, members / APEX.memberCap));
}
