# .33 verification

Chrome154.0.8037.99、synthetic scoped host、Reduced Motion、ローカルVite5245に限定。GET/HEAD以外と外部originを遮断。実API・実AI・費用ゼロ。UI用33条件と既存回帰85条件、計118条件PASS。

証跡: output/ui33/final-pass/result.json、acceptance-result.json と regression-final-{columns-resize,columns-movement,coediting,coediting-tabbed,html-durable,table-durable}/result.json。Columns全体は事前selectionなしの通常mouse down/move/upで1440/780/390pxを確認、force/DragEvent/direct movement commandなし。native controlsメニューは実クリック。Undo/Redoだけは公開editor APIを利用。ID/children/width/本文を比較し、synthetic canonical保存後のlocalStorage再読込も一致。

12ツールは実クリック→pickerの検索/選択→確認→本文への追加→保存ボタン→再読込を確認。Equation/Mermaidは直接挿入。編集は数式/図のplain content、素材caption、DB view titleHintに公開updateBlockを利用し、同期本文はtextarea/Save shared contentでsynthetic resourceへ保存。動画/音声/PDFはcompact参照だけでデコード/再生を検証していません。media fixture bytesは単純な合成テキスト、画像は合成SVG。DB row writerは未接続のままです。

before/result.jsonとafter系スクリーンショットで同じfixtureの左端を測定。.32は本文とColumnsが同じx=64または28で、操作ボタンのみx=-26/-62と画面外。.33は操作x=8、本文左端を維持。狭幅rail52→44px、390pxでも設定した2アイコンを表示。overlay開閉時は本文のgeometryとwriter objectが不変。[]では1カラムのみ。

途中結果を上書きせず保管。初回はplain canonical入力とSDK正規化後の比較、native fileのshowPreview/asset IDがschemaにないこと、中央hoverがresize境界に当たること、async resize完了前のassert、[]設定へのundefined値、nested selectorの曖昧さをQA/fixtureで訂正。専用メニューとnative gutterの実重なりはviewport/offset-parent座標の不一致を実装で修正し、その後118条件PASS。

root typecheck、example typecheck、root1604tests（Vitest1462+Node142、BlockNote1153、新規2＋既存狭幅test更新）、build、git diff --checkを実行。lintはこのrepoで未設定。全体の結果とログはoutput/ui33/checks-result.jsonへ固定。

既存 .32/.31/.30/.28/.27/.26 と schema29 WIP 計1217ファイルSHA256一致。shared power.css .32 176449/gzip27440 → .33 179480/gzip27916、+3031/+476bytes。Python gzip mtime=0の同じ成果物比較のみ。旧JS/CSS bundle、Chromium CPU4 paint391ms/paste598msとは条件が異なるため直接比較しません。

本候補は独立したローカル成果物です。公開・push・merge・PAへのインストール・実AI/API・課金・認証設定変更は実施していません。既存 .31/.32 と旧成果物・schema29 WIP は保持しています。

PA host診断の読取照合はoutput/ui33/pa-host-comparison.md。実host導入として数えず、同じ公開NotesWorkspaceModes mountの840/390pxでツール配置とwhole drag/save/reloadを追加確認。外側クリックで閉じる際は新しい本文入力のfocusを保持し、modal pickerは判定から除外。

狭幅のImage clickが静的tooltipへ吸収される実不具合は、後続notesInteractions CSSのpointer-events:autoに勝つ所有selectorで修正。modal picker/書式galleryはtools overlayより前へ配置。外側clickの除外はpickerとNotesOverlayPortalの所有modal layerを含み、cancel後のopener focusを保持。
