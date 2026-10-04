import { isEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";

export type DocumentScope = { actorId: string; workspaceId: string };
export type StoredDocument = DocumentScope & {
  schemaVersion: 1; id: string; title: string; revision: number;
  updatedAt: string; document: EditorDocument;
};
export interface DocumentStore {
  list(): Promise<StoredDocument[]>;
  load(id: string): Promise<StoredDocument>;
  create(title: string, document: EditorDocument): Promise<StoredDocument>;
  save(id: string, expectedRevision: number, document: EditorDocument): Promise<StoredDocument>;
}
export const browserScope: DocumentScope = { actorId: "local-browser", workspaceId: "local-documents" };
export const LOCAL_DOCUMENT_DB = "open-editor.documents.v1";
const LIMIT = 4 * 1024 * 1024;
export function validateStoredDocument(value: unknown, scope: DocumentScope): StoredDocument {
  const r = value as StoredDocument;
  if (!r || r.schemaVersion !== 1 || r.actorId !== scope.actorId || r.workspaceId !== scope.workspaceId ||
    typeof r.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id) || typeof r.title !== "string" || r.title.length > 500 ||
    !Number.isSafeInteger(r.revision) || r.revision < 1 || !Number.isFinite(Date.parse(r.updatedAt)) ||
    !isEditorDocument(r.document) || JSON.stringify(r).length > LIMIT) throw new Error("invalid_saved_document");
  const ids = new Set<string>();
  const walk = (blocks: EditorDocument["blocks"]) => {
    for (const b of blocks) { if (ids.has(b.id)) throw new Error("duplicate_block_id"); ids.add(b.id); if (b.children) walk(b.children); }
  };
  walk(r.document.blocks);
  return structuredClone(r);
}

/** Each read/check/write runs in one IndexedDB transaction, including across tabs. */
export function createBrowserDocumentStore(scope: DocumentScope = browserScope): DocumentStore {
  let connection: Promise<IDBDatabase> | undefined;
  const open = () => connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DOCUMENT_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents");
    request.onerror = () => { connection = undefined; reject(new Error("local_storage_unavailable")); };
    request.onblocked = () => { connection = undefined; reject(new Error("local_storage_blocked")); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined; };
      resolve(request.result);
    };
  });
  const prefix = JSON.stringify([scope.actorId, scope.workspaceId]) + ":";
  const transact = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (result: T) => void, abort: (error: unknown) => void) => void): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction("documents", mode, mode === "readwrite" ? { durability: "strict" } : undefined);
      let result: T;
      let error: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(error ?? new Error("local_save_failed"));
      tx.onabort = () => reject(error ?? new Error("local_save_failed"));
      const abort = (e: unknown) => { error = e; tx.abort(); };
      try { action(tx.objectStore("documents"), value => { result = value; }, abort); }
      catch (e) { error = e; tx.abort(); }
      // Event handlers must also abort on a validation failure.
      tx.addEventListener("error", () => { if (!error) error = new Error("local_save_failed"); });
    });
  };
  return {
    list: () => transact("readonly", (s, done, abort) => {
      const req = s.getAll(IDBKeyRange.bound(prefix, prefix + "\uffff"));
      req.onsuccess = () => { try { done(req.result.map(v => validateStoredDocument(v, scope))); } catch (error) { abort(error); } };
    }),
    load: id => transact("readonly", (s, done, abort) => {
      const req = s.get(prefix + id);
      req.onsuccess = () => { try { done(validateStoredDocument(req.result, scope)); } catch (error) { abort(error); } };
    }),
    create: (title, document) => transact("readwrite", (s, done) => {
      const record = validateStoredDocument({ ...scope, schemaVersion: 1, id: crypto.randomUUID(), title, revision: 1, updatedAt: new Date().toISOString(), document }, scope);
      s.add(record, prefix + record.id); done(record);
    }),
    save: (id, expectedRevision, document) => transact<StoredDocument>("readwrite", (s, done, abort) => {
      const req = s.get(prefix + id);
      req.onsuccess = () => {
        try {
          const old = validateStoredDocument(req.result, scope);
          if (old.revision !== expectedRevision) {
            // Preserve the losing tab's content; the caller must resolve this explicitly.
            abort(new Error("document_conflict")); return;
          }
          const next = validateStoredDocument({ ...old, document, revision: old.revision + 1, updatedAt: new Date().toISOString() }, scope);
          s.put(next, prefix + id); done(next);
        } catch (error) { abort(error); }
      };
    })
  };
}
