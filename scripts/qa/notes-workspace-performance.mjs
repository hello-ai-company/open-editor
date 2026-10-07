export default async (page) => {
  const errors = [], external = [], samples = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { const url = route.request().url(); if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) && !/^(data|blob):/.test(url)) { external.push(url); return route.abort(); } return route.continue(); });
  await page.setViewportSize({width:1440,height:900});
  const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  for (let iteration=0;iteration<5;iteration++) {
    await page.goto('http://127.0.0.1:5199/?notes=synthetic');
    await page.locator('.oe-notes-blocknote-document .bn-editor').waitFor();
    const ready = await page.evaluate(async()=>{ await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); return performance.now(); });
    await page.locator('.bn-inline-content').last().click(); await page.keyboard.press('Meta+ArrowRight'); await page.keyboard.press('Enter');
    const pasted = await page.evaluate(async()=>{
      const text=Array.from({length:500},(_,index)=>`検証用の段落${index+1}。数値3点・未確認を保持。`).join('\n'), transfer=new DataTransfer();transfer.setData('text/plain',text);transfer.setData('text/html',text.split('\n').map(line=>'<p>'+line+'</p>').join(''));
      const start=performance.now();document.activeElement.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return performance.now()-start;
    });
    const blocks=await page.locator('.bn-inline-content').count(); if(blocks<500)throw new Error('Paste did not produce 500 blocks');
    samples.push({navigationToReadyMs:Math.round(ready),pasteToTwoFramesMs:Math.round(pasted),blocks});
    if(iteration===4){ await page.setViewportSize({width:320,height:760});await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:'OUTPUT/workspace-500blocks-mobile.png'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Long document overflow'); }
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();
  if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}));
  const median = field=>samples.map(sample=>sample[field]).sort((a,b)=>a-b)[2];
  return {conditions:{viewport:'1440x900',cpuThrottle:4,iterations:5,route:'synthetic Notes workspace',metric:'navigationStart to two frames after editor visible; paste event to two frames',historicalComparable:false},samples,medianReadyMs:median('navigationToReadyMs'),medianPasteMs:median('pasteToTwoFramesMs'),mobile320LongDocument:true,errors,externalRequests:external.length};
};
