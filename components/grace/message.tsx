"use client";

import { AlertCircle, ChevronDown, Copy, Check, RotateCcw } from "lucide-react";
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
};

export function MessageRow({
  message,
  onRetry,
  isLast,
}: {
  message: ChatMessage;
  onRetry?: () => void;
  isLast?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="animate-fade-in flex justify-end pl-12">
        <div className="max-w-full">
          {message.attachments && message.attachments.length > 0 && (
            <ul className="mb-2 flex flex-wrap justify-end gap-2">
              {message.attachments.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="max-w-[220px] truncate rounded-full border border-hairline bg-surface px-3 py-1.5 text-[13px] text-sub"
                >
                  {file.name}
                </li>
              ))}
            </ul>
          )}
          <div className="whitespace-pre-wrap break-words rounded-[22px] rounded-br-[8px] bg-surface px-4 py-3 text-[17px] leading-6 text-ink">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="animate-fade-in flex gap-3 pr-6">
        <Avatar />
        <div className="flex-1 pt-0.5">
          <p className="flex items-start gap-2 text-[17px] leading-6 text-ink">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-sub" aria-hidden="true" />
            {message.content || "That answer did not come through."}
          </p>
          <div className="mt-2 flex gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 text-[15px] font-bold text-accent-text transition-opacity hover:opacity-80"
              >
                <RotateCcw size={14} aria-hidden="true" /> Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        {message.content ? (
          <MarkdownBody content={message.content} />
        ) : (
          <Typing status={message.status} />
        )}

        <div className="mt-2 flex items-center gap-3 text-[13px] text-muted">
          {message.modelName && (
            <span className="inline-flex items-center gap-1">
              {message.modelName}
              {message.providerLabel ? ` · ${message.providerLabel}` : ""}
            </span>
          )}
          {message.content && <CopyButton text={message.content} />}
          {message.role === "assistant" && message.content && isLast && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 transition-colors hover:text-sub"
            >
              <RotateCcw size={12} aria-hidden="true" /> Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div
      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline bg-control text-[#C9C9CC]"
      aria-hidden="true"
    >
      <GraceMark className="h-5 w-5" />
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
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Typing({ status }: { status?: string | null }) {
  return (
    <div className="flex items-center gap-2 py-1.5" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-sub"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "1.1s" }}
          />
        ))}
      </span>
      <span className="text-[15px] text-sub">{status || "Thinking"}</span>
    </div>
  );
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="grace-prose text-[17px] leading-[26px] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent-text underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const block = Boolean(className);
            if (block) {
              return (
                <code className="block overflow-x-auto whitespace-pre p-3 text-[14px] leading-[22px]">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-[6px] bg-control px-1.5 py-0.5 text-[15px] text-ink">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <div className="mb-3 overflow-hidden rounded-[16px] border border-hairline bg-control last:mb-0">
              <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5">
                <span className="text-[11px] font-semibold text-muted">Code</span>
              </div>
              <pre className="scroll-quiet overflow-x-auto">{children}</pre>
            </div>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-hairline pl-3 text-sub last:mb-0">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <h3 className="mb-2 text-[20px] font-bold leading-7">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-2 text-[19px] font-bold leading-7">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-2 text-[17px] font-bold leading-6">{children}</h4>,
          hr: () => <hr className="my-4 border-hairline" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-[12px] border border-hairline last:mb-0">
              <table className="w-full border-collapse text-[15px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-hairline px-3 py-2 text-left font-bold">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-hairline/60 px-3 py-2">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ScrollToBottom({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to latest message"
      className="animate-fade-in absolute bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-hairline bg-surface text-sub shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:text-ink"
    >
      <ChevronDown size={18} />
    </button>
  );
}
