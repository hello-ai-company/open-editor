import type { EditorDocument, JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import type { HtmlWidgetSource } from "../document/htmlWidget.js";
import type { NotesDocumentSnapshot, NotesScope, NotesTarget } from "./contracts.js";

/** Raw protection data, never a body mutation, receipt, capability or execution grant. */
export type NotesHtmlSourceDraft = {
  version: 1; scope: NotesScope; target: NotesTarget; blockId: string;
  /** Captured canonical revisions, immutable even when raw input changes. */
  revision: string; contentRevision: string; original: HtmlWidgetSource; input: HtmlWidgetSource;
  sequence: string; stage: "editing" | "applied"; part: keyof HtmlWidgetSource; composing: boolean;
};
export type NotesHtmlSourceDraftJournal = {
  version: 1; compareAndSwap: true;
  /** Complete authorized target list, including obsolete block/revision records. */
  list(scope: NotesScope, target: NotesTarget, signal: AbortSignal): Promise<readonly NotesHtmlSourceDraft[]>;
  /** Atomic full prior-value CAS. undefined is create-only. Same exact input is idempotent. */
  put(next: NotesHtmlSourceDraft, expected: NotesHtmlSourceDraft | undefined, signal: AbortSignal): Promise<void>;
  /** Atomic full-value removal. Absence in a bulk cache is never deletion authority. */
  remove(expected: NotesHtmlSourceDraft, signal: AbortSignal): Promise<void>;
};
export type NotesHtmlSourceDraftState = {
  status: "ready" | "saving" | "error" | "conflict";
  message: string;
  /** Own exact raw remains available even after Apply, until verified body save. */
  records: readonly NotesHtmlSourceDraft[];
};
const clone = <T>(value: T): T => copyLegacyNotesJson(value) as T;
export function sameNotesHtmlSourceDraft(a: unknown, b: unknown): boolean {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
function object(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== fields.length || fields.some(k => !Object.hasOwn(value, k))) throw new Error("Malformed HTML source draft; original storage retained");
  return value as Record<string, unknown>;
}
function id(value: unknown): string { if (typeof value !== "string" || !value || value.length > 512) throw new Error("Invalid HTML draft identity"); return value; }
/** Unlike the preview parser, raw protection admits invalid syntax and oversized previews. */
export function parseNotesHtmlRawSource(value: unknown): HtmlWidgetSource {
  const raw = object(clone(value), ["html", "css", "javascript"]);
  if (Object.values(raw).some(v => typeof v !== "string" || v.length > 1_000_000)) throw new Error("HTML raw source exceeds its retention budget; original retained");
  return { html: raw.html as string, css: raw.css as string, javascript: raw.javascript as string };
}
export function parseNotesHtmlSourceDraft(value: unknown): NotesHtmlSourceDraft {
  const raw = object(clone(value), ["version", "scope", "target", "blockId", "revision", "contentRevision", "original", "input", "sequence", "stage", "part", "composing"]);
  if (raw.version !== 1 || !["editing", "applied"].includes(String(raw.stage)) || !["html", "css", "javascript"].includes(String(raw.part)) || typeof raw.composing !== "boolean") throw new Error("Unsupported HTML source draft; original retained");
  const scope = object(raw.scope, ["actorId", "workspaceId"]); id(scope.actorId); id(scope.workspaceId);
  const target = raw.target as NotesTarget;
  if (target?.kind === "page") { object(target, ["kind", "pageId"]); id(target.pageId); }
  else if (target?.kind === "row") { object(target, ["kind", "databaseId", "rowId"]); id(target.databaseId); id(target.rowId); }
  else throw new Error("Invalid HTML draft target");
  for (const k of ["blockId", "revision", "contentRevision", "sequence"]) id(raw[k]);
  raw.original = parseNotesHtmlRawSource(raw.original); raw.input = parseNotesHtmlRawSource(raw.input);
  return raw as unknown as NotesHtmlSourceDraft;
}
/** Base revisions are in the storage key: stale originals are separate retained records. */
export function notesHtmlSourceDraftKey(draft: NotesHtmlSourceDraft): string {
  const d = parseNotesHtmlSourceDraft(draft);
  return JSON.stringify(["notes-html-source-v1", d.scope.actorId, d.scope.workspaceId, (d.target.kind === "page" ? ["page", d.target.pageId] : ["row", d.target.databaseId, d.target.rowId]), d.blockId, d.revision, d.contentRevision]);
}
export function notesHtmlSourceCacheKey(scope: NotesScope, target: NotesTarget, blockId: string): string {
  const targetKey = target.kind === "page" ? ["page", target.pageId] : ["row", target.databaseId, target.rowId];
  return JSON.stringify(["editor-local-draft", scope.workspaceId, scope.actorId, targetKey, "html-widget-source", blockId]);
}
export function notesHtmlSourceCacheValue(draft: NotesHtmlSourceDraft): JsonValue {
  return { version: 1, base: JSON.stringify(draft.original), draft: { ...draft.input }, part: draft.part };
}
export function htmlSourceInDocument(document: EditorDocument, blockId: string): HtmlWidgetSource | undefined {
  const find = (blocks: EditorDocument["blocks"]): HtmlWidgetSource | undefined => {
    for (const block of blocks) {
      if (block.id === blockId) return block.type === "oeHtmlWidget" ? parseNotesHtmlRawSource({ html: block.props?.html ?? "", css: block.props?.css ?? "", javascript: block.props?.javascript ?? "" }) : undefined;
      if (block.children) { const found = find(block.children); if (found) return found; }
    }
    return undefined;
  };
  return find(document.blocks);
}

/** One ordered draft writer per document controller. Host CAS arbitrates other controllers. */
export function createNotesHtmlSourceDraftSession(port: NotesHtmlSourceDraftJournal, scope: NotesScope, notify: () => void, timeoutMs = 10000) {
  if (port.version !== 1 || port.compareAndSwap !== true || [port.list, port.put, port.remove].some(fn => typeof fn !== "function")) throw new Error("Versioned CAS HTML source journal required");
  let snapshot: NotesDocumentSnapshot | undefined, disposed = false, epoch = 0;
  let state: NotesHtmlSourceDraftState = { status: "ready", message: "", records: [] };
  const desired = new Map<string, NotesHtmlSourceDraft>(), stored = new Map<string, NotesHtmlSourceDraft>(), removals = new Set<string>();
  const uncertain = new Map<string, { next?: NotesHtmlSourceDraft; previous?: NotesHtmlSourceDraft; remove: boolean }>();
  let flight: Promise<boolean> | undefined;
  const aborts = new Set<AbortController>();
  const read = async (target: NotesTarget, signal: AbortSignal): Promise<NotesHtmlSourceDraft[]> => {
    const values = await port.list(clone(scope), clone(target), signal);
    if (signal.aborted || !Array.isArray(values)) throw new Error("HTML draft list unavailable; retained input is not cleared");
    const records = values.map(parseNotesHtmlSourceDraft), keys = new Set<string>();
    for (const record of records) {
      const key = notesHtmlSourceDraftKey(record);
      if (!sameNotesHtmlSourceDraft(record.scope, scope) || !sameNotesHtmlSourceDraft(record.target, target) || keys.has(key)) throw new Error("Foreign or duplicate HTML source draft; storage retained");
      keys.add(key);
    }
    return records;
  };
  const publish = (status = state.status, message = state.message) => { if (disposed) return; state = { status, message, records: clone([...desired.values()]) }; notify(); };
  const bounded = async <T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const abort = new AbortController(); aborts.add(abort); let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([Promise.resolve().then(() => fn(abort.signal)), new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("HTML draft durability unconfirmed")); }, timeoutMs); })]); }
    finally { clearTimeout(timer); aborts.delete(abort); }
  };
  const changed = () => { epoch++; publish("saving", "Source input is retained; confirming durable storage."); void flush(); };
  const flush = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false);
    if (flight) return flight;
    if (state.status === "error" || state.status === "conflict") return Promise.resolve(false);
    // Promise assignment precedes observer notification; reentrant subscribers cannot create a second writer.
    flight = Promise.resolve().then(async () => {
      try {
        for (;;) {
          const pending = [...new Set([...desired.keys(), ...removals])].find(key => removals.has(key) || !sameNotesHtmlSourceDraft(desired.get(key), stored.get(key)));
          if (!pending) { publish("ready", "Source draft storage confirmed. No body was saved."); return true; }
          const next = desired.get(pending); let previous = stored.get(pending); const remove = removals.has(pending), target = (next ?? previous)?.target;
          if (!target) { removals.delete(pending); continue; }
          await bounded(async signal => {
            // Read before every CAS also reconciles a completed-but-unacknowledged previous write.
            const actual = (await read(target, signal)).find(record => notesHtmlSourceDraftKey(record) === pending);
            signal.throwIfAborted(); if (disposed) throw new Error("HTML draft session closed");
            const attempt = uncertain.get(pending);
            if (attempt && sameNotesHtmlSourceDraft(actual, attempt.remove ? undefined : attempt.next)) {
              if (actual) stored.set(pending, clone(actual)); else stored.delete(pending);
              previous = actual; uncertain.delete(pending);
            }
            if (sameNotesHtmlSourceDraft(actual, remove ? undefined : next)) { if (remove) stored.delete(pending); else stored.set(pending, clone(next!)); return; }
            if (!sameNotesHtmlSourceDraft(actual, previous)) { publish("conflict", "Another editor changed this source draft. Both inputs are retained; export and review before continuing."); throw new Error("HTML draft CAS conflict"); }
            uncertain.set(pending, { next: next ? clone(next) : undefined, previous: previous ? clone(previous) : undefined, remove });
            if (remove) { if (previous) await port.remove(clone(previous), signal); }
            else await port.put(clone(next!), previous ? clone(previous) : undefined, signal);
            const checked = (await read(target, signal)).find(record => notesHtmlSourceDraftKey(record) === pending);
            if (!sameNotesHtmlSourceDraft(checked, remove ? undefined : next)) throw new Error("HTML draft storage proof differs; input retained");
            uncertain.delete(pending);
            if (remove) stored.delete(pending); else stored.set(pending, clone(next!));
          });
          if (disposed) return false;
          if (remove) {
            removals.delete(pending);
            // Input during an awaited removal creates a new retained record, never a deletion.
            if (sameNotesHtmlSourceDraft(desired.get(pending), next)) desired.delete(pending);
          }
        }
      } catch { if (state.status !== "conflict") publish("error", "Source draft storage failed or is unconfirmed. Input is retained; retry storage or export it before leaving."); return false; }
      finally { flight = undefined; }
    });
    return flight;
  };
  return {
    getState: () => state,
    isHydrated: () => Boolean(snapshot),
    rebind: (base: NotesDocumentSnapshot) => { snapshot = clone(base); },
    getGeneration: () => epoch,
    hydrate: async (base: NotesDocumentSnapshot, signal: AbortSignal) => {
      const records = await read(base.target, signal);
      return () => {
        if (disposed) throw new Error("HTML draft session closed");
        snapshot = clone(base); desired.clear(); stored.clear(); removals.clear(); uncertain.clear();
        for (const record of records) { const key = notesHtmlSourceDraftKey(record); desired.set(key, clone(record)); stored.set(key, clone(record)); }
        epoch++; publish("ready", records.length ? "Retained source input recovered for review. It has not been applied or saved." : "");
        return clone(records);
      };
    },
    set: (blockId: string, value: JsonValue, composing: boolean) => {
      if (!snapshot) throw new Error("HTML draft session is not hydrated");
      const cached = object(clone(value), ["version", "base", "draft", "part"]);
      if (cached.version !== 1 || typeof cached.base !== "string" || !["html", "css", "javascript"].includes(String(cached.part))) throw new Error("Unsupported source cache; input retained");
      const existing = [...desired.values()].filter(d => d.blockId === blockId);
      if (existing.length > 1) throw new Error("Multiple original source drafts are retained; export and review them first");
      const prior = existing[0];
      const original = parseNotesHtmlRawSource(JSON.parse(cached.base)), input = parseNotesHtmlRawSource(cached.draft);
      if (prior && !sameNotesHtmlSourceDraft(prior.original, original)) throw new Error("Original source draft changed; retained input cannot be rebased");
      const next: NotesHtmlSourceDraft = { version: 1, scope: clone(scope), target: clone(snapshot.target), blockId, revision: prior?.revision ?? snapshot.revision, contentRevision: prior?.contentRevision ?? snapshot.contentRevision, original, input, sequence: crypto.randomUUID(), stage: "editing", part: cached.part as keyof HtmlWidgetSource, composing };
      const key = notesHtmlSourceDraftKey(next); desired.set(key, next); removals.delete(key); changed();
    },
    markApplied: (blockId: string, document: EditorDocument) => {
      const entries = [...desired.entries()].filter(([,d]) => d.blockId === blockId);
      if (entries.length !== 1 || !sameNotesHtmlSourceDraft(htmlSourceInDocument(document, blockId), entries[0]![1].input)) throw new Error("Applied source does not match retained raw input");
      const [key, entry] = entries[0]!; desired.set(key, { ...entry, stage: "applied", composing: false, sequence: crypto.randomUUID() }); changed();
    },
    discard: (blockId: string) => { for (const [key, record] of desired) if (record.blockId === blockId) removals.add(key); changed(); },
    composition: (blockId: string, composing: boolean) => {
      for (const [key, record] of desired) if (record.blockId === blockId && record.composing !== composing) desired.set(key, { ...record, composing, sequence: crypto.randomUUID() });
      changed();
    },
    /** Only records captured before submission and present unchanged after exact receipt retire. */
    saved: (records: readonly NotesHtmlSourceDraft[], document: EditorDocument) => {
      for (const record of records) {
        const key = notesHtmlSourceDraftKey(record);
        if (record.stage === "applied" && sameNotesHtmlSourceDraft(desired.get(key), record) && sameNotesHtmlSourceDraft(htmlSourceInDocument(document, record.blockId), record.input)) removals.add(key);
      }
      if (removals.size) changed();
    },
    flush,
    retry: async () => { if (flight) await flight; if (disposed) return false; publish("saving", "Rechecking exact source draft storage."); return flush(); },
    dispose: () => { disposed = true; epoch++; for (const abort of aborts) abort.abort(); }
  };
}
