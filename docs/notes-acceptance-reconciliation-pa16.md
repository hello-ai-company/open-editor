# 共通 .17 / Personal AI .16 受入定義の照合

「0/59」は完全受入の証拠・署名が0件という報告であり、実装0件でも59件のテスト失敗でもない。PA .16 の actualPA16Connection を数えると **合成データで部分接続36 / 未接続23**。API178・Web477・Chrome116・build PASSはHANDOFFと8 DB/6検索browser caseをread-onlyで確認したowner証拠で、この担当がPAテストを再実行した意味ではない。

現在の台帳は全行のhostPairedAcceptance/removalGate=falseと全productionConnection=falseを持つが、照合した台帳・HANDOFFでは、凍結された各行の完全受入case一覧・個別failure理由を確認できない。**全体条件と各機能の残件が両方存在するため、0/59を59個別failureに帰属できない**。Journal route未mount、本番未接続、実PA CSS35未受入、関連native環境未受入は全体切替の未充足条件。rich行本文・SDK view内CRUD契約・その他拡張は個別機能残件。元fixtureの網羅性が未確認の行は「失敗」ではなく「未評価」と記録する。

## 揃える判定軸

| 軸 | 完了に必要な証拠 | 他の軸と混ぜない点 |
| --- | --- | --- |
| 共通bounded実装 | public module/pathと明示fixtureの通過 | 全legacy機能受入ではない |
| host scoped接続 | 正確なSDK/route/controllerと合成fixtureで操作通過 | trial UIのCRUDをSDK view CRUDへ代用しない |
| 行の機能完全受入 | 元機能の操作/fixture/保存不変条件を事前にcase化し、関連cancel/back/reload/error/identity raceを通過。書込がある場合CAS/history/receipt/GET-only unknown復旧も通過。行担当の確認 | 全35 CSS、別行の未接続、Journal本番切替を各行の機能booleanに一括適用しない |
| 外観 | 同じcontent/allocation/viewportの元状態で比較、selector欠落やcount差も記録 | 意図したcontainer差も自動同等扱いしない。共通.17の93差はPA.16の209差を解決した証拠ではない |
| 環境 | その行が実際に使用するSafari/native IME/zoom/touch/dragをcase化 | 全59にnative IMEを一律要求しない。合成イベントはnative証拠ではない |
| 旧UI切替 | 必要機能/外観/環境に加え、元Journal routing、認可adapter、data/preference移行、unknown保持/復旧と合意したrelease条件 | 機能部分接続を旧UI除去の許可としない。今回は切替禁止を維持 |

この定義はCOMMON-CONTRACTS.mdの安全性条件と、共通実装を照合した統一案。host担当からの採用確認は未受領。次回は各行のcaseを凍結し、元routeの試用接続と本番切替を分離して同じ指標を両台帳に保存する。未凍結のcaseを満たしたと推定して「完了」を増やさない。

## 重要な照合と訂正

| # | 証拠から認めること | 機能別の残件 / 次の受入 |
| --- | --- | --- |
| 22 | PA .16 literal highlight/snippet/前後/Enter/ShiftEnter/Escape/noPOST、合成IME fence | 元nested/marked/custom/Unicode/長文・row/split fixtureの全操作。native IME/Safariは別環境case。「highlight未実装」という旧残件を再利用しない |
| 37 | PA専用trial UIと公開generic revisioned resource editorのcreate/named patch/trash/restore/部分order/remote8行query、atomic CAS/history/receipt | SDK DB view内mutationは未接続。public DatabaseProviderにはversion/op/ticket/lookupの型がなく、runtimeはprovider.createRow後refreshするだけ。additive versioned契約とnested drain/navigation/query identity fenceが共通+host残件。「host接続だけ」の旧分類を訂正 |
| 41 | 公開NotesDatabaseSchemaのcreate/update/delete/reorder、raw definitions/rows/unknown保持、schema CAS/receipt/GET-only lostACK | 全元option/configと非空型変更拒否・unseen値・nested編集競合を同じ公開操作から確認。production未接続だけを唯一の機能残件にしない |
| 43 | 公開NotesWorkspaceのknown plain行本文save/reload/history、lostACK | rich/unknown bodyBlocks admission/codec、旧native drawer、props/body二重writer。plain保存をrich全体受入にしない |
| 44 | read-only原行本文history | outline/tasks/media/search/comments/history restoreは個別subcaseとして未接続。GET historyをrestore受入にしない |
| 16/27 | 共通.17関連/被リンクとnested同親4方向はローカル通過 | PAは固定.16のまま。17採用/relatedIDs map/providerと元nested fixture受入待ち。PAの「top-level制限」は.16に正しく、共通.17の欠如ではない |
| 57/58 | solewriter/CAS/history/receipt・初回DB参照no-op原配列保持・exact-parent notice/clean refreshはPA限定受入 | raw inputのrestart耐久性・全nested drain/rich/schema/multi-instance/event feed。初回参照不変の修正はread-only照合で認め、旧UI Restoreを変更しない |

