# .18 PA adoption contract

共通の所有者はcodex/notes-ui-quality。PA sourceは読み取りのみ。Mac Chromeで開かれたホストURLはPA17 HANDOFFの127.0.0.1:49290、workspace=f4b2d631-5512-4f2e-8f5a-c3219dee2a32、document=00000000-0000-4000-8000-000000000011、host=personal-ai。本人の過去URLとの一致は未確認。

比較前はPAに実際にinstalledされた.17。比較後は同じホストsource・同じGET-only合成backendを127.0.0.1:5203で起動し、共通packageだけ隔離buildへaliasした。ホストsourceを二重編集せず、元のサーバー・データ・候補を保持した。新候補を49290へ導入したことはまだ意味しない。

ホスト担当はmanifest/sourceHead/SHAの一致を確認してローカル候補を採用し、embeddedでnavigationPresentation="drawer"、standaloneで省略、本文DBがある文書/通常文書/trialTools/各mode・保存再読込を確認する。旧UI削除・production rolloutの承認ではない。

以前のnotes-parityのCRUD WIP10ファイルと既存302保護ファイルのSHAは変更なし。#29/#33/#34/#35/#37/#51/#57の機能追加・全59機能受入は今回のUI修正で完了扱いにしない。

修正済み5203のstandalone（同URLのhost=personal-aiを省略）をMacの既存Chromeに新タブで開いた。単独layoutは1440/390ともx0でviewport全幅、hostSidebar0を確認済み。既存49290と旧タブは保持し、元hostへのpackage install/adoptionは担当所有者の作業として残る。
