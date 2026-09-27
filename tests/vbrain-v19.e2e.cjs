const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{
    const state={};
    window.Native={
      loadState:k=>state[k]||'', saveState:(k,v)=>{state[k]=v}, acceptRemoteTodoState:(v)=>{state.todoState=v},
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,ready:false}),
      markRuntimeHealthy:()=>{}, checkLiveUpdate:()=>{}, applyLiveUpdate:()=>{}, hasNotionConnection:()=>true,
      requestNotionSync:()=>{}, getCalendarEvents:()=> '[]', hasCalendarPermission:()=>true
    };
    window.AdaptiveNative={
      queuePrivateActivity:()=> 'queued', flushPrivateSync:()=>{}, homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),
      checkDeviceCommands:()=>{}, notificationSettings:()=>JSON.stringify({enabled:true}), scheduleSmartReminder:()=>{}, cancelNotification:()=>{}
    };
  });
  const html=fs.readFileSync(path.join(__dirname,'..','home-runtime','live-app.html'),'utf8');
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  const result=await page.evaluate(()=>{
    const before=VBrainGraph.model().nodes.length;
    const a=VBrainGraph.branch('learning',{id:'test-branch-a',label:'Test branch A',value:55,confidence:40});
    const b=VBrainGraph.branch(a,{id:'test-branch-b',label:'Test branch B',value:60,confidence:45});
    const m=VBrainGraph.model();
    const nested=m.nodes.some(n=>n.id===a)&&m.nodes.some(n=>n.id===b)&&m.edges.some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
    const startActive=todoState.active.length;
    const id=todoState.active[0]?.id;
    const completed=id?completeTodo(id):false;
    const afterComplete=todoState.archive.some(t=>t.id===id);
    const restored=id?restoreTodo(id):false;
    const afterRestore=todoState.active.some(t=>t.id===id);
    return {before,nodes:m.nodes.length,nested,startActive,completed,afterComplete,restored,afterRestore,hot:!!VBrainHotLoader,runtime:VBrainRuntime?.snapshot?.()};
  });
  if(!result.nested||!result.completed||!result.afterComplete||!result.restored||!result.afterRestore||!result.hot)throw new Error('V19 smoke failed '+JSON.stringify(result));
  if(result.runtime?.nativeVersion!==18)throw new Error('Runtime evidence failed '+JSON.stringify(result.runtime));
  console.log('VBRAIN_V19_OK',JSON.stringify(result));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
