# .15 verification — local synthetic candidate

検証済みのproduction sourceはfinal7 build。typecheck-final6 PASS、full-tests-final7 PASS **1,394件（.14比+49）**、build-final7 / example-build-final7 PASS。専用lint scriptは存在しない。変更したQA moduleのnode --check、git diff --check PASS。buildの既存500kB chunk警告は残る。

最終ブラウザー証拠:

- `output/playwright/notes15/run-9154c960bdd3/results.json`: database-contracts / polish / database / reference / design PASS。
- `output/playwright/notes15/run-845a1ddc8143/results.json`: classic / modes / persistence / flows / widgets / reading / standalone PASS。
- 同条件1440x900/CPU4倍/5回の中央値は .14 880ms / 363ms → .15 896ms / 383ms（表示 / 500-block貼付）。単独runで測定し高速化を主張しない。元の391ms/598msとは計測定義が異なる。性能の単独runと前後値は `output/verification-notes15/performance.json`。
- JS main 1,424.40KB/gzip430.53KB、optional Notes 1,329.97KB/gzip360.98KB、CSS main400.58KB/gzip62.46KB。軽量化の達成は主張しない。

全13 probesの一覧は `output/verification-notes15/browser-evidence.json`。支払API 0、通過したprobeの外部通信0、page errors0。

通常編集・Undo・繰り返しクリック・Escape/Close/Cancel・戻る/分割・長文・Reduced Motion・狭い画面・保存/reload・合成AI Reject/Replace/承認/Undoを既存QAで再検証した。新contract probeは閉じた表行72.1875px、原location JSON展開、4近接点の全行選択、lost ACK lookup-only、再起動reconciliation、terminal失敗の原入力比較/Cancel保持/明示最新採用、IME中の適用拒否、次の設定保存、row更新→clean親の再読込、390px overflow無しを確認した。

独立レビューで並行read、読込中Canvas作成、独立writer baseline/error、terminal復旧、pending/IME、provider/store交換を指摘され、ガードと回帰を追加した。レビューartifactは `output/verification-notes15/independent-review.md/.json`。

35 CSS statesは4,192対応値中3,805一致、387相違。`.14`の656から269減少した。座標相違は396→412で16増加。missing selector/count mismatch/host枠/本文差を一致扱いしない。完全CSS/画素一致は未受入。各値は `output/verification-notes15/css35-comparison.json/.md`。

途中の失敗を保持している: 最初の停止済みpreview、旧menu検証失敗、途中sourceの復旧DOM/表示更新待ち/390 wrapper幅の失敗。修正後の上記完成runだけを最終PASSとする。旧失敗run全体をPASSとして数えない。

保護台帳59ファイルのSHA256一致、変更0 (`output/verification-notes15/preservation.json`)。PA sourceはread-only参照のみ。PA .14 ownerのAPI139/Web477/Chrome88/buildの限定受入はhost報告であり、OE .15を実PAへ組み合わせて検証した証拠ではない。

未確認: PA .15 adoption、全59ワークフロー、35画面完全一致、24 cover presets/upload/emoji、native macOS IME/Safari/zoom、実Secretary/課金/provenance/partial adoption、全CRUD/schema/nested writer drains、unknown legacy全形式、ブラウザー再起動をまたぐ生入力保持。controller-local rawcacheはdurable recovery journalと別物。旧UI削除/push/merge/publish/deployは行わない。
