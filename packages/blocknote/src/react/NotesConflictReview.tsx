import { useRef, useState, useSyncExternalStore } from "react";
import type { EditorDocument } from "@hello-ai-company/editor-core";
import type { NotesWorkspaceController } from "../notes/contracts.js";
import { ReadableDocumentComparison, mergeComparedDocuments, readableBlockText } from "./ReadableDocumentComparison.js";

type Review = { revision: string; local: EditorDocument; latest: EditorDocument; fingerprint: string; title: string; latestTitle: string };
const reviewFingerprint = (document: EditorDocument | undefined, title: string | undefined): string => JSON.stringify([document, title]);
/** Comparing and choosing blocks never writes. Controller revalidates the exact reviewed
 * canonical revision and retains originals until an explicit save is acknowledged. */
export function NotesConflictReview({ controller }: { controller: NotesWorkspaceController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const [busy, setBusy] = useState(false), [review, setReview] = useState<Review>(), [title, setTitle] = useState(""), [message, setMessage] = useState("");
  const [choices, setChoices] = useState<Record<string, "local" | "latest">>({}), [order, setOrder] = useState<"local" | "latest">("local");
  const flight = useRef(false);
  if (!["conflict", "denied"].includes(state.status) && !state.manualSaveRequired) return null;
  const local = state.draft ?? state.snapshot?.document;
  const current = !!review && !!local && state.latest?.revision === review.revision && state.latest.title === review.latestTitle && reviewFingerprint(local, state.draftTitle ?? state.snapshot?.title) === review.fingerprint;
  let merged:EditorDocument|undefined,mergeError="";
  if(review)try{merged=mergeComparedDocuments(review.local,review.latest,choices,order);}catch(error){mergeError=error instanceof Error?error.message:"統合案を確認してください";}
  const ids = review ? [...new Set([...review.local.blocks, ...review.latest.blocks].map(block => block.id))] : [];
  return <section className="oe-notes-conflict-review" aria-label="保存競合の確認"><h3>入力を保持しています</h3><p>タイトルと本文を比較し、ブロックごとに残す内容を選んでください。表・書式・子ブロックはまとめて保持します。統合案の準備後も明示的な保存が必要です。</p>
    {state.manualSaveRequired ? <p role="status">統合案は未保存です。本文で編集し「保存」を押してください。元の入力は保存確認まで保持します。</p> : <button type="button" disabled={busy || state.composing} onClick={async () => {
      if (flight.current) return; flight.current = true; setBusy(true);
      try { const latest = await controller.readLatest(); const live = controller.getState();
        if (latest && live.latest && live.snapshot) { const draft = structuredClone(live.draft ?? live.snapshot.document); setReview({revision:live.latest.revision,local:draft,latest:structuredClone(live.latest.document),fingerprint:reviewFingerprint(draft,live.draftTitle??live.snapshot.title),title:live.draftTitle??live.snapshot.title,latestTitle:live.latest.title}); setTitle(live.draftTitle??live.snapshot.title);setChoices({});setOrder("local");setMessage(""); }
        else setMessage("最新の内容を確認できませんでした。原本と入力を保持しています。");
      } catch {setMessage("最新の内容を確認できませんでした。原本と入力を保持しています。");} finally {flight.current=false;setBusy(false);}
    }}>最新と比較する</button>}
    {review && state.latest && state.status !== "denied" ? <><ReadableDocumentComparison before={review.local} after={review.latest} beforeTitle={review.title} afterTitle={review.latestTitle}/>
      {!state.manualSaveRequired ? <><fieldset disabled={busy || !current || state.composing}><legend>残す内容</legend>{ids.map((id,index) => {
        const before=review.local.blocks.find(block=>block.id===id), after=review.latest.blocks.find(block=>block.id===id), same=JSON.stringify(before)===JSON.stringify(after);
        return <div key={id} style={{paddingBlock:".4rem"}}><strong>ブロック {index+1} · {before?.type??after?.type}{same?" · 変更なし":""}</strong><p>{(before?readableBlockText(before):after?readableBlockText(after):"").slice(0,120)}</p><label>採用する側<select aria-label={`ブロック ${index+1} の採用元`} value={choices[id]??"local"} onChange={event=>setChoices(old=>({...old,[id]:event.target.value as "local"|"latest"}))}><option value="local">{before?"保持している入力":"入力側の削除"}</option><option value="latest">{after?"最新の保存内容":"保存側の削除"}</option></select></label></div>;
      })}<label>ブロックの並び<select value={order} onChange={event=>setOrder(event.target.value as "local"|"latest")}><option value="local">入力側の並びを優先</option><option value="latest">保存側の並びを優先</option></select></label><label>統合後のタイトル<input value={title} onChange={event=>setTitle(event.target.value)}/></label></fieldset>
      {merged?<details><summary>統合案の本文を確認</summary><ReadableDocumentComparison before={review.local} after={merged} beforeTitle={review.title} afterTitle={title} afterLabel="選んだ統合案"/></details>:<p role="alert">{mergeError}</p>}
      {!current?<p role="status">比較後に内容が変わりました。「最新と比較する」で確認し直してください。</p>:null}
      <button type="button" disabled={busy||state.composing||!current||!merged} onClick={async()=>{if(flight.current||!current)return;flight.current=true;setBusy(true);try{const live=controller.getState();if(live.latest?.revision!==review.revision||live.latest.title!==review.latestTitle||reviewFingerprint(live.draft??live.snapshot?.document,live.draftTitle??live.snapshot?.title)!==review.fingerprint)throw Error();const accepted=await controller.acceptMergedDraft(review.revision,mergeComparedDocuments(review.local,review.latest,choices,order),title);setMessage(accepted?"統合案を準備しました。保存するまで原本を変更しません":"内容が変わったため統合できませんでした。入力を保持しています");}catch{setMessage("統合案を準備できませんでした。原本と入力を保持しています");}finally{flight.current=false;setBusy(false);}}}>確認した統合案を準備</button></>:null}</>:null}
    {message?<p role="status">{message}</p>:null}
  </section>;
}
