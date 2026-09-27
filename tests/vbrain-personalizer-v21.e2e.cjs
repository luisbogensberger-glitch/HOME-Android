const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'home-runtime','live-app.html'),'utf8');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8768,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin'});
  await context.addInitScript(()=>{
    const now=Date.now(),rows=[];
    for(let i=0;i<9;i++){
      rows.push({id:'tube-open-'+i,type:'tube_card_open',at:now-i*3600000,screen:'tube',data:{}});
      rows.push({id:'tube-done-'+i,type:'tube_complete',at:now-i*3600000+1000,screen:'tube',data:{score:85}});
      rows.push({id:'tube-dwell-'+i,type:'screen_dwell',at:now-i*3600000+2000,screen:'tube',data:{name:'tube',ms:150000}});
    }
    rows.push({id:'todo-open',type:'todo_open',at:now-1000,screen:'todos',data:{}});
    localStorage.setItem('homeAdaptiveActivityV1',JSON.stringify(rows));
    window.__p21logs=[];
    window.__p21PrivatePatch={};
    window.__p21Context={schema:1,generatedAt:new Date(now).toISOString(),items:[
      {key:'goal.learning_growth',kind:'goal',statement:'Wissen aufbauen und messbare Fortschritte machen.',confidence:1,evidence_count:1,value:{priority:'high'}},
      {key:'preference.brain_ui',kind:'preference',statement:'<img id="context-xss" src=x onerror=alert(1)> Gehirnansicht erhalten.',confidence:1,evidence_count:1,value:{preserve:true}}
    ]};
    window.Native={
      loadState:k=>k==='vbrainBrainContext'?JSON.stringify(window.__p21Context):k==='vbrainPrivatePatch'?JSON.stringify(window.__p21PrivatePatch):(localStorage.getItem('native:'+k)||''),
      saveState:(k,v)=>localStorage.setItem('native:'+k,v),
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,ready:false}),
      markRuntimeHealthy:()=>{},checkLiveUpdate:()=>{},applyLiveUpdate:()=>{},hasNotionConnection:()=>false,requestNotionSync:()=>{},getCalendarEvents:()=> '[]',hasCalendarPermission:()=>false,openUrl:()=>{}
    };
    window.AdaptiveNative={
      logActivity:raw=>{try{window.__p21logs.push(JSON.parse(raw))}catch(_){}},queuePrivateActivity:()=> 'queued',logPrivateActivity:()=>{},queueLearningAttempt:()=> 'queued',flushPrivateSync:()=>{},
      homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),checkDeviceCommands:()=>{},notificationSettings:()=>JSON.stringify({enabled:true}),scheduleSmartReminder:()=>{},cancelNotification:()=>{},hasNotificationPermission:()=>true
    };
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8768',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.VBrainPersonalizer?.version===21&&window.VBrainPatch?.version);
  await page.evaluate(()=>window.VBrainPersonalizer.refresh());

  const first=await page.evaluate(()=>({decision:window.VBrainPersonalizer.decision(),patch:window.HOMEAdaptive?.config?.vbrainPatch,logs:window.__p21logs}));
  if(first.decision?.order?.[0]!=='tube')throw new Error('Expected learning evidence to prioritize Tube '+JSON.stringify(first.decision));
  if(first.patch?.home?.order?.[0]!=='tube'||first.patch?.home?.visible?.todos!==true)throw new Error('Bounded home patch failed '+JSON.stringify(first.patch));
  if(!first.logs.some(x=>x.kind==='behavior_ui_decision'&&x.source==='vbrain-personalizer-v21'))throw new Error('Decision audit event missing');

  await page.evaluate(()=>window.VBrain.openBrain());
  await page.waitForSelector('#vBrainV8.show #vb21ContextBtn');
  const button=await page.textContent('#vb21ContextBtn');
  if(button!=='CONTEXT · 2')throw new Error('Context count UI failed '+JSON.stringify(button));
  await page.click('#vb21ContextBtn');
  const panel=await page.textContent('#vb21ContextPanel');
  if(!panel.includes('Wissen aufbauen')||!panel.includes('Gehirnansicht erhalten'))throw new Error('Private context panel missing semantic items '+panel);
  if(await page.$('#context-xss'))throw new Error('Context statement was rendered as HTML');

  const remote=await page.evaluate(()=>{
    window.__p21PrivatePatch={vbrainPatch:{home:{orderMode:'fixed',order:['calendar','todos','gym','tube']}}};
    window.HOMEAdaptive.config.vbrainPatch={};
    return window.VBrainPersonalizer.refresh().decision;
  });
  if(remote.remoteLayoutDeferred!==true||remote.patch?.home)throw new Error('Explicit remote UI layout must win over local personalizer '+JSON.stringify(remote));

  console.log('VBRAIN_PERSONALIZER_V21_OK',JSON.stringify({first:first.decision,remoteDeferred:remote.remoteLayoutDeferred,panel:true}));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
