# OpenEditor Notes .18 — UI品質のローカル候補

分割時の左300px空白・TAG22px化、pointer緑枠、タブのテーマ配色、hoverプレビュー、再クリックと保存時の揺れを整理した共通UI候補。機能追加中のCRUD WIPは別worktreeで保持し、この候補には含めない。

狭い画面の編集ツールを本文幅が変わらない位置に展開する。長い既存アイコン値をセル内に収め、元データは保持する。選択済みDocument/Canvas/Present/Siteは再読込しない。本文は自分のcontroller更新を受け取り、サイドバーやツールのみの変更では再描画しない。全幅の単体表示を保持し、埋め込みではページ一覧を折り畳み・固定できる。

新しい必須hostメソッド、保存schema、認証設定は追加していない。navigationPresentation="drawer"は任意。型検査、1439 tests、build、ブラウザー検証の具体的範囲・数値・限界は同版verificationとoutput/ui-qualityを参照。

本文下の固定DB枠はホストのSyntheticDatabaseExplorerだった。PA担当がtrialToolsへ分離済みで、本来のDBブロック・DB操作は維持。共通候補だけでホストの古い表示を置換したという意味ではない。

全59機能・全35画面の完全受入ではない。実ユーザーの以前のURLは未回答。現在Mac Chromeに開かれた合成ホストで検証した。Safari/native IME/実AI/正式全機能の受入は未確認。公開・push・マージ・デプロイなし。
