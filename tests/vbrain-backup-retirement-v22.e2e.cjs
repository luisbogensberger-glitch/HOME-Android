const { chromium }=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(root,'home-runtime/live-app.html')))});
 await new Promise(r=>server.listen(8772,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  window.__HOME_REMOTE_LOADER_V4__=true;
  window.Native={loadState:()=>'',saveState:()=>{},hasNotionConnection:()=>false,liveRuntimeStatus:()=>JSON.stringify({nativeVersion:18,version:'18.test',source:'bundled',healthy:true}),markRuntimeHealthy:()=>{},checkLiveUpdate:()=>{}};
  window.AdaptiveNative={homeSyncStatus:()=>JSON.stringify({configured:false,pending:0}),queuePrivateActivity:()=>'',flushPrivateSync:()=>{},hasNotificationPermission:()=>false};
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8772');
 await page.waitForFunction(()=>window.__VBRAIN_BACKUP_RETIREMENT_V22__===true);
 await page.evaluate(()=>{
  for(const id of ['vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','vBrainOpenBackup','homeRecoveryFlexEntry']){
   const el=document.createElement(id==='homeRecoveryLauncher'?'button':'section');el.id=id;el.textContent='Restore previous V-Brain data';document.body.appendChild(el);
  }
 });
 await page.waitForTimeout(80);
 for(const id of ['vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','vBrainOpenBackup','homeRecoveryFlexEntry'])assert.equal(await page.locator('#'+id).count(),0,id+' must stay retired');
 assert.equal(await page.evaluate(()=>typeof window.VBrainBackupRetirement?.remove),'function');
 assert.deepEqual(errors,[],'no runtime exceptions');
 console.log('PASS: legacy backup/restore surfaces are removed and cannot reappear');
 await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
