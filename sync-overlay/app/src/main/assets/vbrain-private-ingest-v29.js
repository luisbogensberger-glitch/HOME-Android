/* V-Brain private ingest v29 — private task delivery + durable completed history.
   This file contains generic code only. Private task text stays inside vbrainPrivatePatch. */
(function(){
  'use strict';
  if(window.__VBRAIN_PRIVATE_INGEST_V29__) return;
  window.__VBRAIN_PRIVATE_INGEST_V29__=true;

  const PATCH='vbrainPrivatePatch';
  const APPLIED='vbrainPrivateTaskAppliedV29';
  const HISTORY='vbrainCompletedHistoryV29';
  const MAX_APPLIED=600;
  const MAX_HISTORY=1000;

  const parse=(raw,fallback)=>{try{const v=JSON.parse(raw||'');return v??fallback}catch(_){return fallback}};
  const clean=(value,max=600)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
  const nativeRead=key=>{try{return typeof Native!=='undefined'&&Native.loadState?String(Native.loadState(key)||''):''}catch(_){return''}};
  const nativeWrite=(key,value)=>{try{Native?.saveState?.(key,String(value??''))}catch(_){}};
  const read=(key,fallback)=>parse(nativeRead(key)||localStorage.getItem(key),fallback);
  const write=(key,value)=>{const raw=JSON.stringify(value);nativeWrite(key,raw);try{localStorage.setItem(key,raw)}catch(_){}return value};
  const idOf=t=>clean(t?.id||t?.notionId||t?.externalId,180);
  const normalizedKey=t=>`${clean(t?.title,180).toLowerCase()}|${clean(t?.area||'Personal',80).toLowerCase()}`;
  const currentTodoState=()=>{try{if(typeof todoState!=='undefined'&&todoState)return todoState}catch(_){}return read('todoState',{active:[],archive:[]})};
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}};

  function storeTodoState(state){
    try{
      if(typeof saveStore==='function') saveStore('todoState',state);
      else nativeWrite('todoState',JSON.stringify(state));
    }catch(_){nativeWrite('todoState',JSON.stringify(state))}
    try{AdaptiveNative?.saveTodoState?.(JSON.stringify(state))}catch(_){}
    try{window.renderTodos?.()}catch(_){}
    try{window.updateHome?.()}catch(_){}
  }

  function rememberCompleted(items){
    const existing=read(HISTORY,[]), map=new Map();
    for(const task of Array.isArray(existing)?existing:[]){const id=idOf(task);if(id)map.set(id,task)}
    let changed=false;
    for(const task of Array.isArray(items)?items:[]){
      const id=idOf(task); if(!id) continue;
      const prior=map.get(id), merged={...(prior||{}),...task,id,completedAt:task.completedAt||prior?.completedAt||Date.now()};
      if(JSON.stringify(prior)!==JSON.stringify(merged)){map.set(id,merged);changed=true}
    }
    if(!changed) return;
    const all=[...map.values()].sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0)).slice(0,MAX_HISTORY);
    write(HISTORY,all);
  }

  function removeCompleted(id){
    const before=read(HISTORY,[]); if(!Array.isArray(before)) return;
    const after=before.filter(t=>idOf(t)!==String(id));
    if(after.length!==before.length) write(HISTORY,after);
  }

  function ingestPrivateTasks(){
    const patch=parse(nativeRead(PATCH),{}), incoming=Array.isArray(patch?.taskUpserts)?patch.taskUpserts:[];
    if(!incoming.length) return false;
    const state=currentTodoState();
    state.active=Array.isArray(state.active)?state.active:[];
    state.archive=Array.isArray(state.archive)?state.archive:[];
    const appliedList=read(APPLIED,[]), applied=new Set(Array.isArray(appliedList)?appliedList:[]);
    const byId=new Map([...state.active,...state.archive].map(t=>[idOf(t),t]).filter(([id])=>id));
    const byKey=new Map([...state.active,...state.archive].map(t=>[normalizedKey(t),t]).filter(([key])=>key!=='|personal'));
    let changed=false;

    for(const raw of incoming.slice(0,80)){
      const externalId=clean(raw?.externalId||raw?.id,180);
      const title=clean(raw?.title,180);
      if(!externalId||!title) continue;
      const stableId=externalId.startsWith('external-')?externalId:`external-${externalId}`;
      const key=`${title.toLowerCase()}|${clean(raw?.area||'Personal',80).toLowerCase()}`;
      const existing=byId.get(stableId)||byKey.get(key);
      if(existing){
        applied.add(stableId);
        continue;
      }
      if(applied.has(stableId)) continue;
      const links=Array.isArray(raw?.links)?raw.links.map(link=>({label:clean(link?.label||link?.url,100),url:clean(link?.url,1000)})).filter(link=>/^https:\/\//i.test(link.url)).slice(0,8):[];
      const task={
        id:stableId,
        title,
        area:clean(raw?.area||'Personal',80),
        minutes:Math.max(0,Math.min(600,Number(raw?.minutes)||0)),
        note:clean(raw?.note,1800),
        source:clean(raw?.source||'vbrain-private',80),
        details:{
          outcome:clean(raw?.outcome,700),
          info:Array.isArray(raw?.info)?raw.info.map(v=>clean(v,700)).filter(Boolean).slice(0,12):[],
          tips:Array.isArray(raw?.tips)?raw.tips.map(v=>clean(v,700)).filter(Boolean).slice(0,12):[],
          links,
          personalNote:''
        },
        externalRef:clean(raw?.externalRef||externalId,240),
        createdAt:Number(raw?.createdAt)||Date.now()
      };
      state.active.unshift(task);
      byId.set(stableId,task); byKey.set(key,task); applied.add(stableId); changed=true;
      log('private_task_ingested',{id:stableId,source:task.source});
    }

    write(APPLIED,[...applied].slice(-MAX_APPLIED));
    if(changed) storeTodoState(state);
    return changed;
  }

  function renderHistory(){
    const screen=document.getElementById('todosScreen');
    if(!screen||!screen.classList.contains('show')) return;
    const host=screen.querySelector('.pad')||screen;
    const items=read(HISTORY,[]);
    let panel=document.getElementById('v29CompletedHistory');
    if(!Array.isArray(items)||!items.length){panel?.remove();return}
    if(!panel){
      panel=document.createElement('details'); panel.id='v29CompletedHistory'; panel.className='v25OlderTasks';
      panel.innerHTML='<summary></summary><input type="search" placeholder="Find a completed task…" aria-label="Find a completed task"><div class="v25OlderMatches"></div>';
      host.appendChild(panel);
      panel.querySelector('input').addEventListener('input',renderHistoryRows);
      panel.addEventListener('toggle',()=>{if(panel.open)renderHistoryRows()});
    }
    panel.querySelector('summary').textContent=`Completed history (${items.length})`;
    if(panel.open) renderHistoryRows();
  }

  function renderHistoryRows(){
    const panel=document.getElementById('v29CompletedHistory'); if(!panel) return;
    const query=clean(panel.querySelector('input')?.value,100).toLowerCase();
    const box=panel.querySelector('.v25OlderMatches'); if(!box) return;
    const items=read(HISTORY,[]).filter(t=>!query||clean(t?.title,180).toLowerCase().includes(query)).slice(0,20);
    box.innerHTML='';
    for(const task of items){
      const row=document.createElement('div'); row.className='v25OlderRow';
      const label=document.createElement('span'); label.textContent=clean(task?.title,180);
      const meta=document.createElement('small');
      const at=Number(task?.completedAt)||Date.parse(String(task?.completedAt||''));
      meta.textContent=Number.isFinite(at)&&at>0?new Date(at).toLocaleDateString():'';
      label.appendChild(document.createElement('br')); label.appendChild(meta); row.appendChild(label); box.appendChild(row);
    }
    if(!items.length) box.textContent='No matching completed task.';
  }

  function wrapTaskActions(){
    const complete=window.completeTodo;
    if(typeof complete==='function'&&!complete.__v29){
      const wrapped=function(id){const result=complete.apply(this,arguments);try{rememberCompleted(currentTodoState().archive||[])}catch(_){}renderHistory();return result};
      wrapped.__v29=true; window.completeTodo=wrapped;
    }
    const restore=window.restoreTodo;
    if(typeof restore==='function'&&!restore.__v29){
      const wrapped=function(id){const result=restore.apply(this,arguments);if(result)removeCompleted(String(id));renderHistory();return result};
      wrapped.__v29=true; window.restoreTodo=wrapped;
    }
  }

  function install(){
    wrapTaskActions();
    try{rememberCompleted(currentTodoState().archive||[])}catch(_){}
    ingestPrivateTasks(); renderHistory();
    const prior=window.onAppResume;
    if(typeof prior==='function'&&!prior.__v29){
      const wrapped=function(){const result=prior.apply(this,arguments);setTimeout(()=>{wrapTaskActions();ingestPrivateTasks();renderHistory()},250);return result};
      wrapped.__v29=true; window.onAppResume=wrapped;
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  else setTimeout(install,0);
  setInterval(()=>{wrapTaskActions();ingestPrivateTasks();renderHistory()},5000);
  window.VBrainPrivateIngest={version:29,ingest:ingestPrivateTasks,history:()=>read(HISTORY,[])};
})();
