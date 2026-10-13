# Local candidate 0.3.0-notes.16

本文検索にリテラルの強調表示、前後の一致への移動、Enter/Shift+Enter、Escapeでクリア、結果の周辺文を追加した。文字装飾は一致を分断せず、inline atom/custom nodeは越えない。検索語500 UTF-16文字、一致1,000箇所までとし、超過時は「+」を表示する。検索は保存本文・保存API・Undo履歴を変更しない。

IME開始から終了までのlocal状態とlive controller identityを確認し、変換中やscope/target/revisionの適用前に古い本文を選択しない。任意の既存custom bridgeは新API未実装のまま従来の結果一覧を使用できる。

classicの外側へ既存theme tokensを定義し、タブのcascadeと文書sidebarの左右paddingを原対応値へ揃えた。12 stylesとResponsive/Reduced Motionを保持する。OpenEditor単独はx=0・reserve=0で全幅を使い、明示的なhostFrame=referenceだけ268pxを予約する。

PA .15のPASS_SCOPEDを読み取りで反映した。API148/Web477/Chrome102/buildはhost ownerの結果であり、OE .16の実PA検証ではない。59機能・35状態の残件はnotes-remaining-work.mdと同版acceptance JSONに分けて記録した。全移管・旧UI削除は未受入。

旧候補・既存WIPを保持。ローカル合成のみ。push/merge/publish/deploy・実AI・課金・認証・PA source変更なし。性能、最終検査と未確認範囲は同版verificationを参照。