共通確認済み拡張は#29/33/34/35/51/57の6件に、**#37の共通view versioned/drain契約**を加えて7件。これは7モジュールが丸ごと不存在という意味ではない。drawing/widget/columns/codeなど既存モジュールの全legacy同等性未検証も、fixtureなしに共通の機能欠如と断定しない。

PA acceptance JSONのcandidate=.15は継承metadataで、sdkSourceHeadとHANDOFFの2pack hashは.16を指す。actualPA15ConnectionとactualPA16Connectionを混用しない。旧nextHostVerificationにも.15 adoption pending/原highlight pending/既に通過したcreate/order等の古い文字列があるため、最新hostScopedEvidenceを正確な追加証拠とし、具体的次条件を別欄へ保存する。原証拠は上書きしない。

## 59行の次の受入

各行はPA.16 reportedFull=falseを保持する一方、functionFullの実測判定は NOT_EVIDENCED_AGAINST_FROZEN_PER_ROW_CRITERIA とする。以下の具体的受入は次の凍結caseに用いる案であり、完了主張ではない。

| # | 元要件 | PA .16 | 共通の確認済み拡張 | 次の具体的受入 |
| --- | --- | --- | --- | --- |
| 1 | Sidebar Pages / Library / Document modes | synthetic_subset | なし/元fixtureの不足は別 | 元PAのPages/Library/Document切替とscope別設定の保存・再起動移行を同一routeで確認。全幅x0/host幅の二重確保なしも対で確認。 |
| 2 | Root/child page tree | synthetic_subset | なし/元fixtureの不足は別 | 合成でcatalog・child createは通過済み。元tree全件/paging・権限/unknown値・取消/再読込を公開Navigation routeで確認。 |
| 3 | Tree move | synthetic_subset | なし/元fixtureの不足は別 | 合成のworkspace CAS/cycle拒否/move/reloadは通過済み。旧drag/keyboard操作とproductionではない元fixtureの順序保持を確認。 |
| 4 | Sibling order | synthetic_subset | なし/元fixtureの不足は別 | 合成のorder/CAS/history/reloadは通過済み。旧操作・未ロード兄弟・reload競合を同じfixtureで確認。 |
| 5 | Favorite and recent panels | not_connected | なし/元fixtureの不足は別 | favorite metadata保存の局所証拠はあるが全panel未接続。scope別recent/favorite/preferenceの再起動保存と旧localStorage移行を確認。 |
| 6 | Trash | not_connected | なし/元fixtureの不足は別 | ページtrash/restore/永久削除の権限・取消・再読込・子孫とunknown保持を元fixtureで接続確認。 |
| 7 | Library filters/sort/density | not_connected | なし/元fixtureの不足は別 | 全configured library filter/sort/densityの結果・未知分類・設定保存/再起動移行を接続確認。 |
| 8 | Library classification editor | not_connected | なし/元fixtureの不足は別 | Library上でclassification編集・取消・CAS/receipt/reloadとallowlist・未編集値保持を確認。 |
| 9 | Child-page hub | synthetic_subset | なし/元fixtureの不足は別 | 元child hubの全DB summary/relationと設定保存を確認。#16の関連panelとは別受入。 |
| 10 | Page preview drawer | synthetic_subset | なし/元fixtureの不足は別 | 元drawer fixtureのhover/resize/close/backとhost/sidebar/狭幅境界を対で確認。既存owner-clamped配置の通過証拠を保持。 |
| 11 | Workspace search | synthetic_subset | なし/元fixtureの不足は別 | 元catalog/DBを含む検索範囲・query/highlight/row click・遅延/取消/scoped結果をfixtureで確認。 |
| 12 | Search assistant / include web | not_connected | なし/元fixtureの不足は別 | 認可済みassistant/include-web providerの明示同意・context scope・取消/error/backを接続確認。実ネットワーク/費用は別承認範囲。 |
| 13 | Open tabs and split panes | synthetic_subset | なし/元fixtureの不足は別 | pin/split/reloadは限定受入済み。元preferences移行とdrag/keyboard split/resize・pane間writer ownershipを確認。 |
| 14 | Title/icon/cover/breadcrumb header | synthetic_subset | なし/元fixtureの不足は別 | 既存cover_url/cover_alt/styleとknown body保存は限定受入済み。24cover/emoji/upload/元header 6geometry、PA caption重なりを確認。 |
| 15 | Style gallery / cover | synthetic_subset | なし/元fixtureの不足は別 | 12style/2coverは限定受入済み。元24catalog、upload/Unsplash、Cancel/Close後draftと元テーマ全状態を確認。 |
| 16 | Related pages / backlinks | not_connected | なし/元fixtureの不足は別 | 共通.17関連/被リンクはbounded実装済みだがPA.16未採用。relatedIDs→summary map/認可BacklinkProviderを接続し元関係全fixtureを確認。 |
| 17 | App context/voice/webclip/Ask AI | not_connected | なし/元fixtureの不足は別 | app context/voice/webclip/Ask AIの元routing・権限/同意・取消/error/backをhostで接続確認。 |
| 18 | Left document inspector tabs | synthetic_subset | なし/元fixtureの不足は別 | 7document panelを同じ元文書・scope・read revisionで接続確認。各#19–25の通過範囲を参照しtab切替だけで完了扱いしない。 |
| 19 | Heading outline | not_connected | なし/元fixtureの不足は別 | 元nested/長文heading outlineから該当blockへ移動しscope/revision変化・close/backを確認。 |
| 20 | Task list/toggle | not_connected | なし/元fixtureの不足は別 | 元checklist各codecのtoggle/save/reload、未知payload保持、取消/競合を確認。 |
| 21 | Media panel | synthetic_subset | なし/元fixtureの不足は別 | attach/detachは限定証拠あり。元storage/全media projection、upload/権限/署名失敗・unknown metadataを確認。 |
| 22 | Document body search | synthetic_subset | なし/元fixtureの不足は別 | PA.16のliteral highlight/snippet/next/prev/Enter/ShiftEnter/Escape・noPOSTは通過済み。元nested/marked/custom/Unicode/長文とrow/split文脈を確認。native IMEは環境受入へ分離。 |
| 23 | Comments | synthetic_subset | なし/元fixtureの不足は別 | source-block comment保存/Close入力保持は限定受入済み。元quote/text-range anchor・全record形式・provider/reloadと選択scopeを確認。 |
| 24 | History | synthetic_subset | なし/元fixtureの不足は別 | checkpoint/before-save GET読取は限定受入済み。元history形式と必要なrestore操作・CAS/receipt/取消を独立して確認。 |
| 25 | Info/audit/classification/privacy/tags | synthetic_subset | なし/元fixtureの不足は別 | 元metadata allowlist/rightsのclassification/privacy/tagとaudit projection、unknown値保持・save/reloadを接続確認。 |
| 26 | Right rail insert/style/info | synthetic_subset | なし/元fixtureの不足は別 | table picker等は限定受入済み。旧全configured insert/style/infoの選択・閉じる/取消・狭幅focus復帰・writer保持を確認。 |
| 27 | Basic text/formatting | synthetic_subset | なし/元fixtureの不足は別 | 共通.17はnested同親4方向対応、PAは.16/top-level限定のまま。17採用後元nested/mark/unknown/selection/Undo/save/reloadを確認。 |
| 28 | Font family and size | not_connected | なし/元fixtureの不足は別 | 元font family/sizeすべての選択パス・mark保持・save/reloadをlegacy fixtureで確認。未知style保存をlive editor受入としない。 |
| 29 | Inline links/page link presentation | not_connected | あり | 4legacy presentationは共通bounded提供。元inline/page linkの編集/unlink/codec/route・取消/保存/戻るを接続確認。 |
| 30 | Code/equation/Mermaid | not_connected | なし/元fixtureの不足は別 | 共通code/math/diagramモジュールは存在する。Notesに必要featureを接続し元code/equation/Mermaidの編集/取消/表示/再読込を確認。 |
| 31 | Page break/table size selection | synthetic_subset | なし/元fixtureの不足は別 | known table insert/edit/mark/width/IDs/parentとlostACKは限定受入済み。元未知table variant・page break・全size操作をfixtureで確認。 |
| 32 | Import/export/statistics/focus | not_connected | なし/元fixtureの不足は別 | 統計/focus/import/export UIは存在する。元統計定義・focus入退・全export policy/未知custom codec・往復保存/取消を確認。 |
| 33 | Quick actions/templates/block deep links | not_connected | あり | Cmd-K/templates/deep-link/full block menuの共通不足を実装後、元routing/keyboard/取消/back・既存本文を確認。 |
| 34 | Dictionary hints | not_connected | あり | 辞書entry注入は存在する。元inline highlight/popoverを実装/接続しscope/遅延/閉じる/keyboardを確認。 |
| 35 | Selected text AI/comment toolbar | synthetic_subset | あり | 選択テキストstub/consent/reject/replace/保存/条件付き未保存Undoは通過済み。multi-block rich replacement・saved Undo・元toolbar・Secretary provenance/partial adoptionを別case化。 |
| 36 | Eleven DB views | synthetic_subset | なし/元fixtureの不足は別 | 11view/10property/cluster/table/settings receiptは限定受入済み。全layout/query/unseen paging/aggregatesとSDK view内CRUDを分けて確認。 |
| 37 | DB CRUD/trash/order/remote paging | synthetic_subset | あり | PA専用trial UI/resource editorのrow CRUD/部分order/query cursorは限定受入済み。SDK view内にadditive versioned mutation/receipt/lookup/drain/navigation/query identity契約を設計・接続し、同じhost安全性caseを再実行。 |
| 38 | DB tree rows | synthetic_subset | なし/元fixtureの不足は別 | DB tree read adapterは存在。元全row hierarchy/paged transport・drawer操作・順序/未ロードrow保存を確認。 |
| 39 | DB previews | synthetic_subset | なし/元fixtureの不足は別 | 既知/未知totalとbounded previewは存在。元全preview/relations/resize/provider errorと狭幅を対で確認。 |
| 40 | Basic and extended property values | synthetic_subset | なし/元fixtureの不足は別 | 10editor/4picker/7readonly/1action等は存在。元値/codec/provider/storageの全型、取消/未知値/保存・再読込を確認。 |
| 41 | DB property/schema settings | synthetic_subset | なし/元fixtureの不足は別 | PA.16公開NotesDatabaseSchemaのcreate/named update/delete/reorder/CAS/receipt/lookupは限定受入済み。元全option/config/type変更拒否、unseen rows・権限・nested編集競合を確認。 |
| 42 | Formula/relation/rollup | synthetic_subset | なし/元fixtureの不足は別 | 式のevalを追加しない。元authoritative relation/formula/rollup serviceのscope/入力/結果・取消/遅延をhostで接続確認。 |
| 43 | DB row drawer/page body | synthetic_subset | なし/元fixtureの不足は別 | PA.16公開NotesWorkspaceのknown plain行本文save/reload/historyは通過済み。rich/unknown bodyBlocks codec/owner admission、旧drawer route/gestures・props同時writerを確認。 |
| 44 | Row-local outline/tasks/media/search/comments/history | synthetic_subset | なし/元fixtureの不足は別 | PA.16はread-only行historyだけ追加接続。row-local outline/tasks/media/search/comments/history restoreを各subcaseで接続確認。 |
| 45 | Assets and attachments | synthetic_subset | なし/元fixtureの不足は別 | attach/detachは限定証拠あり。元asset paste/drop/storage/cover/metadataの全fixture、権限/取消・失敗後の原値保持を確認。 |
| 46 | Unsplash source | not_connected | なし/元fixtureの不足は別 | 認可済み元Unsplash catalog/providerをhostで接続し選択/取消/error/contextを確認。費用や新authは今回実施しない。 |
| 47 | Whiteboard | not_connected | なし/元fixtureの不足は別 | bounded drawing codecあり。元全shape/viewport/編集・save/reloadのlegacy差をfixtureで特定、必要な差だけ共通実装する。 |
| 48 | HTML widget | not_connected | なし/元fixtureの不足は別 | 標準legacy HTML codecあり。元custom preset/全variantの編集・isolated preview/取消/保存をfixtureで確認。 |
| 49 | Document columns | not_connected | なし/元fixtureの不足は別 | document columnsは存在。元全nested/unknown structureの長文/編集/保存/戻るをfixtureで確認。 |
| 50 | Synced editable block | not_connected | なし/元fixtureの不足は別 | bounded sync codecあり。元shared host/resolverのidentity/複数writer/dirty drainと完全legacy sync semanticsを接続確認。 |
| 51 | Canonical but non-live types | not_connected | あり | non-live canonical各型を具体inventory化し、保存だけでなく必要なeditor操作を実装・往復確認。 |
| 52 | Document/Canvas/Present/Site shell | synthetic_subset | なし/元fixtureの不足は別 | 4mode shell/optional Canvasは限定受入済み。元mode設定/DB含むprojection/共有writer/before-leaveを確認。native fullscreenは環境条件へ分離。 |
| 53 | Canvas layout persistence/recovery | synthetic_subset | なし/元fixtureの不足は別 | 合成Canvasのdouble CAS/history/receipt/restart/lostACKは通過済み。元complex/nested文書のowner/persistence/providerを確認。 |
| 54 | Present/Site projection and local export | synthetic_subset | なし/元fixtureの不足は別 | 元Present/Siteのexport/projection policy・全configured legacyをfixtureで確認。公開deployをローカル機能受入に要求しない。 |
| 55 | Ask this page / agent panel | not_connected | なし/元fixtureの不足は別 | public optional adapterあり。元Ask this pageのscope/context/consent/provider、取消/error/backを接続確認。 |
| 56 | Quiet proposals | synthetic_subset | なし/元fixtureの不足は別 | synthetic reject/approve/Undo/lostACKあり。元Secretaryのprovenance/partial adoption/receiptと保存後Undoを接続確認。 |
| 57 | Document writer ownership | synthetic_subset | あり | solewriter/CAS/history/receipt/reload/DB参照no-op原値保持は限定受入済み。restart durable raw inputと複数nested dirty/composition/pending editor横断drainを共通/hostで実装確認。 |
| 58 | Scoped host resource changes | synthetic_subset | なし/元fixtureの不足は別 | exact-parent notice/clean refresh/dirty fence/config CASは限定受入済み。元rich body/schema/resource/multi-instance/次notice raceと実event feedを確認。.15採用待ちという古い表記を再利用しない。 |
| 59 | Offline/sync/collaboration | not_connected | なし/元fixtureの不足は別 | remote offline/CRDT/auth transportは未接続。元同期/再接続/競合/認可をhost側の独立受入で確認。local receipt復旧をremote対応としない。 |

