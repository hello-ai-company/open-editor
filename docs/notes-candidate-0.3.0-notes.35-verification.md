# .35 verification

Root test: 1615 passed (Vitest1473 + Node142), BlockNote1164。lint scriptはありません。最終typecheck/root build/example buildはoutput/ui35のrelease logs参照。初回mock editorはSuggestionMenu store.subscribeを持たず16件失敗し、実storeに沿ったtest doubleへ修正しました。初回ブラウザーでSVG hit判定とclick/menu-itemの競合を検出し修正、失敗ログも保持。

Chrome154.0.8037.99: 157 passed。個別件数: commands-fixed-final=16, browser-fixed-final=23, movement-accepted=15, resize-complete=20, regression-tools=33, regression-html=14, regression-table=18, regression-coediting=14, regression-tabbed=4. 合成localデータのみ、real AI・upload・APIなし。

元Notes報告とhover画像を読んだ上で、同じ日本語三段落を新しいisolated .35 fixtureでChrome1440x1000・390x1000で確認。別ホストframeの寸法は同条件の性能比較として扱いません。通常hover guideなし・1 grip、+と右とslashの23項目同じbinding、空slash置換、非空文・長文中間連続挿入、3段落実pointer文字選択、クリックmenu/Escape、実grip drag/UndoRedo、表サイズ、HTML選択/取消、paragraph結合、choice中の新入力保持を検証。

CSSは同じgzip条件で183099→184079bytes、gzip28407→28583bytes (+980/+176)。hoverでReactのguide stateを更新する処理を除去。旧Chromium144のpaint391ms/paste598msとは比較していません。起動/CPU/長文pasteの同条件前後は未計測。

1,691旧固定/WIPファイルSHA一致。Vite5247は試験後停止し、既存host serverを停止/変更していません。

未確認: 実macOSIME候補確定、touch/Safari、複数ブロックまとめdrag、実host canonical DB/CAS/carrier/navigation/AIレビューの採用。linked external KaTeX fontのdev Vite allow-list制約による字体はこの操作試験では合格扱いにしていません。production example buildのfont bundleと切り分けてください。ユーザーURL不明のDB位置はhost確認が必要。

最終のnative menu競合と非テキスト+の試験失敗は修正後再実行して合格。最終型検査/typecheck-complete.log、build-complete.log、example-build-complete.log、tests-complete.logが0。過去のTS自己参照推論エラーは明示型指定で修正し、途中ログも保存しています。
