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
    window.__HOME_REMOTE_LOADER_V3__=true;
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
  const first=await page.evaluate(async()=>{
    const before=VBrainGraph.model().nodes.length;
    const a=VBrainGraph.branch('learning',{id:'test-branch-a',label:'Test branch A',value:55,confidence:40});
    let parent=a;
    for(let i=0;i<900;i++)parent=VBrainGraph.branch(parent,{id:'deep-'+i,label:'Deep branch '+i,value:50+(i%30),confidence:35+(i%45)});
    const b=VBrainGraph.branch(a,{id:'test-branch-b',label:'Test branch B',value:60,confidence:45});
    const collisionA=VBrainGraph.branch('learning',{id:'collision-test',label:'Collision original'});
    const collisionB=VBrainGraph.branch('learning',{id:'collision-test',label:'Collision different'});
    const m=VBrainGraph.model();
    const nested=m.nodes.some(n=>n.id===a)&&m.nodes.some(n=>n.id===b)&&m.nodes.some(n=>n.id==='deep-899')&&m.edges.some(e=>(e.a==='deep-898'&&e.b==='deep-899')||(e.a==='deep-899'&&e.b==='deep-898'));
    const collisionSafe=collisionA!==collisionB&&m.nodes.some(n=>n.id===collisionA&&n.label==='Collision original')&&m.nodes.some(n=>n.id===collisionB&&n.label==='Collision different');
    const searchable=VBrainGraph.search('Deep branch 899').some(n=>n.id==='deep-899');
    const stats=VBrainGraph.stats();

    let noteStable=true,notePersisted=false;
    if(typeof openTodoDetail==='function'){
      openTodoDetail('v19-test-task');
      await new Promise(r=>setTimeout(r,80));
      const note=document.getElementById('detailPersonalNote');
      if(note){
        note.focus();note.value='stable note while typing';note.setSelectionRange(note.value.length,note.value.length);note.dispatchEvent(new Event('input',{bubbles:true}));
        const cursor=note.selectionStart;
        await new Promise(r=>setTimeout(r,850));
        onNotionSnapshot?.({open:[{id:'v19-test-task',title:'V19 persistence test',area:'Learning',details:{outcome:'',info:[],tips:[],links:[],personalNote:''}}],completed:[],pendingTaskIds:[]});
        await new Promise(r=>setTimeout(r,80));
        noteStable=document.activeElement===note&&document.getElementById('detailPersonalNote')===note&&note.selectionStart===cursor&&note.value==='stable note while typing';
        note.blur();await new Promise(r=>setTimeout(r,80));
        notePersisted=(findTodo?.('v19-test-task')?.details?.personalNote||'')==='stable note while typing';
      }
    }
    const id=todoState.active.find(t=>t.id==='v19-test-task')?.id;
    const completed=id?completeTodo(id):false;
    const afterComplete=todoState.archive.some(t=>t.id===id);
    const restored=id?restoreTodo(id):false;
    const afterRestore=todoState.active.some(t=>t.id===id);
    return {before,nodes:m.nodes.length,nested,collisionSafe,searchable,stats,noteStable,notePersisted,completed,afterComplete,restored,afterRestore,hot:VBrainHotLoader.status(),runtime:VBrainRuntime.snapshot()};
  });
  if(!first.nested||!first.collisionSafe||!first.searchable||first.nodes<900)throw new Error('V19 graph stress failed '+JSON.stringify(first));
  if(first.stats?.renderLimit!==700)throw new Error('Graph scalability contract failed '+JSON.stringify(first.stats));
  if(!first.noteStable||!first.notePersisted)throw new Error('To-Do editor stability failed '+JSON.stringify(first));
  if(!first.completed||!first.afterComplete||!first.restored||!first.afterRestore)throw new Error('V19 To-Do smoke failed '+JSON.stringify(first));
  if(first.runtime?.nativeVersion!==18)throw new Error('Runtime evidence failed '+JSON.stringify(first.runtime));
  if(first.hot?.atomic!==true)throw new Error('Hot loader is not atomic '+JSON.stringify(first.hot));

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.VBrainGraph&&window.VBrainTodos&&window.VBrainRuntime&&window.VBrainHotLoader);
  const persisted=await page.evaluate(()=>{
    const m=VBrainGraph.model();
    const nested=m.nodes.some(n=>n.id==='deep-899')&&m.edges.some(e=>(e.a==='deep-898'&&e.b==='deep-899')||(e.a==='deep-899'&&e.b==='deep-898'));
    const collision=m.nodes.filter(n=>String(n.id).startsWith('collision-test')).length>=2;
    const task=todoState.active.some(t=>t.id==='v19-test-task')&&!todoState.archive.some(t=>t.id==='v19-test-task');
    const note=(findTodo?.('v19-test-task')?.details?.personalNote||'')==='stable note while typing';
    return {nested,collision,task,note,nodes:m.nodes.length,search:VBrainGraph.search('Deep branch 899').map(n=>n.id),hot:VBrainHotLoader.status(),runtime:VBrainRuntime.snapshot()};
  });
  if(!persisted.nested||!persisted.collision||!persisted.task||!persisted.note||persisted.nodes<900||!persisted.search.includes('deep-899'))throw new Error('V19 reload persistence failed '+JSON.stringify(persisted));
  console.log('VBRAIN_V19_OK',JSON.stringify({first,persisted}));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
