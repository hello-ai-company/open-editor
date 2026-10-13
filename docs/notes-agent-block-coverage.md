# エージェントの全ブロック編集 — .36 時点の調査・設計案

見出し・箇条書き・本文の整理を一度の指示から差分提案し、まとめて採用できる形は、手作業を減らせます。現在の実装は全ブロック自動修正を提供していません。.36 の操作バー改善とは別の未実装設計です。実 AI / API は呼んでいません。

## 確認した登録型と対応範囲

公開 preset を合成 scope で生成して調べました。Power は21型、標準 Notes は27型、legacy feature追加で31型。optional mathBlock / diagram を含む既知型の和集合は33型。Host の追加 schema はここから推測しません。登録は読取・表示できる構造の情報で、エージェントの更新権限ではありません。詳細 inventory は output/ui36/block-inventory.json。

| 登録済み型（既知型を全て列挙） | 既存エージェント経路 | 全ブロック編集に必要な追加契約 |
| --- | --- | --- |
| paragraph, heading, bulletListItem, numberedListItem, checkListItem, quote | 単一 block の文字選択サービスは host接続時のみ。Coediting の plain text 小範囲はこれら6型だけ。 | rich inline/mark を保持する本文 patch、型変換と heading.level / checked / start の明示 allowlist。 |
| toggleListItem, callout | 既存手動編集・schema登録あり。Coediting の対象6型には含まれない。 | 折畳み・子階層・variant/title を保つ型別 patch と検証。 |
| codeBlock | 登録済み。optional code feature は highlighting/clipboard 等を追加し、新 block型は増やさない。Coediting対象外。 | 原文・language保持、コード変更の差分レビュー。実行しない。 |
| divider, oePageBreak, status | 手動挿入/props編集・表示あり。AI の型別更新 authority は未確認。 | 明示 insert/move、status.state/labelの型・意味を検証。 |
| table | native tableContent。本文に含まれる静的表。 | 行/列/セル/結合/幅/ヘッダー/inline を保持する table patch。DB行とは別契約。 |
| databaseView | 正規 databaseId/viewId への表示参照。DB行/定義/表示configは別CAS/resource経路。 | 既存 binding・property schema・capability・receipt・履歴を使用。本文置換だけでDB行を書かない。 |
| oeColumns, oeColumn | 手動作成/移動/resize/Undoあり。検証関数は groupに2..6列、columnの親/幅を検証。 | 親子・順序・幅・ID保持、orphan/cycle防止。structure validatorをbatch前後で使用。 |
| oeHtmlWidget | HTML/CSS/JS原文と journal を保持。preview はscript/networkを実行しない。 | 型付きsource patchと元ソースhash、未適用input/journal保護。AI変更でscript実行・外部通信を有効化しない。 |
| oeNotesDrawing, oeLegacyNotesDrawing | 版付き描画payload/legacy座標を持つ既存widget。 | payload schema・寸法・stroke IDを維持。単純文字置換にしない。 |
| oeNotesSyncedBlock | sharedId参照と別shared writer。 | shared revision/権限/receiptの確認。参照編集と共有元の変更を別に確認。 |
| pageCard, pageTransclusion, childPage, oeLegacyNotesPageLink | pageId参照。親本文と参照先の保存/権限は別。 | 認可済みpageId、親子参照・navigation guard。表示変更から参照先本文編集へ権限を広げない。 |
| image, audio, video, file, oeLegacyNotesAsset | asset URL/ID/表示/キャプションを保持。 | 元assetの同一性と認可、caption/presentation allowlist。再upload/取得・新URL推測をしない。 |
| oeLegacyNotesLink | legacy URL/title/description/presentation。 | 既存source/canonical ownership維持、リンク根拠・URL検証。 |
| mathBlock, diagram（optional） | feature明示登録時のみ。mathInlineもoptional inline型。 | source構文・サイズ・レンダラー制約の検証。未登録hostでは提案しない。 |
| oeUnknownBlock | 未対応データのopaque envelopeを原本保持。 | 自動修正対象外。削除/retype/flattenしない。新host型は専用adapterを追加してから。 |

## 既存の差分・承認・Undoを再利用できる範囲

- `packages/ai/src/suggestions.ts:28` は insert / delete / replace / move / update-props / text-diff の6操作。replaceは同一block ID、重複ID・重なる親子操作・移動cycleを拒否。最大256変更をdry-runし、accept時にbaseDocument全体一致を確認。一括差分の土台に使えるが、登録schema・型別props・host権限・外部resource・canonical保存・Undoを実装するものではない。text-diffはcontentが文字列の場合のみで、BlockNoteのinline配列を直接書き換えない。
- `packages/ai/src/editorCapabilities.ts:4` の明示 operation は heading / bulletListItem / title / placement / link.add / link.edit / link.remove。blockTypes配列は情報で、全型更新の権限ではない。リンク編集も既知の平坦な文字/link構造と原文/認可page IDに基づくURLだけ。
- `packages/blocknote/src/document/coediting.ts:6` の既存小範囲portはwriter/session/revision/source hashとPM mappingを使用。6型のplainな単一textblock内・2000文字以下。table、inline atom、code、widget、階層batchは対象外。auto-safeは文書/sessionに一致する既存policyと文字数上限、wording/continuationのみ。active/recent inputを避ける。Undoは当該AI範囲だけ、競合はreviewへ返す。全blockの自動更新へ拡大する承認ではない。
- PA読取checkoutの `apps/web/src/lib/api/documentProposals.ts:22` は現在 `op:"insert"` と `block.props.text`。`apps/api/personal_ai/services/editor_proposals.py:143` は段落追加提案を作り、`:274` は採用時に段落を末尾追加する。既存blockの書換え/型変換/移動/削除はこの経路で未対応。UIの部分/一括採用、proposal/document/content revisionとdigest照合、同transactionの履歴保存、永続Undoは再利用候補。後続編集があればUndoは競合。親調査ではcontext約16KBという制約も確認されている。
- .36の `selectionProposal.open` は既存review入口を開くcallbackのみ。全block patch API・生成・保存・採用の代用にはしない。

