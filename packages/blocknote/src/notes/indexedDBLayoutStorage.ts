import { notesLayoutStorageKey, type NotesLayoutScope, type NotesLayoutStorage } from "./layoutState.js";

/** Local-only raw-byte CAS across tabs. Explicit legacy keys are read-only.
 * This adapter never grants authentication, remote durability or mutation rights. */
export function createNotesIndexedDBLayoutStorage(options: {
  scope: NotesLayoutScope; databaseName?: string; indexedDB?: IDBFactory; legacyKeys?: readonly string[];
}): NotesLayoutStorage & { close(): void } {
  const ownKey = notesLayoutStorageKey(options.scope), legacy = new Set(options.legacyKeys ?? []);
  const databaseName = options.databaseName ?? "open-editor.notes-layout.v1";
  if (!databaseName || databaseName.length > 256 || legacy.size > 20 || [...legacy].some(key => !key || key.length > 4096)) throw new Error("Invalid local layout storage configuration");
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) throw new Error("IndexedDB unavailable; existing layout is retained");
  let closed = false;
  let connection: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("layout")) request.result.createObjectStore("layout"); };
    request.onerror = () => reject(new Error("Local layout storage could not open"));
    request.onblocked = () => { closed = true; reject(new Error("Local layout storage upgrade is blocked")); };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { closed = true; db.close(); };
      if (closed) { db.close(); reject(new Error("Local layout storage closed")); } else resolve(db);
    };
  });
  async function run(key: string, write?: { value: string; expected: string | null }): Promise<string | null> {
    if (closed || (write ? key !== ownKey : key !== ownKey && !legacy.has(key))) throw new Error("Local layout storage scope mismatch or closed");
    if (write && (typeof write.value !== "string" || write.value.length > 4_000_000 || (write.expected !== null && typeof write.expected !== "string"))) throw new Error("Local layout storage budget exceeded");
    const db = await open();
    if (closed) throw new Error("Local layout storage closed");
    return new Promise((resolve, reject) => {
      const tx = db.transaction("layout", write ? "readwrite" : "readonly"), store = tx.objectStore("layout"), read = store.get(key);
      let value: string | null = null, failure: Error | undefined;
      read.onsuccess = () => {
        const raw: unknown = read.result;
        if (raw !== undefined && typeof raw !== "string") { failure = new Error("Unsupported local layout record; original retained"); tx.abort(); return; }
        value = raw === undefined ? null : raw as string;
        if (write) {
          if (value !== write.expected) { failure = new Error("Local layout changed concurrently; original retained"); tx.abort(); return; }
          store.put(write.value, key);
        }
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = tx.onabort = () => reject(failure ?? new Error("Local layout transaction did not complete"));
    });
  }
  return { read: key => run(key), write: async (key, value, expectedOriginal) => { await run(key, { value, expected: expectedOriginal }); }, close() { closed = true; void connection?.then(db => db.close(), () => undefined); } };
}
