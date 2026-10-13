import { createSyntheticNotesDatabaseViews } from "./syntheticNotesDatabaseViews";
import { createReviewedDatabaseViewConfigProvider, type DatabaseViewConfigReceiptPort, type DatabaseViewConfigOperation, type DatabaseViewConfigReceipt, type DatabaseViewConfig } from "@hello-ai-company/editor-blocknote";
import { syntheticParityDefinitions, syntheticParityValues } from "./syntheticNotesParity";
import { validateNotesDatabasePropertyValue, parseNotesDatabasePropertyDefinition } from "@hello-ai-company/editor-blocknote/notes";
import { validateCanvasLayoutSpec, type CanvasLayoutSpec } from "@hello-ai-company/editor-canvas";
import { createEditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { type NotesResourceInvalidation, type NotesDocumentSnapshot, type NotesWorkspaceHost, type NotesCommandRequest, type NotesCommandResult, type NotesRecovery, type NotesTarget, type NotesPanelSnapshot, type NotesMutationEvidence, type NotesPageSummary, type NotesDatabaseSchemaSnapshot } from "@hello-ai-company/editor-blocknote/notes";
import type { NotesCanvasHost, NotesCanvasSnapshot, NotesCanvasRequest, NotesCanvasResult, NotesCanvasRecovery, NotesDatabaseNavigationHost } from "@hello-ai-company/editor-blocknote/react";

/** Synthetic-only atomic IndexedDB host. No user records, auth, network, paid provider or legacy keys. */
type RecordState = { snapshot: NotesDocumentSnapshot; page?: NotesPageSummary; panels: NotesPanelSnapshot; opaque: Record<string, JsonValue> };
type FixtureState = { viewRevisions?: Record<string,string>; viewJournals?: Record<string,DatabaseViewConfigOperation>; viewReceipts?: Record<string,{request?: DatabaseViewConfigOperation; result:DatabaseViewConfigReceipt}>; databaseViewConfigs?: Record<string, DatabaseViewConfig>; viewConfigRevision?: number; revision: number; records: Record<string, RecordState>; receipts: Record<string, { request?: NotesCommandRequest; result: NotesCommandResult }>; journals: Record<string, NotesRecovery>; schemas: Record<string, { revision: string; properties: Record<string, JsonValue>[] }>; canvases?: Record<string, { snapshot: NotesCanvasSnapshot; history: NotesCanvasSnapshot[] }>; canvasReceipts?: Record<string, { request?: NotesCanvasRequest; result: NotesCanvasResult }>; canvasJournals?: Record<string, NotesCanvasRecovery> };
const scope = { actorId: "synthetic-actor", workspaceId: "synthetic-notes" };
const key = (target: NotesTarget) => JSON.stringify(target.kind === "page" ? ["page", target.pageId] : ["row", target.databaseId, target.rowId]);
const copy = <T,>(value: T): T => structuredClone(value);
const COMMANDS: NotesDocumentSnapshot["capabilities"] = ["document.save", "page.create", "page.rename", "page.move", "page.duplicate", "page.trash", "page.restore", "metadata.patch", "comment.add", "comment.update", "comment.delete", "history.save", "history.restore", "history.rename", "history.delete", "property.patch", "schema.create-property", "schema.update-property", "schema.delete-property", "schema.reorder-properties", "template.save", "template.apply", "template.delete"];
function seeded(baseline = false, advanced = false, legacyValues = false, databaseViews = false, relations = false): FixtureState {
  const records: FixtureState["records"] = {};
  const add = (target: NotesTarget, title: string, parentId: string | null, position: number) => {
    const document = createEditorDocument([{ id: `${title}-heading`, type: "heading", props: { level: 2 }, content: "共同編集のメモ" }, { id: `${title}-text`, type: "paragraph", content: "書いた内容を保持し、必要な変更だけ確認します。" }, { id: `${title}-task`, type: "checkListItem", props: { checked: false }, content: "移管を再読込で確認する" }]);
    const snapshot: NotesDocumentSnapshot = { scope, target, revision: "r1", contentRevision: "c1", document, title, metadata: { category: "note", privacy: "private", tags: ["合成"], futureMetadata: { retained: true }, properties: { name: "行のメモ", score: 1 } }, capabilities: COMMANDS.filter(command => target.kind === "row" ? !command.startsWith("page.") : command !== "property.patch"), capabilitySemantics: Object.fromEntries(COMMANDS.filter(command => target.kind === "row" ? !command.startsWith("page.") : command !== "property.patch").map(command => [command, "test-only"])), legacyArchiveRef: `synthetic-archive:${key(target)}` };
    records[key(target)] = { snapshot, ...(target.kind === "page" ? { page: { id: target.pageId, title, parentId, position, favorite: target.pageId === "welcome", tags: ["合成"], updatedAt: "2026-10-07T00:00:00Z" } } : {}), panels: { revision: "p1", comments: [], history: [], templates: [], attachments: [] }, opaque: { unknown: { exact: [1, "保持", null] }, legacyVersion: 4, rawHTML: "<script>preserve, never execute</script>" } };
  };
  add({ kind: "page", pageId: "welcome" }, "移管の合成ノート", null, 0);
  add({ kind: "page", pageId: "projects" }, "プロジェクト", null, 1);
  add({ kind: "page", pageId: "child" }, "子ページ", "projects", 0);
  add({ kind: "row", databaseId: "synthetic-db", rowId: "row-1" }, "行のノート", null, 0);
  if (baseline) {
    const welcome = records[key({ kind: "page", pageId: "welcome" })]!;
    const target: NotesTarget = { kind: "page", pageId: "00000000-0000-4000-8000-000000000011" };
    delete records[key(welcome.snapshot.target)];
    welcome.snapshot.target = target; welcome.page!.id = target.pageId; records[key(target)] = welcome;
    welcome.snapshot.title = "Synthetic integration note";
    welcome.snapshot.document = createEditorDocument([{ id: "00000000-0000-4000-8000-000000000021", type: "paragraph", content: "Synthetic original body" }]);
    welcome.page!.title = welcome.snapshot.title;
    welcome.snapshot.metadata.tags = ["api", "saved"]; welcome.page!.tags = ["api", "saved"]; welcome.page!.favorite = false;
    const strategy = records[key({ kind: "page", pageId: "projects" })]!;
    strategy.snapshot.title = "Personal AI Platform strategy"; strategy.page!.title = strategy.snapshot.title;
    const child = records[key({ kind: "page", pageId: "child" })]!;
    child.snapshot.title = "API and sync implementation"; child.page!.title = child.snapshot.title;
    ["Synthetic lost generation", "Synthetic lost adoption", "Synthetic human edit", "Synthetic cancellation", "Synthetic unified studio", "Family travel ideas", "Daily memory review"].forEach((title, index) => {
      add({ kind: "page", pageId: `baseline-${index}` }, title, null, index + 2);
      const record = records[key({ kind: "page", pageId: `baseline-${index}` })]!;
      record.snapshot.metadata.tags = []; record.page!.tags = [];
      record.snapshot.document = createEditorDocument([{ id: `baseline-body-${index}`, type: "paragraph", content: "Synthetic original body" }]);
    });
  }
  if (advanced) {
    for (let index = 1; index <= 12; index++) {
      if (index > 1) add({ kind: "row", databaseId: "synthetic-db", rowId: `row-${index}` }, `合成の行 ${index}`, null, index);
      const record = records[key({ kind: "row", databaseId: "synthetic-db", rowId: `row-${index}` })]!;
      record.snapshot.metadata.properties = copy(syntheticParityValues);
      if (legacyValues) Object.assign(record.snapshot.metadata.properties, { user: "旧形式のユーザー名", location: "旧形式の場所名", files: [{ url: "https://example.invalid/old-file", name: "旧形式のファイル", kind: "file", size: 10 }] });
      record.snapshot.capabilities = [...record.snapshot.capabilities, "database.action"];
      record.snapshot.capabilitySemantics["database.action"] = "test-only";
    }
  }
  if (databaseViews) {
    add({ kind: "page", pageId: "database-views" }, "全11ビューの合成ノート", null, 2);
    const record = records[key({ kind: "page", pageId: "database-views" })]!;
    record.snapshot.document = createEditorDocument([...record.snapshot.document.blocks, { id: "synthetic-database-view", type: "databaseView", props: { databaseId: "synthetic-db", viewId: "main-table", viewType: "table", titleHint: "合成DBの全11ビュー" } }]);
    for (let index = 1; index <= 12; index++) {
      const row = records[key({ kind: "row", databaseId: "synthetic-db", rowId: `row-${index}` })]!;
      Object.assign(row.snapshot.metadata.properties as Record<string, JsonValue>, { name: `合成DB行 ${String(index).padStart(2, "0")}`, score: index * 10, status: index % 2 ? "a" : "b", date: `2026-10-${String(index).padStart(2, "0")}`, finish: `2026-10-${String(index + 3).padStart(2, "0")}`, location: { latitude: 35 + index / 10, longitude: 139 + index / 10, label: `合成の位置 ${index}` } });
    }
  }
  if (relations) {
    const target: NotesTarget = { kind: "page", pageId: baseline ? "00000000-0000-4000-8000-000000000011" : "welcome" };
    const active = records[key(target)]!;
    active.page!.relatedPageIds = ["projects", "projects", "relations-archived"];
    records[key({ kind: "page", pageId: "projects" })]!.page!.relatedPageIds = [target.pageId];
    records[key({ kind: "page", pageId: "child" })]!.page!.parentId = target.pageId;
    add({ kind: "page", pageId: "relations-source" }, "Relations source note", null, 12);
    add({ kind: "page", pageId: "relations-archived" }, "Archived relation", null, 13);
    records[key({ kind: "page", pageId: "relations-archived" })]!.page!.deletedAt = "synthetic-archived";
    active.snapshot.document = createEditorDocument([
      { id: "relations-heading", type: "heading", props: { level: 2 }, content: "Relations fixture" },
      { id: "relations-parent", type: "paragraph", content: "Nested parent", children: [
        { id: "nested-a", type: "paragraph", content: "Nested A" },
        { id: "nested-b", type: "paragraph", content: "Nested B", children: [{ id: "nested-grandchild", type: "paragraph", content: "Retained grandchild" }] },
        { id: "nested-c", type: "paragraph", content: "Nested C" }
      ] },
      { id: "relations-link", type: "paragraph", content: [{ type: "text", text: "Linked child " }, { type: "pageMention", props: { pageId: "child", titleHint: "API and sync implementation" } }] }
    ]);
  }
  return { revision: 1, records, receipts: {}, journals: {}, schemas: { "synthetic-db": { revision: "s1", properties: advanced ? syntheticParityDefinitions.map(definition => legacyValues && ["user", "location", "files"].includes(definition.type) ? { ...definition, config: { ...definition.config, valueMode: definition.type === "files" ? "legacy-files" : "legacy-text" } } : definition) : [{ id: "name", name: "名前", type: "text" }, { id: "score", name: "点数", type: "number" }] } } };
}
export function createSyntheticNotesWorkspaceHost(databaseName = "open-editor.synthetic-notes-workspace.v1", options: { baseline?: boolean; advanced?: boolean; legacyValues?: boolean; databaseViews?: boolean; reviewedViews?: boolean; relations?: boolean } = {}) {
  if (!/^open-editor\.synthetic-notes-workspace\.[a-z0-9.-]+$/.test(databaseName)) throw new Error("Synthetic database name required");
  const resourceListeners = new Set<(notice:NotesResourceInvalidation)=>void>();
  const listeners = new Set<() => void>(); let fault: "none" | "lost-ack" | "denied" | "offline" = "none";
  const ready = new Promise<IDBDatabase>((resolve, reject) => { const open = indexedDB.open(databaseName, 1); open.onupgradeneeded = () => open.result.createObjectStore("fixture"); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
  async function transaction<T>(write: boolean, signal: AbortSignal, work: (state: FixtureState) => T): Promise<T> {
    if (signal.aborted) throw new Error("Cancelled");
    const database = await ready;
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction("fixture", write ? "readwrite" : "readonly"), store = tx.objectStore("fixture"), read = store.get("state"); let result: T;
      const abort = () => { try { tx.abort(); } catch {} }; signal.addEventListener("abort", abort, { once: true });
      read.onsuccess = () => { try { if (signal.aborted) { tx.abort(); return; } const state = read.result as FixtureState | undefined ?? seeded(options.baseline, options.advanced, options.legacyValues, options.databaseViews, options.relations); result = work(state); if (write) store.put(state, "state"); } catch (error) { reject(error); tx.abort(); } };
      tx.oncomplete = () => { signal.removeEventListener("abort", abort); resolve(copy(result)); if (write) listeners.forEach(listener => listener()); };
      tx.onabort = tx.onerror = () => { signal.removeEventListener("abort", abort); reject(tx.error ?? new Error("Cancelled")); };
    });
  }
  const signal = () => new AbortController().signal;
  const host: NotesWorkspaceHost = {
    scope,
    readDocument: (target, abort) => transaction(false, abort, state => { const record = state.records[key(target)]; if (!record) throw new Error("Unavailable"); return record.snapshot; }),
    readWorkspace: (abort, options) => transaction(false, abort, state => {
      const all = Object.values(state.records).flatMap(record => record.page ? [record.page] : []).filter(page => options?.parentId === undefined || page.parentId === options.parentId).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
      const start = Number(options?.cursor ?? 0), limit = options?.limit ?? 50, pages = all.slice(start, start + limit), hasMore = start + limit < all.length;
      return { scope, revision: `w${state.revision}`, pages, nextCursor: hasMore ? String(start + limit) : null, hasMore, total: all.length, complete: start === 0 && !hasMore };
    }),
    searchWorkspace: (query, abort) => transaction(false, abort, state => ({ pages: Object.values(state.records).flatMap(record => record.page?.title.includes(query) ? [record.page] : []), nextCursor: null, hasMore: false })),
    readPanels: (target, abort) => transaction(false, abort, state => { const record = state.records[key(target)]; if (!record) throw new Error("Unavailable"); return record.panels; }),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    subscribeResourceChanges: listener => { resourceListeners.add(listener); return () => resourceListeners.delete(listener); },
    beforeSubmit: (recovery, abort) => transaction(true, abort, state => { if (JSON.stringify(recovery.request.scope) !== JSON.stringify(scope)) throw new Error("Scope mismatch"); state.journals[recovery.request.operationId] = copy(recovery); }),
    async commit(request, abort) {
      if (fault === "offline") throw new Error("Synthetic offline");
      const result = await transaction(true, abort, state => apply(state, request, fault === "denied"));
      if (options.reviewedViews && request.target.kind === "row" && result.status === "committed") resourceListeners.forEach(listener => listener({ scope, target: { kind: "page", pageId: "database-views" }, operationId: request.operationId }));
      if (fault === "lost-ack" && result.status === "committed") throw new Error("Synthetic lost acknowledgment");
      return result;
    },
    lookupOperation: (target, operationId, abort) => transaction(true, abort, state => {
      const entry = state.receipts[operationId];
      if (entry) return key(entry.result.target) === key(target) ? entry.result : { status: "denied", target, operationId };
      const result: NotesCommandResult = { status: "not-found", target, operationId, terminal: true }; state.receipts[operationId] = { result }; return result;
    })
  };
  const checkCanvasScope = (value: typeof scope) => { if (value.actorId !== scope.actorId || value.workspaceId !== scope.workspaceId) throw new Error("Synthetic Canvas scope mismatch"); };
  const canvasSnapshot = (state: FixtureState, target: NotesTarget): NotesCanvasSnapshot => {
    const record = state.records[key(target)];
    if (!record) throw new Error("Synthetic Canvas target unavailable");
    const previous = state.canvases?.[key(target)]?.snapshot;
    return { ...(previous ?? { scope, target, revision: "canvas-0", layout: null, view: {}, theme: "modern", capabilities: ["canvas.save", "canvas.repair"] }), documentRevision: record.snapshot.contentRevision };
  };
  const canvasHost: NotesCanvasHost = {
    read: (requestedScope, target, abort) => { checkCanvasScope(requestedScope); return transaction(false, abort, state => canvasSnapshot(state, target)); },
    beforeSubmit: (recovery, abort) => transaction(true, abort, state => {
      checkCanvasScope(recovery.request.scope);
      if (!state.records[key(recovery.request.target)]) throw new Error("Synthetic Canvas target unavailable");
      const journals = state.canvasJournals ??= {}, old = journals[recovery.request.operationId];
      if (old && JSON.stringify(old) !== JSON.stringify(recovery)) throw new Error("Canvas operation bytes changed");
      journals[recovery.request.operationId] = copy(recovery);
    }),
    async commit(request, abort) {
      checkCanvasScope(request.scope);
      const selectedFault = fault;
      if (selectedFault === "offline") throw new Error("Synthetic Canvas offline");
      const result = await transaction(true, abort, state => {
        const receipts = state.canvasReceipts ??= {}, prior = receipts[request.operationId];
        const base = { scope, target: request.target, operationId: request.operationId };
        if (prior) return prior.request && JSON.stringify(prior.request) === JSON.stringify(request) ? prior.result : { ...base, status: "rejected" as const };
        const reject = (status: "conflict" | "denied" | "rejected"): NotesCanvasResult => {
          const result: NotesCanvasResult = { ...base, status }; receipts[request.operationId] = { request: copy(request), result }; return result;
        };
        const journal = state.canvasJournals?.[request.operationId];
        if (!journal || JSON.stringify(journal.request) !== JSON.stringify(request)) return reject("rejected");
        if (selectedFault === "denied" || !state.records[key(request.target)]) return reject("denied");
        const before = canvasSnapshot(state, request.target);
        if (before.revision !== request.expectedRevision || before.documentRevision !== request.expectedDocumentRevision) return reject("conflict");
        if (validateCanvasLayoutSpec(request.draft.layout as unknown as CanvasLayoutSpec, state.records[key(request.target)]!.snapshot.document).length) return reject("rejected");
        const snapshot: NotesCanvasSnapshot = { ...before, ...copy(request.draft), revision: `canvas-${request.operationId}` };
        const canvases = state.canvases ??= {}, history = [...canvases[key(request.target)]?.history ?? [], copy(canvases[key(request.target)]?.snapshot ?? before)];
        canvases[key(request.target)] = { snapshot, history };
        const result: NotesCanvasResult = { ...base, status: "committed", snapshot: copy(snapshot) };
        receipts[request.operationId] = { request: copy(request), result: copy(result) };
        if (selectedFault !== "lost-ack") delete state.canvasJournals![request.operationId];
        return result;
      });
      if (selectedFault === "lost-ack" && result.status === "committed") throw new Error("Synthetic Canvas lost acknowledgment");
      return result;
    },
    lookup: (requestedScope, target, operationId, abort) => {
      checkCanvasScope(requestedScope);
      return transaction(true, abort, state => {
        const receipts = state.canvasReceipts ??= {}, entry = receipts[operationId];
        if (entry) {
          if (key(entry.result.target) !== key(target)) return { scope, target, operationId, status: "denied" };
          delete state.canvasJournals?.[operationId]; return entry.result;
        }
        const result: NotesCanvasResult = { scope, target, operationId, status: "not-found", terminal: true };
        receipts[operationId] = { result }; delete state.canvasJournals?.[operationId]; return result;
      });
    }
  };
  host.providers = { pages: { getPage: async pageId => { const snapshot = await host.readDocument({ kind: "page", pageId }, signal()); return { id: pageId, title: snapshot.title }; }, openPage: pageId => { void pageId; } } };
  function apply(state: FixtureState, request: NotesCommandRequest, deny: boolean): NotesCommandResult {
    const prior = state.receipts[request.operationId];
    if (prior) return prior.request && JSON.stringify(prior.request) === JSON.stringify(request) ? prior.result : { status: "rejected", target: request.target, operationId: request.operationId };
    const record = state.records[key(request.target)], reject = (status: "denied" | "conflict" | "rejected"): NotesCommandResult => { const result: NotesCommandResult = { status, target: request.target, operationId: request.operationId }; state.receipts[request.operationId] = { request: copy(request), result }; return result; };
    if (!record || deny || JSON.stringify(request.scope) !== JSON.stringify(scope) || !record.snapshot.capabilities.includes(request.command.kind) || request.expectedPersistence !== "test-only") return reject("denied");
    if (record.snapshot.revision !== request.expectedRevision || record.snapshot.contentRevision !== request.expectedContentRevision) return reject("conflict");
    const command = request.command;
    if ("expectedWorkspaceRevision" in command && command.expectedWorkspaceRevision !== undefined && command.expectedWorkspaceRevision !== `w${state.revision}`) return reject("conflict");
    const before = copy(record.snapshot), nextNumber = state.revision + 1, nextRevision = `r${nextNumber}`, time = new Date().toISOString(); let evidence: NotesMutationEvidence | undefined;
    if (command.kind === "document.save") { record.snapshot.document = copy(command.document); record.snapshot.title = command.title; if (record.page) record.page.title = command.title; record.snapshot.contentRevision = `c${nextNumber}`; }
    else if (command.kind === "page.rename") { record.snapshot.title = command.title; if (record.page) record.page.title = command.title; }
    else if (command.kind === "metadata.patch") { Object.assign(record.snapshot.metadata, copy(command.fields)); if (record.page) { if (typeof command.fields.favorite === "boolean") record.page.favorite = command.fields.favorite; if (typeof command.fields.category === "string") record.page.category = command.fields.category; if (Array.isArray(command.fields.tags)) record.page.tags = command.fields.tags.filter((tag): tag is string => typeof tag === "string"); } }
    else if (command.kind === "property.patch") {
      if (request.target.kind !== "row") return reject("rejected");
      if (options.advanced) { const definition = state.schemas[request.target.databaseId]?.properties.find(item => item.id === command.propertyId); if (!definition) return reject("rejected"); try { validateNotesDatabasePropertyValue(parseNotesDatabasePropertyDefinition(definition), command.value); } catch { return reject("rejected"); } }
      const props = record.snapshot.metadata.properties as Record<string, JsonValue>; props[command.propertyId] = copy(command.value);
    } else if (command.kind === "database.action") {
      if (!options.advanced || request.target.kind !== "row" || command.databaseId !== "synthetic-db" || command.rowId !== request.target.rowId || command.actionId !== "synthetic-confirm") return reject("denied");
      evidence = { kind: "database.action", databaseId: command.databaseId, rowId: command.rowId, actionId: command.actionId, revision: nextRevision, result: { synthetic: true } };
    }
    else if (command.kind.startsWith("page.")) {
      if (!record.page) return reject("rejected");
      if (command.kind === "page.create" || command.kind === "page.duplicate") {
        const parent = command.parentId === null ? undefined : state.records[key({ kind: "page", pageId: command.parentId })]; if (command.parentId !== null && (!parent?.page || parent.page.deletedAt)) return reject("rejected");
        const id = `page-${request.operationId}`, target: NotesTarget = { kind: "page", pageId: id }, created = copy(record);
        created.snapshot = { ...created.snapshot, target, title: command.title, revision: nextRevision, contentRevision: `c${nextNumber}`, legacyArchiveRef: `synthetic-archive:${id}`, document: command.kind === "page.create" ? createEditorDocument([{ id: `block-${id}`, type: "paragraph", content: "" }]) : copy(record.snapshot.document) };
        created.page = { id, title: command.title, parentId: command.parentId, position: nextNumber }; created.panels = { revision: nextRevision, comments: [], history: [], templates: [], attachments: [] }; state.records[key(target)] = created;
        evidence = { kind: command.kind, workspaceRevision: `w${nextNumber}`, page: created.page, createdDocument: created.snapshot.document };
      } else if (command.kind === "page.move") {
        if (`w${state.revision}` !== command.expectedWorkspaceRevision) return reject("conflict");
        let cursor = command.parentId; const seen = new Set([record.page.id]); while (cursor !== null) { if (seen.has(cursor)) return reject("rejected"); seen.add(cursor); const parent = state.records[key({ kind: "page", pageId: cursor })]?.page; if (!parent || parent.deletedAt) return reject("rejected"); cursor = parent.parentId; }
        record.page.parentId = command.parentId; record.page.position = command.position; evidence = { kind: command.kind, workspaceRevision: `w${nextNumber}`, page: record.page };
      } else if (command.kind === "page.trash" || command.kind === "page.restore") { record.page.deletedAt = command.kind === "page.trash" ? time : null; evidence = { kind: command.kind, workspaceRevision: `w${nextNumber}`, page: record.page }; }
      else return reject("denied");
    } else if (command.kind === "comment.add" || command.kind === "comment.update" || command.kind === "comment.delete") {
      const comments = [...record.panels.comments ?? []], commentId = command.kind === "comment.add" ? `comment-${request.operationId}` : command.commentId;
      let comment = comments.find(item => item.id === commentId);
      if (command.kind === "comment.add") { comment = { id: commentId, blockId: command.blockId, text: command.text, resolved: false, createdAt: time }; comments.push(comment); }
      else if (!comment) return reject("rejected");
      else if (command.kind === "comment.update") { if (command.text !== undefined) comment.text = command.text; if (command.resolved !== undefined) comment.resolved = command.resolved; }
      record.panels.comments = command.kind === "comment.delete" ? comments.filter(item => item.id !== commentId) : comments;
      evidence = { kind: command.kind, revision: nextRevision, commentId, comment: command.kind === "comment.delete" ? null : comment! };
    } else if (command.kind === "history.save" || command.kind === "history.restore" || command.kind === "history.rename" || command.kind === "history.delete") {
      const versions = [...record.panels.history ?? []], versionId = command.kind === "history.save" ? `version-${request.operationId}` : command.versionId; let version = versions.find(item => item.id === versionId);
      if (command.kind === "history.save") { version = { id: versionId, revision: nextRevision, ...(command.name !== undefined ? { name: command.name } : {}), createdAt: time, title: before.title, document: before.document }; versions.push(version); }
      else if (!version) return reject("rejected");
      else if (command.kind === "history.restore") { if (version.revision !== command.expectedVersionRevision || !version.document) return reject("conflict"); record.snapshot.document = copy(version.document); record.snapshot.title = version.title ?? before.title; record.snapshot.contentRevision = `c${nextNumber}`; if (record.page) record.page.title = record.snapshot.title; }
      else if (command.kind === "history.rename") version.name = command.name;
      record.panels.history = command.kind === "history.delete" ? versions.filter(item => item.id !== versionId) : versions;
      evidence = { kind: command.kind, revision: nextRevision, versionId, version: command.kind === "history.delete" ? null : version! };
    } else if (command.kind === "template.save" || command.kind === "template.apply" || command.kind === "template.delete") {
      const templates = [...record.panels.templates ?? []]; let template = templates.find(item => item.id === command.templateId);
      if (command.kind === "template.save") { template = { id: command.templateId, revision: nextRevision, title: command.title, document: copy(command.document) }; record.panels.templates = [...templates.filter(item => item.id !== command.templateId), template]; }
      else if (!template) return reject("rejected");
      else if (command.kind === "template.apply") { if (template.revision !== command.expectedTemplateRevision) return reject("conflict"); record.snapshot.document = copy(command.afterDocument); record.snapshot.contentRevision = `c${nextNumber}`; }
      else record.panels.templates = templates.filter(item => item.id !== command.templateId);
      evidence = { kind: command.kind, templateId: command.templateId, revision: nextRevision, template: command.kind === "template.delete" ? null : template! };
    } else if (command.kind === "schema.create-property" || command.kind === "schema.update-property" || command.kind === "schema.delete-property" || command.kind === "schema.reorder-properties") {
      const schema = state.schemas[command.databaseId]; if (!schema || schema.revision !== command.expectedSchemaRevision) return reject("conflict");
      if (command.kind === "schema.create-property") { if (schema.properties.some(property => property.id === command.definition.id)) return reject("rejected"); schema.properties.push(copy(command.definition)); }
      else if (command.kind === "schema.update-property") { const property = schema.properties.find(item => item.id === command.propertyId); if (!property) return reject("rejected"); Object.assign(property, copy(command.fields)); }
      else if (command.kind === "schema.delete-property") schema.properties = schema.properties.filter(item => item.id !== command.propertyId);
      else { if (command.propertyIds.length !== schema.properties.length || command.propertyIds.some(id => !schema.properties.some(property => property.id === id))) return reject("rejected"); schema.properties = command.propertyIds.map(id => schema.properties.find(item => item.id === id)!); }
      schema.revision = nextRevision; evidence = { kind: command.kind, databaseId: command.databaseId, revision: nextRevision, properties: schema.properties, complete: true };
    } else return reject("denied");
    state.revision = nextNumber; record.snapshot.revision = nextRevision; record.panels.revision = nextRevision; if (record.page) record.page.updatedAt = time;
    // Atomic original/history + canonical snapshot + operation receipt in this one IndexedDB transaction.
    record.panels.history = [...record.panels.history ?? [], { id: `original-${request.operationId}`, revision: before.revision, name: "変更前の原文", createdAt: time, title: before.title, document: before.document }];
    const result: NotesCommandResult = { status: "committed", operationId: request.operationId, target: request.target, snapshot: copy(record.snapshot), historyId: `original-${request.operationId}`, persistence: "test-only", ...(evidence ? { evidence: copy(evidence) } : {}) };
    if (options.reviewedViews && request.target.kind === "row") {
      const parent = state.records[key({ kind: "page", pageId: "database-views" })]; if (parent) parent.snapshot.revision = nextRevision;
    }
    state.receipts[request.operationId] = { request: copy(request), result: copy(result) }; return result;
  }
  const databaseNavigationHost: NotesDatabaseNavigationHost = { read: request => transaction(false, request.signal, state => {
    if (JSON.stringify(request.scope) !== JSON.stringify(scope) || request.databaseId !== "synthetic-db") throw new Error("Synthetic DB scope mismatch");
    const start = request.cursor ? Number(request.cursor) : 0;
    if (!Number.isInteger(start) || start < 0 || start > 12) throw new Error("Invalid synthetic cursor");
    const records = Object.values(state.records).filter(record => record.snapshot.target.kind === "row" && record.snapshot.target.databaseId === request.databaseId);
    const rows = records.slice(start, start + 8).map(record => ({ id: (record.snapshot.target as Extract<NotesTarget, { kind: "row" }>).rowId, title: record.snapshot.title, values: record.snapshot.metadata.properties as Record<string, JsonValue> }));
    return { scope, databaseId: request.databaseId, revision: `w${state.revision}`, columns: state.schemas[request.databaseId]!.properties.map(property => ({ id: String(property.id), title: String(property.name) })), rows, total: records.length, ...(start + 8 < records.length ? { nextCursor: String(start + 8) } : {}) };
  }) };
  let viewFault: "none" | "delay" | "reject" | "lost-ack" = "none";
  const databaseViews = options.databaseViews ? createSyntheticNotesDatabaseViews({ scope,
    readRows: () => transaction(false, signal(), state => Object.values(state.records).filter(record => record.snapshot.target.kind === "row" && record.snapshot.target.databaseId === "synthetic-db").map(record => ({ id: (record.snapshot.target as Extract<NotesTarget, { kind: "row" }>).rowId, title: record.snapshot.title, values: record.snapshot.metadata.properties as Record<string, JsonValue> }))),
    readConfig: viewId => transaction(false, signal(), state => state.databaseViewConfigs?.[viewId]),
    listConfigs: () => transaction(false, signal(), state => Object.values(state.databaseViewConfigs ?? {})),
    writeConfig: async config => { if (viewFault === "reject") throw new Error("Synthetic view save rejected"); if (viewFault === "delay") await new Promise(resolve => setTimeout(resolve, 500)); await transaction(true, signal(), state => { (state.databaseViewConfigs ??= {})[config.viewId] = copy(config); state.viewConfigRevision = (state.viewConfigRevision ?? 0) + 1; }); }
  }) : undefined;

  let reviewedAdapter: ReturnType<typeof createReviewedDatabaseViewConfigProvider> | undefined;
  const originalConfig = databaseViews?.databaseViewConfig;
  const viewPort: DatabaseViewConfigReceiptPort = {
    scope,
    read: async (request, abort) => { checkCanvasScope(request.scope); if (request.databaseId !== "synthetic-db") throw new Error("Foreign view"); const defaults = await originalConfig!.load!(request.databaseId, request.viewId); return transaction(false, abort, state => { const config = state.databaseViewConfigs?.[request.viewId] ?? defaults; return { ...request, revision: config === null ? null : state.viewRevisions?.[request.viewId] ?? "view-0", config }; }); },
    beforeSubmit: (request, abort) => { checkCanvasScope(request.scope); return transaction(true, abort, state => { if (request.databaseId !== "synthetic-db") throw new Error("Foreign view"); const prior = state.viewJournals?.[request.operationId]; if (prior && JSON.stringify(prior) !== JSON.stringify(request)) throw new Error("Changed view ticket"); (state.viewJournals ??= {})[request.operationId] = copy(request); }); },
    commit: async (request, abort) => {
      checkCanvasScope(request.scope); if (viewFault === "delay") await new Promise(resolve => setTimeout(resolve, 500));
      const defaults = request.databaseId === "synthetic-db" ? await originalConfig!.load!(request.databaseId, request.viewId) : null;
      const result = await transaction(true, abort, state => {
        const previous = state.viewReceipts?.[request.operationId], base = { scope, databaseId: request.databaseId, viewId: request.viewId, operationId: request.operationId };
        if (previous) return JSON.stringify(previous.request) === JSON.stringify(request) ? previous.result : { ...base, status: "rejected" as const };
        const revision = state.viewRevisions?.[request.viewId] ?? (defaults === null ? null : "view-0");
        let result: DatabaseViewConfigReceipt;
        if (request.databaseId !== "synthetic-db" || JSON.stringify(state.viewJournals?.[request.operationId]) !== JSON.stringify(request)) result = { ...base, status: "denied" };
        else if (request.expectedRevision !== revision) result = { ...base, status: "conflict" };
        else if (viewFault === "reject") result = { ...base, status: "rejected" };
        else { const next = "view-" + request.operationId; (state.databaseViewConfigs ??= {})[request.viewId] = copy(request.config); (state.viewRevisions ??= {})[request.viewId] = next; result = { ...base, status: "committed", previousRevision: revision, revision: next, config: copy(request.config), receiptId: "receipt-" + request.operationId }; }
        (state.viewReceipts ??= {})[request.operationId] = { request: copy(request), result: copy(result) }; if (viewFault !== "lost-ack") delete state.viewJournals?.[request.operationId]; return result;
      });
      if (viewFault === "lost-ack" && result.status === "committed") throw new Error("Synthetic view lost ACK"); return result;
    },
    lookup: (request, abort) => { checkCanvasScope(request.scope); return transaction(true, abort, state => { const prior = state.viewReceipts?.[request.operationId]; const result: DatabaseViewConfigReceipt = prior && prior.result.databaseId === request.databaseId && prior.result.viewId === request.viewId ? prior.result : { ...request, status: "not-found", terminal: true }; if (!prior) (state.viewReceipts ??= {})[request.operationId] = { result: copy(result) }; delete state.viewJournals?.[request.operationId]; return result; }); },
    list: (request, abort) => { checkCanvasScope(request.scope); if (abort.aborted) throw new Error("Cancelled"); return originalConfig!.list!(request.databaseId); }
  };
  if (databaseViews) host.providers = { database: databaseViews.provider };
  if (options.relations) host.providers = { ...host.providers, backlinks: { listBacklinks: async query => {
    const active = options.baseline ? "00000000-0000-4000-8000-000000000011" : "welcome";
    return query.targetType === "page" && query.targetId === active ? [{ sourceDocumentId: "relations-source", sourceTitle: "Untrusted transport title", kind: "page-reference" }, { sourceDocumentId: "unloaded", sourceTitle: "Hidden transport title", kind: "page-reference" }] : [];
  } } };
  return { host, canvasHost, databaseNavigationHost, databaseViews, setViewFault(value: typeof viewFault) { viewFault = value; }, readCanvasRecoveries: () => transaction(false, signal(), state => Object.values(state.canvasJournals ?? {})), setFault(value: typeof fault) { fault = value; }, initialize: async () => {
    await transaction(true, signal(), () => undefined);
    if (options.reviewedViews && databaseViews) {
      const recoveries = await transaction(false, signal(), state => Object.values(state.viewJournals ?? {}));
      reviewedAdapter = createReviewedDatabaseViewConfigProvider(viewPort, { recoveries });
      for (const recovery of recoveries) { const result = await reviewedAdapter.reconcile(recovery.databaseId, recovery.viewId); if (["pending", "unknown"].includes(result.status)) throw new Error("View recovery unresolved"); }
      databaseViews.databaseViewConfig = reviewedAdapter.provider;
    }
  }, readJournal: (target: NotesTarget) => transaction(false, signal(), state => Object.values(state.journals).find(recovery => key(recovery.request.target) === key(target) && !state.receipts[recovery.request.operationId]) ?? Object.values(state.journals).find(recovery => key(recovery.request.target) === key(target) && state.receipts[recovery.request.operationId]?.result.status === "committed")), readSchema: (databaseId: string, abort: AbortSignal): Promise<NotesDatabaseSchemaSnapshot> => transaction(false, abort, state => { const schema = state.schemas[databaseId]; if (!schema) throw new Error("Unavailable"); return { revision: schema.revision, properties: schema.properties as unknown as NotesDatabaseSchemaSnapshot["properties"] }; }), inspect: () => transaction(false, signal(), state => state) };
}
