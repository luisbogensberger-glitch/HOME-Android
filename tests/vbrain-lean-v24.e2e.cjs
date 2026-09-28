const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');

(async()=>{
  const html=fs.readFileSync(path.join(root,'home-runtime/live-app.html'));
  let liveUi={schema:1,version:'25-test-a',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'append',columns:1,components:[]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8775,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
  await context.route('**/ui-live-v25.json*',route=>route.fulfill({json:liveUi}));
  await context.addInitScript(()=>{
    window.__healthy=false;window.__checks=0;window.__applied=0;window.__commands=0;window.__flushes=0;window.__events=[];window.__private=[];window.__notionSync=0;
    const current=['ucl-devices','orientation','oscar','bullitt','societies'].map((id,i)=>({id,title:['Set up UCL devices','Morning orientation','Reply to Oscar','Apply for BULLITT role','Research UCL societies'][i],area:'Personal',details:{outcome:'Useful task',info:[],tips:[],links:[],personalNote:''}}));
    const imported=Array.from({length:188},(_,i)=>({id:'old-sync-'+i,notionId:'old-sync-'+i,title:'Legacy '+i,area:'Earlier import',details:{outcome:'Preserved for review',info:[],tips:[],links:[],personalNote:''}}));
    localStorage.setItem('native:todoState',JSON.stringify({active:[...current,...imported],archive:[{id:'expired-task',title:'Old completed',completedAt:Date.now()-8*86400000},{id:'recent-task',title:'Recent completed',completedAt:Date.now()-86400000},{id:'undated-task',title:'Legacy completed'}]}));
    localStorage.setItem('native:tubeState',JSON.stringify({activeIds:['retired-remote-1','retired-remote-2'],nextPoolIndex:20,completed:[],drafts:{}}));
    localStorage.setItem('homeRemoteJsV2','window.__POISON__=true');
    localStorage.setItem('homeBehaviorJsV3','window.__BEHAVIOR_POISON__=true');
    window.Native={
      loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,checkedAt:Date.now(),ready:false}),
      markRuntimeHealthy:()=>{window.__healthy=true},checkLiveUpdate:()=>{window.__checks++},applyLiveUpdate:()=>{window.__applied++},
      hasNotionConnection:()=>true,configureNotion:()=>{},configureVeqrya:()=>{},disconnectNotion:()=>{},requestNotionSync:()=>{window.__notionSync++},setNotionTaskDone:()=>{},createNotionTask:()=>{},
      hasCalendarPermission:()=>true,getCalendarEvents:()=>JSON.stringify([{id:1,title:'UCL seminar',start:Date.now(),end:Date.now()+3600000,location:'Bloomsbury',allDay:false}]),requestCalendarPermission:()=>{},openUrl:()=>{}
    };
    window.AdaptiveNative={
      logActivity:r=>window.__events.push(JSON.parse(r)),queuePrivateActivity:r=>{window.__private.push(JSON.parse(r));return true},
      flushPrivateSync:()=>{window.__flushes++},checkDeviceCommands:()=>{window.__commands++},reviewSentence:r=>{const request=JSON.parse(r);setTimeout(()=>window.onHomeSentenceReview?.({requestId:request.requestId,review:{verdict:'Clear application',overall:84,feedback:'You applied the concept to a concrete decision.',nextFocus:'precision'}}),100)}
    };
  });

  const page=await context.newPage();const errors=[],heavy=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(/behavior-v3|adaptive-ui\.json|hot-manifest|remote-extension-loader|vbrain-personalizer/i.test(req.url()))heavy.push(req.url())});
  await page.goto('http://127.0.0.1:8775');
  await page.waitForFunction(()=>window.VBrainLean?.version===25&&window.VBrain?.version===25&&window.VBrainLive?.version===25&&window.__healthy===true);

  const boot=await page.evaluate(()=>({
    injected:document.querySelectorAll('script[data-source]').length,
    cards:document.querySelectorAll('.v25HomeCard').length,
    order:[...document.querySelectorAll('.v25HomeCard')].map(x=>x.dataset.route),
    signal:document.getElementById('vbrainScoreV8')?.innerText.includes('Your signal today'),
    brainText:document.getElementById('vbrainScoreV8')?.textContent.includes('Behaviour intelligence'),
    sync:document.querySelectorAll('.syncBar').length,
    legacy:document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#vbRestoreInline,#v24BrainOverlay').length,
    poison:!!window.__POISON__||!!window.__BEHAVIOR_POISON__,
    oldJs:localStorage.getItem('homeRemoteJsV2'),oldBehaviour:localStorage.getItem('homeBehaviorJsV3')
  }));
  assert.deepEqual(boot,{injected:1,cards:4,order:['gym','tube','todos','calendar'],signal:true,brainText:true,sync:1,legacy:0,poison:false,oldJs:null,oldBehaviour:null});
  assert.ok(await page.evaluate(()=>window.__events.some(x=>x.type==='runtime_ready'&&x.data.nativeVersion===18&&x.data.releaseVersion==='18.test')),'runtime telemetry must identify the native host and loaded release');
  assert.equal(await page.locator('.v25Mark svg path').getAttribute('d'),'M15 2 L52 46 L89 2','the header mark must be a fine V');
  assert.equal(await page.locator('#v25Score').evaluate(el=>getComputedStyle(el).fontSize),'27px','the score number should breathe inside its ring');
  assert.deepEqual(heavy,[],'no retired runtime requests');
  const homeCards=await page.evaluate(()=>({heights:[...document.querySelectorAll('.v25HomeCard')].map(x=>x.getBoundingClientRect().height),calendar:getComputedStyle(document.querySelector('.v25HomeCard.calendar')).backgroundImage}));
  assert.ok(Math.max(...homeCards.heights)-Math.min(...homeCards.heights)<3,'all four Home cards must have the same height');
  assert.ok(homeCards.calendar.includes('photo-1513635269975-59663e0ac1ad'),'calendar must use the earlier photo');
  await page.waitForFunction(()=>window.__events.some(x=>x.type==='screen_card_impression'&&x.data.route==='gym'));
  await page.locator('.v25HomeCard.gym').click();await page.waitForSelector('#gymScreen.show');
  const cardEvidence=await page.evaluate(()=>({impression:window.__events.find(x=>x.type==='screen_card_impression'&&x.data.route==='gym'),click:window.__events.find(x=>x.type==='ui_press_card'&&x.data.route==='gym')}));
  assert.equal(cardEvidence.click.data.visitId,cardEvidence.impression.data.visitId,'card CTR must pair a visible impression and tap in one Home visit');
  assert.deepEqual(await page.locator('#v25GymTabs button').allTextContents(),['Strength45 min','Quick20 min','Recovery15 min']);
  await page.locator('#v25GymTabs button[data-plan=quick]').click();await page.locator('#v25GymDone').click();
  for(let i=0;i<4;i++)await page.locator(`#v25GymSession [data-step="${i}"]`).click();await page.locator('#v25GymDone').click();
  assert.ok((await page.locator('#v25GymRecent').textContent()).includes('4/4 exercises'),'only a completed quick session is saved');
  await page.evaluate(()=>showScreen('home'));
  await page.locator('.v25HomeCard.calendar').click();
  await page.waitForSelector('#calendarScreen.show');
  assert.ok((await page.locator('#calendarList').textContent()).includes('UCL seminar'),'calendar must display events synced on the phone');
  assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');

  for(let i=0;i<3;i++){
    await page.evaluate(()=>window.onAppResume?.());
    await page.waitForTimeout(120);
    const state=await page.evaluate(()=>({cards:document.querySelectorAll('.v25HomeCard').length,order:[...document.querySelectorAll('.v25HomeCard')].map(x=>x.dataset.route),legacy:document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#v24BrainOverlay').length,sync:window.__notionSync}));
    assert.deepEqual({cards:state.cards,order:state.order,legacy:state.legacy},{cards:4,order:['gym','tube','todos','calendar'],legacy:0},'resume must keep exactly one Home');
    assert.ok(state.sync<=2,'resume must throttle background task sync');
  }

  const routeMs=await page.evaluate(()=>{const t=performance.now();showScreen('todos');return performance.now()-t});
  assert.ok(routeMs<50,`todo route should be synchronous, got ${routeMs}ms`);
  await page.waitForSelector('#todosScreen.show');
  const todoPerf=await page.evaluate(()=>({rows:document.querySelectorAll('#todoList .todo').length,older:document.querySelector('#v25OlderTasks summary')?.textContent,total:document.getElementById('todoStats').textContent,archive:todoState.archive.map(x=>x.id),sync:window.__notionSync,syncBar:document.querySelector('#todosScreen .syncBar')?.textContent,backdrop:getComputedStyle(document.querySelector('#todoList .todo')).backdropFilter}));
  assert.equal(todoPerf.rows,5,'old imports must leave a usable current list');
  assert.equal(todoPerf.total,'5 open');assert.equal(todoPerf.older,'Review older synced tasks (188)');assert.deepEqual(todoPerf.archive,['recent-task','undated-task'],'completed items expire after seven days and undated entries get a fresh retention window');assert.ok(todoPerf.sync>=1);assert.ok(todoPerf.syncBar?.includes('Sync now')&&!todoPerf.syncBar.includes('Notion'),'the on-device task screen must retain its sync controls');assert.ok(todoPerf.backdrop===''||todoPerf.backdrop==='none');
  const backlogSync=await page.evaluate(()=>{const seed=[...todoState.active],older=Array.from({length:188},(_,i)=>({id:'old-sync-'+i,title:'Legacy '+i,area:'Earlier import'}));onNotionSnapshot({open:[...seed,...older],completed:[{id:'expired-task',title:'Old completed'}]});return{open:todoState.active.length,archived:todoState.archive.map(t=>t.id),stamped:todoState.archive.find(t=>t.id==='undated-task')?.completedAt>0}});
  assert.deepEqual(backlogSync,{open:5,archived:['recent-task','undated-task'],stamped:true},'a full remote snapshot must not refill the list or revive an expired archive entry');
  await page.locator('#v25OlderTasks summary').click();await page.fill('#v25OlderTasks input','Legacy 187');await page.locator('#v25OlderTasks .v25OlderRow button').click();
  assert.equal(await page.locator('#todoStats').textContent(),'6 open','an older imported task must be restorable');

  await page.locator('#todoList .todo').first().click();
  await page.waitForSelector('#todoDetailScreen.show #detailPersonalNote');
  await page.fill('#detailPersonalNote','Remember this private task note for the brain.');
  await page.waitForTimeout(650);
  assert.ok(await page.evaluate(()=>window.__private.some(x=>x.kind==='private_text_field'&&x.field==='detailPersonalNote'&&x.text.includes('private task note'))),'task note must be privately captured');
  await page.evaluate(()=>showScreen('todos'));
  await page.fill('#newTodo','Keep this task across a stale sync');await page.click('.composer button');
  await page.locator('#todoList .todo').first().locator('.todoCheck').click();
  const retained=await page.evaluate(()=>{const t=todoState.archive.find(x=>x.title==='Keep this task across a stale sync');onNotionSnapshot({open:[{id:t.id,title:t.title,area:'Personal',details:{personalNote:''}}],completed:[],pendingTaskIds:[t.id]});return{archived:todoState.archive.some(x=>x.id===t.id),open:todoState.active.some(x=>x.id===t.id)}});
  assert.deepEqual(retained,{archived:true,open:false},'a stale server snapshot must not resurrect a locally completed task');
  await page.evaluate(()=>VBrainLive.openReminder({target:'todos',taskId:'oscar'}));
  assert.equal(await page.locator('#todoDetailScreen.show #detailTitle').textContent(),'Reply to Oscar','a reminder tap must open its task');

  await page.evaluate(()=>showScreen('tube'));
  await page.waitForSelector('#tubeScreen.show #grid .card');
  const tube=await page.evaluate(()=>({stored:localStorage.getItem('homeTubeLayoutV6'),layout:document.getElementById('grid').dataset.layout,columns:getComputedStyle(document.getElementById('grid')).gridTemplateColumns,backdrop:getComputedStyle(document.querySelector('#grid .card')).backdropFilter}));
  assert.equal(await page.locator('#grid .card').count(),5,'stale Tube IDs must recover to five bundled cards offline');
  assert.ok((await page.locator('#grid .card').first().textContent()).includes('ICARUS'),'first cards should prepare for UCL induction');
  assert.ok((await page.locator('#grid').textContent()).includes('The Culture Map'),'the visible deck must include the international cohort reading');
  assert.ok((await page.locator('#grid').textContent()).includes('Entrepreneurial Finance'),'the visible deck must include an essential reading-list book');
  assert.equal(tube.stored,'stack');assert.equal(tube.layout,'stack');assert.ok(tube.columns&&tube.columns!=='none');assert.ok(tube.backdrop===''||tube.backdrop==='none');
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('#reader.show #answer');
  assert.ok((await page.locator('.v25TubeSource').textContent()).includes('UCL'),'the learning card must link to its source');
  await page.locator('#reader .option').first().click();
  const sentence='I would use this idea before making a difficult decision tomorrow.';
  await page.fill('#answer',sentence);
  await page.click('#submit');
  await page.waitForSelector('#next.show');
  const learned=await page.evaluate(()=>({last:tubeState.completed[tubeState.completed.length-1],private:window.__private}));
  assert.equal(learned.last.sentence,sentence,'Tube sentence must survive completion');
  assert.ok(learned.private.some(x=>x.kind==='learning_attempt'&&x.sentence===sentence),'Tube sentence must enter private learning stream');
  await page.waitForFunction(()=>tubeState.completed.at(-1)?.reviewStatus==='reviewed');
  assert.equal(await page.locator('#feedback h3').textContent(),'Clear application · 84/100','semantic review must replace the fallback feedback');

  await page.evaluate(()=>showScreen('home'));
  const started=Date.now();
  liveUi={schema:1,version:'25-test-b',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'append',columns:1,components:[{type:'input',kicker:'LIVE FIELD',title:'Loaded fast',text:'One declarative channel.',placeholder:'Write here'}]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  await page.waitForSelector('#v25DynamicHome >> text=Loaded fast',{timeout:4000});
  const liveFieldMs=Date.now()-started;assert.ok(liveFieldMs<4000,`live field took ${liveFieldMs}ms`);
  await page.fill('.v25RemoteInput','A remote field can still be private.');await page.waitForTimeout(650);
  assert.ok(await page.evaluate(()=>window.__private.some(x=>x.kind==='private_text_field'&&x.text.includes('remote field'))),'remote field must use same private capture path');
  await page.locator('.v25RemoteInput').evaluate(el=>el.blur());

  await page.evaluate(()=>{Native.saveState('vbrainPrivatePatch',JSON.stringify({liveUi:{expiresAt:new Date(Date.now()+3600000).toISOString(),home:{components:[{id:'next-learning-step',type:'button',kicker:'FOR YOU',title:'Review the simulation',text:'Try one useful card.',action:{type:'route',target:'tube'}}]}}}));onAppResume()});
  await page.waitForSelector('#v25DynamicHome >> text=Review the simulation');
  assert.equal(await page.locator('.v25HomeCard').count(),4,'personal hints must preserve the four core cards');
  await page.getByText('Review the simulation').click();await page.waitForSelector('#tubeScreen.show');
  assert.ok(await page.evaluate(()=>window.__events.some(x=>x.type==='ui_press_personal_module'&&x.data.id==='next-learning-step')),'personal module taps must be measurable without logging its text');
  await page.evaluate(()=>{Native.saveState('vbrainPrivatePatch',JSON.stringify({liveUi:{expiresAt:new Date(Date.now()-1000).toISOString(),home:{components:[{id:'next-learning-step',type:'button',title:'Review the simulation'}]}}}));showScreen('home');onAppResume()});
  assert.equal(await page.getByText('Review the simulation').count(),0,'expired personal UI must disappear');

  liveUi={schema:1,version:'25-test-c',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'replace',columns:1,components:[{type:'button',kicker:'NEXT UI',title:'A completely different Home',text:'Still one runtime.',action:{type:'route',target:'todos'}}]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  await page.waitForSelector('#v25DynamicHome >> text=A completely different Home',{timeout:4000});
  assert.equal(await page.locator('.v25HomeCard').first().evaluate(el=>getComputedStyle(el).display),'none');
  await page.getByText('A completely different Home').click();await page.waitForSelector('#todosScreen.show');

  liveUi={schema:1,version:'25-test-d',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'append',columns:1,components:[]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  await page.evaluate(()=>showScreen('home'));await page.waitForFunction(()=>getComputedStyle(document.querySelector('.v25HomeCard')).display!=='none',{timeout:4000});
  await page.click('#vbrainScoreV8');
  await page.waitForSelector('#v25Brain.show #v25BrainCanvas');
  assert.ok(await page.evaluate(()=>document.getElementById('v25BrainCanvas').width>0),'living brain canvas must render');
  await page.screenshot({path:path.join(root,'brain-screen-test.png'),fullPage:false});
  const graph=await page.evaluate(()=>{for(let i=0;i<105;i++)VBrain.branch('initiative',{id:'persist-'+i,label:'Persist '+i,description:'Retained branch '+i});const m=VBrain.model(true);return{nodes:m.nodes.length,found:VBrain.search('Persist 104').length,stored:JSON.parse(Native.loadState('vbrainGraphV26')).nodes['persist-104']!==undefined}});
  assert.ok(graph.nodes>=115&&graph.found===1&&graph.stored,'brain must retain more than 100 branches');
  await page.evaluate(()=>VBrain.openBrain());
  assert.equal(await page.locator('.v25BrainSearch.show').count(),1,'large network must be searchable');
  assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');
  assert.equal(await page.locator('#v25Brain.show').count(),0);
  await page.reload();await page.waitForFunction(()=>window.VBrain?.version===25);
  assert.ok(await page.evaluate(()=>VBrain.model(true).nodes.some(n=>n.id==='persist-104')),'branches must survive restart');

  const scoreBeforeImport=await page.evaluate(()=>VBrainScore.today());
  const archiveImport=await page.evaluate(()=>{const t=Date.now();todoState.archive.push(...Array.from({length:75},(_,i)=>({id:'bulk-archive-'+i,title:'Imported completed '+i,completedAt:t})));VBrainLean.updateHome();return{score:VBrainScore.today(),mini:document.getElementById('v25TaskToday').textContent}});
  assert.equal(archiveImport.score.score,scoreBeforeImport.score,'an imported archive must not inflate the day score');
  assert.equal(archiveImport.mini,String(scoreBeforeImport.counts.tasks),'the Home task count must reflect verified completions');
  const highDay=await page.evaluate(()=>{for(let i=0;i<25;i++)homeAdaptiveLog('todo_complete',{id:'score-task-'+i});for(let i=0;i<4;i++)homeAdaptiveLog('tube_complete',{cardId:'score-card-'+i});homeAdaptiveLog('gym_complete',{startedAt:Date.now()-12*60000,endedAt:Date.now(),completed:2,total:4,plan:'quick'});VBrainLean.updateHome();return{day:VBrainScore.today(),display:document.getElementById('v25Score').textContent,over:document.getElementById('v25Orb').classList.contains('over')}});
  assert.ok(highDay.day.score>100&&highDay.over&&highDay.display===String(highDay.day.score),'meaningful activity must remain comparable beyond 100');
  await page.locator('#v25Orb').click();await page.waitForSelector('#v28ScoreSheet.show');
  assert.ok((await page.locator('#v28ScoreSheet').textContent()).includes('100 is not a ceiling'));
  await page.screenshot({path:path.join(root,'score-sheet-screen-test.png'),fullPage:false});
  assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');assert.equal(await page.locator('#v28ScoreSheet.show').count(),0);
  const restoredScore=await page.evaluate(()=>{homeAdaptiveLog('todo_restore',{id:'score-task-0'});return VBrainScore.today()});
  assert.equal(restoredScore.counts.tasks,highDay.day.counts.tasks-1,'a same-day restore removes its completion from the score');
  const finalized=await page.evaluate(()=>{const key='vbrainDailyScoreV28',s=JSON.parse(Native.loadState(key)),d=new Date();d.setDate(d.getDate()-1);const yesterday=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;s.firstDay=yesterday;s.days[yesterday]={tasks:{'yesterday-task':d.getTime()},learn:{},move:{}};Native.saveState(key,JSON.stringify(s));localStorage.setItem(key,JSON.stringify(s));onAppResume();return{event:window.__events.find(x=>x.type==='daily_score_finalized'&&x.data.date===yesterday)?.data,history:VBrainScore.history()}});
  assert.ok(finalized.event?.score>0&&finalized.history.today.score===restoredScore.score,'yesterday is finalized and today remains a separate partial day');
  const comparison=await page.evaluate(()=>{const key='vbrainDailyScoreV28',s=JSON.parse(Native.loadState(key));for(let i=1;i<=14;i++){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;s.days[date]={final:{date,score:i<=7?20:10,parts:{tasks:i<=7?20:10,learn:0,move:0,balance:0},counts:{tasks:1,learn:0,move:0}}};if(i===14)s.firstDay=date}Native.saveState(key,JSON.stringify(s));localStorage.setItem(key,JSON.stringify(s));return VBrainScore.history()});
  assert.equal(comparison.last7,20);assert.equal(comparison.prior7,10);assert.equal(comparison.today.score,restoredScore.score,'weekly averages use completed days and exclude the current day');

  await page.evaluate(()=>showScreen('home'));
  const gymCenter=await page.locator('.v25HomeCard.gym').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
  const tubeCenter=await page.locator('.v25HomeCard.tube').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
  await page.mouse.move(gymCenter.x,gymCenter.y);await page.mouse.down();await page.waitForTimeout(560);
  assert.equal(await page.locator('.v28DragGhost').count(),1,'holding a card must lift an animated copy');
  await page.mouse.move(tubeCenter.x,tubeCenter.y,{steps:7});assert.equal(await page.locator('.v25HomeCard.tube.v28DropTarget').count(),1);
  await page.mouse.up();
  assert.deepEqual(await page.locator('.v25HomeCard').evaluateAll(xs=>xs.map(x=>x.dataset.route)),['tube','gym','todos','calendar'],'dropping over another card swaps only those positions');
  await page.reload();await page.waitForFunction(()=>window.VBrainScore?.version===28);
  assert.deepEqual(await page.locator('.v25HomeCard').evaluateAll(xs=>xs.map(x=>x.dataset.route)),['tube','gym','todos','calendar'],'Home order survives restart');
  assert.equal(await page.evaluate(()=>VBrainScore.today().score),restoredScore.score,'daily score survives restart');
  const gymTouch=await page.locator('.v25HomeCard.gym').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
  const tubeTouch=await page.locator('.v25HomeCard.tube').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gymTouch.x,y:gymTouch.y}]});await page.waitForTimeout(550);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tubeTouch.x,y:tubeTouch.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.deepEqual(await page.locator('.v25HomeCard').evaluateAll(xs=>xs.map(x=>x.dataset.route)),['gym','tube','todos','calendar'],'the same swap must work with a real mobile touch gesture');
  await page.locator('.v25HomeCard.gym').click();await page.waitForSelector('#gymScreen.show');await page.evaluate(()=>showScreen('home'));

  await page.evaluate(()=>window.onVBrainLiveUpdate({ready:true}));
  await page.waitForFunction(()=>window.__applied===1);
  assert.ok(await page.evaluate(()=>window.__checks>=1&&window.__commands>=1),'live/command checks remain active');
  assert.deepEqual(errors,[],'no runtime exceptions');
  await page.screenshot({path:path.join(root,'one-ui-v25-screen-test.png'),fullPage:false});
  console.log('VBRAIN_ONE_UI_V25_OK',JSON.stringify({boot,todoPerf,tube,routeMs:Number(routeMs.toFixed(2)),liveFieldMs,checks:await page.evaluate(()=>window.__checks),commands:await page.evaluate(()=>window.__commands)}));
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
