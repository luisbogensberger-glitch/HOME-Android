/* V-Brain To-Do Core v19 — one local-first writer, deterministic remote merge, no UI-blocking sync. */
(function(){
  'use strict';
  if(window.__VBRAIN_TODO_CORE_V19__)return;window.__VBRAIN_TODO_CORE_V19__=true;
  const VERSION=19, KEY='todoState', REV='vbrainTodoRevisionV19', BACKUP='vbrainTodoBackupV19';
  const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[“”„‟]/g,'"').replace(/[‘’‚‛]/g,"'").replace(/[^a-z0-9äöüß]+/gi,' ').trim().replace(/\s+/g,' ');
  const semanticKey=t=>norm(t?.title)+'|'+norm(t?.area||'');
  const clone=v=>{try{return JSON.parse(JSON.stringify(v))}catch(_){return v}};
  const now=()=>Date.now();
  let rendering=false,noteTimer=0,lastRaw='';
  const noteDirty=new Set();
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}};

  function ensureDetails(t){
    const d=t&&typeof t.details==='object'&&t.details?t.details:{};
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
      let i=id&&byId.has(id)?byId.get(id):(sem&&bySemantic.has(sem)?bySemantic.get(sem):-1);
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
    const archivedIds=new Set(todoState.archive.map(t=>String(t.id||''))),archivedSem=new Set(todoState.archive.map(semanticKey));
    todoState.active=todoState.active.filter(t=>!archivedIds.has(String(t.id||''))&&!archivedSem.has(semanticKey(t)));
    return todoState;
  }
  function stateRaw(){ensureState();return JSON.stringify(todoState)}
  function write(raw,{stage=true,reason='state'}={}){
    if(!raw)return false;
    if(raw===lastRaw&&reason==='render')return false;
    try{
      const old=localStorage.getItem(KEY)||'';
      if(old&&old!==raw)localStorage.setItem(BACKUP,old);
      localStorage.setItem(KEY,raw);
      localStorage.setItem(REV,String(Number(localStorage.getItem(REV)||0)+1));
    }catch(_){}
    try{
      if(typeof Native!=='undefined'){
        if(stage&&typeof Native.saveState==='function')Native.saveState(KEY,raw);
        else if(!stage&&typeof Native.acceptRemoteTodoState==='function')Native.acceptRemoteTodoState(raw);
      }
    }catch(_){}
    lastRaw=raw;
    log('todo_state_v19',{reason,active:todoState.active.length,archive:todoState.archive.length,staged:!!stage});
    return true;
  }
  function detailId(){try{return typeof currentTodoDetailId!=='undefined'?currentTodoDetailId:window.currentTodoDetailId}catch(_){return window.currentTodoDetailId}}
  function screen(){try{return typeof currentScreen!=='undefined'?currentScreen:window.currentScreen}catch(_){return window.currentScreen}}
  function noteFocused(){const a=document.activeElement;return !!(a&&a.id==='detailPersonalNote')}
  function render({detail=true}={}){
    if(rendering)return;rendering=true;requestAnimationFrame(()=>{try{
      window.renderTodos?.();window.updateHome?.();const id=detailId();
      if(detail&&!noteFocused()&&screen()==='todoDetail'&&id&&window.findTodo?.(id))window.renderTodoDetail?.();
    }catch(_){}finally{rendering=false}})
  }
  function persist(reason='edit',stage=true,{renderUi=true,detail=true}={}){const raw=stateRaw();write(raw,{stage,reason});if(renderUi)render({detail});return raw}
  function persistQuiet(reason='edit',stage=true){const raw=stateRaw();write(raw,{stage,reason});return raw}
  function find(list,id){return list.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id))}

  window.completeTodo=function(id){
    ensureState();const i=find(todoState.active,id);if(i<0)return false;const [t]=todoState.active.splice(i,1);t.completedAt=now();todoState.archive.push(t);todoState.archive=dedupe(todoState.archive);noteDirty.delete(String(t.id||t.notionId||''));persist('complete',true);log('todo_complete',{id:String(t.id||''),title:String(t.title||'').slice(0,160),source:'v19-local-first'});return true;
  };
  window.restoreTodo=function(id){
    ensureState();const i=find(todoState.archive,id);if(i<0)return false;const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);todoState.active=dedupe(todoState.active);persist('restore',true);log('todo_restore',{id:String(t.id||''),source:'v19-local-first'});return true;
  };
  window.addTodo=function(){
    ensureState();const input=document.getElementById('newTodo'),title=String(input?.value||'').trim();if(!title)return false;
    const id='local-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8);todoState.active.unshift(ensureDetails({id,title,minutes:0,area:'Personal',note:'',source:'vbrain-local'}));if(input)input.value='';persist('add',true);log('todo_add',{id,title:title.slice(0,160)});return true;
  };

  function mergeTask(remote,local,preserveLocal=false){
    const raw=clone(remote||{}),hasRemoteNote=!!(raw&&raw.details&&Object.prototype.hasOwnProperty.call(raw.details,'personalNote'));
    const r=ensureDetails(raw),l=local?ensureDetails(local):null;if(!l)return r;
    const rd=r.details||{},ld=l.details||{},personalNote=preserveLocal?(ld.personalNote||rd.personalNote||''):(hasRemoteNote?String(rd.personalNote||''):(ld.personalNote||''));
    return ensureDetails({...l,...r,details:{...ld,...rd,personalNote}});
  }
  function semanticMap(items){const m=new Map();for(const t of items){const k=semanticKey(t);if(k&&!m.has(k))m.set(k,t)}return m}
  function remoteSnapshot(data){
    ensureState();const local=[...todoState.active,...todoState.archive],byId=new Map(local.map(t=>[String(t.id||''),t])),bySemantic=semanticMap(local),dirty=new Set((data?.pendingTaskIds||[]).map(String));
    const pair=r=>{const l=byId.get(String(r?.id||''))||bySemantic.get(semanticKey(r)),lid=String(l?.id||l?.notionId||''),keep=dirty.has(String(r?.id||''))||dirty.has(lid)||noteDirty.has(lid);const merged=mergeTask(r,l,keep);if(lid&&noteDirty.has(lid)&&String(r?.details?.personalNote??'')===String(l?.details?.personalNote??''))noteDirty.delete(lid);return merged};
    let active=dedupe((data?.open||[]).map(pair));
    let archive=dedupe((data?.completed||[]).map(r=>{const t=pair(r);if(!t.completedAt)t.completedAt=now();return t}));
    const remoteIds=new Set([...active,...archive].map(t=>String(t.id||''))),remoteSem=new Set([...active,...archive].map(semanticKey).filter(Boolean));
    for(const t of todoState.active){const id=String(t.id||''),sem=semanticKey(t);if(dirty.has(id)||noteDirty.has(id)||id.startsWith('local-')||(!remoteIds.has(id)&&!remoteSem.has(sem)&&t.source!=='home-sync'))active.push(t)}
    for(const t of todoState.archive){const id=String(t.id||''),sem=semanticKey(t);if(dirty.has(id)||noteDirty.has(id)||id.startsWith('local-')||(!remoteIds.has(id)&&!remoteSem.has(sem)&&t.source!=='home-sync'))archive.push(t)}
    active=dedupe(active);archive=dedupe(archive);const archivedIds=new Set(archive.map(t=>String(t.id||''))),archivedSem=new Set(archive.map(semanticKey));active=active.filter(t=>!archivedIds.has(String(t.id||''))&&!archivedSem.has(semanticKey(t)));
    todoState.active=active;todoState.archive=archive;write(stateRaw(),{stage:false,reason:'remote_snapshot'});render({detail:!noteFocused()});try{window.setSyncStatus?.('Synced')}catch(_){}try{window.VBrainLive?.planReminders?.()}catch(_){}finally{try{syncingNotion=false}catch(_){}}
  }
  window.onNotionSnapshot=remoteSnapshot;
  window.onNotionTaskCreated=function(t){
    ensureState();if(t){const existing=[...todoState.active,...todoState.archive].find(x=>String(x.id)===String(t.id)||semanticKey(x)===semanticKey(t));if(!existing)todoState.active.unshift(ensureDetails(t));else Object.assign(existing,mergeTask(t,existing,noteDirty.has(String(existing.id||''))));write(stateRaw(),{stage:false,reason:'remote_created'});render({detail:!noteFocused()})}try{syncingNotion=false}catch(_){}
  };
  window.onNotionTaskChanged=function(result){
    ensureState();const id=result?.id;if(!id)return;if(result.done){const i=find(todoState.active,id);if(i>=0){const [t]=todoState.active.splice(i,1);t.completedAt=now();todoState.archive.push(t)}}else{const i=find(todoState.archive,id);if(i>=0){const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t)}}write(stateRaw(),{stage:false,reason:'remote_changed'});render({detail:!noteFocused()});try{syncingNotion=false}catch(_){}
  };

  const baseDetail=window.renderTodoDetail;
  if(typeof baseDetail==='function')window.renderTodoDetail=function(){
    const out=baseDetail.apply(this,arguments),note=document.getElementById('detailPersonalNote');if(!note)return out;
    note.oninput=()=>{const id=detailId(),live=window.findTodo?.(id);if(!live)return;live.details=ensureDetails(live).details;live.details.personalNote=note.value;noteDirty.add(String(live.id||live.notionId||id));clearTimeout(noteTimer);noteTimer=setTimeout(()=>persistQuiet('note',true),650)};
    note.onblur=()=>{clearTimeout(noteTimer);noteTimer=0;persistQuiet('note_blur',true)};return out;
  };

  function recover(){
    try{ensureState();return true}catch(_){}
    try{const b=JSON.parse(localStorage.getItem(BACKUP)||'');if(b&&typeof b==='object'){window.todoState=b;return true}}catch(_){}
    return false;
  }
  function install(){recover();ensureState();write(stateRaw(),{stage:false,reason:'boot'});render();document.documentElement.dataset.vbrainTodoCore=String(VERSION);log('todo_core_ready',{version:VERSION,active:todoState.active.length,archive:todoState.archive.length})}
  window.VBrainTodos={version:VERSION,persist:()=>persist('api',true),snapshot:()=>clone(ensureState()),quietPersist:persistQuiet,noteDirty:()=>[...noteDirty]};
  install();setTimeout(install,700);
})();
