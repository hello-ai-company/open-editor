# .30 検証

Node22.14.0、Mac Chrome154.0.8037.99。専用worktree／127.0.0.1:5242でsynthetic fixtureを起動。実データ／実PA API／実AIなし。公開・push・mergeなし。

Columns実画面15/15: 全体移動、列reorder＋Undo/Redo、内容の別列／外側への移動、2→3→6と上限、空列へのdropと入力、Alt矢印反復／focus、微小click／Escape、cycle／wrapper越境拒否、widget移動と内部描画／HTML raw保持、並行文書更新時取消、保存／reload同一、nested、merge／最小2、390px Reduced Motion、readonly。移動は通常mouse down/move/upで検証し、強制click・合成DragEvent・直接移動コマンドで成功へ読み替えない。公開undo/redoとsynthetic保存読取だけfixture APIを使用。

回帰66/66: 既存widget/DB9、native入力とtouch emulation4、HTML durable14、table durable18、headless native Code copy/paste21。HTML/DBにはbrowser process restart、unknown ACK固定GET／再送禁止、CAS競合、raw維持、cleanup失敗、長文、狭幅、合成IMEを含む。copyは実keyとtextareaへのpaste、PA OS clipboard受入とは別。

全体型検査・example型検査・全テスト・buildを実行。全テスト1577（Vitest1435＋Node142、BlockNote1126、新規10）。lint scriptは未設定、git diff --checkを実行。結果ログはoutput/columns30。isolated consumerは4個のローカルtarballで宣言／runtimeと既存.24〜.28の契約を確認する。

同じ共有power.cssをgzip level9で比較: .28 171130bytes／gzip26695 → .30 174346bytes／gzip27115（+3216／+420）。アプリ全体のJS/CSS bundle・旧CPU4xのpaint/paste時間とは別条件で、性能改善の数値主張はない。pointermoveごとの文書cloneは避けている。タイミング比較は未実施。

最終15/15前の失敗試行も保持する。attempt1はbuild/HMRの混在とlocator／emptychildren想定、attempt2はmenu／anchoring、attempt3はAdd直後menuがempty dropを遮るケース。追加後menu修正はbrowser-finalで確認した。最後にgroup pointer proxyへ隠れたfocusを置かず正式controlへ戻す修正を加え、BlockNote型検査／1126テスト／buildとbrowser-accepted15条件を再確認した。browser-acceptedを最終受入証跡とする。既存native BlockNote dragToのheadless timeoutはnative-regressionの制限に残すが、今回の明示pointer grip15条件とは別経路。

.28/.27/.26凍結とschema29 WIP全823ファイルのSHA一致を確認（561+153+96+13）。旧成果物を書き換えていない。Safari、physical touch/native IME、PA実canonical save/reload/conflict/restart、実OS clipboard、全35/59、既存高速HTML pointer／clean iframe focusは未受入。
