/* HOME post-install resilience v1 — local-first task completion, self-healing HOME Sync, and cleanup after migration. */
(function(){
  'use strict';
  if(window.__HOME_POST_INSTALL_RESILIENCE_V1__)return;window.__HOME_POST_INSTALL_RESILIENCE_V1__=true;
  const VERSION=1;
  const REPAIR_KEY='homeTodoSyncRepairV1';
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};

  function removeMigrationUi(){
    document.getElementById('homeMigrationTools')?.remove();
  }

  function getRepair(){const x=load(REPAIR_KEY,null);return x&&typeof x==='object'?x:null}
  function setRepair(x){if(x)save(REPAIR_KEY,x);else localStorage.removeItem(REPAIR_KEY)}

  function connected(){try{return typeof notionConnected==='function'&&notionConnected()}catch(e){return false}}
  function stateReady(){try{return todoState&&Array.isArray(todoState.active)&&Array.isArray(todoState.archive)}catch(e){return false}}
  function persist(){try{saveStore('todoState',todoState);renderTodos()}catch(e){}}
  function findByAnyId(id){
    try{return [...todoState.active,...todoState.archive].find(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id))||null}catch(e){return null}
  }

  function moveLocal(id,done){
    if(!stateReady())return null;
    if(done){
      let i=todoState.active.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id));
      if(i<0)return findByAnyId(id);
      const [t]=todoState.active.splice(i,1);t.completedAt=Date.now();todoState.archive.push(t);persist();
      log('todo_complete',{id:String(t.id||''),source:'local_first'});return t;
    }
    let i=todoState.archive.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id));
    if(i<0)return findByAnyId(id);
    const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);persist();
    log('todo_restore',{id:String(t.id||''),source:'local_first'});return t;
  }

  function syncTask(t,done){
    if(!t||!connected()||typeof Native==='undefined'||typeof Native.setNotionTaskDone!=='function')return;
    const remoteId=String(t.notionId||t.id||'');if(!remoteId)return;
    setRepair({oldId:String(t.id||remoteId),remoteId,title:String(t.title||'Task'),done:!!done,startedAt:Date.now(),phase:'toggle'});
    try{setSyncStatus('Saved locally · syncing…')}catch(e){}
    try{Native.setNotionTaskDone(remoteId,!!done)}catch(e){}
  }

  function completePatched(id){const t=moveLocal(id,true);syncTask(t,true)}
  function restorePatched(id){const t=moveLocal(id,false);syncTask(t,false)}

  const baseError=window.onNotionSyncError;
  const baseCreated=window.onNotionTaskCreated;
  const baseChanged=window.onNotionTaskChanged;

  window.onNotionSyncError=function(result){
    const msg=String(result?.message||'');const repair=getRepair();
    if(repair&&/task not found/i.test(msg)){
      const local=findByAnyId(repair.oldId)||findByAnyId(repair.remoteId);
      if(local&&typeof Native!=='undefined'&&typeof Native.createNotionTask==='function'){
        repair.phase='recreate';repair.startedAt=Date.now();setRepair(repair);
        try{setSyncStatus('Repairing task sync…')}catch(e){}
        try{Native.createNotionTask(String(local.title||repair.title||'Task'))}catch(e){}
        log('todo_sync_repair_start',{done:!!repair.done});return;
      }
      setRepair(null);
      try{setSyncStatus('Saved locally · HOME Sync will retry later')}catch(e){}
      return;
    }
    if(typeof baseError==='function')return baseError.apply(this,arguments);
  };

  window.onNotionTaskCreated=function(t){
    const repair=getRepair();
    if(repair&&repair.phase==='recreate'&&t){
      const local=findByAnyId(repair.oldId)||findByAnyId(repair.remoteId);
      if(local){local.id=String(t.id||local.id);local.notionId=String(t.notionId||t.id||local.notionId||'');persist()}
      if(repair.done&&typeof Native!=='undefined'&&typeof Native.setNotionTaskDone==='function'){
        repair.phase='recomplete';repair.newId=String(t.notionId||t.id||'');setRepair(repair);
        try{Native.setNotionTaskDone(repair.newId,true)}catch(e){}
      }else{
        setRepair(null);try{setSyncStatus('Task sync repaired')}catch(e){}
        setTimeout(()=>{try{refreshNotion()}catch(e){}},350);
      }
      log('todo_sync_repair_created',{done:!!repair.done});return;
    }
    if(typeof baseCreated==='function')return baseCreated.apply(this,arguments);
  };

  window.onNotionTaskChanged=function(result){
    const repair=getRepair();
    if(repair){
      const rid=String(result?.id||'');
      if(rid===String(repair.remoteId||'')||rid===String(repair.newId||'')){
        setRepair(null);try{setSyncStatus('Synced')}catch(e){}
        setTimeout(()=>{try{refreshNotion()}catch(e){}},350);
        log('todo_sync_repair_done',{done:!!result?.done});return;
      }
    }
    if(typeof baseChanged==='function')return baseChanged.apply(this,arguments);
  };

  function patchFunctions(){
    try{window.completeTodo=completePatched;window.restoreTodo=restorePatched}catch(e){}
    removeMigrationUi();
    document.documentElement.dataset.homePostInstallResilience=String(VERSION);
  }

  patchFunctions();
  setTimeout(()=>{patchFunctions();try{renderTodos()}catch(e){}},400);
  setTimeout(()=>{patchFunctions();try{renderTodos()}catch(e){}},1500);
  setInterval(patchFunctions,4000);
  log('post_install_resilience_ready',{version:VERSION});
})();
