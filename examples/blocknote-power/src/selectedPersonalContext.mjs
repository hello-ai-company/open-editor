// Local review state only. A file is never an authorization capability.
export const syntheticDocumentID = "00000000-0000-4000-8000-000000000001";
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const keys = (x, allowed) => object(x) && Object.keys(x).every((k) => allowed.includes(k));
const text = (x, max) => typeof x === "string" && x.length <= max;
const version = (x) => Number.isInteger(x) && x > 0 && x <= Number.MAX_SAFE_INTEGER;
export function parseContext(raw) {
  if (typeof raw === "string" && new TextEncoder().encode(raw).length > 64000) throw new Error("context_too_large");
  const x = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!keys(x, ["schema_version", "document_id", "document_version", "document_title", "created_at", "usage", "memories"]) || x.schema_version !== 1 || !uuid.test(x.document_id) || !version(x.document_version) || !text(x.document_title, 1000) || !timestamp(x.created_at) || x.usage !== "one_document_snapshot_requires_revalidation" || !Array.isArray(x.memories) || !x.memories.length || x.memories.length > 12) throw new Error("invalid_context");
  const seen = new Set();
  for (const m of x.memories) {
    if (!keys(m, ["memory_id", "version", "kind", "assertion", "content", "rationale", "source_turn_id", "source_date", "recording_source"]) || !uuid.test(m.memory_id) || seen.has(m.memory_id) || !version(m.version) || !uuid.test(m.source_turn_id) || !timestamp(m.source_date) || !["user_statement", "ai_inference"].includes(m.assertion) || !text(m.kind, 100) || !text(m.content, 1500) || !m.content.trim() || !text(m.rationale, 1500)) throw new Error("invalid_memory");
    seen.add(m.memory_id);
    const r = m.recording_source;
    if (r !== null && r !== undefined && (!keys(r, ["session_id", "segment_id", "selection_id", "revision", "recorded_at", "start_ms", "end_ms", "speaker", "text_kind"]) || ![r.session_id, r.segment_id, r.selection_id].every((id) => uuid.test(id)) || !version(r.revision) || r.speaker !== "self" || !["transcript", "user_correction", "summary"].includes(r.text_kind) || !timestamp(r.recorded_at) || !Number.isInteger(r.start_ms) || !Number.isInteger(r.end_ms) || r.start_ms < 0 || r.end_ms <= r.start_ms || r.end_ms > 86400000)) throw new Error("invalid_recording_source");
    if (r?.text_kind === "summary" && m.assertion !== "ai_inference") throw new Error("invalid_recording_inference");
  }
  return structuredClone(x);
}
export function newState() { return { schema_version: 1, document_id: syntheticDocumentID, version: 1, text: "合成データ：次のプロジェクトの計画を考える。", proposal: null, undo: null }; }
export function edit(state, value) {
  if (!text(value, 12000)) throw new Error("document_too_large");
  return { ...state, text: value, version: state.version + 1 };
}
const timestamp = (value) => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const sameSources = (a, b) => JSON.stringify(a.memories) === JSON.stringify(b.memories);
async function verify(state, context, verifier) {
  const selected = parseContext(context);
  if (typeof verifier !== "function") throw new Error("host_verifier_not_configured");
  if (selected.document_id !== state.document_id) throw new Error("wrong_document");
  if (selected.document_version !== state.version) throw new Error("document_version_changed");
  const fresh = parseContext(await verifier({ document_id: state.document_id, document_version: state.version, memories: selected.memories.map(({ memory_id, version }) => ({ memory_id, version })) }));
  if (fresh.document_id !== state.document_id || fresh.document_version !== state.version || !sameSources(selected, fresh)) throw new Error("source_or_document_changed");
  return fresh;
}
function proposedText(base, context) {
  return base + "\n\n選択した文脈からの提案（合成データ・未確定）\n" + context.memories.map((m) => `${m.assertion === "ai_inference" ? "推測・提案" : "本人の明言"}: ${m.content}\n出典 ${m.source_turn_id} / 記憶 ${m.memory_id} v${m.version}`).join("\n\n");
}
export async function propose(state, context, verifier) {
  const fresh = await verify(state, context, verifier);
  const value = proposedText(state.text, fresh);
  if (value.length > 12000) throw new Error("proposal_too_large");
  return { ...state, proposal: { base: state.text, base_version: state.version, text: value, context: fresh } };
}
export async function accept(state, verifier, selectedIds = state.proposal?.context.memories.map(m => m.memory_id)) {
  const p = state.proposal;
  if (!p || p.base !== state.text || p.base_version !== state.version) throw new Error("human_edit_conflict");
  const fresh = await verify(state, p.context, verifier);
  if (!Array.isArray(selectedIds) || !selectedIds.length || new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !fresh.memories.some(m => m.memory_id === id))) throw new Error("invalid_selected_changes");
  const context = { ...fresh, memories: fresh.memories.filter(m => selectedIds.includes(m.memory_id)) };
  const value = proposedText(p.base, context);
  return { ...state, text: value, version: state.version + 1, proposal: null, undo: { before: p.base, after: value, after_version: state.version + 1, context } };
}
export function reject(state) { return { ...state, proposal: null }; }
export function undo(state) {
  if (!state.undo || state.undo.after !== state.text || state.undo.after_version !== state.version) throw new Error("human_edit_conflict");
  return { ...state, text: state.undo.before, version: state.version + 1, undo: null, proposal: null };
}
export function restore(raw) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > 160000) throw new Error("invalid_saved_state");
  const s = JSON.parse(raw);
  if (!keys(s, ["schema_version", "document_id", "version", "text", "proposal", "undo"]) || s.schema_version !== 1 || s.document_id !== syntheticDocumentID || !version(s.version) || !text(s.text, 12000)) throw new Error("invalid_saved_state");
  if (s.proposal !== null) {
    const p = s.proposal;
    if (!keys(p, ["base", "base_version", "text", "context"]) || !text(p.base, 12000) || !version(p.base_version) || p.base_version > s.version || !text(p.text, 12000)) throw new Error("invalid_saved_proposal");
    const c = parseContext(p.context);
    if (c.document_id !== s.document_id || c.document_version !== p.base_version || p.text !== proposedText(p.base, c)) throw new Error("invalid_saved_proposal");
  }
  if (s.undo !== null) {
    const u = s.undo;
    if (!keys(u, ["before", "after", "after_version", "context"]) || !text(u.before, 12000) || !text(u.after, 12000) || !version(u.after_version) || u.after_version > s.version) throw new Error("invalid_saved_undo");
    const c = parseContext(u.context);
    if (c.document_id !== s.document_id || c.document_version !== u.after_version - 1 || u.after !== proposedText(u.before, c)) throw new Error("invalid_saved_undo");
  }
  for (const context of [s.proposal?.context, s.undo?.context].filter(Boolean)) {
    const known = syntheticContext(context.document_version);
    if (context.memories.some(m => !known.memories.some(k => JSON.stringify(k) === JSON.stringify(m)))) throw new Error("synthetic_storage_only");
  }
  return s;
}
export function syntheticContext(documentVersion = 1) {
  return { schema_version: 1, document_id: syntheticDocumentID, document_version: documentVersion, document_title: "合成データの計画", created_at: "2026-10-04T12:00:00Z", usage: "one_document_snapshot_requires_revalidation", memories: [{ memory_id: "00000000-0000-4000-8000-000000000002", version: 1, kind: "preference", assertion: "user_statement", content: "合成データ：集中する時間を午前に確保したい。", rationale: "テスト用の本人確認済み発言", source_turn_id: "00000000-0000-4000-8000-000000000003", source_date: "2026-10-04T10:00:00Z", recording_source: null }, {
    memory_id: "00000000-0000-4000-8000-000000000004", version: 1, kind: "suggestion", assertion: "ai_inference",
    content: "合成データ：計画は小さな実験から始めるとよいかもしれない。", rationale: "合成の推測例。本人の事実として扱わない。",
    source_turn_id: "00000000-0000-4000-8000-000000000005", source_date: "2026-10-04T11:00:00Z", recording_source: null
  }] };
}
export async function syntheticVerifier(request) {
  const c = syntheticContext(request.document_version);
  if (request.document_id !== c.document_id || !request.memories.length || request.memories.length > c.memories.length || new Set(request.memories.map(m => m.memory_id)).size !== request.memories.length) throw new Error("synthetic_sources_only");
  const memories = request.memories.map(selected => {
    const memory = c.memories.find(m => m.memory_id === selected.memory_id && m.version === selected.version);
    if (!memory) throw new Error("synthetic_sources_only");
    return memory;
  });
  return { ...c, memories };
}
