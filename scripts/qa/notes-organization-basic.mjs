export default async (page) => {
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:'reduce'});
 const read=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('open-editor.synthetic-organization.v1',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('workspace','readonly'),q=t.objectStore('workspace').get('tree');q.onsuccess=()=>resolve(q.result);t.oncomplete=()=>db.close();};r.onerror=()=>reject(r.error);}));
 await page.locator('.bn-inline-content').first().waitFor();
 const original=await read(), before=await page.locator('.bn-inline-content').allTextContents();
 await page.getByRole('checkbox',{name:'このノートの本文整理・タイトル・配置の自動適用を許可',exact:true}).check();
 await page.locator('.bn-inline-content').nth(1).click(); await page.keyboard.press('Meta+ArrowRight');
 const cursorBefore=await page.evaluate(()=>({text:getSelection()?.anchorNode?.textContent,offset:getSelection()?.anchorOffset,scroll:scrollY,focus:!!document.activeElement?.closest('.bn-editor')}));
 await page.waitForTimeout(2300);
 const after=await page.locator('.bn-inline-content').allTextContents(), cursorAfter=await page.evaluate(()=>({text:getSelection()?.anchorNode?.textContent,offset:getSelection()?.anchorOffset,scroll:scrollY,focus:!!document.activeElement?.closest('.bn-editor')}));
 const title=await page.getByRole('textbox',{name:'ノートタイトル',exact:true}).inputValue(), parent=await page.getByTestId('organization-parent').innerText();
 const saved=await read();
 if(title!=='旅の準備'||!parent.includes('旅')||JSON.stringify(before)!==JSON.stringify(after)||Object.keys(saved.receipts).length!==1)throw new Error(JSON.stringify({title,parent,before,after,saved}));
 if(JSON.stringify(cursorBefore)!==JSON.stringify(cursorAfter))throw new Error('Caret/scroll changed '+JSON.stringify({cursorBefore,cursorAfter}));
 await page.screenshot({path:'output/playwright/notes3/auto-organized-desktop.png',fullPage:true});
 const undo=page.getByRole('button',{name:'本文・タイトル・配置をUndo',exact:true}); await undo.waitFor(); if(!await undo.isEnabled())throw new Error('Undo disabled '+await page.locator('main').innerText());
 await undo.click(); await page.waitForTimeout(400);
 const restored=await read();
 if(JSON.stringify(restored.notes.note.document)!==JSON.stringify(original.notes.note.document)||restored.notes.note.title!=='自由メモ'||restored.notes.note.parentId!==null)throw new Error('Undo not atomic');
 await page.screenshot({path:'output/playwright/notes3/atomic-undo.png',fullPage:true});
 return {checks:['authorized idle organization','exact negation/numbers/uncertainty','existing parent/title','atomic undo','caret/focus/scroll stable'],cursorBefore,cursorAfter,errors,body:after};
}
