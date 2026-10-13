# .32 host delta

同一候補の blocknote/ai/canvas/publish の4ローカルtarballを使う。既存Core ^0.2.0、BlockNote0.54.2/React peerを維持。インストールや公開はこの作業では行わない。

Document workspace featureに公開PM pluginによる境界resizeが追加され、拡張数は3→4。createDocumentWorkspaceFeatureの採用が前提。構造は2..6列、widthは0.1..10、gapは既存値。public DocumentColumnsAction に resize-pair が追加され、documentColumnResizeWidths(left,right,pairPixels,deltaPixels) をrootからexport。純粋操作は隣接関係と構造を検証する。UIはpair totalを維持。codec、保存transport、body schemaを変更しない。

通常のNotesBlockNoteDocumentのraw writerはgutter controllerを標準採用。hostでMantine等のBlockNoteViewを指定する場合は公開renderer contextのoptional sideMenuを子に置く。

```tsx
renderDocument={({ editor, editable, sideMenu }) => (
  <BlockNoteView editor={editor} editable={editable} sideMenu={false}>
    {sideMenu}
  </BlockNoteView>
)}
```

直接BlockNoteを組み立てるhostはReact entryのDocumentSideMenuControllerを同じ位置に置く。既存rendererがsideMenuを無視してもAPIは壊れず、従来のSDKメニュー表示を保持するが新gutterは採用されない。例のNotesWorkspaceWorkbenchと合成fixtureは採用済み。

公開SideMenu.storeを正しいhover blockに合わせるだけで、SDK内部viewや本文DOMは書き換えない。pointerleave/メニューcloseでfreeze所有を返す。paneごとのowned portal identityを使用し、他paneのボタンを移動しない。左余地が小さい時に隠れるのは重複の独自move proxyであり、native grip/＋や列semantic handlesは保持する。

共同編集接続は .31 の coediting={paneId,onReady,autoPolicy?} / tabbed coediting callback のまま。ghostを隠してもport.read().ghostはreview用に保持。hostには空の固定AI欄を作る理由はない。PA固定欄除去と単独OpenEditor全幅はhost側の別変更であり、この候補の採用をもってPA画面反映済みとは扱わない。
