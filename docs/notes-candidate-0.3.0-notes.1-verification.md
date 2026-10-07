# 0.3.0-notes.1 検証記録

Macの既存 `open-editor-notes-parity`、branch `codex/notes-parity-0.3`、開始HEAD `6bbaabb`。既存作業・旧 `.0` tarball/manifest を保持。原本、PersonalAI、他worktree、認証・権限・セキュリティ設定は変更していない。費用の発生する実モデル・外部データAPIは呼び出していない。

## 自動検証

| 検査 | 結果 |
| --- | --- |
| workspace `npm run typecheck` | PASS |
| example `npm run typecheck --prefix examples/blocknote-power` | PASS |
| `npm test` | **874 PASS / 0 FAIL** |
| 内訳 | AI 80、BlockNote 512、Canvas 30、Core 57、Publish 25、型export 6、release guards 123、demo state 13、example 28 |
| `npm run build` / example build | PASS |
| `npm run bench:smoke -w @hello-ai-company/editor-blocknote` | 4 PASS |
| `git diff --check` | PASS |
| lint | プロジェクトにlintスクリプトなし。実施済みとは扱わない |

新規テストは、revision ABA、指示変更、接続ready、保存timeout、復旧journalと取消、ACK喪失後の一度だけのcreate、未知フィールドを保つpatch、React対象切替／遅延callback、DB query ABA、再接続epoch、書込後の別view再取得、日常の新規段落/widget保存、メタデータ削除競合を含む。既存の0.3.0-notes.0は853 PASSだった。今回の途中の型cast・新規テストfixture・postwrite追加取得で未解決Promiseを残す旧fixtureの失敗は修正し、最終の全体検証に既存失敗／今回失敗は残っていない。ログは `output/verification-notes1/`。

## 実ブラウザ・使い勝手

Mac上 Chromium **154.0.8037.98**、自分の検証用profile/context、ローカルの合成データで実施。

- 複数選択のJSON編集、無効な選択IDの拒否、Escape取消、繰り返し保存クリックによる重複防止、未知データの保持。
- 保存成功後の応答だけを失わせ、再送をブロックし、操作ID照会で元の保存を確認。
- 実際の2タブで同じIndexedDB文書を開き、先行タブの保存を後続タブが上書きできないこと、後続タブの編集が保持されること、独立した復旧コピーの保存・再読込。
- Document/Canvas/Present/Siteの往復、検索・コマンド開閉、通常編集、AI案の拒否／明示許可／Undo、許可後の人間の変更をUndoが消さないこと。
- 提案が本文・カーソル・スクロールを変更しないこと、合成composition eventで提案を消し入力中の準備を止めること。
- 列操作、HTML/CSS/JS source、無害なプレビュー、JS・通信禁止、取消後の遅延file import破棄、保存・再open。
- 320pxの複雑プロパティ編集、390pxの4モード、Reduced Motion、ページ横溢れなし。

`output/playwright-notes1/notes-contract-browser-final.json`（11 checks）、`document-workspace-browser-final.json`（6 checks）、`quiet-visual-browser.json`（25 checks）とスクリーンショット／CLIログを保存。機密情報・本番データは含まない。favicon 404のみを確認し、アプリ例外としては扱わない。

継続入力は **183.413秒で360回の日本語insertText**。途中の確認済み保存、最終マーカー、再読み込み後の全rich text一致を確認した。`notes-continuous-browser.json`。別にvirtual timerで1000回の日本語本文・文脈更新中に準備を起動しないことをテストした。これは実OSの日本語IME操作、数時間／数日の耐久検証、メモリリークの証明ではない。heap/listener参考値は採取時のDOM状態が違うため、前後の性能比較には使用しない。

## 性能前後

旧候補 `6bbaabb` を一時ディレクトリに `git archive` で展開し、同じ既存キャッシュ依存だけでbuild。新旧とも同じPythonローカルHTTPサーバーで提供（5198／5200）、同一Chromium154、1440×900、Reduced Motion、CPU4倍、各warmup1＋独立context5回の中央値。型検査／build／全体テストの終了後に測定。

| 測定 | 0.3.0-notes.0 | 0.3.0-notes.1 |
| --- | ---: | ---: |
| navigation開始→editor表示＋2frames | 504.7ms | 500.5ms |
| 合成500段落paste→最終marker表示＋2frames | 592.9ms | 604.4ms |
| example最大main JS（build表示） | 1397.01KB / gzip422.36KB | 1399.34KB / gzip423.04KB |

短い5回測定で、editor表示約−0.8%、paste約＋1.9%。一律に高速化したとは主張しない。新しい合成DB検証モジュールは開くまで遅延ロードする。全てのraw samplesは `performance-identical-servers.json`、実行関数は同名 `.js`。`scripts/qa/performance-browser.mjs` のafter portだけ5200へ差し替えた。旧スレッドのChromium144/旧JS1333.58KBなど、条件が違う値と直接比較しない。

途中のVite/Python混在・他検査と同時の測定も `performance-browser*.json` に残したが、同条件の結論には使用しない。今回の保存・安全性API追加があらゆる実データで速度を改善するという保証はない。

## 独立レビューとライセンス

読み取り専用の independent_review がソースから独立メモリ実行し、初期のP1を再現して修正を再確認。最終DB境界 **9 assertions PASS**、追加送信／journal／秘書境界 **11 assertions PASS**。Reactの対象変更と旧callback隔離も確認。対象resource blob `fc189b6`、secretary `03bc5ac`、PropertyEditor `479e574`。新APIの確認範囲に未解決P1なし。レビューagentはソース・共有ブラウザ・旧候補・outputを変更していない。

列・widget・codec・追加APIは独立実装。既存の別ライセンス記録 `docs/notes-parity-license-record.json` を保持し、Notes／BlockNote XLの独自実装をコピーしていない。

## 引き渡しと未確認範囲

候補の説明・public APIは `notes-candidate-0.3.0-notes.1.md`。新tarball、SHA-256、sourceHead、隔離した公開import／型consumer結果は `output/candidate/0.3.0-notes.1/manifest.json` に記録。既存 `.0` tarball／manifestのSHA-256は開始時の値と一致。

**4条件の本番受入が完了したとは扱わない。** このphaseはpackage側の接続契約と合成検証を完成したもの。別作業のPersonalAIは`.0`を受入中で、`.1`の秘書／revisioned writer契約への接続・サーバーCAS／権限／receipt保存は別途必要。旧DB full-row writerとlocal Quiet demoは新契約へ自動接続されない。22プロパティ全種類、未知のdrawing/meeting等の高度なblock renderer、実AIの文脈品質、実Notes・本番同時編集／再接続、実機日本語IME、時間／日単位の耐久、複数デバイス同期は未確認。未公開候補であり公開・push・merge・installは実施しない。
