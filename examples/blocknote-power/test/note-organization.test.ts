import { describe, expect, it } from "vitest";
import { createOrganizationRequest, organizationEqual, type OrganizationRequest } from "@hello-ai-company/editor-ai";
import { applySyntheticOrganization, createSyntheticOrganizationSeed, syntheticNoteOrganizationAgent } from "../src/syntheticNoteOrganization";
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
