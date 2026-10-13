# 0.3.0-notes.32 · column boundaries and quiet shared editing UI

ローカル受入候補。固定済み .31 (ed508d967fd84d6664562976610ea106c4100431) を基点とし、.30 の列構造・移動・保存互換と .31 の公開共同編集契約を継承する。実AI/provider、本文外部送信、費用、公開、push/merge、PA導入は含まない。

境界ドラッグで隣接する2列をリサイズする。見た目だけのpreviewをpublic PM Decorationで表示し、pointerupでpropsだけを1transactionで更新する。列の合計weight、ID、親・位置・本文、他列を保つ。Undo/Redo、保存codecと再読込に対応。折り返し行でもweightを保持し、行間境界や1列stackに縦ハンドルを置かない。既存2..6列・width0.1..10の検証は維持する。

DocumentSideMenuControllerはBlockNote公開SideMenu/Extension.storeを使い、＋と移動/削除メニューを本文から14px離す。画面端は8px以内に切れず、左余地がない時は本文行の上へ移す。列独自ボタンとの重なりも避ける。body幅を予約しない。実際にhoverした入れ子の本文と公開menu targetを一致させ、nativeメニューの全機能を保持する。＋にEnter/Space操作を追加する。独自moveのpointer proxyはnativeボタンから離し、左余地110px未満ではnative gripを優先する。

.31 ghostは準備完了時だけ160ms fade。Reduced Motionではanimationなし。フォーカス中の入力位置より前に入り、行をずらすghostはinline表示を控え、提案自体は同じpublic portで保持する。現在caret直後の空範囲continuationは表示できる。visible DOM/PM caret両方を確認し、本文への保存・clipboard・適用/Undo契約を変更しない。固定AI欄や予約幅は追加しない。

検証と採用手順は -verification.md / -host-delta.md / -pa-contract.md / -acceptance.json。4ローカルtarballとmanifest、SHA付きhandoffを提供する。候補にCore peer変更なし。Frozen .31 と schema29 WIP は書き換えない。
