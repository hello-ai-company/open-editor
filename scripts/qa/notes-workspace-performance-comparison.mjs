export default async (page, versions = ['14','15']) => {
 const errors=[],external=[],samples=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{const u=r.request().url();if(!/^http:\/\/(127\.0\.0\.1|localhost)(:519[89])\//.test(u)&&!/^(data|blob):/.test(u)){external.push(u);return r.abort();}return r.continue();});
 await page.setViewportSize({width:1440,height:900});const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));await cdp.send('Performance.enable');
 const measure=async(version,round,pair,warmup=false)=>{
  await page.goto(`http://127.0.0.1:${version===versions[0]?5198:5199}/?notes=synthetic`);await page.locator('.oe-notes-blocknote-document .bn-editor').waitFor();
  const ready=await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now();});
  const navigation=await metrics(),resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.js($|\?)/.test(e.name)).reduce((a,e)=>({count:a.count+1,decodedBytes:a.decodedBytes+e.decodedBodySize}),{count:0,decodedBytes:0}));
  await page.locator('.bn-inline-content').last().click();await page.keyboard.press('Meta+ArrowRight');await page.keyboard.press('Enter');const before=await metrics();
  const paste=await page.evaluate(async()=>{const text=Array.from({length:500},(_,i)=>`検証用の段落${i+1}。数値3点・未確認を保持。`).join('\n'),data=new DataTransfer();data.setData('text/plain',text);data.setData('text/html',text.split('\n').map(s=>'<p>'+s+'</p>').join(''));const start=performance.now();document.activeElement.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-start;});
  const after=await metrics(),blocks=await page.locator('.bn-inline-content').count();if(blocks<500)throw new Error('Missing pasted blocks');
  const durationNames=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'];const phase=Object.fromEntries(durationNames.map(k=>[k+'Ms',Math.round((after[k]-before[k])*1000)]));
  const sample={version,round,pair,navigationToReadyMs:Math.round(ready),pasteToTwoFramesMs:Math.round(paste),blocks,navigation:Object.fromEntries(durationNames.map(k=>[k+'Ms',Math.round(navigation[k]*1000)])),paste:phase,resources,heapBytes:after.JSHeapUsedSize};if(!warmup)samples.push(sample);
 };
 try{
  await measure(versions[0],-1,-1,true);await measure(versions[1],-1,-1,true);
  for(let round=0;round<3;round++)for(let pair=0;pair<5;pair++)for(const v of (round+pair)%2?[...versions].reverse():versions)await measure(v,round,pair);
  if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}));
  const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
  const summary=Object.fromEntries(versions.map(v=>{const rows=samples.filter(r=>r.version===v);return [v,{samples:rows.length,medianReadyMs:median(rows.map(r=>r.navigationToReadyMs)),medianPasteMs:median(rows.map(r=>r.pasteToTwoFramesMs)),pasteCPU:Object.fromEntries(Object.keys(rows[0].paste).map(k=>[k,median(rows.map(r=>r.paste[k]))])),navigationCPU:Object.fromEntries(Object.keys(rows[0].navigation).map(k=>[k,median(rows.map(r=>r.navigation[k]))])),JSDecodedBytes:rows[0].resources.decodedBytes}];}));
  const pairs=Array.from({length:15},(_,i)=>{const a=samples.find(s=>s.version===versions[0]&&s.round===Math.floor(i/5)&&s.pair===i%5),b=samples.find(s=>s.version===versions[1]&&s.round===a.round&&s.pair===a.pair);return {ready:b.navigationToReadyMs-a.navigationToReadyMs,paste:b.pasteToTwoFramesMs-a.pasteToTwoFramesMs};});
  let seed=16;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const bootstrap=field=>{const estimates=Array.from({length:5000},()=>median(Array.from({length:15},()=>pairs[Math.floor(rand()*15)][field]))).sort((a,b)=>a-b);return {medianPairedDeltaMs:median(pairs.map(p=>p[field])),bootstrapMedian95PercentIntervalMs:[estimates[125],estimates[4874]],descriptiveOnly:true};};
  return {conditions:{viewport:'1440x900',cpuThrottle:4,rounds:3,pairsPerRound:5,warmupsPerVersion:1,alternatingOrder:true,singleBrowserNoConcurrentWork:true,route:'synthetic Notes workspace',metric:'navigationStart to two frames after editor visible; paste event to two frames',browser:page.context().browser().version()},summary,paired:{ready:bootstrap('ready'),paste:bootstrap('paste')},samples,errors,externalRequests:external.length,paidCalls:0,realPA:false};
 }finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}
};
