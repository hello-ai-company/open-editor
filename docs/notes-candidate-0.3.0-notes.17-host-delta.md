# .17 host delta

新required host methodなし。任意 `NotesPageSummary.relatedPageIds?: readonly string[]` はoriginal relatedIDsをhost側で正規化する読取summary。書き戻し・暗黙metadata推定なし。実データの重複/不明ID/削除IDをcommonが書換えない。

既存 `host.providers.backlinks.listBacklinks({targetType:"page",targetId,limit:100})` を認可済みscopeで提供する。結果はloaded catalogに限定し表示titleをcatalogから取得。全件参照/remote pagingを保証しない。権限外本文取得を行わない。閉じたhubはprovider読取しない。

PanelのonOpenは既存session.open/beforeLeave/save/cancelへ委譲。入れ子移動は既存canonical writerで同じ親内のみ。新transaction/receiptやschema変更なし。

Host chromeが外側の幅を確保する場合、commonに二重reserveを足さない。単体はx0/reserve0。exampleのhostFrame=referenceは元画面CSS比較専用。

`.17` は元Notesとの全59要件・全35画面の完全移管を意味しない。完全受入は0/59、全CSS同等性は未承認。実Personal AI `.17` 採用、Safari/native macOS IME/zoom/touch/drag、全legacy、Secretary/実AI、restart raw input、remote/offline/authは未確認。既存PA15のsynthetic_subset31・not_connected28は既読の過去証拠であり、PA16/17採用を推定しない。公開・push・マージ・デプロイ・npm公開・実AI・課金・認証変更なし。
