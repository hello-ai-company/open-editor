# .30 PAとの責務と採用条件

共通側: editor feature、block/cell identity、純粋な構造検証、同一editor内の移動、bounded追加、表示上の折返し。PA host側: canonical tree保存、正規writer、認可・revision/CAS・operation/ticket/receipt・raw退避、sidebar/slot/幅、試験UIの表示、restart復元。既存Document featureを一回だけ構成し、同version4tarballと現在のcore peerを使用する。DB/schemaのwriter追加はない。

既存2〜6列／width0.1〜10／gap／parent_block_id／position／未知metadataの契約をそのまま使う。PAで通常pointer／Alt矢印を実操作し、全体／列／内容を識別、3〜6列、空／入れ子、UndoRedo、raw編集中保留、split/narrow、canonical保存reload、並行競合、固定operation unknown／GET-only復旧、process restartを独立確認する。共有synthetic15＋回帰66を実PA受入へ転記しない。実hostへの導入はこの成果物では未実施。

HTMLソースが開いている、または列幅draftが未適用の対象サブツリーは移動／構造変更を保留する。内部rawを失わないための仕様で、Apply／Cancel後に移動できる。無関係なwidgetは再mountしない。旧全root置換fallbackを持つcustom editorの採用時はraw保留とscopeを別途確認する。

schema29 WIPは13ファイルSHAを照合して保持、中断中。schema41 PA host作業は独立。AI共同編集の責務資料を読み取ったが、この候補にambient AI／追加writerを混ぜない。後続では安定range/source hash/draft epoch、IME、最新draftへの原子的range適用、AIのみUndo、人間の入力継続と保存pending時の扱いを別候補で検証する。実provider・本文外部送信・費用は未承認で、今回発生なし。
