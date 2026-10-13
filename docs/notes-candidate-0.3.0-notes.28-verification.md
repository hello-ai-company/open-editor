# .28 検証範囲

Chrome154.0.8037.98、独立合成プロファイル、外部通信／API書き込みなし。原本・既存PA trial・凍結.27/.26は保持した。

型検査・全workspaceテスト・build成功。Vitest1425＋Node142＝1567件、BlockNote1116件。通知の同時error/unknown/退避・success終了・memory-only/stale保持、owner無しinvalid修復の4テストを追加。lint script/configはこのrepositoryに無く、git diff --checkを実行した。

共通before .27／after .28を同じ本文・HTML srcdoc・割当幅・読み込み済みInterで比較。1440×900 standalone／同幅Split／390×900、DPR1・light・en-US・Reduced Motion。30撮影の15組すべて本文SHA/srcdoc SHA/幅一致。rootはx0で全幅、本文744px／各476px／322px、本文16px。短入力6条件で本文とheaderの矩形変化なし。afterでは退避ボタンが現れると通知dockが39px上へ動くinput関連のlayout-shiftが3件観測された。本文のshiftではなく、通知とボタンを重ねない配置変更として記録する。FPS・旧CPU4倍計測との比較はしていない。

`output/ui28/acceptance-fixed/result.json` の19条件成功、error/write/external0。Codeはnative-last/shared-last・light/darkでafter約18.10:1、before shared-last約1.43:1。390px labelの視認、Favoritesへのpointerとkeyboard focus、Escape/Enter、同時通知の矩形、退避download内容、成功終了、持続error/conflict、layout-error＋body-unknown、固定mock operationの照会1回・再送0、Close拒否、invalid修復の発見性を確認した。tool hoverは6条件で画面内・離脱後閉じることを確認。

回帰: HTML durable14、DB table durable18、native Code copy/paste21、5widget/DB操作9、native widget入力とtouch emulation4。コピーはheadless Chrome内のnative key＋実pasteであり、PAのOS clipboard受入とは別。Math/Diagram/Code・Columns・Drawing・HTMLの入力と操作を含む。

既存HTML/cardの通常操作は安定待機とkeyboard手順で10条件成功。追加のrapid2条件は不達の観測とkeyboard回復を確認した診断で、pointer合格ではない。desktop4/10・390px8/10のpointer到達だった。元のheaded試験ではnarrowのsave待機・後続source取得・後続rapid操作の3条件が失敗し、.27に保存された既存試験にも同じ失敗名がある。失敗結果を削除せず、既存課題として残す。全12／全操作の完全合格とは表現しない。

Safari・physical touch/native IME・OS clipboard・全CSS35／全59項目・clean iframe focusの新受入はなし。既存.27のfast input制限を解決した主張なし。PA実hostの.28受入は未実行。再現fixture・全試行JSON/画像/ログと凍結一覧は `output/ui28`。
