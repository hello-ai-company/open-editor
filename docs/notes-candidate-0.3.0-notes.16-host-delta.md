# .16 host delta

`.15`のreceipt、per-reader CAS、親invalidate、map/tableは保持した。新しいcanonical writerやhost portは追加しない。

`NotesEditorBridge`に任意の`setSearchQuery(query): { count, capped }`と`focusSearchMatch(index): boolean`を追加。標準NotesBlockNoteDocumentは内部ProseMirror decoration pluginで提供する。既存custom bridgeの実装義務はなく、API未提供時は従来の結果一覧を表示する。focusSearchMatchは整数indexだけ受け付け、lifetime/active bridge/live scope/target/revision/contentRevisionとIMEを確認する。

Sidebar検索の範囲は現在の本文。検索語はtrimし、大小文字を区別しないUnicodeリテラル。block/custom atomを横断しない。結果snippetはReact textで表示しHTMLを実行しない。search離脱/unmountで装飾を解放し、検索のtransactionsはaddToHistory:false。本文更新時だけactive queryを再走査、空queryの通常編集では本文検索を走査しない。

`.15`採用済みのPAに`.16`を無断インストールしない。同版pa-contractに沿ってhost ownerが採用し、元の文書/row本文、scope切替、IME、検索→戻る/Undo/save/reloadと35状態を組み合わせて検証する。完全59/35の未受入と既存保護台帳を維持する。
