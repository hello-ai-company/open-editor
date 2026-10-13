# .31 検証と限定

Mac Node22.14.0 / Chrome154.0.8037.99、専用127.0.0.1:5243。合成response・synthetic memory receipt・専用fixtureのみ。外部POST／実AIなし。

新規20unit条件（範囲16、save continuity4）。SHA source lease、bounds、tamper、pure ghost、disjoint mapping/marks/ID、overlap拒否＋review、native/PM active range、beforeinput、recent入力、IME、stop/late、actor/workspace/pane/session/revision、policy版/上限/失効、zero continuation、canonical save後のUndo、同一再生成抑止、disposal、pending保存のimmutable request、新規draft次save、lost ACK fixed GET、conflictと無許可を検証。

実画面: accepted-final14/14。通常click/native入力、ghostのcanonical／clipboard除外、最新draft apply、AI-only Undoの前後で第二段落を厳密比較、overlap差分、合成IME、停止遅延、A→B→A、保存中の入力継続／request不変、保存後Undoと再保存、unknown固定lookup／再送禁止、conflict保護、Undo後の同一抑止と異なる再生成、auto-safeのactive DOM/model range保護とdisjoint caret維持、390px Reduced Motion長文。

public NotesTabbedWorkspaceの4条件: pane別ticket/ghost、foreign pane拒否、他pane/transportへ影響なし、unmount失効、重複targetのreadonly paneに第二portなし。Columns .30回帰15、HTML durable14、table durable18（既存raw/CAS/unknown/restart等）。65条件。shared synthetic受入をPA実host受入へ転記しない。

全体型検査・example型検査・全テスト1597（Vitest1455＋Node142、BlockNote1146）・build PASS。lint scriptなし、git diff --check PASS。4tarball isolated public declaration/runtime consumerでcoediting export、range apply/Undo、optional per-pane propsを確認する。

全試行を保持。初期browserは13条件中11、次12/13: native click直後のDOMとPM selectionに短い不一致があり、Home/click位置の想定も不適切だった。実target offsetを記録し、PMとvisible DOM両方を保護、beforeinputを保留、native位置を落ち着かせて検証する。Undoの証拠は後続段落の厳密な前後一致。最終14/14。tabbed初回はfixture splitへactiveTabを重複指定しInvalid Notes split、既存形式（追加paneのみ）へ訂正した。SDK layout guardは変更しない。

同shared power.css .30 174346/gzip27115 → .31 174562/gzip27146（+216/+31bytes）。app JS/CSS・CPU4x paint/paste時間とは比較しない。速度の数値比較なし。

PA5491のsecretary/ghost/characterへの接続、canonicalAI適用receipt/audit、durable post-dispatch body draft／restart／AI-Undo再起動保持、実IME/Safari/physical touchは未確認。チケット／Undoはmemoryのlocal session内。保存後の人間入力は次saveまで未保存であり、hostが耐久journalを接続しないままprocess-crash保護を保証しない。既存.28の高速HTML pointer／clean iframe focus制限は継承する。
