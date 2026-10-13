# .28 共通UIの最小修正候補

ローカル検証専用。基点は .27 `e10acb0905419f5861458425a227d7762aefdd9a`。公開・既存PA画面への導入なし。

Codeの文字が暗い背景に埋もれる、390pxのモード名がdrawer上に重なる、表示状態の通知と入力退避が重なる、という3件を修正した。

- native codeBlockを汎用本文色から除外。`:where` でその他の本文色の詳細度を維持し、BlockNoteが持つ文字色と背景色の組をCSS読み込み順にかかわらず保持する。
- 狭幅／coarseでstaticになるmode labelだけz-indexをautoへ戻す。desktop tooltipは既存の積層を維持する。
- layout messageをactive paneの既存feedback dockへ渡す。確認済みlayout成功だけ3秒で終了。未確認・メモリのみ・更新待ち・エラーは状態が変わるまで保持し、本文のunknown復旧やerror通知、退避操作と縦に並べる。本文ownerが無い初期エラー／invalid layoutは通常のフロー内に案内と修復ボタンを表示する。

controller/sessionの保存・離脱ガード、本文/HTML/DB/Canvasのwriter・raw・ticket・receipt・認可は変更していない。schema実装なし。PAのsidebar・font・Document slot・HTML pointer境界・trialToolsはhostが管理する既存設定を維持する。

この候補は部分受入。既存のHTML高速pointer不達とclean previewのiframe focus課題は未解決。合格した通常操作を高速pointer合格へ読み替えない。詳細は `NOTES9-VERIFICATION.md` と `NOTES13-PA-CONTRACT.md`、ローカル `output/ui28/HANDOFF.md`。
