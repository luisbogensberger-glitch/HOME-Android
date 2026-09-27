const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'home-runtime','live-app.html'),'utf8');
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
  await new Promise(r=>server.listen(8769,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Berlin'});
  await context.addInitScript(()=>{
    window.__ctx22Logs=[];
    window.__ctx22CaptureCount=0;
    const nativeStore={};
    window.Native={
      loadState:k=>nativeStore[k]||'',saveState:(k,v)=>{nativeStore[k]=String(v||'')},
      liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true,ready:false}),
      markRuntimeHealthy:()=>{},checkLiveUpdate:()=>{},applyLiveUpdate:()=>{},hasNotionConnection:()=>false,requestNotionSync:()=>{},getCalendarEvents:()=> '[]',hasCalendarPermission:()=>false,openUrl:()=>{}
    };
    window.AdaptiveNative={
      logActivity:raw=>{try{window.__ctx22Logs.push(JSON.parse(raw))}catch(_){}},
      queuePrivateActivity:()=> 'queued',logPrivateActivity:()=>{},queueLearningAttempt:()=> 'queued',flushPrivateSync:()=>{},
      homeSyncStatus:()=>JSON.stringify({configured:true,pending:0,lastSyncedAt:Date.now()}),checkDeviceCommands:()=>{},notificationSettings:()=>JSON.stringify({enabled:true}),scheduleSmartReminder:()=>{},cancelNotification:()=>{},hasNotificationPermission:()=>true,
      contextSensorStatus:()=>JSON.stringify({version:22,enabled:true,fine:true,coarse:true,location:true,gpsProvider:true,networkProvider:true,lastSampleAt:Date.now()-5000}),
      setContextSensorsEnabled:()=>{},requestContextSensorPermissions:()=>{},
      captureContextSignals:()=>{
        window.__ctx22CaptureCount++;
        setTimeout(()=>window.onVBrainContextSignals?.({
          version:22,state:'ready',precision:'fine',movementClass:'moving',movedMeters:42.4,
          sampleGapMs:300000,sampleAgeMs:3000,accuracyMeters:19,locationAt:Date.now()-3000,rawPrivate:true,
          // If the JS bridge ever forwards these fields, the privacy assertion below catches it.
          lat:51.5014,lon:-0.1419,latitude:51.5014,longitude:-0.1419
        }),0);
      }
    };
  });

  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8769',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.VBrainContextSensors?.version===22&&window.VBrain?.openBrain);
  await page.evaluate(()=>window.VBrainContextSensors.capture());
  await page.waitForFunction(()=>window.__ctx22Logs.some(x=>x.type==='context_signal_summary'));
  const summary=await page.evaluate(()=>window.__ctx22Logs.find(x=>x.type==='context_signal_summary'));
  if(!summary)throw new Error('Context summary event missing');
  const serialized=JSON.stringify(summary).toLowerCase();
  for(const forbidden of ['"lat"','"lon"','latitude','longitude','51.5014','-0.1419']){
    if(serialized.includes(forbidden))throw new Error('Raw location leaked into generic telemetry: '+forbidden+' '+serialized);
  }
  if(summary.data?.movementClass!=='moving'||summary.data?.movedMeters!==42)throw new Error('Movement summary incorrect '+serialized);
  if(summary.data?.accuracyBucket!=='high'||summary.data?.rawPrivate!==true)throw new Error('Privacy summary metadata incorrect '+serialized);

  await page.evaluate(()=>window.VBrain.openBrain());
  await page.waitForSelector('#vBrainV19.show #vb22SensorBtn');
  const button=await page.textContent('#vb22SensorBtn');
  if(button!=='ON · SAMPLE')throw new Error('Sensor control not ready: '+button);
  await page.click('#vb22SensorBtn');
  await page.waitForFunction(()=>window.__ctx22CaptureCount>=2);

  // Old APK compatibility: the live UI must remain harmless if native v22 methods are absent.
  const missing=await page.evaluate(()=>{
    const old=window.AdaptiveNative;window.AdaptiveNative={logActivity:old.logActivity};
    const s=window.VBrainContextSensors.status();window.VBrainContextSensors.mount();
    return{s,label:document.getElementById('vb22SensorBtn')?.textContent,disabled:document.getElementById('vb22SensorBtn')?.disabled};
  });
  if(missing.s?.native!==false||missing.label!=='APK UPDATE'||missing.disabled!==true)throw new Error('Old APK fallback failed '+JSON.stringify(missing));

  console.log('VBRAIN_CONTEXT_SENSORS_V22_OK',JSON.stringify({movement:summary.data?.movementClass,meters:summary.data?.movedMeters,accuracy:summary.data?.accuracyBucket,oldApk:missing.label}));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
