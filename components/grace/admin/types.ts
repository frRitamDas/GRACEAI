/** Shapes shared by the console's panels. One place, so the API and the UI cannot drift. */

export type Member = {
  id: string;
  name: string;
  email: string;
  plan: string;
  isAdmin: boolean;
  unlimited: boolean;
  credits: number;
  createdAt: string;
  conversations: number;
  used: number;
};

export type ProviderStatus = {
  id: string;
  label: string;
  blurb: string;
  envKey: string;
  docsUrl: string;
  configured: boolean;
  source: "env" | "console" | "none";
};

export type ConsoleData = {
  providers: ProviderStatus[];
  backend: string;
  ephemeral: boolean;
};
