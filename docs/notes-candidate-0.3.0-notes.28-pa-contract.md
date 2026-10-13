# .28 PA統合条件

既存5451・本人profile・原本storeを保持し、新しい専用workspace/preview/profileへ固定.28候補を導入する。BlockNote/AI/Canvas/Publishの4tarのSHA256は `output/candidate/0.3.0-notes.28/manifest.json` を照合する。coreは既存 `^0.2.0`。保存契約は.27/.26を継承する。

PA側の確認条件は `personal-ai-rich27-host/mac-evidence/ui-compare27/HOST-RESPONSIBILITY.md` と合わせる。共通3件に対するhost専用の追加修正は不要との読取り確認を受領したが、PA実ブラウザー受入は別途必要。

同じ合成本文・HTML srcdoc・実際のfont・割当幅で1440 standalone／横Split／390pxを比較する。PAの現行試用routeはInter未登録でsystem fallbackするため、before/afterのfontを揃え、今回の共通Inter計測との字体差を取り違えない。fontを勝手に採用し直さない。

1. Code文字/背景/選択の可読性をnative CSS/shared CSSの両順序と明暗テーマで確認。
2. 390px drawerのmode label積層、座標とelementsFromPoint、実pointer click、Tab/Shift+Tab/Enter/Escapeとfocus-visibleを確認。
3. layout成功の終了後も退避操作が残ること、layout error/body unknown/command errorを同時に見つけ、重ならず操作できることを確認。通知を隠す修正は禁止。unknownは捕捉したfixed operationだけを照会し、再送しない。
4. 原raw・HTML applied backup・DB raw・ticket・receipt・離脱ガードと単独全幅・短入力位置を既存条件で回帰確認。通知layout検証だけで保存耐障害が合格したと扱わない。
5. trialTools追加DBは通常非表示を維持。本人URL不明を維持し原因断定しない。hostのsidebar・18px slot・font・HTML pointer境界・DB幅設定は保持。

schema #41は未着手。この候補はwriter予約・schema raw/CAS/receiptの責任を変更しない。公開・既存trialへの自動導入・認可変更は範囲外。既存fast pointer/clean iframe focus課題も未解決として引き継ぐ。
