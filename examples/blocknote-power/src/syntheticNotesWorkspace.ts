import { createEditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { type NotesDocumentSnapshot, type NotesWorkspaceHost, type NotesCommandRequest, type NotesCommandResult, type NotesRecovery, type NotesTarget, type NotesPanelSnapshot, type NotesMutationEvidence, type NotesPageSummary, type NotesDatabaseSchemaSnapshot } from "@hello-ai-company/editor-blocknote/notes";

/** Synthetic-only atomic IndexedDB host. No user records, auth, network, paid provider or legacy keys. */
type RecordState = { snapshot: NotesDocumentSnapshot; page?: NotesPageSummary; panels: NotesPanelSnapshot; opaque: Record<string, JsonValue> };
type FixtureState = { revision: number; records: Record<string, RecordState>; receipts: Record<string, { request?: NotesCommandRequest; result: NotesCommandResult }>; journals: Record<string, NotesRecovery>; schemas: Record<string, { revision: string; properties: Record<string, JsonValue>[] }> };
const scope = { actorId: "synthetic-actor", workspaceId: "synthetic-notes" };
const key = (target: NotesTarget) => JSON.stringify(target.kind === "page" ? ["page", target.pageId] : ["row", target.databaseId, target.rowId]);
const copy = <T,>(value: T): T => structuredClone(value);
const COMMANDS: NotesDocumentSnapshot["capabilities"] = ["document.save", "page.create", "page.rename", "page.move", "page.duplicate", "page.trash", "page.restore", "metadata.patch", "comment.add", "comment.update", "comment.delete", "history.save", "history.restore", "history.rename", "history.delete", "property.patch", "schema.create-property", "schema.update-property", "schema.delete-property", "schema.reorder-properties", "template.save", "template.apply", "template.delete"];
function seeded(): FixtureState {
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
  return { revision: 1, records, receipts: {}, journals: {}, schemas: { "synthetic-db": { revision: "s1", properties: [{ id: "name", name: "名前", type: "text" }, { id: "score", name: "点数", type: "number" }] } } };
}
export function createSyntheticNotesWorkspaceHost(databaseName = "open-editor.synthetic-notes-workspace.v1") {
  if (!/^open-editor\.synthetic-notes-workspace\.[a-z0-9.-]+$/.test(databaseName)) throw new Error("Synthetic database name required");
  const listeners = new Set<() => void>(); let fault: "none" | "lost-ack" | "denied" | "offline" = "none";
  const ready = new Promise<IDBDatabase>((resolve, reject) => { const open = indexedDB.open(databaseName, 1); open.onupgradeneeded = () => open.result.createObjectStore("fixture"); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
  async function transaction<T>(write: boolean, signal: AbortSignal, work: (state: FixtureState) => T): Promise<T> {
    if (signal.aborted) throw new Error("Cancelled");
    const database = await ready;
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction("fixture", write ? "readwrite" : "readonly"), store = tx.objectStore("fixture"), read = store.get("state"); let result: T;
      const abort = () => { try { tx.abort(); } catch {} }; signal.addEventListener("abort", abort, { once: true });
      read.onsuccess = () => { try { if (signal.aborted) { tx.abort(); return; } const state = read.result as FixtureState | undefined ?? seeded(); result = work(state); if (write) store.put(state, "state"); } catch (error) { reject(error); tx.abort(); } };
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
    beforeSubmit: (recovery, abort) => transaction(true, abort, state => { if (JSON.stringify(recovery.request.scope) !== JSON.stringify(scope)) throw new Error("Scope mismatch"); state.journals[recovery.request.operationId] = copy(recovery); }),
    async commit(request, abort) {
      if (fault === "offline") throw new Error("Synthetic offline");
      const result = await transaction(true, abort, state => apply(state, request, fault === "denied"));
      if (fault === "lost-ack" && result.status === "committed") throw new Error("Synthetic lost acknowledgment");
      return result;
    },
    lookupOperation: (target, operationId, abort) => transaction(true, abort, state => {
      const entry = state.receipts[operationId];
      if (entry) return key(entry.result.target) === key(target) ? entry.result : { status: "denied", target, operationId };
      const result: NotesCommandResult = { status: "not-found", target, operationId, terminal: true }; state.receipts[operationId] = { result }; return result;
    })
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
    else if (command.kind === "property.patch") { if (request.target.kind !== "row") return reject("rejected"); const props = record.snapshot.metadata.properties as Record<string, JsonValue>; props[command.propertyId] = copy(command.value); }
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
    state.receipts[request.operationId] = { request: copy(request), result: copy(result) }; return result;
  }
  return { host, setFault(value: typeof fault) { fault = value; }, initialize: () => transaction(true, signal(), () => undefined), readJournal: (target: NotesTarget) => transaction(false, signal(), state => Object.values(state.journals).find(recovery => key(recovery.request.target) === key(target) && !state.receipts[recovery.request.operationId]) ?? Object.values(state.journals).find(recovery => key(recovery.request.target) === key(target) && state.receipts[recovery.request.operationId]?.result.status === "committed")), readSchema: (databaseId: string, abort: AbortSignal): Promise<NotesDatabaseSchemaSnapshot> => transaction(false, abort, state => { const schema = state.schemas[databaseId]; if (!schema) throw new Error("Unavailable"); return { revision: schema.revision, properties: schema.properties as unknown as NotesDatabaseSchemaSnapshot["properties"] }; }), inspect: () => transaction(false, signal(), state => state) };
}
