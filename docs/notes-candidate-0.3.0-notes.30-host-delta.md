# .30 最小差分と原因

基点 .28 では、Columnsの見出しが高さ0の装飾で、BlockNote側の標準サイドメニューが列内の`oeColumn`を移動元に選ぶ場合があった。synthetic baselineで`left`を選択し、外への通常ドラッグ後もルート順序が変わらないことを記録した。列wrapperをグループ外へ出すと既存のorphanガードで拒否される。入力ガード全体を弱める修正はしない。

- `columns.ts`: 最大6の既存契約に収まるadd-columnとidentity保持の純粋move。重複ID／cycle／他groupへの列wrapper移動は事前拒否。
- `blockMovement.ts`: 同一mounted editorだけの明示グリップとpointer capture。5px閾値、挿入線、Escape／blur取消、autoscroll、Alt矢印。移動開始時の文書を使って候補を調べ、release時に現行文書との一致を再確認し、一回の公開editor.transactで更新する。外部DragEvent／JSONは取り込まない。
- `workspaceFeature.tsx`: 既存featureに拡張を追加（2→3）。group／columnグリップ、Add column、幅draft印。構造操作をgroup単位に限定し、無関係なroot widgetの再mountを避ける。古いcustom editorで公開remove/insertがない場合の既存fallbackは保持する。
- CSS: 列のヘッダ／空ボタンを自身の列にアンカー。container幅に応じて表示だけ折り返す。vendor portalを避けるgroup pointer proxyと、実際のsummary／panel範囲だけで標準side menuを隠す処理。標準block optionsは維持する。
- public root exports: `DocumentBlockMove`, `moveDocumentBlock`, `documentBlockKeyboardMove`, `applyDocumentBlockMove`, `DocumentBlockMovement`。既存createDocumentWorkspaceFeature利用hostは再構成時に新動作を得る。拡張の重複登録はしない。

追加列は新ID／width1／空children。既存列ID、width0.1〜10、gap0〜64、parent/position、入れ子と未知propsを保持する。DOMのcount/draft印は保存対象ではない。codec・Notes本文writer・DB/schema/HTML/Canvas writer・raw/CAS/ticket/receipt・認可の変更なし。Canvas/Present/Siteの機能追加なし。

PA hostのsidebar／左枠／slot／font／trialToolsはこの差分で変更していない。ユーザーの「エディターの下にデータベース」は補足として保持する。読み取りでtrialTools条件の下部SyntheticDatabaseExplorerを確認したが、問題画面URL未特定のため原因を断定しない。
