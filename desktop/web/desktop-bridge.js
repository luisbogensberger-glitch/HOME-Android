/* HOME Windows bridge — local-first UI + optional secure pairing to HOME Sync. */
(function(){
  'use strict';
  const invoke=(cmd,args)=>window.__TAURI__?.core?.invoke?window.__TAURI__.core.invoke(cmd,args||{}):Promise.reject(new Error('Desktop bridge unavailable'));
  let paired=false;
  const pendingKey='homeDesktopPendingActivityV1';
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  function normalizeTask(t){return {...t,notionId:t.notionId||t.id,id:t.id,title:t.title||'Untitled'};}
  async function request(path,method='GET',body){return invoke('home_request',{method,path,body:body??null});}
  async function refreshPairState(){try{paired=!!(await invoke('home_has_token'));}catch(e){paired=false}return paired;}
  async function flushActivity(){if(!paired)return;const q=load(pendingKey,[]);if(!q.length)return;const keep=[];for(const item of q.slice(-120)){try{await request('/api/activity','POST',item)}catch(e){keep.push(item)}}save(pendingKey,keep.slice(-120));}
  function queueActivity(item){const q=load(pendingKey,[]);q.push(item);save(pendingKey,q.slice(-120));}

  function ensurePairStyle(){if(document.getElementById('desktopPairStyle'))return;const s=document.createElement('style');s.id='desktopPairStyle';s.textContent=`
#desktopPairSheet{position:fixed;inset:0;z-index:2147480000;background:rgba(0,0,0,.66);display:none;align-items:center;justify-content:center;padding:20px}#desktopPairSheet.show{display:flex}.dpsCard{width:min(460px,100%);background:#101319;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:20px;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.45)}.dpsCard h2{margin:4px 0 8px;font-size:23px}.dpsCard p{margin:0 0 14px;color:rgba(255,255,255,.62);font-size:13px;line-height:1.45}.dpsCard input{width:100%;border:1px solid rgba(255,255,255,.13);background:#171b22;color:#fff;border-radius:14px;padding:12px 13px;outline:none}.dpsActions{display:flex;gap:8px;justify-content:flex-end;margin-top:13px}.dpsActions button{border:0;border-radius:13px;padding:10px 13px;font-weight:800}.dpsCancel{background:#20242b;color:#d7dce5}.dpsSave{background:#7f9dff;color:#071024}.dpsNote{font-size:10px!important;margin-top:10px!important;opacity:.55}
#desktopStatusPill{position:fixed;right:14px;bottom:14px;z-index:80;border:1px solid rgba(255,255,255,.10);background:rgba(12,15,20,.74);backdrop-filter:blur(12px);color:#fff;border-radius:999px;padding:9px 12px;font-size:10px;font-weight:800;letter-spacing:.04em}
`;document.head.appendChild(s)}
  function ensurePairUi(){ensurePairStyle();if(document.getElementById('desktopPairSheet'))return;const sheet=document.createElement('div');sheet.id='desktopPairSheet';sheet.innerHTML='<div class="dpsCard"><div style="font-size:9px;letter-spacing:.14em;color:#9db0ff;font-weight:900">HOME DESKTOP</div><h2>Pair with HOME Sync</h2><p>Paste the same HOME token used by your phone. Windows stores it in Credential Manager, not in this page.</p><input id="desktopPairToken" type="password" autocomplete="off" placeholder="HOME token"><div class="dpsActions"><button class="dpsCancel">Cancel</button><button class="dpsSave">Pair</button></div><p class="dpsNote">Without pairing, HOME still works locally. Pairing syncs tasks, behavioural telemetry and written learning attempts.</p></div>';document.body.appendChild(sheet);sheet.querySelector('.dpsCancel').onclick=()=>sheet.classList.remove('show');sheet.querySelector('.dpsSave').onclick=async()=>{const input=sheet.querySelector('#desktopPairToken'),token=input.value.trim();if(token.length<16){input.focus();return}try{await invoke('home_set_token',{token});paired=true;sheet.classList.remove('show');input.value='';updateStatus();window.onNotionConnected?.();await flushActivity()}catch(e){alert('Could not pair HOME: '+String(e))}};
    const pill=document.createElement('button');pill.id='desktopStatusPill';pill.type='button';pill.onclick=()=>{if(paired){if(confirm('Disconnect this Windows app from HOME Sync?')){invoke('home_clear_token').then(()=>{paired=false;updateStatus();window.onNotionDisconnected?.()})}}else sheet.classList.add('show')};document.body.appendChild(pill);updateStatus();}
  function updateStatus(){const p=document.getElementById('desktopStatusPill');if(p)p.textContent=paired?'HOME Sync · connected':'HOME Sync · pair';}
  function showPair(){ensurePairUi();document.getElementById('desktopPairSheet')?.classList.add('show');setTimeout(()=>document.getElementById('desktopPairToken')?.focus(),80)}

  window.Native={
    loadState:key=>localStorage.getItem(key)||'',
    saveState:(key,value)=>{localStorage.setItem(key,String(value??''));return true},
    hasNotionConnection:()=>paired,
    configureNotion:showPair,
    disconnectNotion:()=>invoke('home_clear_token').then(()=>{paired=false;updateStatus();window.onNotionDisconnected?.()}),
    requestNotionSync:async()=>{if(!paired){showPair();return}try{const data=await request('/v1/snapshot');window.onNotionSnapshot?.({open:(data.open||[]).map(normalizeTask),completed:(data.completed||[]).map(normalizeTask)})}catch(e){window.onNotionSyncError?.({message:String(e)})}},
    createNotionTask:async title=>{if(!paired){showPair();return}try{const t=normalizeTask(await request('/api/tasks','POST',{title:String(title||''),area:'Personal',minutes:0,note:'',done:false,source:'desktop'}));window.onNotionTaskCreated?.(t)}catch(e){window.onNotionSyncError?.({message:String(e)})}},
    setNotionTaskDone:async(id,done)=>{if(!paired){showPair();return}try{await request('/api/tasks/'+encodeURIComponent(id),'PATCH',{done:!!done});window.onNotionTaskChanged?.({id,done:!!done})}catch(e){window.onNotionSyncError?.({message:String(e)})}},
    hasCalendarPermission:()=>true,
    requestCalendarPermission:()=>{},
    getCalendarEvents:()=>JSON.stringify([]),
    openCalendarEvent:()=>{},
    openUrl:url=>invoke('open_external',{url:String(url||'')})
  };

  window.AdaptiveNative={
    logActivity:raw=>{let row={};try{row=JSON.parse(raw||'{}')}catch(e){}const item={...row,kind:'desktop_behavior',source:'windows',createdAt:new Date(Number(row.at)||Date.now()).toISOString()};if(paired)request('/api/activity','POST',item).catch(()=>queueActivity(item));else queueActivity(item)},
    reviewSentence:async raw=>{let ctx={};try{ctx=JSON.parse(raw||'{}')}catch(e){}if(!paired){window.onHomeSentenceReview?.({requestId:ctx.requestId,error:'Windows HOME is not paired to private HOME Sync yet.'});return}try{const attempt={id:ctx.attemptId,attemptId:ctx.attemptId,cardId:ctx.cardId,title:ctx.title,topic:ctx.topic,method:ctx.method,contentDepth:ctx.contentDepth,sentence:ctx.sentence,selected:ctx.selected,correct:ctx.correct,createdAt:new Date(Number(ctx.at)||Date.now()).toISOString(),reviewStatus:'pending',source:'windows'};await request('/api/attempts','POST',attempt);const result=await request('/api/review-sentence','POST',ctx);window.onHomeSentenceReview?.(result)}catch(e){window.onHomeSentenceReview?.({requestId:ctx.requestId,error:String(e)})}},
    hasNotificationPermission:()=>false,
    requestNotificationPermission:()=>{},
    scheduleNotification:()=>{}
  };

  document.addEventListener('DOMContentLoaded',async()=>{await refreshPairState();ensurePairUi();updateStatus();if(paired){setTimeout(()=>{window.onNotionConnected?.();flushActivity()},900)}});
})();
