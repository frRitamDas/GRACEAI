"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Pencil, X } from "lucide-react";

/**
 * The file contents.
 *
 * A full syntax highlighter is a large dependency for a panel that mostly shows
 * short files, so this does the part that helps: comments, strings, numbers and
 * keywords get colour, everything else stays readable. The highlighting runs on
 * the plain text before it reaches React, so there is no dangerouslySetInnerHTML
 * anywhere near model output.
 */

const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|class|new|await|async|import|from|export|default|try|catch|finally|throw|typeof|instanceof|def|elif|lambda|pass|raise|with|as|yield|None|True|False|null|true|false|undefined|package|func|struct|interface|type|go|defer|select|case|switch|break|continue|public|private|static|void|int|string|bool)\b/;

type Token = { text: string; kind: "plain" | "comment" | "string" | "number" | "keyword" };

/**
 * One pass over the text, in priority order: a `//` inside a string must not
 * start a comment, so quotes are consumed before the comment check.
 */
function tokeniseLine(line: string): Token[] {
  const out: Token[] = [];
  let rest = line;

  while (rest.length > 0) {
    const comment = rest.match(/^(\/\/|#(?![a-fA-F0-9]{6}))(.*)$/);
    if (comment) {
      out.push({ text: rest, kind: "comment" });
      break;
    }

    const string = rest.match(/^("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)/);
    if (string) {
      out.push({ text: string[1], kind: "string" });
      rest = rest.slice(string[1].length);
      continue;
    }

    const word = rest.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
    if (word) {
      out.push({ text: word[0], kind: KEYWORDS.test(word[0]) ? "keyword" : "plain" });
      rest = rest.slice(word[0].length);
      continue;
    }

    const number = rest.match(/^\d[\d._]*/);
    if (number) {
      out.push({ text: number[0], kind: "number" });
      rest = rest.slice(number[0].length);
      continue;
    }

    out.push({ text: rest[0], kind: "plain" });
    rest = rest.slice(1);
  }

  return out;
}

const COLOUR: Record<Token["kind"], string> = {
  plain: "text-[#D5D5D8]",
  comment: "text-[#6B6B70] italic",
  string: "text-[#8FCF9B]",
  number: "text-[#D9B36B]",
  keyword: "text-[#7DA6F5]",
};

export function CodeViewer({
  path,
  content,
  onSave,
  readOnly = false,
}: {
  path: string;
  content: string;
  onSave: (next: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => content.split("\n"), [content]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access is denied in some contexts; silent failure is fine.
    }
  };

  if (editing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
          <p className="truncate font-mono text-[12px] text-sub">{path}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(content);
              }}
              className="h-7 rounded-full px-2.5 text-[12px] font-medium text-sub hover:bg-control hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="h-7 rounded-full bg-ink px-3 text-[12px] font-semibold text-black"
            >
              Save
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          aria-label={`Edit ${path}`}
          className="scroll-quiet min-h-0 flex-1 resize-none bg-black p-3 font-mono text-[12.5px] leading-[20px] text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
        <p className="truncate font-mono text-[12px] text-sub">{path}</p>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 hidden text-[11px] tabular-nums text-muted sm:inline">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={`Copy ${path}`}
            className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-control hover:text-ink"
          >
            {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setDraft(content);
                setEditing(true);
              }}
              aria-label={`Edit ${path}`}
              className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-control hover:text-ink"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="scroll-quiet min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[12.5px] leading-[20px]">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="align-top">
                <td className="w-10 select-none border-r border-hairline/60 px-2 text-right text-[11px] tabular-nums text-[#4A4A50]">
                  {index + 1}
                </td>
                <td className="whitespace-pre px-3">
                  {tokeniseLine(line).map((token, tokenIndex) => (
                    <span key={tokenIndex} className={COLOUR[token.kind]}>
                      {token.text}
                    </span>
                  ))}
                  {line.length === 0 && "\u00a0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Shown when a project has no file open yet. */
export function EmptyViewer() {
  return (
    <div className="grid flex-1 place-items-center px-6">
      <p className="max-w-[24rem] text-center text-[13.5px] leading-5 text-muted">
        Pick a file to read it, or ask Grace to change something and the new version appears here.
      </p>
    </div>
  );
}

export function CloseIcon() {
  return <X size={13} aria-hidden="true" />;
}
