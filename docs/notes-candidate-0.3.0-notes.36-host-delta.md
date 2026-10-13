# .36 custom renderer / 言語 / review接続

`NotesDocumentRenderer`にoptional formattingToolbar?:ReactNodeを追加。既存sideMenu/slashMenuと同様、native defaultを無効化してshared childをmountする。SDK標準rendererは設定済み。old rendererが新childを無視すれば旧native toolbar + separate actionsで互換を維持。構成を一緒に採用して二重mountしない。

```tsx
renderDocument={({editor,editable,sideMenu,slashMenu,formattingToolbar}) => (
  <BlockNoteView editor={editor} editable={editable}
    sideMenu={false} slashMenu={false} formattingToolbar={false}>
    {sideMenu}{slashMenu}{formattingToolbar}
  </BlockNoteView>
)}
```

`notesEditorDictionary(locale?)`をnotes entryで公開。`createOpenEditorNotesPreset({host,config,dictionary?})` と `NotesTabbedWorkspace dictionary?` でhostの明示翻訳をconstructorへ渡す。`preset.editorOptions({dictionary})`のper-editor overrideが最優先。標準辞書をmutateしない。設定はeditor生成時に固定されるため、言語切替時は既存writerの入力/保存guardをhostの通常lifecycleで守る。

`NotesWorkspace`/`NotesTabbedWorkspace`/`NotesBlockNoteDocument`に optional selectionProposal:NotesSelectionProposalEntry。`open({selection,signal,isCurrent})`は既存reviewを開くことのみ。選択ticketにactor/workspace/target/revision/contentRevision/blockId/text/idがある。hostは対象・scope・権限を照合し、isCurrentを入力使用の前とasync wait後に確認。生成・保存・採用をopenから自動実行しない。callback identityをstableにし、async open中の重複clickはSDKがsingle-flightにする。PromiseはUIのopen完了/closeなどhostが責任を持ってsettleする。void return時、開いたUIのidempotenceはhost側。

既存selectionAIを同時に渡せば選択文のserviceを優先。未接続はbadge/説明で明示。document.save権限がない場合capture/host callbackを呼ばない。comment.add欠如は理由だけ、semanticsを合成しない。既存proposal?:ReactNodeとQuietCooperationCard/NotesProposalRailで入力停止時のhost block提案を表示できるが、selectionProposalやtext-only coeditingをblock patch transportに流用しない。

selectionの挿入は既存requestInsert + captured blockId/after。cancel・selection/body変更・IME/pending/recoveryで更新を止める。既存inline/text/Column IDs、canonical body、provider保存経路、HTML source journalを維持。
