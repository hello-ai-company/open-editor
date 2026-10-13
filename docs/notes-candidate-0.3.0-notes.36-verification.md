# .36 検証記録

Source/型/全テスト/root build/example build/git diff checkの最終logはoutput/ui36。lint scriptは未提供。Chrome154.0.8037.99、合成local文書、通常mouse/keyboard、Reduced Motion、1440x1000と390px。selection17・commands16・insert23・coediting14・tabbed4の最終JSONを参照。追加辞書/IME/権限fenceの最終再試験はbrowser-complete。外部/HTTP mutationは遮断し実AI・実PA API・課金は使わない。

実測clickはpointerで文字を選択後、入力クリックとkeyboard strokeを除外。保存権限とsynthetic serviceを接続した旧 .35 design workbenchと新 .36 fixtureでAI/コメントを測定。文書/frameは異なるためpaint性能比較ではない。本文復帰は同じ3日本語段落fixtureで比較。

| 操作 | 旧 .35 | .36 |
| --- | --- | --- |
| 太字単独 | Bold:1 | 太字:1 |
| 太字→本文で⌘Z | Bold→本文click→⌘Z:2click | 太字→⌘Z:1click |
| コード挿入 | 対象hover + →コード:2 | 選択元の挿入→コード:2 |
| selection AI既定改善を反映 | AIで編集→生成→選択範囲置換:3 | 同じ確認を保持:3 |
| comment保存 | コメント→追加:2 | 同じ保存確認:2 |
| existing host reviewへ選択転送 | 旧選択入口は未接続、架空の旧数値なし | AI提案:1 |

selection surfaceは旧native + actionsの2→統合1。書式・comment・AIの必要な保存/生成/採用確認は減らしていない。未接続説明は1click、toolbar上のbadgeにも状態を表示。F8/←→/Escape、閉じる保持/明示cancel、comment composer700ms後、AI拒否・承認・Undo、selection stale、request binding/revision/permission変更、IME simulation、long/保存/狭幅を確認。

初回failはoutput/ui36に保持。native button focus、Mantine toolbar focus trapとのF8干渉を修正。検証fixtureのcomment receipt/evidence/createdAt不足、selector重複、baseline挿入位置assert、初回Node optional math CSSのinventory probe失敗を区別。最終合格JSONと最初のlogを混同しない。

CSSは同Python gzip(mtime=0)のpower.css前後をoutput/ui36/performance.jsonへ記録。CPU/editorpaint/paste同条件前後は未計測、旧Chrome144の391/598msと比較しない。既存500KB chunk warningは残る。devのsymlink外KaTeX fontsはallow-list拒否があり字形品質未確認。security allow-listを広げずproduction build assetsはbundle済み。

実macOS IME候補確定、Safari、実touch、実PA採用/canonical durabilityは未検証。touchはcoarse pointer44pxの設計のみ。旧候補/WIP1948ファイルをSHAで保護し包装後再確認。4tgzのSHA/sourceHeadと取り出したconsumer .8〜.36型/実行はmanifestが確定結果。preflight新APIの型/実行もlocal pass。
