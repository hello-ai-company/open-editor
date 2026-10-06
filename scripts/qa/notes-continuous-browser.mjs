export default async function verifyContinuousInput(page) {
  const context = await page.context().browser().newContext(), probe = await context.newPage();
  try {
    await probe.goto('http://127.0.0.1:5199'); await probe.locator('.bn-editor').waitFor();
    const editor = probe.locator('.bn-editor'), text = editor.locator('[data-content-type=paragraph] .bn-inline-content').filter({hasText:/\S/}).first();
    const started = Date.now(), failures = [];
    await text.click(); await probe.keyboard.press('Meta+ArrowRight');
    const cdp = await context.newCDPSession(probe); await cdp.send('Performance.enable');
    const metrics = async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','Nodes','JSEventListeners'].includes(m.name)).map(m=>[m.name,m.value]));
    const before = await metrics();
    for (let cycle=0;cycle<60;cycle++) {
      for(let edit=0;edit<6;edit++) await probe.keyboard.insertText(` 日本語継続${cycle}_${edit}。`);
      if(cycle%10===0) {
        await probe.keyboard.press('Meta+s');
        await probe.waitForFunction(()=>/Saved locally/.test(document.querySelector('[data-testid=document-save-status]')?.textContent??''));
      }
      await probe.waitForTimeout(3000);
    }
    await probe.keyboard.press('Meta+s'); await probe.waitForFunction(()=>/Saved locally/.test(document.querySelector('[data-testid=document-save-status]')?.textContent??''));
    const content = await editor.locator('.bn-inline-content').allTextContents();
    if(!content.some(t=>t.includes('日本語継続59_5')))failures.push('final-input-missing');
    await probe.reload(); await editor.waitFor();
    if(JSON.stringify(await editor.locator('.bn-inline-content').allTextContents())!==JSON.stringify(content))failures.push('saved-text-differs');
    if(failures.length)throw new Error(failures.join(','));
    const afterReload = await metrics();
    return {browser:page.context().browser().version(),elapsedMs:Date.now()-started,edits:360,language:'Japanese text via insertText; no native IME',before,afterReload,checks:['360-continuous-inputs','periodic-acknowledged-saves','last-marker-retained','all-rich-text-equal-after-reload'],limits:'Three-minute synthetic workload. No hours/days soak, native IME, production persistence or memory leak proof.'};
  } finally { await context.close(); }
}
