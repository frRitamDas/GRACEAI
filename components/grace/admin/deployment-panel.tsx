"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";

import { Toggle } from "@/components/grace/toggle";
import type { DeploymentSettings, SettingsPatch } from "@/lib/settings";

/**
 * Deployment controls.
 *
 * Every field here writes through `PATCH /api/admin/settings`, and the write is
 * the save: there is no "unsaved" state to lose, and the toast only appears
 * after the server has answered. Text fields debounce briefly so typing a brand
 * name does not fire twenty requests.
 *
 * The panel is deliberately plain — grouped cards, one switch per row, a
 * sentence under each group saying what the switch actually does. A console is
 * read while annoyed at something, so it should not need to be learned.
 */

type Props = {
  settings: DeploymentSettings;
  onChange: (next: DeploymentSettings) => void;
  onMessage: (text: string, ok: boolean) => void;
};

const FEATURES: { key: keyof DeploymentSettings["features"]; label: string; body: string }[] = [
  {
    key: "graceCode",
    label: "Grace Code",
    body: "The coding workspace inside a chat and the standalone code editor.",
  },
  { key: "projects", label: "Projects", body: "Project folders, files, instructions, sharing and history." },
  { key: "memory", label: "Memory", body: "Facts a person saves about themselves, used in replies." },
  { key: "apex", label: "Apex", body: "The membership page and its invite flow." },
  { key: "attachments", label: "Attachments", body: "Uploading files, images and PDFs into a chat." },
  {
    key: "deepResearch",
    label: "Deep research",
    body: "A two-pass analysis of the conversation and supplied sources; it does not browse the live web.",
  },
];

