/* One host contract for complete UI updates, durable private context and reminders. */
(function(){
  'use strict';
  if(window.VBrainLive)return;
  const VERSION=17, OUT='vbrainContextOutbox17';
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch(_){return f}};
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const native=()=>typeof Native!=='undefined'&&typeof Native.liveRuntimeStatus==='function';
  const bridge=()=>typeof AdaptiveNative!=='undefined';
  const screen=()=>document.querySelector('.screen.show')?.id.replace(/Screen$/,'')||'home';
  const log=(kind,data)=>window.homeAdaptiveLog?.(kind,data||{});
  const fieldTimers=new Map(),seen=new Map();let ready=false,lastHeartbeat=0;
  let live={version:'17 preview',source:'preview',ready:false},sync={configured:false,pending:0};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const privateField=el=>el?.matches?.('textarea,input[type="text"],input:not([type]),[contenteditable="true"]')&&!/(password|token|secret|credential|api.?key|otp|pin)/i.test([el.type,el.id,el.name,el.autocomplete,el.placeholder].join(' '));
  function field(el){
    if(!privateField(el))return;
    const name=el.id||el.name||el.getAttribute('aria-label')||'note',text=String(el.value??el.innerText??'');
    const task=typeof currentTodoDetailId!=='undefined'?currentTodoDetailId:'';
    const key=screen()+'|'+task+'|'+name;if(seen.get(key)===text)return;
    const row={id:'ctx17-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),kind:'private_text_field',at:Date.now(),source:'vbrain-v17',screen:screen(),field:name,text,taskId:task};
    const q=load(OUT,[]);q.push(row);save(OUT,q);seen.set(key,text);flushFields();
  }
  function flushFields(){
    if(!bridge()||typeof AdaptiveNative.queuePrivateActivity!=='function')return;
    const keep=[];for(const row of load(OUT,[])){
      try{if(!AdaptiveNative.queuePrivateActivity(JSON.stringify(row)))keep.push(row)}catch(_){keep.push(row)}
    }save(OUT,keep);
  }
  function captureAll(){for(const [el,t] of fieldTimers){clearTimeout(t);field(el)}fieldTimers.clear();document.querySelectorAll('textarea:focus,input:focus,[contenteditable="true"]:focus').forEach(field);flushFields()}
  document.addEventListener('input',e=>{if(!privateField(e.target))return;clearTimeout(fieldTimers.get(e.target));fieldTimers.set(e.target,setTimeout(()=>{field(e.target);fieldTimers.delete(e.target)},1000))},true);
  document.addEventListener('focusout',e=>{if(privateField(e.target)){clearTimeout(fieldTimers.get(e.target));fieldTimers.delete(e.target);field(e.target)}},true);
  function status(){
    try{if(native())live=JSON.parse(Native.liveRuntimeStatus())}catch(_){}
    try{if(bridge())sync=JSON.parse(AdaptiveNative.homeSyncStatus())}catch(_){}
    const b=document.getElementById('vbrainLiveStatus17');if(b)b.textContent='V BRAIN 17 · '+(live.ready?'Update ready':!sync.configured?'Connect sync':sync.pending?sync.pending+' pending':sync.lastSyncedAt?'Connected':'Sync waiting');
    return{live,sync};
  }
  function safeApply(){
    if(!ready||screen()!=='home'||document.querySelector('#vBrainV8.show,#vbrainControl17.show')||privateField(document.activeElement))return;
    captureAll();ready=false;Native.applyLiveUpdate();
  }
  window.onVBrainLiveUpdate=function(result){live=result||live;ready=live.ready===true;status();safeApply()};
  function openReminder(r){
    const target=['calendar','todos','tube','gym','home'].includes(r?.target)?r.target:'home';
    const brain=document.querySelector('#vBrainV8.show .vb8Back');brain?.click();
    if(document.querySelector('#reader.show'))closeReader();
    if(r?.taskId&&typeof findTodo==='function'&&findTodo(r.taskId)){openTodoDetail(r.taskId);return;}
    if(target==='gym'&&typeof window.openHomeGym==='function')window.openHomeGym();else showScreen(target);
  }
  const time=t=>t?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(t):'Waiting for first confirmation';
  function closeControls(){document.getElementById('vbrainControl17')?.classList.remove('show');document.body.style.overflow=''}
  function controls(){
    status();let box=document.getElementById('vbrainControl17');if(!box){box=document.createElement('section');box.id='vbrainControl17';box.setAttribute('role','dialog');box.setAttribute('aria-label','V-Brain connection and reminders');document.body.appendChild(box)}
    let settings={enabled:true};try{if(bridge())settings=JSON.parse(AdaptiveNative.notificationSettings())}catch(_){}
    box.innerHTML=`<div class="vb17Panel"><button class="vb17Close" aria-label="Close settings">×</button><small>V BRAIN · CONNECTION</small><h2>Always evolving.</h2><p class="vb17Sub">Your notes, learning and activity shape what comes next.</p><dl><dt>Interface</dt><dd>${esc(live.version)}</dd><dt>Update checked</dt><dd>${esc(time(live.checkedAt))}</dd><dt>Private sync</dt><dd>${sync.configured?Number(sync.pending)+' waiting · last sent '+esc(time(sync.lastSyncedAt)):'Connect HOME Sync to send your app data'}</dd></dl><div class="vb17Actions"><button id="vb17Check">Check for updates</button><button id="vb17Sync">${sync.configured?'Sync now':'Connect sync'}</button></div><div class="vb17Reminder"><h3>Personal reminders</h3><p>Up to two a day. Quiet from 22:00 to 08:00. Tap a reminder to open its task or learning card.</p><button id="vb17Toggle">${settings.enabled?'Pause reminders':'Enable reminders'}</button><button id="vb17Test">Try a reminder</button></div><p class="vb17Foot">App activity and your writing sync privately when connected. Android permissions stay under your control.</p></div>`;
    box.classList.add('show');document.body.style.overflow='hidden';box.querySelector('.vb17Close').onclick=closeControls;
    box.querySelector('#vb17Check').onclick=()=>{if(native())Native.checkLiveUpdate();box.querySelector('#vb17Check').textContent='Checking…'};
    box.querySelector('#vb17Sync').onclick=()=>{if(!sync.configured&&typeof Native!=='undefined'){Native.configureNotion();return}if(bridge())AdaptiveNative.flushPrivateSync();box.querySelector('#vb17Sync').textContent='Sync requested'};
    box.querySelector('#vb17Toggle').onclick=()=>{if(bridge()){AdaptiveNative.setRemindersEnabled(!settings.enabled);if(!settings.enabled)AdaptiveNative.requestNotificationPermission()}controls()};
    box.querySelector('#vb17Test').onclick=()=>{if(!bridge())return;AdaptiveNative.requestNotificationPermission();AdaptiveNative.scheduleSmartReminder(JSON.stringify({id:'vbrain-test-'+Date.now(),title:'One small step.',body:'Open V-Brain and choose one thing you can move forward in five minutes.',target:'todos',atMillis:Date.now()+15000}));box.querySelector('#vb17Test').textContent='Scheduled · quiet hours apply'};
  }
  function ui(){
    const inner=document.querySelector('#homeScreen .homeInner');if(!inner)return;
    let b=document.getElementById('vbrainLiveStatus17');if(!b){b=document.createElement('button');b.id='vbrainLiveStatus17';b.onclick=controls;inner.appendChild(b)}
    const style=document.createElement('style');style.textContent=`
      #vbrainLiveStatus17{display:block;margin:24px auto 6px;border:0;background:transparent;color:#9caabd;font:600 10px system-ui;letter-spacing:.13em;padding:12px;min-height:44px}
      #vbrainControl17{display:none;position:fixed;inset:0;z-index:100001;background:rgba(6,9,14,.85);backdrop-filter:blur(16px);padding:20px;overflow:auto;align-items:center;justify-content:center}
      #vbrainControl17.show{display:flex}.vb17Panel{position:relative;margin:auto;max-width:440px;width:100%;padding:30px 24px;border:1px solid #333b49;border-radius:28px;background:#131922;color:#f4f5f7;font:14px system-ui}.vb17Panel small{font-size:10px;letter-spacing:.15em;color:#a6b8ed}.vb17Panel h2{font-size:30px;letter-spacing:-1px;margin:18px 0 10px}.vb17Sub,.vb17Foot,.vb17Reminder p{color:#a4adbc;line-height:1.6;font-size:12px}.vb17Panel dl{margin:25px 0}.vb17Panel dt{font-size:10px;text-transform:uppercase;color:#8293aa;margin-top:14px}.vb17Panel dd{margin:4px 0 0;overflow-wrap:anywhere;font-size:12px}.vb17Panel button{border:1px solid #354458;border-radius:12px;padding:12px 14px;background:#202c3f;color:#eef3ff;font-size:12px;min-height:44px}.vb17Actions{display:flex;gap:8px}.vb17Reminder{border-top:1px solid #303a4a;margin-top:25px;padding-top:14px}.vb17Reminder button{margin:4px 4px 4px 0}.vb17Panel .vb17Close{position:absolute;right:14px;top:12px;font-size:22px;border:0;background:transparent}.vb17Foot{margin:20px 0 0;font-size:10px}
      @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `;document.head.appendChild(style);status();
  }
  // Applying a server snapshot must not mark every incoming task as a local edit.
  window.onNotionSnapshot=function(data){
    try{
      const dirty=new Set(data.pendingTaskIds||[]),local=[...todoState.active,...todoState.archive];
      const prepare=t=>{const prior=local.find(x=>x.id===t.id);return typeof enrichTodo==='function'?enrichTodo({...t,details:t.details||prior?.details||{personalNote:''}}):t};
      const active=(data.open||[]).filter(t=>!dirty.has(t.id)).map(prepare);
      const archive=(data.completed||[]).filter(t=>!dirty.has(t.id)).map(prepare);
      for(const t of todoState.active)if(dirty.has(t.id))active.push(t);
      for(const t of todoState.archive)if(dirty.has(t.id))archive.push(t);
      todoState.active=active;todoState.archive=archive;
      const raw=JSON.stringify(todoState);
      localStorage.setItem('todoState',raw);
      if(typeof Native!=='undefined'&&Native.acceptRemoteTodoState)Native.acceptRemoteTodoState(raw);
      renderTodos();updateHome();
      if(screen()==='todoDetail'&&!privateField(document.activeElement))renderTodoDetail();
      setSyncStatus('Synced');planReminders();
    }finally{syncingNotion=false}
  };
  window.renderLearningArchive=function(){
    const el=document.getElementById('learnHistory');if(!el)return;el.innerHTML='';
    for(const row of (tubeState.completed||[]).slice(-20).reverse()){
      const item=document.createElement('div');item.className='learnHistoryItem';
      const outcome=row.semanticReview?`AI review ${Number(row.semanticReview.overall)}/100`:row.sentence?'Answer saved · review pending':typeof row.quizCorrect==='boolean'?(row.quizCorrect?'Quiz correct':'Quiz completed'):'Completed';
      item.innerHTML=`<b>${esc(row.title)}</b><span>${esc(outcome)} · ${esc(new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(row.at))}</span>`;el.appendChild(item);
    }
  };
  function planReminders(){
    if(!bridge()||typeof AdaptiveNative.scheduleSmartReminder!=='function')return;
    const config=window.HOMEAdaptive?.config?.notifications||{};if(config.enabled===false)return;
    const tasks=typeof todoState!=='undefined'?todoState.active||[]:[];
    const recent=(window.HOMEAdaptive?.activity?.()||[]).filter(x=>Date.now()-x.at<14*86400000);
    const learned=recent.filter(x=>x.type==='tube_complete').length;
    const hourRows=recent.filter(x=>['todo_complete','tube_complete'].includes(x.type));
    const hours={};hourRows.forEach(x=>{const h=new Date(x.at).getHours();if(h>=8&&h<=20)hours[h]=(hours[h]||0)+1});
    const best=Object.entries(hours).sort((a,b)=>b[1]-a[1])[0];
    const evening=best&&best[1]>=4?Math.max(13,Math.min(20,Number(best[0]))):18;
    const lastPlan=load('vbrainReminderPlan17',{});const date=new Date().toDateString();const signature=JSON.stringify([date,tasks.map(t=>t.id),learned,evening]);
    if(lastPlan.signature===signature)return;
    for(let d=0;d<4;d++){
      const at=(h,m)=>{const x=new Date();x.setDate(x.getDate()+d);x.setHours(h,m,0,0);return x.getTime()};
      const day=new Date(at(12,0)).toISOString().slice(0,10);
      const task=tasks[d%Math.max(1,tasks.length)];
      const morningId='v17-morning-'+day;
      if(task&&at(9,0)>Date.now())AdaptiveNative.scheduleSmartReminder(JSON.stringify({id:morningId,title:d%2?'Five minutes is enough.':'Make one thing easier.',body:String(task.title).slice(0,150)+' — choose the smallest next step.',target:'todos',taskId:task.id,atMillis:at(9,0)}));
      else AdaptiveNative.cancelNotification(morningId);
      if(at(evening,20)>Date.now())AdaptiveNative.scheduleSmartReminder(JSON.stringify({id:'v17-learning-'+day,title:d%2?'Can you explain it simply?':'One useful idea.',body:d%2?'Explain one idea in your own words. A short answer is enough to start.':'Read one short card and test what stuck. Stop after one if that is enough today.',target:'tube',atMillis:at(evening,20)}));
    }
    save('vbrainReminderPlan17',{signature,at:Date.now()});log('notification_plan',{version:17,morning:9,learningHour:evening,evidence:best?.[1]||0,maxPerDay:2});
  }
  function heartbeat(){
    flushFields();status();safeApply();
    if(bridge())AdaptiveNative.flushPrivateSync();
    if(Date.now()-lastHeartbeat>60000){lastHeartbeat=Date.now();log('runtime_heartbeat',{version:live.version,nativeVersion:VERSION,source:live.source,pending:sync.pending,screen:screen(),checkedAt:live.checkedAt});if(bridge())AdaptiveNative.checkDeviceCommands()}
  }
  function pause(){captureAll();log('session_background',{screen:screen()});if(bridge())AdaptiveNative.flushPrivateSync()}
  const oldBack=window.handleAndroidBack;window.handleAndroidBack=function(){if(document.querySelector('#vbrainControl17.show')){closeControls();return'handled'}captureAll();return oldBack?oldBack():'home'};
  const oldResume=window.onAppResume;window.onAppResume=function(){oldResume?.();flushFields();if(native())Native.checkLiveUpdate();heartbeat();planReminders()};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else{heartbeat();planReminders()}});
  window.VBrainLive={version:VERSION,status,pause,openReminder,planReminders};
  ui();flushFields();
  setTimeout(()=>{
    if(typeof showScreen!=='function'||!window.VBrain||!window.HOMEAdaptive||!document.querySelector('#homeScreen .homeGrid'))return;
    if(native()){Native.markRuntimeHealthy(document.querySelector('meta[name="vbrain-boot"]')?.content||'');Native.checkLiveUpdate()}
    status();log('runtime_ready',{version:live.version,nativeVersion:VERSION,source:live.source});heartbeat();planReminders();
  },1600);
  setInterval(()=>{if(!document.hidden)heartbeat()},15000);
  setInterval(()=>{if(!document.hidden&&native())Native.checkLiveUpdate()},60000);
})();
