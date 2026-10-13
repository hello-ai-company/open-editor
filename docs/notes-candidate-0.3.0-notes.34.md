# OpenEditor local candidate 0.3.0-notes.34

.33 を保った独立 worktree `open-editor-ui34` / `codex/ui34` のローカル候補。公開版、PA の依存関係・データ・認証、旧成果物を変更しない。

クリック挿入が、最後に本文内で示した境界や実際のカーソル位置へ入る。挿入位置の意図が一度も無い場合は本文クリックを案内する。drag と click は同じ writer を使い、実際に挿入されたブロックと controller draft を確認してから通知し、結果を表示範囲へ移す。境界マーカー、挿入結果の短い強調、同じ位置の pointermove による再描画抑制を追加した。

Columns は通常 hover の全体移動ハンドルを保ち、列の個別移動は列の options 内へ整理。境界リサイズ、追加、積み重ね、並べ替え、マージ、個別本文の移動は保持。本文の個別移動はカーソルを置いて Alt+Shift+M で表示できる。クリックと drag threshold は分離し、必要時のハンドルを native menu が上書きしない。列の drag 開始後は自身の menu を閉じ、狭幅の移動先を覆わない。列のキーボード移動後は該当 menu とフォーカスを復帰する。所有する移動・表示メニューから公開 undo/redo を使える。

HTML は組込み Modern または「空で挿入」を選べる。既存プリセットと保存済み source は変更しない。sandbox / CSP / JavaScript 非実行 / raw source journal の契約は継続。Card は modern/simple、childPage は modern/simple/link を表示用 props で切り替え、pageId/titleHint と参照内容を保持する。子ページはホストの opt-in callback があるとき、作成 receipt と親の参照保存を確認し、未確定入力が無いことを確認してから現在 pane の移動を委ねる。

本文は引き続き単一の NotesBlockNoteDocument → controller.setDraft → controller.save/commit。Synced/DB/Gallery/Kanban の権限・scope・bound flag・list/get・resource controller は変更しない。新しい real AI 呼び出し、料金、外部 API、アップロード、push、公開、マージは行わない。

検証と未確認範囲は同梱 verification / PA contract / acceptance を参照。全ウィジェットの実ホスト接続や Canvas/Present/Site の表示 variant 等価性を共通側で完了したとは扱わない。
