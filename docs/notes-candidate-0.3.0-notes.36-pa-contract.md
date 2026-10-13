# .36 PA接続・採用の境界

PA checkout/source/data/API/configは読み取りのみ。本SDK候補は共通言語・操作toolbar・selection entryだけ。実ホストへの採用、現在のURLで「エディター下のデータベース」の配置確認、gallery row/canonical carrier、app frame/sidebar、実AI/providerは親のhost検証範囲。canonical databaseViewを推測で除去しない。

選択UIの .36 renderer contract と selectionProposal.open を採用しても、hostのDocumentProposalPanel生成/採用/Undo、budget、権限、memory approval、canonical revision/receipt・audit確認はそのまま必要。SDK callbackはreviewを開くことのみ。原本Notesのsave responseによる新入力消失は今回のSDK修正範囲外。

入力停止時のblock proposalはPA側の別実装。.35読取hostのparagraph appendに型付きpatchを足す必要があり、.36 SDK自体が全block自動修正を実装したものではない。QuietCooperationCard.changes [{id,before,after}]、NotesProposalRail details/composing/pending/async callbacks、NotesWorkspace.proposal ReactNodeを使用可能。権限・入力再開/IME/timing・CAS・canonical型/field ownership・一括採用・永続Undoはhost側が実装・検証する。詳細docs/notes-agent-block-coverage.md。

自動採用は既存text coeditingのscoped auto-safe policyだけ。見出し化・list化・move batchへ黙って広げない。未知blockはopaque保持、DB/shared/referenceは独立resourceのbindingとreceipt。実際のhost/modelによるblock提案の完成・採用は本SDKブラウザ試験で確認していない。
