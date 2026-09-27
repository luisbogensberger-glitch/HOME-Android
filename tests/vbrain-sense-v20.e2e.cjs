const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'home-runtime','live-app.html'),'utf8');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8767,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin'});
  await context.addInitScript(()=>{
    window.__HOME_REMOTE_LOADER_V4__=true;
    window.__senseGeneric=[];
    window.__sensePrivate=[];
    window.Native={
      loadState:k=>localStorage.getItem('native:'+k)||'',
      saveState:(k,v)=>localStorage.setItem('native:'+k,v),
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,ready:false}),
      markRuntimeHealthy:()=>{},checkLiveUpdate:()=>{},applyLiveUpdate:()=>{},hasNotionConnection:()=>false,
      requestNotionSync:()=>{},getCalendarEvents:()=> '[]',hasCalendarPermission:()=>false,openUrl:()=>{}
    };
    window.AdaptiveNative={
      logActivity:raw=>{try{window.__senseGeneric.push(JSON.parse(raw))}catch(_){}},
      queuePrivateActivity:raw=>{try{window.__sensePrivate.push(JSON.parse(raw));return 'queued'}catch(_){return ''}},
      logPrivateActivity:()=>{},queueLearningAttempt:()=> 'queued',flushPrivateSync:()=>{},
      homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),
      checkDeviceCommands:()=>{},notificationSettings:()=>JSON.stringify({enabled:true}),
      scheduleSmartReminder:()=>{},cancelNotification:()=>{},hasNotificationPermission:()=>true
    };
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8767',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.VBrainSense?.version===20);

  const result=await page.evaluate(async()=>{
    const button=document.createElement('button');button.id='sense-test-button';button.dataset.action='learn';button.textContent='Learn';document.body.appendChild(button);button.click();

    const text=document.createElement('textarea');text.id='reflectionText';text.placeholder='Reflection';document.body.appendChild(text);
    text.focus();text.value='I understand ideas better when I explain the causal chain in my own words.';
    text.dispatchEvent(new Event('input',{bubbles:true}));

    const password=document.createElement('input');password.type='password';password.id='password';document.body.appendChild(password);
    password.value='must-never-enter-private-stream';password.dispatchEvent(new Event('input',{bubbles:true}));password.blur();

    await new Promise(r=>setTimeout(r,1450));
    text.blur();await new Promise(r=>setTimeout(r,120));
    return {
      status:window.VBrainSense.status(),
      generic:window.__senseGeneric,
      privateEvents:window.__sensePrivate,
      legacyAccessBox:!!document.getElementById('vbrainAccessV13')
    };
  });

  const kinds=result.generic.map(x=>x.kind);
  if(result.status?.version!==20||result.status?.uiOnly!==true)throw new Error('Sense status failed '+JSON.stringify(result.status));
  if(!kinds.includes('vbrain_sense_ready')||!kinds.includes('ui_press_v20')||!kinds.includes('field_activity_v20'))throw new Error('Generic sensing failed '+JSON.stringify(kinds));
  const privateText=result.privateEvents.filter(x=>x.kind==='private_text_field');
  if(privateText.length!==1)throw new Error('Private text count failed '+JSON.stringify(result.privateEvents));
  if(privateText[0]?.text!=='I understand ideas better when I explain the causal chain in my own words.')throw new Error('Private text payload failed');
  if(privateText[0]?.field!=='reflectionText|Reflection'||privateText[0]?.fieldType!=='textarea')throw new Error('Supabase private-text contract failed '+JSON.stringify(privateText[0]));
  if(privateText[0]?.data?.sensorVersion!==20)throw new Error('Sensor provenance missing '+JSON.stringify(privateText[0]));
  if(JSON.stringify(result.privateEvents).includes('must-never-enter-private-stream'))throw new Error('Sensitive field leaked into private stream');
  if(result.legacyAccessBox)throw new Error('Sense module must not inject legacy permission UI');

  console.log('VBRAIN_SENSE_V20_OK',JSON.stringify({genericKinds:[...new Set(kinds)],privateKinds:result.privateEvents.map(x=>x.kind),status:result.status}));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
