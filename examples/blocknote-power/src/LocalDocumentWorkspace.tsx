import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createEditorDocument, type EditorDocument } from "@hello-ai-company/editor-core";
import { PowerDemoEditor } from "./PowerDemoEditor";
import { createBrowserDocumentStore, type DocumentStore, type StoredDocument } from "./documentStore";
import { sampleDocument } from "./sampleDocument";
import { LocalPersonalAiReview } from "./LocalPersonalAiReview";
import { type LocalPersonalAiHost, type HostProposal } from "./localPersonalAi";

export function LocalDocumentWorkspace({ onOpenPersonalContext, store: suppliedStore, host }: {
  onOpenPersonalContext: () => void; store?: DocumentStore; host?: LocalPersonalAiHost;
}) {
  const [store] = useState(() => suppliedStore ?? createBrowserDocumentStore());
  const [record, setRecord] = useState<StoredDocument>();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [status, setStatus] = useState("Loading saved documents…");
  const [failure, setFailure] = useState<string>();
  const failureRef = useRef<string | undefined>(undefined);
  failureRef.current = failure;
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = useRef<StoredDocument | undefined>(undefined);
  const content = useRef<EditorDocument | undefined>(undefined);
  const edited = useRef(0);
  const persisted = useRef(0);
  const pending = useRef<Promise<boolean> | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialization = useRef<Promise<StoredDocument> | undefined>(undefined);
  const [hostBusy, setHostBusy] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigationLatch = useRef(false);
  const hostLatch = useRef(false);
  const [hostRevision, setHostRevision] = useState<StoredDocument>();
  const alive = useRef(false);
  const setCurrent = useCallback((next: StoredDocument) => {
    current.current = next; content.current = next.document;
    edited.current = 0; persisted.current = 0;
    setRecord(next); setDirty(false); setFailure(undefined);
    setHostRevision(next);
    setStatus(`Saved locally · v${next.revision}`);
    const url = new URL(location.href); url.searchParams.set("document", next.id); history.replaceState(null, "", url);
  }, []);
  const refresh = useCallback(async () => { const rows = await store.list(); if (alive.current) setDocuments(rows); }, [store]);
  useEffect(() => {
    alive.current = true;
    initialization.current ??= (async () => {
      const rows = await store.list();
      const requested = new URL(location.href).searchParams.get("document");
      if (requested) return store.load(requested);
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? await store.create("Workspace primitives", sampleDocument);
    })();
    initialization.current.then(next => { if (alive.current) { setCurrent(next); void refresh(); } })
      .catch(error => { if (alive.current) { setFailure(error.message); setStatus("Saved documents could not open. Existing data was kept."); } });
    return () => { alive.current = false; clearTimeout(timer.current); };
  }, [store, setCurrent, refresh]);

  const save = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (failureRef.current === "save_outcome_unknown" || failureRef.current === "document_conflict") return false;
    if (pending.current) { await pending.current; return false; }
    const base = current.current, doc = content.current, generation = edited.current;
    if (!base || !doc || generation === persisted.current) return true;
    if (alive.current) { setSaving(true); setStatus("Saving locally…"); }
    const operation = (async () => {
      try {
        const next = await store.save(base.id, base.revision, doc);
        current.current = next; persisted.current = generation;
        if (alive.current) {
          setFailure(undefined); setDirty(edited.current !== generation);
          setHostRevision(next);
          setStatus(edited.current === generation ? `Saved locally · v${next.revision}` : "Unsaved changes");
          setDocuments(rows => [...rows.filter(row => row.id !== next.id), next]);
        }
        return true;
      } catch (error) {
        if (alive.current) {
          const message = error instanceof Error ? error.message : "local_save_failed";
          setFailure(message); setDirty(true);
          setStatus(message === "document_conflict" ? "Another tab saved a newer version. Your edits are kept here." : "Save failed. Your edits are kept here.");
        }
        return false;
      } finally { pending.current = undefined; if (alive.current) setSaving(false); }
    })();
    pending.current = operation;
    return operation;
  }, [store]);
  // If typing continued during a save, persist that newer generation next.
  useEffect(() => {
    if (dirty && !saving && !failure) timer.current = setTimeout(() => { void save(); }, 300);
    return () => clearTimeout(timer.current);
  }, [dirty, saving, failure, save, status]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (edited.current !== persisted.current || failureRef.current === "save_outcome_unknown") { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const changed = useCallback((document: EditorDocument) => {
    if (JSON.stringify(content.current) === JSON.stringify(document)) return;
    content.current = document; edited.current++;
    setDirty(true); setStatus("Unsaved changes");
    // Repeated setDirty(true) does not rerender: reset on EACH real edit, rather
    // than allowing the first edit's timer to save during continuous typing.
    clearTimeout(timer.current);
    if (!failureRef.current) timer.current = setTimeout(() => { void save(); }, 300);
  }, [save]);
  const switchDocument = async (id: string) => {
    if (dirty || saving || navigationLatch.current) return;
    navigationLatch.current = true; setNavigating(true);
    try { setCurrent(await store.load(id)); } catch (error) { setFailure((error as Error).message); setStatus("Could not open this document. Your current document is kept."); }
    finally { navigationLatch.current = false; setNavigating(false); }
  };
  const create = async (copy = false) => {
    if (pending.current || navigationLatch.current) return;
    navigationLatch.current = true; setNavigating(true);
    try {
      if (!copy && !(await save())) return;
      const next = await store.create(copy ? `${current.current?.title ?? "Document"} — recovered copy` : "Untitled document", copy ? content.current! : createEditorDocument([{ id: crypto.randomUUID(), type: "paragraph", content: [] }]));
      setCurrent(next); setDocuments(rows => [...rows.filter(row => row.id !== next.id), next]);
    } catch (error) { setFailure((error as Error).message); setStatus("Could not create a document. Your edits are kept."); }
    finally { navigationLatch.current = false; setNavigating(false); }
  };
  const exportCopy = () => {
    if (!content.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...current.current, document: content.current }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "open-editor-document-backup.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const reconcileSave = async () => {
    const base = current.current, desired = content.current;
    if (!base || !desired || hostLatch.current || pending.current) return;
    hostLatch.current = true; setHostBusy(true);
    try {
      const saved = await store.load(base.id);
      if (JSON.stringify(saved.document) === JSON.stringify(desired)) setCurrent(saved);
      else { setFailure("document_conflict"); setStatus("Saved content differs. Your edits are kept here; choose a recovered copy or the saved version."); }
    } catch { setStatus("Saved version could not be confirmed. Your edits are kept here."); }
    finally { hostLatch.current = false; setHostBusy(false); }
  };
  const replaceWithSaved = async () => {
    if (!current.current || pending.current || navigationLatch.current) return;
    navigationLatch.current = true; setNavigating(true);
    try { setCurrent(await store.load(current.current.id)); }
    catch { setStatus("Saved version could not open. Your edits are kept."); }
    finally { navigationLatch.current = false; setNavigating(false); }
  };
  const switchHost = () => {
    if (dirty || saving || failure || navigating) return;
    const url = new URL(location.href); url.searchParams.delete("document");
    if (host) url.searchParams.delete("host"); else url.searchParams.set("host", "personal-ai-local");
    location.assign(url);
  };
  const hostCommit = async (proposal?: HostProposal, ids: string[] = []) => {
    if (!host || hostLatch.current || pending.current || edited.current !== persisted.current || !current.current) throw new Error("human_edit_conflict");
    const base = current.current;
    if (proposal && proposal.baseRevision !== base.revision) throw new Error("document_conflict");
    hostLatch.current = true; setHostBusy(true);
    try {
      const next = proposal ? await host.accept(base, proposal, ids) : await host.undo(base);
      setCurrent(next); setDocuments(rows => [...rows.filter(row => row.id !== next.id), next]);
    } catch (error) {
      if ((error as Error).message === "save_outcome_unknown") {
        setFailure("save_outcome_unknown"); setDirty(true);
        setStatus("The save may have completed. Check the saved version before another write.");
      }
      throw error;
    } finally { hostLatch.current = false; setHostBusy(false); }
  };
  if (!record) return <main className="demo-feedback" role={failure ? "alert" : "status"}><p>{status}</p>{failure ? <button className="chip" onClick={() => location.reload()}>Retry opening</button> : null}</main>;
  return <div className="demo-shell local-document-workspace">
    <section className="local-document-controls" aria-label="Local documents" inert={hostBusy || navigating}>
      <label>Document <select aria-label="Saved document" value={record.id} disabled={dirty || saving} onChange={event => { void switchDocument(event.target.value); }}>{documents.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
      <button className="chip" onClick={() => { void create(); }} disabled={saving || Boolean(failure)}>New document</button>
      <button className="chip" onClick={() => { void save(); }} disabled={saving || !dirty || failure === "document_conflict" || failure === "save_outcome_unknown"}>Save <kbd>⌘S</kbd></button>
      <button className="chip" onClick={exportCopy}>Export backup</button>
      {location.hostname === "127.0.0.1" ? <button className="chip" disabled={dirty || saving || Boolean(failure)} onClick={switchHost}>{host ? "Return to browser documents" : "Personal-AI local test"}</button> : null}
      <p role="status" data-testid="document-save-status">{status}</p>
      <small>{host ? "Synthetic documents are saved in the local SQLite host. This is a separate test account." : "This browser only. Clear site data removes local documents."} External pages and database rows remain host-owned.</small>
      {failure ? <div role="alert"><button className="chip" onClick={() => { void create(true); }} disabled={saving}>Save edits as a new copy</button>{failure === "save_outcome_unknown" ? <button className="chip" onClick={() => { void reconcileSave(); }}>Check saved version</button> : failure === "document_conflict" ? <button className="chip" onClick={() => { void replaceWithSaved(); }}>Replace these edits with saved version</button> : <button className="chip" onClick={() => { void save(); }} disabled={saving}>Retry save</button>}</div> : null}
    </section>
    {host && hostRevision ? <LocalPersonalAiReview host={host} document={hostRevision} dirty={dirty} busy={saving || hostBusy} onAccept={hostCommit} onUndo={() => hostCommit()} /> : null}
    <SaveShortcut onSave={save} />
    <DocumentMountBoundary key={record.id + ":" + record.revision} onExport={exportCopy}><div inert={hostBusy || navigating}><PowerDemoEditor initialDocument={record.document} documentTitle={record.title} onDocumentChange={changed} saveStatus={status} readOnly={hostBusy || navigating} onOpenPersonalContext={onOpenPersonalContext} /></div></DocumentMountBoundary>
  </div>;
}

class DocumentMountBoundary extends Component<{ children: ReactNode; onExport: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section role="alert" className="demo-feedback"><p>Saved content could not open with this editor. Your saved data is kept.</p><button className="chip" onClick={this.props.onExport}>Export saved backup</button></section> : this.props.children;
  }
}

function SaveShortcut({ onSave }: { onSave: () => Promise<boolean> }) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void onSave(); } };
    document.addEventListener("keydown", handle); return () => document.removeEventListener("keydown", handle);
  }, [onSave]);
  return null;
}
