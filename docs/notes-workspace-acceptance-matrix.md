# Notes workspace acceptance matrix — 共通 .17 / PA .16

実装、合成部分接続、行の機能完全受入、外観、環境、旧UI切替を別軸にする。PA .16は36synthetic_subset/23not_connected、API178/Web477/Chrome116/build PASS_SCOPED。full受入報告0/59は59個別failureではない。照合した入力に凍結済み完全受入caseの証拠がないため完了判定を推定しない。

[定義・59行の照合と具体的次条件](notes-acceptance-reconciliation-pa16.md) / [machine-readable台帳](notes-acceptance-reconciliation-pa16.json) / [残件](notes-remaining-work.md)。#37はtrial CRUDとSDK view CRUDを区別し共通+hostのversioned/drain残件へ訂正。#22/41/43/44のPA追加限定受入は保持。共通.17の#16/27をPA.16へ反映したとは扱わない。

共通.17の型検査/1435 tests/build/16browser probes/installed2pack PASSは同版immutable資料を参照。共通CSS4192値4099一致93相違/396geometry、実PA.16SDK209相違/396geometry、PA全35未受入。これらは別条件の証拠。旧UI切替なし、Journal未mount。host担当の定義採用確認と機能別の元case凍結が残る。
