/* V-Brain post-install resilience v2 — local-first completion + legacy backup escape hatch. */
(function(){
  'use strict';
  if(window.__HOME_POST_INSTALL_RESILIENCE_V1__){try{ensureBackupFallback?.()}catch(e){}return}window.__HOME_POST_INSTALL_RESILIENCE_V1__=true;
  const VERSION=2;
  const REPAIR_KEY='homeTodoSyncRepairV1';
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};

  function removeMigrationUi(){document.getElementById('homeMigrationTools')?.remove()}
  function clearStaleSyncError(){try{const st=document.getElementById('syncStatus');if(st&&/task not found in home sync/i.test(String(st.textContent||''))) setSyncStatus('V-Brain Sync ready · stale task will self-repair')}catch(e){}}
  function getRepair(){const x=load(REPAIR_KEY,null);return x&&typeof x==='object'?x:null}
  function setRepair(x){if(x)save(REPAIR_KEY,x);else localStorage.removeItem(REPAIR_KEY)}
  function connected(){try{return typeof notionConnected==='function'&&notionConnected()}catch(e){return false}}
  function stateReady(){try{return todoState&&Array.isArray(todoState.active)&&Array.isArray(todoState.archive)}catch(e){return false}}
  function persist(){try{saveStore('todoState',todoState);renderTodos()}catch(e){}}
  function findByAnyId(id){try{return [...todoState.active,...todoState.archive].find(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id))||null}catch(e){return null}}

  function moveLocal(id,done){
    if(!stateReady())return null;
    if(done){let i=todoState.active.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id));if(i<0)return findByAnyId(id);const [t]=todoState.active.splice(i,1);t.completedAt=Date.now();todoState.archive.push(t);persist();log('todo_complete',{id:String(t.id||''),source:'local_first'});return t}
    let i=todoState.archive.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id));if(i<0)return findByAnyId(id);const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);persist();log('todo_restore',{id:String(t.id||''),source:'local_first'});return t;
  }
  function syncTask(t,done){if(!t||!connected()||typeof Native==='undefined'||typeof Native.setNotionTaskDone!=='function')return;const remoteId=String(t.notionId||t.id||'');if(!remoteId)return;setRepair({oldId:String(t.id||remoteId),remoteId,title:String(t.title||'Task'),done:!!done,startedAt:Date.now(),phase:'toggle'});try{setSyncStatus('Saved locally · syncing…')}catch(e){}try{Native.setNotionTaskDone(remoteId,!!done)}catch(e){}}
  function completePatched(id){const t=moveLocal(id,true);syncTask(t,true)}
  function restorePatched(id){const t=moveLocal(id,false);syncTask(t,false)}

  const baseError=window.onNotionSyncError,baseCreated=window.onNotionTaskCreated,baseChanged=window.onNotionTaskChanged;
  window.onNotionSyncError=function(result){const msg=String(result?.message||''),repair=getRepair();if(repair&&/task not found/i.test(msg)){const local=findByAnyId(repair.oldId)||findByAnyId(repair.remoteId);if(local&&typeof Native!=='undefined'&&typeof Native.createNotionTask==='function'){repair.phase='recreate';repair.startedAt=Date.now();setRepair(repair);try{setSyncStatus('Repairing task sync…')}catch(e){}try{Native.createNotionTask(String(local.title||repair.title||'Task'))}catch(e){}log('todo_sync_repair_start',{done:!!repair.done});return}setRepair(null);try{setSyncStatus('Saved locally · V-Brain Sync will retry later')}catch(e){};return}if(/task not found/i.test(msg)){try{setSyncStatus('V-Brain Sync ready · stale task will self-repair')}catch(e){};return}if(typeof baseError==='function')return baseError.apply(this,arguments)};
  window.onNotionTaskCreated=function(t){const repair=getRepair();if(repair&&repair.phase==='recreate'&&t){const local=findByAnyId(repair.oldId)||findByAnyId(repair.remoteId);if(local){local.id=String(t.id||local.id);local.notionId=String(t.notionId||t.id||local.notionId||'');persist()}if(repair.done&&typeof Native!=='undefined'&&typeof Native.setNotionTaskDone==='function'){repair.phase='recomplete';repair.newId=String(t.notionId||t.id||'');setRepair(repair);try{Native.setNotionTaskDone(repair.newId,true)}catch(e){}}else{setRepair(null);try{setSyncStatus('Task sync repaired')}catch(e){};setTimeout(()=>{try{refreshNotion()}catch(e){}},350)}log('todo_sync_repair_created',{done:!!repair.done});return}if(typeof baseCreated==='function')return baseCreated.apply(this,arguments)};
  window.onNotionTaskChanged=function(result){const repair=getRepair();if(repair){const rid=String(result?.id||'');if(rid===String(repair.remoteId||'')||rid===String(repair.newId||'')){setRepair(null);try{setSyncStatus('Synced')}catch(e){};setTimeout(()=>{try{refreshNotion()}catch(e){}},350);log('todo_sync_repair_done',{done:!!result?.done});return}}if(typeof baseChanged==='function')return baseChanged.apply(this,arguments)};

  async function copyText(text,el){try{await navigator.clipboard.writeText(text);return true}catch(e){}try{el.focus();el.select();el.setSelectionRange(0,el.value.length);return document.execCommand('copy')}catch(e){return false}}
  function ensureBackupFallback(){
    const home=document.getElementById('homeScreen');if(!home||typeof window.HOMEClassicBrain?.backup!=='function')return;
    if(getComputedStyle(home).position==='static')home.style.position='relative';
    if(!document.getElementById('vbrainLegacyBackupStyle')){const st=document.createElement('style');st.id='vbrainLegacyBackupStyle';st.textContent=`#vbrainDataButton{position:absolute!important;left:18px!important;top:92px!important;z-index:130!important;border:1px solid rgba(255,255,255,.2)!important;background:rgba(12,15,20,.46)!important;color:#fff!important;border-radius:18px!important;padding:10px 13px!important;font:inherit!important;font-size:10px!important;font-weight:850!important;letter-spacing:.12em!important;backdrop-filter:blur(15px)!important;-webkit-backdrop-filter:blur(15px)!important}#vbrainLegacyBackup{position:fixed;inset:0;z-index:2147483200;background:#080a0e;color:#fff;display:none;overflow:auto;padding:80px 18px 40px}#vbrainLegacyBackup.show{display:block}.vbLegacyBox{max-width:680px;margin:auto;border:1px solid rgba(255,255,255,.1);background:#0e1117;border-radius:22px;padding:16px}.vbLegacyBox h2{margin:0 0 6px}.vbLegacyBox p{color:rgba(255,255,255,.58);font-size:12px;line-height:1.45}.vbLegacyBox textarea{width:100%;min-height:150px;box-sizing:border-box;background:#15171c;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px;font-size:10px}.vbLegacyBox button{width:100%;margin-top:9px;padding:12px;border:0;border-radius:14px;font-weight:850}.vbLegacyClose{background:#222630!important;color:#fff!important}.vbLegacyPrimary{background:#f2f3f7!important;color:#111318!important}`;document.head.appendChild(st)}
    let b=document.getElementById('vbrainDataButton');if(!b){b=document.createElement('button');b.id='vbrainDataButton';b.type='button';b.textContent='BACKUP';home.appendChild(b)}
    let m=document.getElementById('vbrainLegacyBackup');if(!m){m=document.createElement('div');m.id='vbrainLegacyBackup';m.innerHTML=`<div class="vbLegacyBox"><h2>V-Brain backup</h2><p>Create a backup code from the app state currently stored on this phone. Passwords and tokens are excluded.</p><button class="vbLegacyPrimary" id="vbLegacyCreate" type="button">Create backup code</button><textarea id="vbLegacyOut" readonly placeholder="Backup code appears here"></textarea><button class="vbLegacyPrimary" id="vbLegacyCopy" type="button">Copy backup code</button><div id="vbLegacyStatus" style="font-size:11px;color:rgba(255,255,255,.62);min-height:18px;margin-top:8px"></div><button class="vbLegacyClose" id="vbLegacyClose" type="button">Close</button></div>`;document.body.appendChild(m)}
    const out=m.querySelector('#vbLegacyOut'),status=m.querySelector('#vbLegacyStatus');
    b.onclick=e=>{e.preventDefault();e.stopPropagation();m.classList.add('show');document.body.style.overflow='hidden'};
    m.querySelector('#vbLegacyCreate').onclick=()=>{try{out.value=window.HOMEClassicBrain.backup();status.textContent='Backup created.'}catch(e){status.textContent='Backup failed: '+(e?.message||e)}};
    m.querySelector('#vbLegacyCopy').onclick=async()=>{if(!out.value){status.textContent='Create the backup code first.';return}status.textContent=(await copyText(out.value,out))?'Backup code copied.':'Select the code and copy it manually.'};
    m.querySelector('#vbLegacyClose').onclick=()=>{m.classList.remove('show');document.body.style.overflow=''};
  }

  function patchFunctions(){try{window.completeTodo=completePatched;window.restoreTodo=restorePatched}catch(e){}removeMigrationUi();clearStaleSyncError();ensureBackupFallback();document.documentElement.dataset.homePostInstallResilience=String(VERSION)}
  patchFunctions();setTimeout(()=>{patchFunctions();try{renderTodos()}catch(e){}},400);setTimeout(()=>{patchFunctions();try{renderTodos()}catch(e){}},1500);setInterval(patchFunctions,4000);log('post_install_resilience_ready',{version:VERSION});
})();