import { createNotesIndexedDBLayoutStorage, notesLayoutStorageKey } from "@hello-ai-company/editor-blocknote/notes";
export async function verifyLocalLayoutStorage() {
  const scope = { actorId: "synthetic-qa-only", workspaceId: "layout-cas" }, databaseName = "open-editor.synthetic-layout-qa." + crypto.randomUUID();
  const key = notesLayoutStorageKey(scope), legacy = "synthetic-legacy-key", foreign = notesLayoutStorageKey({ ...scope, actorId: "different-synthetic-actor" });
  const a = createNotesIndexedDBLayoutStorage({ scope, databaseName, legacyKeys: [legacy] }), b = createNotesIndexedDBLayoutStorage({ scope, databaseName });
  let db: IDBDatabase | undefined;
  const assert = (condition: boolean, text: string) => { if (!condition) throw new Error(text); };
  const fails = async (work: () => Promise<unknown>) => { try { await work(); return false; } catch { return true; } };
  try {
    assert(await a.read(key) === null, "Initial scoped key exists");
    await a.write(key, "original", null);
    assert(await b.read(key) === "original", "Separate connection did not observe canonical bytes");
    const outcomes = await Promise.allSettled([a.write(key, "writer-a", "original"), b.write(key, "writer-b", "original")]);
    assert(outcomes.filter(item => item.status === "fulfilled").length === 1, "Concurrent raw-byte CAS admitted two writers");
    assert(await fails(() => a.read(foreign)) && await fails(() => a.write(foreign, "forbidden", null)), "Foreign scope admitted");
    db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const raw = async (write?: { key: string; value: unknown }, readKey = key): Promise<unknown> => new Promise((resolve, reject) => { const tx = db!.transaction("layout", write ? "readwrite" : "readonly"), store = tx.objectStore("layout"); let value: unknown; if (write) store.put(write.value, write.key); else { const request = store.get(readKey); request.onsuccess = () => value = request.result; } tx.oncomplete = () => resolve(value); tx.onerror = tx.onabort = () => reject(tx.error); });
    const legacyBytes = ' {"old":["synthetic"],"future":true} ';
    await raw({ key: legacy, value: legacyBytes });
    assert(await a.read(legacy) === legacyBytes && await fails(() => a.write(legacy, "overwrite", legacyBytes)), "Legacy read-only byte retention failed");
    assert(await raw(undefined, legacy) === legacyBytes, "Legacy source bytes changed");
    await raw({ key, value: 123 });
    assert(await fails(() => a.read(key)) && await fails(() => a.write(key, "overwrite", null)), "Malformed original was overwritten");
    assert(await raw() === 123, "Malformed source not retained");
    a.close(); assert(await fails(() => a.read(key)), "Closed storage remained accessible");
    return { twoConnectionCAS: true, scopedReadWrite: true, legacyReadOnlyBytes: true, malformedRetained: true, closeFence: true, localOnly: true };
  } finally { a.close(); b.close(); db?.close(); await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(databaseName); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("Own synthetic QA database blocked")); }); }
}
