import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { extractPdfText } from "@/lib/files/pdf";
import { saveFile } from "@/lib/db/store";
import { getSettings } from "@/lib/settings";

/**
 * Turns an uploaded file into text (and a data URL for images) that the chat
 * route can hand to the model. Sizes are capped so a big PDF cannot stall the
 * function or blow the context window.
 */

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_TEXT = 180_000;

const TEXT_MIMES = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-yaml",
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to attach files.", 401);
  const settings = await getSettings();
  if (!settings.chatEnabled) return jsonError("Chat is paused right now.", 503, { code: "chat_paused" });
  if (!settings.features.attachments) return jsonError("Attachments are turned off on this deployment.", 403, { code: "feature_off" });

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("The upload did not arrive. Try again.");

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a file to attach.");
  if (file.size === 0) return jsonError("That file is empty.");
  if (file.size > MAX_BYTES) return jsonError("Files need to stay under 12 MB.");

  const conversationId = (form.get("conversationId") as string | null) || null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const name = file.name || "attachment";

  let text: string | undefined;
  let dataUrl: string | undefined;

  if (mime.startsWith("image/")) {
    dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    text = undefined;
  } else if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    text = await extractPdfText(bytes);
    if (!text) text = `[${name}] The PDF had no extractable text.`;
  } else if (TEXT_MIMES.some((prefix) => mime.startsWith(prefix)) || /\.(txt|md|markdown|csv|tsv|log|json|ya?ml|tsx?|jsx?|py|html|css|sql|toml|ini|rs|go|java|rb|sh)$/i.test(name)) {
    text = new TextDecoder().decode(bytes).slice(0, MAX_TEXT);
  } else {
    text = `[${name}] This file type cannot be read as text yet.`;
  }

  if (text && text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT)}\n\n[truncated]`;

  const id = await saveFile({
    userId: user.id,
    conversationId,
    name,
    mime,
    size: file.size,
    dataUrl: mime.startsWith("image/") ? null : undefined,
    extractedText: text ?? null,
  });

  return NextResponse.json({
    id,
    name,
    mime,
    size: file.size,
    text,
    dataUrl,
    kind: dataUrl ? "image" : "document",
  });
}
