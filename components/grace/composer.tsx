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
  /** Short label for the current model, e.g. "Nemotron 3 Ultra". */
  modelLabel: string;
  /** Code mode. Present only when a workspace can exist for this chat. */
  codeMode?: {
    enabled: boolean;
    onToggle: () => void;
    /** "owner/repo" or a file count, shown inside the pill when on. */
    detail: string | null;
  };
  deepResearchOn: boolean;
  onToggleDeepResearch: () => void;
  attachments: { id: string; name: string }[];
  onRemoveAttachment: (id: string) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  /** Lets the empty state drop the caret into the box after a starter. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
};

/**
 * The input bar.
 *
 * Laid out as one control strip: attach on the left, the field in the middle,
 * and a cluster of three quiet icon buttons plus send on the right. The model
 * name replaces the old anonymous stack icon, because "which model am I talking
 * to" is the question that button answers and a glyph cannot say it.
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
  modelLabel,
  codeMode,
  deepResearchOn,
  onToggleDeepResearch,
  attachments,
  onRemoveAttachment,
  menuOpen,
  onMenuOpenChange,
  inputRef,
}: Props) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  // The caller may own the ref (so a starter card can focus the box); both refs
  // are stable, so the derived one is too, and it is safe to depend on.
  const textareaRef = inputRef ?? ownRef;
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const hasText = value.trim().length > 0;
  const codeOn = codeMode?.enabled ?? false;

  // Grow to five lines, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const line = 24;
    const max = line * 5 + 18;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [value, textareaRef]);

  useEffect(() => {
    if (sending) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [sending, textareaRef]);

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

      <div
        className={`glass-raised relative rounded-[22px] transition-colors duration-150 ${
          codeOn ? "ring-1 ring-accent/25" : ""
        }`}
      >
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-3 pt-2.5">
            {attachments.map((file) => (
              <li
                key={file.id}
                className="flex max-w-[220px] items-center gap-1 rounded-[8px] border border-white/[0.07] bg-white/[0.03] py-1 pl-2 pr-1 text-[12px] text-sub"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(file.id)}
                  aria-label={`Remove ${file.name}`}
                  className="grid h-4 w-4 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-ink"
                >
                  <X size={10} />
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
          placeholder={codeOn ? "Ask Grace to change the code…" : "Ask Grace"}
          enterKeyHint="send"
          className="scroll-quiet block w-full resize-none bg-transparent px-3.5 pt-3 text-[15.5px] leading-[24px] tracking-[-0.011em] text-ink outline-none placeholder:text-muted sm:text-[16px]"
          style={{ maxHeight: 148 }}
        />

        {/* ------------------------------------------------------- toolbar */}
        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
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
            aria-label={menuOpen ? "Close attach menu" : "Add a file or search"}
            aria-expanded={menuOpen}
            className={`press grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${
              menuOpen
                ? "bg-white/[0.08] text-ink"
                : "text-sub hover:bg-white/[0.06] hover:text-ink"
            }`}
          >
            {menuOpen ? <X size={17} /> : <Plus size={18} strokeWidth={2.2} aria-hidden="true" />}
          </button>

          {codeMode && (
            <button
              type="button"
              onClick={codeMode.onToggle}
              aria-pressed={codeMode.enabled}
              title={
                codeMode.enabled
                  ? `Code mode is on${codeMode.detail ? ` · ${codeMode.detail}` : ""}`
                  : "Let Grace read and change code in this chat"
              }
              className={`press flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${
                codeMode.enabled
                  ? "border-accent/40 bg-accent-soft text-accent-text"
                  : "border-white/[0.07] text-sub hover:border-white/[0.14] hover:text-ink"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m8 6-5 6 5 6M16 6l5 6-5 6"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Code
              <span
                aria-hidden="true"
                className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
                  codeMode.enabled ? "bg-accent" : "bg-white/20"
                }`}
              />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenModels}
            title="Choose a model"
            className="press flex h-8 min-w-0 max-w-[38vw] items-center gap-1.5 rounded-full px-2 text-[12px] text-sub hover:bg-white/[0.06] hover:text-ink sm:max-w-[220px]"
          >
            <span className="truncate">{modelLabel}</span>
            <Chevron />
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={onOpenEffort}
              aria-label="Change effort"
              title="Effort"
              className="press grid h-8 w-8 place-items-center rounded-[9px] text-sub hover:bg-white/[0.06] hover:text-ink"
            >
              <GaugeIcon />
            </button>

            {!hasText && !sending && (
              <button
                type="button"
                onClick={startVoice}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                aria-pressed={listening}
                className={`press grid h-8 w-8 place-items-center rounded-[9px] hover:bg-white/[0.06] ${
                  listening ? "text-accent" : "text-sub hover:text-ink"
                }`}
              >
                <Mic size={17} aria-hidden="true" />
              </button>
            )}

            {sending ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="press ml-0.5 grid h-8 w-8 place-items-center rounded-full bg-ink text-black"
              >
                <Square size={12} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!hasText}
                aria-label="Send message"
                className={`press ml-0.5 grid h-8 w-8 place-items-center rounded-full ${
                  hasText
                    ? "bg-ink text-black hover:opacity-90"
                    : "bg-white/[0.07] text-muted"
                }`}
              >
                <ArrowUp size={17} strokeWidth={2.6} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 opacity-60">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The small blue gauge that opens effort. */
function GaugeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 17a8.5 8.5 0 1 1 16 0"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M12 17l3.6-5" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.6" fill="var(--color-accent)" />
    </svg>
  );
}
