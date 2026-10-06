from pathlib import Path
import html
import json

root = Path(__file__).resolve().parents[2]
directory = root / 'output' / 'review'
directory.mkdir(parents=True, exist_ok=True)
performance = root / 'output' / 'performance' / 'comparison.json'
metric = json.loads(performance.read_text()) if performance.exists() else None
rows = ''
if metric:
    for name, values in metric['metrics'].items():
        rows += f'<tr><td>{html.escape(name)}</td><td>{values["medianEditorReadyMs"]:.1f} ms</td><td>{values["medianPasteMs"]:.1f} ms</td></tr>'
mode_pages = ''.join(f'<section class="page"><h2>{mode.title()} · 比較</h2><div class="pair"><figure><figcaption>再開前</figcaption><img src="../playwright/matched-before-{mode}.png"></figure><figure><figcaption>今回の候補</figcaption><img src="../playwright/matched-after-{mode}.png"></figure></div><p>同じ合成文書、1440×900。モード名13px、操作領域44px、落ち着いた色・余白・数字・短い動作へ統一。本文と保存経路は保持しています。</p></section>' for mode in ['document','canvas','present','site'])
report = '''<!doctype html><html lang="ja"><meta charset="utf-8"><title>OpenEditor · local candidate review</title><style>
@page { size:A4 landscape; margin:14mm; } * {box-sizing:border-box} body {font:13px/1.65 system-ui,-apple-system,sans-serif;color:#23352b;background:white;margin:0} h1{font-size:30px;letter-spacing:-.03em} h2{font-size:22px;font-weight:600} h3{font-size:15px} p{max-width:1000px} .page{page-break-after:always;break-after:page;min-height:155mm} .page:last-child{break-after:auto;page-break-after:auto} .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px} figure{margin:0} img{width:100%;border:1px solid #d8e0d9;border-radius:8px} figcaption{font-size:12px;color:#52645a;margin-bottom:8px} table{border-collapse:collapse} td,th{padding:8px 16px;border-bottom:1px solid #d8e0d9;text-align:left;font-variant-numeric:tabular-nums} .tag{background:#e7efe7;padding:4px 10px;border-radius:6px} .mobile{display:flex;gap:12px;align-items:start}.mobile img{width:21%;height:auto}
</style><section class="page"><p class="tag">ローカル候補 · 未公開 · 2026-10-06</p><h1>OpenEditor の共同編集と見た目</h1><p>本文を中心にした4モードの操作表示、独立した文書カラム、安全なHTMLソース編集、意図の仮説を静かに示すAI提案をまとめた候補です。提案だけでは本文を変更せず、明示的に許可した段落をまとめて記載します。</p><h3>検証</h3><p>型検査・全853テスト・build、ベンチマーク4件。独立したAI状態／StrictMode検証と、合成文書による実Chrome回帰を実施。実行結果の詳細は同梱QA記録と受入契約を参照してください。</p><h3>段階的な引き継ぎ</h3><p>候補は0.3.0-notes.0のローカルtarballで、公開済み0.2.0とは別です。既存作業・本人文書を移行せず、push・マージ・npm公開・新規インストール・実AI送信を行っていません。</p><h3>残る範囲</h3><p>Notes全機能の置き換えは未完了です。DBの追加プロパティ・計算・履歴、高度な表、ホワイトボード等はホスト側を保持してください。HTMLのJavaScriptは保持しますが実行しません。新カスタムブロックのCanvas／Present／Site描画、構造編集時の細かい選択範囲、実IME・Safari・本番ホスト受入は未確認または未実装です。</p></section>'''
report += mode_pages
report += '<section class="page"><h2>狭い画面 · 390×844</h2><div class="mobile">' + ''.join(f'<img src="../playwright/after-mobile-{mode}.png" alt="{mode}">' for mode in ['document','canvas','present','site']) + '</div><p>カラムは縦に積み、モード切り替えの操作領域を維持。Reduced Motionでは動作を停止します。</p></section>'
report += '<section class="page"><h2>性能と検証の境界</h2><p>Chromium 154、1440×900、CPU 4倍制限、各1回のウォームアップ後に5回の中央値。再開前の候補buildと今回の候補buildを、新しい同一条件の合成文書コンテキストで比較しています。</p>'
if metric:
    report += '<table><tr><th>候補</th><th>編集画面が表示されるまで</th><th>500段落貼り付け</th></tr>' + rows + '</table>'
else:
    report += '<p>同条件のブラウザー性能計測は未完了です。</p>'
report += '<p>測定はnavigationからeditor可視＋2フレーム、合成pasteイベントから500段落表示＋2フレーム。旧測定の391ms／598msとは定義・Chrome・buildが異なるため直接比較しません。主JS chunkは約1.40MBで既存の500KB超警告が残り、今回を速度改善と断定しません。</p><p>実モデル・課金・外部送信・実ファイルアップロード・本番認証／DB競合は試していません。安全なfixtureのみで確認しています。</p></section></html>'
(directory / 'OpenEditor-candidate-review.html').write_text(report)
print(directory / 'OpenEditor-candidate-review.html')
