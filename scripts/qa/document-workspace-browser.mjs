// Run this function with playwright-cli run-code after opening the local example.
// Synthetic content only; no account or model calls. Inserts missing test blocks through the UI.
export default async function verifyDocumentWorkspace(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const report = { checks: [], browser: page.context().browser()?.version() };
  const passed = name => report.checks.push(name);
  await page.setViewportSize({ width: 1440, height: 900 });
  const insert = async name => {
    await page.getByRole('button', { name: 'Open commands, Command K' }).click();
    await page.getByRole('combobox', { name: 'Type a command…' }).fill(name);
    await page.getByRole('option', { name, exact: true }).click();
  };
  if (!await page.locator('[data-oe-document-columns]').count()) await insert('Columns');
  if (!await page.getByRole('region', { name: 'HTML widget', exact: true }).count()) await insert('HTML widget');
  const group = page.locator('[data-oe-document-columns]').first();
  assert(await group.locator('.bn-block-group').first().evaluate(element => getComputedStyle(element).display === 'grid'), 'Columns must use grid');
  const widths = await group.locator('.bn-block-group').first().evaluate(element => getComputedStyle(element).gridTemplateColumns);
  assert(widths.trim().split(/\s+/).length === 2, 'Desktop needs two tracks'); passed('desktop-columns');
  const widget = page.getByRole('region', { name: 'HTML widget', exact: true }).first();
  await widget.getByRole('button', { name: 'Edit source', exact: true }).click();
  assert(await widget.getByRole('button', { name: 'Edit source', exact: true }).isDisabled(), 'Repeated editor opener must be disabled');
  const html = '<article><h2>Safe preview</h2><p>Saved content</p></article><script>window.__OE_WIDGET_EXECUTED=true</script><img src="https://example.invalid/image" onerror="alert(1)"><iframe src="https://example.invalid/frame"></iframe>';
  await widget.getByRole('textbox', { name: 'HTML source', exact: true }).fill(html);
  await widget.getByRole('button', { name: 'JAVASCRIPT', exact: true }).click();
  await widget.getByRole('textbox', { name: 'JAVASCRIPT source', exact: true }).fill('window.__OE_WIDGET_EXECUTED=true;fetch("https://example.invalid/script")');
  await widget.getByRole('button', { name: 'Apply source', exact: true }).click();
  const frame = widget.locator('iframe');
  assert(await frame.getAttribute('sandbox') === '', 'Widget must have an empty sandbox');
  const preview = await frame.getAttribute('srcdoc');
  assert(preview.includes("script-src 'none'") && preview.includes("connect-src 'none'"), 'CSP must deny script/network');
  assert(!preview.includes('<script>') && !preview.includes('<img ') && !preview.includes('<iframe ') && !preview.includes('example.invalid'), 'Active markup must not enter preview');
  const contentFrame = await (await frame.elementHandle()).contentFrame();
  assert(!await contentFrame.evaluate(() => window.__OE_WIDGET_EXECUTED), 'Widget JavaScript must not execute');
  passed('inert-script-and-resource-markup');
  await widget.getByRole('button', { name: 'Edit source', exact: true }).click();
  await widget.getByRole('button', { name: 'HTML', exact: true }).click();
  await widget.getByRole('textbox', { name: 'HTML source', exact: true }).fill('Discard this edit');
  await page.keyboard.press('Escape');
  assert(await widget.getByRole('region', { name: 'Edit widget source' }).count() === 0, 'Escape must close editor');
  assert(await page.getByRole('button', { name: 'Edit source', exact: true }).evaluate(element => element === document.activeElement), 'Cancel must restore opener focus');
  await widget.getByRole('button', { name: 'Edit source', exact: true }).click();
  await widget.getByRole('button', { name: 'HTML', exact: true }).click();
  assert(await widget.getByRole('textbox', { name: 'HTML source', exact: true }).inputValue() === html, 'Cancel must preserve saved source'); passed('cancel-escape-focus');
  // Simulate a file read resolving after Cancel without accessing any user file.
  await page.evaluate(() => {
    window.__oeOriginalFileText = File.prototype.text;
    File.prototype.text = function () { return new Promise(resolve => { window.__oeResolveFileRead = () => { resolve('{"html":"Delayed import","css":"","javascript":""}'); window.__oeFileReadResolved = true; }; }); };
  });
  try {
    await widget.locator('input[type=file]').evaluate(element => {
      const transfer = new DataTransfer(); transfer.items.add(new File(['{}'], 'synthetic-widget.json', { type: 'application/json' }));
      element.files = transfer.files; element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await widget.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => { window.__oeResolveFileRead(); File.prototype.text = window.__oeOriginalFileText; });
    await page.waitForFunction(() => window.__oeFileReadResolved === true);
    assert(await widget.getByRole('region', { name: 'Edit widget source' }).count() === 0, 'Delayed import must not reopen cancelled editor');
  } finally { await page.evaluate(() => { File.prototype.text = window.__oeOriginalFileText; delete window.__oeOriginalFileText; delete window.__oeResolveFileRead; delete window.__oeFileReadResolved; }); }
  passed('delayed-import-cancel');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await group.locator('.bn-block-group').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length === 1), 'Narrow screen must stack columns');
  await widget.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  assert(await frame.evaluate(element => element.getBoundingClientRect().width <= 320), 'Mobile frame should fit');
  passed('mobile-and-reduced-motion');
  await page.waitForFunction(() => /Saved locally/.test(document.querySelector('[role=status]')?.textContent ?? ''));
  await page.reload();
  await page.getByRole('region', { name: 'HTML widget', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit source', exact: true }).click();
  await page.getByRole('button', { name: 'HTML', exact: true }).click();
  assert(await page.getByRole('textbox', { name: 'HTML source', exact: true }).inputValue() === html, 'Saved source must survive reload');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); passed('save-reopen');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'output/playwright/document-workspace-desktop.png', fullPage: true });
  return report;
}
