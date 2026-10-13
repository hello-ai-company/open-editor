# .17 検証記録

- final4: 型検査、1435 tests、workspace build、example build PASS。lint専用scriptなし。JS syntax/Python AST/git diff --check PASS。
- 最終ブラウザー16 probes: standalone/relations/reference/polish/design/search、database-contracts/database/classic/modes/persistence/flows/widgets/reading、performance-comparison/performance PASS。上記 browser-evidence.json に3つの結果ファイル。
- 単体: 1600/1440/1280/1100/840/720/390pxでhost/layout x0、全幅、reserve0、横overflowなし。drawer focus/閉じる/本文幅、Focus入退、import入力保持、Library戻りの同じwriterを確認。明示hostFrame=referenceのみ268px/84px比較用reserve。
- 新関連表示: 重複・自己・archive・未ロードページ除外、provider返却title不採用、連続クリック/戻る/390px閉じる・再ロード。新移動: 入れ子4方向を同じ親内で移動、子孫とunknownフィールド・元relatedIDsをsave/reload保持。provider遅延/scope/target/revision/unmountの無効化はDOM unitで確認。合成IMEをnative受入としない。
- 元CSS35: 4192値中4099一致・93相違、geometry396相違。前版209を171実不一致/36意図したcontainer適応/2本文条件に分類。116実不一致を修正し、残り55/36/2。意図した差も完全同等と認めない。残実不一致は主にresponsive/splitのrail色・padding・border・shadow。geometry未帰属、欠けたselector/個数不足は一致扱いなし。
- Chrome154,1440x900,CPU4倍,交互15組: .16→.17 ready895→892ms/paste389→386ms、paired中央値-4/-2ms、bootstrap95%[-11,0]/[-5,1]。0を含むため高速化を断定しない。decodedJS2833126→2840362bytes(+7236)。単独5回中央値892/396ms。最初の391/598msは条件/定義が異なり比較不可。
- bundle: main JS1424.51KB/gzip430.59KB、CSS402.17KB/gzip62.70KB。前版1424.43/430.55、401.08/62.54。軽量化を主張しない。
- CSS復旧: notesWorkspace.cssがnotesClassic.cssにほぼ一致(99.82%)する内容へ置換されていた。開始時tracked clean。具体的な書込元/競合の証拠はなく原因未特定。異常内容をnotesWorkspace-before-restoration.css(SHA ae7f47840f65048ae43b03f61bd76c4802fb58a80033104fddbe4d80a06d3605)、.16原本をnotesWorkspace-baseline16.cssとして保全。既知HEAD82f3bce原内容に意図した関連表示2行のみ追加して復旧。reset/clean不使用。他担当由来との断定なし。復旧前ログを最終結果に使わず、復旧後final4/全browserを実施。141保護候補hash一致。
- 最初のrelations browserは閉じる直後の同期DOM判定で失敗した。HTML detailsのtoggle反映を待つ判定へ修正し、最終再検証PASS。比較分類コマンドの誤ファイル名2回は訂正し最終分類生成済。Python py_compileのcache書込はsandboxで拒否されたためAST解析へ切替PASS。

`.17` は元Notesとの全59要件・全35画面の完全移管を意味しない。完全受入は0/59、全CSS同等性は未承認。実Personal AI `.17` 採用、Safari/native macOS IME/zoom/touch/drag、全legacy、Secretary/実AI、restart raw input、remote/offline/authは未確認。既存PA15のsynthetic_subset31・not_connected28は既読の過去証拠であり、PA16/17採用を推定しない。公開・push・マージ・デプロイ・npm公開・実AI・課金・認証変更なし。
