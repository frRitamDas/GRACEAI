import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings, saveSettings, type SettingsPatch } from "@/lib/settings";

/**
 * The deployment controls.
 *
 * Read: the whole settings object, so the console can render every switch.
 * Write: a partial patch, validated field by field. Only the owner may write;
 * there is no second role, and nothing here is reachable from a session cookie
 * alone without the is_admin claim.
 */

const greetingTuple = z.tuple([z.string().max(120), z.string().max(120), z.string().max(120)]);
function safeAnnouncementHref(href: string): boolean {
  if (!href) return true;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      return !url.username && !url.password;
    } catch {
      return false;
    }
  }
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  try {
    return new URL(href, "https://grace.invalid").origin === "https://grace.invalid";
  } catch {
    return false;
  }
}

const announcementHref = z
  .string()
  .trim()
  .max(300)
  .refine(safeAnnouncementHref, "Use a local path or an http(s) URL.");

const schema = z
  .object({
    brandName: z.string().trim().min(1).max(40).optional(),
    tagline: z.string().trim().max(160).optional(),
    chatEnabled: z.boolean().optional(),
    signupEnabled: z.boolean().optional(),
    greetings: greetingTuple.optional(),
    announcement: z
      .object({
        id: z.string().max(40),
        text: z.string().trim().min(1).max(200),
        href: announcementHref,
      })
      .nullable()
      .optional(),
    chatModel: z.string().trim().max(160).optional(),
    allowedModels: z.array(z.string().max(160)).max(60).optional(),
    hiddenModels: z.array(z.string().max(160)).max(200).optional(),
    footerNote: z.string().trim().max(120).optional(),
    features: z
      .object({
        graceCode: z.boolean(),
        projects: z.boolean(),
        memory: z.boolean(),
        apex: z.boolean(),
        attachments: z.boolean(),
        deepResearch: z.boolean(),
      })
      .partial()
      .optional(),
  })
  .strict();

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to open the console.", 401);
  if (!user.isAdmin) return jsonError("This console is for the deployment owner.", 403);
  return NextResponse.json({ settings: await getSettings() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to open the console.", 401);
  if (!user.isAdmin) return jsonError("This console is for the deployment owner.", 403);

  const body = await parseJson(request, schema);
  if (body instanceof NextResponse) return body;

  const patch = body as SettingsPatch;
  const saved = await saveSettings(patch);

  return NextResponse.json({ settings: saved });
}
