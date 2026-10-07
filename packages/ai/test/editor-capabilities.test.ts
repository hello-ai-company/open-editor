import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoteOrganizationSession, createOrganizationRequest, organizationEqual, parseOrganizationSnapshot, validateOrganizationRequest, type OrganizationSnapshot, type OrganizationPlan, type OrganizationRequest, type NoteOrganizationHost, type OrganizationReceipt } from "../src/noteOrganization.js";
import { applyAgentLinkEdits, safeAgentLink, parseAgentEditorCapabilities, parseAgentLinkEdits, type AgentLinkEdit } from "../src/editorCapabilities.js";

function initial(): OrganizationSnapshot {
  return parseOrganizationSnapshot({ documentId: "note", revision: "r1", hierarchyRevision: "h1", pinRevision: "p1", title: "Untitled", parentId: null, titleManual: false, parentPinned: false, autoOrganize: false,
    document: { schemaVersion: 1, blocks: [{ id: "line", type: "paragraph", props: { future: 42 }, content: [{ type: "text", text: "資料 https://example.com/guide と 旅", styles: { bold: true }, future: "keep" }] }, { id: "opaque", type: "future", content: { untouched: true } }] },
    pages: [{ id: "note", parentId: null, title: "Untitled", scope: "s", sharing: "private", editable: true }, { id: "travel", parentId: null, title: "旅", scope: "s", sharing: "private", editable: true }], root: { scope: "s", sharing: "private", editable: true },
    assistance: { capabilities: { revision: "c1", featureIds: [], blockTypes: ["paragraph", "heading", "bulletListItem"], inlineTypes: ["text", "link"], styleTypes: ["bold"], commandIds: [], operations: ["heading", "bulletListItem", "title", "placement", "link.add", "link.edit", "link.remove"] }, selection: { revision: "s1", blockIds: [] }, proposalsAllowed: true, autoLinks: false }
  });
}
const addition: AgentLinkEdit = { blockId: "line", index: 0, action: "add", start: 3, end: 28, href: "https://example.com/guide" };
function plan(s = initial(), links: AgentLinkEdit[] = [addition]): OrganizationPlan {
  return { documentId: s.documentId, revision: s.revision, hierarchyRevision: s.hierarchyRevision, pinRevision: s.pinRevision, title: s.title, parentId: s.parentId, placement: "certain", formats: [], assistance: { capabilityRevision: s.assistance!.capabilities.revision, selectionRevision: s.assistance!.selection.revision, reason: "原文のURLをリンクにします。参照先は未確認です。", links } };
}
const visible = (v: unknown): string => Array.isArray(v) ? v.map(visible).join("") : v && typeof v === "object" ? "text" in v ? String(v.text) : "content" in v ? visible(v.content) : "" : String(v ?? "");
function fixture() {
  let current = initial(); const grants = new Map<string, OrganizationRequest>(), receipts = new Map<string, { request: OrganizationRequest; receipt: OrganizationReceipt }>(); let writes = 0;
  const host: NoteOrganizationHost = {
    read: vi.fn(async () => structuredClone(current)), beforeSubmit: vi.fn(async () => {}),
    approveProposal: vi.fn(async r => { validateOrganizationRequest(r, current); grants.set(r.operationId, structuredClone(r)); }),
    lookupOperation: vi.fn(async id => receipts.has(id) ? { status: "committed" as const, receipt: receipts.get(id)!.receipt } : { status: "unknown" as const }),
    commit: vi.fn(async r => {
      validateOrganizationRequest(r, current);
      if (r.authorization && !organizationEqual(grants.get(r.operationId), r)) return { status: "rejected" as const };
      writes++; current = { ...current, ...structuredClone(r.after), revision: `r${writes + 1}` };
      const receipt = { operationId: r.operationId, historyId: `history-${r.operationId}`, snapshot: structuredClone(current) };
      receipts.set(r.operationId, { request: structuredClone(r), receipt }); return { status: "committed" as const, receipt };
    })
  };
  const prepare = vi.fn(async ({ snapshot }: { snapshot: OrganizationSnapshot }) => plan(snapshot)), cancel = vi.fn(async () => {});
  const session = () => createNoteOrganizationSession({ host, agent: { prepare, cancel }, idleMs: 500, proposalIntervalMs: 1000, timeoutMs: 100 });
  return { host, grants, receipts, prepare, cancel, session, get current() { return current; }, set current(v) { current = v; } };
}
afterEach(() => vi.useRealTimers());
describe("installed and executable editor capabilities", () => {
  it("does not infer executable DB/HTML/Canvas features from installed schema", () => {
    const caps = initial().assistance!.capabilities;
    expect(parseAgentEditorCapabilities({ ...caps, blockTypes: [...caps.blockTypes, "database", "oeHtmlWidget", "columns", "canvas"] }).operations).toEqual(caps.operations);
    expect(() => parseAgentEditorCapabilities({ ...caps, operations: ["canvas.execute"] })).toThrow();
    expect(() => parseAgentEditorCapabilities({ ...caps, inlineTypes: ["text"] })).toThrow();
    expect(() => parseAgentEditorCapabilities({ ...caps, blockTypes: ["paragraph"] })).toThrow();
  });
  it.each(["document", "capability", "selection", "pin", "permission", "selected-range"])("blocks stale or denied %s at the host boundary", kind => {
    const s = initial(), p = plan(s), r = createOrganizationRequest(s, p, "approved-one", "approved");
    if (kind === "document") s.revision = "r2";
    if (kind === "capability") s.assistance!.capabilities.revision = "c2";
    if (kind === "selection") s.assistance!.selection.revision = "s2";
    if (kind === "pin") s.pinRevision = "p2";
    if (kind === "permission") s.assistance!.capabilities.operations = [];
    if (kind === "selected-range") s.assistance!.selection.blockIds = ["opaque"];
    expect(() => validateOrganizationRequest(r, s)).toThrow();
    if (["permission", "selected-range"].includes(kind)) expect(() => createOrganizationRequest(s, plan(s), "new", "approved")).toThrow();
  });
  it("does not expand prior structural automatic permission to links", () => {
    const s = initial(); s.autoOrganize = true; expect(() => createOrganizationRequest(s, plan(s), "old-scope")).toThrow(/review/);
    s.assistance!.autoLinks = true;
    expect(createOrganizationRequest(s, plan(s), "url-scope").authorization).toBeUndefined();
    expect(() => createOrganizationRequest(s, { ...plan(s), formats: [{ blockId: "line", type: "heading", level: 2 }] }, "limited")).not.toThrow();
    s.autoOrganize = false; expect(() => createOrganizationRequest(s, { ...plan(s), formats: [{ blockId: "line", type: "heading", level: 2 }] }, "limited")).toThrow();
  });
});
describe("grounded links with original text and styles", () => {
  it("adds only an original URL, preserves all displayed text/unknown data, and unlinks only on explicit confirmation", () => {
    const s = initial(), before = structuredClone(s);
    const r = createOrganizationRequest(s, plan(s), "one", "approved");
    expect(visible(r.after.document.blocks[0]!.content)).toBe(visible(s.document.blocks[0]!.content));
    expect(r.after.document.blocks[1]).toEqual(s.document.blocks[1]); expect(r.after.document.blocks[0]!.props).toEqual({ future: 42 });
    const link = (r.after.document.blocks[0]!.content as any[])[1]; expect(link.content[0].styles.bold).toBe(true); expect(link.content[0].future).toBe("keep");
    expect(s).toEqual(before);
    const removed = applyAgentLinkEdits(r.after.document, [{ blockId: "line", index: 1, action: "remove" }], s.pages, s.pages[0]!);
    expect(removed.needsConfirmation).toBe(true); expect(visible(removed.document.blocks[0]!.content)).toBe(visible(s.document.blocks[0]!.content));
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "https://user:pass@example.com/", "//example.com", "https://example.com/\ntrack", "https://example.com\\track", "mailto:secret@example.com", "blob:https://example.com/x", "oe-page:missing"])("rejects unsafe or unknown target %s", url => {
    expect(() => safeAgentLink(url, initial().pages)).toThrow();
  });
  it("rejects invented URLs, cross-sharing references, opaque widgets and overlapping edits", () => {
    const s = initial(); expect(() => createOrganizationRequest(s, plan(s, [{ ...addition, href: "https://invented.invalid/" }]), "invent", "approved")).toThrow();
    expect(() => createOrganizationRequest(s, plan(s, [{ ...addition, blockId: "opaque" }]), "widget", "approved")).toThrow();
    expect(() => parseAgentLinkEdits([addition, addition])).toThrow(/Overlapping/);
    s.pages[1]!.sharing = "public";
    expect(() => createOrganizationRequest(s, plan(s, [{ ...addition, start: 31, end: 32, href: "oe-page:travel" }]), "scope", "approved")).toThrow();
  });
  it("adds exact internal title reference and edits a stale label only to a host-owned existing title", () => {
    const s = initial(); const d = applyAgentLinkEdits(s.document, [{ ...addition, start: 31, end: 32, href: "oe-page:travel" }], s.pages, s.pages[0]!);
    expect(d.needsConfirmation).toBe(true);
    const link = (d.document.blocks[0]!.content as any[])[1]; link.content[0].text = "古い名前";
    const edited = applyAgentLinkEdits(d.document, [{ blockId: "line", index: 1, action: "edit", href: "oe-page:travel", label: "旅" }], s.pages, s.pages[0]!);
    expect(visible(edited.document.blocks[0]!.content)).toBe(visible(s.document.blocks[0]!.content)); expect(edited.needsConfirmation).toBe(true);
    expect(() => applyAgentLinkEdits(d.document, [{ blockId: "line", index: 1, action: "edit", href: "oe-page:travel", label: "別の事実" }], s.pages, s.pages[0]!)).toThrow();
  });
  it("canonicalizes an existing URL without visiting or claiming verification", () => {
    const s = initial(); s.document.blocks[0]!.content = [{ type: "link", href: "HTTPS://EXAMPLE.COM:443/guide", content: [{ type: "text", text: "引用・重要参考", styles: { italic: true } }] }];
    const r = applyAgentLinkEdits(s.document, [{ blockId: "line", index: 0, action: "edit", href: "https://example.com/guide" }], s.pages, s.pages[0]!);
    expect(r.needsConfirmation).toBe(false); expect(visible(r.document.blocks[0]!.content)).toBe("引用・重要参考");
  });
});
describe("quiet proposal approval and withdrawal", () => {
  it("prepares one quiet proposal, keeps original until approval, commits once under repeated clicks and atomically undoes", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500);
    expect(s.getSnapshot().status).toBe("confirming"); expect(f.host.commit).not.toHaveBeenCalled();
    await Promise.all([s.approveProposal(), s.approveProposal(), s.approveProposal()]); expect(f.host.approveProposal).toHaveBeenCalledTimes(1); expect(f.host.commit).toHaveBeenCalledTimes(1);
    s.update(f.current); expect(s.getSnapshot().canUndo).toBe(true); await s.undo(); expect(f.current.document).toEqual(initial().document); s.dispose();
  });
  it("respects rejection across caret/revision changes and bounds repeated preparation", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); s.dismiss();
    f.current = { ...f.current, revision: "r2", assistance: { ...f.current.assistance!, selection: { revision: "new-caret", blockIds: [] } } }; s.update(f.current);
    await vi.advanceTimersByTimeAsync(1000); expect(s.getSnapshot().status).toBe("idle"); expect(s.getSnapshot().plan).toBeUndefined(); expect(f.host.commit).not.toHaveBeenCalled();
    s.update(f.current); await vi.advanceTimersByTimeAsync(20000); expect(f.prepare).toHaveBeenCalledTimes(2); s.dispose();
  });
  it.each(["input", "selection", "capability", "permission", "IME", "other-note", "stop"])("withdraws when %s changes before confirmation", async kind => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500);
    if (kind === "input") s.update({ ...f.current, revision: "draft" }, false);
    if (kind === "selection") s.update({ ...f.current, assistance: { ...f.current.assistance!, selection: { revision: "caret", blockIds: [] } } });
    if (kind === "capability") s.update({ ...f.current, assistance: { ...f.current.assistance!, capabilities: { ...f.current.assistance!.capabilities, revision: "c2" } } });
    if (kind === "permission") s.update({ ...f.current, assistance: { ...f.current.assistance!, proposalsAllowed: false } });
    if (kind === "IME") s.compositionStart();
    if (kind === "other-note") { const other = structuredClone(f.current); other.documentId = "travel"; other.title = "旅"; s.update(other); }
    if (kind === "stop") await s.stop();
    await s.approveProposal(); expect(f.host.commit).not.toHaveBeenCalled(); s.dispose();
  });
  it("refuses a stale approval even when the UI has not yet received the changed host revision", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); f.current = { ...f.current, pinRevision: "revoked" };
    await s.approveProposal(); expect(f.host.commit).not.toHaveBeenCalled(); expect(s.getSnapshot().status).toBe("blocked"); s.dispose();
  });
  it("preserves later human edits while allowing Undo after caret-only movement", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); await s.approveProposal(); s.update(f.current);
    f.current = { ...f.current, assistance: { ...f.current.assistance!, selection: { revision: "caret-only", blockIds: [] } } }; s.update(f.current); expect(s.getSnapshot().canUndo).toBe(true);
    await s.undo(); expect(f.current.document).toEqual(initial().document); s.dispose();
    const g = fixture(), t = g.session(); t.update(g.current); await vi.advanceTimersByTimeAsync(500); await t.approveProposal(); g.current = { ...g.current, revision: "human-edit" }; t.update(g.current); await t.undo(); expect(g.host.commit).toHaveBeenCalledTimes(1); t.dispose();
  });
  it("honors a stop during a delayed approval without restoring idle or writing", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); let finish!: () => void;
    f.host.approveProposal = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    s.update(f.current); await vi.advanceTimersByTimeAsync(500); const approving = s.approveProposal(); await vi.advanceTimersByTimeAsync(0);
    await s.stop(); finish(); await approving; expect(s.getSnapshot().status).toBe("off"); expect(f.host.commit).not.toHaveBeenCalled(); s.dispose();
  });
  it("keeps reconnect and another preparation closed until a delayed approval ends", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); let finish!: () => void;
    f.host.approveProposal = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    s.update(f.current); await vi.advanceTimersByTimeAsync(500); const approving = s.approveProposal(); await vi.advanceTimersByTimeAsync(0);
    await s.stop(); await s.reconnect(); await vi.advanceTimersByTimeAsync(50);
    expect(f.prepare).toHaveBeenCalledTimes(1); expect(f.host.commit).not.toHaveBeenCalled(); expect(s.getSnapshot().status).toBe("off");
    finish(); await approving; expect(s.getSnapshot().status).toBe("off"); s.dispose();
  });
  it("suppresses an explicitly undone plan even after the caret moves", async () => {
    vi.useFakeTimers(); const f = fixture(), s = f.session(); s.update(f.current); await vi.advanceTimersByTimeAsync(500); await s.approveProposal(); s.update(f.current); await s.undo(); s.update(f.current);
    f.current = { ...f.current, assistance: { ...f.current.assistance!, selection: { revision: "after-undo-caret", blockIds: [] } } }; s.update(f.current); await vi.advanceTimersByTimeAsync(2000);
    expect(s.getSnapshot().plan).toBeUndefined(); expect(f.host.commit).toHaveBeenCalledTimes(2); s.dispose();
  });
  it("captures nested selections without exposing an outside global metadata edit", () => {
    const s = initial(); s.document.blocks[0]!.children = [{ id: "nested", type: "paragraph", content: "選択した内容" }]; s.assistance!.selection.blockIds = ["nested"];
    expect(parseOrganizationSnapshot(s).assistance!.selection.blockIds).toEqual(["nested"]);
    expect(() => createOrganizationRequest(s, { ...plan(s, []), title: "選択した内容" }, "outside", "approved")).toThrow(/metadata/);
  });
});
