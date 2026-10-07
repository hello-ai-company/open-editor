import { createEditorDocument, type EditorDocument, type JsonValue } from "@hello-ai-company/editor-core";
import { copyLegacyNotesJson } from "../document/legacyNotes.js";
import type { NotesCommand, NotesCommandKind, NotesCommandOutcome, NotesCommandRequest, NotesCommandResult, NotesDocumentSnapshot, NotesDraftBackup, NotesRecovery, NotesScope, NotesTarget, NotesWorkspaceController, NotesWorkspaceHost, NotesWorkspaceState } from "./contracts.js";

export const NOTES_COMMAND_KINDS: readonly NotesCommandKind[] = ["document.save", "page.create", "page.rename", "page.move", "page.duplicate", "page.trash", "page.restore", "page.delete-permanently", "metadata.patch", "comment.add", "comment.update", "comment.delete", "history.save", "history.restore", "history.rename", "history.delete", "property.patch", "schema.create-property", "schema.update-property", "schema.delete-property", "schema.reorder-properties", "database.action", "template.save", "template.apply", "template.delete", "media.attach", "media.detach", "shared.save"];
const fields: Record<NotesCommandKind, readonly string[]> = {
  "document.save": ["document", "title"], "page.create": ["parentId", "title", "expectedWorkspaceRevision"], "page.rename": ["title", "expectedWorkspaceRevision"], "page.move": ["parentId", "position", "expectedWorkspaceRevision"], "page.duplicate": ["parentId", "title", "expectedWorkspaceRevision"], "page.trash": ["expectedWorkspaceRevision"], "page.restore": ["expectedWorkspaceRevision"], "page.delete-permanently": ["confirmation", "expectedWorkspaceRevision"], "metadata.patch": ["fields", "expectedWorkspaceRevision"], "comment.add": ["blockId", "text"], "comment.update": ["commentId", "text", "resolved"], "comment.delete": ["commentId"], "history.save": ["name"], "history.restore": ["versionId", "expectedVersionRevision"], "history.rename": ["versionId", "name"], "history.delete": ["versionId"], "property.patch": ["propertyId", "value"], "schema.create-property": ["databaseId", "definition", "expectedSchemaRevision"], "schema.update-property": ["databaseId", "propertyId", "fields", "expectedSchemaRevision"], "schema.delete-property": ["databaseId", "propertyId", "expectedSchemaRevision"], "schema.reorder-properties": ["databaseId", "propertyIds", "expectedSchemaRevision"], "database.action": ["databaseId", "rowId", "actionId"], "template.save": ["templateId", "title", "document"], "template.apply": ["templateId", "expectedTemplateRevision", "afterDocument"], "template.delete": ["templateId"], "media.attach": ["blockId", "assetId", "presentation"], "media.detach": ["blockId", "assetId"], "shared.save": ["sharedId", "expectedSharedRevision", "document"]
};
function clone<T>(value: T): T { return copyLegacyNotesJson(value) as T; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected Notes JSON object"); return value as Record<string, unknown>; }
function exact(value: Record<string, unknown>, allowed: readonly string[]): void { if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error("Unknown Notes field"); }
function id(value: unknown): string { if (typeof value !== "string" || !value || value.length > 512) throw new Error("Invalid Notes identity/revision"); return value; }
function localId(value: unknown): string { if (typeof value !== "string" || !value || value.length > 4096 || ["__proto__", "constructor", "prototype"].includes(value)) throw new Error("Invalid local Notes draft identity"); return value; }
function text(value: unknown): string { if (typeof value !== "string" || value.length > 16000) throw new Error("Invalid Notes text"); return value; }
function target(value: unknown): NotesTarget {
  const raw = object(clone(value));
  if (raw.kind === "page") { exact(raw, ["kind", "pageId"]); return { kind: "page", pageId: id(raw.pageId) }; }
  if (raw.kind === "row") { exact(raw, ["kind", "databaseId", "rowId"]); return { kind: "row", databaseId: id(raw.databaseId), rowId: id(raw.rowId) }; }
  throw new Error("Invalid Notes target");
}
function scope(value: unknown): NotesScope { const raw = object(clone(value)); exact(raw, ["actorId", "workspaceId"]); return { actorId: id(raw.actorId), workspaceId: id(raw.workspaceId) }; }
const persistenceModes = ["local-only", "offline-queued", "remote-committed", "test-only"];
function equal(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}` : String(JSON.stringify(v));
  return canonical(a) === canonical(b);
}
function document(value: unknown): EditorDocument { const raw = object(value); exact(raw, ["schemaVersion", "blocks"]); if (typeof raw.schemaVersion !== "number" || !Array.isArray(raw.blocks)) throw new Error("Invalid Notes canonical document"); return createEditorDocument(raw.blocks as EditorDocument["blocks"], raw.schemaVersion); }
export function parseNotesCommand(value: unknown): NotesCommand {
  const raw = object(clone(value));
  if (!NOTES_COMMAND_KINDS.includes(raw.kind as NotesCommandKind)) throw new Error("Unsupported Notes command");
  const kind = raw.kind as NotesCommandKind; exact(raw, ["kind", ...fields[kind]]);
  const optional = kind === "history.save" ? ["name"] : kind === "comment.update" ? ["text", "resolved"] : kind === "metadata.patch" ? ["expectedWorkspaceRevision"] : [];
  for (const field of fields[kind]) {
    if (!Object.hasOwn(raw, field)) { if (optional.includes(field)) continue; throw new Error("Incomplete Notes command"); }
    const value = raw[field];
    if (field === "document" || field === "afterDocument") raw[field] = document(value);
    else if (field === "parentId") { if (value !== null) id(value); }
    else if (field === "propertyIds") { if (!Array.isArray(value) || value.length > 1000 || new Set(value).size !== value.length) throw new Error("Invalid property order"); value.forEach(id); }
    else if (field === "position") { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Invalid page position"); }
    else if (field === "resolved") { if (typeof value !== "boolean") throw new Error("Invalid comment resolution"); }
    else if (["fields", "definition"].includes(field)) { const bag = object(value); if (!Object.keys(bag).length || Object.keys(bag).length > 64 || Object.keys(bag).some(k => ["__proto__", "constructor", "prototype"].includes(k))) throw new Error("Invalid Notes field patch"); }
    else if (field === "value") { /* bounded detached JSON admitted by clone */ }
    else if (["title", "text", "name"].includes(field)) text(value);
    else id(value);
  }
  if (kind === "comment.update" && raw.text === undefined && raw.resolved === undefined) throw new Error("Empty comment update");
  if (kind === "page.delete-permanently" && raw.confirmation !== "delete-permanently") throw new Error("Explicit deletion confirmation required");
  if (kind === "media.attach" && !["compact", "card"].includes(raw.presentation as string)) throw new Error("Invalid media presentation");
  return raw as unknown as NotesCommand;
}
export function parseNotesDocumentSnapshot(value: unknown): NotesDocumentSnapshot {
  const raw = object(clone(value)); exact(raw, ["scope", "target", "revision", "contentRevision", "document", "title", "metadata", "capabilities", "capabilitySemantics", "legacyArchiveRef"]);
  scope(raw.scope); target(raw.target); id(raw.revision); id(raw.contentRevision); text(raw.title); document(raw.document); object(raw.metadata);
  if (!Array.isArray(raw.capabilities) || new Set(raw.capabilities).size !== raw.capabilities.length || raw.capabilities.some(k => !NOTES_COMMAND_KINDS.includes(k))) throw new Error("Invalid Notes capabilities");
  const semantics = object(raw.capabilitySemantics);
  if (Object.keys(semantics).some(k => !(raw.capabilities as string[]).includes(k)) || (raw.capabilities as string[]).some(k => !persistenceModes.includes(semantics[k] as string))) throw new Error("Notes capability persistence unavailable");
  if (raw.legacyArchiveRef !== undefined) id(raw.legacyArchiveRef);
  return raw as unknown as NotesDocumentSnapshot;
}
function parseRecovery(value: unknown): NotesRecovery {
  const raw = object(clone(value)); exact(raw, ["version", "request", "originalDraft", "mergeSourceDraft", "localDrafts", "localDraftVersions", "localDraftRef"]); if (raw.version !== 1) throw new Error("Invalid Notes recovery version");
  const request = object(raw.request); exact(request, ["operationId", "scope", "target", "expectedRevision", "expectedContentRevision", "expectedPersistence", "command"]);
  id(request.operationId); scope(request.scope); id(request.expectedRevision); id(request.expectedContentRevision); target(request.target); parseNotesCommand(request.command);
  if (!persistenceModes.includes(request.expectedPersistence as string)) throw new Error("Invalid Notes recovery persistence");
  for (const field of ["originalDraft", "mergeSourceDraft"]) if (raw[field] !== undefined) { const backup = object(raw[field]); exact(backup, ["scope", "target", "revision", "contentRevision", "document", "title"]); scope(backup.scope); target(backup.target); id(backup.revision); id(backup.contentRevision); document(backup.document); text(backup.title); if (!equal(backup.scope, request.scope) || !equal(backup.target, request.target)) throw new Error("Notes backup scope mismatch"); }
  if (raw.localDrafts !== undefined || raw.localDraftVersions !== undefined) { const drafts = object(raw.localDrafts), versions = object(raw.localDraftVersions); if (!equal(Object.keys(drafts).sort(), Object.keys(versions).sort())) throw new Error("Invalid local Notes recovery versions"); for (const key of Object.keys(drafts)) { localId(key); id(versions[key]); } }
  if (raw.localDraftRef !== undefined) { const ref = object(raw.localDraftRef); exact(ref, ["id", "version"]); localId(ref.id); id(ref.version); if (object(raw.localDraftVersions)[ref.id as string] !== ref.version) throw new Error("Invalid local Notes recovery reference"); }
  return raw as unknown as NotesRecovery;
}
function freeze<T>(value: T): T { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }

function validateEvidence(request: NotesCommandRequest, snapshot: NotesDocumentSnapshot, value: unknown): void {
  const command = request.command;
  const fail = (): never => { throw new Error("Canonical Notes mutation evidence does not match the reviewed operation"); };
  if (command.kind === "document.save" || command.kind === "page.rename" || command.kind === "metadata.patch") return;
  if (command.kind === "property.patch") { if (!equal(object(snapshot.metadata.properties)[command.propertyId], command.value)) fail(); return; }
  const evidence = object(value);
  if (evidence.kind !== command.kind) fail();
  if (command.kind.startsWith("page.")) {
    id(evidence.workspaceRevision);
    if (command.kind === "page.delete-permanently") { if (evidence.page !== null) fail(); return; }
    const record = object(evidence.page); id(record.id); text(record.title);
    if (command.kind === "page.create" || command.kind === "page.duplicate") { if (record.title !== command.title || record.parentId !== command.parentId || request.target.kind !== "page" || record.id === request.target.pageId) fail(); document(evidence.createdDocument); }
    else { if (request.target.kind !== "page" || record.id !== request.target.pageId) fail(); }
    if (command.kind === "page.move" && (record.parentId !== command.parentId || record.position !== command.position || evidence.workspaceRevision === command.expectedWorkspaceRevision)) fail();
    if (command.kind === "page.trash" && (typeof record.deletedAt !== "string" || !record.deletedAt)) fail();
    if (command.kind === "page.restore" && record.deletedAt !== null) fail();
    return;
  }
  id(evidence.revision);
  switch (command.kind) {
    case "comment.add": case "comment.update": case "comment.delete": {
      id(evidence.commentId);
      if (command.kind !== "comment.add" && evidence.commentId !== command.commentId) fail();
      if (command.kind === "comment.delete") { if (evidence.comment !== null) fail(); break; }
      const comment = object(evidence.comment);
      if (comment.id !== evidence.commentId || command.kind === "comment.add" && (comment.blockId !== command.blockId || comment.text !== command.text) || command.kind === "comment.update" && (command.text !== undefined && comment.text !== command.text || command.resolved !== undefined && comment.resolved !== command.resolved)) fail();
      break;
    }
    case "history.save": case "history.restore": case "history.rename": case "history.delete": {
      id(evidence.versionId);
      if (command.kind !== "history.save" && evidence.versionId !== command.versionId) fail();
      if (command.kind === "history.delete") { if (evidence.version !== null) fail(); break; }
      const version = object(evidence.version); if (version.id !== evidence.versionId) fail();
      if (command.kind === "history.save" && (command.name !== undefined && version.name !== command.name || !equal(document(version.document), snapshot.document) || version.title !== snapshot.title)) fail();
      if (command.kind === "history.rename" && version.name !== command.name) fail();
      if (command.kind === "history.restore" && (version.revision !== command.expectedVersionRevision || !equal(document(version.document), snapshot.document) || version.title !== snapshot.title)) fail();
      break;
    }
    case "schema.create-property": case "schema.update-property": case "schema.delete-property": case "schema.reorder-properties": {
      if (evidence.databaseId !== command.databaseId || evidence.revision === command.expectedSchemaRevision || evidence.complete !== true || !Array.isArray(evidence.properties)) fail();
      const properties = (evidence.properties as unknown[]).map(object); const ids = properties.map(p => id(p.id)); if (new Set(ids).size !== ids.length) fail();
      if (command.kind === "schema.create-property") { const property = properties.find(p => p.id === command.definition.id); if (!property || Object.entries(command.definition).some(([key, value]) => !equal(property[key], value))) fail(); }
      if (command.kind === "schema.update-property") { const property = properties.find(p => p.id === command.propertyId); if (!property || Object.entries(command.fields).some(([key, value]) => !equal(property[key], value))) fail(); }
      if (command.kind === "schema.delete-property" && ids.includes(command.propertyId)) fail();
      if (command.kind === "schema.reorder-properties" && !equal(ids, command.propertyIds)) fail();
      break;
    }
    case "database.action": if (evidence.databaseId !== command.databaseId || evidence.rowId !== command.rowId || evidence.actionId !== command.actionId || !Object.hasOwn(evidence, "result")) fail(); break;
    case "template.save": case "template.apply": case "template.delete": {
      if (evidence.templateId !== command.templateId) fail();
      if (command.kind === "template.delete") { if (evidence.template !== null) fail(); break; }
      const template = object(evidence.template); if (template.id !== command.templateId) fail();
      if (command.kind === "template.save" && (template.title !== command.title || !equal(document(template.document), command.document))) fail();
      if (command.kind === "template.apply" && (template.revision !== command.expectedTemplateRevision || !equal(snapshot.document, command.afterDocument))) fail();
      break;
    }
    case "media.attach": case "media.detach": {
      if (evidence.blockId !== command.blockId || evidence.assetId !== command.assetId) fail();
      if (command.kind === "media.detach") { if (evidence.attachment !== null) fail(); break; }
      const attachment = object(evidence.attachment); if (attachment.id !== command.assetId || attachment.blockId !== command.blockId || evidence.presentation !== command.presentation) fail(); break;
    }
    case "shared.save": if (evidence.sharedId !== command.sharedId || evidence.revision === command.expectedSharedRevision || !equal(document(evidence.document), command.document)) fail(); break;
    default: fail();
  }
}

/** Instance scoped, input-preserving controller. No storage/network/provider secret implementation. */
export function createNotesWorkspaceController(host: NotesWorkspaceHost, options: { timeoutMs?: number; operationId?: () => string; recovery?: NotesRecovery } = {}): NotesWorkspaceController {
  const hostScope = scope(host.scope);
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error("Invalid Notes timeout");
  let state: NotesWorkspaceState = freeze({ status: "empty", dirty: false, composing: false, message: "", localDrafts: {}, pendingEditors: false });
  let generation = 0, activity = 0, readGeneration = 0, disposed = false, busy = false;
  let controller: AbortController | undefined, recovery = options.recovery ? parseRecovery(options.recovery) : undefined;
  let submissionGeneration = 0;
  let localDraftVersions: Record<string, string> = recovery?.localDraftVersions ? clone(recovery.localDraftVersions) : {};
  let localDraftTarget: NotesTarget | undefined = recovery?.localDrafts ? clone(recovery.request.target) : undefined;
  let reviewedLatest: { snapshot: NotesDocumentSnapshot; activity: number; baseRevision: string } | undefined;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<NotesWorkspaceState>): void => { if (disposed) return; state = freeze({ ...state, ...patch }); for (const listener of listeners) { try { listener(); } catch { /* observers cannot modify persistence */ } } };
  if (recovery && !equal(recovery.request.scope, hostScope)) throw new Error("Notes recovery scope mismatch");
  if (recovery) update({ status: "unknown", recovery: clone(recovery), localDrafts: recovery.localDrafts ? clone(recovery.localDrafts) : {}, pendingEditors: Object.keys(recovery.localDrafts ?? {}).length > 0, originalDraft: recovery.originalDraft ? clone(recovery.originalDraft) : undefined, mergeSourceDraft: recovery.mergeSourceDraft ? clone(recovery.mergeSourceDraft) : undefined, message: "保存結果を照会してください" });
  const draftBackup = (): NotesDraftBackup | undefined => state.snapshot && state.draft ? { scope: clone(hostScope), target: clone(state.snapshot.target), revision: state.snapshot.revision, contentRevision: state.snapshot.contentRevision, document: clone(state.draft), title: state.draftTitle ?? state.snapshot.title } : undefined;
  const allowed = (): void => { if (disposed || busy || recovery || state.composing || !state.snapshot || ["conflict", "denied"].includes(state.status)) throw new Error("Notes operation unavailable; preserve draft and resolve current state first"); };
  const bounded = async <T>(work: Promise<T>, signal: AbortSignal): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    try { return await Promise.race([work, new Promise<never>((_, reject) => { abort = () => reject(new Error("Notes operation cancelled")); signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort(); timer = setTimeout(() => reject(new Error("Notes operation unconfirmed")), timeoutMs); })]); }
    finally { clearTimeout(timer); if (abort) signal.removeEventListener("abort", abort); }
  };
  const settle = (result: NotesCommandResult, request: NotesCommandRequest): NotesCommandResult => {
    const raw = object(clone(result));
    const status = raw.status;
    if (!equal(target(raw.target), request.target) || raw.operationId !== request.operationId || !["committed", "conflict", "denied", "rejected", "unknown", "pending", "not-found"].includes(String(status))) throw new Error("Mismatched Notes receipt");
    exact(raw, status === "committed" ? ["status", "operationId", "target", "snapshot", "historyId", "persistence", "evidence"] : status === "not-found" ? ["status", "operationId", "target", "terminal"] : ["status", "operationId", "target"]);
    if (status === "committed") {
      const snapshot = parseNotesDocumentSnapshot(raw.snapshot); id(raw.historyId);
      if (!equal(snapshot.scope, hostScope) || !persistenceModes.includes(raw.persistence as string) || raw.persistence === "offline-queued") throw new Error("Unconfirmed Notes canonical persistence");
      if (raw.persistence !== request.expectedPersistence && !(request.expectedPersistence === "offline-queued" && raw.persistence === "remote-committed")) throw new Error("Notes receipt persistence mismatch");
      if (!equal(snapshot.target, request.target) || snapshot.revision === request.expectedRevision) throw new Error("Invalid Notes committed revision/scope");
      if (request.command.kind === "document.save" && (!equal(snapshot.document, request.command.document) || snapshot.title !== request.command.title)) throw new Error("Receipt did not save the exact reviewed document");
      if (request.command.kind === "page.rename" && snapshot.title !== request.command.title) throw new Error("Receipt did not rename the reviewed page");
      if (request.command.kind === "metadata.patch" && Object.entries(request.command.fields).some(([key, value]) => !Object.hasOwn(snapshot.metadata, key) || !equal(snapshot.metadata[key], value))) throw new Error("Receipt did not persist the reviewed metadata");
      validateEvidence(request, snapshot, raw.evidence);
      const localRef = recovery?.localDraftRef;
      if (localRef && localDraftVersions[localRef.id] === localRef.version) { const drafts = { ...state.localDrafts }; delete drafts[localRef.id]; delete localDraftVersions[localRef.id]; activity++; update({ localDrafts: drafts, pendingEditors: Object.keys(drafts).length > 0 }); }
      const newerInput = generation !== submissionGeneration;
      recovery = undefined;
      reviewedLatest = undefined;
      update({ snapshot, ...(!newerInput ? { draft: clone(snapshot.document), draftTitle: snapshot.title, dirty: false } : { dirty: true }), status: "ready", recovery: undefined, latest: undefined, originalDraft: undefined, mergeSourceDraft: undefined, manualSaveRequired: false, lastPersistence: raw.persistence as NotesWorkspaceState["lastPersistence"], message: raw.persistence === "local-only" ? "この端末に保存しました" : raw.persistence === "test-only" ? "合成テストの保存を確認しました" : "サーバーへの保存を確認しました" });
    } else if (status === "pending" || status === "unknown") update({ status: "unknown", recovery: clone(recovery!), message: "保存結果が不明です。再送せず結果を照会してください" });
    else {
      if (status === "not-found" && raw.terminal !== true) throw new Error("Unfenced Notes operation");
      recovery = undefined;
      reviewedLatest = undefined;
      update({ status: status === "denied" ? "denied" : status === "conflict" ? "conflict" : state.snapshot ? "ready" : "empty", recovery: undefined, latest: undefined, ...(["denied", "conflict"].includes(String(status)) ? { originalDraft: state.originalDraft ?? draftBackup() } : {}), message: status === "not-found" ? "保存されなかったことを確認しました" : "保存できませんでした。入力は保持しています" });
    }
    return raw as unknown as NotesCommandResult;
  };
  const execute = async (value: NotesCommand, executeOptions: { localDraftId?: string } = {}): Promise<NotesCommandOutcome> => {
    allowed(); const command = parseNotesCommand(value), snapshot = state.snapshot!;
    if (!snapshot.capabilities.includes(command.kind)) throw new Error("Notes capability unavailable");
    if (snapshot.target.kind === "row" && (command.kind.startsWith("page.") || "databaseId" in command && command.databaseId !== snapshot.target.databaseId || command.kind === "database.action" && command.rowId !== snapshot.target.rowId)) throw new Error("Notes command row scope mismatch");
    if (command.kind !== "document.save" && state.dirty) throw new Error("Save the current draft before a resource mutation");
    let localRef: { id: string; version: string } | undefined;
    if (executeOptions.localDraftId !== undefined) {
      const key = localId(executeOptions.localDraftId), cached = object(state.localDrafts[key]);
      if (cached.baseRevision !== snapshot.revision) throw new Error("Local Notes editor changed; review the latest revision before submitting");
      if (command.kind === "property.patch" && cached.kind === "property") { if (cached.propertyId !== command.propertyId || typeof cached.source !== "string" || !equal(clone(JSON.parse(cached.source)), command.value)) throw new Error("Local property draft does not match the reviewed value"); }
      else if (!equal(parseNotesCommand(cached.command), command)) throw new Error("Local Notes draft does not match the reviewed command");
      localRef = { id: key, version: localDraftVersions[key]! };
    } else if (command.kind !== "document.save" && state.pendingEditors) throw new Error("Review or cancel local Notes editors before this resource mutation");
    const request: NotesCommandRequest = { scope: clone(hostScope), expectedContentRevision: snapshot.contentRevision, expectedPersistence: snapshot.capabilitySemantics[command.kind]!, operationId: id((options.operationId ?? (() => crypto.randomUUID()))()), target: clone(snapshot.target), expectedRevision: snapshot.revision, command };
    recovery = { version: 1, request: clone(request), ...(state.originalDraft ? { originalDraft: clone(state.originalDraft) } : {}), ...(state.mergeSourceDraft ? { mergeSourceDraft: clone(state.mergeSourceDraft) } : {}), ...(state.pendingEditors ? { localDrafts: clone(state.localDrafts), localDraftVersions: clone(localDraftVersions) } : {}), ...(localRef ? { localDraftRef: localRef } : {}) }; submissionGeneration = generation; busy = true;
    const local = new AbortController(); controller = local;
    update({ status: "saving", recovery: clone(recovery), message: "保存中" });
    let submitted = false;
    try {
      const result = await bounded(Promise.resolve().then(async () => {
        await host.beforeSubmit(clone(recovery!), local.signal);
        if (local.signal.aborted || disposed || localRef && localDraftVersions[localRef.id] !== localRef.version || !localRef && command.kind !== "document.save" && state.pendingEditors) throw new Error("Cancelled before submission");
        submitted = true;
        return host.commit(clone(request), local.signal);
      }), local.signal);
      return settle(result, request);
    } catch {
      local.abort();
      if (!submitted) { recovery = undefined; update({ status: "ready", recovery: undefined, message: "送信前にキャンセルしました。入力は保持しています" }); return { status: "cancelled", target: request.target, operationId: request.operationId }; }
      update({ status: "unknown", recovery: clone(recovery!), message: "保存結果が不明です。再送せず結果を照会してください" });
      return { status: "unknown", target: request.target, operationId: request.operationId };
    } finally { busy = false; if (controller === local) controller = undefined; }
  };
  const api: NotesWorkspaceController = {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setDraft: (value, title) => {
      if (disposed || !state.snapshot) throw new Error("No Notes document loaded");
      const draft = document(clone(value)), draftTitle = title === undefined ? state.draftTitle ?? state.snapshot.title : text(title);
      if (equal(draft, state.draft) && draftTitle === state.draftTitle) return;
      generation++; activity++;
      reviewedLatest = undefined;
      update({ draft, draftTitle, latest: undefined, dirty: !equal(draft, state.snapshot.document) || draftTitle !== state.snapshot.title, message: "未保存の変更" });
    },
    setComposing: composing => { if (typeof composing !== "boolean") throw new Error("Invalid composition state"); if (composing !== state.composing) { activity++; update({ composing }); } },
    setLocalDraft: (valueId, value) => {
      if (disposed || !state.snapshot) throw new Error("No Notes document loaded");
      const key = localId(valueId);
      localDraftTarget = clone(state.snapshot.target);
      const detached = value === undefined ? undefined : clone(value);
      if (detached === undefined && !Object.hasOwn(state.localDrafts, key) || detached !== undefined && Object.hasOwn(state.localDrafts, key) && equal(state.localDrafts[key], detached)) return;
      const drafts: Record<string, JsonValue> = { ...state.localDrafts };
      if (detached === undefined) { delete drafts[key]; delete localDraftVersions[key]; }
      else { drafts[key] = detached; clone(drafts); localDraftVersions[key] = crypto.randomUUID(); }
      activity++; reviewedLatest = undefined; update({ localDrafts: drafts, pendingEditors: Object.keys(drafts).length > 0, latest: undefined, message: Object.keys(drafts).length ? "未保存の編集項目を保持しています" : state.message });
    },
    persistLocalDrafts: async () => {
      if (disposed || busy || !state.snapshot || recovery || !host.persistDraft) { update({ message: "編集項目はこのセッション内に保持しています。下書きの永続退避は未確認です" }); return false; }
      const base = state.snapshot, savedActivity = activity, drafts = clone(state.localDrafts), local = new AbortController();
      busy = true; controller = local;
      try { await bounded(Promise.resolve().then(() => host.persistDraft!(clone(hostScope), clone(base.target), drafts, local.signal)), local.signal); if (disposed || local.signal.aborted || savedActivity !== activity || !equal(state.snapshot?.target, base.target)) { update({ message: "前の下書きを退避しました。新しい入力は編集セッション内に保持しています" }); return false; } update({ message: "下書きの退避を確認しました。文書へは適用していません" }); return true; }
      catch { local.abort(); update({ message: "下書きを退避できませんでした。編集項目はこのセッション内に保持しています" }); return false; }
      finally { busy = false; if (controller === local) controller = undefined; }
    },
    save: async options => {
      if (state.manualSaveRequired && options?.explicit !== true) return undefined;
      if (!state.dirty && !state.manualSaveRequired) return undefined;
      return execute({ kind: "document.save", document: state.draft!, title: state.draftTitle! });
    },
    readLatest: async () => {
      if (disposed || busy || recovery || state.composing || state.pendingEditors || !state.snapshot) return undefined;
      const base = state.snapshot, inputActivity = activity, read = ++readGeneration;
      busy = true; const local = new AbortController(); controller = local; reviewedLatest = undefined;
      update({ latest: undefined, originalDraft: state.originalDraft ?? draftBackup(), message: "最新データを確認中。入力は保持しています" });
      try {
        const latest = parseNotesDocumentSnapshot(await bounded(Promise.resolve().then(() => host.readDocument(clone(base.target), local.signal)), local.signal));
        if (disposed || local.signal.aborted || read !== readGeneration || inputActivity !== activity || state.composing || state.snapshot?.revision !== base.revision || !equal(latest.scope, hostScope) || !equal(latest.target, base.target)) return undefined;
        reviewedLatest = { snapshot: clone(latest), activity, baseRevision: base.revision }; update({ latest, message: "原文と最新データを確認して、手動で統合してください" }); return state.latest;
      } catch { update({ message: "最新データを確認できませんでした。入力は保持しています" }); return undefined; }
      finally { busy = false; if (controller === local) controller = undefined; }
    },
    acceptMergedDraft: async (latestRevision, value, title) => {
      const review = reviewedLatest;
      if (disposed || busy || recovery || state.composing || state.pendingEditors || !state.snapshot || !review || review.snapshot.revision !== latestRevision || review.activity !== activity || review.baseRevision !== state.snapshot.revision || !equal(review.snapshot.target, state.snapshot.target)) return false;
      const merged = document(clone(value)), mergedTitle = text(title), inputActivity = activity, read = ++readGeneration;
      busy = true; const local = new AbortController(); controller = local;
      try {
        const fresh = parseNotesDocumentSnapshot(await bounded(Promise.resolve().then(() => host.readDocument(clone(review.snapshot.target), local.signal)), local.signal));
        if (disposed || local.signal.aborted || read !== readGeneration || inputActivity !== activity || state.composing || reviewedLatest !== review || !equal(fresh, review.snapshot) || !fresh.capabilities.includes("document.save")) { reviewedLatest = undefined; update({ latest: undefined, message: "入力・権限・最新データが変わりました。原文を保持しています。再確認してください" }); return false; }
        const mergeSourceDraft = draftBackup(), originalDraft = state.originalDraft ?? mergeSourceDraft; reviewedLatest = undefined; generation++; activity++;
        update({ snapshot: fresh, draft: merged, draftTitle: mergedTitle, dirty: !equal(merged, fresh.document) || mergedTitle !== fresh.title, status: "ready", latest: undefined, originalDraft, mergeSourceDraft, manualSaveRequired: true, message: "統合案を準備しました。明示的に保存するまで反映しません" }); return true;
      } catch { update({ message: "統合案を準備できませんでした。原文を保持しています" }); return false; }
      finally { busy = false; if (controller === local) controller = undefined; }
    },
    execute,
    open: async value => {
      const nextTarget = target(value);
      const restoringCachedTarget = !state.snapshot && state.pendingEditors && equal(nextTarget, localDraftTarget);
      if (disposed || busy || recovery || state.composing || state.pendingEditors && !restoringCachedTarget || state.manualSaveRequired || ["conflict", "denied"].includes(state.status) && !restoringCachedTarget) return false;
      if (state.dirty) { try { await api.save(); } catch { return false; } if (state.dirty || recovery || state.composing || state.pendingEditors || state.status !== "ready") return false; }
      const inputActivity = activity, read = ++readGeneration;
      busy = true; const local = new AbortController(); controller = local; update({ status: "loading", message: "読み込み中" });
      try {
        const snapshot = parseNotesDocumentSnapshot(await bounded(Promise.resolve().then(() => host.readDocument(clone(nextTarget), local.signal)), local.signal));
        if (disposed || local.signal.aborted || read !== readGeneration || activity !== inputActivity || state.composing || state.pendingEditors && !restoringCachedTarget || state.dirty || recovery) { update({ status: state.snapshot ? "ready" : "empty", message: "入力を保持しました。移動を再実行してください" }); return false; }
        if (!equal(snapshot.scope, hostScope)) throw new Error("Notes actor/workspace read mismatch");
        if (!equal(snapshot.target, nextTarget)) throw new Error("Notes read scope mismatch");
        generation = 0; localDraftTarget = clone(snapshot.target); update({ snapshot, draft: clone(snapshot.document), draftTitle: snapshot.title, dirty: false, status: "ready", message: "" }); return true;
      } catch { update({ status: state.snapshot ? "ready" : "error", message: "開けませんでした。現在の入力は保持しています" }); return false; }
      finally { busy = false; if (controller === local) controller = undefined; }
    },
    cancel: () => { readGeneration++; controller?.abort(); },
    reconcile: async () => {
      if (disposed || busy || !recovery || state.status !== "unknown") throw new Error("No Notes operation to reconcile");
      busy = true; const request = clone(recovery.request), local = new AbortController(); controller = local; update({ status: "saving", message: "保存結果を照会中" });
      try { return settle(await bounded(Promise.resolve().then(() => host.lookupOperation(clone(request.target), request.operationId, local.signal)), local.signal), request); }
      catch { local.abort(); update({ status: "unknown", message: "保存結果を確認できませんでした。入力は保持しています" }); return { status: "unknown", target: request.target, operationId: request.operationId }; }
      finally { busy = false; if (controller === local) controller = undefined; }
    },
    getRecovery: () => recovery ? clone(recovery) : undefined,
    dispose: () => { disposed = true; readGeneration++; controller?.abort(); listeners.clear(); }
  };
  return api;
}
