# .28 host差分

hostの保存API・scope・capabilities・beforeSubmit・fixed-ID照会・sourceDraftJournal・tableEditing契約に変更なし。既存 `NotesTabbedWorkspace` 接続では自動的にlayout feedbackがpaneへ統合され、新しいhost callbackは不要。

`NotesWorkspaceProps.workspaceFeedback?` は任意の表示propとして追加した。構造は `{text:string,tone:'success'|'notice'|'error',persistent?:boolean}`。独自のworkspace表示がこのpropを使う場合、成功だけをtransientにし、未確認・エラーはpersistentで渡す。データ保存成功を推測したりpermissionを付与する機能ではない。

shared power.cssを導入し、hostでCode色／mode label／layout通知を隠す上書きを足さない。native stylesheetとの両読み込み順序を確認する。PAのtrial.cssにある268px実sidebar、18px Document slot、input modality、HTML編集中のiframe pointer境界、DB幅調整は今回の共通修正と別責務であり、撤去しない。

通常リンクにはtrialToolsを付けない既存仕様を維持する。本人URLは不明で、本文下の「データベース」がtrialTools由来だったとは断定していない。DB本文blockや保存データを削除する対応は不要。
