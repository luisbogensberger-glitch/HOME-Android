/* V-Brain Lean Runtime v24 — one deterministic UI core + one declarative fast-change channel. */
(function(){
  'use strict';
  if(window.__VBRAIN_LEAN_RUNTIME_V24__)return;
  window.__VBRAIN_LEAN_RUNTIME_V24__=true;

  const VERSION=24;
  const ACT='homeAdaptiveActivityV1';
  const UI_CACHE='vbrainUiLiveV24';
  const CONTEXT_KEY='vbrainBrainContext';
  const CONFIG_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/ui-live-v24.json';
  const DEFAULT_UI={schema:1,version:'24-default',pollMs:2000,theme:{accent:'#f0c95d',background:'#080a0e',panel:'#11151c',muted:'rgba(255,255,255,.60)'},home:{mode:'append',columns:1,components:[]},slots:{calendar:[],todos:[],tube:[],todoDetail:[]}};
  const LEGACY_IDS=['homeDayScoreV4','homeDayScoreV3','homeDayScoreV2','homeMomentum','homeTubeLayoutBar','homeBehaviourOverlayV4','vbrainLiveStatus17','vbrainControl17','vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','vBrainOpenBackup','homeRecoveryFlexEntry'];
  const now=()=>Date.now();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const dayKey=t=>{const d=new Date(t||now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const parse=(raw,f)=>{try{const v=JSON.parse(raw||'');return v??f}catch(_){return f}};
  const safeText=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isSensitive=el=>/(password|token|secret|credential|api.?key|otp|pin|bearer|session)/i.test([el?.type,el?.id,el?.name,el?.autocomplete,el?.placeholder].join(' '));
  const screenName=()=>{try{return typeof currentScreen!=='undefined'?String(currentScreen):document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home'}catch(_){return document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home'}};
  const readNative=k=>{try{return typeof Native!=='undefined'&&Native.loadState?String(Native.loadState(k)||''):''}catch(_){return''}};
  const writeNative=(k,v)=>{try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,String(v??''))}catch(_){}};
  const loadLocal=(k,f)=>parse(localStorage.getItem(k),f);
  const saveLocal=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};

  function purgeLegacy(){
    try{
      const drop=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);if(!k)continue;
        if(k==='homeRemoteJsV2'||k==='homeRemoteCssV2'||k==='homeBehaviorJsV3'||k==='homeBehaviorCssV3'||k==='homeRemoteCacheSchema'||k.startsWith('homeRemote:'))drop.push(k);
      }
      drop.forEach(k=>localStorage.removeItem(k));
      localStorage.setItem('homeTubeLayoutV6','stack');
    }catch(_){}
    LEGACY_IDS.forEach(id=>{try{document.getElementById(id)?.remove()}catch(_){}});
  }

  function eventRow(type,data){return{id:'v24-'+type+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,7),type,kind:type,at:now(),source:'vbrain-lean-v24',screen:screenName(),data:data||{}}}
  function log(type,data){
    const row=eventRow(type,data);
    try{const q=loadLocal(ACT,[]);q.push(row);if(q.length>360)q.splice(0,q.length-360);saveLocal(ACT,q)}catch(_){}
    try{AdaptiveNative?.logActivity?.(JSON.stringify(row))}catch(_){}
    return row;
  }
  window.homeAdaptiveLog=log;

  function activity(days=30){const since=now()-days*86400000;return loadLocal(ACT,[]).filter(x=>Number(x?.at||0)>=since)}
  function stateStats(){
    const today=dayKey();let tasks=0,learn=0,activeTasks=0,learnedTotal=0;
    try{activeTasks=Array.isArray(todoState?.active)?todoState.active.length:0;for(const t of (todoState?.archive||[]))if(dayKey(t.completedAt||0)===today)tasks++}catch(_){}
    try{learnedTotal=Array.isArray(tubeState?.completed)?tubeState.completed.length:0;for(const x of (tubeState?.completed||[]))if(dayKey(x.at||0)===today)learn++}catch(_){}
    const todayRows=activity(2).filter(x=>dayKey(x.at)===today),meaningful=todayRows.filter(x=>['todo_complete','tube_complete','todo_add','tube_card_open','calendar_open'].includes(x.type)).length;
    const score=clamp(tasks*30+learn*35+Math.min(25,meaningful*4)+(tasks&&learn?10:0),0,100);
    return{tasks,learn,activeTasks,learnedTotal,meaningful,score,signals:todayRows.length};
  }

  function brainContext(){
    const direct=parse(readNative(CONTEXT_KEY),{});if(Array.isArray(direct?.items))return direct;
    try{const local=parse(localStorage.getItem(CONTEXT_KEY),{});if(Array.isArray(local?.items))return local}catch(_){}
    return{items:[]};
  }
  function syncBrainContext(){
    try{
      const patch=parse(readNative('vbrainPrivatePatch'),{}),box=patch?.brainContext;if(!box||!Array.isArray(box.items))return false;
      const normalized={schema:Number(box.schema)||1,generatedAt:String(box.generatedAt||''),items:box.items.slice(0,120).filter(Boolean).map(x=>({key:safeText(x.key,180),kind:safeText(x.kind,40),statement:safeText(x.statement,1200),confidence:clamp(Number(x.confidence)||0,0,1),evidence_count:Math.max(0,Number(x.evidence_count??x.evidenceCount)||0),source:safeText(x.source,80),source_ref:safeText(x.source_ref,180)})).filter(x=>x.key&&x.statement)};
      const next=JSON.stringify(normalized),old=readNative(CONTEXT_KEY);if(next!==old){writeNative(CONTEXT_KEY,next);try{localStorage.setItem(CONTEXT_KEY,next)}catch(_){}log('brain_context_compat_synced',{version:VERSION,count:normalized.items.length})}return true;
    }catch(_){return false}
  }

  function traitModel(){
    const r=activity(30),s=stateStats();
    const c=t=>r.filter(x=>x.type===t).length;
    const days=new Set(r.map(x=>dayKey(x.at))).size;
    const todoOpen=c('todo_open'),todoDone=c('todo_complete'),tubeOpen=c('tube_card_open'),tubeDone=c('tube_complete'),cal=c('calendar_open');
    const mk=(id,label,value,evidence,desc)=>({id,label,value:Math.round(clamp(value,0,100)),confidence:Math.round(clamp(evidence*9+18,18,95)),evidenceCount:evidence,group:'core',description:desc,reasons:[]});
    const nodes=[
      mk('focus','Focus',Math.min(100,todoDone*12+s.tasks*18+r.filter(x=>x.type==='screen_enter').length),todoDone+todoOpen,'How consistently attention turns into useful work.'),
      mk('follow','Follow-through',todoOpen?100*todoDone/Math.max(1,todoOpen):s.tasks?58:18,todoOpen+todoDone,'How often opened work becomes completed work.'),
      mk('learning','Learning',Math.min(100,tubeDone*18+s.learn*24),tubeOpen+tubeDone,'How strongly learning shows up as completed reflection.'),
      mk('planning','Planning',Math.min(100,c('todo_add')*18+cal*7+s.activeTasks*2),c('todo_add')+cal,'How much structure you use before acting.'),
      mk('consistency','Consistency',Math.min(100,days*9+s.meaningful*4),days,'How regularly meaningful activity repeats.'),
      mk('curiosity','Curiosity',Math.min(100,tubeOpen*9+tubeDone*5),tubeOpen,'How often you choose to explore an idea.')
    ];
    const edges=[{a:'focus',b:'follow',w:78},{a:'learning',b:'curiosity',w:74},{a:'planning',b:'focus',w:62},{a:'consistency',b:'follow',w:66}];
    const ctx=brainContext();
    for(const item of (ctx.items||[]).slice(0,12)){
      const id='ctx-'+safeText(item.key,80).replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();
      nodes.push({id,label:safeText(item.statement,72),value:Math.round(clamp(Number(item.confidence)*100,5,100)),confidence:Math.round(clamp(Number(item.confidence)*100,5,100)),evidenceCount:Number(item.evidence_count)||0,group:'context',description:safeText(item.statement,600),reasons:[safeText(item.source,80)].filter(Boolean),emergent:true});
      edges.push({a:'planning',b:id,w:45});
    }
    return{nodes,edges,e:{signals:r.length,contextCount:(ctx.items||[]).length}};
  }
  window.VBrain={version:VERSION,model:traitModel,openBrain:()=>openBrain()};

  function ensureStyle(){
    if(document.getElementById('vbrainLeanV24Style'))return;
    const s=document.createElement('style');s.id='vbrainLeanV24Style';s.textContent=`
:root{--v24-bg:#080a0e;--v24-panel:#11151c;--v24-panel2:#171c24;--v24-text:#f7f8fb;--v24-muted:rgba(255,255,255,.60);--v24-line:rgba(255,255,255,.10);--v24-accent:#f0c95d;--v24-accent-line:rgba(240,201,93,.27)}
html,body{background:var(--v24-bg)!important;color:var(--v24-text)!important;scroll-behavior:auto!important}button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}.screen{background:var(--v24-bg)!important}
#homeScreen{background:var(--v24-bg)!important}.homeHero{height:218px!important;background-position:center 45%!important}.homeHero:after{height:82px!important;background:linear-gradient(transparent,var(--v24-bg))!important}.v24Brand{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:28px;z-index:2;font-size:17px;font-weight:850;letter-spacing:.32em;text-indent:.32em;color:#fff}.v24HomeInner{padding:0 18px calc(28px + env(safe-area-inset-bottom));margin-top:-1px}.v24CoreHome{display:block}
#vbrainScoreV8{width:100%;border:1px solid var(--v24-accent-line);background:radial-gradient(circle at 90% 5%,rgba(240,201,93,.13),transparent 30%),linear-gradient(145deg,#141820,#0c0f14);border-radius:27px;padding:19px 20px;color:#fff;text-align:left;box-shadow:0 12px 30px rgba(0,0,0,.20);transition:transform 80ms ease,border-color 80ms ease;contain:layout paint style}#vbrainScoreV8:active{transform:scale(.994)}.v24SignalTop{display:grid;grid-template-columns:1fr 76px;gap:14px;align-items:center}.v24Kicker{font-size:10px;font-weight:900;letter-spacing:.18em;color:var(--v24-accent);text-transform:uppercase}.v24SignalTitle{font-size:31px;line-height:1.02;font-weight:850;letter-spacing:-.04em;margin:8px 0 10px}.v24SignalText{font-size:13px;line-height:1.48;color:var(--v24-muted);max-width:270px}.v24Score{width:76px;height:76px;border-radius:50%;border:8px solid rgba(255,255,255,.08);display:grid;place-items:center;font-size:30px;font-weight:850;position:relative}.v24Score:after{content:'V SCORE';position:absolute;bottom:9px;font-size:6px;letter-spacing:.15em;color:rgba(255,255,255,.48)}.v24SignalFoot{display:flex;gap:12px;margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.08);font-size:10px;color:rgba(255,255,255,.54);font-weight:750}.v24SignalFoot b{color:#fff;font-size:13px;margin-right:3px}
.v24Nav{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px}.v24Nav button{min-width:0;border:1px solid var(--v24-line);border-radius:19px;background:#11151b;color:#fff;padding:14px 10px;text-align:left;transition:transform 75ms ease,background 75ms ease;contain:layout paint style}.v24Nav button:active{transform:scale(.985);background:#171c24}.v24Nav small{display:block;color:var(--v24-accent);font-size:8px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;margin-bottom:7px}.v24Nav strong{display:block;font-size:14px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v24Nav span{display:block;font-size:9px;color:var(--v24-muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v24DynamicHome{margin-top:11px}.v24RemoteGrid{display:grid;gap:10px;grid-template-columns:repeat(var(--v24-cols,1),minmax(0,1fr))}.v24RemoteComponent{min-width:0;border:1px solid var(--v24-accent-line);border-radius:22px;background:linear-gradient(145deg,#141820,#0c0f14);color:#fff;padding:16px;text-align:left;contain:layout paint style}.v24RemoteComponent[data-action='1']{cursor:pointer;transition:transform 75ms ease}.v24RemoteComponent[data-action='1']:active{transform:scale(.992)}.v24RemoteComponent .k{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--v24-accent);font-weight:900}.v24RemoteComponent .t{font-size:22px;line-height:1.05;font-weight:850;letter-spacing:-.03em;margin-top:7px}.v24RemoteComponent .x{font-size:12px;line-height:1.45;color:var(--v24-muted);margin-top:7px}.v24RemoteComponent .m{font-size:28px;font-weight:850;margin-top:7px}.v24RemoteInput{width:100%;margin-top:10px;border:1px solid var(--v24-line);border-radius:14px;background:#0d1015;color:#fff;padding:12px;outline:none}.v24RemoteInput:focus{border-color:rgba(240,201,93,.50)}.v24Progress{height:7px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden;margin-top:12px}.v24Progress i{display:block;height:100%;background:var(--v24-accent);border-radius:inherit}.v24Divider{height:1px;background:var(--v24-line);padding:0;border:0;border-radius:0}.v24Slot{margin:0 0 13px}
#calendarScreen,#todosScreen,#tubeScreen,#todoDetailScreen{min-height:100svh!important;background:radial-gradient(circle at 90% 0,rgba(240,201,93,.07),transparent 24%),linear-gradient(180deg,#090b10,var(--v24-bg) 66%)!important}.header{background:#080a0e!important;border-bottom:1px solid rgba(240,201,93,.08)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.back,.ghostBtn,.navDay{background:#141820!important;border:1px solid var(--v24-line)!important;color:#fff!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.eyebrow{color:var(--v24-accent)!important;font-size:10px!important;letter-spacing:.17em!important}.headerTitle h1,.tubeTop h1{font-size:27px!important;font-weight:850!important;letter-spacing:-.035em!important;color:#fff!important}.dateLabel{font-weight:850!important;letter-spacing:-.035em!important}.dateSub,.todoStats,.sub,.counter,.todoMeta,.eventLoc,.hook{color:var(--v24-muted)!important}.calendarList,.todoList,#tubeScreen #grid{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;overflow:visible!important;scroll-snap-type:none!important;transform:none!important}.event,.todo,#tubeScreen #grid .card,.detailOutcome,.detailSection{border:1px solid var(--v24-accent-line)!important;border-radius:21px!important;background:radial-gradient(circle at 94% 2%,rgba(240,201,93,.075),transparent 25%),linear-gradient(145deg,#141820,#0c0f14)!important;color:#fff!important;box-shadow:0 10px 24px rgba(0,0,0,.17)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:transform 75ms ease!important;contain:layout paint style}.event:active,.todo:active,#tubeScreen #grid .card:active{transform:scale(.994)!important}.eventBody h3,.todoBody h3,#tubeScreen #grid .card h2{font-weight:800!important;letter-spacing:-.015em!important}.composer input,.detailNote{background:#0e1116!important;border:1px solid var(--v24-line)!important;color:#fff!important;box-shadow:none!important}.composer button,.primaryBtn{background:var(--v24-accent)!important;color:#171308!important;border:0!important}.chev{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:#171b22!important}#tubeScreen #grid .card{width:100%!important;min-width:0!important;max-width:none!important;grid-template-columns:104px minmax(0,1fr)!important;scroll-snap-align:none!important}#tubeScreen #grid .art{width:104px!important;min-height:116px!important}
#v24BrainOverlay{position:fixed;inset:0;z-index:2147483500;background:#080a0e;color:#fff;display:none;overflow:auto}#v24BrainOverlay.show{display:block}.v24BrainHead{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 16px 12px;background:#080a0e;border-bottom:1px solid rgba(255,255,255,.08)}.v24BrainBack{width:42px;height:42px;border-radius:50%;border:1px solid var(--v24-line);background:#141820;color:#fff;font-size:26px}.v24BrainHead small{display:block;color:var(--v24-accent);font-size:9px;letter-spacing:.16em;font-weight:900}.v24BrainHead h1{font-size:22px;margin:2px 0 0}.v24BrainBody{padding:18px 16px calc(30px + env(safe-area-inset-bottom));max-width:700px;margin:auto}.v24BrainIntro{font-size:13px;line-height:1.5;color:var(--v24-muted);margin:0 0 16px}.v24Trait{border-top:1px solid rgba(255,255,255,.08);padding:13px 0}.v24TraitTop{display:flex;justify-content:space-between;gap:12px;font-size:13px;font-weight:800}.v24TraitTop b{font-size:18px}.v24Bar{height:6px;margin-top:9px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden}.v24Bar i{display:block;height:100%;background:var(--v24-accent);border-radius:inherit}.v24Trait p{font-size:11px;line-height:1.45;color:var(--v24-muted);margin:8px 0 0}.v24Context{margin-top:18px;border-top:1px solid rgba(255,255,255,.09);padding-top:16px}.v24Context h2{font-size:14px;margin:0 0 10px}.v24ContextItem{font-size:11px;line-height:1.45;color:rgba(255,255,255,.70);padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)}
@media(max-width:360px){.v24Nav{grid-template-columns:1fr}.v24SignalTop{grid-template-columns:1fr 68px}.v24SignalTitle{font-size:28px}}
`;
    document.head.appendChild(s);
  }

  function buildHome(){
    const home=document.getElementById('homeScreen');if(!home)return;
    home.innerHTML=`<div class="homeHero"><div class="v24Brand">V-BRAIN</div></div><div class="v24HomeInner"><div class="v24CoreHome"><button id="vbrainScoreV8" type="button" aria-label="Open V-Brain signal"><div class="v24SignalTop"><div><div class="v24Kicker">Behaviour intelligence</div><div class="v24SignalTitle">Your signal today</div><div class="v24SignalText" id="v24SignalText">Quiet signal, useful action.</div></div><div class="v24Score" id="v24Score">0</div></div><div class="v24SignalFoot"><span><b id="v24TaskDone">0</b>tasks</span><span><b id="v24LearnDone">0</b>learned</span><span><b id="v24Signals">0</b>signals</span></div></button><div class="v24Nav"><button type="button" data-v24-route="todos"><small>Focus</small><strong>To-Dos</strong><span id="v24TodoMeta">0 open</span></button><button type="button" data-v24-route="calendar"><small>Today</small><strong>Calendar</strong><span id="v24CalendarMeta">Open day</span></button><button type="button" data-v24-route="tube"><small>Learn</small><strong>Tube</strong><span id="v24TubeMeta">Stack</span></button></div></div><div id="v24DynamicHome"></div></div>`;
    home.querySelector('#vbrainScoreV8').addEventListener('click',openBrain);
    home.querySelectorAll('[data-v24-route]').forEach(b=>b.addEventListener('click',()=>window.showScreen?.(b.dataset.v24Route)));
  }

  function calendarTodayCount(){try{if(typeof Native!=='undefined'&&Native.hasCalendarPermission?.()){const d=new Date(),a=new Date(d);a.setHours(0,0,0,0);const b=new Date(a);b.setDate(b.getDate()+1);return parse(Native.getCalendarEvents(a.getTime(),b.getTime()),[]).length}}catch(_){}return null}
  function updateHome(){
    const s=stateStats();
    const score=document.getElementById('v24Score');if(score)score.textContent=String(s.score);
    const t=document.getElementById('v24TaskDone');if(t)t.textContent=String(s.tasks);const l=document.getElementById('v24LearnDone');if(l)l.textContent=String(s.learn);const sg=document.getElementById('v24Signals');if(sg)sg.textContent=String(s.signals);
    const text=document.getElementById('v24SignalText');if(text)text.textContent=s.tasks&&s.learn?'Work and learning are both moving. Keep the interface quiet and continue.':s.tasks?'You moved useful work forward. V-Brain is watching for follow-through, not taps.':s.learn?'Learning moved today. Keep one useful idea and stop when it is enough.':s.signals?'You have started moving. V-Brain is waiting for a meaningful completion.':'Start with one useful action. The signal grows from follow-through.';
    const tm=document.getElementById('v24TodoMeta');if(tm)tm.textContent=`${s.activeTasks} open`;const lm=document.getElementById('v24TubeMeta');if(lm)lm.textContent=s.learnedTotal?`${s.learnedTotal} learned`:'Stack';const cm=document.getElementById('v24CalendarMeta'),cc=calendarTodayCount();if(cm)cm.textContent=cc===null?'Open day':cc===1?'1 event':`${cc} events`;
    forceTubeStack();
  }
  window.updateHome=updateHome;

  function forceTubeStack(){
    try{localStorage.setItem('homeTubeLayoutV6','stack')}catch(_){}
    const grid=document.getElementById('grid');if(grid){grid.dataset.layout='stack';grid.dataset.homeFlexLayout='stack';grid.style.gridTemplateColumns='1fr';grid.style.overflow='visible';grid.style.transform='none'}
  }

  function ensureBrainOverlay(){
    let o=document.getElementById('v24BrainOverlay');if(o)return o;
    o=document.createElement('section');o.id='v24BrainOverlay';o.setAttribute('role','dialog');o.setAttribute('aria-label','V-Brain signal detail');o.innerHTML='<div class="v24BrainHead"><button class="v24BrainBack" type="button">‹</button><div><small>V-BRAIN · SIGNAL</small><h1>Your living traits</h1></div></div><div class="v24BrainBody" id="v24BrainBody"></div>';document.body.appendChild(o);o.querySelector('.v24BrainBack').onclick=closeBrain;return o;
  }
  function openBrain(){
    const o=ensureBrainOverlay(),m=traitModel(),body=o.querySelector('#v24BrainBody'),ctx=brainContext();
    body.innerHTML=`<p class="v24BrainIntro">${m.e.signals} recent behavioural signals · ${(ctx.items||[]).length} private context items. Traits change from meaningful actions, not passive taps.</p>${m.nodes.filter(n=>n.group!=='context').map(n=>`<div class="v24Trait"><div class="v24TraitTop"><span>${esc(n.label)}</span><b>${n.value}</b></div><div class="v24Bar"><i style="width:${n.value}%"></i></div><p>${esc(n.description)}</p></div>`).join('')}${(ctx.items||[]).length?`<div class="v24Context"><h2>Context</h2>${ctx.items.slice(0,6).map(x=>`<div class="v24ContextItem">${esc(x.statement)}</div>`).join('')}</div>`:''}`;
    o.classList.add('show');document.body.style.overflow='hidden';log('brain_open',{traits:m.nodes.length,context:(ctx.items||[]).length});
  }
  function closeBrain(){document.getElementById('v24BrainOverlay')?.classList.remove('show');document.body.style.overflow=''}

  function patchCore(){
    if(typeof window.showScreen==='function'&&!window.showScreen.__lean24){const base=window.showScreen;const wrap=function(name){const r=base.apply(this,arguments);if(name==='tube')forceTubeStack();updateHome();log('screen_enter',{name:safeText(name,40)});maybeApplyLive();return r};wrap.__lean24=true;window.showScreen=wrap}
    if(typeof window.syncButtonAction==='function'&&!window.syncButtonAction.__lean24){const wrap=function(){if(typeof Native==='undefined')return window.setSyncStatus?.('Sync needs the Android app.');try{if(!window.notionConnected?.()){if(typeof Native.configureVeqrya==='function')Native.configureVeqrya();else Native.configureNotion?.();return}window.refreshNotion?.()}catch(_){}};wrap.__lean24=true;window.syncButtonAction=wrap}
    if(typeof window.handleAndroidBack==='function'&&!window.handleAndroidBack.__lean24){const base=window.handleAndroidBack;const wrap=function(){if(document.getElementById('v24BrainOverlay')?.classList.contains('show')){closeBrain();return'handled'}return base.apply(this,arguments)};wrap.__lean24=true;window.handleAndroidBack=wrap}
  }

  function semanticEvents(){
    document.addEventListener('click',e=>{
      const el=e.target instanceof Element?e.target:null;if(!el)return;
      if(el.closest('.composer button'))log('todo_add',{});
      else if(el.closest('#todoList .todoCheck'))log('todo_complete',{});
      else if(el.closest('#grid .card'))log('tube_card_open',{});
      else if(el.closest('#submit'))setTimeout(()=>{if(document.getElementById('next')?.classList.contains('show')){log('tube_complete',{});updateHome()}},0);
      else if(el.closest('#calendarList .event'))log('calendar_open',{});
    },true);
    document.addEventListener('input',e=>{
      const el=e.target;if(!(el instanceof Element)||isSensitive(el)||!el.matches('textarea,input[type="text"],input:not([type]),[contenteditable="true"]'))return;
      clearTimeout(el.__v24PrivateTimer);el.__v24PrivateTimer=setTimeout(()=>{try{const text=String(el.isContentEditable?el.innerText:el.value||'');AdaptiveNative?.queuePrivateActivity?.(JSON.stringify({id:'v24-private-'+now(),kind:'private_text_field',at:now(),source:'vbrain-lean-v24',screen:screenName(),field:safeText(el.id||el.name||'field',100),text:text.slice(0,4000)}))}catch(_){}},700);
    },true);
  }

  function safeColor(v,fallback){const s=String(v||'').trim();return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent)$/i.test(s)?s:fallback}
  function applyTheme(theme){const r=document.documentElement.style;r.setProperty('--v24-accent',safeColor(theme?.accent,'#f0c95d'));r.setProperty('--v24-bg',safeColor(theme?.background,'#080a0e'));r.setProperty('--v24-panel',safeColor(theme?.panel,'#11151c'));r.setProperty('--v24-muted',safeColor(theme?.muted,'rgba(255,255,255,.60)'))}
  function remoteAction(a){const type=safeText(a?.type,20).toLowerCase();if(type==='brain')return openBrain();if(type==='route'&&['home','calendar','todos','tube'].includes(String(a?.target)))return window.showScreen?.(a.target);if(type==='url'){const u=String(a?.url||'');if(/^https:\/\//i.test(u)){try{Native?.openUrl?.(u)}catch(_){location.href=u}}}}
  function storageKey(v){const s=String(v||'');return /^[a-zA-Z0-9:_-]{1,80}$/.test(s)?s:''}
  function component(raw){
    const c=raw&&typeof raw==='object'?raw:{},type=safeText(c.type||'card',20).toLowerCase(),action=c.action&&typeof c.action==='object'?c.action:null;
    let el;if(type==='divider'){el=document.createElement('div');el.className='v24RemoteComponent v24Divider';return el}
    if(type==='spacer'){el=document.createElement('div');el.style.height=clamp(c.height||12,0,120)+'px';return el}
    el=document.createElement(action?'button':'div');if(action){el.type='button';el.dataset.action='1';el.onclick=()=>remoteAction(action)}el.className='v24RemoteComponent';
    const span=clamp(c.span||1,1,3);el.style.gridColumn='span '+span;
    if(c.style&&typeof c.style==='object'){if(c.style.radius!=null)el.style.borderRadius=clamp(c.style.radius,0,40)+'px';if(c.style.padding!=null)el.style.padding=clamp(c.style.padding,0,30)+'px';if(c.style.minHeight!=null)el.style.minHeight=clamp(c.style.minHeight,0,500)+'px';const bg=safeColor(c.style.background,'');if(bg)el.style.background=bg}
    const add=(cls,text)=>{if(!safeText(text))return;const x=document.createElement('div');x.className=cls;x.textContent=safeText(text,cls==='x'?700:180);el.appendChild(x)};
    add('k',c.kicker);add('t',c.title);add('x',c.text);if(c.metric!=null)add('m',c.metric);
    if(type==='progress'){const p=document.createElement('div');p.className='v24Progress';const i=document.createElement('i');i.style.width=clamp(c.value,0,100)+'%';p.appendChild(i);el.appendChild(p)}
    if(type==='input'){const input=document.createElement(c.multiline?'textarea':'input');if(!c.multiline)input.type='text';input.className='v24RemoteInput';input.placeholder=safeText(c.placeholder,180);input.maxLength=clamp(c.maxLength||500,20,4000);const key=storageKey(c.storageKey);if(key){input.value=readNative(key)||localStorage.getItem(key)||'';input.addEventListener('input',()=>{clearTimeout(input.__saveTimer);input.__saveTimer=setTimeout(()=>{try{localStorage.setItem(key,input.value)}catch(_){}writeNative(key,input.value)},300)})}el.appendChild(input)}
    return el;
  }
  function slotRoot(name){const map={calendar:'calendarScreen',todos:'todosScreen',tube:'tubeScreen',todoDetail:'todoDetailScreen'},screen=document.getElementById(map[name]);if(!screen)return null;let root=screen.querySelector(`[data-v24-slot="${name}"]`);if(root)return root;const pad=screen.querySelector('.pad');if(!pad)return null;root=document.createElement('div');root.dataset.v24Slot=name;root.className='v24Slot';pad.insertBefore(root,pad.firstChild);return root}
  function renderComponents(root,items,columns=1){if(!root)return;root.innerHTML='';const list=Array.isArray(items)?items.filter(x=>x&&x.visible!==false).slice(0,40):[];if(!list.length){root.style.display='none';return}root.style.display='block';const grid=document.createElement('div');grid.className='v24RemoteGrid';grid.style.setProperty('--v24-cols',String(clamp(columns,1,3)));for(const item of list){const el=component(item);if(el)grid.appendChild(el)}root.appendChild(grid)}
  let currentUi=parse(localStorage.getItem(UI_CACHE),null),currentSignature='';
  function renderUi(cfg){cfg=cfg&&typeof cfg==='object'?cfg:DEFAULT_UI;const sig=JSON.stringify(cfg);if(sig===currentSignature)return;currentSignature=sig;currentUi=cfg;applyTheme(cfg.theme||{});const home=cfg.home||{},root=document.getElementById('v24DynamicHome'),core=document.querySelector('.v24CoreHome');if(core)core.style.display=home.mode==='replace'?'none':'block';renderComponents(root,home.components,home.columns||1);for(const name of ['calendar','todos','tube','todoDetail'])renderComponents(slotRoot(name),cfg.slots?.[name],1);document.documentElement.dataset.vbrainUiManifest=safeText(cfg.version||'24',80)}
  async function fetchUi(){let timer=0,controller;try{controller=new AbortController();timer=setTimeout(()=>controller.abort(),1300);const r=await fetch(CONFIG_URL+'?t='+now(),{cache:'no-store',signal:controller.signal});if(r.ok){const j=await r.json();if(j&&typeof j==='object'){currentUi=j;try{localStorage.setItem(UI_CACHE,JSON.stringify(j))}catch(_){}renderUi(j)}}}catch(_){}finally{clearTimeout(timer)}}

  let livePending=false,applying=false;
  function editing(){const el=document.activeElement;return el&&el!==document.body&&el.matches?.('input,textarea,[contenteditable="true"]')}
  function maybeApplyLive(){if(!livePending||applying||screenName()!=='home'||editing())return false;try{applying=true;Native?.applyLiveUpdate?.();return true}catch(_){applying=false;return false}}
  window.onVBrainLiveUpdate=function(result){if(result?.ready===true){livePending=true;maybeApplyLive()}};

  function openReminder(r){const target=['home','calendar','todos','tube'].includes(r?.target)?r.target:'home';if(r?.taskId&&typeof window.findTodo==='function'&&window.findTodo(r.taskId)&&typeof window.openTodoDetail==='function')return window.openTodoDetail(r.taskId);window.showScreen?.(target)}
  function pause(){try{AdaptiveNative?.flushPrivateSync?.()}catch(_){} }
  window.VBrainLive={version:VERSION,pause,openReminder,status:()=>({version:VERSION,ui:currentUi?.version||'default',pendingLive:livePending})};

  let scheduler=0,ticks=0;
  function schedule(ms){clearTimeout(scheduler);scheduler=setTimeout(tick,ms)}
  async function tick(){if(document.hidden){schedule(2000);return}ticks++;if(ticks===1||ticks%3===0){try{Native?.checkLiveUpdate?.()}catch(_){}}if(ticks===1||ticks%5===0){try{AdaptiveNative?.checkDeviceCommands?.();AdaptiveNative?.flushPrivateSync?.()}catch(_){}syncBrainContext()}await fetchUi();maybeApplyLive();updateHome();schedule(clamp(currentUi?.pollMs||2000,1500,10000))}
  function kick(){ticks=0;schedule(0)}

  function markHealthy(){try{Native?.markRuntimeHealthy?.(document.querySelector('meta[name="vbrain-boot"]')?.content||'')}catch(_){}document.documentElement.dataset.vbrainRuntime=String(VERSION)}
  function boot(){purgeLegacy();ensureStyle();buildHome();patchCore();semanticEvents();syncBrainContext();forceTubeStack();renderUi(currentUi||DEFAULT_UI);updateHome();markHealthy();log('runtime_ready',{version:VERSION,lean:true});kick()}
  const oldResume=window.onAppResume;window.onAppResume=function(){try{oldResume?.()}catch(_){}purgeLegacy();patchCore();forceTubeStack();updateHome();markHealthy();try{Native?.checkLiveUpdate?.();AdaptiveNative?.checkDeviceCommands?.();AdaptiveNative?.flushPrivateSync?.()}catch(_){}syncBrainContext();maybeApplyLive();kick()};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){purgeLegacy();updateHome();maybeApplyLive();kick()}else pause()});
  window.addEventListener('online',kick);
  window.VBrainLean={version:VERSION,updateHome,openBrain,closeBrain,model:traitModel,refreshUi:fetchUi,status:()=>({version:VERSION,screen:screenName(),ui:currentUi?.version||'default',pollMs:clamp(currentUi?.pollMs||2000,1500,10000)})};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
