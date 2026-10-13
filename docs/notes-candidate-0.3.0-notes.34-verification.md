# .34 verification

独立 worktree、Node22.14、Chrome154.0.8037.99、合成 scoped host・localStorage/IndexedDB・決定的な AI 応答だけを使用。旧スクリプト `/tmp/open-editor-implement.py` は実行していない。原本/旧 worktree/PA source・data・servers は保持。

変更前 baseline: last を hover して Text をクリックすると、before と columns の間へ入ることを `output/ui34/baseline.json` で再現。HTML の初期 source は空だった。最終ケースは最後の pointer 境界、caret、nested Columns、HTML5 sidebar drag、Undo/Redo、長文120段落、疑似日本語 composition、1000/780/390幅、Reduced Motion、cancel/close、Card・childPage の表示保存/再読込、receipt と親参照 save → navigation、作成/保存/移動の失敗で遷移しないことを確認する。

操作23 / tools33 / resize20 / movement15 / HTML durable14 / table durable18 / coediting14 / tabbed4 の記録は output/ui34 の acceptance-result.json と参照 result.json に集約する。tools と他ケースの条件には重複があるため、141 は独立した機能の数ではなくテストケースの記録数。途中の失敗ログ/画像も保持し、最終 PASS と区別する。実 host 導入済みとは扱わない。

型検査、全体テスト、root build、example build、git diff check と四つの local tarball の installed declarations/runtime consumer を最終引継ぎで記載。lint script/config は提供されていないため実行済みとは扱わない。example build の500KB超 chunk警告は残る。

CSS は同じ dist/power.css と Python gzip(mtime=0) で .33 の179480bytes/gzip27916 → .34 の183099/gzip28407（+3619/+491）。旧 Chromium144 CPU4倍の paint391ms / 500blockpaste598ms は異なる定義・Chrome・build のため比較しない。今回の同条件の前後 browser timing は未計測。example build の chunk数値を旧主JSと直結しない。速度向上を断定しない。

環境の一時切断は直ちに報告し、読み取りと実起動の成功で復旧を確認した。新しい権限・課金・外部 API・実AI・push/publish/merge はない。実 IME/Safari/touch、実 provider/DB 行 mutation、PA の canonical 保存/再起動/audit、新しい表示形式の Canvas/Present/Site の等価描画は未確認。
