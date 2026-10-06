// CLI run-code function; synthetic local document only. Never calls an AI provider.
export default async function verifyQuietAndVisual(page) {
  const checks = [], assert = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  await page.reload(); await page.locator('.bn-editor').waitFor();
  await page.setViewportSize({ width:1440, height:900 });
  await page.emulateMedia({ reducedMotion:'no-preference', colorScheme:'light' });
  await page.getByRole('button',{ name:'Document', exact:true }).click();
  const editor = page.locator('.bn-editor');
  const before = await editor.innerText();
  for (const mode of ['Document','Canvas','Present','Site']) {
    await page.getByRole('button',{name:mode,exact:true}).click();
    if(mode==='Canvas') await page.locator('.oe-canvas').waitFor();
    if(mode==='Present'||mode==='Site') await page.locator('.demo-published-preview').waitFor();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:`output/playwright/after-${mode.toLowerCase()}.png`});
    assert(await page.getByRole('button',{name:mode,exact:true}).evaluate(el=>el.getAttribute('aria-pressed')==='true' && el.getBoundingClientRect().height>=44 && getComputedStyle(el).fontSize==='13px'), `compact-${mode}`);
  }
  await page.getByRole('button',{name:'Document',exact:true}).click();
  assert(await editor.innerText()===before,'mode-switch-preserves-body');
  await page.getByRole('button',{name:'Search this document'}).click();
  await page.screenshot({path:'output/playwright/after-search.png'});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Open commands, Command K'}).click();
  await page.screenshot({path:'output/playwright/after-commands.png'});
  await page.keyboard.press('Escape');
  assert(await editor.innerText()===before,'panel-open-close-preserves-body');
  const card = page.getByRole('region',{name:'控えめな共同作業'}), checkbox = card.getByRole('checkbox');
  assert(!await checkbox.isChecked(),'quiet-requires-permission');
  await checkbox.check();
  const text = editor.locator('[data-content-type=paragraph] .bn-inline-content').filter({hasText:/\S/}).first();
  await text.click(); await page.keyboard.press('Meta+ArrowRight');
  await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const selection = () => page.evaluate(()=>{const s=getSelection();return {anchor:s?.anchorNode?.textContent,offset:s?.anchorOffset,focus:s?.focusNode?.textContent,end:s?.focusOffset,scroll:scrollY,active:document.activeElement?.className};});
  const cursor = await selection();
  await card.getByRole('button',{name:'許可して記載',exact:true}).waitFor();
  assert(await editor.innerText()===before,'hypothesis-never-writes');
  const afterReady = await selection();
  assert(JSON.stringify(cursor)===JSON.stringify(afterReady),`hypothesis-keeps-cursor-and-scroll ${JSON.stringify({cursor,afterReady})}`);
  // Synthetic composition events verify integration, not an OS/Japanese IME.
  await editor.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'確認'})));
  assert(await card.getByRole('button',{name:'許可して記載',exact:true}).count()===0,'ime-clears-proposal');
  await editor.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'確認'})));
  await card.getByRole('button',{name:'許可して記載',exact:true}).waitFor();
  await card.getByRole('button',{name:'この案を使わない',exact:true}).click();
  assert(await editor.innerText()===before,'reject-keeps-body');
  await text.click(); await page.keyboard.press('Meta+ArrowRight'); await page.keyboard.insertText(' Synthetic verification.');
  const human = await editor.innerText();
  await card.getByRole('button',{name:'許可して記載',exact:true}).waitFor();
  await page.screenshot({path:'output/playwright/after-quiet-review.png'});
  await card.getByRole('button',{name:'許可して記載',exact:true}).evaluate(el=>{el.click();el.click();});
  const accepted = await editor.innerText();
  assert(accepted.split('次に確かめたいこと：').length===human.split('次に確かめたいこと：').length+1,'explicit-approval-once');
  await card.getByRole('button',{name:'記載をUndo',exact:true}).click();
  assert(await editor.innerText()===human,'undo-restores-approved-base');
  // Allow another bounded local run, then protect a human change after acceptance.
  await text.click(); await page.keyboard.press('Meta+ArrowRight'); await page.keyboard.insertText(' More context.');
  await card.getByRole('button',{name:'許可して記載',exact:true}).waitFor();
  await card.getByRole('button',{name:'許可して記載',exact:true}).click();
  await text.click(); await page.keyboard.press('Meta+ArrowRight'); await page.keyboard.insertText(' Human edit after approval.');
  const protectedBody = await editor.innerText();
  const protectedRichText = await editor.locator('.bn-inline-content').allTextContents();
  await card.getByRole('button',{name:'記載をUndo',exact:true}).click();
  assert(await editor.innerText()===protectedBody,'undo-refuses-overwriting-human-edit');
  await card.getByRole('button',{name:'提案を停止',exact:true}).click();
  assert(!await checkbox.isChecked(),'stop-synchronizes-checkbox');
  await page.getByRole('button',{name:'Outline',exact:true}).click();
  await page.setViewportSize({width:390,height:844}); await page.emulateMedia({reducedMotion:'reduce'});
  for (const mode of ['Document','Canvas','Present','Site']) {
    await page.getByRole('button',{name:mode,exact:true}).click();
    if(mode==='Canvas') await page.locator('.oe-canvas').waitFor();
    if(mode==='Present'||mode==='Site') await page.locator('.demo-published-preview').waitFor();
    await page.screenshot({path:`output/playwright/after-mobile-${mode.toLowerCase()}.png`});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`mobile-no-page-overflow-${mode}`);
    assert(await page.locator('.demo-view').first().evaluate(el=>getComputedStyle(el).transitionDuration==='0s'),`reduced-motion-${mode}`);
  }
  await page.getByRole('button',{name:'Document',exact:true}).click();
  await page.keyboard.press('Meta+s');
  await page.waitForFunction(()=>/Saved locally/.test(document.querySelector('[data-testid=document-save-status]')?.textContent??''));
  await page.reload(); await editor.waitFor();
  // Host DB row/load controls are view state. Compare persisted rich text, not that UI.
  const reloadedRichText = await editor.locator('.bn-inline-content').allTextContents();
  assert(JSON.stringify(reloadedRichText)===JSON.stringify(protectedRichText),`human-and-accepted-content-save-reload ${JSON.stringify({protectedRichText,reloadedRichText})}`);
  assert(!await card.getByRole('checkbox').isChecked(),'reload-requires-new-opt-in');
  await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:'no-preference'});
  return {browser:page.context().browser()?.version(),checks};
}
