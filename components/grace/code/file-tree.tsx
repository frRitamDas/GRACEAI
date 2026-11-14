"use client";

import { FileCode2, FileJson, FileText, Plus, Trash2 } from "lucide-react";

import type { ProjectFile } from "@/lib/code/store";

/**
 * The project's files, grouped by folder.
 *
 * A flat list is fine for five files and unusable for fifty, so paths are split
 * into a directory tree. Folders are one level deep in the common case; deeper
 * nesting renders inline rather than as a nested widget, which keeps the markup
 * simple and the model honest about what it actually is.
 */

type Node = { name: string; path: string; children: Map<string, Node>; file: boolean };

function buildTree(files: ProjectFile[]) {
  const root: Node = { name: "", path: "", children: new Map(), file: false };

  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          children: new Map(),
          file: isFile,
        });
      }
      node = node.children.get(part)!;
    });
  }

  const sortNodes = (node: Node): Node[] => {
    const list = [...node.children.values()];
    list.sort((a, b) => {
      if (a.file !== b.file) return a.file ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return list;
  };

  return { root, sortNodes };
}

function iconFor(path: string) {
  if (/\.(json|lock)$/.test(path)) return <FileJson size={13} aria-hidden="true" />;
  if (/\.(md|txt)$/.test(path)) return <FileText size={13} aria-hidden="true" />;
  return <FileCode2 size={13} aria-hidden="true" />;
}

/** Changed by the agent in the current turn: worth a dot, not a whole banner. */
export function FileTree({
  files,
  activePath,
  touched,
  onOpen,
  onDelete,
  onNewFile,
}: {
  files: ProjectFile[];
  activePath: string | null;
  touched: string[];
  onOpen: (path: string) => void;
  onDelete: (path: string) => void;
  onNewFile: () => void;
}) {
  const { root, sortNodes } = buildTree(files);

  const renderLevel = (node: Node, depth: number): React.ReactNode =>
    sortNodes(node).map((child) => {
      const indent = { paddingLeft: `${Math.min(depth, 4) * 12 + 10}px` };

      if (!child.file) {
        return (
          <li key={child.path}>
            <p
              style={indent}
              className="py-1 text-[11px] font-semibold tracking-[0.02em] text-muted"
            >
              {child.name}
            </p>
            <ul>{renderLevel(child, depth + 1)}</ul>
          </li>
        );
      }

      const isActive = child.path === activePath;
      const wasTouched = touched.includes(child.path);

      return (
        <li key={child.path} className="group relative">
          <button
            type="button"
            onClick={() => onOpen(child.path)}
            aria-current={isActive ? "true" : undefined}
            style={indent}
            className={`flex h-8 w-full items-center gap-1.5 rounded-[8px] pr-8 text-left text-[12.5px] transition-colors duration-100 ${
              isActive
                ? "bg-raised font-medium text-ink"
                : "text-sub hover:bg-[#161618] hover:text-ink"
            }`}
          >
            <span className={wasTouched ? "text-accent" : "text-muted"}>{iconFor(child.path)}</span>
            <span className="truncate">{child.name}</span>
            {wasTouched && (
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                aria-label="changed this turn"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(child.path)}
            aria-label={`Delete ${child.name}`}
            className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:bg-control hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={11} aria-hidden="true" />
          </button>
        </li>
      );
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-2 pb-1 pt-1">
        <p className="text-[11px] font-semibold tracking-[0.02em] text-muted">Files</p>
        <button
          type="button"
          onClick={onNewFile}
          aria-label="New file"
          className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-control hover:text-ink"
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Project files" className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-1">
        {files.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] leading-4 text-muted">
            No files yet. Ask Grace to create one.
          </p>
        ) : (
          <ul>{renderLevel(root, 0)}</ul>
        )}
      </nav>
    </div>
  );
}
