import "server-only";

import { EFFORT_LEVELS, type ModelDef, type ProviderId } from "@/lib/ai/catalog";
import { appReferer, providerEndpoint } from "@/lib/ai/env";

/**
 * One OpenAI-compatible transport for OpenRouter, Groq and Google AI Studio.
 *
 * Every provider exposes POST /chat/completions with SSE deltas, so the only
 * per-provider differences are the base URL, the model id and a couple of
 * headers. Effort tunes temperature and the reasoning hint, which each provider
 * accepts in its own field; unsupported fields fail softly (we retry once with
 * the field stripped) so a strict provider can never take the chat down.
 */

export type ChatAttachment = {
  name: string;
  mime: string;
  /** Plain-text extraction, already size-capped server-side. */
  text?: string;
  /** Image data URL for vision models. */
  dataUrl?: string;
};

export type ChatTurn = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type StreamEvent =
  | { type: "status"; label: string }
  | { type: "delta"; text: string }
  | { type: "done"; model: ModelDef; finishReason: string | null }
  | { type: "error"; message: string; retryable: boolean; code?: string };

const SYSTEM_PROMPT = `You are Grace, a calm, precise AI assistant.

Voice: warm, direct, plain language. No filler, no flattery, no apologies.
Format: short paragraphs. Use Markdown only when it genuinely helps (lists for real steps, fenced code for code). Never use headings for a one-paragraph answer.
Honesty: if you do not know or cannot verify something, say so in one sentence and offer the closest useful next step.
Safety: decline harmful requests briefly and offer a safe alternative.`;

function effortParams(model: ModelDef, effortIndex: number) {
  const level = EFFORT_LEVELS[Math.min(effortIndex, EFFORT_LEVELS.length - 1)];
  const temperature =
    level.id === "instant" ? 0.5 : level.id === "quick" ? 0.6 : level.id === "balanced" ? 0.7 : 0.8;
  return { level, temperature };
}

/** Providers that can read images in the OpenAI `image_url` shape. */
const VISION_PROVIDERS: ProviderId[] = ["openrouter", "google"];

function buildMessages(
  turns: ChatTurn[],
  attachments: ChatAttachment[],
  systemPrompt: string = SYSTEM_PROMPT
) {
  const messages: Record<string, unknown>[] = [{ role: "system", content: systemPrompt }];

  for (const turn of turns.slice(-40)) {
    messages.push({ role: turn.role, content: turn.content });
  }

  const textBlocks = attachments
    .filter((a) => a.text && a.text.trim().length > 0)
    .map((a) => `--- file: ${a.name} ---\n${a.text!.slice(0, 60_000)}`)
    .join("\n\n");

  const images = attachments.filter((a) => a.dataUrl && a.mime.startsWith("image/"));

  if (textBlocks) {
    // Attach extracted text to the final user turn so the model reads it in order.
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      last.content = `${last.content}\n\nAttached documents:\n\n${textBlocks}`;
    }
  }

  return { messages, images };
}

function requestBody(
  model: ModelDef,
  effortIndex: number,
  turns: ChatTurn[],
  attachments: ChatAttachment[],
  stream: boolean,
  systemPrompt?: string
) {
  const { temperature } = effortParams(model, effortIndex);
  const { messages, images } = buildMessages(turns, attachments, systemPrompt);

  if (images.length && VISION_PROVIDERS.includes(model.provider)) {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const parts: Record<string, unknown>[] = [
        { type: "text", text: String(last.content) },
        ...images.slice(0, 4).map((a) => ({
          type: "image_url",
          image_url: { url: a.dataUrl },
        })),
      ];
      last.content = parts;
    }
  }

  const body: Record<string, unknown> = {
    model: model.upstream,
    messages,
    stream,
    temperature,
    max_tokens: model.provider === "groq" ? 8192 : 16_384,
  };

  if (model.provider === "openrouter") {
    body.usage = { include: true };
    body.reasoning = { effort: effortIndex >= 4 ? "high" : effortIndex >= 3 ? "medium" : "low" };
  }
  if (model.provider === "groq") {
    body.reasoning_effort = effortIndex >= 4 ? "high" : effortIndex >= 3 ? "medium" : "low";
  }
  return body;
}

async function * readSse(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      index = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data) as Record<string, unknown>;
      } catch {
        // Keep-alive comments and partial frames are expected; skip them.
      }
    }
  }
}

/**
 * Turns a provider error into one plain sentence.
 *
 * Providers answer with JSON like `{"error":{"message":"..."}}`. Dumping that
 * into the chat is unreadable, so the message is pulled out, matched against
 * the handful of problems people actually hit, and rewritten in Grace's voice
 * with a next step attached.
 */
