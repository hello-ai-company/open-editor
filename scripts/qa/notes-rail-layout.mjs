export default async page => {
  const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:5199/') && !r.url().startsWith('data:')) requests.push(r.url()); });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.locator('.bn-inline-content').first().waitFor();
  const rects = () => page.evaluate(() => { const box = el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right }; }; return { body:box(document.querySelector('.organization-body')),rail:box(document.querySelector('.organization-rail')),scroll:scrollY,overflow:document.documentElement.scrollWidth>innerWidth,focus:!!document.activeElement?.closest('.bn-editor'),text:getSelection()?.focusNode?.textContent,offset:getSelection()?.focusOffset }; });
  await page.screenshot({ path:'OUTPUT/rail-idle-desktop.png',fullPage:false });
  await page.getByRole('button',{name:'提案をオンにする',exact:true}).click();
  await page.locator('.bn-inline-content').first().click(); await page.keyboard.press('Meta+ArrowRight'); const before=await rects();
  const proposal=page.getByRole('group',{name:'整理案の確認',exact:true}); await proposal.waitFor({ timeout:17000 }); const ready=await rects();
  if (ready.body.x!==before.body.x || ready.body.width!==before.body.width || ready.body.y!==before.body.y || ready.scroll!==before.scroll || !ready.focus || ready.text!==before.text || ready.offset!==before.offset) throw new Error('Proposal changed editing layout, focus, selection or scroll');
  const approve=page.getByRole('button',{name:'この案を承認',exact:true}); const approveBox=await approve.boundingBox();
  if (!approveBox || approveBox.y<0 || approveBox.y+approveBox.height>900 || ready.rail.x<ready.body.right+20 || ready.rail.bottom>900) throw new Error('Desktop rail overlaps the editor or approval is outside viewport');
  await approve.hover(); const hovered=await rects(); if(hovered.scroll!==ready.scroll || hovered.body.y!==ready.body.y)throw new Error('Hover shifted page');
  if(await page.locator('.organization-rail-card').evaluate(el=>getComputedStyle(el).animationName)!=='none')throw new Error('Reduced Motion animated the rail');
  await page.screenshot({ path:'OUTPUT/rail-proposal-desktop.png',fullPage:false });
  await page.getByRole('button',{name:'提案を閉じる',exact:true}).click(); if(await proposal.count())throw new Error('Close retained proposal');
  const closed=await rects(); if(!closed.focus || closed.text!==ready.text || closed.offset!==ready.offset || closed.scroll!==ready.scroll)throw new Error('Close took editor focus/selection/scroll');
  await page.waitForTimeout(11000); if(await proposal.count())throw new Error('Closed proposal reopened');
  // A real synthetic HTML/plain paste creates 500 editable blocks, never replacing user data.
  await page.locator('.bn-inline-content').last().click(); await page.keyboard.press('Meta+ArrowRight'); await page.keyboard.press('Enter');
  const text=Array.from({length:500},(_,i)=>`長いノートの段落${i+1}。3点・不要ではない・未確認を保持。`).join('\n');
  await page.evaluate(text=>{const d=new DataTransfer();d.setData('text/plain',text);d.setData('text/html',text.split('\n').map(x=>'<p>'+x+'</p>').join(''));document.activeElement.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));},text);
  await page.waitForTimeout(1000); const longCount=await page.locator('.bn-inline-content').count(); if(longCount<500)throw new Error('Long note paste failed');
  const atBottom=await rects(); if(atBottom.rail.y<0 || atBottom.rail.bottom>900)throw new Error('Rail escaped viewport at long-note endpoint');
  await page.screenshot({path:'OUTPUT/rail-long-note-bottom.png',fullPage:false});
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight/2)); await page.waitForTimeout(200); const middle=await rects();
  if(middle.rail.y!==atBottom.rail.y || middle.rail.bottom!==atBottom.rail.bottom)throw new Error('Rail follows document scroll');
  await page.evaluate(()=>scrollTo(0,0));
  // Explicit settings and delayed preparation must not change note dimensions.
  await page.getByRole('button',{name:'ノートと提案の設定',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'ノートと提案の設定',exact:true}); if(!await settings.isVisible())throw new Error('Missing settings');
  await page.keyboard.press('Escape'); if(await settings.isVisible())throw new Error('Settings Escape failed');
  if(!await page.getByRole('button',{name:'ノートと提案の設定',exact:true}).evaluate(el=>el===document.activeElement))throw new Error('Settings focus not returned');
  // IME and continuous input reveal only quiet status, with no big expansion.
  await page.locator('.bn-inline-content').first().click(); await page.keyboard.press('Meta+ArrowRight'); await page.keyboard.type('。入力の続き。');
  await page.evaluate(()=>document.querySelector('.bn-editor').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'変換'}))); await page.waitForTimeout(1600);
  if(await proposal.count() || !await page.locator('.organization-rail').evaluate(el=>el.dataset.writing==='true'))throw new Error('IME expanded proposal');
  await page.evaluate(()=>document.querySelector('.bn-editor').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'変換'})));
  await proposal.waitFor({timeout:17000});
  await page.setViewportSize({width:320,height:760}); await page.waitForTimeout(300);
  const chip=page.getByRole('button',{name:'提案を開く',exact:true}); if(!await chip.isVisible() || await page.getByRole('dialog',{name:'ノートの提案',exact:true}).isVisible() || await proposal.count())throw new Error('Mobile review opened itself');
  if((await rects()).overflow)throw new Error('320px document overflow');
  const chipSafe=await page.evaluate(()=>{const chip=document.querySelector('.organization-proposal-chip').getBoundingClientRect(),header=document.querySelector('.organization-top').getBoundingClientRect();return chip.top>=header.top && chip.bottom<=header.bottom;}); if(!chipSafe)throw new Error('Compact chip overlays the writing area');
  await page.locator('.bn-inline-content').last().click(); await page.keyboard.press('Meta+ArrowRight');
  for(let i=0;i<25;i++){await page.keyboard.press('ArrowUp');const safe=await page.evaluate(()=>{const s=getSelection();if(!s?.rangeCount)return false;const r=s.getRangeAt(0).getBoundingClientRect(),header=document.querySelector('.organization-top').getBoundingClientRect();return r.top>=header.bottom-1 && r.bottom<=innerHeight;});if(!safe)throw new Error('Keyboard caret is hidden by compact chrome');}
  await page.screenshot({path:'OUTPUT/rail-mobile-caret-bottom.png',fullPage:false});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'OUTPUT/rail-mobile-chip.png',fullPage:false});
  const mobileBefore=await rects(); await chip.click(); const sheet=page.getByRole('dialog',{name:'ノートの提案',exact:true}); await sheet.waitFor();
  await proposal.waitFor(); const sheetBox=await sheet.boundingBox(); const actionBox=await page.getByRole('button',{name:'この案を承認',exact:true}).boundingBox();
  if(!sheetBox || sheetBox.x<0 || sheetBox.x+sheetBox.width>320 || sheetBox.y<0 || sheetBox.y+sheetBox.height>760 || !actionBox || actionBox.y+actionBox.height>760)throw new Error('Mobile sheet/actions out of safe viewport');
  for(let i=0;i<9;i++){await page.keyboard.press('Tab');if(!await sheet.evaluate(el=>el.contains(document.activeElement)))throw new Error('Dialog keyboard focus escaped');}
  await page.screenshot({path:'OUTPUT/rail-mobile-sheet.png',fullPage:false});
  await page.keyboard.press('Escape'); if(await sheet.isVisible() || !await chip.evaluate(el=>el===document.activeElement) || (await rects()).scroll!==mobileBefore.scroll)throw new Error('Mobile Escape/focus/scroll failed');
  await page.waitForTimeout(11000); await chip.click(); if(await proposal.count())throw new Error('Dismissed mobile proposal returned'); await page.keyboard.press('Escape');
  // 200% layout-equivalent CSS viewport and a real Chromium pinch zoom both keep controls reachable.
  await page.setViewportSize({width:720,height:450}); await page.waitForTimeout(200); if((await rects()).overflow || !await chip.isVisible())throw new Error('200% equivalent viewport overflow');
  await chip.click(); const zoomBox=await sheet.boundingBox(); if(!zoomBox || zoomBox.y+zoomBox.height>450)throw new Error('Zoom sheet escapes viewport'); await page.keyboard.press('Escape');
  await page.screenshot({path:'OUTPUT/rail-zoom-equivalent.png',fullPage:false});
  await page.setViewportSize({width:1440,height:900}); const cdp=await page.context().newCDPSession(page); await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2}); await page.waitForTimeout(300);
  const zoom=await page.evaluate(()=>{const v=visualViewport,r=document.querySelector('.organization-proposal-chip').getBoundingClientRect();return{width:v.width,height:v.height,x:v.offsetLeft,y:v.offsetTop,chip:{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};});
  if(zoom.chip.x<zoom.x || zoom.chip.y<zoom.y || zoom.chip.right>zoom.x+zoom.width || zoom.chip.bottom>zoom.y+zoom.height)throw new Error('Pinch zoom chip escaped visual viewport');
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1}); await cdp.detach();
  await page.waitForTimeout(300); await page.getByRole('combobox',{name:'合成ノート',exact:true}).selectOption('another'); await page.locator('.bn-inline-content').first().waitFor();
  await page.getByRole('button',{name:'タイトルを編集',exact:true}).click(); const title=page.getByRole('textbox',{name:'ノートタイトル',exact:true});
  if(!await title.evaluate(el=>el===document.activeElement))throw new Error('Title edit not focused');
  await title.fill('人が書いた仮タイトル'); await title.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'変換'}))); await page.keyboard.press('Escape');
  if(!await settings.isVisible())throw new Error('IME Escape dismissed title settings');
  await title.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'変換'}))); await page.getByRole('button',{name:'タイトル編集をキャンセル',exact:true}).click(); await page.getByRole('button',{name:'設定を閉じる',exact:true}).click();
  await page.getByRole('button',{name:'提案をオンにする',exact:true}).click(); await proposal.waitFor({timeout:17000});
  await page.locator('.organization-rail-bottom').getByRole('button',{name:'設定',exact:true}).click(); await page.getByRole('checkbox',{name:'このノートで控えめな提案を受け取る',exact:true}).uncheck(); await page.getByRole('button',{name:'設定を閉じる',exact:true}).click();
  if(!await page.evaluate(()=>!!document.activeElement?.closest('.organization-rail')))throw new Error('Rail settings focus lost after invalidation');
  await page.getByRole('button',{name:'提案をオンにする',exact:true}).click(); await proposal.waitFor({timeout:17000});
  await approve.focus(); const keyboardScroll=await page.evaluate(()=>scrollY); await page.keyboard.press('Enter'); await page.waitForFunction(()=>!!document.querySelector('.bn-block-content[data-content-type="heading"]')); await page.waitForTimeout(400);
  if(!await page.evaluate(()=>!!document.activeElement?.closest('.bn-editor')) || await page.evaluate(()=>scrollY)!==keyboardScroll)throw new Error('Keyboard approval lost focus or scrolled');
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(500); if(await page.locator('.bn-block-content[data-content-type="heading"]').count())throw new Error('Keyboard atomic Undo failed');
  if(errors.length || requests.length)throw new Error(JSON.stringify({errors,requests}));
  return {firstViewportEditorY:before.body.y,desktopRailSafe:true,noArrivalScrollOrWidthChange:true,closeReturnsEditor:true,dismissalSuppressed:true,longNoteBlocks:longCount,railAtBottomAndMiddle:true,settingsEscapeFocus:true,IMEQuiet:true,mobileChipExplicitSheet:true,chipOutsideBodyAndKeyboardCaretSafe:true,keyboardTrapAndFocusReturn:true,titleEditIMEAndCancel:true,railSettingsInvalidationFocus:true,keyboardApprovalAndUndo:true,reducedMotion:true,zoomEquivalentViewport:true,pinchZoomSafe:true,externalRequests:requests.length,errors};
};
