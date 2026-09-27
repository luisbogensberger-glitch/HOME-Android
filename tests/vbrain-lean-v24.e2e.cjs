const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');

(async()=>{
  const html=fs.readFileSync(path.join(root,'home-runtime/live-app.html'));
  let liveUi={schema:1,version:'24-test-a',pollMs:1500,theme:{accent:'#f0c95d'},home:{mode:'append',columns:1,components:[]},slots:{calendar:[],todos:[],tube:[],todoDetail:[]}};
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8774,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'Europe/London'});
  await context.route('**/ui-live-v24.json*',route=>route.fulfill({json:liveUi}));
  await context.addInitScript(()=>{
    window.__healthy=false;window.__checks=0;window.__applied=0;window.__commands=0;window.__flushes=0;window.__events=[];window.__private=[];
    const seed={active:[{id:'lean-task',notionId:'lean-task',title:'One useful task',area:'Focus',details:{outcome:'Finish it',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
    localStorage.setItem('native:todoState',JSON.stringify(seed));
    localStorage.setItem('homeRemoteJsV2','window.__POISON__=true');
    localStorage.setItem('homeBehaviorJsV3','window.__BEHAVIOR_POISON__=true');
    window.Native={
      loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,checkedAt:Date.now(),ready:false}),
      markRuntimeHealthy:()=>{window.__healthy=true},checkLiveUpdate:()=>{window.__checks++},applyLiveUpdate:()=>{window.__applied++},
      hasNotionConnection:()=>false,configureNotion:()=>{},configureVeqrya:()=>{},disconnectNotion:()=>{},requestNotionSync:()=>{},setNotionTaskDone:()=>{},createNotionTask:()=>{},
      hasCalendarPermission:()=>false,getCalendarEvents:()=>'[]',requestCalendarPermission:()=>{},openUrl:()=>{}
    };
    window.AdaptiveNative={
      logActivity:r=>window.__events.push(JSON.parse(r)),queuePrivateActivity:r=>{window.__private.push(JSON.parse(r));return'queued'},
      flushPrivateSync:()=>{window.__flushes++},checkDeviceCommands:()=>{window.__commands++}
    };
  });

  const page=await context.newPage();const errors=[],heavy=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(/behavior-v3|adaptive-ui\.json|hot-manifest|remote-extension-loader|vbrain-personalizer/i.test(req.url()))heavy.push(req.url())});
  await page.goto('http://127.0.0.1:8774');
  await page.waitForFunction(()=>window.VBrainLean?.version===24&&window.__healthy===true);

  const boot=await page.evaluate(()=>({
    injected:document.querySelectorAll('script[data-source]').length,
    nav:document.querySelectorAll('.v24Nav [data-v24-route]').length,
    signal:!!document.getElementById('vbrainScoreV8'),
    legacy:document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#vbRestoreInline').length,
    poison:!!window.__POISON__||!!window.__BEHAVIOR_POISON__,
    oldJs:localStorage.getItem('homeRemoteJsV2'),oldBehaviour:localStorage.getItem('homeBehaviorJsV3')
  }));
  assert.deepEqual(boot,{injected:1,nav:3,signal:true,legacy:0,poison:false,oldJs:null,oldBehaviour:null});
  assert.deepEqual(heavy,[],'no retired remote runtime requests');

  // Reproduce the user's failure mode: multiple foreground cycles must never rebuild old Home.
  for(let i=0;i<2;i++){
    await page.evaluate(()=>window.onAppResume?.());
    await page.waitForTimeout(250);
    const state=await page.evaluate(()=>({nav:document.querySelectorAll('.v24Nav [data-v24-route]').length,legacy:document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17').length,home:document.getElementById('homeScreen').innerText.includes('Your signal today')}));
    assert.deepEqual(state,{nav:3,legacy:0,home:true},'resume must keep the lean Home deterministic');
  }

  const routeMs=await page.evaluate(()=>{const t=performance.now();showScreen('todos');return performance.now()-t});
  assert.ok(routeMs<50,`local screen switch should be synchronous, got ${routeMs}ms`);
  await page.waitForSelector('#todosScreen.show');
  const todoBackdrop=await page.locator('#todoList .todo').first().evaluate(el=>getComputedStyle(el).backdropFilter);
  assert.ok(todoBackdrop===''||todoBackdrop==='none','todo list must not use GPU backdrop blur');

  await page.evaluate(()=>showScreen('tube'));
  await page.waitForSelector('#tubeScreen.show #grid .card');
  const tube=await page.evaluate(()=>({stored:localStorage.getItem('homeTubeLayoutV6'),layout:document.getElementById('grid').dataset.layout,columns:getComputedStyle(document.getElementById('grid')).gridTemplateColumns,backdrop:getComputedStyle(document.querySelector('#grid .card')).backdropFilter}));
  assert.equal(tube.stored,'stack');assert.equal(tube.layout,'stack');assert.ok(tube.columns&&tube.columns!=='none');assert.ok(tube.backdrop===''||tube.backdrop==='none');

  await page.evaluate(()=>showScreen('home'));
  const started=Date.now();
  liveUi={schema:1,version:'24-test-b',pollMs:1500,theme:{accent:'#f0c95d'},home:{mode:'append',columns:1,components:[{type:'card',kicker:'LIVE',title:'Loaded fast',text:'No reboot. No extra runtime.'}]},slots:{calendar:[],todos:[],tube:[],todoDetail:[]}};
  await page.waitForSelector('#v24DynamicHome >> text=Loaded fast',{timeout:4000});
  const liveFieldMs=Date.now()-started;assert.ok(liveFieldMs<4000,`declarative field took ${liveFieldMs}ms`);

  // The same data channel can replace the whole Home without loading executable code.
  liveUi={schema:1,version:'24-test-c',pollMs:1500,theme:{accent:'#f0c95d'},home:{mode:'replace',columns:1,components:[{type:'button',kicker:'NEXT UI',title:'A completely different Home',text:'Still one runtime.',action:{type:'route',target:'todos'}}]},slots:{calendar:[],todos:[],tube:[],todoDetail:[]}};
  await page.waitForSelector('#v24DynamicHome >> text=A completely different Home',{timeout:4000});
  assert.equal(await page.locator('.v24CoreHome').evaluate(el=>getComputedStyle(el).display),'none');
  await page.getByText('A completely different Home').click();await page.waitForSelector('#todosScreen.show');

  await page.evaluate(()=>showScreen('home'));
  await page.evaluate(()=>window.onVBrainLiveUpdate({ready:true}));
  await page.waitForFunction(()=>window.__applied===1);

  await page.evaluate(()=>{document.getElementById('vbrainScoreV8').click()});
  await page.waitForSelector('#v24BrainOverlay.show');
  assert.equal(await page.evaluate(()=>handleAndroidBack()),'handled');
  assert.equal(await page.locator('#v24BrainOverlay.show').count(),0);

  assert.ok(await page.evaluate(()=>window.__checks>=1&&window.__commands>=1),'fast live/command checks must run');
  assert.deepEqual(errors,[],'no runtime exceptions');
  await page.screenshot({path:path.join(root,'lean-v24-screen-test.png'),fullPage:false});
  console.log('VBRAIN_LEAN_V24_OK',JSON.stringify({boot,tube,routeMs:Number(routeMs.toFixed(2)),liveFieldMs,checks:await page.evaluate(()=>window.__checks),commands:await page.evaluate(()=>window.__commands)}));
  await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
