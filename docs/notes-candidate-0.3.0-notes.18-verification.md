# .18 UI品質の検証範囲

検証は合成データ、ローカルChrome154、API費用0で行った。元のデータ・旧WIP・旧候補は保持。実host backendへのPOSTはブラウザーrouteで遮断し、layoutはisolated contextのIndexedDBだけに保存。

- typecheck、1439 tests（core151/blocknote998/AI30/publish57/canvas25/typeexports6/release123/demo13/canvasdemo36）、all build、example build PASS。lint scriptは存在せず、lint PASSとは扱わない。
- production build5202: standalone/flows/modes/classic/database/persistence/reading/search/relations/widgets/polish/design の12probes PASS。output/playwright/notes18/run-a54cb80e9516。以前のdev5201でのstorage-probe import失敗はdist専用probeをdevで読もうとした実行条件の問題として別ログ保持。
- 四方向Split×2width×3host: standalone5201/installed17実host49290/同じhostsource+isolated共通build5203。横Splitの旧hostはnav display:none、TAG22pxを再現。共通修正後は全4方向nav block、TAG11px/28px。hover遅延/移動/leave、pointer/Tab、dirty activeタブ6回のinput/DOM保持も確認。output/ui-quality/five.json、five-*/png/webm。
- Save未知結果はPOSTをbackend到達前に中断し、GET lookupを使って確認。通常typed/unknown/lookupを含む本文y位置を比較。詳細はoutput/ui-quality/save-interaction.json。
- 同条件CPU4のtool click反復はoutput/ui-quality/embedded-paired.json等。クリック反応を全buttonで完全に滑らかと断定しない。旧391ms/598msとはtest定義・host・build条件が異なるので直接比較しない。

全59機能・全35画面の正式受入、Safari/native日本語IME、実AI/課金/認証/production rolloutは未確認。Chrome insertTextはnative IMEの代替証拠にしない。元ユーザーの旧タブURLと現在49290の一致も未確認。

## 最終比較値（単一の直列実行、一般化しない）

Chrome154、CPU4、normal motion、高さ900、各width6反復。同一hostsource/合成backend、共通installed17を49290、afterを5203で検証。click captureから2回目requestAnimationFrameまでの中央値で、入力全体の遅延・native体感の指標ではない。

| width | 前 median(ms) | 後 median(ms) | 前→後 body width |
| --- | ---: | ---: | --- |
| 1440 | 128.0 | 128.0 | 564→564 |
| 1280 | 152.5 | 129.6 | 418/534変動→534固定 |
| 1100 | 153.6 | 145.5 | 586/702変動→702固定 |
| 390 | 145.0 | 144.4 | 322→322 |

LongTaskはafterでも50/101/59/60msが残った。全ボタンの滑らかさ完成・普遍的速度改善とは判定しない。active Documentを6回押すGETは全widthで6→0、writer removeは前後0。

保存feedback: ready/typed/unknown/lookupの本文yは1440の前422/498.59/566.59/498.59、後494/494/494/494。390の前530/606.59/715.84/629.84、後634/634/634/634。全scrollY0、writer identity保持、backendPosts0。

12themesのdocument active/inactive tabはtheme切替直後も最小6.3:1。dark切替時のwhite-on-whiteを独立レビューが再現し、背景のみのtransitionを除いて文字と背景を同時切替。right Insert/Style/Infoも同じtheme配色へ統一。

example main JS chunkは前後1424.51KB/gzip430.59KB相当、CSSは402.17KB/gzip62.70KBから404.84KB/gzip63.15KB。bundle縮小は主張しない。旧JS1333.58KB・paint391ms・paste598msとは定義/conditionsが違うため比較なし。

独立reviewはoutput/ui-quality/independent-review/FINAL-REVIEW.mdを参照。5201/5203双方でportal search pointer→Tab、非activeSplit選択、hover Escape/移動、390 drawer/desktop復帰、96px長文feedbackのキーボード読取を操作。最終paletteは12themesの切替直後・220ms後、document active/inactive＋right Insert/Style/Infoを24場面で測り、最小6.304:1を確認。独立の長文feedbackは一時DOM表示試験で、rootの実controller unknown/GET lookup試験とは分ける。

最終CSS後のproduction classic/polish/designを再実行PASS: output/playwright/notes18/run-3307643fe3b9。実host standaloneルート（host=personal-aiなし）の1440→390→1440もGET-onlyで検証し、layout x0/width1440（390ではwidth390）、host sidebar0、horizontal overflowなし。固定ページ一覧の744px本文は折り畳みで1064pxへ拡大。output/ui-quality/actual-standalone.json。修正済み合成standaloneプレビュー5203を既存Mac Chromeに新タブで開いた。49290へのパッケージ導入とは区別する。
