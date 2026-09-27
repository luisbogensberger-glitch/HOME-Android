const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'home-runtime','live-app.html'),'utf8');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8766,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/London'});
  await context.addInitScript(()=>{
    const seed={active:[{id:'v19-test-task',notionId:'v19-test-task',title:'V19 persistence test',area:'Learning',details:{outcome:'',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
    if(!localStorage.getItem('native:todoState'))localStorage.setItem('native:todoState',JSON.stringify(seed));
    window.Native={
      loadState:k=>localStorage.getItem('native:'+k)||'', saveState:(k,v)=>{localStorage.setItem('native:'+k,v)}, acceptRemoteTodoState:(v)=>{localStorage.setItem('native:todoState',v)},
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,ready:false}),
      markRuntimeHealthy:()=>{}, checkLiveUpdate:()=>{}, applyLiveUpdate:()=>{}, hasNotionConnection:()=>true,
      requestNotionSync:()=>{}, getCalendarEvents:()=> '[]', hasCalendarPermission:()=>true,openUrl:()=>{}
    };
    window.AdaptiveNative={
      queuePrivateActivity:()=> 'queued', flushPrivateSync:()=>{}, homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),
      checkDeviceCommands:()=>{}, notificationSettings:()=>JSON.stringify({enabled:true}), scheduleSmartReminder:()=>{}, cancelNotification:()=>{},
      logActivity:()=>{},logPrivateActivity:()=>{},queueLearningAttempt:()=> 'queued',hasNotificationPermission:()=>true
    };
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8766');
  await page.waitForFunction(()=>window.VBrainGraph&&window.VBrainTodos&&window.VBrainRuntime&&window.VBrainHotLoader);
  await page.waitForTimeout(2400);
  const first=await page.evaluate(()=>{
    const before=VBrainGraph.model().nodes.length;
    const a=VBrainGraph.branch('learning',{id:'test-branch-a',label:'Test branch A',value:55,confidence:40});
    const b=VBrainGraph.branch(a,{id:'test-branch-b',label:'Test branch B',value:60,confidence:45});
    const m=VBrainGraph.model();
    const nested=m.nodes.some(n=>n.id===a)&&m.nodes.some(n=>n.id===b)&&m.edges.some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
    const id=todoState.active.find(t=>t.id==='v19-test-task')?.id;
    const completed=id?completeTodo(id):false;
    const afterComplete=todoState.archive.some(t=>t.id===id);
    const restored=id?restoreTodo(id):false;
    const afterRestore=todoState.active.some(t=>t.id===id);
    return {before,nodes:m.nodes.length,nested,completed,afterComplete,restored,afterRestore,hot:!!VBrainHotLoader,runtime:VBrainRuntime.snapshot()};
  });
  if(!first.nested||!first.completed||!first.afterComplete||!first.restored||!first.afterRestore||!first.hot)throw new Error('V19 first-pass smoke failed '+JSON.stringify(first));
  if(first.runtime?.nativeVersion!==18)throw new Error('Runtime evidence failed '+JSON.stringify(first.runtime));

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.VBrainGraph&&window.VBrainTodos&&window.VBrainRuntime&&window.VBrainHotLoader);
  const persisted=await page.evaluate(()=>{
    const m=VBrainGraph.model();
    const nested=m.nodes.some(n=>n.id==='test-branch-a')&&m.nodes.some(n=>n.id==='test-branch-b')&&m.edges.some(e=>(e.a==='test-branch-a'&&e.b==='test-branch-b')||(e.a==='test-branch-b'&&e.b==='test-branch-a'));
    const task=todoState.active.some(t=>t.id==='v19-test-task')&&!todoState.archive.some(t=>t.id==='v19-test-task');
    return {nested,task,nodes:m.nodes.length,hot:VBrainHotLoader.status(),runtime:VBrainRuntime.snapshot()};
  });
  if(!persisted.nested||!persisted.task)throw new Error('V19 reload persistence failed '+JSON.stringify(persisted));
  console.log('VBRAIN_V19_OK',JSON.stringify({first,persisted}));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
