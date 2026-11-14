export type SessionUserView = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  unlimited: boolean;
  plan: string;
  credits: number;
  effort: number;
  provider: string;
  model: string | null;
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
