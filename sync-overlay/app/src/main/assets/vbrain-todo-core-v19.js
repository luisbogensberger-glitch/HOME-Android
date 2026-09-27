/* V-Brain To-Do Core v19 — one local-first writer, deterministic remote merge, no UI-blocking sync. */
(function(){
  'use strict';
  if(window.__VBRAIN_TODO_CORE_V19__)return;window.__VBRAIN_TODO_CORE_V19__=true;
  const VERSION=19, KEY='todoState', REV='vbrainTodoRevisionV19', DIRTY='vbrainTodoDirtyV20';
  const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'").replace(/[^a-z0-9äöüß]+/gi,' ').trim().replace(/\s+/g,' ');
  const semanticKey=t=>norm(t?.title)+'|'+norm(t?.area||'');
  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v}};
  const now=()=>Date.now();
  let rendering=false,noteTimer=0,lastRaw='';
  let pendingEdits={};try{pendingEdits=JSON.parse(localStorage.getItem(DIRTY)||'{}')}catch(_){}
  const saveDirty=()=>{try{localStorage.setItem(DIRTY,JSON.stringify(pendingEdits))}catch(_){}};
  const fingerprint=(t,done)=>JSON.stringify({title:t.title||'',area:t.area||'',note:t.note||'',minutes:Number(t.minutes||0),details:ensureDetails(t).details,done:!!done});
  function markDirty(t,done){pendingEdits[String(t.id)]={fingerprint:fingerprint(t,done),at:now()};saveDirty()}
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}};

  function ensureDetails(t){
    let parsed={};try{if(typeof parseTaskNotes==='function'&&t?.note)parsed=parseTaskNotes(t.note)||{}}catch(_){}
    const d={...parsed,...(t&&typeof t.details==='object'&&t.details?t.details:{})};
    return {...t,details:{outcome:String(d.outcome||''),info:Array.isArray(d.info)?d.info:[],tips:Array.isArray(d.tips)?d.tips:[],links:Array.isArray(d.links)?d.links:[],personalNote:String(d.personalNote||'')}};
  }
  function mergeDuplicate(a,b){
    const score=x=>(x?.notionId?8:0)+(String(x?.id||'').startsWith('legacy-')?0:4)+(x?.details?.personalNote?3:0)+(x?.details?.info?.length||0)+(x?.details?.links?.length||0);
    const rich=score(b)>score(a)?b:a,other=rich===b?a:b;
    return ensureDetails({...other,...rich,details:{...other.details,...rich.details,personalNote:rich.details?.personalNote||other.details?.personalNote||''}});
  }
  function dedupe(list){
    const out=[],byId=new Map(),bySemantic=new Map();
    for(const raw of Array.isArray(list)?list:[]){
      const t=ensureDetails(raw||{}),id=String(t.id||t.notionId||'').trim(),sem=semanticKey(t);if(!id&&!norm(t.title))continue;
      // A repeated title is not an identity: two real tasks may have the same name.
      let i=id&&byId.has(id)?byId.get(id):-1;
      if(i<0&&sem&&bySemantic.has(sem)){const candidate=out[bySemantic.get(sem)];if(/^legacy-/.test(id)||/^legacy-/.test(String(candidate.id||'')))i=bySemantic.get(sem)}
      if(i>=0){out[i]=mergeDuplicate(out[i],t)}else{i=out.length;out.push(t)}
      const keep=out[i],keepId=String(keep.id||keep.notionId||'').trim(),keepSem=semanticKey(keep);if(keepId)byId.set(keepId,i);if(id)byId.set(id,i);if(keepSem)bySemantic.set(keepSem,i);if(sem)bySemantic.set(sem,i);
    }
    return out;
  }
  function ensureState(){
    if(typeof todoState==='undefined'||!todoState||typeof todoState!=='object')window.todoState={active:[],archive:[]};
    if(!Array.isArray(todoState.active))todoState.active=[];
    if(!Array.isArray(todoState.archive))todoState.archive=[];
    todoState.active=dedupe(todoState.active.map(ensureDetails));
    todoState.archive=dedupe(todoState.archive.map(ensureDetails));
    const archivedIds=new Set(todoState.archive.map(t=>String(t.id||'')));
    todoState.active=todoState.active.filter(t=>!archivedIds.has(String(t.id||'')));
    return todoState;
  }
  function stateRaw(){ensureState();return JSON.stringify(todoState)}
  function write(raw,{stage=true,reason='state'}={}){
    if(!raw||raw===lastRaw&&reason==='render')return;lastRaw=raw;
    try{localStorage.setItem(KEY,raw);localStorage.setItem(REV,String(Number(localStorage.getItem(REV)||0)+1))}catch(_){}
    try{
      if(typeof Native!=='undefined'){
        if(stage&&typeof Native.saveState==='function')Native.saveState(KEY,raw);
        else if(!stage&&typeof Native.acceptRemoteTodoState==='function')Native.acceptRemoteTodoState(raw);
      }
    }catch(_){}
    log('todo_state_v19',{reason,active:todoState.active.length,archive:todoState.archive.length,staged:!!stage});
  }
  function detailId(){try{return typeof currentTodoDetailId!=='undefined'?currentTodoDetailId:window.currentTodoDetailId}catch(_){return window.currentTodoDetailId}}
  function screen(){try{return typeof currentScreen!=='undefined'?currentScreen:window.currentScreen}catch(_){return window.currentScreen}}
  function render(){
    if(rendering)return;rendering=true;requestAnimationFrame(()=>{try{window.renderTodos?.();window.updateHome?.();const id=detailId();if(screen()==='todoDetail'&&id&&window.findTodo?.(id)&&document.activeElement?.id!=='detailPersonalNote')window.renderTodoDetail?.()}catch(_){}finally{rendering=false}})
  }
  function persist(reason='edit',stage=true){const raw=stateRaw();write(raw,{stage,reason});render();return raw}
  function find(list,id){return list.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id))}

  window.completeTodo=function(id){
    ensureState();const i=find(todoState.active,id);if(i<0)return false;const [t]=todoState.active.splice(i,1);t.completedAt=now();todoState.archive.push(t);todoState.archive=dedupe(todoState.archive);markDirty(t,true);persist('complete',true);log('todo_complete',{id:String(t.id||''),source:'v19-local-first'});return true;
  };
  window.restoreTodo=function(id){
    ensureState();const i=find(todoState.archive,id);if(i<0)return false;const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);todoState.active=dedupe(todoState.active);markDirty(t,false);persist('restore',true);log('todo_restore',{id:String(t.id||''),source:'v19-local-first'});return true;
  };
  window.addTodo=function(){
    ensureState();const input=document.getElementById('newTodo'),title=String(input?.value||'').trim();if(!title)return false;
    const id='local-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8);todoState.active.unshift(ensureDetails({id,title,minutes:0,area:'Personal',note:'',source:'vbrain-local'}));markDirty(todoState.active[0],false);if(input)input.value='';persist('add',true);log('todo_add',{id});return true;
  };

  function mergeTask(remote,local,preserveLocal=false){
    const raw=clone(remote||{}),hasRemoteNote=!!(raw&&raw.details&&Object.prototype.hasOwnProperty.call(raw.details,'personalNote'));
    const r=ensureDetails(raw),l=local?ensureDetails(local):null;if(!l)return r;
    if(preserveLocal)return l;
    const rd=r.details||{},ld=l.details||{},personalNote=hasRemoteNote?String(rd.personalNote||''):(ld.personalNote||'');
    return ensureDetails({...l,...r,details:{...ld,...rd,personalNote}});
  }
  function semanticMap(items){const m=new Map();for(const t of items){const k=semanticKey(t);if(k&&!m.has(k))m.set(k,t)}return m}
  function remoteSnapshot(data){
    flushNote();
    ensureState();const local=[...todoState.active,...todoState.archive],byId=new Map(local.map(t=>[String(t.id||''),t])),bySemantic=semanticMap(local),dirty=new Set((data?.pendingTaskIds||[]).map(String));
    if(!Array.isArray(data?.open)||!Array.isArray(data?.completed)){try{syncingNotion=false}catch(_){}return false}
    for(const [items,done] of [[data.open,false],[data.completed,true]])for(const t of items){const id=String(t.id||'');if(pendingEdits[id]&&!dirty.has(id)&&pendingEdits[id].fingerprint===fingerprint(t,done))delete pendingEdits[id]}
    saveDirty();Object.keys(pendingEdits).forEach(id=>dirty.add(id));
    const pair=r=>{const exact=byId.get(String(r?.id||'')),legacy=bySemantic.get(semanticKey(r));const l=exact||(/^legacy-/.test(String(legacy?.id||''))?legacy:null),keep=dirty.has(String(r?.id||''))||dirty.has(String(l?.id||''));return mergeTask(r,l,keep)};
    // A stale snapshot cannot undo a pending completion, restoration or note deletion.
    let active=dedupe(data.open.filter(r=>!dirty.has(String(r.id||''))).map(pair));
    let archive=dedupe(data.completed.filter(r=>!dirty.has(String(r.id||''))).map(r=>{const t=pair(r);if(!t.completedAt)t.completedAt=now();return t}));
    const remoteIds=new Set([...active,...archive].map(t=>String(t.id||''))),remoteSem=new Set([...active,...archive].map(semanticKey).filter(Boolean));
    for(const t of todoState.active){const id=String(t.id||'');if(dirty.has(id)||!remoteIds.has(id))active.push(t)}
    for(const t of todoState.archive){const id=String(t.id||'');if(dirty.has(id)||!remoteIds.has(id))archive.push(t)}
    active=dedupe(active);archive=dedupe(archive);const archivedIds=new Set(archive.map(t=>String(t.id||'')));active=active.filter(t=>!archivedIds.has(String(t.id||'')));
    todoState.active=active;todoState.archive=archive;write(stateRaw(),{stage:false,reason:'remote_snapshot'});render();try{window.setSyncStatus?.('Synced')}catch(_){}try{window.VBrainLive?.planReminders?.()}catch(_){}finally{try{syncingNotion=false}catch(_){}}
  }
  window.onNotionSnapshot=remoteSnapshot;
  window.onNotionTaskCreated=function(t){
    ensureState();if(t){const existing=[...todoState.active,...todoState.archive].find(x=>String(x.id)===String(t.id)||semanticKey(x)===semanticKey(t));if(!existing)todoState.active.unshift(ensureDetails(t));else Object.assign(existing,mergeTask(t,existing,false));write(stateRaw(),{stage:false,reason:'remote_created'});render()}try{syncingNotion=false}catch(_){}
  };
  window.onNotionTaskChanged=function(result){
    ensureState();const id=result?.id;if(!id||pendingEdits[String(id)])return;if(result.done){const i=find(todoState.active,id);if(i>=0){const [t]=todoState.active.splice(i,1);t.completedAt=now();todoState.archive.push(t)}}else{const i=find(todoState.archive,id);if(i>=0){const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t)}}write(stateRaw(),{stage:false,reason:'remote_changed'});render();try{syncingNotion=false}catch(_){}
  };

  const baseDetail=window.renderTodoDetail;
  if(typeof baseDetail==='function')window.renderTodoDetail=function(){
    const out=baseDetail.apply(this,arguments),note=document.getElementById('detailPersonalNote');if(!note)return out;
    note.oninput=()=>{const id=detailId(),live=window.findTodo?.(id);if(!live)return;live.details=ensureDetails(live).details;live.details.personalNote=note.value;markDirty(live,todoState.archive.some(t=>t.id===live.id));try{localStorage.setItem(KEY,JSON.stringify(todoState))}catch(_){}clearTimeout(noteTimer);noteTimer=setTimeout(()=>{noteTimer=0;write(stateRaw(),{stage:true,reason:'note'})},150)};
    note.onblur=flushNote;return out;
  };

  function flushNote(){if(!noteTimer)return;clearTimeout(noteTimer);noteTimer=0;write(stateRaw(),{stage:true,reason:'note_flush'})}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushNote()});window.addEventListener('pagehide',flushNote);
  const beforeBack=window.handleAndroidBack;window.handleAndroidBack=function(){flushNote();return beforeBack?beforeBack():'home'};

  function install(){ensureState();write(stateRaw(),{stage:false,reason:'boot'});render();document.documentElement.dataset.vbrainTodoCore=String(VERSION);log('todo_core_ready',{version:VERSION,active:todoState.active.length,archive:todoState.archive.length})}
  window.VBrainTodos={version:VERSION,persist:()=>persist('api',true),snapshot:()=>clone(ensureState())};
  install();setTimeout(install,700);
})();
