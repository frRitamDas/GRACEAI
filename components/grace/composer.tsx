"use client";

import { ArrowUp, Mic, Plus, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AttachMenu } from "@/components/grace/attach-menu";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  onAttachFiles: () => void;
  onTakePhoto: () => void;
  onOpenEffort: () => void;
  onOpenModels: () => void;
  effortLabel: string;
  deepResearchOn: boolean;
  onToggleDeepResearch: () => void;
  attachments: { id: string; name: string }[];
  onRemoveAttachment: (id: string) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
};

/**
 * Input bar (DESIGN.md §6.3). Plus button, growing field, gauge, mic and a
 * 56px send circle that is disabled until there is text. Mic hides while
 * typing; the send button turns into a stop control while streaming.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  sending,
  onAttachFiles,
  onTakePhoto,
  onOpenEffort,
  onOpenModels,
  effortLabel,
  deepResearchOn,
  onToggleDeepResearch,
  attachments,
  onRemoveAttachment,
  menuOpen,
  onMenuOpenChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const hasText = value.trim().length > 0;
  const typing = hasText && !sending;

  // Grow to five lines, then scroll (DESIGN.md §6.3).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const line = 26;
    const max = line * 5 + 20;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [value]);

  useEffect(() => {
    if (sending) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [sending]);

  const startVoice = () => {
    type SpeechCtor = new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      start: () => void;
      stop: () => void;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!Ctor) {
      setVoiceError("Voice input is not available in this browser.");
      window.setTimeout(() => setVoiceError(null), 4000);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript ?? "";
      }
      onChange(transcript.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setVoiceError("Voice input stopped. Try again.");
      window.setTimeout(() => setVoiceError(null), 4000);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div className="relative w-full">
      {voiceError && (
        <p className="mb-2 text-center text-[13px] text-sub" role="status">
          {voiceError}
        </p>
      )}

      <div className="glass relative flex items-start gap-0.5 rounded-[28px] px-1 py-2 transition-colors duration-200 focus-within:border-white/20 sm:px-1.5">
        <AttachMenu
          open={menuOpen}
          onClose={() => onMenuOpenChange(false)}
          onAttachFiles={() => {
            onMenuOpenChange(false);
            onAttachFiles();
          }}
          onTakePhoto={() => {
            onMenuOpenChange(false);
            onTakePhoto();
          }}
          onDeepResearch={() => {
            onMenuOpenChange(false);
            onToggleDeepResearch();
          }}
          deepResearchOn={deepResearchOn}
        />

        <button
          type="button"
          onClick={() => onMenuOpenChange(!menuOpen)}
          aria-label={menuOpen ? "Close attach menu" : "Add attachment"}
          aria-expanded={menuOpen}
          className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-raised active:scale-95 sm:w-10"
        >
          {menuOpen ? <X size={22} /> : <Plus size={24} strokeWidth={2} aria-hidden="true" />}
        </button>

        <div className="min-w-0 flex-1 py-2.5">
          {attachments.length > 0 && (
            <ul className="mb-1.5 flex flex-wrap gap-1.5">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex max-w-[200px] items-center gap-1 rounded-full border border-hairline bg-control py-1 pl-2.5 pr-1 text-[13px] text-sub"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file.id)}
                    aria-label={`Remove ${file.name}`}
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-raised hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor="grace-input" className="sr-only">
            Ask Grace
          </label>
          <textarea
            id="grace-input"
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (hasText && !sending) onSend();
              }
            }}
            placeholder="Ask Grace"
            enterKeyHint="send"
            className="scroll-quiet block w-full resize-none bg-transparent text-[16px] leading-[26px] tracking-[-0.011em] text-ink outline-none placeholder:text-muted sm:text-[17px]"
            style={{ maxHeight: 150 }}
          />
          {/* Desktop affordance: nobody discovers Shift+Enter by guessing. */}
          <p className="hidden select-none pb-0.5 text-[11px] leading-3 text-muted/70 lg:block">
            {hasText ? "Enter to send · Shift+Enter for a new line" : "\u00a0"}
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onOpenModels}
            aria-label="Choose a model"
            title="Choose a model"
            className="grid h-11 w-9 place-items-center rounded-full text-sub transition-colors hover:bg-raised hover:text-ink sm:w-10"
          >
            <ModelIcon />
          </button>

          <button
            type="button"
            onClick={onOpenEffort}
            aria-label={`Effort: ${effortLabel}. Change effort`}
            className="group grid h-11 w-9 place-items-center rounded-full transition-colors hover:bg-raised sm:w-10"
          >
            <GaugeIcon />
          </button>

          {!typing && !sending && (
            <button
              type="button"
              onClick={startVoice}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              aria-pressed={listening}
              className={`grid h-11 w-10 place-items-center rounded-full transition-colors hover:bg-raised sm:w-11 ${
                listening ? "text-accent" : "text-ink"
              }`}
            >
              <Mic size={22} aria-hidden="true" />
            </button>
          )}

          {sending ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="grid h-11 w-11 place-items-center rounded-full bg-ink text-black transition-opacity hover:opacity-90"
            >
              <Square size={16} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!hasText}
              aria-label="Send message"
              className={`grid h-11 w-11 place-items-center rounded-full transition-all duration-150 ${
                hasText
                  ? "bg-ink text-black hover:opacity-90 active:scale-95"
                  : "bg-disabled text-muted"
              }`}
            >
              <ArrowUp size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A stack glyph that opens the frontier model list. */
function ModelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m3 12.5 9 4.5 9-4.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m3 17 9 4.5 9-4.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity=".5" />
    </svg>
  );
}

/** The small blue gauge from the reference input bar. */
function GaugeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 17a8.5 8.5 0 1 1 16 0"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M12 17l3.6-5"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.6" fill="var(--color-accent)" />
    </svg>
  );
}
