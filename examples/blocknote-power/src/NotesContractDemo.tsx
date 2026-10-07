import { useMemo, useState } from "react";
import { createRevisionedNotesResourceEditor, type NotesResourceResult } from "@hello-ai-company/editor-blocknote";
import { NotesPropertyEditor } from "@hello-ai-company/editor-blocknote/react";
/** Synthetic acceptance surface. Not a connection to a real Notes DB or AI. */
export default function NotesContractDemo() {
  const host = useMemo(() => {
    let revision = 1, value = { tags: ["alpha"], relation: ["page-1"], future: { preserved: true } }, loseAck = false;
    const receipts = new Map<string, NotesResourceResult>();
    const editor = createRevisionedNotesResourceEditor({
      commit: async request => {
        if (receipts.has(request.operationId)) return receipts.get(request.operationId)!;
        if (request.expectedRevision !== String(revision)) return { status: "conflict", operationId: request.operationId, resourceId: request.resourceId };
        if (request.change.kind !== "patch") throw new Error("Demo supports patch only");
        value = { ...value, ...request.change.fields };
        const receipt: NotesResourceResult = { status: "committed", operationId: request.operationId, resourceId: request.resourceId, snapshot: { revision: String(++revision), value: structuredClone(value) } };
        receipts.set(request.operationId, receipt);
        if (loseAck) { loseAck = false; throw new Error("Synthetic acknowledgement loss"); } return receipt;
      },
      lookupOperation: async (resourceId, operationId) => receipts.get(operationId) ?? { status: "unknown", resourceId, operationId }
    }, { resourceId: "synthetic-row" });
    return { editor, get: () => ({ revision: String(revision), value: structuredClone(value) }), loseNextAck: () => { loseAck = true; } };
  }, []);
  const [snapshot, setSnapshot] = useState(host.get);
  return <>
    <p>実データやAPIを使わない検証用です。複数選択をJSONで編集し、保存確認後に更新します。</p>
    <button onClick={host.loseNextAck}>次の保存応答を失わせる（合成）</button>
    <NotesPropertyEditor propertyId="tags" definition={{ type: "multi_select", optionIds: ["alpha", "beta", "gamma"] }} value={snapshot.value.tags} revision={snapshot.revision} editor={host.editor} onCommitted={() => setSnapshot(host.get())} />
    <output aria-label="合成DBの保存値">{JSON.stringify(snapshot)}</output>
  </>;
}
