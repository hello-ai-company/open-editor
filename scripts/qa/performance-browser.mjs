// Same fresh synthetic default document, Chromium, viewport and CPU rate for both builds.
export default async function comparePerformance(page) {
  const browser=page.context().browser(), result={browser:browser.version(),viewport:{width:1440,height:900},cpuRate:4,iterations:5,warmup:1,metrics:{},definition:'fresh navigation to visible editor plus two animation frames; synthetic 500-paragraph paste event to 500 rendered markers plus two frames'};
  for(const [label,port] of [['before',5198],['after',5199]]) {
    const samples=[];
    for(let run=0;run<6;run++) {
      const context=await browser.newContext({viewport:result.viewport,reducedMotion:'reduce',colorScheme:'light'}), probe=await context.newPage();
      const cdp=await context.newCDPSession(probe); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await probe.goto(`http://127.0.0.1:${port}/`); await probe.locator('.bn-editor').waitFor();
      const editorReadyMs=await probe.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now())))));
      await probe.locator('.bn-editor [data-content-type=paragraph] .bn-inline-content').first().click();
      const pasteMs=await probe.evaluate(async()=>{
        const start=performance.now(), transfer=new DataTransfer();
        transfer.setData('text/html',Array.from({length:500},(_,i)=>`<p>OE_BENCH_${i} synthetic paragraph</p>`).join(''));
        transfer.setData('text/plain',Array.from({length:500},(_,i)=>`OE_BENCH_${i} synthetic paragraph`).join('\n\n'));
        document.activeElement.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
        await new Promise((resolve,reject)=>{const deadline=performance.now()+20000;const check=()=>{if(document.querySelector('.bn-editor')?.textContent.includes('OE_BENCH_499'))resolve();else if(performance.now()>deadline)reject(new Error('Paste did not render'));else requestAnimationFrame(check);};check();});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); return performance.now()-start;
      });
      if(run>0)samples.push({editorReadyMs,pasteMs}); await context.close();
    }
    const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[2]; result.metrics[label]={samples,medianEditorReadyMs:median('editorReadyMs'),medianPasteMs:median('pasteMs')};
  }
  return result;
}
