const { chromium }=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(root,'home-runtime/live-app.html')))});
 await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
 const config=JSON.parse(fs.readFileSync(path.join(root,'adaptive-ui.json'))),feed=fs.readFileSync(path.join(root,'tube-feed.json'),'utf8');
 await context.route('**/adaptive-ui.json*',route=>route.fulfill({json:config}));
 await context.route('**/tube-feed.json*',route=>route.fulfill({body:feed,contentType:'application/json'}));
 await context.addInitScript(()=>{
  window.__HOME_REMOTE_LOADER_V3__=true;
  window.__events=[];window.__private=[];window.__attempts=[];window.__reminders=[];window.__healthy=false;window.__applied=false;
  const seed={active:[{id:'test-task',notionId:'test-task',title:'Prepare seminar notes',area:'Learning',details:{outcome:'Be ready for class',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
  if(!localStorage.getItem('native:todoState'))localStorage.setItem('native:todoState',JSON.stringify(seed));
  window.Native={loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),hasNotionConnection:()=>true,requestNotionSync:()=>{},hasCalendarPermission:()=>true,getCalendarEvents:()=>'[]',openUrl:()=>{},setNotionTaskDone:()=>{},
   liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,checkedAt:Date.now(),ready:!!window.__updateReady}),checkLiveUpdate:()=>{},markRuntimeHealthy:()=>{window.__healthy=true},applyLiveUpdate:()=>{window.__applied=true}};
  window.AdaptiveNative={logActivity:r=>window.__events.push(JSON.parse(r)),logPrivateActivity:r=>window.__private.push(JSON.parse(r)),queuePrivateActivity:r=>{window.__private.push(JSON.parse(r));return'queued'},queueLearningAttempt:r=>{window.__attempts.push(JSON.parse(r));return'queued'},saveTodoState:()=>{},homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),flushPrivateSync:()=>{},checkDeviceCommands:()=>{},hasNotificationPermission:()=>true,requestNotificationPermission:()=>{},notificationSettings:()=>'{}',setRemindersEnabled:()=>{},scheduleSmartReminder:r=>window.__reminders.push(JSON.parse(r)),scheduleNotification:()=>{},cancelNotification:()=>{},reviewSentence:r=>{const x=JSON.parse(r);setTimeout(()=>window.onHomeSentenceReview?.({requestId:x.requestId,cardId:x.cardId,error:'Offline test'}),40)}};
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>window.__healthy);
 // First paint is owned by v24; the full capability regression starts once idle hydration is complete.
 await page.waitForFunction(()=>document.documentElement.dataset.vbrainHydrated==='24'&&window.VBrainRemoteUI&&window.VBrain&&window.VBrainLive&&typeof window.handleAndroidBack==='function');
 assert.equal(await page.locator('#homeScreen .homeCard').count(),4,'one card for each core area');
 await page.screenshot({path:path.join(root,'home-screen-test.png'),fullPage:true});
 await page.evaluate(()=>{HOMEAdaptive.config.remoteUI={enabled:true,replaceHome:true,scene:{layout:'grid',columns:2,mobileColumns:2,gap:8,padding:8},components:[
  {type:'button',id:'shape-circle',shape:'circle',size:'sm',title:'Circle',metric:'{{todoActive}}',action:{type:'route',target:'todos'}},
  {type:'button',id:'shape-pill',shape:'pill',size:'wide',title:'Pill',action:{type:'route',target:'tube'}},
  {type:'button',id:'shape-diamond',shape:'diamond',size:'sm',title:'Brain',action:{type:'brain'}},
  {type:'text',id:'binding',size:'full',text:'{{todoActive}} tasks · {{time}}'}
 ]};VBrainRemoteUI.render()});
 assert.equal(await page.locator('#vbrainRemoteUIV18 [data-vbri-id]').count(),4,'remote renderer keeps all declared nodes');
 assert.equal(await page.locator('[data-vbri-id="shape-circle"].vbri-shape-circle').count(),1,'circle preset applied');
 assert.equal(await page.locator('[data-vbri-id="shape-pill"].vbri-shape-pill').count(),1,'pill preset applied');
 const bindingText=await page.locator('[data-vbri-id="binding"]').innerText();
 assert.ok(!bindingText.includes('{{')&&/\d+ tasks/.test(bindingText),'live binding resolved');
 await page.locator('[data-vbri-id="shape-diamond"]').click();await page.waitForSelector('#vBrainV19.show');
 assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');assert.equal(await page.locator('#vBrainV19.show').count(),0);
 await page.evaluate(()=>{HOMEAdaptive.config.remoteUI={enabled:false};VBrainRemoteUI.restore();VBrainPatch?.apply?.()});
 await page.locator('#vbrainScoreV8').click();await page.waitForSelector('#vBrainV19.show');
 await page.screenshot({path:path.join(root,'brain-screen-test.png')});
 assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');assert.equal(await page.locator('#vBrainV19.show').count(),0);
 await page.locator('#homeScreen .homeCard.calendar').click();await page.waitForSelector('#calendarScreen.show');await page.evaluate(()=>handleAndroidBack());
 await page.locator('#homeScreen .homeCard.todos').click();await page.evaluate(()=>openTodoDetail('test-task'));
 await page.locator('#detailPersonalNote').fill('My private note stays saved after restart.');
 await page.waitForTimeout(1200);
 assert.ok(await page.evaluate(()=>__private.some(x=>x.text==='My private note stays saved after restart.')));
 await page.evaluate(()=>{window.__updateReady=true;onVBrainLiveUpdate(JSON.parse(Native.liveRuntimeStatus()))});assert.equal(await page.evaluate(()=>__applied),false);
 await page.evaluate(()=>{window.__updateReady=false;onVBrainLiveUpdate(JSON.parse(Native.liveRuntimeStatus()))});
 await page.evaluate(()=>handleAndroidBack());await page.evaluate(()=>handleAndroidBack());
 await page.locator('#homeScreen .homeCard.tube').click();await page.locator('#grid .card:visible').first().click();
 await page.waitForSelector('#reader.show #answer');
 const options=page.locator('#reader .option');if(await options.count())await options.first().click();
 await page.locator('#answer').fill('I would test the central assumption with one small experiment before investing further.');
 await page.locator('#submit').click();await page.waitForTimeout(400);
 const state=await page.evaluate(()=>JSON.parse(Native.loadState('tubeState')));
 assert.ok(state.completed.some(x=>x.sentence.includes('central assumption')),'full answer survives completion');
 assert.ok(await page.evaluate(()=>__attempts.some(x=>x.sentence.includes('central assumption'))),'durable attempt before review');
 assert.ok((await page.locator('#feedback').innerText()).includes('pending review'),'no invented sentence score');
 await page.locator('#next').click();assert.equal(await page.locator('#reader.show').count(),0);
 await page.reload();await page.waitForFunction(()=>window.__healthy&&document.documentElement.dataset.vbrainHydrated==='24');
 assert.ok(await page.evaluate(()=>JSON.parse(Native.loadState('todoState')).active[0].details.personalNote.includes('private note')));
 assert.ok(await page.evaluate(()=>JSON.parse(Native.loadState('tubeState')).completed.some(x=>x.sentence.includes('central assumption'))));
 await page.evaluate(()=>VBrainLive.planReminders());assert.ok(await page.evaluate(()=>__reminders.length>=2));
 await page.evaluate(()=>onNotionSnapshot({open:[{id:'test-task',title:'Updated remotely',details:{personalNote:'Remote note'}}],completed:[],pendingTaskIds:[]}));
 assert.equal(await page.evaluate(()=>todoState.active[0].details.personalNote),'Remote note');
 await page.evaluate(()=>onNotionSnapshot({open:[{id:'test-task',title:'Old remote',details:{personalNote:'Stale'}}],completed:[],pendingTaskIds:['test-task']}));
 assert.equal(await page.evaluate(()=>todoState.active[0].details.personalNote),'Remote note');
 await page.evaluate(()=>{window.__updateReady=true;onVBrainLiveUpdate(JSON.parse(Native.liveRuntimeStatus()))});assert.equal(await page.evaluate(()=>__applied),true);
 assert.deepEqual(errors,[],'no runtime exceptions');
 console.log('PASS: v24 first paint + idle capabilities, host-18 remote UI, persistent brain, calendar, notes, Tube review, reminders and task conflicts');
 await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
