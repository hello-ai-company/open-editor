# Local candidate 0.3.0-notes.15

OpenEditor単独は与えられた領域を全幅で使用する。Personal AI枠の再現は明示的な `hostFrame=reference` のみ。既存 .14のこの挙動を保持した。

地図の近接点を28pxのクラスタボタンにまとめ、元の座標を動かさず全行から明示選択する。表の長い値は2行のプレビューと展開可能な原値で表示し、保存内容は省略しない。classicの本文・ツール・インスペクターの対応CSSを調整した。

legacy codecのviewIdは明示された所有フィールドと元値が一致する場合だけ投影する。行更新後の通知は能力付与ではなく、正確なscope/targetのclean controllerだけ再読込できる。入力・IME・回復・新Canvas・新通知・遅い旧読込は保持/無効化ガードを通す。

表示設定の保存は本文/行保存から独立した、任意のhost-owned receipt port。各設定画面に独立した `loadVersioned` baselineを渡し、別の画面の成功で古い入力を新しい版へ自動貼替えしない。CAS競合時は元入力と移動障壁を保持する。lost ACKのRetryは同一operationのlookupだけで再送しない。terminal失敗後は「Review latest settings」で原入力/保存済み設定を比較し、Cancelで保持する。「Use latest settings」は明示したローカル入力の破棄であり、host writeを行わない。IME・未反映検索・他の生入力・provider/store交換中は適用を拒否する。

ローカル合成候補。PA原本、認証、公開、push/merge、デプロイ、実AI、課金は変更していない。旧候補は保持する。59行の完全ワークフローと35画面の完全CSS/画素一致は未受入で、旧UI削除の根拠にはならない。

詳細は同版の acceptance JSON、host-delta、pa-contract、verification を参照。
