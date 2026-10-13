// Synthetic review-only policy workbench. No provider, writer, AI, network or persistence.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createEditorDocument } from "@hello-ai-company/editor-core";
import { KNOWN_AGENT_BLOCK_TYPES, evaluateBlockCandidates, type BlockCandidateBinding, type BlockCandidateResult } from "@hello-ai-company/editor-ai";
import { createOpenEditorPowerPreset } from "@hello-ai-company/editor-blocknote";
import { createOpenEditorNotesPreset, createLegacyNotesEditingFeature, type NotesWorkspaceHost } from "@hello-ai-company/editor-blocknote/notes";
import { createMathPowerFeature } from "@hello-ai-company/editor-blocknote/math";
import { createDiagramPowerFeature } from "@hello-ai-company/editor-blocknote/diagram";
const inventoryHost: NotesWorkspaceHost = {scope:{actorId:"synthetic-inventory",workspaceId:"synthetic-inventory"},readDocument:async()=>{throw Error("read unavailable")},beforeSubmit:async()=>{throw Error("write unavailable")},commit:async()=>{throw Error("write unavailable")},lookupOperation:async()=>{throw Error("query unavailable")}};
const inventoryPreset=createOpenEditorNotesPreset({host:inventoryHost,features:[createLegacyNotesEditingFeature(),createMathPowerFeature(),createDiagramPowerFeature()]});
const registeredBlockTypes=Object.keys(inventoryPreset.schema.blockSchema).sort();
const powerCount=Object.keys(createOpenEditorPowerPreset().schema.blockSchema).length;
const inventoryMatches=JSON.stringify(registeredBlockTypes)===JSON.stringify([...KNOWN_AGENT_BLOCK_TYPES].sort());
const initial = ["# 計画", "- 原文と数値123を保持", "- [ ] 確認は未完了", "項目\t金額\nA\t123\nB\t456", "```mermaid\ngraph TD; A-->B\n```"].join("\n\n");
const bindingTargets = [{blockType:"heading",kind:"text"}, {blockType:"bulletListItem",kind:"text"}, {blockType:"checkListItem",kind:"text"}, {blockType:"table",kind:"table"}, {blockType:"codeBlock",kind:"code"}, {blockType:"diagram",kind:"diagram"}] as const;
function Fixture() {
  const [source,setSource] = useState(initial), [revision,setRevision] = useState(1), [bound,setBound] = useState(false), [composing,setComposing] = useState(false), [dismissed,setDismissed] = useState<string[]>([]), [result,setResult] = useState<BlockCandidateResult>(), [elapsed,setElapsed] = useState(0);
  const evaluate = (keys = dismissed) => {
    if (composing) return;
    const bindings: BlockCandidateBinding[] = bound ? bindingTargets.map(target=>({...target,id:`synthetic-${target.blockType}`,sourceTypes:["paragraph"],operations:["format"],bound:true,proposalAuthorized:true,persistence:"durable",undo:"durable"})) : [];
    const start = performance.now();
    const next = evaluateBlockCandidates({documentId:"cloud-synthetic",documentRevision:`r${revision}`,document:createEditorDocument(source.split("\n\n").map((content,i)=>({id:`block-${i}`,type:"paragraph",content}))),selection:{revision:`s${revision}`,blockIds:[]},capabilities:{revision:bound?"synthetic-bound":"unbound",registeredBlockTypes,bindings}}, {dismissedSemanticKeys:keys});
    setElapsed(performance.now()-start); setResult(next);
  };
  return <main style={{maxWidth:850,margin:"20px auto",font:"16px/1.6 system-ui",padding:16,color:"#233a31"}}>
    <h1>全33型の候補を評価</h1><p data-runtime-inventory>実際の登録: Power {powerCount}型 / optional・legacy込み {registeredBlockTypes.length}型 / 既知型との一致: {String(inventoryMatches)}</p><details><summary>実行時schemaを確認</summary>{registeredBlockTypes.join(", ")}</details><p>合成データによる検証用です。表示・見送りのみ。AI、保存、採用、Undoの実行経路は接続していません。</p>
    <label>原文<textarea aria-label="合成原文" style={{display:"block",width:"100%",minHeight:240,boxSizing:"border-box",font:"inherit"}} value={source} onCompositionStart={()=>{setComposing(true);setResult(undefined);}} onCompositionEnd={()=>setComposing(false)} onChange={event=>{setSource(event.target.value);setRevision(value=>value+1);setResult(undefined);}} /></label>
    <label><input type="checkbox" checked={bound} onChange={event=>{setBound(event.target.checked);setResult(undefined);}} />比較用の型付き契約を宣言（合成、実保存能力を保証しません）</label>
    <p><button disabled={composing} onClick={()=>evaluate()}>候補を評価</button></p>
    {!result ? <p role="status">現在の原文で評価してください。新入力中は古い候補を表示しません。</p> : <><p role="status">{result.diagnostics.length}型を評価・上位{result.suggestions.length}件・処理{elapsed.toFixed(2)}ms・書き込み0件</p><p>{result.noChange.recommended?"現在の文書をそのまま保持します。":"変更しない選択もできます。"}</p><ul>{result.suggestions.map(item=><li key={item.semanticKey}><strong>{item.blockType}</strong>（{item.score}）<p>{item.reason}</p><button onClick={()=>{const keys=[...dismissed,item.semanticKey];setDismissed(keys);evaluate(keys);}}>見送る: {item.blockType}</button></li>)}</ul><details><summary>全型の評価理由（{result.diagnostics.length}型）</summary><ul>{result.diagnostics.map(item=><li key={item.blockType}><strong>{item.blockType}</strong>: {item.status}<ul>{item.reasons.map(reason=><li key={reason.code}>{reason.code}: {reason.message}</li>)}</ul></li>)}</ul></details><output aria-label="実行権限">execution: {result.execution}</output></>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
