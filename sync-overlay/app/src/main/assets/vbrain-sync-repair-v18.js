/* V-Brain 18 sync repair — optimistic To-Dos, semantic de-duplication and clearer status. */
(function(){
  'use strict';
  if(window.__VBRAIN_SYNC_REPAIR_V18__)return;window.__VBRAIN_SYNC_REPAIR_V18__=true;

  const clean=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'").replace(/[^a-z0-9äöüß]+/gi,' ').trim().replace(/\s+/g,' ');
  const key=t=>clean(t?.title)+'|'+clean(t?.area||'');
  const richer=(a,b)=>{
    const score=x=>(x?.notionId?8:0)+(String(x?.id||'').startsWith('legacy-')?0:4)+(x?.details?.personalNote?3:0)+(x?.details?.info?.length||0)+(x?.details?.links?.length||0);
    return score(b)>score(a)?b:a;
  };
  function dedupe(list){
    const byId=new Map(), bySemantic=new Map();
    for(const raw of Array.isArray(list)?list:[]){
      if(!raw||!raw.title)continue;
      const id=String(raw.id||raw.notionId||'').trim();
      if(id&&byId.has(id)){byId.set(id,richer(byId.get(id),raw));continue}
      const k=key(raw);
      if(k&&bySemantic.has(k)){
        const keep=richer(bySemantic.get(k),raw);bySemantic.set(k,keep);
        if(id)byId.set(id,keep);
      }else{if(k)bySemantic.set(k,raw);if(id)byId.set(id,raw)}
    }
    return [...new Set(bySemantic.size?[...bySemantic.values()]:[...byId.values()])];
  }
  function localAll(){try{return [...(todoState?.active||[]),...(todoState?.archive||[])]}catch(_){return[]}}
  function prepareRemote(t,local){
    const prior=local.find(x=>String(x.id)===String(t.id))||local.find(x=>key(x)===key(t));
    const merged={...t,details:t.details||prior?.details||{outcome:'',info:[],tips:[],links:[],personalNote:''}};
    try{return typeof enrichTodo==='function'?enrichTodo(merged):merged}catch(_){return merged}
  }
  function persistLocal(){
    try{
      const raw=JSON.stringify(todoState);localStorage.setItem('todoState',raw);
      Native?.saveState?.('todoState',raw);
      AdaptiveNative?.saveTodoState?.(raw);
    }catch(_){ }
  }
  function render(){try{renderTodos();updateHome();if((window.currentScreen||'')==='todoDetail'&&typeof findTodo==='function'&&findTodo(currentTodoDetailId))renderTodoDetail()}catch(_){}}

  window.onNotionSnapshot=function(data){
    try{
      const local=localAll(),dirty=new Set((data?.pendingTaskIds||[]).map(String));
      let active=dedupe((data?.open||[]).map(t=>prepareRemote(t,local)));
      let archive=dedupe((data?.completed||[]).map(t=>prepareRemote(t,local)));
      const serverIds=new Set([...active,...archive].map(x=>String(x.id||'')));
      const serverKeys=new Set([...active,...archive].map(key));
      // Preserve genuinely unsent local writes, but never resurrect a duplicate or a task the server already completed.
      for(const t of (todoState?.active||[])){
        if(!dirty.has(String(t.id)))continue;
        if(serverIds.has(String(t.id))||serverKeys.has(key(t)))continue;
        active.push(t);
      }
      for(const t of (todoState?.archive||[])){
        if(!dirty.has(String(t.id)))continue;
        if(serverIds.has(String(t.id))||serverKeys.has(key(t)))continue;
        archive.push(t);
      }
      active=dedupe(active);archive=dedupe(archive);
      const archivedIds=new Set(archive.map(x=>String(x.id||''))), archivedKeys=new Set(archive.map(key));
      active=active.filter(t=>!archivedIds.has(String(t.id||''))&&!archivedKeys.has(key(t)));
      todoState.active=active;todoState.archive=archive;
      const raw=JSON.stringify(todoState);localStorage.setItem('todoState',raw);Native?.acceptRemoteTodoState?.(raw);
      render();setSyncStatus?.('Synced');VBrainLive?.planReminders?.();
    }catch(e){try{setSyncStatus?.('Sync repair waiting for next snapshot')}catch(_){}}
    finally{try{syncingNotion=false}catch(_){}}
  };

  window.completeTodo=function(id){
    const i=todoState?.active?.findIndex(x=>String(x.id)===String(id));if(i<0)return;
    const [t]=todoState.active.splice(i,1);t.completedAt=Date.now();todoState.archive.push(t);todoState.archive=dedupe(todoState.archive);persistLocal();render();
    try{window.homeAdaptiveLog?.('todo_complete',{id:String(t.id),title:String(t.title||'').slice(0,160)})}catch(_){ }
    try{if(t.notionId&&typeof Native!=='undefined'&&Native.hasNotionConnection?.())Native.setNotionTaskDone(String(t.notionId),true)}catch(_){ }
  };
  window.restoreTodo=function(id){
    const i=todoState?.archive?.findIndex(x=>String(x.id)===String(id));if(i<0)return;
    const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);todoState.active=dedupe(todoState.active);persistLocal();render();
    try{if(t.notionId&&typeof Native!=='undefined'&&Native.hasNotionConnection?.())Native.setNotionTaskDone(String(t.notionId),false)}catch(_){ }
  };

  function syncState(){try{return typeof AdaptiveNative!=='undefined'?JSON.parse(AdaptiveNative.homeSyncStatus()):{}}catch(_){return{}}}
  const fmt=t=>t?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(t):'not yet';
  function repairPanel(){
    const panel=document.querySelector('#vbrainControl17 .vb17Panel');if(!panel)return;
    const s=syncState(),dts=[...panel.querySelectorAll('dt')],dt=dts.find(x=>/private sync/i.test(x.textContent||''));
    if(dt){dt.textContent='Data sync';const dd=dt.nextElementSibling;if(dd){
      const user=Number(s.pendingUser??s.pending??0),tele=Number(s.pendingTelemetry??0);
      dd.textContent=!s.configured?'Connect HOME Sync to send your app data':user?`${user} data change${user===1?'':'s'} waiting · last sent ${fmt(s.lastSyncedAt)}`:tele?`User data synced · ${tele} background signals queued`:`Up to date · last sent ${fmt(s.lastSyncedAt)}`;
    }}
    const check=panel.querySelector('#vb17Check');if(check&&/check for updates/i.test(check.textContent||''))check.textContent='Check UI update';
    const foot=panel.querySelector('.vb17Foot');if(foot)foot.textContent='To-dos, learning and notes are saved locally first, then synced privately in the background.';
  }
  const observer=new MutationObserver(repairPanel);observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>{try{if(todoState){todoState.active=dedupe(todoState.active);todoState.archive=dedupe(todoState.archive);persistLocal();render()}}catch(_){}repairPanel()},900);
})();
