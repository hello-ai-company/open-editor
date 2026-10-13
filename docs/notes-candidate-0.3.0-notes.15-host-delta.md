# .15 host delta

`.14` package/source/docsは保持。`.15`の共通側変更は、地図の選択・表の密度・legacy viewId・親再読込・表示設定の結果照会を対象とする。

- `clusterMapPins` は有限なviewport内で近接成分をまとめる。位置・行IDを変更せず、全行の選択肢を提示する。tiles/geocoding/remote zoomは提供しない。
- readonlyの複雑/長い表セルは原値を展開できる。locationは検証済みlabel/address/座標を表示し、未知値は原JSONを保持する。
- `LegacyNotesEditingProfile.databaseBindings` の `viewId` と `viewIdField` は明示所有だけ許す。フィールドは `databaseViewId` または `databaseConfig.viewId`。view identityを書き換えない。
- `NotesWorkspaceHost.subscribeResourceChanges` は正確なscope/targetのinvalidate通知。`session.refreshTarget` / `controller.refresh` はclean read-only更新。dirty/input/IME/recoveryは保持し、古い非同期読み取りが新Canvas・新通知を消さない。成功時にloaded DB readsをinvalidateする。
- `DatabaseViewConfigProvider.loadVersioned/saveVersioned` と公開 `DatabaseViewConfigWriteVersion` は独立readerのbaseline。`createReviewedDatabaseViewConfigProvider` はdurable beforeSubmit→CAS commit→exact receipt→lookupのhost portを既存UIへ接続する。旧bare saveは明示 `singleWriter:true` の単独所有integrationのみ。
- 設定writerの成功結果は各writer自身に返す。別writerのキューで失敗を隠さず、成功した原入力だけ消去する。強制unmount後のraw preferencesは元のread ticketと保持し、新版へ無断で貼替えない。
- terminal復旧のread-only比較と明示Use latest。Cancelは入力保持。unknownでは読込を止め同一operationをlookup。Review中のIME/pending/raw inputやprovider/store交換も保持する。

common synthetic route: `?notes=synthetic&classic&parity=database15`。既存database13 fixtureの能力/保存動作は変更しない。PA .15への実装と受入は別host ownerへ引き渡す。
