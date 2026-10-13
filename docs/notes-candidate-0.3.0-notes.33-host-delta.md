# .33 host delta

4つの同じ候補バージョンのローカルtarballを利用します。Core ^0.2.0 と既存peerは維持。インストールは今回行いません。

通常のNotesWorkspace classic shellは狭い画面でconfigured icon railを使用します。inspectorPanelsで順序と表示項目を指定し、[]ならツール用の空列を作りません。defaultInspectorPanelは設定済み項目のみ指定してください。hideNavigation=trueではナビゲーション列と起動ボタンを出しません。外部PA shellの左固定枠は別途host側で確認が必要です。

NotesInspectorPropsに optional activePanel, hideTabs と onPanelChange(panel) を追加。引数を無視する既存callbackも利用可能。classic rail向けの制御で、shellの開閉ではwriterをremountしません。独自renderModesでdocumentToolsを外部に配置するhostはそのmount/overlay境界も受入確認してください。

Mantine等のcustom writerは .32の公開sideMenuをそのまま採用:

```tsx
renderDocument={({ editor, editable, sideMenu }) => (
  <BlockNoteView editor={editor} editable={editable} sideMenu={false}>
    {sideMenu}
  </BlockNoteView>
)}
```

12項目は共通handlerの不在ではなく、schema/featuresまたはhost bindingの条件で無効になります。fixtureの?unboundで全12が無効、接続済みで全12が有効になることを確認。live editable/capability/status/IME/pending/recovery/revision/selection/scopeの制限は維持。

|項目|必要な共通schema / feature|host側で必要な接続|
|---|---|---|
|Attachment / PDF|file|media.upload または scoped listCloud|
|Image / Video / Audio|image / video / audio|media.upload または scoped listCloud|
|Unsplash|image|media.searchImages と acceptImage の両方|
|TeX equation|mathBlock / createMathPowerFeature()|presetのfeaturesへ公開math entryから明示追加|
|Mermaid|diagram / createDiagramPowerFeature()|presetのfeaturesへ公開diagram entryから明示追加|
|Synced block|oeNotesSyncedBlock|insertion.sharedBlocksBound、listShared/getShared、preset.resolveSharedController|
|Database / Gallery / Kanban|databaseView|insertion.databaseViewsBound、listDatabases/getDatabase、host.providers.database|

bindingフラグだけをtrueにしても保存先は作られません。DB row mutationは別の .26 tableEditing registry/authorized resource hostが必要。同期本文はshared controllerが唯一のresource writerで、本文canonicalには参照を保存。数式とMermaidのsourceはpropsではなくplain block contentです。native mediaはURL/name/captionを本文へ保存し、attachmentIdをnative propsに追加したとの主張はしません。host資産IDはhost側のasset契約で管理してください。

本候補は独立したローカル成果物です。公開・push・merge・PAへのインストール・実AI/API・課金・認証設定変更は実施していません。既存 .31/.32 と旧成果物・schema29 WIP は保持しています。

NotesWorkspaceModesのDocument panelにdocumentToolsを渡すPAの公開配置経路も、共通fixtureの840/390pxで確認しています。非モーダルoverlayは外側のpointer操作で閉じ、その本文入力のfocusを奪いません。モーダルpickerの操作は閉じる判定から除外。Tabでoverlayの閉じるボタンへ移動できます。PA実画面のbody/gutter/parent rectは採用後に照合してください。
