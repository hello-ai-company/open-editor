import assert from "node:assert/strict";
import { test } from "node:test";
import { accept, edit, newState, parseContext, propose, reject, restore, syntheticContext, syntheticVerifier, undo } from "../src/selectedPersonalContext.mjs";

test("files are bounded untrusted snapshots: missing verifier fails closed", async () => {
  const c = parseContext(JSON.stringify(syntheticContext()));
  await assert.rejects(propose(newState(), c), /host_verifier_not_configured/);
  assert.throws(() => parseContext({ ...c, access_token: "SYNTHETIC" }), /invalid_context/);
  assert.throws(() => parseContext({ ...c, memories: [...c.memories, ...c.memories] }), /invalid_memory/);
  assert.throws(() => parseContext({ ...c, memories: Array(13).fill(c.memories[0]) }), /invalid_context/);
});
test("acceptance revalidates sources; removed approval and errors leave original intact", async () => {
  const initial = newState();
  const p = await propose(initial, syntheticContext(), syntheticVerifier);
  await assert.rejects(accept(p), /host_verifier_not_configured/);
  await assert.rejects(accept(p, async () => { throw new Error("approval_removed"); }), /approval_removed/);
  await assert.rejects(accept(p, async () => { const c = syntheticContext(); c.memories[0].version++; return c; }), /source_or_document_changed/);
  await assert.rejects(accept(p, async () => { const c = syntheticContext(); c.memories[0].content = "変更後の合成文"; return c; }), /source_or_document_changed/);
  assert.equal(p.text, initial.text);
});
test("human edits block accept and undo, reject keeps human text", async () => {
  const p = await propose(newState(), syntheticContext(), syntheticVerifier);
  const changed = edit(p, "合成データ：人が追記した本文");
  await assert.rejects(accept(changed, syntheticVerifier), /human_edit_conflict/);
  assert.equal(reject(changed).text, changed.text);
  const applied = await accept(p, syntheticVerifier);
  assert.equal(undo(applied).text, newState().text);
  assert.throws(() => undo(edit(applied, applied.text + "\n人による追記")), /human_edit_conflict/);
});
test("saved proposals retain source citations across reload, require verifier again", async () => {
  const p = await propose(newState(), syntheticContext(), syntheticVerifier);
  const restored = restore(JSON.stringify(p));
  assert.deepEqual(restored, p);
  await assert.rejects(accept(restored), /host_verifier_not_configured/);
  const applied = await accept(restored, syntheticVerifier);
  assert.match(applied.text, /出典 00000000-0000-4000-8000-000000000003/);
  assert.equal(undo(restore(JSON.stringify(applied))).text, p.text);
  assert.throws(() => restore(JSON.stringify({ ...applied, undo: { ...applied.undo, before: "改ざんした合成本文" } })), /invalid_saved_undo/);
  assert.throws(() => restore(JSON.stringify({ ...p, document_id: "other" })), /invalid_saved_state/);
  assert.throws(() => restore(JSON.stringify({ ...p, proposal: { ...p.proposal, text: "改ざんした合成提案" } })), /invalid_saved_proposal/);
});
test("target document and version conflicts fail; inference stays a labeled proposal", async () => {
  const initial = newState();
  const c = syntheticContext(); c.memories[0].assertion = "ai_inference";
  const verifier = async (r) => ({ ...c, document_version: r.document_version });
  const p = await propose(initial, c, verifier);
  assert.match(p.proposal.text, /推測・提案:/);
  await assert.rejects(propose(initial, { ...c, document_id: "00000000-0000-4000-8000-000000000009" }, verifier), /wrong_document/);
  await assert.rejects(propose(initial, c, async () => ({ ...c, document_version: 99 })), /source_or_document_changed/);
});
test("unselected text and recording speaker impersonation are rejected", () => {
  const c = syntheticContext();
  c.memories[0].recording_source = { session_id: c.document_id, segment_id: c.document_id, selection_id: c.document_id, revision: 1, recorded_at: c.created_at, start_ms: 0, end_ms: 10000, speaker: "quoted", text_kind: "transcript" };
  assert.throws(() => parseContext(c), /invalid_recording_source/);
  c.memories[0].recording_source.speaker = "self";
  assert.equal(parseContext(c).memories[0].recording_source.speaker, "self");
  c.memories[0].recording_source.full_transcript = "合成の未選択本文";
  assert.throws(() => parseContext(c), /invalid_recording_source/);
});

test("explicit context selection and partial adoption never copy unselected memories", async () => {
  const c = syntheticContext();
  const single = { ...c, memories: [c.memories[0]] };
  const one = await propose(newState(), single, syntheticVerifier);
  assert.doesNotMatch(one.proposal.text, /小さな実験/);
  const all = await propose(newState(), c, syntheticVerifier);
  const applied = await accept(all, syntheticVerifier, [c.memories[1].memory_id]);
  assert.doesNotMatch(applied.text, /午前/);
  assert.match(applied.text, /推測・提案:.*小さな実験/);
  assert.equal(applied.undo.context.memories.length, 1);
  assert.equal(undo(restore(JSON.stringify(applied))).text, newState().text);
  await assert.rejects(accept(all, syntheticVerifier, []), /invalid_selected_changes/);
  await assert.rejects(accept(all, syntheticVerifier, [c.memories[0].memory_id, c.memories[0].memory_id]), /invalid_selected_changes/);
});

test("stale target snapshots, unapproved sources and offline verification fail closed", async () => {
  const original = newState();
  const changed = edit(original, "合成の後続編集");
  await assert.rejects(propose(changed, syntheticContext(), syntheticVerifier), /document_version_changed/);
  const p = await propose(original, syntheticContext(), syntheticVerifier);
  await assert.rejects(accept(p, async () => { throw new Error("source_deleted"); }), /source_deleted/);
  await assert.rejects(accept(p, async () => { throw new Error("offline"); }), /offline/);
  await assert.rejects(accept(p, async () => ({ ...syntheticContext(), memories: [] })), /invalid_context/);
  assert.equal(p.text, original.text);
});

test("saved state remains synthetic-only and source timestamps require an offset", async () => {
  const c = syntheticContext();
  assert.throws(() => parseContext({ ...c, created_at: "2026-10-04T12:00:00" }), /invalid_context/);
  c.memories[0].recording_source = { session_id: c.document_id, segment_id: c.document_id, selection_id: c.document_id, revision: 1, recorded_at: c.created_at, start_ms: 0, end_ms: 10000, speaker: "self", text_kind: "summary" };
  assert.throws(() => parseContext(c), /invalid_recording_inference/);
  const foreign = syntheticContext(); foreign.memories[0].content = "合成の外部スナップショット";
  const verifier = async () => foreign;
  const p = await propose(newState(), foreign, verifier);
  assert.throws(() => restore(JSON.stringify(p)), /synthetic_storage_only/);
});
