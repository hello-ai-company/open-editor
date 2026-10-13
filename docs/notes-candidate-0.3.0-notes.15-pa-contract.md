# Personal AI .15 pairing contract

PA原本はこの作業で変更していない。PA .14 owner HANDOFF（personal-ai-notes14-host/mac-evidence/notes14-host）はAPI139/Web477/Chrome88 checks/build PASSを報告した。既知表、history、11 views/10 row writers、cover metadata、12 styles、選択AI test stub、canonical comment/CAS/history/receipt、lost-ACK lookupの限定受入である。Journalは未mount。real Secretary/partial adoption/provenance、実AI課金、24 presets/upload/emoji、native IME、全59/35は未受入。この報告とOE .15のrealPA=false合成検証を混同しない。

PA .15採用の具体条件:

1. 元文書が所有するviewIdをcodec profileへ正確に渡す。view型/名前の編集がidentity/rows/schema/未知設定を変更しないことを既存保存→reloadで確認する。
2. 正規row commitのreceipt後に正確なparent targetへresource noticeを送る。clean親は再読込、dirty/input/IME/unknown親は元入力とnoticeを保持する。読込中の新Canvasや次noticeで旧読込を無効化する。
3. 表示設定を既存の独立resource CASへ接続する。readはconfig+revisionの同一snapshot、beforeSubmitはdurable journalのみ。commitはscope/権限/期待revision/原configを再検証し、config+new revision+exact idempotent receiptをatomic保存する。本文・row dataを別経路で書かない。
4. lookupは正確なoperation/scope/db/viewを確認し、terminal not-foundは未来の同operation commitをfenceした証拠が必要。unknown/pendingを成功扱いしない。再起動時はdurable recoveriesを渡しreconcileしてからUIをmountする。期限超過やlost ACKで自動再送しない。
5. 独立UIはそれぞれloadVersionedを行い元read ticketをraw draftと保持する。A保存後にBの古い設定がA版へ自動rebasedしないこと、B conflictがrawcache/navigation barrierを消さないことを同一resourceの2画面で確認する。bare load/save移行時のsingleWriter:trueは実際に単独writerと証明できる限定integrationのみ。
6. terminal失敗のReview latestはGETだけ。CancelとIME/pending入力は保持。Use latestだけ明示discardし、旧provider/storeの遅いreviewを適用しない。原入力を新revisionで再送する自動ルートは設けない。
7. 現PAと同じ1440x1000/390で近接pinの選択・keyboard Close・元row ID、原JSONの展開/検索/filter、known table save/reloadを確認する。OE synthetic表高さとPA旧257pxを同条件の性能差として直接比較しない。

PA .15 pairing、ネイティブmacOS IME/Safari/zoom、実CRUD/schema/nested drain、実データ/認可、残りCSS/legacy形式は未確認。acceptance JSONの59行とCSS35 reportを受入単位にし、限定PASSで旧UIを削除しない。