## 小さく始める設計

1. 「文書を整える」で、既存の認可済みwriter snapshotと安定block ID・本文/props hash・canonical/content revision・capability revision・host/型別の編集範囲を固定。未知block・未接続resourceは保持する。大文書は選択範囲ごとのchunkで原文hashを固定し、16KBのcontext超過を切捨てや推測で埋めない。
2. 最初は paragraph/heading/list/quote の表現と構造だけを型付きblock patchへ変換。現在の段落append APIを拡張する必要がある。元本文・inline styles・リンク・子階層を保持し、変更ごとの原文block ID/根拠とbefore/afterを表示。根拠のない事実追加、日付/数値/名前の変更、削除、未知URL、新しい外部resource操作は別レビューにする。
3. dry-runと型別schema/Columns/table/payload検証、権限の再確認を行い、選択した差分を一度の「まとめて適用」で既存canonical transaction + CAS + audit + historyへ送る。人間の新入力・IME・別source draft・未確定receiptがあればapplyを止めて提案と入力を保持。ACK不明は固定operation IDのlookup、再送で重複変更しない。
4. Undoは変更batchのbefore/afterと安定IDを記録。全体snapshotを無条件に戻さず、revisionが一致する場合に既存永続Undo、別変更があれば三者差分で再レビュー。DB/shared/reference操作には各resourceの独立receiptとUndo確認が必要。
5. 自動採用は将来の追加設計。既存 auto-safe policy の対象を黙って全型に広げない。まず一括確認でクリックを減らし、明示承認された限定範囲と意味を変えない修正のみ段階的に検討する。

PA側に必要な確認は、typed patch のserver validation/field ownership、canonical型・出自制限、DB表示/row/schemaの各CAS・grant、履歴/Undo/audit/receiptの永続性、リロード/切断/競合、context budget、実model出力の根拠。読んだcheckout以外のhost実装・追加pluginは不明。この設計は今回未実装で、PAの変更・実API呼出しは行っていない。

## 入力停止時の既存提案に接続する公開API（親の別host実装向け）

ユーザーの追加依頼により、PA側で入力停止時のparagraph/heading/list型付き提案と並べ替えを実装する別作業が進行中。.36 SDKでは重複実装しない。上記PA制約は読取した .35 checkoutの状態で、別host候補の完成後を検証した主張ではない。

- `QuietCooperationCard`（react公開export）は既存hostの入力停止提案が使う表示。`changes: readonly {id,before,after}[]` に型変換・移動も「標準テキスト→見出し1」「段落B:2番目→1番目」と表示できる。`disabled` / `canUndo` と onAccept/onDismiss/onStop/onUndo はhostに接続。表示component自身はclock・生成・権限・CAS・single-flightを実装しない。callbackはvoid型のためhost handlerで非同期操作のcatchと重複防止が必要。
- `NotesProposalRail` はstatus off/idle/preparing/review/saving/unknown/blocked、details ReactNode、canApprove/canUndo、composing/pending と非同期onApprove/onReject/onUndo/onReconcileを公開。表示とボタンのlocal single-flightだけ。`NotesWorkspace.proposal?:ReactNode` / `NotesTabbedWorkspace.proposal` で既存reviewを載せられる。内部 `NotesProposalSignal` は明示表示/閉じるを管理し、hidden時にもchildrenをmountedに保つ。
- `NotesSelectionProposalEntry` は手動選択のexisting review入口で、入力停止検出やblock patchのtransportではない。`NotesSelectionAIService` も単一block内の選択文のtext結果。block構造操作にこのtext置換を使わない。
- `SuggestionGroup` の6操作を共通の構造検証・dry-run・base一致に使うことは可能。ただしPA wireのNoteBlockやfield ownershipへの変換、type/level/childrenのvalidation、permission/revision/receipt/CASはhost側。全document採用resultをbodyへ直接投影してserver receiptを省かない。
- `DocumentCoeditingPort` のauto-safeは6型のplain小範囲のみ。見出し化・箇条書き化・並べ替えbatchへの拡張APIではない。既存のhost timing入力再開/IME/保存待ちepochとcommit barrierを維持し、表示proposalと生成・採用の権限を分ける。