function friendlyError(status: number, provider: ProviderId, detail: string): string {
  const label =
    provider === "google"
      ? "Google AI Studio"
      : provider === "groq"
        ? "Groq"
        : provider === "nvidia"
          ? "NVIDIA"
          : "OpenRouter";

  let raw = "";
  try {
    const parsed = JSON.parse(detail) as {
      error?: { message?: string } | string;
      message?: string;
    };
    raw =
      typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message ?? parsed.message ?? "";
  } catch {
    raw = detail;
  }
  const text = raw.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  if (lower.includes("insufficient credit") || lower.includes("out of credit")) {
    return provider === "openrouter"
      ? "This OpenRouter account has no credits left. Add credits on openrouter.ai, or pick a free model marked Free."
      : `${label} says this account has no credits left. Check the billing page, or pick a free model.`;
  }
  if (lower.includes("quota") || lower.includes("rate limit") || status === 429) {
    return `${label} is rate limiting right now. Wait a moment and try again — free tiers are stricter.`;
  }
  if (lower.includes("context") && (lower.includes("length") || lower.includes("too long"))) {
    return "That conversation is longer than this model can read. Start a new chat or pick a model with more context.";
  }
  if (lower.includes("no endpoints") || lower.includes("not found") || status === 404) {
    return `${label} does not serve that model on this key. Pick another model.`;
  }
  if (lower.includes("moderation") || lower.includes("flagged")) {
    return "The provider's safety filter blocked that request. Try rephrasing it.";
  }
  if (status === 401 || status === 403) {
    return `The ${label} key was rejected. Check the key in Settings.`;
  }
  if (status >= 500) return `${label} is having trouble. Try again in a moment.`;

  if (text.length > 0 && text.length <= 180) {
    return `${label} said: ${text.replace(/[<>{}\[\]]/g, "")}`;
  }
  return `${label} could not complete that request. Try again, or pick another model.`;
}

export type StreamOptions = {
  key: string;
  model: ModelDef;
  effortIndex: number;
  turns: ChatTurn[];
  attachments: ChatAttachment[];
  signal?: AbortSignal;
  /**
   * Replaces the default Grace persona. Grace Code and the chat workspace pass
   * an engineering prompt here; the plain chat leaves it undefined.
   */
  systemPrompt?: string;
};

/**
 * Streams a completion. Yields status, deltas, then done or error; never throws
 * for provider problems so the route can always close the stream cleanly.
 */
export async function* streamChat(options: StreamOptions): AsyncGenerator<StreamEvent> {
  const { key, model, effortIndex, turns, attachments, signal, systemPrompt } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (model.provider === "openrouter") {
    headers["HTTP-Referer"] = appReferer();
    headers["X-Title"] = "Grace AI";
  }

  yield { type: "status", label: "Thinking" };

  let response: Response;
  try {
    response = await fetch(providerEndpoint(model.provider), {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody(model, effortIndex, turns, attachments, true, systemPrompt)),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    yield {
      type: "error",
      message: aborted ? "Stopped." : "Grace could not reach the model provider. Check the connection and try again.",
      retryable: !aborted,
      code: aborted ? "aborted" : "network",
    };
    return;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    yield {
      type: "error",
      message: friendlyError(response.status, model.provider, detail),
      retryable: response.status !== 401 && response.status !== 403 && response.status !== 404,
      code: `http_${response.status}`,
    };
    return;
  }

  let sawText = false;
  let finishReason: string | null = null;
  let pending = "";

  try {
    for await (const frame of readSse(response)) {
      const choice = (frame.choices as Record<string, unknown>[] | undefined)?.[0];
      if (!choice) continue;
      const delta = choice.delta as Record<string, unknown> | undefined;
      const content =
        (delta?.content as string | undefined) ??
        (typeof delta?.reasoning === "string" ? "" : undefined);
      if (typeof content === "string" && content.length > 0) {
        sawText = true;
        pending += content;
        // Coalesce tiny frames into steadier chunks for the UI.
        if (pending.length >= 12 || content.includes("\n")) {
          yield { type: "delta", text: pending };
          pending = "";
        }
      }
      if (choice.finish_reason) finishReason = String(choice.finish_reason);
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    if (pending) yield { type: "delta", text: pending };
    yield {
      type: "error",
      message: aborted ? "Stopped." : "The response was cut off. Try again.",
      retryable: !aborted,
      code: aborted ? "aborted" : "stream",
    };
    return;
  }

  if (pending) yield { type: "delta", text: pending };

  if (!sawText) {
    yield {
      type: "error",
      message: "The model returned an empty answer. Try again or pick another model.",
      retryable: true,
      code: "empty",
    };
    return;
  }

  yield { type: "done", model, finishReason };
}

/** Suggests a short conversation title from the first user message. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  const cut = clean.length > 56 ? clean.slice(0, 56) : clean;
  const shortened = clean.length > 56 ? `${cut.replace(/[\s,;.]+$/, "")}…` : cut;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}
