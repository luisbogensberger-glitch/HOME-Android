/* V-Brain private ingest v29 — private task delivery, removals, durable history and delayed learning review sync.
   This file contains generic code only. Private task/review text stays in authenticated private channels. */
(function(){
  'use strict';
  if(window.__VBRAIN_PRIVATE_INGEST_V29__) return;
  window.__VBRAIN_PRIVATE_INGEST_V29__=true;

  const PATCH='vbrainPrivatePatch';
  const APPLIED='vbrainPrivateTaskAppliedV29';
  const TOMBSTONES='vbrainPrivateTaskTombstonesV29';
  const HISTORY='vbrainCompletedHistoryV29';
  const REVIEW_SEEN='vbrainLearningReviewSeenV29';
  const ACCESS_STATUS='vbrainAccessStatusV29';
  const MAX_APPLIED=600;
  const MAX_TOMBSTONES=600;
  const MAX_HISTORY=1000;
  const MAX_REVIEW_SEEN=300;
  let lastReviewPull=0;

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

  function accessStatus(){
    const call=(obj,name)=>{try{return obj&&typeof obj[name]==='function'?!!obj[name]():null}catch(_){return null}};
    return{
      notificationAccess:call(typeof VBrainNative!=='undefined'?VBrainNative:null,'notificationAccessEnabled'),
      whatsappAccessibility:call(typeof VBrainNative!=='undefined'?VBrainNative:null,'whatsappAccessibilityEnabled'),
      calendarPermission:call(typeof Native!=='undefined'?Native:null,'hasCalendarPermission'),
      homeSync:call(typeof Native!=='undefined'?Native:null,'hasNotionConnection')
    }
  }

  function reportAccessStatus(force=false){
    const next=accessStatus();
    if(Object.values(next).every(v=>v===null))return false;
    const prior=read(ACCESS_STATUS,null), changed=!prior||JSON.stringify(prior)!==JSON.stringify(next);
    if(changed)write(ACCESS_STATUS,next);
    if(changed||force)log('inbox_access_status_v13',next);
    return changed
  }

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

  function privateRemovalIds(patch){
    const raw=Array.isArray(patch?.taskRemovals)?patch.taskRemovals:[];
    return raw.map(item=>clean(typeof item==='string'?item:(item?.id||item?.taskId||item?.externalId),180)).filter(Boolean).slice(0,120);
  }

  function syncPrivateTasks(){
    const patch=parse(nativeRead(PATCH),{}), incoming=Array.isArray(patch?.taskUpserts)?patch.taskUpserts:[];
    const state=currentTodoState();
    state.active=Array.isArray(state.active)?state.active:[];
    state.archive=Array.isArray(state.archive)?state.archive:[];

    const priorTombstones=read(TOMBSTONES,[]);
    const tombstones=new Set(Array.isArray(priorTombstones)?priorTombstones:[]);
    for(const id of privateRemovalIds(patch)) tombstones.add(id);
    const removedNow=[];
    const keep=task=>{
      const id=idOf(task), remove=!!id&&tombstones.has(id);
      if(remove) removedNow.push(id);
      return !remove
    };
    const activeBefore=state.active.length, archiveBefore=state.archive.length;
    state.active=state.active.filter(keep);
    state.archive=state.archive.filter(keep);
    const removalChanged=state.active.length!==activeBefore||state.archive.length!==archiveBefore;
    write(TOMBSTONES,[...tombstones].slice(-MAX_TOMBSTONES));

    const appliedList=read(APPLIED,[]), applied=new Set(Array.isArray(appliedList)?appliedList:[]);
    const byId=new Map([...state.active,...state.archive].map(t=>[idOf(t),t]).filter(([id])=>id));
    const byKey=new Map([...state.active,...state.archive].map(t=>[normalizedKey(t),t]).filter(([key])=>key!=='|personal'));
    let ingestChanged=false;

    for(const raw of incoming.slice(0,80)){
      const externalId=clean(raw?.externalId||raw?.id,180);
      const title=clean(raw?.title,180);
      if(!externalId||!title) continue;
      const stableId=externalId.startsWith('external-')?externalId:`external-${externalId}`;
      if(tombstones.has(stableId)||tombstones.has(externalId)) continue;
      const key=`${title.toLowerCase()}|${clean(raw?.area||'Personal',80).toLowerCase()}`;
      const existing=byId.get(stableId)||byKey.get(key);
      if(existing){applied.add(stableId);continue}
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
      byId.set(stableId,task); byKey.set(key,task); applied.add(stableId); ingestChanged=true;
      log('private_task_ingested',{id:stableId,source:task.source});
    }

    write(APPLIED,[...applied].slice(-MAX_APPLIED));
    if(removalChanged||ingestChanged) storeTodoState(state);
    for(const id of [...new Set(removedNow)]) log('private_task_removed',{id});
    return removalChanged||ingestChanged;
  }

  function currentTubeState(){
    try{if(typeof tubeState!=='undefined'&&tubeState)return tubeState}catch(_){}
    return read('tubeState',{activeIds:[],completed:[],drafts:{}})
  }

  function saveTubeState(state){
    try{if(typeof saveStore==='function')saveStore('tubeState',state);else write('tubeState',state)}catch(_){write('tubeState',state)}
  }

  function syncLearningReviews(result){
    const rows=Array.isArray(result?.learning)?result.learning:[];
    if(!rows.length)return false;
    const attempts=read('v25LearningAttempts',[]), attemptById=new Map((Array.isArray(attempts)?attempts:[]).map(a=>[String(a?.id||a?.attemptId||''),a]));
    const state=currentTubeState(); state.completed=Array.isArray(state.completed)?state.completed:[];
    const journal=read('homeSemanticReviewJournalV10',[]), seenList=read(REVIEW_SEEN,[]), seen=new Set(Array.isArray(seenList)?seenList:[]);
    let changed=false, synced=0;

    for(const row of rows){
      const review=row?.semantic_review;
      if(row?.review_status!=='reviewed'||!review||typeof review!=='object')continue;
      const sourceId=String(row?.id||''); if(!sourceId)continue;
      const attempt=attemptById.get(sourceId), cardId=String(row?.card_id||attempt?.cardId||'');
      const attemptAt=Number(attempt?.at)||0;
      let hit=attemptAt?state.completed.find(x=>String(x?.id||'')===cardId&&Number(x?.at||0)===attemptAt):null;
      if(!hit&&cardId){const same=state.completed.filter(x=>String(x?.id||'')===cardId);hit=same[same.length-1]||null}
      if(hit&&(hit.reviewStatus!=='reviewed'||JSON.stringify(hit.semanticReview)!==JSON.stringify(review))){hit.reviewStatus='reviewed';hit.semanticReview=review;hit.semanticReviewSource='private-backend';changed=true}
      if(!seen.has(sourceId)){
        journal.push({sourceId,at:Date.now(),cardId,title:clean(row?.title||attempt?.title,180),topic:clean(row?.topic||attempt?.topic,100),method:clean(row?.learning_method||attempt?.method,80),review});
        seen.add(sourceId); synced++;
      }
    }

    if(changed){saveTubeState(state);try{window.renderLearningArchive?.()}catch(_){}try{window.updateHome?.()}catch(_){}}
    if(synced){write('homeSemanticReviewJournalV10',journal.slice(-160));write(REVIEW_SEEN,[...seen].slice(-MAX_REVIEW_SEEN));log('semantic_learning_synced',{count:synced})}
    return changed||synced>0;
  }

  function installLearningReviewSync(){
    if(window.onHomeLatestLearning?.__v29)return;
    const prior=window.onHomeLatestLearning;
    const wrapped=function(result){let out;try{if(typeof prior==='function')out=prior.apply(this,arguments)}catch(_){}try{syncLearningReviews(result||{})}catch(_){}return out};
    wrapped.__v29=true; window.onHomeLatestLearning=wrapped;
  }

  function pullLatestLearning(force=false){
    if(typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.loadLatestLearning!=='function')return false;
    const t=Date.now();if(!force&&t-lastReviewPull<45000)return false;lastReviewPull=t;
    try{AdaptiveNative.loadLatestLearning(20);return true}catch(_){return false}
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

  function refreshPrivateState(){wrapTaskActions();installLearningReviewSync();syncPrivateTasks();renderHistory();pullLatestLearning();reportAccessStatus()}
  function install(){
    try{rememberCompleted(currentTodoState().archive||[])}catch(_){}
    installLearningReviewSync();refreshPrivateState();reportAccessStatus(true);
    for(const delay of [2500,12000])setTimeout(()=>pullLatestLearning(true),delay);
    const prior=window.onAppResume;
    if(typeof prior==='function'&&!prior.__v29){
      const wrapped=function(){
        const result=prior.apply(this,arguments);
        for(const delay of [250,2200,6500]) setTimeout(refreshPrivateState,delay);
        return result
      };
      wrapped.__v29=true; window.onAppResume=wrapped;
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  else setTimeout(install,0);
  document.addEventListener('click',()=>setTimeout(refreshPrivateState,80),true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refreshPrivateState,180)});
  window.VBrainPrivateIngest={version:29,ingest:syncPrivateTasks,history:()=>read(HISTORY,[]),syncLearning:()=>pullLatestLearning(true),access:accessStatus};
})();