## 次の共同確認順序

1. host担当が本定義/JSONを照合し、.16 SDK固定・36/23・trial/public経路の区別を確認する。原台帳を改変せず新revisionを作る。
2. #22/#41/#43/#44の元fixture/subcaseを凍結する。機能caseは個別に受入可能とし、CSS35/native/本番routeは別指標に保つ。既存安全性通過を再び未実装扱いしない。
3. #37は先にadditive versioned operation/receipt/lookupとdirty/composition/pending横断drain/query-bound cursorを共通・hostの双方で設計する。bare mutatorをenableして穴埋めしない。元trial UIと同じtwo-reader stale CAS/取消terminal照会/unknown-unseen値保持/double submit/rollback/lostACK reload/no resend/scope衝突caseをSDK view controlから実行する。
4. #16/#27は候補.17を別host試用領域で採用・照合し、.16既存receipt/settings/no-op不変を保持する。.17 CSSを.16のPA実画面同等性に流用しない。PA caption/header重なりは#14/#22のappearance caseとして残す。
5. 個別機能が閉じたら全体切替のJournal routing/data/preference/認可/環境/CSS条件を検証する。今回は旧UI切替なし。

Evidence: PA .16 HANDOFF.md/json、acceptance-59.json/md、COMMON-CONTRACTS.md、db-editing-browser.json(8case)、search16-browser.json(6case)、css35-host-acceptance.json/md。共通source d7bcb5c、PA SDK source82f3bce。入力のSHAは同名JSON、既存296証拠の保全はoutput/verification-reconciliation-pa16。
