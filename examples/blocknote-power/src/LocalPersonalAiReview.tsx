import { useEffect, useRef, useState } from "react";
import type { StoredDocument } from "./documentStore";
import type { HostMemory, HostProposal, LocalPersonalAiHost } from "./localPersonalAi";

export function LocalPersonalAiReview({ host, document, dirty, busy, onAccept, onUndo }: {
  host: LocalPersonalAiHost; document: StoredDocument; dirty: boolean; busy: boolean;
  onAccept: (proposal: HostProposal, ids: string[]) => Promise<void>; onUndo: () => Promise<void>;
}) {
  const [memories, setMemories] = useState<HostMemory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [proposal, setProposal] = useState<HostProposal>();
  const [decision, setDecision] = useState<"accepted" | "rejected" | "undone">();
  const operationLatch = useRef(false);
  const [status, setStatus] = useState("Select approved synthetic memories. No model is called.");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setProposal(undefined); setSelected([]); setDecision(undefined);
    host.memories().then(rows => { if (active) setMemories(rows); }).catch(() => { if (active) setStatus("Local API unavailable. Nothing was applied."); });
    return () => { active = false; };
  }, [host, document.id]);
  const prepare = async () => {
    if (operationLatch.current || loading || busy || dirty || !selected.length) return;
    operationLatch.current = true;
    setLoading(true);
    try {
      const refs = selected.map(id => { const m = memories.find(row => row.id === id)!; return { memory_id: id, version: m.version }; });
      await host.verify(document, refs);
      const next = await host.propose(document, refs);
      setProposal(next); setDecision(undefined); setStatus("Mock proposal prepared after local API permission and version checks. Choose what to apply.");
    } catch (error) { setProposal(undefined); setStatus(`Nothing applied: ${(error as Error).message}`); }
    finally { operationLatch.current = false; setLoading(false); }
  };
  const run = async (operation: () => Promise<void>, result: "accepted" | "undone") => {
    if (operationLatch.current || loading || busy || dirty) return;
    operationLatch.current = true;
    setLoading(true);
    try { await operation(); setDecision(result); setStatus("Local API transaction completed and saved."); }
    catch (error) { setStatus(`Nothing applied here: ${(error as Error).message}. Reload approved memories before preparing a new proposal.`); }
    finally { operationLatch.current = false; setLoading(false); }
  };
  return <section className="local-ai-review" aria-label="Personal-AI local review">
    <h2>Personal-AI · local synthetic connection</h2>
    <p>Real local API and SQLite permission checks; mock proposal generation. No real account or AI model.</p>
    <button className="chip" disabled={loading || busy} onClick={() => { setProposal(undefined); setSelected([]); void host.memories().then(setMemories).catch(() => setStatus("Local API unavailable.")); }}>Reload approved memories</button>
    {memories.map(memory => <label key={memory.id}><input type="checkbox" checked={selected.includes(memory.id)} disabled={loading || busy} onChange={event => { setProposal(undefined); setSelected(ids => event.target.checked ? [...ids, memory.id] : ids.filter(id => id !== memory.id)); }} />{memory.assertion === "user_statement" ? "本人発言" : "推測・提案"}: {memory.content} <small>v{memory.version} · {memory.id}</small></label>)}
    <button className="chip" disabled={dirty || loading || busy || !selected.length} onClick={() => { void prepare(); }}>Prepare local proposal</button>
    {proposal ? <div>
      {proposal.context.memories.map(memory => <label key={memory.memory_id}><input type="checkbox" checked={selected.includes(memory.memory_id)} disabled={loading || busy || Boolean(decision)} onChange={event => setSelected(ids => event.target.checked ? [...ids, memory.memory_id] : ids.filter(id => id !== memory.memory_id))} /><strong>{memory.assertion === "user_statement" ? "本人発言" : "推測・提案"}</strong> {memory.content}<small>{memory.rationale} · source {memory.source_turn_id} · {memory.source_date}</small></label>)}
      <button className="chip" disabled={Boolean(decision) || dirty || loading || busy || !selected.length || proposal.baseRevision !== document.revision} onClick={() => { void run(() => onAccept(proposal, selected), "accepted"); }}>{decision === "accepted" ? "Accepted locally" : decision === "undone" ? "Undone locally" : "Accept selected local changes"}</button>
      <button className="chip" disabled={loading || busy || Boolean(decision)} onClick={() => { setDecision("rejected"); setStatus("Rejected. Your document was kept."); }}>{decision === "rejected" ? "Not applied" : "Reject local proposal"}</button>
    </div> : null}
    <button className="chip" disabled={dirty || loading || busy || !(document as StoredDocument & { undoAvailable?: boolean }).undoAvailable} onClick={() => { void run(onUndo, "undone"); }}>Undo local AI change</button>
    <p role="status">{dirty ? "Save your human edits before review. Older proposals cannot be applied." : status}</p>
  </section>;
}
