# .33 → .34 host delta

- `NotesInsertionHost.onCreatedPageReady?(context): void | Promise<void>` を追加。context は page, scope, parentTarget（kind:page/pageId）, parentRevision, parentContentRevision, signal。committed の page.create receipt と親 childPage 参照の committed save の後、同じ session/scope/parent・本文・保存状態・未確定入力を確認してから呼ぶ。ホストは同じ pane で新ページを開く。未設定なら従来の未保存参照挿入のみ。失敗/unknown/pending/cancel では遷移しない。callback 例外時は保存済みページを保持して案内する。
- `NotesMediaScope.placement?: before | after` を追加。標準 bridge は before を尊重する。既存 callback 呼び出しは互換。
- `NotesEditorBridge.insert` の options に `html?: { empty: boolean }` を追加。未指定は Modern。標準 NotesBlockNoteDocument の pointer/caret 位置捕捉にホスト callback は不要。
- pageCard props.presentation は modern/simple、childPage は modern/simple/link。省略時 modern。別の canonical carrier を使うホストはこの enum の保存・読取を追加し、参照先・未知 metadata を保持する。表示形式はページ内容や参照 ID の書換えではない。
- 独自 bridge / insert editor は、挿入結果を controller.setDraft へ同期発行する従来契約が必要。noop callback の成功通知は廃止。asset insertion も本文変化を確認する。
- Columns の列移動ハンドルは options を開いたときに表示。個別本文ハンドルは Alt+Shift+M。構造ブロックの重複 native side menu は表示しないが、本文ブロックの native メニューと slash は保持。

この SDK の導入、PA の画面フレーム・通常 Synced/DB 接続・carrier・実際の navigation はホスト側の受入が必要。候補を盲目的に依存更新しない。