export function DeploymentPanel({ settings, onChange, onMessage }: Props) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState<string | null>(null);
  const timers = useRef<Record<string, number>>({});

  /**
   * The server record is the truth; `draft` only exists between a keystroke and
   * the save that follows it. When the parent hands down a newer record (a pin
   * made in the model manager, say) the switch rows — which are not typed into —
   * have to follow it, so the panel re-keys itself on the record's timestamp
   * instead of copying fields in an effect.
   */
  const [shownAt, setShownAt] = useState(settings.updatedAt);
  if (settings.updatedAt !== shownAt) {
    setShownAt(settings.updatedAt);
    setDraft((previous) => ({
      ...previous,
      chatModel: settings.chatModel,
      allowedModels: settings.allowedModels,
      hiddenModels: settings.hiddenModels,
      updatedAt: settings.updatedAt,
    }));
  }

  const save = useCallback(
    async (patch: SettingsPatch, key: string) => {
      setBusy(key);
      try {
        const response = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await response.json().catch(() => ({}))) as {
          settings?: DeploymentSettings;
          error?: string;
        };
        if (!response.ok || !data.settings) {
          onMessage(data.error ?? "That change did not save.", false);
          return;
        }
        onChange(data.settings);
        setDraft(data.settings);
        onMessage("Saved.", true);
      } catch {
        onMessage("Grace could not reach the server. That change was not saved.", false);
      } finally {
        setBusy(null);
      }
    },
    [onChange, onMessage]
  );

  /** Text fields: show the keystroke now, write once typing pauses. */
  const saveSoon = useCallback(
    (patch: SettingsPatch, key: string) => {
      window.clearTimeout(timers.current[key]);
      timers.current[key] = window.setTimeout(() => void save(patch, key), 500);
    },
    [save]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach((t) => window.clearTimeout(t));
  }, []);

  const enabledCount = useMemo(
    () => Object.values(draft.features).filter(Boolean).length,
    [draft.features]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* --------------------------------------------------------------- brand */}
      <Card title="Brand and voice" note="Shown on the public page, in the chat header and in the browser tab.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="brand-name"
            label="Product name"
            value={draft.brandName}
            maxLength={40}
            busy={busy === "brandName"}
            onChange={(value) => {
              setDraft({ ...draft, brandName: value });
              if (value.trim().length > 0) saveSoon({ brandName: value }, "brandName");
            }}
          />
          <TextField
            id="footer-note"
            label="Line under the composer"
            value={draft.footerNote}
            maxLength={120}
            busy={busy === "footerNote"}
            onChange={(value) => {
              setDraft({ ...draft, footerNote: value });
              saveSoon({ footerNote: value }, "footerNote");
            }}
          />
        </div>
        <TextField
          id="tagline"
          label="Tagline"
          hint="The one line on the public page. Keep it under a dozen words."
          value={draft.tagline}
          maxLength={160}
          busy={busy === "tagline"}
          onChange={(value) => {
            setDraft({ ...draft, tagline: value });
            saveSoon({ tagline: value }, "tagline");
          }}
        />
      </Card>

      {/* ---------------------------------------------------------- greetings */}
      <Card
        title="Greetings"
        note="Three lines the empty chat rotates between, one per minute. {name} becomes the person's first name."
      >
        <div className="flex flex-col gap-2">
          {draft.greetings.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-control text-[11px] tabular-nums text-sub">
                {index + 1}
              </span>
              <input
                value={line}
                maxLength={120}
                aria-label={`Greeting ${index + 1}`}
                onChange={(event) => {
                  const greetings = [...draft.greetings] as [string, string, string];
                  greetings[index] = event.target.value;
                  setDraft({ ...draft, greetings });
                  saveSoon({ greetings }, `greeting-${index}`);
                }}
                className="h-9 w-full rounded-[8px] border border-hairline bg-control px-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            void save(
              {
                greetings: [
                  "Where should we start, {name}?",
                  "What should Grace look into, {name}?",
                  "What needs clarity, {name}?",
                ],
              },
              "greetings-reset"
            )
          }
          className="mt-2 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-sub transition-colors hover:bg-control hover:text-ink"
        >
          <RotateCcw size={12} /> Restore the defaults
        </button>
      </Card>

      {/* ---------------------------------------------------------- switches */}
      <Card title="Availability" note="These take effect on the next request. Nobody is signed out.">
        <SwitchRow
          label="Chat is open"
          body="Off hides the composer behind a paused notice. Conversations are kept."
          checked={draft.chatEnabled}
          busy={busy === "chatEnabled"}
          onChange={(next) => {
            setDraft({ ...draft, chatEnabled: next });
            void save({ chatEnabled: next }, "chatEnabled");
          }}
        />
        <SwitchRow
          label="New sign-ups"
          body="Off closes registration. Your own address can still sign in and create the owner account."
          checked={draft.signupEnabled}
          busy={busy === "signupEnabled"}
          onChange={(next) => {
            setDraft({ ...draft, signupEnabled: next });
            void save({ signupEnabled: next }, "signupEnabled");
          }}
        />
      </Card>

      {/* ---------------------------------------------------------- features */}
      <Card
        title={`Surfaces · ${enabledCount} of ${FEATURES.length} on`}
        note="Turning a surface off removes it from the shell and refuses its API, so a hidden page cannot be reached by URL."
      >
        {FEATURES.map((feature) => (
          <SwitchRow
            key={feature.key}
            label={feature.label}
            body={feature.body}
            checked={draft.features[feature.key]}
            busy={busy === `feature-${feature.key}`}
            onChange={(next) => {
              const features = { ...draft.features, [feature.key]: next };
              setDraft({ ...draft, features });
              void save({ features }, `feature-${feature.key}`);
            }}
          />
        ))}
      </Card>

      {/* ------------------------------------------------------ announcement */}
      <AnnouncementCard
        key={draft.announcement?.id ?? "none"}
        value={draft.announcement}
        busy={busy === "announcement"}
        onSave={(next) => {
          setDraft({ ...draft, announcement: next });
          void save({ announcement: next }, "announcement");
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-hairline bg-surface">
      <div className="border-b border-hairline px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-0.5 max-w-[62ch] text-[12.5px] leading-[18px] text-sub">{note}</p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">{children}</div>
    </section>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  maxLength,
  busy,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  maxLength: number;
  busy: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12px] font-medium text-sub">
          {label}
        </label>
        <span className="flex items-center gap-1 text-[10.5px] text-muted">
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          {busy ? "saving" : "saved"}
        </span>
      </div>
      <input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-[8px] border border-hairline bg-control px-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent"
      />
      {hint && <p className="text-[11px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}

function SwitchRow({
  label,
  body,
  checked,
  busy,
  onChange,
}: {
  label: string;
  body: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline/60 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[12px] leading-[17px] text-sub">{body}</p>
      </div>
      <div className="pt-0.5">
        <Toggle checked={checked} onChange={onChange} label={label} disabled={busy} />
      </div>
    </div>
  );
}

function AnnouncementCard({
  value,
  busy,
  onSave,
}: {
  value: DeploymentSettings["announcement"];
  busy: boolean;
  onSave: (next: DeploymentSettings["announcement"]) => void;
}) {
  // Keyed on the live banner in the caller, so publishing or hiding remounts
  // this with the server's values rather than syncing them through an effect.
  const [text, setText] = useState(value?.text ?? "");
  const [href, setHref] = useState(value?.href ?? "");

  const changed = text.trim() !== (value?.text ?? "") || href.trim() !== (value?.href ?? "");

  return (
    <Card
      title="Announcement"
      note="A single line across the public page and chat. Saving a new line replaces the old one; hiding it needs no cleanup."
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="announce-text" className="text-[12px] font-medium text-sub">
          Message
        </label>
        <input
          id="announce-text"
          value={text}
          maxLength={200}
          placeholder="Grace Code now keeps a project's files between chats."
          onChange={(event) => setText(event.target.value)}
          className="h-9 w-full rounded-[8px] border border-hairline bg-control px-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
        />
        <label htmlFor="announce-href" className="text-[12px] font-medium text-sub">
          Link (optional)
        </label>
        <input
          id="announce-href"
          value={href}
          maxLength={300}
          placeholder="/upcoming or https://…"
          onChange={(event) => setHref(event.target.value)}
          className="h-9 w-full rounded-[8px] border border-hairline bg-control px-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted focus:border-accent"
        />

        {text.trim().length > 0 && (
          <div className="mt-1 rounded-[8px] border border-hairline bg-control px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted">Preview</p>
            <p className="mt-1 text-[12.5px] text-ink">{text}</p>
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || text.trim().length === 0 || !changed}
            onClick={() =>
              onSave({
                id: value?.id && value.text === text.trim() ? value.id : crypto.randomUUID().slice(0, 8),
                text: text.trim(),
                href: href.trim(),
              })
            }
            className="h-8 rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-black disabled:opacity-40"
          >
            {busy ? "Saving…" : value ? "Publish change" : "Publish"}
          </button>
          {value && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(null)}
              className="h-8 rounded-full px-3 text-[12.5px] text-sub transition-colors hover:bg-control hover:text-ink disabled:opacity-40"
            >
              Hide banner
            </button>
          )}
          <span className="text-[11px] text-muted">
            {value ? "Live now." : "Nothing is showing."}
          </span>
        </div>
      </div>
    </Card>
  );
}
