# .32 verification

最終受入: root typecheck / example typecheck / root1602tests（Vitest1460 + Node142、BlockNote1151、新規5）/ root build と最終BlockNote build / git diff --check PASS。lint scriptは未設定。既存単体テストの失敗なし。private SDK viewやbody DOMの改変、real provider/API、費用、外部本文、公開、push/mergeなし。

Chrome154.0.8037.99、ローカルVite127.0.0.1:5244、合成データのみ。最終85条件PASS。実マウス、通常click、Keyboard、native editor、ローカルcodec/IndexedDB、synthetic receiptsで検証。pointercancel/blur/IME故障は明記した合成イベント。POST/外部通信をQA routeで遮断。

| 範囲 | 条件 | 証跡 |
| --- | ---: | --- |
| resize/gutter/ghost | 20 | output/columns32/resize-final/result.json |
| .30 Columns移動/追加/空列/Undo/保存/狭幅 | 15 | output/columns32/movement-accepted/result.json |
| .31 共同編集/入力/保存/Undo/late/IME/unknown/conflict | 14 | output/columns32/coediting-final/result.json |
| 2paneとduplicate reader、port lifetime | 4 | output/columns32/tabbed-final/result.json |
| HTML durable/source/ACK/restart/input | 14 | output/columns32/html-regression/result.json |
| table durable/ACK/unknown/conflict/raw input | 18 | output/columns32/table-regression/result.json |

resizeのpreview中にbody JSONが不変、確定は隣接2列のみ、他列・全ID・子本文不変。Undoは直前2propsを一回で戻し、人間の直前入力を保持。96px又は短い行の1/4にadaptした最小幅と0.1..10のcodec bounds。5/6列の3・2列折り返し、最後の部分行、nested、390stack/overflowなし。click下閾値/Escape/pointercancel/blur/scroll/同時document変更/read-onlyを保護。保存reload一致。列移動proxy、native menuのDelete+Undo、native＋のmouse/keyboard/nested対象を確認。本文幅はgutter表示前後で不変。Reduced Motionと長い提案でfocused row不変、入力継続、review ghostは保持。

初期失敗証跡は保存。最初のpack consumerは古いDocument拡張数3を要求したため失敗し、.32だけ4を要求する検証に訂正。失敗tarsはfirst-packへ保全し、最終manifestの候補だけ採用する。連続キーでrAF前の古いwidthを使う不具合は最新public block propsを参照して修正。SideMenu capture phaseでunfreezeがnative actionより先行する不具合をbubble phaseへ修正。nested target/重なりはpublic store + writer-owned portal identityで修正。閉じたnative参照は表示中のmenu targetとは別で、隠れた参照を一致させるassertではなく表示中target、実Delete/Undo、popup closeを確認。new boundary上のhoverでも本文外group menuをクリックできるhit areaに修正。自動scrollがドロップ先を動かす場合は実ポインタで新位置を追い、強制dropやmove APIで置換していない。

shared power.css .31 174562/gzip27146 → .32 176449/gzip27440、+1887/+294bytes。同じartifactをPython gzip mtime=0で測定。旧JS1333.58KB/CSS292.16KB・CPU4倍paint391ms/paste598msとは異なる条件なので比較しない。速度timing未計測、軽快さの数値改善を主張しない。

.31/.30/.28/.27/.26凍結とschema29 WIP計1028ファイルSHA一致。PA5501/5491等の既存プロセスや別worktreeを操作しない。独自Vite5244は終了時停止。

再現: Node22、npm run build後、examples/blocknote-powerでloopback専用Vite。OPENEDITOR_PLAYWRIGHT_PATHを既存personal-ai-notes19-host/node_modules/playwrightへ、OPENEDITOR_QA_ORIGINをloopbackへ、OPENEDITOR_QA_OUTPUTを新規専用フォルダへ指定してscripts/qa/verify-{columns-resize,columns-movement,coediting,coediting-tabbed,html-durable,table-durable}.cjsを実行する。凍結証跡を書き換えない。

worktreeのsymlinkに由来するローカルKaTeX fontのVite serving allow-list警告は残る。数式fontの見た目を本UI受入として主張せず、serving/security設定は変更しない。

未確認: PA実canonical/approval/audit/receipt/fixed-ID/retry、post-dispatch newer draftやAI Undoのprocess-crash durable recovery、Safari/physical touch/native IME、real provider。左余地110px未満では重複のcustom move proxyを隠すためnative gripが主操作。legacy native DragEventのheadless timeout、旧rapid HTML/clean iframe focusの限界を継承。固定AI欄除去・全幅のPA host報告は別受入であり、この共通候補の検証へ合算しない。
