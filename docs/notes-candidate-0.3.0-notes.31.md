# .31 合成共同編集の公開範囲契約

基点 .30 `5066c31867d2f7a60375d2b75b36138f2a43bfbc`、独立worktree `open-editor-coediting31`。ローカル候補。実AI・provider・外部本文送信・費用・認可変更・公開・PA実host導入なし。

公開 `createDocumentCoeditingSession` とoptional Notes coediting接続を追加した。stable block/range、writer/pane/session、canonical revision、draft/request epoch、SHA256 source/output digestを確認して、最新PM draftへの一回のlocal transactionで適用する。ghostはdecorationのみで本文／保存／nativeコピーに含めない。

IME・未反映のbeforeinput・active/recent範囲・遅延／停止・A→B→A・raw／manual／recoveryを保護する。範囲外の人間入力はmappingして保持する。AI専用Undoはinverse sliceだけを戻し、後続入力を残す。重なった場合はbefore/agent/currentのbounded reviewを返し、文書全体を復元しない。同じ提案の直後の再適用を抑止する。

Notesの同じ本文writerとdocument.saveを使う。送信済みのrequestを変更せず、保存待ちでも人間の入力を続けられる。newer draftは確認済みreceiptの本文と分けて保持し、次のsaveで保存する。unknown／conflict／raw退避中のAI適用は保留する。新しいcanonical writerはない。

範囲は一つの対応textblockで最大2000文字、改行・inline atoms・widgets／code等の非対応surfaceを除外。Undoは直近最大20件、同一提案の抑止は100件、session内だけ。PAのcontextual action choice、character／quiet companion表示、生成／approval／audit／耐久保存はhost側。全体の共同編集完成とはしない。次の別候補は本人の追加依頼である列境界resize・左gutter・ghostの表示配慮。
