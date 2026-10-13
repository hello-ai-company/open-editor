# Notes remaining work — 共通 .17 / PA .16 reconciliation

最新host限定受入は合成部分接続36/59・未接続23/59、API178/Web477/Chrome116/build PASS（owner証拠をread-only照合）。報告された完全受入0/59は署名済み完全受入が0という意味で、実装0・59test失敗ではない。Journal未mount等の全体切替条件と、個別拡張/元fixture未検証が混在していた。機能・外観・環境・切替を分離した定義/59行具体caseは [受入照合](notes-acceptance-reconciliation-pa16.md) と同名JSON。

PA.16追加部分接続#22/37/41/43/44をowner限定受入の範囲として記録。ただし#37はhost trial UI/resource editorでありSDK view CRUDではない。共通DatabaseProvider/runtimeにはversioned mutation/receipt/lookup/nested drain契約が足りず共通+host拡張が必要。確認済み共通拡張は従来6件に#37を追加し7件。共通.17関連/被リンク・nested移動はPA.16未採用、hostのtop-level制限を共通.17欠如と混同しない。

CSSは共通.17の93値/396geometryとPA.16の209値/396geometryを別snapshotとして記録、実PA全35未受入。原 .17 packaging時の5docs/2pack/証拠は不変、最新照合は別revision。旧UI切替・host source編集・push/merge/publish/deploy/実AI/新authなし。host担当の定義採用確認は待ち。

