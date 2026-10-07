# 0.3.0-notes.2 HTML codec 回帰検証

開始HEAD `23a5efca193d2f0bcaa9dbe0b453c907d8e791fc`、既存 `open-editor-notes-parity` のみ変更。PAが報告した「data=new/body=old」「body-onlyのHTMLが空」「新規body欠落」を共有codecで修正。PA側の固定`.1`テスト（`candidate-notes1-contract/codec-contract.test.mjs:26`）は旧挙動をassertする既存受入記録のため読み取りのみとし、こちらの回帰・隔離consumerでは期待を同期済みの正しい挙動に設定した。PAソースは編集していない。

最終コードの集約検証：

| 検査 | 結果 |
| --- | --- |
| workspace / example 型検査 | PASS |
| `npm test` | **884 PASS / 0 FAIL** |
| 内訳 | AI 80、BlockNote 522、Canvas 30、Core 57、Publish 25、型export 6、release guards 123、demo state 13、example 28 |
| workspace / example build | PASS |
| `git diff --check` | PASS |
| lint | 既存プロジェクトにスクリプトなし |

`notes-html-compatibility.test.ts` の9回帰ケース＋`document-editor-roundtrip.test.ts` のnative BlockNoteケースで、両type alias、data文字列／object、body-only、data.html空文字優先、不一致の無編集保持、title-only保持、CSS-only dataでのfallback、新規出力、12回反復roundtrip／編集、未知current metadata保持、隠れた同時body編集の拒否を確認。任意JSはデータとして保持し、プレビューのscript/network禁止を維持。`.1`の874 testsから10ケース増えた。最終の既存失敗／今回失敗はない。

実行ログは `output/verification-notes2/`。新候補の公開runtime import／型consumerも、報告された編集同期・body fallback・新規body出力・未知data保持を補完なしで確認する。結果／sourceHead／SHA-256は `output/candidate/0.3.0-notes.2/manifest.json`。再packで既存destinationを上書きしない。

旧`.0`／`.1`のtarballとmanifest、計6ファイルは開始時SHA-256と一致。記録は `output/verification-notes2/protected-artifacts.json`。既存の列・依存ライセンス記録、JS実行禁止、公式0.2 manifestsを保持。今回の変更は13行の共有codec差分と回帰／consumer／契約説明に限定し、独立列機能を変更していない。

このfocused codec検証は実モデル・本番Notes接続・実機IME・長時間耐久の新たな受入を意味しない。API費用・認証変更・インストール・push・公開・merge・deployは実施しない。hostは新`.2`artifactを隔離して取り込み、`notes-candidate-0.3.0-notes.2.md` の優先規則とbody競合／revision CASを適用する。
