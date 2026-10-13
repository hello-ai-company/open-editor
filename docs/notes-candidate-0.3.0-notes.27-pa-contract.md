# 未Apply HTML source draft のPA接続契約（独立 .27 候補）

基点は共通 .26 `332c801`。既存 .26 package・成果とDB writerは保持する。今回の対象はHTML widgetの未Apply生入力。本文保存ticket、DB raw journal、Approval UI、アプリのJournal画面とは別の保護データであり、許可を与えない。

## 確定した公開契約（共通 / host）

`@hello-ai-company/editor-blocknote/notes` から `NotesHtmlSourceDraft` / `NotesHtmlSourceDraftJournal` / `NotesHtmlSourceDraftState`、`parseNotesHtmlSourceDraft`、`parseNotesHtmlRawSource`、`notesHtmlSourceDraftKey`、`sameNotesHtmlSourceDraft` を公開する。

任意接続は `NotesWorkspaceHost.sourceDraftJournal?: NotesHtmlSourceDraftJournal`。未接続host/standaloneは既存経路を維持する。同じcontrollerの既存 `setLocalDraft` が唯一のHTML draft writer。本文/DB/Canvas writerは増やさない。

```ts
interface NotesHtmlSourceDraftJournal {
  version: 1;
  compareAndSwap: true;
  list(scope: NotesScope, target: NotesTarget, signal: AbortSignal): Promise<readonly NotesHtmlSourceDraft[]>;
  put(next: NotesHtmlSourceDraft, expected: NotesHtmlSourceDraft | undefined, signal: AbortSignal): Promise<void>;
  remove(expected: NotesHtmlSourceDraft, signal: AbortSignal): Promise<void>;
}
// NotesHtmlSourceDraft
// version:1, scope, target, blockId, revision, contentRevision,
// original:{html,css,javascript}, input:{html,css,javascript},
// sequence:string, stage:'editing'|'applied', part:'html'|'css'|'javascript', composing:boolean
```

`revision/contentRevision`は開始時のcanonical revisionで、input変更によって更新しない。keyはactor/workspace/target/blockId/開始時revision/contentRevisionの組。pageとrowは区別し、旧revisionは別記録として保管。`sequence`は入力/言語/IME/stage変更ごとの新UUIDで、原本revisionやbody operationIdとは別。完全一致のexpectedを単一トランザクションで比較し、undefinedはcreate-only。同じpayloadは冪等。removeはexpected完全一致のみ。listは指定scope/targetの完全なauthorized一覧で、旧block/旧revisionも返す。認証/認可はhost closureが担当する。

共通側はput/remove成功後もlistで完全一致の保存/削除を確認する。例外・不一致・quota・timeoutは移動を止めて同期キャッシュと原rawを保管。結果不明のretryは先にlistを照合し、同じrawが既に保存済みならputを再発行しない。別expectedが見つかった場合は上書き・rebase・削除しない。storage errorは『保存済み』と表示しない。

raw parserは構文解析/正規化/評価せず、各文字列1,000,000文字まで（bounded JSON全体4,000,000文字）を保持する。safe previewの200,000文字budgetとは別。widget Applyは従来preview/sourceの制限で検証する。境界超過時も入力欄とexportは保持し、切詰めない。

hydrationはcontroller.openの一部。本文readと対象journal listを検証後に公開し、非同期read中の入力/IME/cancelは元画面を保持する。復元はsource editorのrawのみ。`composing:true`は履歴データで、新プロセスで実際のIMEを開始しない。復元時の自動Apply/save/JS実行なし。旧revisionはrawを表示するがApplyを拒否。複数旧originalは自動選択せず原recordsを表示/exportできる。

Applyは原sourceと現在block/開始revisionを検証し、ローカル本文だけを更新する。journalは `stage:'applied'` backupとして残す。同じsourceを含むdocument.saveの確認済receiptと、送信前に捕捉した同じraw sequenceの一致を条件にCAS削除する。保存拒否/競合/unknownでは保持し、unknownは既存fixed-ID lookupのみ。Apply後save前に再起動しても入力として復元し、人間が確認する。変更のないApplyは明示discardと同じexact削除経路（本文mutationなし）。

controllerのoptional API: `flushSourceDrafts()`、`retrySourceDrafts()`、`assertLocalSourceCurrent(id)`、`resumeLocalSourceDraft(id)`、`markLocalDraftApplied(id)`、`discardLocalDraft(id)`、`getDraftSessionId()`。既存HTML UIがこれらを利用するためhostから私有cacheを変更しない。direct open + tabbed beforeClose/open/Splitは自動flushとpending入力ガードを使う。custom mode/block/source/close操作は同じcontrollerのpendingEditors/composing/recovery + state identityを非同期前後で確認する。カスタム操作でcontrollerを破棄してガードを迂回しない。

`persistDraft`は互換の明示退避hookとして残す。journal接続時の `persistLocalDrafts()` はsource journalのretryを行う。これは他のローカルeditorの永続化成功を意味しない。raw journalを全辞書上書きで実装しない。HTML以外のlocal draftが残るとpersistLocalDrafts()はfalseを返し、HTML以外まで退避成功とは表示しない。body/canvasのbeforeSubmit/ticket/checked receipt経路とDB rawのregistryを維持し、このjournalにticketやpermissionを入れない。

PA準備版との型差分: `js`→`javascript`、scopeをlist引数に追加、`sequence/stage/part`追加、strict公共parser使用、rowも型として許容（未受入rowへ新grantを与えない）。PA側で独立prepared storeのenvelopeを合わせる。既存.26 UI/DB/旧storeへ混在mountしない。

## 受入単位

未Apply HTML/CSS/JSの exact raw、IME中のinput、input直後のpage/tab/Split/mode移動、raw保存失敗/unknown、restart、2controller CAS、本文save denial/conflict/unknown、Apply後save前restart、旧callback/遅延importを合成専用journalで検証する。PAは接続後、専用hostjournal + 実APIの既存本文経路で別途受入する。物理IME/Safari/touchおよび全#57の完了はこの単位の受入から推論しない。
