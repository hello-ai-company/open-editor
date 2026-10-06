import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { acceptSuggestionGroup, createQuietCooperationSession, type QuietProposal } from "@hello-ai-company/editor-ai";
import { QuietCooperationCard } from "@hello-ai-company/editor-blocknote/react";
import type { EditorDocument } from "@hello-ai-company/editor-core";
import type { AheadEditorPort } from "./AheadPanel";

export function QuietCooperationDemo({ port, active }: { port: AheadEditorPort; active: boolean }) {
  // A different document port owns a different session and Undo receipt.
  const identity = useMemo(() => crypto.randomUUID(), [port]);
  return <QuietCooperationDocument key={identity} port={port} active={active} />;
}

function QuietCooperationDocument({ port, active }: { port: AheadEditorPort; active: boolean }) {
  const [notice, setNotice] = useState("停止中"), [busy, setBusy] = useState(false);
  const latch = useRef(false), receipt = useRef<{ before: EditorDocument; after: EditorDocument } | undefined>(undefined);
  const session = useMemo(() => createQuietCooperationSession({ document: port.getDocument(), agentId: "synthetic-writing-agent", purpose: "次の段落を、確認できる案として用意する", idleMs: 1200,
    provider: {
      prepare: async request => ({ hypothesis: "次に確かめる点を短く整理すると役立つかもしれません。合っていますか？", group: {
        schemaVersion: 1, id: request.runId, title: "次の段落の案（合成例）", baseDocument: request.document,
        changes: [{ op: "insert", block: { id: crypto.randomUUID(), type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [{ type: "text", text: "次に確かめたいこと：読み手に伝えたい点を整理し、必要な根拠を確認する。", styles: {} }] } }]
      } }), cancel: async () => {}
    }
  }), [port]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const lifecycle = useMemo(() => ({ generation: 0 }), [session]);
  const activeRef = useRef(active); activeRef.current = active;
  useEffect(() => {
    const generation = ++lifecycle.generation;
    const update = () => { try { session.updateDocument(port.getDocument()); } catch { void session.stop(); setNotice("文書を保持し、案の準備を停止しました"); } };
    const unsubscribe = port.subscribe(update), element = port.getElement?.();
    const begin = () => session.compositionStart(), end = () => session.compositionEnd();
    const visibility = () => session.setActive(activeRef.current && !document.hidden);
    element?.addEventListener("compositionstart", begin, true); element?.addEventListener("compositionend", end, true);
    document.addEventListener("visibilitychange", visibility);
    return () => { unsubscribe(); element?.removeEventListener("compositionstart", begin, true); element?.removeEventListener("compositionend", end, true); document.removeEventListener("visibilitychange", visibility); session.setActive(false); session.compositionEnd(); queueMicrotask(() => { if (lifecycle.generation === generation) session.dispose(); }); };
    // Document view remounts the editor DOM when returning from another mode.
    // Rebind composition listeners to that current element, retaining the session.
  }, [session, port, lifecycle, active]);
  useEffect(() => { session.setActive(active && !document.hidden); }, [session, active]);
  const act = async (apply: () => void) => {
    if (latch.current || !active) return;
    latch.current = true; setBusy(true);
    try { apply(); } catch { setNotice("人の編集を保護しました。現在の文書から確認し直してください。"); }
    finally { latch.current = false; setBusy(false); }
  };
  const proposal: QuietProposal | undefined = state.proposal;
  const enabled = state.enabled;
  const status = state.composing ? "変換中は案を出しません" : state.status === "ready" ? "確認待ち · 本文はそのまま" : state.status === "preparing" ? "合成例の案を準備中" : state.status === "stopping" ? "停止を確認中" : state.status === "blocked" ? "確認できないため停止しました" : state.status === "limit" ? "準備の上限に達しました" : enabled ? notice === "停止中" ? "入力を続けられます" : notice : "停止中";
  return <QuietCooperationCard enabled={enabled} actor="担当エージェント（合成例）" coordinator="秘書（合成例）" purpose="次の段落を確認できる案にする" status={status} hypothesis={proposal?.hypothesis} enableLabel="入力が落ち着いた時に、合成例の案を見る" notice="ローカルの合成例です。実モデル・外部送信はありません。"
    changes={proposal?.group.changes.map((change, index) => ({ id: String(index), before: "既存の本文を保持", after: change.op === "insert" && Array.isArray(change.block.content) ? change.block.content.map(item => typeof item === "object" && item && "text" in item ? String(item.text) : "").join("") : "ホスト側の確認が必要" }))}
    disabled={busy || !active || state.composing || state.status === "stopping"} canUndo={Boolean(receipt.current)}
    onEnable={value => { if (value) { setNotice("入力を続けられます"); session.enable(); } else void session.stop(); }}
    onStop={() => { void session.stop(); }} onDismiss={() => { session.dismiss(); setNotice("この案は使いません。次の入力まで再表示しません。"); }}
    onAccept={() => { void act(() => {
      const candidate = session.takeForReview(); if (!candidate) return;
      const before = port.getDocument(), timestamp = new Date().toISOString();
      const accepted = acceptSuggestionGroup(candidate.group, before, { acceptedBy: "local-browser-user", acceptedAt: timestamp, source: { agentId: candidate.agentId, runId: candidate.runId, generatedAt: timestamp } });
      if (accepted.status !== "accepted" || !port.commit(before, accepted.document)) throw new Error("Human edit conflict");
      receipt.current = { before, after: accepted.document }; session.dismiss(); setNotice("許可した段落を、まとまりで記載しました。");
    }); }}
    onUndo={() => { void act(() => { const accepted = receipt.current; if (!accepted || !port.commit(accepted.after, accepted.before)) throw new Error("Human edit conflict"); receipt.current = undefined; session.dismiss(); setNotice("記載をUndoしました。"); }); }} />;
}
