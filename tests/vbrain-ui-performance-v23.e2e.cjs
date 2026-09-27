const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const html=fs.readFileSync(path.join(root,'home-runtime/live-app.html'));
 const config=JSON.parse(fs.readFileSync(path.join(root,'adaptive-ui.json'),'utf8'));
 const feed=fs.readFileSync(path.join(root,'tube-feed.json'),'utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(8773,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
 await context.route('**/adaptive-ui.json*',route=>route.fulfill({json:config}));
 await context.route('**/tube-feed.json*',route=>route.fulfill({body:feed,contentType:'application/json'}));
 await context.route('**/hot-manifest-v19.json*',route=>route.fulfill({json:{schema:1,version:'19.0.2',minHost:18,modules:[]}}));
 await context.addInitScript(()=>{
   window.__checks=0;window.__healthy=false;window.__private=[];window.__events=[];window.__attempts=[];
   const seed={active:[{id:'v23-task',notionId:'v23-task',title:'Finish one useful thing',area:'Focus',details:{outcome:'Done',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
   localStorage.setItem('native:todoState',JSON.stringify(seed));
   window.Native={
     loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),
     liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,checkedAt:Date.now(),ready:false}),
     markRuntimeHealthy:()=>{window.__healthy=true},checkLiveUpdate:()=>{window.__checks++},applyLiveUpdate:()=>{},
     hasNotionConnection:()=>true,requestNotionSync:()=>{},configureNotion:()=>{},configureVeqrya:()=>{},
     hasCalendarPermission:()=>true,getCalendarEvents:()=>'[]',openUrl:()=>{},setNotionTaskDone:()=>{}
   };
   window.AdaptiveNative={
     logActivity:r=>window.__events.push(JSON.parse(r)),logPrivateActivity:r=>window.__private.push(JSON.parse(r)),queuePrivateActivity:r=>{window.__private.push(JSON.parse(r));return'queued'},
     queueLearningAttempt:r=>{window.__attempts.push(JSON.parse(r));return'queued'},saveTodoState:()=>{},homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),
     flushPrivateSync:()=>{},checkDeviceCommands:()=>{},hasNotificationPermission:()=>true,requestNotificationPermission:()=>{},notificationSettings:()=>'{}',setRemindersEnabled:()=>{},
     scheduleSmartReminder:()=>{},scheduleNotification:()=>{},cancelNotification:()=>{},reviewSentence:r=>{const x=JSON.parse(r);setTimeout(()=>window.onHomeSentenceReview?.({requestId:x.requestId,cardId:x.cardId,error:'Offline test'}),20)}
   };
 });
 const page=await context.newPage(),errors=[],heavy=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(/behavior-v3(?:-base)?\.js/i.test(req.url()))heavy.push(req.url())});
 await page.goto('http://127.0.0.1:8773');
 await page.waitForFunction(()=>window.VBrainUIPerformance?.version===23&&window.HOMERemoteExtension?.status?.().mode==='bundled-live-release');
 await page.waitForSelector('#vbrainScoreV8');
 await page.waitForTimeout(900);
 assert.equal(await page.locator('#homeDayScoreV4,#homeDayScoreV3,#homeDayScoreV2').count(),0,'legacy day score removed');
 assert.equal(await page.locator('#homeMomentum,.homeQuestV7').count(),0,'daily quest/momentum removed');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('vbrainLiveStatus17')).display),'none','settings/status trigger hidden');
 assert.deepEqual(heavy,[],'no remote behaviour bootstrap or nested behaviour payloads');
 assert.equal(await page.evaluate(()=>HOMERemoteExtension.status().schema),'host18-v5');

 await page.evaluate(()=>showScreen('tube'));
 await page.waitForSelector('#tubeScreen.show #grid .card');
 const tube=await page.evaluate(()=>({
   stored:localStorage.getItem('homeTubeLayoutV6'),layout:document.getElementById('grid').dataset.homeFlexLayout,
   columns:getComputedStyle(document.getElementById('grid')).gridTemplateColumns,
   cardBackdrop:getComputedStyle(document.querySelector('#grid .card')).backdropFilter
 }));
 assert.equal(tube.stored,'stack');assert.equal(tube.layout,'stack');assert.notEqual(tube.columns,'none');assert.ok(tube.cardBackdrop==='none'||tube.cardBackdrop==='');

 await page.evaluate(()=>showScreen('todos'));
 await page.waitForSelector('#todosScreen.show');
 const todoStyle=await page.evaluate(()=>({
   family:getComputedStyle(document.querySelector('#todosScreen .headerTitle h1')).fontFamily,
   weight:Number(getComputedStyle(document.querySelector('#todosScreen .headerTitle h1')).fontWeight),
   backdrop:getComputedStyle(document.querySelector('#todosScreen .todo')).backdropFilter
 }));
 await page.evaluate(()=>showScreen('calendar'));
 await page.waitForSelector('#calendarScreen.show');
 const calStyle=await page.evaluate(()=>({
   family:getComputedStyle(document.querySelector('#calendarScreen .headerTitle h1')).fontFamily,
   weight:Number(getComputedStyle(document.querySelector('#calendarScreen .headerTitle h1')).fontWeight)
 }));
 assert.equal(todoStyle.family,calStyle.family,'Todo and Calendar share typography');assert.ok(todoStyle.weight>=800&&calStyle.weight>=800,'signal-style strong headings');
 assert.ok(todoStyle.backdrop==='none'||todoStyle.backdrop==='','scrolling todo cards avoid GPU blur');

 await page.waitForTimeout(5400);
 assert.ok(await page.evaluate(()=>window.__checks>=2),'foreground live update checks happen within five seconds');
 assert.deepEqual(errors,[],'no runtime exceptions');
 await page.screenshot({path:path.join(root,'unified-v23-screen-test.png'),fullPage:false});
 console.log('VBRAIN_UI_V23_OK',JSON.stringify({tube,checks:await page.evaluate(()=>window.__checks),family:todoStyle.family,heavyRequests:heavy.length}));
 await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