| # | 元要件 | PA .16接続 | 次の具体的受入 |
| --- | --- | --- | --- |
| 1 | Sidebar Pages / Library / Document modes | synthetic_subset | 元PAのPages/Library/Document切替とscope別設定の保存・再起動移行を同一routeで確認。全幅x0/host幅の二重確保なしも対で確認。 |
| 2 | Root/child page tree | synthetic_subset | 合成でcatalog・child createは通過済み。元tree全件/paging・権限/unknown値・取消/再読込を公開Navigation routeで確認。 |
| 3 | Tree move | synthetic_subset | 合成のworkspace CAS/cycle拒否/move/reloadは通過済み。旧drag/keyboard操作とproductionではない元fixtureの順序保持を確認。 |
| 4 | Sibling order | synthetic_subset | 合成のorder/CAS/history/reloadは通過済み。旧操作・未ロード兄弟・reload競合を同じfixtureで確認。 |
| 5 | Favorite and recent panels | not_connected | favorite metadata保存の局所証拠はあるが全panel未接続。scope別recent/favorite/preferenceの再起動保存と旧localStorage移行を確認。 |
| 6 | Trash | not_connected | ページtrash/restore/永久削除の権限・取消・再読込・子孫とunknown保持を元fixtureで接続確認。 |
| 7 | Library filters/sort/density | not_connected | 全configured library filter/sort/densityの結果・未知分類・設定保存/再起動移行を接続確認。 |
| 8 | Library classification editor | not_connected | Library上でclassification編集・取消・CAS/receipt/reloadとallowlist・未編集値保持を確認。 |
| 9 | Child-page hub | synthetic_subset | 元child hubの全DB summary/relationと設定保存を確認。#16の関連panelとは別受入。 |
| 10 | Page preview drawer | synthetic_subset | 元drawer fixtureのhover/resize/close/backとhost/sidebar/狭幅境界を対で確認。既存owner-clamped配置の通過証拠を保持。 |
| 11 | Workspace search | synthetic_subset | 元catalog/DBを含む検索範囲・query/highlight/row click・遅延/取消/scoped結果をfixtureで確認。 |
| 12 | Search assistant / include web | not_connected | 認可済みassistant/include-web providerの明示同意・context scope・取消/error/backを接続確認。実ネットワーク/費用は別承認範囲。 |
| 13 | Open tabs and split panes | synthetic_subset | pin/split/reloadは限定受入済み。元preferences移行とdrag/keyboard split/resize・pane間writer ownershipを確認。 |
| 14 | Title/icon/cover/breadcrumb header | synthetic_subset | 既存cover_url/cover_alt/styleとknown body保存は限定受入済み。24cover/emoji/upload/元header 6geometry、PA caption重なりを確認。 |
| 15 | Style gallery / cover | synthetic_subset | 12style/2coverは限定受入済み。元24catalog、upload/Unsplash、Cancel/Close後draftと元テーマ全状態を確認。 |
| 16 | Related pages / backlinks | not_connected | 共通.17関連/被リンクはbounded実装済みだがPA.16未採用。relatedIDs→summary map/認可BacklinkProviderを接続し元関係全fixtureを確認。 |
| 17 | App context/voice/webclip/Ask AI | not_connected | app context/voice/webclip/Ask AIの元routing・権限/同意・取消/error/backをhostで接続確認。 |
| 18 | Left document inspector tabs | synthetic_subset | 7document panelを同じ元文書・scope・read revisionで接続確認。各#19–25の通過範囲を参照しtab切替だけで完了扱いしない。 |
| 19 | Heading outline | not_connected | 元nested/長文heading outlineから該当blockへ移動しscope/revision変化・close/backを確認。 |
| 20 | Task list/toggle | not_connected | 元checklist各codecのtoggle/save/reload、未知payload保持、取消/競合を確認。 |
| 21 | Media panel | synthetic_subset | attach/detachは限定証拠あり。元storage/全media projection、upload/権限/署名失敗・unknown metadataを確認。 |
| 22 | Document body search | synthetic_subset | PA.16のliteral highlight/snippet/next/prev/Enter/ShiftEnter/Escape・noPOSTは通過済み。元nested/marked/custom/Unicode/長文とrow/split文脈を確認。native IMEは環境受入へ分離。 |
| 23 | Comments | synthetic_subset | source-block comment保存/Close入力保持は限定受入済み。元quote/text-range anchor・全record形式・provider/reloadと選択scopeを確認。 |
| 24 | History | synthetic_subset | checkpoint/before-save GET読取は限定受入済み。元history形式と必要なrestore操作・CAS/receipt/取消を独立して確認。 |
| 25 | Info/audit/classification/privacy/tags | synthetic_subset | 元metadata allowlist/rightsのclassification/privacy/tagとaudit projection、unknown値保持・save/reloadを接続確認。 |
| 26 | Right rail insert/style/info | synthetic_subset | table picker等は限定受入済み。旧全configured insert/style/infoの選択・閉じる/取消・狭幅focus復帰・writer保持を確認。 |
| 27 | Basic text/formatting | synthetic_subset | 共通.17はnested同親4方向対応、PAは.16/top-level限定のまま。17採用後元nested/mark/unknown/selection/Undo/save/reloadを確認。 |
| 28 | Font family and size | not_connected | 元font family/sizeすべての選択パス・mark保持・save/reloadをlegacy fixtureで確認。未知style保存をlive editor受入としない。 |
| 29 | Inline links/page link presentation | not_connected | 4legacy presentationは共通bounded提供。元inline/page linkの編集/unlink/codec/route・取消/保存/戻るを接続確認。 |
| 30 | Code/equation/Mermaid | not_connected | 共通code/math/diagramモジュールは存在する。Notesに必要featureを接続し元code/equation/Mermaidの編集/取消/表示/再読込を確認。 |
| 31 | Page break/table size selection | synthetic_subset | known table insert/edit/mark/width/IDs/parentとlostACKは限定受入済み。元未知table variant・page break・全size操作をfixtureで確認。 |
| 32 | Import/export/statistics/focus | not_connected | 統計/focus/import/export UIは存在する。元統計定義・focus入退・全export policy/未知custom codec・往復保存/取消を確認。 |
| 33 | Quick actions/templates/block deep links | not_connected | Cmd-K/templates/deep-link/full block menuの共通不足を実装後、元routing/keyboard/取消/back・既存本文を確認。 |
| 34 | Dictionary hints | not_connected | 辞書entry注入は存在する。元inline highlight/popoverを実装/接続しscope/遅延/閉じる/keyboardを確認。 |
| 35 | Selected text AI/comment toolbar | synthetic_subset | 選択テキストstub/consent/reject/replace/保存/条件付き未保存Undoは通過済み。multi-block rich replacement・saved Undo・元toolbar・Secretary provenance/partial adoptionを別case化。 |
| 36 | Eleven DB views | synthetic_subset | 11view/10property/cluster/table/settings receiptは限定受入済み。全layout/query/unseen paging/aggregatesとSDK view内CRUDを分けて確認。 |
| 37 | DB CRUD/trash/order/remote paging | synthetic_subset | PA専用trial UI/resource editorのrow CRUD/部分order/query cursorは限定受入済み。SDK view内にadditive versioned mutation/receipt/lookup/drain/navigation/query identity契約を設計・接続し、同じhost安全性caseを再実行。 |
| 38 | DB tree rows | synthetic_subset | DB tree read adapterは存在。元全row hierarchy/paged transport・drawer操作・順序/未ロードrow保存を確認。 |
| 39 | DB previews | synthetic_subset | 既知/未知totalとbounded previewは存在。元全preview/relations/resize/provider errorと狭幅を対で確認。 |
| 40 | Basic and extended property values | synthetic_subset | 10editor/4picker/7readonly/1action等は存在。元値/codec/provider/storageの全型、取消/未知値/保存・再読込を確認。 |
| 41 | DB property/schema settings | synthetic_subset | PA.16公開NotesDatabaseSchemaのcreate/named update/delete/reorder/CAS/receipt/lookupは限定受入済み。元全option/config/type変更拒否、unseen rows・権限・nested編集競合を確認。 |
| 42 | Formula/relation/rollup | synthetic_subset | 式のevalを追加しない。元authoritative relation/formula/rollup serviceのscope/入力/結果・取消/遅延をhostで接続確認。 |
| 43 | DB row drawer/page body | synthetic_subset | PA.16公開NotesWorkspaceのknown plain行本文save/reload/historyは通過済み。rich/unknown bodyBlocks codec/owner admission、旧drawer route/gestures・props同時writerを確認。 |
| 44 | Row-local outline/tasks/media/search/comments/history | synthetic_subset | PA.16はread-only行historyだけ追加接続。row-local outline/tasks/media/search/comments/history restoreを各subcaseで接続確認。 |
| 45 | Assets and attachments | synthetic_subset | attach/detachは限定証拠あり。元asset paste/drop/storage/cover/metadataの全fixture、権限/取消・失敗後の原値保持を確認。 |
| 46 | Unsplash source | not_connected | 認可済み元Unsplash catalog/providerをhostで接続し選択/取消/error/contextを確認。費用や新authは今回実施しない。 |
| 47 | Whiteboard | not_connected | bounded drawing codecあり。元全shape/viewport/編集・save/reloadのlegacy差をfixtureで特定、必要な差だけ共通実装する。 |
| 48 | HTML widget | not_connected | 標準legacy HTML codecあり。元custom preset/全variantの編集・isolated preview/取消/保存をfixtureで確認。 |
| 49 | Document columns | not_connected | document columnsは存在。元全nested/unknown structureの長文/編集/保存/戻るをfixtureで確認。 |
| 50 | Synced editable block | not_connected | bounded sync codecあり。元shared host/resolverのidentity/複数writer/dirty drainと完全legacy sync semanticsを接続確認。 |
| 51 | Canonical but non-live types | not_connected | non-live canonical各型を具体inventory化し、保存だけでなく必要なeditor操作を実装・往復確認。 |
| 52 | Document/Canvas/Present/Site shell | synthetic_subset | 4mode shell/optional Canvasは限定受入済み。元mode設定/DB含むprojection/共有writer/before-leaveを確認。native fullscreenは環境条件へ分離。 |
| 53 | Canvas layout persistence/recovery | synthetic_subset | 合成Canvasのdouble CAS/history/receipt/restart/lostACKは通過済み。元complex/nested文書のowner/persistence/providerを確認。 |
| 54 | Present/Site projection and local export | synthetic_subset | 元Present/Siteのexport/projection policy・全configured legacyをfixtureで確認。公開deployをローカル機能受入に要求しない。 |
| 55 | Ask this page / agent panel | not_connected | public optional adapterあり。元Ask this pageのscope/context/consent/provider、取消/error/backを接続確認。 |
| 56 | Quiet proposals | synthetic_subset | synthetic reject/approve/Undo/lostACKあり。元Secretaryのprovenance/partial adoption/receiptと保存後Undoを接続確認。 |
| 57 | Document writer ownership | synthetic_subset | solewriter/CAS/history/receipt/reload/DB参照no-op原値保持は限定受入済み。restart durable raw inputと複数nested dirty/composition/pending editor横断drainを共通/hostで実装確認。 |
| 58 | Scoped host resource changes | synthetic_subset | exact-parent notice/clean refresh/dirty fence/config CASは限定受入済み。元rich body/schema/resource/multi-instance/次notice raceと実event feedを確認。.15採用待ちという古い表記を再利用しない。 |
| 59 | Offline/sync/collaboration | not_connected | remote offline/CRDT/auth transportは未接続。元同期/再接続/競合/認可をhost側の独立受入で確認。local receipt復旧をremote対応としない。 |
