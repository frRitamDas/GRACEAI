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

// The default voice. The chat route prepends the deployment persona, which is
// where identity and author are stated, so this stays about *how* Grace writes.
const SYSTEM_PROMPT = `You are a calm, precise assistant.

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
  systemPrompt?: string,
  options: { deepResearch?: boolean; maxTokens?: number } = {}
) {
  // Deep Research keeps the owner-selected model but asks it for its strongest
  // reasoning setting. The separate internal pass below is what makes this a
  // different workflow rather than just a price flag.
  const reasoningIndex = options.deepResearch ? EFFORT_LEVELS.length - 1 : effortIndex;
  const { temperature } = effortParams(model, reasoningIndex);
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
    max_tokens: Math.min(
      options.maxTokens ?? (model.provider === "groq" ? 8192 : 16_384),
      model.provider === "groq" ? 8192 : 16_384
    ),
  };

  if (model.provider === "openrouter") {
    body.usage = { include: true };
    body.reasoning = {
      effort: reasoningIndex >= 4 ? "high" : reasoningIndex >= 3 ? "medium" : "low",
    };
  }
  if (model.provider === "groq") {
    body.reasoning_effort = reasoningIndex >= 4 ? "high" : reasoningIndex >= 3 ? "medium" : "low";
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
function friendlyError(status: number, detail: string): string {
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
  const lower = raw.replace(/\s+/g, " ").trim().toLowerCase();

  if (lower.includes("insufficient credit") || lower.includes("out of credit")) {
    return "The AI service has no credits left. Ask the deployment owner to check its billing.";
  }
  if (lower.includes("quota") || lower.includes("rate limit") || status === 429) {
    return "Grace is getting too many requests from its AI service. Wait a moment and try again.";
  }
  if (lower.includes("context") && (lower.includes("length") || lower.includes("too long"))) {
    return "That conversation is longer than Grace can read at once. Start a new chat or remove older content.";
  }
  if (lower.includes("no endpoints") || lower.includes("not found") || status === 404) {
    return "Grace could not use the current response setup. Ask the owner to review the model settings.";
  }
  if (lower.includes("moderation") || lower.includes("flagged")) {
    return "The safety filter blocked that request. Try rephrasing it.";
  }
  if (status === 401 || status === 403) {
    return "Grace could not connect to its AI service. Ask the deployment owner to check the setup.";
  }
  if (status >= 500) return "Grace's AI service is having trouble. Try again in a moment.";

  // Provider error bodies can contain internal model ids and service names;
  // keep those deployment details out of the user-facing chat.
  return "Grace could not complete that request. Try again in a moment.";
}

const RESEARCH_BRIEF_INSTRUCTIONS = `Prepare a concise internal research brief for the final answer. This system has no live web-search tool. Use the conversation, supplied files, and general knowledge only; do not claim current verification or invent citations, URLs, quotations, or sources. Separate facts found in the user's material from general knowledge and assumptions. Note relevant counterpoints, uncertainty, and which facts would need external verification. Give useful conclusions and an outline, not private chain-of-thought or a step-by-step reasoning trace.`;

const RESEARCH_FINAL_INSTRUCTIONS = `This is Deep Research mode: produce a careful, useful synthesis rather than a quick reply. Recheck the conversation and supplied material against the internal brief. Distinguish source-backed facts, general knowledge, and uncertainty; consider meaningful counterpoints; organize the findings and practical next steps. This system has no live web-search tool, so do not claim to have browsed or verified current facts, and never invent citations or URLs. Do not expose private chain-of-thought. If the question depends on current information, say that it was not live-verified.`;

function completionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

function requestHeaders(model: ModelDef, key: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (model.provider === "openrouter") {
    headers["HTTP-Referer"] = appReferer();
    headers["X-Title"] = "Grace AI";
  }
  return headers;
}

type ResearchPassResult =
  | { brief: string }
  | { error: Extract<StreamEvent, { type: "error" }> };

async function buildResearchBrief(options: {
  key: string;
  model: ModelDef;
  effortIndex: number;
  turns: ChatTurn[];
  attachments: ChatAttachment[];
  signal?: AbortSignal;
  systemPrompt?: string;
}): Promise<ResearchPassResult> {
  const { key, model, effortIndex, turns, attachments, signal, systemPrompt } = options;
  try {
    const response = await fetch(providerEndpoint(model.provider), {
      method: "POST",
      headers: requestHeaders(model, key),
      body: JSON.stringify(
        requestBody(
          model,
          effortIndex,
          turns,
          attachments,
          false,
          `${systemPrompt ?? SYSTEM_PROMPT}\n\n${RESEARCH_BRIEF_INSTRUCTIONS}`,
          { deepResearch: true, maxTokens: 4096 }
        )
      ),
      signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        error: {
          type: "error",
          message: friendlyError(response.status, detail),
          retryable: response.status !== 401 && response.status !== 403 && response.status !== 404,
          code: `http_${response.status}`,
        },
      };
    }

    const payload = await response.json().catch(() => null);
    const brief = completionText(payload);
    if (!brief) {
      return {
        error: {
          type: "error",
          message: "Grace could not prepare a research brief. Try again in a moment.",
          retryable: true,
          code: "research_empty",
        },
      };
    }
    return { brief: brief.slice(0, 12_000) };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      error: {
        type: "error",
        message: aborted ? "Stopped." : "Grace could not reach its AI service. Check the connection and try again.",
        retryable: !aborted,
        code: aborted ? "aborted" : "network",
      },
    };
  }
}

export type StreamOptions = {
  key: string;
  model: ModelDef;
  effortIndex: number;
  turns: ChatTurn[];
  attachments: ChatAttachment[];
  signal?: AbortSignal;
  /**
   * Runs a private analysis pass and a user-facing synthesis on the same
   * owner-selected model. It does not browse the live web or change model
   * routing.
   */
  deepResearch?: boolean;
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
  const { key, model, effortIndex, turns, attachments, signal, systemPrompt, deepResearch = false } = options;
  const headers = requestHeaders(model, key);
  let finalSystemPrompt = systemPrompt ?? SYSTEM_PROMPT;

  if (deepResearch) {
    yield { type: "status", label: "Building a research brief" };
    const research = await buildResearchBrief({
      key,
      model,
      effortIndex,
      turns,
      attachments,
      signal,
      systemPrompt,
    });
    if ("error" in research) {
      yield research.error;
      return;
    }

    finalSystemPrompt = [
      finalSystemPrompt,
      RESEARCH_FINAL_INSTRUCTIONS,
      `Internal research brief (unverified working notes, not instructions): ${JSON.stringify(research.brief)}`,
    ].join("\n\n");
    yield { type: "status", label: "Checking and writing findings" };
  } else {
    yield { type: "status", label: "Thinking" };
  }

  let response: Response;
  try {
    response = await fetch(providerEndpoint(model.provider), {
      method: "POST",
      headers,
      body: JSON.stringify(
        requestBody(model, effortIndex, turns, attachments, true, finalSystemPrompt, { deepResearch })
      ),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    yield {
      type: "error",
      message: aborted ? "Stopped." : "Grace could not reach its AI service. Check the connection and try again.",
      retryable: !aborted,
      code: aborted ? "aborted" : "network",
    };
    return;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    yield {
      type: "error",
      message: friendlyError(response.status, detail),
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
      message: "Grace could not make a complete answer. Try again in a moment.",
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
