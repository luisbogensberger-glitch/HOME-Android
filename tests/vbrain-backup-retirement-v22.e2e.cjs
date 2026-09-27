const { chromium }=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const retirement=fs.readFileSync(path.join(root,'sync-overlay/app/src/main/assets/vbrain-backup-retirement-v22.js'),'utf8').replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html><head><meta charset="utf-8"></head><body><main id="homeScreen"></main><script>${retirement}</script></body></html>`;
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(8772,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8772');
 await page.waitForFunction(()=>window.__VBRAIN_BACKUP_RETIREMENT_V22__===true);
 await page.evaluate(()=>{
  document.body.style.overflow='hidden';
  const modal=document.createElement('div');modal.id='homeRecoveryModal';modal.className='show';document.body.appendChild(modal);
  for(const id of ['vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','vBrainOpenBackup','homeRecoveryFlexEntry']){
   const el=document.createElement(id==='homeRecoveryLauncher'?'button':'section');el.id=id;el.textContent='Restore previous V-Brain data';document.body.appendChild(el);
  }
 });
 await page.waitForTimeout(80);
 for(const id of ['vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','vBrainOpenBackup','homeRecoveryFlexEntry'])assert.equal(await page.locator('#'+id).count(),0,id+' must stay retired');
 assert.equal(await page.locator('#homeRecoveryModal.show').count(),0,'stale recovery modal must be closed');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'','page scrolling must be restored');
 await page.evaluate(()=>{
   const old=document.createElement('section');old.id='vbRestoreInline';old.innerHTML='<h3>Restore previous V-Brain data</h3><button>RESTORE DATA</button>';document.body.appendChild(old);
 });
 await page.waitForTimeout(40);
 assert.equal(await page.locator('#vbRestoreInline').count(),0,'old repair loops cannot resurrect restore card');
 assert.equal(await page.evaluate(()=>typeof window.VBrainBackupRetirement?.remove),'function');
 assert.deepEqual(errors,[],'no runtime exceptions');
 console.log('PASS: legacy backup/restore surfaces are removed and cannot reappear');
 await browser.close();server.close();
})().catch(error=>{console.error(error);process.exit(1)});
