# OpenEditor Notes .36 — ローカル候補

Base .35 c435b9314da409dc10bc95805eec5b120cbb0edd。PA実ホスト比較で見つかった日本語と二つの選択surface、未接続のAI/comment説明を改善するSDK候補。パッケージのsourceHead/consumer結果/SHAは同versionのmanifest.jsonに固定。Core peerは既存^0.2.0。公開・push・install・権限拡大・実AI/API・課金は行わない。

日本語/native dictionary、標準書式 + 選択AI/comment/挿入の一つのtoolbar、未接続/保存不可badgeと理由、選択元のafter挿入を追加。pointerで書式ボタンを押しても本文focusを保持し、F8/矢印で選択操作へ移動。composer ownerはtoolbarの外に置き、blurで消さない。AIは既存明示生成→review→選択置換→guarded Undo。commentは既存capability/semantics/clean documentのwriterのみ。選択review入口は既存UIを開くcallbackだけ。

初期dictionaryはconfig.locale（ja/ja-*、未指定はja、その他en）。preset/Tabbed dictionaryとeditorOptionsの明示overrideを維持。schemaを変えない。locale/dictionaryはeditor生成時の設定で、編集中のprops変更による無条件remountで未保存入力を捨てない。

全block自動修正は本SDK候補の機能ではない。調査はdocs/notes-agent-block-coverage.md。PA側の入力停止block提案は別作業で、共通SDK側に重複実装していない。
