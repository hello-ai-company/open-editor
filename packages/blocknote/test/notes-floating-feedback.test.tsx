/** @vitest-environment jsdom */
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesDocumentFeedback, NotesFeedbackControl, NotesFeedbackProvider, useNotesFeedback, type NotesFeedbackMessage } from "../src/react/NotesFeedback.js";
import { NotesProposalSignal } from "../src/react/NotesProposalSignal.js";
import { useNotesPanelCommands } from "../src/react/notesWorkspacePanels.js";
import type { NotesWorkspaceController, NotesWorkspaceState } from "../src/notes/contracts.js";

let root: Root, container: HTMLDivElement;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function click(name: string) { act(() => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === name)!.click()); }
function Probe() {
  const feedback = useNotesFeedback()!;
  return <><input aria-label="writer" /><button onClick={() => feedback.announce("first", "success")}>first</button><button onClick={() => feedback.announce("latest", "success")}>latest</button><button onClick={() => feedback.announce("failure", "error")}>fail</button><NotesFeedbackControl id="retained"><button>Resume input</button></NotesFeedbackControl></>;
}
function Frame({ identity = "one", children, persistent, message }: { identity?: string; children: React.ReactNode; persistent?: React.ReactNode; message?: NotesFeedbackMessage }) { const owner = useRef<HTMLElement>(null); return <NotesFeedbackProvider ownerRef={owner} identity={identity} persistent={persistent} message={message}><main className="oe-notes-workspace" ref={owner}>{children}</main></NotesFeedbackProvider>; }
function state(): NotesWorkspaceState { return { status: "ready", dirty: false, pendingEditors: false, localDrafts: {}, composing: false, message: "", snapshot: { scope: { actorId: "actor", workspaceId: "workspace" }, target: { kind: "page", pageId: "one" }, revision: "r1", contentRevision: "c1", title: "synthetic", metadata: {}, capabilities: ["metadata.patch"], capabilitySemantics: { "metadata.patch": "remote-committed" }, document: { schemaVersion: 1, blocks: [] } } }; }

