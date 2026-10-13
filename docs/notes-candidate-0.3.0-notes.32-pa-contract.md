# .32 PA contract and adoption gates

.31 frozen contract is ready: ed508d967fd84d6664562976610ea106c4100431 / codex/coediting31。4tars manifestは ../open-editor-coediting31/output/candidate/0.3.0-notes.31/manifest.json。consumerのNotesTabbedWorkspaceProps型名重複はalias NotesTabbedWorkspaceProps31に訂正し、型/実行検査PASS。literal narrowingの検証側比較だけStringに訂正。初回失敗packは保全、最終manifestだけ採用。

.32 は .31 を含む別候補。gutter renderer childと同じpower.cssをhostへ組み込む。PA5501で固定欄なし・幅552→744px・caret/focus不変・40反復の報告を親から受けたが、このMac共通候補でPA hostを導入/実測した受入として数えない。

範囲capture→仮応答offer→ghost→明示reviewed apply又はversion/id/document/pane/session/action/boundsが一致するhost auto policy→同じcontroller.setDraft→既存document.saveだけ。承認/分類/監査/canonical receiptはhost責務。二重body writer、新endpoint、implicit ambient consentを作らない。

AI-only Undoは同一範囲のinverse、後続入力を保持。範囲重複はbounded review diffへ。全文restoreを使わない。非同期source/output hash、request/draft epoch、A→B→A、IME/beforeinput/active DOM+PM、stop/dismiss/late result、unknown/conflict/read-only/manual/raw input guardsを .31 のまま維持。

host受入には実canonical revision/approval/audit/receipt/conflict/fixed-ID GET/retry、post-dispatch newer draftのdurable journal、process crash/restart、AI Undo recoveryを独立検証すること。現在tickets/Undoはmemory sessionのみ。範囲は対応textblock最大2000 UTF16、atoms/code/widgets/newline除外。pending body save中の新入力は次saveまで未保存。PAが合成ghostだけを見せている状態を、本文採用/AI Undo接続済みに読み替えない。

既存 .30/.28/.27/.26 と .31 の凍結証跡、schema29 WIP13ファイルを保持。schema29の列name writerは未採用で、この候補に混ぜない。Safari/物理touch/native IME/real providerは未確認。実AI費用なし。
