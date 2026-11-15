/**
 * What is shipping next.
 *
 * Kept as data so the page is honest about dates and so a notice can be
 * dismissed per account (the dismissal is stored server-side, in
 * grace_dismissals). Nothing here claims a capability the app already has:
 * shipped items are marked as shipped.
 */

export type UpcomingItem = {
  id: string;
  title: string;
  body: string;
  /** Coarse, honest window. No exact date is promised until it is known. */
  when: string;
  tag: "In build" | "Next" | "Exploring" | "Shipped";
};

export const UPCOMING: UpcomingItem[] = [
  {
    id: "forge",
    title: "Grace Forge",
    body: "A canvas for building small apps with Grace: the project, the preview and the chat on one screen.",
    when: "This quarter",
    tag: "In build",
  },
  {
    id: "image",
    title: "Create an image",
    body: "The third row of the attach menu, wired to an image model. It stays marked Soon until the key and the route exist.",
    when: "Next release",
    tag: "Next",
  },
  {
    id: "mobile",
    title: "Grace on the phone, properly",
    body: "A home-screen app with push notifications when a long answer finishes.",
    when: "Next release",
    tag: "Next",
  },
  {
    id: "workspace-diff",
    title: "Review before write",
    body: "A diff view before the agent saves a file in a workspace, instead of after.",
    when: "Exploring",
    tag: "Exploring",
  },
  {
    id: "desktop",
    title: "The desktop shell",
    body: "Sidebar, search, projects, memory and Apex — shipped and live.",
    when: "Shipped",
    tag: "Shipped",
  },
];
