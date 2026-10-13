# OpenEditor .33 UI candidate

配置済みColumns全体の移動と操作ボタン、狭い画面のツール列、挿入不可の原因を整理する候補です。.32 c32e363482c506f471d8014b9d09358c9dd2732a を基準に、独立 worktree open-editor-ui33 / branch codex/ui33 で作成。

Columns本文と前後の段落の左端は共通側の変更前から一致していました。本文の負のマージンは追加せず、画面外に出ていた専用操作のgutterを修正。左余地不足時は操作を行の上へ移し、全体のpointer移動・keyboard・取消・UndoRedo・保存後復元を確認。ネイティブ操作との衝突は公開Floating UI platformで座標を揃えて回避します。

classic狭幅は設定済みの44pxアイコン列だけを表示。クリックすると選択した1パネルを非モーダルoverlayで開き、本文幅とwriter identityを維持。矢印/Home/End、Enter、Escape、閉じるボタン、画面端、resize、focus modeを確認。パネル未設定時の空トラックとhideNavigation時の空ナビゲーション起動ボタンも除去。

12ツールの有効化はschemaとauthorized handlerの両方が必要です。未接続を見かけだけ有効にはしません。未設定の数式・図の編集機能と、未接続ホストを無効理由で区別。全12項目を接続済み合成ホストで挿入・編集・ローカル保存・再読込しました。素材caption/数式/図/DB参照ラベルの編集は公開updateBlockで検証し、同期ブロック本文は実際の入力・保存UIで検証しています。DB row writer、実素材の再生、実Unsplash検索は含みません。

.31共同編集契約、.32列幅変更、HTML/表のdurable契約、Core peer、canonical writerは保持。

本候補は独立したローカル成果物です。公開・push・merge・PAへのインストール・実AI/API・課金・認証設定変更は実施していません。既存 .31/.32 と旧成果物・schema29 WIP は保持しています。
