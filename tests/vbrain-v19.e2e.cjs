const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const assert=require('assert/strict'),crypto=require('crypto');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'home-runtime','live-app.html'),'utf8');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8766,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/London'});
  let hot={schema:1,version:'test-empty',minHost:18,modules:[]},bodies={};
  const module=(name,body)=>{bodies[name]=body;return{name,kind:'js',sha256:crypto.createHash('sha256').update(body).digest('hex')}};
  await context.route('https://raw.githubusercontent.com/**',r=>r.abort());
  await context.route('**/hot-manifest-v19.json*',r=>r.fulfill({json:hot}));
  await context.route('**/patch-regression-*.js*',r=>{const key=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({body:bodies[key]||'',contentType:'text/javascript'})});
  await context.route('**/adaptive-ui.json*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'adaptive-ui.json'),'utf8'),contentType:'application/json'}));
  await context.route('**/tube-feed.json*',r=>r.fulfill({body:fs.readFileSync(path.join(root,'tube-feed.json'),'utf8'),contentType:'application/json'}));
  await context.addInitScript(()=>{
    const seed={active:[{id:'v19-test-task',notionId:'v19-test-task',title:'V19 persistence test',area:'Learning',details:{outcome:'',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
    if(!localStorage.getItem('native:todoState'))localStorage.setItem('native:todoState',JSON.stringify(seed));
    if(!localStorage.getItem('native:livingBrainGraphV6'))localStorage.setItem('native:livingBrainGraphV6',JSON.stringify({nodes:{'old-home-branch':{id:'old-home-branch',label:'Old HOME branch',value:20}},edges:[]}));
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
  const waitHot=async v=>{try{await page.waitForFunction(v=>window.VBrainHotLoader?.status().version===v,v)}catch(e){throw Error('Hot loader '+v+' timeout: '+JSON.stringify(await page.evaluate(()=>({status:window.VBrainHotLoader?.status(),rejected:localStorage.getItem("vbrainHotRejectedV19"),pending:localStorage.getItem("vbrainHotPendingV20"),screen:document.querySelector(".screen.show")?.id}))))}};
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
  // Restore/completion intent survives stale server snapshots and identical task names are distinct.
  await page.evaluate(()=>{
    const item=JSON.parse(JSON.stringify(todoState.active.find(t=>t.id==='v19-test-task')));
    completeTodo(item.id);onNotionSnapshot({open:[item],completed:[],pendingTaskIds:[item.id]});
    if(!todoState.archive.some(t=>t.id===item.id))throw Error('stale completion overwrite');
    restoreTodo(item.id);onNotionSnapshot({open:[],completed:[item],pendingTaskIds:[item.id]});
    if(!todoState.active.some(t=>t.id===item.id))throw Error('stale restore overwrite');
    todoState.active.push({...item,id:'same-title-different-task'});VBrainTodos.persist();
    if(todoState.active.filter(t=>t.title===item.title).length!==2)throw Error('same-title task lost');
    onNotionSnapshot({open:JSON.parse(JSON.stringify(todoState.active)),completed:JSON.parse(JSON.stringify(todoState.archive)),pendingTaskIds:[]});
    openTodoDetail(item.id);
  });
  const note=page.locator('#detailPersonalNote');await note.fill('A note with a cursor');
  await note.evaluate(el=>el.setSelectionRange(6,6));await page.waitForTimeout(650);
  assert.equal(await note.evaluate(el=>el.selectionStart),6,'typing must not rebuild/reset the focused field');
  await note.fill('');
  await page.evaluate(()=>onNotionSnapshot({open:[{id:'v19-test-task',title:'V19 persistence test',details:{personalNote:'STALE'}}],completed:[],pendingTaskIds:['v19-test-task']}));
  assert.equal(await note.inputValue(),'','explicit empty note wins');
  await page.evaluate(()=>{handleAndroidBack();handleAndroidBack()});
  assert.ok(await page.evaluate(()=>VBrainGraph.model().nodes.some(n=>n.id==='old-home-branch')),'native HOME v6 graph key is migrated');
  await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('vbrainBranchesV19')||'{"nodes":{},"edges":{}}');
    for(let i=0;i<520;i++){const id='scale-'+i,parent=i?'scale-'+(i-1):'learning';s.nodes[id]={id,label:'Scale branch '+i,pinned:true,value:0,confidence:0};s.edges[parent+'::'+id]={a:parent,b:id,w:40,pinned:true}}
    localStorage.setItem('vbrainBranchesV19',JSON.stringify(s));VBrainGraph.open();
  });
  assert.ok(await page.evaluate(()=>VBrainGraph.model().nodes.length>=523),'no small node count cap');
  await page.getByRole('searchbox',{name:'Find a brain branch'}).fill('Scale branch 519');
  await page.locator('.vb20Results button').click();
  assert.ok((await page.locator('.vb19Detail').innerText()).includes('Scale branch 519'));
  await page.screenshot({path:path.join(root,'persistent-brain-screen-test.png')});
  await page.evaluate(()=>{window.__graphApplied=false;Native.applyLiveUpdate=()=>{window.__graphApplied=true};onVBrainLiveUpdate({ready:true})});
  assert.equal(await page.evaluate(()=>window.__graphApplied),false,'full updates cannot close an open brain');
  await page.evaluate(()=>{onVBrainLiveUpdate({ready:false});handleAndroidBack()});
  await page.reload();await page.waitForFunction(()=>window.VBrainHotLoader&&window.VBrainGraph);
  assert.ok(await page.evaluate(()=>VBrainGraph.model().nodes.some(n=>n.id==='scale-519')),'deep chain persists across restart');
  await waitHot('test-empty');
  // A bad hash or syntax must never execute even the first module.
  hot={schema:1,version:'bad-hash',minHost:18,modules:[{...module('patch-regression-hash.js','window.__badHash=true'),sha256:'0'.repeat(64)}]};
  await page.evaluate(()=>VBrainHotLoader.refresh());assert.equal(await page.evaluate(()=>!!window.__badHash),false);
  hot={schema:1,version:'bad-syntax',minHost:18,modules:[module('patch-regression-first.js','window.__partial=true'),module('patch-regression-syntax.js','function {')]};
  await page.evaluate(()=>VBrainHotLoader.refresh());assert.equal(await page.evaluate(()=>!!window.__partial),false);
  hot={schema:1,version:'good-one',minHost:18,modules:[module('patch-regression-one.js','window.__patchOne=true;')]};
  await page.evaluate(()=>VBrainHotLoader.refresh());await waitHot('good-one');
  await page.evaluate(()=>VBrainHotLoader.refresh());assert.ok(await page.evaluate(()=>window.__patchOne));
  hot={schema:1,version:'good-two',minHost:18,modules:[module('patch-regression-two.js','window.__patchTwo=true;')]};
  await page.evaluate(()=>{VBrainHotLoader.refresh()});await waitHot('good-two');
  assert.equal(await page.evaluate(()=>!!window.__patchOne),false,'old JS side effects removed by clean activation');
  hot={schema:1,version:'bad-runtime',minHost:18,modules:[module('patch-regression-throw.js','window.__halfApplied=true;throw Error("Intentional regression test")')]};
  await page.evaluate(()=>{VBrainHotLoader.refresh()});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vbrainHotRejectedV19')||'[]').includes('bad-runtime')&&window.VBrainHotLoader?.status().version==='good-two');
  assert.equal(await page.evaluate(()=>!!window.__halfApplied),false,'failed JS side effects are cleared');
  assert.ok(await page.evaluate(()=>window.__patchTwo),'last good JS restored');
  assert.ok(await page.evaluate(()=>VBrainGraph.model().nodes.some(n=>n.id==='scale-519')),'rollback preserves brain');
  console.log('PASS: To-Do cursor/empty notes/restore conflicts, HOME migration, 520 nested branches, search, update deferral, hash/syntax rejection, clean JS replacement and rollback');
  console.log('VBRAIN_V19_OK' ,JSON.stringify({first,persisted}));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});

