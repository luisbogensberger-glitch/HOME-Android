const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const html=fs.readFileSync(path.join(root,'home-runtime/live-app.html'),'utf8');
 const config=JSON.parse(fs.readFileSync(path.join(root,'adaptive-ui.json'),'utf8'));
 const feed=fs.readFileSync(path.join(root,'tube-feed.json'),'utf8');
 assert.ok(!html.includes('data-source="runtime.js"'),'legacy quest runtime must not ship');
 assert.ok(!html.includes('data-source="adaptive-runtime.js"'),'legacy adaptive DOM owner must not ship');
 assert.ok(!html.includes('data-source="vbrain-autonomy-v11.js"'),'legacy autonomy DOM owner must not ship');
 assert.ok(!html.includes('Build momentum that matters.'),'quest copy must be absent from release bytes');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(8774,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
 await context.route('**/adaptive-ui.json*',route=>route.fulfill({json:config}));
 await context.route('**/tube-feed.json*',route=>route.fulfill({body:feed,contentType:'application/json'}));
 await context.route('**/hot-manifest-v19.json*',route=>route.fulfill({json:{schema:1,version:'19.0.2',minHost:18,modules:[]}}));
 await context.addInitScript(()=>{
   window.__navStart=performance.now();window.__healthy=false;window.__healthyAt=0;window.__checks=0;window.__events=[];window.__private=[];window.__reminders=[];
   const seed={active:[{id:'v24-task',notionId:'v24-task',title:'One useful task',area:'Focus',details:{outcome:'Finish it',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
   localStorage.setItem('native:todoState',JSON.stringify(seed));
   window.Native={
     loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),
     liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'live',healthy:true,checkedAt:Date.now(),ready:false}),
     markRuntimeHealthy:()=>{if(!window.__healthy){window.__healthy=true;window.__healthyAt=performance.now()}},checkLiveUpdate:()=>{window.__checks++},applyLiveUpdate:()=>{},
     hasNotionConnection:()=>true,requestNotionSync:()=>{},configureNotion:()=>{},configureVeqrya:()=>{},hasCalendarPermission:()=>true,getCalendarEvents:()=>'[]',openUrl:()=>{},setNotionTaskDone:()=>{}
   };
   window.AdaptiveNative={
     logActivity:r=>window.__events.push(JSON.parse(r)),logPrivateActivity:r=>window.__private.push(JSON.parse(r)),queuePrivateActivity:r=>{window.__private.push(JSON.parse(r));return'queued'},queueLearningAttempt:()=> 'queued',saveTodoState:()=>{},
     homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),flushPrivateSync:()=>{},checkDeviceCommands:()=>{},hasNotificationPermission:()=>true,requestNotificationPermission:()=>{},notificationSettings:()=>'{}',setRemindersEnabled:()=>{},scheduleSmartReminder:r=>window.__reminders.push(JSON.parse(r)),scheduleNotification:()=>{},cancelNotification:()=>{},reviewSentence:()=>{}
   };
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8774');
 await page.waitForFunction(()=>window.VBrainShell?.version===24&&window.__healthy===true);
 const boot=await page.evaluate(()=>({healthyMs:__healthyAt-__navStart,owner:document.documentElement.dataset.vbrainUiOwner,cards:document.querySelectorAll('#homeScreen .homeGrid>.homeCard').length}));
 assert.ok(boot.healthyMs<2500,'critical shell must confirm health before optional hydration: '+JSON.stringify(boot));
 assert.equal(boot.owner,'24');assert.equal(boot.cards,4);
 await page.waitForFunction(()=>document.documentElement.dataset.vbrainHydrated==='24'&&window.VBrainRemoteUI&&window.VBrain);
 await page.waitForSelector('#vbrainScoreV8');
 assert.equal(await page.locator('#homeMomentum,.homeQuestV7,.vb11Module,#homeDayScoreV4,#homeFlexEdit,#vbrainLiveStatus17').count(),0,'legacy visible noise absent after hydration');

 // Simulate exactly the stale/old layers that used to return after resume.
 await page.evaluate(()=>{
   const inner=document.querySelector('#homeScreen .homeInner'),grid=inner.querySelector('.homeGrid');
   const q=document.createElement('section');q.id='homeMomentum';q.className='homeQuestV7';q.textContent='TODAY\'S QUEST Build momentum that matters.';inner.insertBefore(q,grid);
   const mod=document.createElement('button');mod.className='vb11Module';mod.textContent='old adaptive module';grid.appendChild(mod);
   const dup=document.querySelector('#homeScreen .homeCard.todos').cloneNode(true);dup.id='duplicateTodo';grid.appendChild(dup);
 });
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#homeMomentum,.homeQuestV7,.vb11Module,#duplicateTodo').count(),0,'single owner must quarantine stale UI reinjection');
 assert.equal(await page.locator('#homeScreen .homeGrid>.homeCard').count(),4,'exactly four base routes survive');

 // Resume must not restore old UI or duplicate the shell.
 await page.evaluate(()=>window.onAppResume?.());await page.waitForTimeout(120);
 assert.equal(await page.locator('#homeMomentum,.homeQuestV7,.vb11Module,#homeDayScoreV4,#homeFlexEdit').count(),0,'resume cannot restore retired UI');
 assert.equal(await page.locator('#homeScreen .homeGrid>.homeCard').count(),4);

 // Tube remains classic one-column stack even after config/resume churn.
 await page.evaluate(()=>showScreen('tube'));
 await page.waitForSelector('#tubeScreen.show #grid .card');
 const tube=await page.evaluate(()=>({stored:localStorage.getItem('homeTubeLayoutV6'),layout:document.getElementById('grid').dataset.layout,cols:getComputedStyle(document.getElementById('grid')).gridTemplateColumns,blur:getComputedStyle(document.querySelector('#grid .card')).backdropFilter}));
 assert.equal(tube.stored,'stack');assert.equal(tube.layout,'stack');assert.notEqual(tube.cols,'none');assert.ok(tube.blur==='none'||tube.blur==='');
 await page.evaluate(()=>showScreen('home'));

 // A config event can replace the whole Home immediately without adding another owner.
 const mutationMs=await page.evaluate(async()=>{
   HOMEAdaptive.config.remoteUI={enabled:true,replaceHome:true,scene:{layout:'grid',columns:1,mobileColumns:1,gap:10,padding:16},components:[{type:'button',id:'instant-field',size:'full',kicker:'LIVE',title:'Instant field',text:'Loaded without rebuilding the APK.',action:{type:'route',target:'tube'}}]};
   const t=performance.now();window.dispatchEvent(new CustomEvent('vbrain:config',{detail:{version:24,source:'test',config:HOMEAdaptive.config}}));
   while(!document.querySelector('[data-vbri-id="instant-field"]')&&performance.now()-t<1000)await new Promise(r=>requestAnimationFrame(r));
   return performance.now()-t;
 });
 assert.equal(await page.locator('[data-vbri-id="instant-field"]').count(),1,'declarative field appears');
 assert.ok(mutationMs<500,'live field render should be sub-500ms after config signal, got '+mutationMs);
 assert.ok(await page.locator('#homeScreen.vbri-replaced').count()===1,'remote scene can replace complete Home');
 await page.evaluate(()=>{HOMEAdaptive.config.remoteUI.enabled=false;window.dispatchEvent(new CustomEvent('vbrain:config',{detail:{version:24,source:'test-off',config:HOMEAdaptive.config}}))});
 await page.waitForFunction(()=>!document.getElementById('vbrainRemoteUIV18')&&!document.getElementById('homeScreen').classList.contains('vbri-replaced'));
 assert.equal(await page.locator('#homeScreen .homeGrid>.homeCard').count(),4);
 assert.deepEqual(errors,[],'no runtime exceptions');
 await page.screenshot({path:path.join(root,'single-owner-v24-screen-test.png'),fullPage:false});
 console.log('VBRAIN_SINGLE_OWNER_V24_OK',JSON.stringify({boot,tube,mutationMs,checks:await page.evaluate(()=>__checks)}));
 await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
