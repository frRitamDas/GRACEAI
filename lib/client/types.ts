export type SessionUserView = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  unlimited: boolean;
  plan: string;
  credits: number;
  effort: number;
  showCreditPercentage: boolean;
};

export type UsageView = {
  used: number;
  credits: number;
  allowance: number;
  unlimited: boolean;
  usedPct: number;
  remainingPct: number;
  resets: string;
  plan: string;
};

export type AttachmentView = {
  id: string;
  name: string;
  mime: string;
  size: number;
  text?: string;
  dataUrl?: string;
  kind: "image" | "document";
};

/** A chat as the shell lists it. Timestamps are ISO strings. */
export type ConversationSummary = { id: string; title: string; updatedAt: string };