describe("quiet feedback and retained actions", () => {
  it("shares layout success and unsaved backup in one dock, expiring only the success", () => {
    const backup = vi.fn(), draft = { ...state(), dirty: true };
    act(() => root.render(<Frame message={{ text: "表示状態を保存しました", tone: "success" }}><NotesDocumentFeedback state={draft} onBackup={backup} /></Frame>));
    const dock = document.querySelector(".oe-notes-feedback-dock")!;
    expect(dock.textContent).toContain("表示状態を保存しました"); expect(dock.textContent).toContain("入力を退避"); expect(document.querySelectorAll(".oe-notes-feedback-dock")).toHaveLength(1);
    const writer = document.createElement("input"); container.append(writer); writer.focus();
    act(() => vi.advanceTimersByTime(3100)); expect(dock.textContent).not.toContain("表示状態を保存しました"); expect(document.activeElement).toBe(writer);
    click("入力を退避"); expect(backup).toHaveBeenCalledOnce();
  });
  it("keeps concurrent layout errors, document recovery, error notices and backup discoverable", () => {
    const message: NotesFeedbackMessage = { text: "表示保存状態は未確認です", tone: "error", persistent: true };
    act(() => root.render(<Frame message={message} persistent={<div role="status"><button>保存結果を照会</button></div>}><Probe /><NotesDocumentFeedback state={{ ...state(), dirty: true }} onBackup={() => {}} /></Frame>));
    click("fail"); click("latest"); act(() => vi.advanceTimersByTime(10000));
    const dock = document.querySelector(".oe-notes-feedback-dock")!;
    for (const text of ["表示保存状態は未確認です", "保存結果を照会", "failure", "入力を退避"]) expect(dock.textContent).toContain(text);
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(2);
    act(() => document.querySelector<HTMLButtonElement>('button[aria-label="通知を閉じる"]')!.click());
    expect(dock.textContent).not.toContain("failure"); expect(dock.textContent).toContain("表示保存状態は未確認です"); expect(dock.textContent).toContain("保存結果を照会");
  });
  it("retains memory-only and stale-resource warnings until the state changes", () => {
    act(() => root.render(<Frame message={{ text: "再読込で復元されません", tone: "notice", persistent: true }}><Probe /></Frame>));
    click("latest"); act(() => vi.advanceTimersByTime(10000)); expect(document.querySelector('[data-source="workspace"]')!.textContent).toBe("再読込で復元されません");
    act(() => root.render(<Frame message={{ text: "更新通知を保持しています", tone: "notice", persistent: true }}><Probe /></Frame>));
    expect(document.body.textContent).not.toContain("再読込で復元されません"); act(() => vi.advanceTimersByTime(10000)); expect(document.body.textContent).toContain("更新通知を保持しています");
    act(() => root.render(<Frame><Probe /></Frame>)); expect(document.querySelector('[data-source="workspace"]')).toBeNull(); expect(document.body.textContent).toContain("Resume input");
  });
  it("coalesces a burst without moving focus, then expires only the success", () => {
    act(() => root.render(<Frame><Probe /></Frame>));
    const writer = container.querySelector("input")!; writer.focus(); click("first"); click("latest");
    expect(document.activeElement).toBe(writer); expect(document.querySelectorAll(".oe-notes-feedback-toast")).toHaveLength(1); expect(document.querySelector(".oe-notes-feedback-toast")!.textContent).toBe("latest");
    expect(container.querySelector(".oe-notes-feedback-toast")).toBeNull(); act(() => vi.advanceTimersByTime(3100));
    expect(document.querySelector(".oe-notes-feedback-toast")).toBeNull(); expect(document.body.textContent).toContain("Resume input"); expect(document.activeElement).toBe(writer);
  });
  it("never expires errors or required recovery and does not leave stale success after identity changes", () => {
    act(() => root.render(<Frame persistent={<button>Look up result</button>}><Probe /></Frame>)); click("fail"); act(() => vi.advanceTimersByTime(10000)); expect(document.body.textContent).toContain("Look up result");
    act(() => root.render(<Frame><Probe /></Frame>)); expect(document.querySelector('[role="alert"]')?.textContent).toContain("failure"); act(() => vi.advanceTimersByTime(10000)); expect(document.querySelector('[role="alert"]')).not.toBeNull(); click("latest"); expect(document.querySelector('[role="alert"]')?.textContent).toContain("failure");
    act(() => root.render(<Frame identity="two"><Probe /></Frame>)); expect(document.querySelector(".oe-notes-feedback-toast")).toBeNull();
  });
  it("keeps backup usable after the notification expires and recognizes same-revision saves in a different target", () => {
    const backup = vi.fn(), a = { ...state(), dirty: true, lastPersistence: "remote-committed" as const };
    act(() => root.render(<Frame><NotesDocumentFeedback state={a} onBackup={backup} /></Frame>)); click("入力を退避"); expect(backup).toHaveBeenCalledTimes(1); act(() => vi.advanceTimersByTime(3100)); expect(document.body.textContent).toContain("入力を退避");
    const b = { ...a, dirty: false, snapshot: { ...a.snapshot!, target: { kind: "page" as const, pageId: "two" } } }; act(() => root.render(<Frame identity="two"><NotesDocumentFeedback state={b} onBackup={backup} /></Frame>)); expect(document.querySelector(".oe-notes-feedback-toast")?.textContent).toBe("保存を確認しました"); expect(document.body.textContent).not.toContain("入力を退避");
  });
  it("keeps opaque host proposal input mounted through explicit open, ESC and reopen, with no implicit apply", () => {
    const apply = vi.fn(); act(() => root.render(<Frame><NotesProposalSignal><input defaultValue="retained proposal" /><button onClick={apply}>Apply</button></NotesProposalSignal></Frame>));
    const section = document.querySelector<HTMLElement>(".oe-notes-proposal-review")!, input = section.querySelector("input")!; expect(section.hidden).toBe(true); click("エージェントの提案"); input.value = "changed"; act(() => section.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(section.hidden).toBe(true); click("エージェントの提案"); expect(section.querySelector("input")).toBe(input); expect(input.value).toBe("changed"); expect(apply).not.toHaveBeenCalled();
  });
  it("marks a thrown command after a committed command as a durable error", async () => {
    const snapshot = state(); const controller = { getState: () => snapshot, subscribe: () => () => {}, execute: vi.fn().mockResolvedValueOnce({ status: "committed", persistence: "remote-committed" }).mockRejectedValueOnce(new Error("synthetic failure")) } as unknown as NotesWorkspaceController;
    function Commands() { const ops = useNotesPanelCommands(controller); return <><button onClick={() => void ops.execute({ kind: "metadata.patch", fields: { title: "test" } })}>command</button><output data-tone={ops.messageTone}>{ops.message}</output></>; }
    act(() => root.render(<Commands />)); await act(async () => click("command")); expect(container.querySelector("output")!.dataset.tone).toBe("success"); await act(async () => click("command")); expect(container.querySelector("output")!.dataset.tone).toBe("error");
  });
});
