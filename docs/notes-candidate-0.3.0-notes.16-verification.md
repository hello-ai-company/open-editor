# .16 verification — local synthetic candidate

最終production sourceはfinal5 build。typecheck-final5 / full-tests-final5 **1,416件（.15比+22）** / build-final5 / example-build-final5 PASS。専用lint scriptなし。QA node --check、Python構文、git diff --check PASS。500kB chunk警告は既存課題として残り、軽量化を達成したとは主張しない。

前回検証の訂正: `.15`の最後に追加した2 DOMテストの後でtypecheckを再実行しておらず、テストfixtureのreadonly DatabaseFilter[]→JsonValueにTS2345が残っていた。`.16`でJSON正規化した。製品build/installed consumer型検査と1,394テストのPASSは有効だが、`.15`最終ソース全体のtypecheck PASSという記述は訂正する。旧artifact/docsは変更しない。

通常編集・繰り返し操作・Undo・Close/Cancel/Escape・戻る/分割・長文・狭い画面・Reduced Motion・保存/reload・合成AI拒否/承認/取り消し、既存map/table/CAS/receipt/親refreshを最終ビルドで再検証した。本文検索はmarked text/literal punctuation/snippet/Enter/Shift-Enter/IME query/index/selection/focus保持、本文・Undo不変、500 blocks/390px、検索中floating toolbar非表示を確認する。native IMEと合成イベントは区別する。

35状態: 4,192対応CSS値の一致3,983・相違209（.15の387より178減）、未帰属geometry396（.15の412より16減）。missing selector165記録とcount mismatch2記録を一致と数えない。完全画素/CSS受入0/35。

## 性能調査

旧単独run .14 880/363ms→.15 896/383ms（ready/500-block paste）をそのまま確定した回帰としない。正確な2 source snapshots/package artifactsを別tempへ展開・同じキャッシュでexample buildし、JS/CSS hashed asset名・bytesが旧build記録と一致することを確認した。共有core/canvas/publish sourceに差がないことも確認。旧checkout/artifactsを改変しない。

同じChrome154.0.8037.98、1440x900、CPU4倍、single browser、1 warmup/version、3rounds×5pairs、AB/BA交互の15組を測定。表示はnavigationStart→editor可視後2frames、貼付はpaste event→2frames。旧391/598msとは定義・環境が異なるため直接比較しない。合成標準routeの測定で、実PA/map/native workloadの関数別profileではない。

| exact version | ready中央値ms | paste中央値ms | paste Scriptms | Layoutms | Stylems | decodedJS bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| .14 | 891 | 387 | 308 | 52 | 17 | 2811244 |
| .15 | 891 | 384 | 306 | 51 | 17 | 2828357 |

paired中央値deltaはready0ms/paste-2ms、seed固定5,000bootstrapの記述区間[-5,3]/[-5,1]は0を含む。旧低下は再現せず、時間ばらつきは考えられるが元の原因を断定しない。JS decoded17,113bytes増加は実測事実。CPU貼付はScript約306msが主で、Layout/Styleは51/17ms程度。関数単位の因果や高速化はこの計測から主張しない。受付ガード・receipt・回復・受入条件を削除していない。

再現: `output/verification-notes16/benchmark-builds.json`のexact frozen .15 exampleをloopback5198、final .16を5199でpreviewする。Node22.14.0と既存cached CLIを使い、`python3 scripts/qa/notes-workspace-browser.py --cli <cached playwright-cli.js> --candidate notes16 --probe performance-comparison --comparison-versions 15 16`を他のbuild/test/browser負荷無しで実行。14/15ならgit archive e6fccd077aa29019280ac877f31d8f90568e2872 / 183cf768ce5cae55e972c169ab5c9731d9065c0aからexamplesをtempに展開し、同版tgzのblocknote/ai dist・不変のcore/canvas/publish dist・既存依存cacheを使って同条件buildする。インストール/公開/実APIなし。

## 範囲と証拠

PA .15 host owner報告はAPI148/Web477/Chrome102/build PASS_SCOPED、synthetic_subset31/not_connected28、full59/35=0、original Journal UI未mount。これをOE .16の実PA採用と混同しない。全59/35残件の分類はnotes-remaining-work.mdと同版acceptance JSON。機能不足/外観/host/環境は重複する。

旧候補/package/docs/WIPの67保護対象はSHA256一致、変更0。PA sourceはread-only。独立レビューは同一turn IME/scope/target/read revision fenceとnative search Escape default、toolbar重なりを指摘し、source/回帰を修正した。旧失敗runは保持し、後述最終runだけをPASSとして数える。

未確認: 実PA .16、native macOS IME/Safari/zoom、全original59/35、24 cover/upload/emoji、全unknown legacy/row body/schema/CRUD/nested drain、restart-durable raw input、実Secretary/provenance/partial adoption/保存済みUndo、remote/offline、本番認可。API費用0、公開・push・merge・deploy・新認証・料金設定変更なし。

最終ブラウザー証拠:

- `output/playwright/notes16/run-a351ccbb1a96/results.json`: search/reference/standalone/polish/design/database-contracts/database/classic/modes/persistence/flows/widgets/reading、13 probes PASS。
- `output/playwright/notes16/run-1407d5c2929d/results.json`: performance-comparison/performance、2 probes PASS。合計15 probes。全通過probeでpage errors0、外部通信0、API費用0。
- 最終search-literal.pngを独立目視し、書式popupが消え、本文とsnippetの一致が見えることを確認。

同条件交互15組の最終 .15/.16 比較はready902/895ms、paste390/391ms。paired差中央値は両方0ms、記述bootstrap区間ready[-7,6]/paste[-5,6]。paste CPU Script310/309、Layout52/52、Style17/17ms。decodedJS2,828,357→2,833,126（+4,769bytes）。この条件で速度悪化を確認せず、高速化/軽量化や統計的同等性の証明とはしない。単独5回の .16 中央値895/389ms、503 blocks/320pxもPASS。比較表の過去14/15値は別runの測定であり、15の891msと今回902msを連続した回帰と扱わない。

最終bundle: main JS1,424.43KB/gzip430.55KB、optional Notes1,334.70KB/gzip362.56KB、main CSS401.08KB/gzip62.54KB。新しい検索はempty queryで通常編集の全文検索を走査しないが、転送量の増加は残る。

全raw samples/CPU/条件はperformance14-vs15.json / performance15-vs16.json / performance-single16.json、frozen stage/build条件はbenchmark-builds.json / benchmark-build14.log / benchmark-build15.log。途中のfixture cursor/IME default/ambiguous status locatorによる失敗runは保持し、完成runのPASSで上書きしない。
