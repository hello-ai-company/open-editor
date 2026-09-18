import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement
} from "react";
import type { DocumentIndex } from "../index/documentIndex.js";
import {
  createDocumentOutline,
  flattenOutline,
  type OutlineNode
} from "../index/outline.js";
import {
  createOpenEditorDictionary,
  type OpenEditorDictionary
} from "../dictionary.js";
import { useOpenEditorBlockChanges } from "./powerUi.js";
import type { BatchPolicy } from "../bridge/batchedSink.js";

type EditorLike = {
  onChange: (
    callback: (editor: unknown, ctx: { getChanges: () => unknown[] }) => void,
    includeUpdatesFromRemote?: boolean
  ) => () => void;
  document?: unknown;
  setTextCursorPosition?: (block: never, placement?: "start" | "end") => void;
  focus?: () => void;
  getBlock?: (id: string) => unknown;
  domElement?: HTMLElement | null;
};

function jumpToBlock(editor: EditorLike, blockId: string): void {
  const block = (editor.getBlock?.(blockId) ?? { id: blockId }) as never;
  editor.setTextCursorPosition?.(block, "start");
  editor.focus?.();
  const el = editor.domElement?.querySelector(
    `[data-id="${CSS.escape(blockId)}"], [data-node-type][id="${CSS.escape(blockId)}"]`
  );
  if (el && "scrollIntoView" in el) {
    (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

export type UseDocumentOutlineOptions = {
  editor: EditorLike;
  index: DocumentIndex;
  /** Seed index once from editor.document — not on the typing hot path */
  seedFromDocument?: boolean;
  batch?: BatchPolicy;
  activeBlockId?: string | null;
};

export function useDocumentOutline(options: UseDocumentOutlineOptions): {
  nodes: OutlineNode[];
  flat: OutlineNode[];
  jump: (blockId: string) => void;
} {
  const { editor, index } = options;
  const seeded = useRef(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (seeded.current || !options.seedFromDocument) return;
    const doc = editor.document;
    if (Array.isArray(doc)) {
      index.replaceFromBlocks(doc as never);
      seeded.current = true;
      setVersion((v) => v + 1);
    }
  }, [editor, index, options.seedFromDocument]);

  useOpenEditorBlockChanges({
    editor: editor as never,
    batch: options.batch ?? { strategy: "raf" },
    onBatch: (batch) => {
      index.applyChanges(batch.changes);
      setVersion((v) => v + 1);
    }
  });

  const nodes = useMemo(() => {
    void version;
    return createDocumentOutline(index);
  }, [index, version]);

  const flat = useMemo(() => flattenOutline(nodes), [nodes]);

  const jump = useCallback(
    (blockId: string) => {
      jumpToBlock(editor, blockId);
    },
    [editor]
  );

  return { nodes, flat, jump };
}

export type DocumentOutlineProps = {
  nodes: OutlineNode[];
  activeBlockId?: string | null;
  onJump: (blockId: string) => void;
  dictionary?: Partial<OpenEditorDictionary>;
  className?: string;
};

function OutlineTree(props: {
  nodes: OutlineNode[];
  activeBlockId?: string | null;
  onJump: (blockId: string) => void;
}): ReactElement {
  return (
    <ul className="oe-outline__list" role="list">
      {props.nodes.map((node) => (
        <li key={node.blockId} className="oe-outline__item" role="listitem">
          <button
            type="button"
            className="oe-outline__link"
            data-active={props.activeBlockId === node.blockId ? "true" : "false"}
            data-level={node.level}
            onClick={() => props.onJump(node.blockId)}
          >
            {node.title}
          </button>
          {node.children.length > 0 ? (
            <OutlineTree
              nodes={node.children}
              activeBlockId={props.activeBlockId}
              onJump={props.onJump}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DocumentOutline(props: DocumentOutlineProps): ReactElement {
  const dict = createOpenEditorDictionary(props.dictionary);
  return (
    <nav
      className={["oe-outline", props.className].filter(Boolean).join(" ")}
      aria-label={dict.outlineTitle}
    >
      <div className="oe-outline__title">{dict.outlineTitle}</div>
      {props.nodes.length === 0 ? (
        <p className="oe-outline__empty">{dict.outlineEmpty}</p>
      ) : (
        <OutlineTree
          nodes={props.nodes}
          activeBlockId={props.activeBlockId}
          onJump={props.onJump}
        />
      )}
    </nav>
  );
}

export type QuickNavProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: DocumentIndex;
  editor: EditorLike;
  dictionary?: Partial<OpenEditorDictionary>;
};

export function QuickNav(props: QuickNavProps): ReactElement | null {
  const dict = createOpenEditorDictionary(props.dictionary);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [revision, setRevision] = useState(() => props.index.getRevision());

  useEffect(() => {
    return props.index.subscribe(() => {
      setRevision(props.index.getRevision());
    });
  }, [props.index]);

  const results = useMemo(() => {
    return props.index.query({ query, limit: 40, preferHeadings: true });
  }, [props.index, query, revision]);

  useEffect(() => {
    if (!props.open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActiveIndex(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      previousFocus.current?.focus?.();
    };
  }, [props.open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const select = useCallback(
    (blockId: string) => {
      jumpToBlock(props.editor, blockId);
      props.onOpenChange(false);
    },
    [props]
  );

  if (!props.open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      props.onOpenChange(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) select(hit.blockId);
    }
  };

  return (
    <div
      className="oe-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onOpenChange(false);
      }}
    >
      <div
        className="oe-quick-nav"
        role="dialog"
        aria-modal="true"
        aria-label={dict.quickNavTitle}
      >
        <input
          ref={inputRef}
          className="oe-quick-nav__input"
          role="combobox"
          aria-expanded="true"
          aria-controls="oe-quick-nav-list"
          aria-autocomplete="list"
          placeholder={dict.quickNavPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul id="oe-quick-nav-list" className="oe-quick-nav__list" role="listbox">
          {results.length === 0 ? (
            <li className="oe-quick-nav__empty" role="presentation">
              {dict.quickNavEmpty}
            </li>
          ) : (
            results.map((entry, index) => (
              <li key={entry.blockId} role="presentation">
                <button
                  type="button"
                  className="oe-quick-nav__item"
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex ? "true" : "false"}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(entry.blockId)}
                >
                  <span className="oe-quick-nav__type">{entry.type}</span>
                  <span className="oe-quick-nav__text">
                    {entry.text.trim() || entry.blockId}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export function useQuickNavShortcut(
  editor: EditorLike | null | undefined,
  onToggle: () => void
): void {
  useEffect(() => {
    const target = editor?.domElement ?? (typeof window !== "undefined" ? window : null);
    if (!target) return;
    const onKeyDown = (event: Event) => {
      const keyboardEvent = event as unknown as {
        metaKey: boolean;
        ctrlKey: boolean;
        key: string;
        preventDefault: () => void;
      };
      // Cmd/Ctrl+P — document nav; prevent browser print when editor-focused
      if (modKey(keyboardEvent) && keyboardEvent.key.toLowerCase() === "p") {
        keyboardEvent.preventDefault();
        onToggle();
      }
    };
    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, [editor, onToggle]);
}

function modKey(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey;
}

export { jumpToBlock };
