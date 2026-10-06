// Local synthetic data only. Does not exercise a native OS IME or a real AI/provider.
export default async function verifyNotesContracts(page) {
  const checks = [], assert = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  await page.goto('http://127.0.0.1:5199'); await page.locator('.bn-editor').waitFor();
  await page.getByText('Notes保存契約の合成デモ',{exact:true}).click();
  const form = page.getByRole('form',{name:'tagsの編集'}), input = form.getByRole('textbox');
  const saved = page.getByLabel('合成DBの保存値');
  await input.fill('["beta","gamma"]'); await page.keyboard.press('Escape');
  assert(await input.inputValue()==='["alpha"]','Escape-discards-only-uncommitted-draft');
  await input.fill('["unknown-option"]'); await form.getByRole('button',{name:'確認して保存'}).click();
  assert((await saved.innerText()).includes('"revision":"1"'),'invalid-option-never-saves');
  await input.fill('["beta","gamma"]'); await form.getByRole('button',{name:'確認して保存'}).evaluate(el=>{el.click();el.click();});
  await page.waitForFunction(()=>document.querySelector('[aria-label="合成DBの保存値"]')?.textContent.includes('"revision":"2"'));
  assert((await saved.innerText()).includes('"tags":["beta","gamma"]'),'explicit-complex-property-save-once');
  assert((await saved.innerText()).includes('"future":{"preserved":true}'),'unknown-concurrent-fields-retained');
  await page.getByRole('button',{name:'次の保存応答を失わせる（合成）'}).click();
  await form.getByRole('button',{name:'最新値に戻す'}).click(); await input.fill('["alpha","beta"]');
  await form.getByRole('button',{name:'確認して保存'}).click();
  await form.getByRole('button',{name:'保存結果を照会'}).waitFor();
  assert(await form.getByRole('button',{name:'確認して保存'}).isDisabled(),'lost-ACK-blocks-resubmit');
  await form.getByRole('button',{name:'保存結果を照会'}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="合成DBの保存値"]')?.textContent.includes('"revision":"3"'));
  assert((await saved.innerText()).includes('"tags":["alpha","beta"]'),'lookup-confirms-original-operation');
  await page.setViewportSize({width:320,height:844}); await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'complex-editor-320px-no-overflow');
  await page.screenshot({path:'output/playwright-notes1/complex-property-mobile.png'});
  await page.setViewportSize({width:1440,height:900});
  // Shared IndexedDB, two real tabs, same revision. Only one tab may save it.
  const context = await page.context().browser().newContext(), first = await context.newPage(), second = await context.newPage();
  try {
    await first.goto('http://127.0.0.1:5199'); await first.locator('.bn-editor').waitFor();
    await second.goto(first.url()); await second.locator('.bn-editor').waitFor();
    const text = p=>p.locator('.bn-editor [data-content-type=paragraph] .bn-inline-content').filter({hasText:/\S/}).first();
    await text(first).click(); await first.keyboard.press('Meta+ArrowRight'); await first.keyboard.insertText(' FIRST_TAB_CANONICAL');
    await first.keyboard.press('Meta+s'); await first.waitForFunction(()=>/Saved locally/.test(document.querySelector('[data-testid=document-save-status]')?.textContent??''));
    await text(second).click(); await second.keyboard.press('Meta+ArrowRight'); await second.keyboard.insertText(' SECOND_TAB_UNSAVED'); await second.keyboard.press('Meta+s');
    await second.waitForFunction(()=>/Another tab saved/.test(document.querySelector('[data-testid=document-save-status]')?.textContent??''));
    assert((await second.locator('.bn-editor').innerText()).includes('SECOND_TAB_UNSAVED'),'losing-tab-keeps-human-draft');
    await first.reload(); await first.locator('.bn-editor').waitFor();
    const body = await first.locator('.bn-editor').innerText();
    assert(body.includes('FIRST_TAB_CANONICAL')&&!body.includes('SECOND_TAB_UNSAVED'),'second-tab-cannot-overwrite-canonical-save');
    const losingUrl = second.url();
    await second.getByRole('button',{name:'Save edits as a new copy',exact:true}).click();
    await second.waitForFunction(previous=>location.href!==previous,losingUrl);
    assert(first.url()!==second.url(),'recovery-copy-gets-independent-identity');
    await second.reload(); await second.locator('.bn-editor').waitFor();
    assert((await second.locator('.bn-editor').innerText()).includes('SECOND_TAB_UNSAVED'),'recovered-human-draft-survives-reload');
    await second.screenshot({path:'output/playwright-notes1/multitab-recovered.png'});
  } finally { await context.close(); }
  return {browser:page.context().browser().version(),checks,scope:'synthetic properties; real Chromium tabs; local IndexedDB CAS; no native IME/model/production Notes provider'};
}
