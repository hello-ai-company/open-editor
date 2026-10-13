# .18 host delta

新しい必須メソッドなし。保存データやCAS/receipt/lookup契約は変更なし。

PersonalAIのようにホストがアプリ全体のサイドバーを持つ場合、次の任意propでNotesのページ一覧をdrawerから始められる。

```tsx
<NotesTabbedWorkspace
  host={host}
  config={config}
  navigationPresentation="drawer"
  // 既存のpropsを維持
/>
```

ページ一覧の固定/折り畳みは表示状態だけを変える。本文writer・未保存入力・既存タブ・保存JSONは保持する。設定は現在のmount内の表示状態であり、既存layout保存データに新しいfieldを書かない。省略時は従来sidebar、OpenEditor単体は左x0・二重reserveなし。

共通の親枠の開閉で本文を再描画しないが、本文controllerの通知とpropsの変更は受け取る。表示中のモードを再選択するだけの操作はbeforeModeChangeを呼ばない。実際のモード移動とレイアウト作成は、既存の保存/IME/復旧/原本refreshの柵を保持する。

ホストの試験用DB/合成提案は通常本文へ常設しない。本来のDBブロック・サイドバーDB一覧・保存編集機能とは分けて維持する。PA担当のtrialToolsによる分離はホスト側の修正であり、このパッケージでホストsourceは変更していない。

Splitではouter workspace幅から共有ナビのdrawer判定を行い、各pane幅は本文/ツールだけのcompact判定に使う。左右分割でも外側のsidebar列と内側の表示/role/inertが一致する。TAG入力は11px/28pxで独立し、タイトル入力のcompactサイズを引き継がない。

activeタブ/同一tree/session.openの再選択はleave/save/layout writeを起こさない。Libraryから現在ページへ戻る表示動作は維持。明示refreshTarget・別resource/別mode・Canvas保存は既存のguard/CAS/receiptを通る。

pointerとkeyboardの入力経路はDOM datasetで記録し、pointerでtext inputをクリックした際のfocus-visible緑枠を除く。Tab/矢印/Home/Endではkeyboard outlineを維持。文字入力だけでmodalityは変えず、controller/writerを再描画しない。navigation portalも外側workspaceのcaptureで扱う。

hoverはsidebar右端に8px重ね、256px幅で本文を覆う面積を減らす。200ms遅延、pointerのcardへの移動、keyboard preview/Escape、scope/scroll/resizeの破棄は保持する。保存詳細は64px（mobile96px）の固定・scroll可能領域に集約し、二重のheader message挿入で本文が動かないようにする。
