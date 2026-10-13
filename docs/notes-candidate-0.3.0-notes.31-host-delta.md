# .31 host接続の具体的差分

root export: createDocumentCoeditingSession、DocumentCoeditingPort/Ticket/Proposal/Policy/Review/Result/State/Options/Identity/Editor。notes export: notesDocumentEditingAvailable。react export: NotesCoeditingOptions、NotesEditorBridge.coediting。

NotesWorkspace／NotesBlockNoteDocumentへ optional `coediting={{paneId,onReady,autoPolicy?}}`。NotesTabbedWorkspaceへ optional `coediting={({paneId,target})=>({paneId,onReady,autoPolicy?})}`。readonly重複targetのpaneにはportを出さない。renderDocumentのbridge.coeditingからも同じportにアクセスできる。通常のfeature構成は3extensionsのまま、必要なwriterだけ公開registerExtensionでcoediting pluginを一回登録、unmountで失効する。内部DOM書換え／私有editor登録APIは新規利用しない。公開PM Decorationとtransactを使用する。

hostはonReadyでpane別のportを受け取り、undefined時に破棄する。capture({blockId,from,to})のoffsetは一つのtextblock内のUTF16位置、返るticketは取得時のoffset/epochを含むopaque local lease。offer(ticket,syntheticText)が許可したProposalだけを表示する。apply(proposal,{mode:'reviewed'})がexplicit確認経路。自動はautoPolicyでactor/workspace/document/pane/session、id/version、wording/continuation、source/output文字数上限を明示し、applyにも同じpolicyId/policyVersionを渡す。ラベルだけではauto-safe許可にならない。言い換えの意味・新事実・引用・数値・instructions分類はhostが保証／reviewする。

Stopは未適用のticket/ghostを失効、適用済み本文を自動復元しない。Resumeはfresh request epoch。UndoはoperationId単位。重なった入力はResult.reviewとstate.reviewIdsを使って差分を示す。undoIdsは現状で範囲照合を通せるlocal batch。Undo/Dismiss後にsource/output digestが同じ提案を即再適用しない。

onAppliedは既存controller.setDraftへ同じeditor.documentを同期投影するだけ。canonical submissionは既存controller.save／host.commit、同じimmutable operation/revision/receipt/lookupの経路。ローカルcoediting operationIdはcanonical save operationIdやサーバー承認receiptではない。新endpoint／並行proposal-adoption writer／provider接続は追加しない。

保存中のlocal body入力は自身のdocument.saveのscope/target/revision/contentRevisionが一致する場合のみ継続。unknown/conflict/denied/resource commandでは既存の保護を維持。AI apply/Undoはready、rawなし、manual merge/recoveryなしのlive状態を要求する。canonical receiptが返っても、後続draftを丸ごと置き換えない。
