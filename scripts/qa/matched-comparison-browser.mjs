export default async function captureMatchedComparison(page) {
  // The CLI profile contains only our synthetic document. Copy that one fixture in memory.
  const record=await page.evaluate(async()=>{
    const id=new URL(location.href).searchParams.get('document');
    return await new Promise((resolve,reject)=>{const open=indexedDB.open('open-editor.documents.v1',1);open.onsuccess=()=>{const db=open.result,tx=db.transaction('documents','readonly'),request=tx.objectStore('documents').get(JSON.stringify(['local-browser','local-documents'])+':'+id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();};open.onerror=()=>reject(open.error);});
  });
  if(!record || record.actorId!=='local-browser'||record.workspaceId!=='local-documents'||record.title!=='Workspace primitives')throw new Error('Expected owned synthetic QA fixture');
  const checks=[];
  for(const [label,port] of [['before',5198],['after',5199]]) {
    const context=await page.context().browser().newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',colorScheme:'light'}), probe=await context.newPage();
    try {
      await probe.route(`http://127.0.0.1:${port}/__qa_seed`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic fixture seed</title>'}));
      await probe.goto(`http://127.0.0.1:${port}/__qa_seed`);
      await probe.evaluate(async record=>await new Promise((resolve,reject)=>{const request=indexedDB.open('open-editor.documents.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('documents');request.onsuccess=()=>{const db=request.result,tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(record,JSON.stringify(['local-browser','local-documents'])+':'+record.id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);}),record);
      await probe.goto(`http://127.0.0.1:${port}/?document=${record.id}`); await probe.locator('.bn-editor').waitFor();
      for(const mode of ['Document','Canvas','Present','Site']) {
        await probe.getByRole('button',{name:mode,exact:true}).click();
        if(mode==='Canvas')await probe.locator('.oe-canvas').waitFor();
        if(mode==='Present'||mode==='Site')await probe.locator('.demo-published-preview').waitFor();
        await probe.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await probe.screenshot({path:`output/playwright/matched-${label}-${mode.toLowerCase()}.png`});checks.push(`${label}-${mode}`);
      }
    } finally {await context.close();}
  }
  return {checks,sameStoredRevision:record.revision,sameFixture:true,viewport:{width:1440,height:900}};
}
