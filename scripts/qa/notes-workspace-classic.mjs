export default async rootpage => {
 const context = await rootpage.context().browser().newContext({ viewport:{width:1600,height:1000},deviceScaleFactor:1,locale:"en-US",colorScheme:"light",reducedMotion:"reduce" });
 const page = await context.newPage();
 try {
 const errors=[], external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const url=r.request().url();if(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)&&!/^(data|blob):/.test(url)){external.push(url);return r.abort();}return r.continue();});
 await page.setViewportSize({width:1600,height:1000});await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});
 const selectors={body:'.bn-editor',blockContent:'.bn-block-content',title:'.oe-notes-title-editor input',rail:'.oe-notes-workspace-right',navigation:'.oe-notes-classic-navigation',detail:'.oe-notes-classic-detail',surface:'.oe-notes-editor-surface',modeButton:'.oe-notes-modes [role=tablist] button'};
 const themes={}, widths={};
 for(const theme of ['clean','editorial','journal','mono','compact','midnight','paperback','postcard','studio','blueprint','gallery','minimal']){
   await page.goto('http://127.0.0.1:5199/?notes=synthetic&classic&baseline&hostFrame=reference&pageStyle='+theme);await page.locator('.bn-editor').waitFor();await page.evaluate(()=>document.fonts.ready);
   if(await page.locator('.bn-editor').innerText()!=='Synthetic original body')throw new Error('Reference body differs');
   if(await page.locator('.oe-notes-title-editor input').inputValue()!=='Synthetic integration note')throw new Error('Reference title differs');
   themes[theme]=await page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{const n=document.querySelector(selector),s=getComputedStyle(n),r=n.getBoundingClientRect();return [key,{rect:{x:r.x,y:r.y,width:r.width,height:r.height},computed:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','borderColor','boxShadow','display','position'].map(key=>[key,s[key]]))}]})),selectors);
   await page.screenshot({path:'output/verification-notes8/theme-'+theme+'.png',fullPage:true,animations:'disabled',caret:'hide'});
 }
 const storage=await page.evaluate(async()=>{const {verifyLocalLayoutStorage}=await import('/notes-storage-probe.mjs');return await verifyLocalLayoutStorage();});
 for(const width of [1100,840,720,390]) {await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:5199/?notes=synthetic&classic&baseline&hostFrame=reference');await page.locator('.bn-editor').waitFor();await page.evaluate(()=>document.fonts.ready);widths[width]={overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),navigationVisible:await page.locator('.oe-notes-workspace-left').isVisible(),compact:await page.locator('.oe-notes-workspace').getAttribute('data-compact')};await page.screenshot({path:'output/verification-notes8/responsive-'+width+'.png',fullPage:true,animations:'disabled',caret:'hide'});if(width===1100){if(!widths[width].navigationVisible)throw new Error('Desktop1100 navigation hidden');continue;}await page.getByRole('button',{name:'ノート',exact:true}).click();await page.getByRole('dialog',{name:'ノートを選択',exact:true}).waitFor();const dialog=page.getByRole('dialog',{name:'ノートを選択',exact:true});for(let i=0;i<12;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');if(!await dialog.evaluate(n=>n.contains(document.activeElement)))throw new Error('Drawer Tab escaped');}widths[width].tabTrap=true;await page.keyboard.press('Escape');widths[width].focusReturned=await page.getByRole('button',{name:'ノート',exact:true}).evaluate(n=>n===document.activeElement);widths[width].escapeClosed=!await page.locator('.oe-notes-workspace-left').isVisible(); }
 return {conditions:{viewport:'1600x1000',dpr:await page.evaluate(()=>devicePixelRatio),locale:await page.evaluate(()=>navigator.language),browser:await page.evaluate(()=>navigator.userAgent),reducedMotion:true,hostReserve:268,body:'Synthetic original body',title:'Synthetic integration note'},themes,widths,storage,errors,externalRequests:external.length};
} finally { await context.close(); }
};
