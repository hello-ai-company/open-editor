export default async page => {
  const setting = async action => { await page.getByRole('button',{name:'ノートと提案の設定',exact:true}).click(); await action(); await page.getByRole('button',{name:'設定を閉じる',exact:true}).click(); };
  const advancedSetting = async action => setting(async () => { if (!await page.locator('.organization-diagnostics').evaluate(d => d.open)) await page.getByText('デモの検証と機能情報',{exact:true}).click(); await action(); });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.locator('.bn-inline-content').first().waitFor();
  const read = () => page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('open-editor.synthetic-organization.v2'); r.onsuccess = () => { const d = r.result, t = d.transaction('workspace'), q = t.objectStore('workspace').get('tree'); q.onsuccess = () => resolve(q.result); t.oncomplete = () => d.close(); }; }));
  await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('open-editor.synthetic-organization.v2'); r.onsuccess = () => { const d = r.result, t = d.transaction('workspace', 'readwrite'), s = t.objectStore('workspace'), q = s.get('tree'); q.onsuccess = () => { const w = q.result, n = w.notes.note; n.revision = 'r2'; n.pinRevision = 'p2'; n.titleManual = true;
    const props = { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' }, text = value => ({ type: 'text', text: value, styles: { italic: true } });
    n.document.blocks = [
      { id: 'prose', type: 'paragraph', props, content: [text('重要な参考を保持します。内容も参照先も未確認です。')] },
      { id: 'normal', type: 'paragraph', props, content: [{ type: 'link', href: 'HTTPS://EXAMPLE.COM:443/guide', content: [text('重要な引用')] }] },
      { id: 'duplicate', type: 'paragraph', props, content: [{ type: 'link', href: 'https://example.com/guide', content: [text('重複している参考')] }] },
      { id: 'label', type: 'paragraph', props, content: [{ type: 'link', href: 'oe-page:travel', content: [text('古い旅ページ')] }] },
      { id: 'add', type: 'paragraph', props, content: [text('原文 https://example.com/help を確認予定。')] }
    ]; s.put(w, 'tree'); }; t.oncomplete = () => { d.close(); resolve(true); }; }; }));
  await page.reload(); await page.locator('.bn-inline-content').first().waitFor(); const before = await read();
  await setting(async () => { await page.getByRole('checkbox', { name: 'このノートで控えめな提案を受け取る', exact: true }).check(); });
  await page.getByRole('group', { name: '整理案の確認', exact: true }).waitFor({ timeout: 17000 });
  await page.getByText('変更の内訳',{exact:true}).click();
  if (await page.getByRole('group', { name: '整理案の確認' }).locator('li').count() !== 4) throw new Error('Expected normalization, duplicate unlink, grounded label edit, original URL add');
  const prepared = await read(); if (JSON.stringify(prepared.notes.note.document) !== JSON.stringify(before.notes.note.document)) throw new Error('Destructive proposal applied without review');
  await page.screenshot({ path: 'OUTPUT/link-review.png', fullPage: true });
  await page.getByRole('button', { name: 'この案を承認', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.bn-inline-content')].some(x => x.textContent === '旅'), null, { timeout: 10000 });
  const after = await read(); const blocks = after.notes.note.document.blocks;
  if (blocks[1].content[0].href !== 'https://example.com/guide' || blocks[2].content[0].type !== 'text' || blocks[2].content[0].text !== '重複している参考' || blocks[3].content[0].content[0].text !== '旅' || blocks[4].content[1].href !== 'https://example.com/help') throw new Error('Structured link operations failed');
  if (!blocks[2].content[0].styles.italic || !blocks[3].content[0].content[0].styles.italic) throw new Error('Link styling lost');
  await page.getByRole('button', { name: '本文・リンク・タイトル・配置をUndo', exact: true }).click(); await page.waitForTimeout(700);
  const undo = await read(); if (JSON.stringify(undo.notes.note.document) !== JSON.stringify(before.notes.note.document)) throw new Error('Link Undo did not restore exact original');
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { additions: true, hrefCorrection: true, staleInternalLabel: true, duplicateUnlinkPreservesQuotation: true, approvalRequired: true, stylesRetained: true, exactOriginalUndo: true, errors };
};
