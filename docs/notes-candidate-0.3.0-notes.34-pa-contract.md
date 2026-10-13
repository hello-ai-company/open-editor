# PA adoption contract .34

共通側は独立 `open-editor-ui34` の実装のみ。PA の source、依存、API、DB、browser、trial data を変更しない。初期契約は `output/ui34/HOST-CONTRACT-EARLY.md` に先行共有。cloud_threads outbound が公開されていないため、別の送信経路や承認拒否された relay を代用していない。

```ts
const insertion: NotesInsertionHost = {
  scope,
  // Existing authorized providers/bound flags remain here.
  onCreatedPageReady: async ({ page, signal }) => {
    signal.throwIfAborted();
    await openPageInCurrentPane(page.id, signal);
  },
};
```

callback は実ホストが page.create / readWorkspace / document.save の意味と canonical receipt を実装することを前提とする。共通の save は operation ID / CAS / lookup の既存経路。callback は別の作成や親保存を再送しない。未確定入力が遅れて入った場合は callback を呼ばず保持する。navigation 失敗後の開き直しは作成済み ID を使う。元の本文・dirty・source journal を捨てる切替を行わない。

ホストの strict native carrier / allowlist では pageCard.presentation を modern/simple、childPage.presentation を modern/simple/link に限定して保存・読取。pageId/titleHint、未知 metadata、参照先本文は保持。HTML Modern は SDK 組込みソースであり、PA や AI で生成しない。既存 raw source と durable records の契約は継続。

通常 Synced/DB/Gallery/Kanban は scope と bound を確認した実 provider、resource controller、参照 ID を使う。合成 host の list/get・media stub で PASS したことを、実 DB 行 mutation / real upload / playback / Unsplash の完了としない。

受入の残る範囲: PA の SDK 導入、画面全体の frame/左予約枠、real canonical carrier とページ遷移・audit・再起動、実 provider と競合、物理 IME/Safari/touch、Canvas/Present/Site の新しい表示 variant。ユーザー補足は「エディターの下にデータベースと記載」だけで URL/欄は未特定。本文 DB と外部 explorer の区別をつけず削除しない。
