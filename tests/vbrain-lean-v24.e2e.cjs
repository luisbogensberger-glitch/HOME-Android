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
    const active=Array.from({length:193},(_,i)=>({id:'task-'+i,notionId:'task-'+i,title:'Task '+i,minutes:10+i%20,area:i%2?'Focus':'Personal',note:'A concise task note '+i,details:{outcome:'Finish task '+i,info:[],tips:[],links:[],personalNote:''}}));
    localStorage.setItem('native:todoState',JSON.stringify({active,archive:[]}));
    localStorage.setItem('homeRemoteJsV2','window.__POISON__=true');
    localStorage.setItem('homeBehaviorJsV3','window.__BEHAVIOR_POISON__=true');
    window.Native={
      loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,checkedAt:Date.now(),ready:false}),
      markRuntimeHealthy:()=>{window.__healthy=true},checkLiveUpdate:()=>{window.__checks++},applyLiveUpdate:()=>{window.__applied++},
      hasNotionConnection:()=>true,configureNotion:()=>{},configureVeqrya:()=>{},disconnectNotion:()=>{},requestNotionSync:()=>{window.__notionSync++},setNotionTaskDone:()=>{},createNotionTask:()=>{},
      hasCalendarPermission:()=>false,getCalendarEvents:()=>'[]',requestCalendarPermission:()=>{},openUrl:()=>{}
    };
    window.AdaptiveNative={
      logActivity:r=>window.__events.push(JSON.parse(r)),queuePrivateActivity:r=>{window.__private.push(JSON.parse(r));return true},
      flushPrivateSync:()=>{window.__flushes++},checkDeviceCommands:()=>{window.__commands++}
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
    brainText:document.getElementById('vbrainScoreV8')?.innerText.includes('Behaviour intelligence'),
    sync:document.querySelectorAll('.syncBar').length,
    legacy:document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#vbRestoreInline,#v24BrainOverlay').length,
    poison:!!window.__POISON__||!!window.__BEHAVIOR_POISON__,
    oldJs:localStorage.getItem('homeRemoteJsV2'),oldBehaviour:localStorage.getItem('homeBehaviorJsV3'),notionSync:window.__notionSync
  }));
  assert.deepEqual(boot,{injected:1,cards:3,order:['gym','tube','todos'],signal:true,brainText:true,sync:0,legacy:0,poison:false,oldJs:null,oldBehaviour:null,notionSync:0});
  assert.deepEqual(heavy,[],'no retired runtime requests');

  for(let i=0;i<3;i++){
    await page.evaluate(()=>window.onAppResume?.());
    await page.waitForTimeout(120);
    const state=await page.evaluate(()=>({cards:document.querySelectorAll('.v25HomeCard').length,order:[...document.querySelectorAll('.v25HomeCard')].map(x=>x.dataset.route),legacy:document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#v24BrainOverlay').length,sync:window.__notionSync}));
    assert.deepEqual(state,{cards:3,order:['gym','tube','todos'],legacy:0,sync:0},'resume must keep exactly one Home and never auto-sync tasks');
  }

  const routeMs=await page.evaluate(()=>{const t=performance.now();showScreen('todos');return performance.now()-t});
  assert.ok(routeMs<50,`todo route should be synchronous, got ${routeMs}ms`);
  await page.waitForSelector('#todosScreen.show');
  const todoPerf=await page.evaluate(()=>({rows:document.querySelectorAll('#todoList .todo').length,more:!!document.querySelector('#todoList .v25More'),total:document.getElementById('todoStats').textContent,sync:window.__notionSync,backdrop:getComputedStyle(document.querySelector('#todoList .todo')).backdropFilter}));
  assert.ok(todoPerf.rows<=18,'193 tasks must not become 193 DOM cards');
  assert.equal(todoPerf.more,true);assert.equal(todoPerf.total,'193 open');assert.equal(todoPerf.sync,0);assert.ok(todoPerf.backdrop===''||todoPerf.backdrop==='none');

  await page.locator('#todoList .todo').first().click();
  await page.waitForSelector('#todoDetailScreen.show #detailPersonalNote');
  await page.fill('#detailPersonalNote','Remember this private task note for the brain.');
  await page.waitForTimeout(650);
  assert.ok(await page.evaluate(()=>window.__private.some(x=>x.kind==='private_text_field'&&x.field==='detailPersonalNote'&&x.text.includes('private task note'))),'task note must be privately captured');

  await page.evaluate(()=>showScreen('tube'));
  await page.waitForSelector('#tubeScreen.show #grid .card');
  const tube=await page.evaluate(()=>({stored:localStorage.getItem('homeTubeLayoutV6'),layout:document.getElementById('grid').dataset.layout,columns:getComputedStyle(document.getElementById('grid')).gridTemplateColumns,backdrop:getComputedStyle(document.querySelector('#grid .card')).backdropFilter}));
  assert.equal(tube.stored,'stack');assert.equal(tube.layout,'stack');assert.ok(tube.columns&&tube.columns!=='none');assert.ok(tube.backdrop===''||tube.backdrop==='none');
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('#reader.show #answer');
  await page.locator('#reader .option').first().click();
  const sentence='I would use this idea before making a difficult decision tomorrow.';
  await page.fill('#answer',sentence);
  await page.click('#submit');
  await page.waitForSelector('#next.show');
  const learned=await page.evaluate(()=>({last:tubeState.completed[tubeState.completed.length-1],private:window.__private}));
  assert.equal(learned.last.sentence,sentence,'Tube sentence must survive completion');
  assert.ok(learned.private.some(x=>x.kind==='learning_attempt'&&x.sentence===sentence),'Tube sentence must enter private learning stream');

  await page.evaluate(()=>showScreen('home'));
  const started=Date.now();
  liveUi={schema:1,version:'25-test-b',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'append',columns:1,components:[{type:'input',kicker:'LIVE FIELD',title:'Loaded fast',text:'One declarative channel.',placeholder:'Write here'}]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  await page.waitForSelector('#v25DynamicHome >> text=Loaded fast',{timeout:4000});
  const liveFieldMs=Date.now()-started;assert.ok(liveFieldMs<4000,`live field took ${liveFieldMs}ms`);
  await page.fill('.v25RemoteInput','A remote field can still be private.');await page.waitForTimeout(650);
  assert.ok(await page.evaluate(()=>window.__private.some(x=>x.kind==='private_text_field'&&x.text.includes('remote field'))),'remote field must use same private capture path');

  liveUi={schema:1,version:'25-test-c',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'replace',columns:1,components:[{type:'button',kicker:'NEXT UI',title:'A completely different Home',text:'Still one runtime.',action:{type:'route',target:'todos'}}]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  await page.waitForSelector('#v25DynamicHome >> text=A completely different Home',{timeout:4000});
  assert.equal(await page.locator('.v25HomeCard').first().evaluate(el=>getComputedStyle(el).display),'none');
  await page.getByText('A completely different Home').click();await page.waitForSelector('#todosScreen.show');

  liveUi={schema:1,version:'25-test-d',pollMs:1500,theme:{accent:'#f2ce62'},home:{mode:'append',columns:1,components:[]},slots:{gym:[],todos:[],tube:[],todoDetail:[]}};
  await page.evaluate(()=>showScreen('home'));await page.waitForFunction(()=>getComputedStyle(document.querySelector('.v25HomeCard')).display!=='none',{timeout:4000});
  await page.click('#vbrainScoreV8');
  await page.waitForSelector('#v25Brain.show #v25BrainCanvas');
  assert.ok(await page.evaluate(()=>document.getElementById('v25BrainCanvas').width>0),'living brain canvas must render');
  assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');
  assert.equal(await page.locator('#v25Brain.show').count(),0);

  await page.evaluate(()=>window.onVBrainLiveUpdate({ready:true}));
  await page.waitForFunction(()=>window.__applied===1);
  assert.ok(await page.evaluate(()=>window.__checks>=1&&window.__commands>=1),'live/command checks remain active');
  assert.deepEqual(errors,[],'no runtime exceptions');
  await page.screenshot({path:path.join(root,'one-ui-v25-screen-test.png'),fullPage:false});
  console.log('VBRAIN_ONE_UI_V25_OK',JSON.stringify({boot,todoPerf,tube,routeMs:Number(routeMs.toFixed(2)),liveFieldMs,checks:await page.evaluate(()=>window.__checks),commands:await page.evaluate(()=>window.__commands)}));
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
