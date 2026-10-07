import { describe, expect, it } from "vitest";
import { createOrganizationRequest, organizationEqual, type OrganizationRequest } from "@hello-ai-company/editor-ai";
import { applySyntheticOrganization, createSyntheticOrganizationSeed, syntheticNoteOrganizationAgent, prepareCapabilityAwarePlan } from "../src/syntheticNoteOrganization";
function base() {
  const state = createSyntheticOrganizationSeed(), note = state.notes.note!;
  note.autoOrganize = true;
  const s = { ...note, hierarchyRevision: `h${state.hierarchy}`, root: { scope: "synthetic", sharing: "private", editable: true }, pages: Object.values(state.notes).map(n => ({ id: n.documentId, parentId: n.parentId, title: n.title, scope: "synthetic", sharing: "private", editable: true })) };
  return { state, snapshot: s };
}
describe("synthetic standalone organization host", () => {
  it("runs structure, title, parent and original history in one atomic operation", async () => {
    const { state, snapshot } = base(), proposal = await syntheticNoteOrganizationAgent.prepare({ snapshot, signal: new AbortController().signal, instruction: "synthetic fixture only", contextTrust: "untrusted" });
    const request = createOrganizationRequest(snapshot, proposal, "one"), result = applySyntheticOrganization(state, request);
    expect(result.status).toBe("committed"); expect(state.notes.note!.title).toBe("旅の準備"); expect(state.notes.note!.parentId).toBe("travel");
    expect(state.receipts.one!.request.before.document).toEqual(snapshot.document); expect(state.receipts.one!.request.before.title).toBe("自由メモ");
    expect(state.notes.note!.document.blocks.map(b => b.content)).toEqual(snapshot.document.blocks.map(b => b.content));
    const copy = structuredClone(state); expect(applySyntheticOrganization(state, request)).toEqual(result); expect(state).toEqual(copy);
    expect(applySyntheticOrganization(state, { ...request, plan: { ...request.plan!, title: "天気は未確認。" }, after: { ...request.after, title: "天気は未確認。" } }).status).toBe("rejected");
  });
  it("rolls back move failures, refuses stale hierarchy and rejects malicious Undo", async () => {
    const { state, snapshot } = base(), p = await syntheticNoteOrganizationAgent.prepare({ snapshot, signal: new AbortController().signal, instruction: "synthetic fixture only", contextTrust: "untrusted" }), r = createOrganizationRequest(snapshot, p, "one"), old = structuredClone(state);
    expect(() => applySyntheticOrganization(state, r, "move-failure")).toThrow(); expect(state).toEqual(old);
    state.hierarchy++; expect(applySyntheticOrganization(state, r).status).toBe("conflict"); state.hierarchy--;
    const fresh = { ...r, operationId: "fresh" }; const result = applySyntheticOrganization(state, fresh); if (result.status !== "committed") throw new Error("fixture");
    const undo: OrganizationRequest = { operationId: "undo", kind: "undo", undoOperationId: "fresh", before: result.receipt.snapshot, after: { document: snapshot.document, title: snapshot.title, parentId: snapshot.parentId } };
    const hostile = { ...structuredClone(undo), operationId: "hostile" }; hostile.after.document.blocks[0]!.content = "invented"; expect(applySyntheticOrganization(state, hostile).status).toBe("rejected");
    expect(applySyntheticOrganization(state, undo).status).toBe("committed"); expect(organizationEqual(state.notes.note!.document, snapshot.document)).toBe(true);
  });
  it("keeps manual title/pinned placement and asks once when work and travel both match", async () => {
    const { snapshot } = base(); snapshot.document.blocks.push({ id: "work-topic", type: "paragraph", content: "仕事も未定" });
    const p = await syntheticNoteOrganizationAgent.prepare({ snapshot, signal: new AbortController().signal, instruction: "synthetic fixture only", contextTrust: "untrusted" }) as { placement: string; title: string; parentId: string | null };
    expect(p.placement).toBe("ambiguous"); snapshot.titleManual = true; snapshot.parentPinned = true;
    const fixed = await syntheticNoteOrganizationAgent.prepare({ snapshot, signal: new AbortController().signal, instruction: "synthetic fixture only", contextTrust: "untrusted" }) as typeof p;
    expect(fixed.title).toBe(snapshot.title); expect(fixed.parentId).toBe(snapshot.parentId);
  });
  it("a terminal operation fence rejects any later delayed submission", async () => {
    const { state, snapshot } = base(), p = await syntheticNoteOrganizationAgent.prepare({ snapshot, signal: new AbortController().signal, instruction: "synthetic fixture only", contextTrust: "untrusted" });
    state.fenced.delayed = true; const old = structuredClone(state);
    expect(applySyntheticOrganization(state, createOrganizationRequest(snapshot, p, "delayed")).status).toBe("rejected"); expect(state).toEqual(old);
  });

});
describe("capability-aware synthetic host", () => {
  const assistance = { capabilities: { revision: "c1", featureIds: [], blockTypes: ["paragraph", "heading", "bulletListItem"], inlineTypes: ["text", "link"], styleTypes: [], commandIds: [], operations: ["heading", "bulletListItem", "title", "placement", "link.add", "link.edit", "link.remove"] as const }, selection: { revision: "s1", blockIds: [] }, proposalsAllowed: true, autoLinks: false };
  function available() {
    const state = createSyntheticOrganizationSeed({ ...assistance, capabilities: { ...assistance.capabilities, operations: [...assistance.capabilities.operations] } });
    const s = { ...state.notes.note!, hierarchyRevision: "h1", root: { scope: "synthetic", sharing: "private", editable: true }, pages: Object.values(state.notes).map(n => ({ id: n.documentId, parentId: n.parentId, title: n.title, scope: "synthetic", sharing: "private", editable: true })) };
    return { state, snapshot: s };
  }
  it("does not listify ordinary prose, bounds plans and explains grounded links", () => {
    const { snapshot } = available(), p = prepareCapabilityAwarePlan(snapshot);
    expect(p.formats).toEqual([{ blockId: "note-0", type: "heading", level: 2 }]); expect(p.assistance.links).toHaveLength(1); expect(p.assistance.reason).toContain("未確認");
  });
  it("rejects a forged client approval flag and binds trusted approval to the exact atomic payload", () => {
    const { state, snapshot } = available(), p = prepareCapabilityAwarePlan(snapshot), r = createOrganizationRequest(snapshot, p, "reviewed", "approved");
    const forged = structuredClone(state); expect(applySyntheticOrganization(forged, r).status).toBe("rejected"); expect(forged.notes.note!.document).toEqual(snapshot.document);
    state.approvals = { reviewed: structuredClone(r) }; const result = applySyntheticOrganization(state, r); expect(result.status).toBe("committed");
    expect(state.receipts.reviewed!.request.before.document).toEqual(snapshot.document); expect(applySyntheticOrganization(state, r).status).toBe("committed"); expect(Object.keys(state.receipts)).toHaveLength(1);
    const committed = structuredClone(state);
    expect(() => applySyntheticOrganization(state, { ...r, after: { ...r.after, title: "forged" } })).toThrow(); expect(state).toEqual(committed);
  });
  it("automatically links exact original URLs without requesting structural authority", () => {
    const { state, snapshot } = available(); snapshot.assistance!.proposalsAllowed = false; snapshot.assistance!.autoLinks = true; state.notes.note!.assistance = snapshot.assistance;
    const p = prepareCapabilityAwarePlan(snapshot); expect(p.formats).toEqual([]); expect(p.title).toBe(snapshot.title); expect(p.parentId).toBe(snapshot.parentId);
    const r = createOrganizationRequest(snapshot, p, "url-only"); expect(applySyntheticOrganization(state, r).status).toBe("committed"); expect(state.notes.note!.title).toBe(snapshot.title);
  });
  it("withdraws unavailable links and all operations under denied host permission", () => {
    const { snapshot } = available(); snapshot.assistance!.capabilities.operations = ["heading"];
    expect(prepareCapabilityAwarePlan(snapshot).assistance.links).toEqual([]);
    snapshot.assistance!.capabilities.operations = []; const p = prepareCapabilityAwarePlan(snapshot); expect(p.formats).toEqual([]); expect(p.assistance.links).toEqual([]); expect(p.title).toBe(snapshot.title); expect(p.parentId).toBe(snapshot.parentId);
  });
});
