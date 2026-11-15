"use client";

import { ArrowUp, Mic, Plus, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AttachMenu } from "@/components/grace/attach-menu";

type ComposerMode = "chat" | "code";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  onAttachFiles: () => void;
  onTakePhoto: () => void;
  onOpenEffort: () => void;
  /** Current effort level, for the gauge's accessible name. */
  effortLabel: string;
  modelLabel: string;
  /** Shown on the row under the field: "Grace can make mistakes." or mode copy. */
  mode?: ComposerMode;
  onModeChange?: (next: ComposerMode) => void;
  deepResearchOn: boolean;
  onToggleDeepResearch: () => void;
  attachments: { id: string; name: string }[];
  onRemoveAttachment: (id: string) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Error or status line, kept directly above the bar. */
  footnote?: React.ReactNode;
};

/**
 * The input bar.
 *
 * One pill, sampled from the reference: a round add/close button on the left,
 * a transparent single-line field that grows to five lines, the blue effort
 * gauge, the microphone, and a dark circular send. The bar is `#131313` with no
 * border, which is what makes it read as a hole in the black canvas rather than
 * a card sitting on top of it.
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
  effortLabel,
  mode = "chat",
  deepResearchOn,
  onToggleDeepResearch,
  attachments,
  onRemoveAttachment,
  menuOpen,
  onMenuOpenChange,
  inputRef,
  footnote,
}: Props) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? ownRef;
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const hasText = value.trim().length > 0;
  const canSend = (hasText || attachments.length > 0) && !sending;

  // Grow to five lines, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const max = 24 * 5 + 16;
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
      setVoiceError("This browser has no speech input. Type instead.");
      window.setTimeout(() => setVoiceError(null), 4200);
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
      window.setTimeout(() => setVoiceError(null), 4200);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div className="relative w-full">
      {(voiceError || footnote) && (
        <div className="mb-2 flex justify-center px-1" role={voiceError ? "status" : undefined}>
          {voiceError ? (
            <p className="text-[12px] text-sub">{voiceError}</p>
          ) : (
            footnote
          )}
        </div>
      )}

      <div className="relative">
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

        <div className="rounded-[22px] bg-[#131313] sm:rounded-[24px]">
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex max-w-[220px] items-center gap-1 rounded-[8px] border border-hairline bg-control py-1 pl-2 pr-1 text-[12px] text-sub"
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

          <div className="flex items-end gap-1.5 px-2.5 py-2 sm:gap-2 sm:px-3.5 sm:py-2">
            <button
              type="button"
              onClick={() => onMenuOpenChange(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Add files, photos or research"}
              aria-expanded={menuOpen}
              data-attach-toggle=""
              className="press mb-px grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-white/[0.07]"
            >
              {menuOpen ? <X size={20} strokeWidth={2} /> : <Plus size={22} strokeWidth={1.9} />}
            </button>

            <label htmlFor="grace-input" className="sr-only">
              {mode === "code" ? "Ask Grace to change the code" : "Ask Grace"}
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
                  if (canSend) onSend();
                }
              }}
              placeholder="Ask Grace"
              enterKeyHint="send"
              className="scroll-quiet mb-px block max-h-[136px] w-full flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-6 text-ink outline-none placeholder:text-[#6b6b71]"
            />

            <div className="mb-px flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={onOpenEffort}
                aria-label={`Effort: ${effortLabel}. Change effort.`}
                title={`Effort: ${effortLabel}`}
                className="press grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.06]"
              >
                <GaugeIcon />
              </button>

              {!hasText && !sending && (
                <button
                  type="button"
                  onClick={startVoice}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={listening}
                  className={`press grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.06] ${
                    listening ? "text-accent" : "text-ink"
                  }`}
                >
                  <Mic size={19} strokeWidth={1.9} aria-hidden="true" />
                </button>
              )}

              {sending ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="press ml-0.5 grid h-9 w-9 place-items-center rounded-full bg-[#2a2a2d] text-ink"
                >
                  <Square size={13} fill="currentColor" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!canSend}
                  aria-label="Send message"
                  className={`press ml-0.5 grid h-9 w-9 place-items-center rounded-full transition-colors ${
                    canSend
                      ? "bg-white text-black hover:opacity-90"
                      : "cursor-not-allowed bg-[#2a2a2d] text-[#8a8a90]"
                  }`}
                >
                  <ArrowUp size={19} strokeWidth={2.6} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The effort gauge, drawn rather than imported: the reference arc is a
 * three-quarter sweep with a needle, and no icon set ships that exact shape.
 */
function GaugeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.2 17.4a8.6 8.6 0 1 1 15.6 0"
        stroke="var(--color-accent)"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M12 17.4 16 11.4" stroke="var(--color-accent)" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.7" fill="var(--color-accent)" />
    </svg>
  );
}
