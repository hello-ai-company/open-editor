export default async function verifyThemeControls(page) {
  const checks=[],assert=(ok,name)=>{if(!ok)throw new Error(name);checks.push(name);};
  await page.getByRole('button',{name:'Document',exact:true}).click(); await page.setViewportSize({width:1440,height:900});
  const selectTheme=async value=>{await page.locator('.demo-tools > summary').click();await page.getByRole('combobox',{name:'Theme',exact:true}).selectOption(value);await page.keyboard.press('Escape');};
  await selectTheme('dark');
  assert(await page.locator('.local-document-workspace').getAttribute('data-oe-theme')==='dark','outer-toolbar-dark-synchronized');
  await page.screenshot({path:'output/playwright/after-dark-document.png'});
  await page.getByRole('button',{name:'Canvas',exact:true}).click();await page.locator('.oe-canvas').waitFor();
  assert(await page.locator('.oe-canvas__inspector').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(34, 48, 40)'),'canvas-dark-panel-background');
  await page.screenshot({path:'output/playwright/after-dark-canvas.png'});
  const surfaceColor=await page.locator('.oe-canvas__surface').evaluate(el=>getComputedStyle(el).backgroundColor);
  await selectTheme('light');await page.emulateMedia({colorScheme:'dark'});
  assert(await page.locator('.local-document-controls').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(255, 255, 255)'),'explicit-light-overrides-system-for-toolbar');
  assert(await page.locator('.oe-canvas__surface').evaluate(el=>getComputedStyle(el).backgroundColor)===surfaceColor,'theme-preserves-canvas-content-palette');
  await page.getByRole('button',{name:'Document',exact:true}).click();await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
  for(const width of [320,390]) {
    await page.setViewportSize({width,height:844});await page.locator('.local-storage-note > summary').click();
    assert(await page.locator('.local-storage-note small').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),`storage-popup-fits-${width}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`page-fits-${width}`);
    await page.screenshot({path:`output/playwright/after-storage-${width}.png`});await page.locator('.local-storage-note > summary').click();
  }
  await page.setViewportSize({width:1440,height:900});
  const slider=page.getByRole('slider',{name:'Column 1 relative width'});
  const value=Number(await slider.inputValue());await slider.focus();await page.keyboard.press(value<4?'ArrowRight':'ArrowLeft');
  assert(Number(await slider.inputValue())!==value,'column-keyboard-resize');
  assert(await page.getByRole('button',{name:'Move column 1 later'}).evaluate(el=>el.getBoundingClientRect().width>=44&&el.getBoundingClientRect().height>=44),'column-arrow-44-square');
  await page.screenshot({path:'output/playwright/after-columns.png',fullPage:true});
  const widget=page.getByRole('region',{name:'HTML widget',exact:true}).first();await widget.getByRole('button',{name:'Edit source',exact:true}).click();
  await page.screenshot({path:'output/playwright/after-html-editor.png'});await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});return {checks,browser:page.context().browser()?.version()};
}
