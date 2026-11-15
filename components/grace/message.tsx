"use client";

import { AlertCircle, Check, ChevronDown, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { GraceMark } from "@/components/grace/logo";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelName?: string | null;
  providerLabel?: string | null;
  credits?: number;
  attachments?: { name: string; mime: string }[];
  error?: boolean;
  pending?: boolean;
  status?: string | null;
  /** Files the agent wrote in this turn (workspace turns only). */
  files?: string[];
};

/**
 * One message.
 *
 * The assistant does not get a bubble — it gets the column. A bubble around a
 * long technical answer wastes horizontal space and makes the conversation read
 * like a messenger app instead of a document. The user's own turns keep a
 * bubble because they are short and benefit from being visually separate.
 */
export function MessageRow({
  message,
  onRetry,
  isLast,
  onOpenFile,
}: {
  message: ChatMessage;
  onRetry?: () => void;
  isLast?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="animate-fade-in flex w-full justify-end">
        <div className="max-w-full">
          {message.attachments && message.attachments.length > 0 && (
            <ul className="mb-2 flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="max-w-[220px] truncate rounded-[8px] border border-hairline bg-control px-2.5 py-1 text-[12px] text-sub"
                >
                  {file.name}
                </li>
              ))}
            </ul>
          )}
          <div className="whitespace-pre-wrap break-words rounded-[20px] rounded-br-[8px] bg-[#1e2a44] px-4 py-2.5 text-[15px] leading-[24px] text-ink">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="animate-fade-in flex gap-2.5">
        <Avatar />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="flex items-start gap-2 text-[14.5px] leading-[22px] text-sub">
            <AlertCircle size={15} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
            {message.content || "That answer did not come through."}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-text transition-opacity hover:opacity-80"
            >
              <RotateCcw size={12} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex gap-2.5">
      <Avatar />
      <div className="min-w-0 flex-1">
        {message.content ? (
          <MarkdownBody content={message.content} />
        ) : (
          <Typing status={message.status} />
        )}

        {message.files && message.files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.files.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => onOpenFile?.(path)}
                className="press flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft/60 px-2 py-0.5 font-mono text-[10.5px] text-accent-text hover:border-accent/60"
              >
                <Check size={9} strokeWidth={3} aria-hidden="true" />
                {path}
              </button>
            ))}
          </div>
        )}

        {(message.modelName || message.content) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
            {message.modelName && (
              <span className="inline-flex items-center gap-1">
                {message.modelName}
                {message.providerLabel ? ` · ${message.providerLabel}` : ""}
              </span>
            )}
            {message.content && <CopyButton text={message.content} />}
            {message.content && isLast && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 transition-colors hover:text-sub"
              >
                <RotateCcw size={11} aria-hidden="true" /> Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div
      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-control text-[#D7D7DA]"
      aria-hidden="true"
    >
      <GraceMark className="h-[16px] w-[16px]" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard can be blocked; the button simply does nothing */
        }
      }}
      className="inline-flex items-center gap-1 transition-colors hover:text-sub"
      aria-label={copied ? "Copied" : "Copy answer"}
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Typing({ status }: { status?: string | null }) {
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-bounce rounded-full bg-sub"
            style={{ animationDelay: `${i * 130}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
      <span className="text-[13px] text-sub">{status || "Thinking"}</span>
    </div>
  );
}

/**
 * Markdown for a technical answer.
 *
 * Long coding replies are mostly code, so the fenced block is the piece that
 * has to be right: a labelled header with the language, a copy button, and a
 * horizontal scroll that does not drag the whole conversation sideways.
 */
export function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="grace-prose text-[15px] leading-[25px] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0 marker:text-muted">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0 marker:text-muted">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent-text underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            if (className) {
              return (
                <code className="block overflow-x-auto whitespace-pre p-3.5 font-mono text-[12.5px] leading-[20px]">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-[5px] border border-hairline bg-white/[0.06] px-1.5 py-px font-mono text-[12.5px] text-ink">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2.5 border-l-2 border-white/[0.12] pl-3 text-sub last:mb-0">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h3 className="mb-1.5 mt-4 text-[17px] font-semibold leading-6 first:mt-0">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-1.5 mt-4 text-[16px] font-semibold leading-6 first:mt-0">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1.5 mt-3 text-[15px] font-semibold leading-5 first:mt-0">{children}</h4>
          ),
          hr: () => <hr className="my-4 border-white/[0.07]" />,
          table: ({ children }) => (
            <div className="mb-2.5 overflow-x-auto rounded-[8px] border border-white/[0.08] last:mb-0">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/[0.05] px-2.5 py-1.5 last:border-0">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * A fenced block with a header strip.
 *
 * The language is pulled from the code element's class because react-markdown
 * hands `pre` the child, not the fence info. When it is a file path (which is
 * what Grace writes for workspace turns) that is far more useful than "Code".
 */
function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const text = extractText(children);
  const className =
    (Array.isArray(children)
      ? (children[0] as { props?: { className?: string } })?.props?.className
      : (children as { props?: { className?: string } })?.props?.className) ?? "";
  const match = /language-(\S+)/.exec(String(className));
  const label = match ? decodeURIComponent(match[1]) : "Code";
  const isPath = /[/.]/.test(label);

  return (
    <div className="group mb-3 overflow-hidden rounded-[12px] border border-hairline bg-[#0a0a0b] last:mb-0">
      <div className="flex items-center gap-2 border-b border-hairline bg-white/[0.02] px-3 py-1.5">
        <span
          className={`min-w-0 flex-1 truncate text-[10.5px] font-medium ${
            isPath ? "font-mono text-accent-text" : "text-muted"
          }`}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="flex shrink-0 items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Copy code"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-quiet m-0 overflow-x-auto">{children}</pre>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  const element = node as { props?: { children?: React.ReactNode } };
  return extractText(element.props?.children);
}

export function ScrollToBottom({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to latest message"
      className="animate-fade-in grid h-8 w-8 place-items-center rounded-full border border-hairline bg-surface text-sub shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:text-ink"
    >
      <ChevronDown size={16} />
    </button>
  );
}
