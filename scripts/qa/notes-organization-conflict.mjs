export default async (page) => {
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 const dbWork=(action,data)=>page.evaluate(({action,data})=>new Promise((resolve,reject)=>{const r=indexedDB.open('open-editor.synthetic-organization.v1',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('workspace',action==='read'?'readonly':'readwrite'),s=t.objectStore('workspace');let result;if(action==='read'){const q=s.get('tree');q.onsuccess=()=>result=q.result;}else{s.put(data,'tree');result=true;}t.oncomplete=()=>{db.close();resolve(result);};t.onabort=()=>reject(new Error('fixture transaction'));};}),{action,data});
 await page.locator('.bn-inline-content').first().waitFor();const original=await dbWork('read');
 const reset=async()=>{await dbWork('write',original);await page.reload();await page.locator('.bn-inline-content').first().waitFor();await page.waitForTimeout(200);};
 await reset();await page.getByRole('checkbox',{name:'このノートの本文整理・タイトル・配置の自動適用を許可',exact:true}).check();await page.waitForTimeout(150);await page.getByRole('button',{name:'整理を停止',exact:true}).click();
 const bodyBefore=await page.locator('.bn-inline-content').allTextContents(), remote=await dbWork('read');remote.notes.note.document.blocks[1].content[0].text+=' 別タブの追記。';remote.notes.note.revision='r77';await dbWork('write',remote);
 await page.getByRole('button',{name:'現在のノートで再接続',exact:true}).click();await page.waitForTimeout(1800);
 if(JSON.stringify(await page.locator('.bn-inline-content').allTextContents())!==JSON.stringify(bodyBefore)||Object.keys((await dbWork('read')).receipts).length)throw new Error('Remote mismatch advanced stale base');
 await page.locator('.bn-inline-content').nth(1).click();await page.keyboard.press('Meta+ArrowRight');await page.keyboard.insertText(' この画面の追記。');await page.waitForTimeout(700);
 const canonical=await dbWork('read');if(!canonical.notes.note.document.blocks[1].content[0].text.includes('別タブの追記。')||(await page.locator('.bn-inline-content').allTextContents()).every(s=>!s.includes('この画面の追記。')))throw new Error('Remote/human text lost');checks.push('remote body mismatch blocks stale-base promotion and retains both competing edits');
 return {checks,errors,localDraft:await page.locator('.bn-inline-content').allTextContents(),canonical:canonical.notes.note.document};
}
