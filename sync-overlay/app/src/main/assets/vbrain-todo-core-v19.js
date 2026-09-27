/* V-Brain To-Do Core v19 — one local-first writer, deterministic remote merge, no UI-blocking sync. */
(function(){
  'use strict';
  if(window.__VBRAIN_TODO_CORE_V19__)return;window.__VBRAIN_TODO_CORE_V19__=true;
  const VERSION=19, KEY='todoState', REV='vbrainTodoRevisionV19';
  const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v}};
  const now=()=>Date.now();
  let rendering=false,noteTimer=0,lastRaw='';
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}};

  function ensureDetails(t){
    const d=t&&typeof t.details==='object'&&t.details?t.details:{};
    return {...t,details:{outcome:String(d.outcome||''),info:Array.isArray(d.info)?d.info:[],tips:Array.isArray(d.tips)?d.tips:[],links:Array.isArray(d.links)?d.links:[],personalNote:String(d.personalNote||'')}};
  }
  function ensureState(){
    if(typeof todoState==='undefined'||!todoState||typeof todoState!=='object')window.todoState={active:[],archive:[]};
    if(!Array.isArray(todoState.active))todoState.active=[];
    if(!Array.isArray(todoState.archive))todoState.archive=[];
    todoState.active=dedupe(todoState.active.map(ensureDetails));
    todoState.archive=dedupe(todoState.archive.map(ensureDetails));
    const archived=new Set(todoState.archive.map(t=>String(t.id||'')));todoState.active=todoState.active.filter(t=>!archived.has(String(t.id||'')));
    return todoState;
  }
  function key(t){const id=String(t?.id||'').trim();return id?'id:'+id:'title:'+norm(t?.title)}
  function dedupe(list){
    const out=[],seen=new Map();
    for(const raw of Array.isArray(list)?list:[]){const t=ensureDetails(raw||{}),k=key(t);if(!k||k==='title:')continue;
      if(!seen.has(k)){seen.set(k,out.length);out.push(t);continue}
      const i=seen.get(k),a=out[i],b=t;out[i]={...a,...b,details:{...a.details,...b.details,personalNote:b.details.personalNote||a.details.personalNote||''}};
    }
    return out;
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
  function render(){
    if(rendering)return;rendering=true;requestAnimationFrame(()=>{try{window.renderTodos?.();window.updateHome?.();if(window.currentScreen==='todoDetail'&&window.currentTodoDetailId&&window.findTodo?.(window.currentTodoDetailId))window.renderTodoDetail?.()}catch(_){}finally{rendering=false}})
  }
  function persist(reason='edit',stage=true){const raw=stateRaw();write(raw,{stage,reason});render();return raw}
  function find(list,id){return list.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id))}

  window.completeTodo=function(id){
    ensureState();const i=find(todoState.active,id);if(i<0)return false;const [t]=todoState.active.splice(i,1);t.completedAt=now();todoState.archive.push(t);todoState.archive=dedupe(todoState.archive);persist('complete',true);log('todo_complete',{id:String(t.id||''),title:String(t.title||'').slice(0,160),source:'v19-local-first'});return true;
  };
  window.restoreTodo=function(id){
    ensureState();const i=find(todoState.archive,id);if(i<0)return false;const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);todoState.active=dedupe(todoState.active);persist('restore',true);log('todo_restore',{id:String(t.id||''),source:'v19-local-first'});return true;
  };
  window.addTodo=function(){
    ensureState();const input=document.getElementById('newTodo'),title=String(input?.value||'').trim();if(!title)return false;
    const id='local-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8);todoState.active.unshift(ensureDetails({id,title,minutes:0,area:'Personal',note:'',source:'vbrain-local'}));if(input)input.value='';persist('add',true);log('todo_add',{id,title:title.slice(0,160)});return true;
  };

  function mergeTask(remote,local){
    const r=ensureDetails(clone(remote||{})),l=local?ensureDetails(local):null;if(!l)return r;
    const rd=r.details||{},ld=l.details||{};return ensureDetails({...l,...r,details:{...ld,...rd,personalNote:ld.personalNote||rd.personalNote||''}});
  }
  function semanticMap(items){const m=new Map();for(const t of items){const k=norm(t.title);if(k&&!m.has(k))m.set(k,t)}return m}
  function remoteSnapshot(data){
    ensureState();const local=[...todoState.active,...todoState.archive],byId=new Map(local.map(t=>[String(t.id||''),t])),byTitle=semanticMap(local),dirty=new Set((data?.pendingTaskIds||[]).map(String));
    let active=dedupe((data?.open||[]).map(r=>mergeTask(r,byId.get(String(r.id||''))||byTitle.get(norm(r.title)))));
    let archive=dedupe((data?.completed||[]).map(r=>{const t=mergeTask(r,byId.get(String(r.id||''))||byTitle.get(norm(r.title)));if(!t.completedAt)t.completedAt=now();return t}));
    const remoteIds=new Set([...active,...archive].map(t=>String(t.id||''))),remoteTitles=new Set([...active,...archive].map(t=>norm(t.title)).filter(Boolean));
    for(const t of todoState.active){const id=String(t.id||''),title=norm(t.title);if(dirty.has(id)||id.startsWith('local-')||(!remoteIds.has(id)&&!remoteTitles.has(title)&&t.source!=='home-sync'))active.push(t)}
    for(const t of todoState.archive){const id=String(t.id||''),title=norm(t.title);if(dirty.has(id)||id.startsWith('local-')||(!remoteIds.has(id)&&!remoteTitles.has(title)&&t.source!=='home-sync'))archive.push(t)}
    active=dedupe(active);archive=dedupe(archive);const archivedIds=new Set(archive.map(t=>String(t.id||''))),archivedTitles=new Set(archive.map(t=>norm(t.title)).filter(Boolean));active=active.filter(t=>!archivedIds.has(String(t.id||''))&&!archivedTitles.has(norm(t.title)));
    todoState.active=active;todoState.archive=archive;write(stateRaw(),{stage:false,reason:'remote_snapshot'});render();try{window.setSyncStatus?.('Synced')}catch(_){}try{window.VBrainLive?.planReminders?.()}catch(_){}finally{try{syncingNotion=false}catch(_){}}
  }
  window.onNotionSnapshot=remoteSnapshot;
  window.onNotionTaskCreated=function(t){
    ensureState();if(t){const existing=[...todoState.active,...todoState.archive].find(x=>String(x.id)===String(t.id)||norm(x.title)===norm(t.title));if(!existing)todoState.active.unshift(ensureDetails(t));else Object.assign(existing,mergeTask(t,existing));write(stateRaw(),{stage:false,reason:'remote_created'});render()}try{syncingNotion=false}catch(_){}
  };
  window.onNotionTaskChanged=function(result){
    ensureState();const id=result?.id;if(!id)return;if(result.done){const i=find(todoState.active,id);if(i>=0){const [t]=todoState.active.splice(i,1);t.completedAt=now();todoState.archive.push(t)}}else{const i=find(todoState.archive,id);if(i>=0){const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t)}}write(stateRaw(),{stage:false,reason:'remote_changed'});render();try{syncingNotion=false}catch(_){}
  };

  const baseDetail=window.renderTodoDetail;
  if(typeof baseDetail==='function')window.renderTodoDetail=function(){
    const out=baseDetail.apply(this,arguments),note=document.getElementById('detailPersonalNote');if(!note)return out;
    note.oninput=()=>{const live=window.findTodo?.(window.currentTodoDetailId);if(!live)return;live.details=ensureDetails(live).details;live.details.personalNote=note.value;clearTimeout(noteTimer);noteTimer=setTimeout(()=>persist('note',true),450)};
    note.onblur=()=>{clearTimeout(noteTimer);noteTimer=0;persist('note_blur',true)};return out;
  };

  function install(){ensureState();write(stateRaw(),{stage:false,reason:'boot'});render();document.documentElement.dataset.vbrainTodoCore=String(VERSION);log('todo_core_ready',{version:VERSION,active:todoState.active.length,archive:todoState.archive.length})}
  window.VBrainTodos={version:VERSION,persist:()=>persist('api',true),snapshot:()=>clone(ensureState())};
  install();setTimeout(install,700);
})();
