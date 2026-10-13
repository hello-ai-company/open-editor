# .35 host contract

NotesDocumentRendererはoptional `slashMenu?: ReactNode`を追加します。HostDocumentViewは同名propを追加して転送してください。

```tsx
renderDocument={({editor, editable, sideMenu, slashMenu}) => (
  <BlockNoteView editor={editor} editable={editable} sideMenu={false} slashMenu={false}>
    {sideMenu}{slashMenu}
  </BlockNoteView>
)}
```

標準SDKrendererは設定済み。独自rendererが新childを無視する場合、+は旧挙動を保ちます。新slash controllerと標準slashを二重にmountしないでください。旧NotesのDB作成関数をfallbackとして移植しないでください。

NotesEditorBridge.requestInsert?(kind,signal,options?: NotesInsertOptions)は共通HTML/表の選択と既存insertを扱います。insertは明示option指定の直接操作として維持。NotesInsertOptionsは従来table/anchor/htmlとoptional replaceEmptyBlockIdを持ち、空paragraphは成功時のみlocal writerで除去。非空文字は保持されます。独自の旧bridgeは互換fallbackを維持。

公開notesInsertionCommands(bridge,language)は共通23挿入catalogをfeature/host bindingでfilterし、英日labelと検索aliasを返します。NotesSlashMenuControllerはBlockNoteViewの子。共通gutterをDocumentSideMenuControllerとして使用する場合、旧native sideMenuを無効化してください。

.34 onCreatedPageReady callback・scope/CAS/receiptに変更なし。親本文参照の保存完了・live session検証前にnavigationしません。未知/拒否/取消/新入力時は作成済みIDと本文を保持します。

親ホスト側の検索・ページ一覧・言語・承認レビュー・gallery row open・全幅frameとcanonical DB採用はSDK単独合格の範囲外です。本人は「データベース」がエディターの下にあったと回答しました。現URL未特定なのでcanonical databaseViewを削除せず、ホストに別mountされた領域を先に確認してください。

Personal AIのsource/data/API/configは読み取りのみ。ホスト側checkoutを変更していません。

Optional readonly bridge.commandsAvailable is a live gate for slash/+: composition, retained input, save and recovery disable commands immediately. Host callback changes are unnecessary. Non-text + offers insertion without formatting a different caret block.

Non-text + has no query caret. The SDK opens a small searchable chooser from the same 23 insertion commands and holds the widget anchor/session explicitly. It does not insert a phantom paragraph or reuse another text caret. No additional host hook is required.
