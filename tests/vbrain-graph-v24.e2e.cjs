const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const html=fs.readFileSync(path.join(root,'home-runtime/live-app.html'),'utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(8766,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/London'});
 await context.addInitScript(()=>{
   const seed={active:[{id:'v24-graph-task',notionId:'v24-graph-task',title:'Persistence test',area:'Learning',details:{outcome:'',info:[],tips:[],links:[],personalNote:''}}],archive:[]};
   if(!localStorage.getItem('native:todoState'))localStorage.setItem('native:todoState',JSON.stringify(seed));
   window.Native={loadState:k=>localStorage.getItem('native:'+k)||'',saveState:(k,v)=>localStorage.setItem('native:'+k,v),acceptRemoteTodoState:v=>localStorage.setItem('native:todoState',v),liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'live',healthy:true,ready:false}),markRuntimeHealthy:()=>{},checkLiveUpdate:()=>{},applyLiveUpdate:()=>{},hasNotionConnection:()=>true,requestNotionSync:()=>{},getCalendarEvents:()=>'[]',hasCalendarPermission:()=>true,openUrl:()=>{}};
   window.AdaptiveNative={queuePrivateActivity:()=> 'queued',flushPrivateSync:()=>{},homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),checkDeviceCommands:()=>{},notificationSettings:()=>JSON.stringify({enabled:true}),scheduleSmartReminder:()=>{},cancelNotification:()=>{},logActivity:()=>{},logPrivateActivity:()=>{},queueLearningAttempt:()=> 'queued',hasNotificationPermission:()=>true};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766');
 await page.waitForFunction(()=>document.documentElement.dataset.vbrainHydrated==='24'&&window.VBrainGraph&&window.VBrainTodos);
 const first=await page.evaluate(()=>{
   const before=VBrainGraph.model().nodes.length;
   const a=VBrainGraph.branch('learning',{id:'v24-a',label:'V24 branch A',value:55,confidence:40});let parent=a;
   for(let i=0;i<300;i++)parent=VBrainGraph.branch(parent,{id:'v24-deep-'+i,label:'V24 deep '+i,value:50+(i%30),confidence:35+(i%45)});
   const c1=VBrainGraph.branch('learning',{id:'v24-collision',label:'Original'}),c2=VBrainGraph.branch('learning',{id:'v24-collision',label:'Different'});
   const m=VBrainGraph.model(),id=todoState.active.find(t=>t.id==='v24-graph-task')?.id;
   const completed=id?completeTodo(id):false,archived=todoState.archive.some(t=>t.id===id),restored=id?restoreTodo(id):false;
   return{before,nodes:m.nodes.length,nested:m.nodes.some(n=>n.id==='v24-deep-299'),collision:c1!==c2&&m.nodes.some(n=>n.id===c1)&&m.nodes.some(n=>n.id===c2),search:VBrainGraph.search('V24 deep 299').some(n=>n.id==='v24-deep-299'),stats:VBrainGraph.stats(),completed,archived,restored,active:todoState.active.some(t=>t.id===id)};
 });
 assert.ok(first.nodes>=300&&first.nested&&first.collision&&first.search,'graph remains scalable and collision-safe');
 assert.equal(first.stats.renderLimit,700);assert.ok(first.completed&&first.archived&&first.restored&&first.active,'todo state transitions persist');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.vbrainHydrated==='24'&&window.VBrainGraph&&window.VBrainTodos);
 const persisted=await page.evaluate(()=>({deep:VBrainGraph.model().nodes.some(n=>n.id==='v24-deep-299'),search:VBrainGraph.search('V24 deep 299').some(n=>n.id==='v24-deep-299'),task:todoState.active.some(t=>t.id==='v24-graph-task')}));
 assert.ok(persisted.deep&&persisted.search&&persisted.task,'graph and todo state survive reload');
 assert.deepEqual(errors,[],'no runtime exceptions');
 console.log('VBRAIN_GRAPH_V24_OK',JSON.stringify({first,persisted}));
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
