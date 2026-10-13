# OpenEditor Notes .17 — ローカル候補

OpenEditor単体は左側の旧hostサイドバー領域も含め全幅を使用する。比較用host reserveは明示fixtureだけに限定。既存worktree/候補を保持したローカル候補。

共通側の関連ページ・被リンクを既存child hubの折りたたみに追加した。現在の文書のnestedページ参照とhost-normalized relatedPageIds、読み込み済み一覧の親子/明示関連、任意の認可済みBacklinkProviderを使用する。全ページ本文を読むscanや保存writeなし。providerのtitleや未ロードIDを表示しない。scope/target/read revision変更・unmountで遅延結果を無効化する。provider未接続時は他本文参照が未確認と表示する。

4方向の移動を入れ子の同じ親の兄弟にも対応。親子階層、子孫、unknown値を保持。アクティブタブのstyleをouter shellに反映し、tabs padding・theme色・rail/info・Library等の元CSS値を修正した。

型検査/1435 tests/build/16 browser probes PASS。CSS値相違209→93。速度差は断定できず、decodedJS+7236bytes。詳細は同版verification/acceptance/host-delta/pa-contractとoutput/verification-notes17。

`.17` は元Notesとの全59要件・全35画面の完全移管を意味しない。完全受入は0/59、全CSS同等性は未承認。実Personal AI `.17` 採用、Safari/native macOS IME/zoom/touch/drag、全legacy、Secretary/実AI、restart raw input、remote/offline/authは未確認。既存PA15のsynthetic_subset31・not_connected28は既読の過去証拠であり、PA16/17採用を推定しない。公開・push・マージ・デプロイ・npm公開・実AI・課金・認証変更なし。
