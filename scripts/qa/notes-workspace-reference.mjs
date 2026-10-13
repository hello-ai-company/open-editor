export default async rootpage => {
 const browser = rootpage.context().browser(), errors=[], external=[], states={};
 const selectors={navigation:'.oe-notes-classic-navigation',tabs:'.oe-notes-tablist',meta:'.oe-notes-page-meta',title:'.oe-notes-title-editor input',surface:'.oe-notes-editor-surface',body:'.bn-editor',blockContent:'.bn-block-content',rail:'.oe-notes-workspace-right',railPanel:'.oe-notes-rail-list',documentSidebar:'.oe-notes-document-sidebar',documentTabs:'.oe-notes-document-sidebar .oe-notes-tabs',library:'.oe-notes-library',libraryRow:'.oe-notes-library-row',hover:'.oe-notes-tool-hover'};
 const fixtures=[['01-desktop-tree-clean'],['02-desktop-style-open','style'],...['clean','editorial','journal','mono','compact','midnight','paperback','postcard','studio','blueprint','gallery','minimal'].map(t=>['theme-'+t,'style',1600,t]),['03-desktop-info-open','info'],['04-document-outline','outline'],...['tasks','media','find-in-page','search-results','comments','history','info'].map(t=>['document-'+t,t]),['05-library','library'],['06-desktop-insert-open'],['07-insert-hover','hover'],['08-split','split'],['09-studio-db-html-columns','studio'],['responsive-1100','responsive',1100],... [840,720,390].flatMap(w=>[['responsive-'+w,'responsive',w],['responsive-'+w+'-pages-open','pages-open',w]])];
 for (const [name,action,width=1600,theme='clean'] of fixtures) {
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1,locale:'en-US',colorScheme:'light',reducedMotion:'reduce'}),page=await context.newPage();
  try {
   page.on('pageerror',e=>errors.push({state:name,message:e.message}));
   await page.route('**/*',r=>{const u=r.request().url();if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)&&!/^(blob|data):/.test(u)){external.push({state:name});return r.abort();}return r.continue();});
   await page.goto('http://127.0.0.1:5199/?notes=synthetic&classic&baseline&hostFrame=reference&pageStyle='+theme);await page.locator('.bn-editor').waitFor();await page.evaluate(()=>document.fonts.ready);
   const rail=page.locator('.oe-notes-inspector');let unavailable=[];
   if(action==='style'||action==='info')await rail.getByRole('tab',{name:action==='style'?'Style':'Info',exact:true}).click();
   if(['outline','tasks','media','find-in-page','search-results','comments','history'].includes(action)||name==='document-info'){
    await rail.getByRole('tab',{name:'Info',exact:true}).click();await page.getByRole('button',{name:'Page tools',exact:true}).click();
    const label={outline:'Outline',tasks:'Tasks',media:'Media','find-in-page':'Find in page','search-results':'Find in page',comments:'Comments',history:'History',info:'Info'}[action];await page.locator('.oe-notes-document-sidebar').getByRole('tab',{name:label,exact:true}).click();if(action==='search-results')await page.locator('.oe-notes-document-sidebar').getByRole('searchbox').fill('Synthetic');
   }
   if(action==='library')await page.getByRole('button',{name:'Library',exact:true}).click();
   if(action==='hover')await rail.getByRole('button',{name:'Text',exact:true}).hover();
   if(action==='pages-open')await page.getByRole('button',{name:'ノート',exact:true}).click();
   if(action==='split'){const tab=page.locator('.oe-notes-tab').first();await tab.getByRole('button',{name:/Options for|の操作$/,exact:false}).click();await page.getByRole('menuitem',{name:'Split right',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.bn-editor').length===2);}
   if(action==='studio')unavailable.push('Host-bound database writer / existing legacy studio fixture is not installed in this reference host. Screenshot is a documented unavailable state, not a studio match.');
   if(action==='comments')unavailable.push('Original Secretary proposal service and original comment/history records remain host owned.');
   const capture=await page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([k,sel])=>[k,Array.from(document.querySelectorAll(sel)).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},documentRect:{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height},computed:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','borderColor','boxShadow','display','position'].map(k=>[k,s[k]]))};})])),selectors);
   states[name]={theme,viewport:{width,height:1000},capture,unavailable,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),pageCount:await page.locator('[role=treeitem]').count(),insertItems:await page.locator('.oe-notes-tool-button').count()};
   await page.screenshot({path:'OUTPUT/'+name+'.png',fullPage:true,animations:'disabled',caret:'hide'});
  } finally {await context.close();}
 }
 if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}));
 return {conditions:{browser:browser.version(),dpr:1,locale:'en-US',light:true,reducedMotion:true,fullPage:true},states,errors,externalRequests:external.length,paidCalls:0,equalityEstablished:false};
};
