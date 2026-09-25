/* HOME remote runtime v2 — hot-swappable without an APK rebuild. */
(function(){
  'use strict';
  const VERSION=2;
  const GYM_KEY='homeGymStateV1';

  window.HOMERemote={version:VERSION,loadedAt:Date.now(),capabilities:{tubeStructure:true,todoStructure:true,quizFormats:true,readerFormats:true,swipeModes:true,visualTheme:true,gym:true,richText:true}};
  document.documentElement.dataset.homeRemoteRuntime=String(VERSION);

  const log=(type,data)=>{try{if(window.homeAdaptiveLog)window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const escText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function safeRich(raw){
    const tpl=document.createElement('template');
    tpl.innerHTML=String(raw??'');
    const allowed=new Set(['B','STRONG','EM','I','BR','A']);
    function clean(node){
      if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue||'');
      if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
      const tag=node.tagName.toUpperCase();
      const holder=allowed.has(tag)?document.createElement(tag.toLowerCase()):document.createDocumentFragment();
      if(tag==='A'&&holder.nodeType===Node.ELEMENT_NODE){
        let href='';try{href=new URL(node.getAttribute('href')||'',location.href).href}catch(e){}
        if(/^https:\/\//i.test(href)){
          holder.setAttribute('href',href);holder.setAttribute('target','_blank');holder.setAttribute('rel','noopener noreferrer');holder.className='homeSourceLink';
        }else{
          const frag=document.createDocumentFragment();[...node.childNodes].forEach(ch=>frag.appendChild(clean(ch)));return frag;
        }
      }
      [...node.childNodes].forEach(ch=>holder.appendChild(clean(ch)));
      return holder;
    }
    const out=document.createElement('div');[...tpl.content.childNodes].forEach(ch=>out.appendChild(clean(ch)));
    return out.innerHTML;
  }

  function cardById(id){
    try{if(typeof cardMap!=='undefined'&&cardMap&&cardMap[id])return cardMap[id]}catch(e){}
    try{if(Array.isArray(window.cards))return window.cards.find(c=>c.id===id)}catch(e){}
    return null;
  }

  function repairReaderForCard(c){
    if(!c)return;
    const r=document.getElementById('reader');if(!r||!r.classList.contains('show'))return;
    const lead=r.querySelector('.lead');if(lead)lead.innerHTML=safeRich(c.lead||'');
    const rawSections=Array.isArray(c.sections)?c.sections:[];
    const sourceEntry=rawSections.find(s=>Array.isArray(s)&&String(s[0]||'').trim().toLowerCase()==='sources');
    const contentSections=rawSections.filter(s=>Array.isArray(s)&&String(s[0]||'').trim().toLowerCase()!=='sources');
    const rendered=[...r.querySelectorAll('.content > .section:not(.homeSourcesSection)')];
    rendered.forEach((node,i)=>{
      const src=contentSections[i];if(!src)return;
      const h=node.querySelector('h3'),p=node.querySelector('p');
      if(h)h.textContent=String(src[0]||'');
      if(p)p.innerHTML=safeRich(src[1]||'');
    });
    const takeaway=r.querySelector('.takeaway');if(takeaway)takeaway.innerHTML='<b>Takeaway</b><br>'+safeRich(c.takeaway||'');
    r.querySelectorAll('.homeSourcesSection').forEach(x=>x.remove());
    if(sourceEntry){
      const source=document.createElement('div');source.className='section homeSourcesSection';
      source.innerHTML='<h3>Sources</h3><div class="homeSourcesBody">'+safeRich(sourceEntry[1]||'')+'</div>';
      const links=source.querySelectorAll('a.homeSourceLink');
      links.forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault();const url=a.href;try{if(typeof Native!=='undefined'&&Native.openUrl)Native.openUrl(url);else location.href=url}catch(e){location.href=url}}));
      const anchor=takeaway||r.querySelector('.quiz');
      if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(source,anchor);else r.querySelector('.content')?.appendChild(source);
    }
  }

  function patchOpenCard(){
    if(typeof window.openCard!=='function')return;
    const base=window.openCard.__homeRuntimeBase||window.openCard;
    const wrapped=function(id,slot){
      const result=base.apply(this,arguments);
      setTimeout(()=>repairReaderForCard(cardById(id)),0);
      return result;
    };
    wrapped.__homeRuntimeBase=base;
    window.openCard=wrapped;
  }

  function repairCurrentReader(){
    const r=document.getElementById('reader');if(!r||!r.classList.contains('show'))return;
    const title=r.querySelector('.hero h1')?.textContent?.trim();if(!title)return;
    let c=null;try{c=Object.values(cardMap||{}).find(x=>x&&x.title===title)}catch(e){}
    if(c)repairReaderForCard(c);
  }

  const plans={
    full:{name:'Full body',short:'Strength',minutes:45,accent:'Strength · 45 min',items:[['Squat / leg press','3 × 8–10'],['Bench press / push-ups','3 × 8–12'],['Row / lat pulldown','3 × 8–12'],['Romanian deadlift','3 × 8–10'],['Plank / carry','3 rounds']]},
    quick:{name:'Quick session',short:'Quick',minutes:20,accent:'Efficient · 20 min',items:[['Leg press / squat','3 × 10'],['Chest press / push-ups','3 × 10'],['Row / pulldown','3 × 10'],['Core finisher','3 rounds']]},
    recovery:{name:'Recovery',short:'Recovery',minutes:15,accent:'Easy · 15 min',items:[['Incline walk / bike','8 min easy'],['Hip + ankle mobility','3 min'],['Shoulder mobility','2 min'],['Breathing cooldown','2 min']]}
  };
  function loadGym(){try{const s=JSON.parse(localStorage.getItem(GYM_KEY)||'{}');return{selected:plans[s.selected]?s.selected:'full',active:s.active||null,history:Array.isArray(s.history)?s.history:[]}}catch(e){return{selected:'full',active:null,history:[]}}}
  function saveGym(s){try{localStorage.setItem(GYM_KEY,JSON.stringify(s))}catch(e){}updateGymHomeCard()}
  function weekCount(s){const since=Date.now()-7*86400000;return s.history.filter(x=>Number(x.endedAt||0)>=since).length}
  function formatElapsed(ms){const total=Math.max(0,Math.floor(ms/1000)),m=Math.floor(total/60),sec=total%60;return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0')}
  let gymTimer=null;

  function ensureGymHomeCard(){
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;
    let card=document.getElementById('homeGymCard');
    if(!card){
      card=document.createElement('button');card.id='homeGymCard';card.className='homeCard gym';card.type='button';card.setAttribute('aria-label','Open Gym');
      card.innerHTML='<div class="homeCardHead"><span class="homeCardLabel">Gym</span><span><span class="homeCardMetric" id="homeGymMetric">Ready</span><span class="homeCardChevron">›</span></span></div><div class="homeGymRow"><div class="homeGymIcon" aria-hidden="true">↗</div><div class="homeSummary"><h2>Train</h2><p id="homeGymText">Full body · 45 min</p></div></div>';
      card.onclick=openGym;grid.appendChild(card);
    }
    updateGymHomeCard();
  }
  function updateGymHomeCard(){
    const card=document.getElementById('homeGymCard');if(!card)return;const s=loadGym();const metric=document.getElementById('homeGymMetric'),text=document.getElementById('homeGymText');
    if(metric)metric.textContent=s.active?'In progress':(weekCount(s)?weekCount(s)+' this week':'Ready');
    if(text)text.textContent=s.active?plans[s.active.plan]?.name+' · '+formatElapsed(Date.now()-s.active.startedAt):plans[s.selected].accent;
  }

  function ensureGymScreen(){
    if(document.getElementById('gymScreen'))return;
    const host=document.querySelector('.app')||document.body;const section=document.createElement('section');section.className='screen';section.id='gymScreen';
    section.innerHTML='<div class="gymHero"><div class="gymTop"><button class="gymBack" id="gymBack">‹</button><div><div class="gymEyebrow">GYM</div><h1>Train well.</h1></div><div class="gymWeek" id="gymWeek">0 this week</div></div><p>Simple enough to start. Structured enough to improve.</p></div><div class="gymPad"><div class="gymPlanTabs" id="gymPlanTabs"></div><div class="gymSession" id="gymSession"></div><div class="gymRecent" id="gymRecent"></div></div>';
    host.appendChild(section);section.querySelector('#gymBack').onclick=closeGym;
  }
  function openGym(){
    ensureGymScreen();document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));document.getElementById('gymScreen').classList.add('show');
    try{window.currentScreen='gym'}catch(e){}renderGym();window.scrollTo(0,0);log('gym_open',{});
  }
  function closeGym(){if(gymTimer){clearInterval(gymTimer);gymTimer=null}if(typeof window.showScreen==='function')window.showScreen('home');else{document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));document.getElementById('homeScreen')?.classList.add('show')}window.scrollTo(0,0)}
  window.openHomeGym=openGym;

  function renderGym(){
    ensureGymScreen();const s=loadGym(),plan=plans[s.active?.plan||s.selected],tabs=document.getElementById('gymPlanTabs'),box=document.getElementById('gymSession'),recent=document.getElementById('gymRecent');
    document.getElementById('gymWeek').textContent=weekCount(s)+' this week';
    tabs.innerHTML=Object.entries(plans).map(([id,p])=>'<button data-plan="'+id+'" class="'+((s.active?.plan||s.selected)===id?'selected':'')+'" '+(s.active?'disabled':'')+'><b>'+escText(p.short)+'</b><span>'+p.minutes+' min</span></button>').join('');
    tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>{const live=loadGym();live.selected=b.dataset.plan;saveGym(live);renderGym();log('gym_plan_select',{plan:b.dataset.plan})});
    const completed=new Set((s.active&&Array.isArray(s.active.completed))?s.active.completed:[]);
    box.innerHTML='<div class="gymSessionHead"><div><div class="gymKicker">'+(s.active?'SESSION LIVE':'TODAY')+'</div><h2>'+escText(plan.name)+'</h2><p>'+escText(plan.accent)+'</p></div><div class="gymClock" id="gymClock">'+(s.active?formatElapsed(Date.now()-s.active.startedAt):plan.minutes+'m')+'</div></div><div class="gymExercises">'+plan.items.map((item,i)=>'<button class="gymExercise '+(completed.has(i)?'done':'')+'" data-i="'+i+'" '+(!s.active?'disabled':'')+'><span class="gymCheck">'+(completed.has(i)?'✓':'')+'</span><span><b>'+escText(item[0])+'</b><small>'+escText(item[1])+'</small></span></button>').join('')+'</div><button class="gymPrimary '+(s.active?'finish':'')+'" id="gymAction">'+(s.active?'Finish session':'Start workout')+'</button>';
    box.querySelectorAll('.gymExercise').forEach(b=>b.onclick=()=>{const live=loadGym();if(!live.active)return;const i=Number(b.dataset.i),set=new Set(live.active.completed||[]);if(set.has(i))set.delete(i);else set.add(i);live.active.completed=[...set];saveGym(live);log('gym_exercise_toggle',{plan:live.active.plan,index:i,done:set.has(i)});renderGym()});
    document.getElementById('gymAction').onclick=()=>{const live=loadGym();if(!live.active){live.active={plan:live.selected,startedAt:Date.now(),completed:[]};saveGym(live);log('gym_start',{plan:live.selected});renderGym()}else{const finished={plan:live.active.plan,startedAt:live.active.startedAt,endedAt:Date.now(),completed:(live.active.completed||[]).length,total:plans[live.active.plan]?.items.length||0};live.history.push(finished);if(live.history.length>40)live.history=live.history.slice(-40);live.active=null;saveGym(live);log('gym_complete',{plan:finished.plan,minutes:Math.round((finished.endedAt-finished.startedAt)/60000),completed:finished.completed,total:finished.total});renderGym()}};
    if(gymTimer){clearInterval(gymTimer);gymTimer=null}if(s.active)gymTimer=setInterval(()=>{const clock=document.getElementById('gymClock');const live=loadGym();if(clock&&live.active)clock.textContent=formatElapsed(Date.now()-live.active.startedAt);updateGymHomeCard()},1000);
    const last=s.history[s.history.length-1];recent.innerHTML=last?'<div class="gymRecentLabel">LAST SESSION</div><div class="gymRecentCard"><b>'+escText(plans[last.plan]?.name||'Workout')+'</b><span>'+new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(new Date(last.endedAt))+' · '+last.completed+'/'+last.total+' completed</span></div>':'<div class="gymRecentLabel">START SIMPLE</div><div class="gymRecentCard"><b>No history yet</b><span>Complete one session. HOME will adapt from there.</span></div>';
  }

  function patchBack(){
    const base=window.handleAndroidBack?.__homeRuntimeBase||window.handleAndroidBack;
    const wrapped=function(){if(document.getElementById('gymScreen')?.classList.contains('show')){closeGym();return 'handled'}return typeof base==='function'?base.apply(this,arguments):'home'};
    wrapped.__homeRuntimeBase=base;window.handleAndroidBack=wrapped;
  }

  function refresh(){ensureGymHomeCard();ensureGymScreen();patchOpenCard();patchBack();repairCurrentReader();updateGymHomeCard()}
  window.__homeRemoteV2Refresh=refresh;
  refresh();
  setTimeout(refresh,500);
  setTimeout(refresh,1800);
  log('remote_runtime_ready',{version:VERSION});
})();

/* HOME Behaviour Profile v4 — durable aggregate baseline, live-delivered. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_PROFILE_V4__)return;window.__HOME_BEHAVIOUR_PROFILE_V4__=true;
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const PROFILE_KEY='homeBehaviourProfileV4';
  const PROFILE_HISTORY_KEY='homeBehaviourProfileHistoryV4';
  const LAST_SYNC_KEY='homeBehaviourProfileLastSyncV4';
  const SYNC_MS=6*60*60*1000;
  const SNAPSHOT_EVERY_MS=10*60*1000;

  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const rows=()=>{const v=load(ACTIVITY_KEY,[]);return Array.isArray(v)?v:[]};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const daypart=t=>{const h=new Date(t||Date.now()).getHours();return h<5?'night':h<11?'morning':h<15?'midday':h<21?'evening':'night'};
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const round=(n,d=0)=>{const p=Math.pow(10,d);return Math.round((Number(n)||0)*p)/p};
  const count=(r,type)=>r.filter(x=>x.type===type).length;
  const preferred=(r,type)=>{
    const hits=r.filter(x=>x.type===type);if(!hits.length)return{daypart:null,hour:null};
    const parts={},hours={};hits.forEach(x=>{const p=daypart(x.at),h=new Date(x.at).getHours();parts[p]=(parts[p]||0)+1;hours[h]=(hours[h]||0)+1});
    const best=(o)=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
    const h=best(hours);return{daypart:best(parts),hour:h===null?null:Number(h)};
  };

  function summarise(){
    const all=rows();const since=Date.now()-30*86400000;const r=all.filter(x=>Number(x.at)>=since);
    const behaviour=r.filter(x=>x.type==='behavior_summary');
    const tubeBehaviour=behaviour.filter(x=>x.data?.screen==='tube');
    const todoBehaviour=behaviour.filter(x=>x.data?.screen==='todos');
    const tubeOpens=count(r,'tube_card_open'),tubeDone=count(r,'tube_complete');
    const todoOpens=count(r,'todo_open'),todoDone=count(r,'todo_complete');
    const quiz=r.filter(x=>x.type==='tube_complete').map(x=>Number(x.data?.score)).filter(Number.isFinite);
    const dwell=r.filter(x=>x.type==='tube_reader_dwell').map(x=>Number(x.data?.ms)).filter(n=>n>0&&n<3600000);
    const activeMs=behaviour.reduce((s,x)=>s+Number(x.data?.activeMs||0),0);
    const scrollPx=behaviour.reduce((s,x)=>s+Number(x.data?.scrollPx||0),0);
    const taps=behaviour.reduce((s,x)=>s+Number(x.data?.taps||0),0);
    const days=[...new Set(r.map(x=>dayKey(x.at)))];
    const tubePref=preferred(r,'tube_complete'),todoPref=preferred(r,'todo_complete'),gymPref=preferred(r,'gym_complete');
    return{
      version:4,
      generatedAt:Date.now(),
      windowDays:30,
      evidence:{events:r.length,days:days.length,oldestAt:r.length?Math.min(...r.map(x=>Number(x.at)||Date.now())):null,newestAt:r.length?Math.max(...r.map(x=>Number(x.at)||0)):null},
      app:{activeMinutes:round(activeMs/60000,1),scrollPx:Math.round(scrollPx),taps:Math.round(taps)},
      tube:{opens:tubeOpens,completions:tubeDone,completionRate:tubeOpens?round(tubeDone/tubeOpens,2):null,avgQuizScore:quiz.length?Math.round(avg(quiz)):null,avgReaderSeconds:dwell.length?Math.round(avg(dwell)/1000):null,avgScrollDepth:tubeBehaviour.length?round(avg(tubeBehaviour.map(x=>Number(x.data?.maxDepth||0))),2):null,preferredCompletionDaypart:tubePref.daypart,preferredCompletionHour:tubePref.hour},
      todos:{opens:todoOpens,completions:todoDone,completionRate:todoOpens?round(todoDone/todoOpens,2):null,avgScrollDepth:todoBehaviour.length?round(avg(todoBehaviour.map(x=>Number(x.data?.maxDepth||0))),2):null,preferredCompletionDaypart:todoPref.daypart,preferredCompletionHour:todoPref.hour},
      gym:{completions:count(r,'gym_complete'),preferredCompletionDaypart:gymPref.daypart,preferredCompletionHour:gymPref.hour}
    };
  }

  function backupOperationalState(){
    try{
      if(typeof Native==='undefined'||!Native.saveState||!Native.loadState)return;
      const tube=Native.loadState('tubeState');if(tube)Native.saveState('tubeStateBackupV1',tube);
      const todo=Native.loadState('todoState');if(todo)Native.saveState('todoStateBackupV1',todo);
    }catch(e){}
  }

  function persistProfile(profile){
    save(PROFILE_KEY,profile);
    const history=load(PROFILE_HISTORY_KEY,[]);const arr=Array.isArray(history)?history:[];
    const last=arr[arr.length-1];
    if(!last||dayKey(last.generatedAt)!==dayKey(profile.generatedAt))arr.push(profile);else arr[arr.length-1]=profile;
    if(arr.length>45)arr.splice(0,arr.length-45);save(PROFILE_HISTORY_KEY,arr);
    try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState('behaviorProfileV4',JSON.stringify(profile))}catch(e){}
  }

  function syncProfile(profile,force){
    const last=Number(localStorage.getItem(LAST_SYNC_KEY)||0);if(!force&&Date.now()-last<SYNC_MS)return;
    try{
      if(typeof AdaptiveNative==='undefined'||!AdaptiveNative.logActivity)return;
      const at=Date.now();
      const row={id:'profile-v4-'+dayKey(at)+'-'+Math.floor(at/SYNC_MS),type:'behavior_profile_snapshot',at,screen:'system',data:profile};
      AdaptiveNative.logActivity(JSON.stringify(row));localStorage.setItem(LAST_SYNC_KEY,String(at));
    }catch(e){}
  }

  function snapshot(force){
    const profile=summarise();if(profile.evidence.events<1)return profile;
    persistProfile(profile);backupOperationalState();syncProfile(profile,!!force);return profile;
  }

  window.HOMEBehaviourProfile={version:4,get:()=>load(PROFILE_KEY,null),snapshot:()=>snapshot(true)};
  setTimeout(()=>snapshot(false),2600);
  setTimeout(()=>snapshot(true),12000);
  setInterval(()=>snapshot(false),SNAPSHOT_EVERY_MS);
  window.addEventListener('pagehide',()=>snapshot(false));
})();

/* HOME Quest + Learning Profile v7 — live, local-first, no APK rebuild. */
(function(){
  'use strict';
  if(window.__HOME_QUEST_LEARN_V7__)return;window.__HOME_QUEST_LEARN_V7__=true;
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const LEDGER_KEY='homeQuestLedgerV7';
  const JOURNAL_KEY='homeSentenceJournalV7';
  const PROFILE_KEY='homeSentenceLearningProfileV7';
  const XP={todo_complete:10,tube_complete:15,gym_complete:20};
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const rows=()=>{const v=load(ACTIVITY_KEY,[]);return Array.isArray(v)?v:[]};
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const log=(type,data)=>{try{if(window.homeAdaptiveLog)window.homeAdaptiveLog(type,data||{})}catch(e){}};

  function ensureStyles(){
    if(document.getElementById('homeQuestV7Style'))return;
    const s=document.createElement('style');s.id='homeQuestV7Style';s.textContent=`
      #homeTubeLayoutBar{display:none!important}
      #homeMomentum.homeQuestV7{display:block!important;margin:0 0 14px!important;padding:15px!important;border-radius:25px!important;border:1px solid rgba(246,190,81,.38)!important;background:radial-gradient(circle at 88% 10%,rgba(245,168,44,.14),transparent 33%),linear-gradient(145deg,rgba(16,20,25,.92),rgba(9,12,16,.88))!important;box-shadow:0 18px 46px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06)!important;overflow:hidden}
      .hqTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hqKicker{font-size:10px;font-weight:900;letter-spacing:.18em;color:#f3c66b}.hqTitle{font-size:18px;font-weight:850;letter-spacing:.02em;color:#fff;margin-top:3px}.hqStreak{font-size:11px;font-weight:850;color:#ffb55a;white-space:nowrap;padding-top:2px}.hqSub{font-size:11.5px;line-height:1.42;color:rgba(255,255,255,.69);margin:7px 0 12px}.hqSub b{color:#ffd36f}
      .hqGoals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.hqGoal{min-width:0;border:1px solid rgba(255,255,255,.11);border-radius:17px;padding:10px 8px;background:rgba(255,255,255,.035);display:grid;grid-template-columns:27px 1fr;gap:7px;align-items:center}.hqGoal.done{border-color:rgba(96,211,139,.42);background:linear-gradient(145deg,rgba(31,88,53,.46),rgba(17,42,28,.40));box-shadow:0 0 24px rgba(68,194,113,.08)}.hqCheck{width:27px;height:27px;border-radius:50%;border:1px solid rgba(255,255,255,.28);display:grid;place-items:center;font-size:13px;color:transparent}.hqGoal.done .hqCheck{background:#9be2af;border-color:#9be2af;color:#102319}.hqGoal b{display:block;font-size:11px;color:#f4f6f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hqGoal span{display:block;font-size:9px;color:rgba(255,255,255,.48);margin-top:2px}
      .hqBottom{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08)}.hqLevel{width:43px;height:43px;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%);display:grid;place-items:center;background:linear-gradient(145deg,#ffc85a,#8f5d11);color:#15110b;font-size:16px;font-weight:950}.hqBarMeta{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:rgba(255,255,255,.62);margin-bottom:6px}.hqBarMeta b{color:#fff}.hqTrack{height:8px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden}.hqFill{height:100%;border-radius:999px;background:linear-gradient(90deg,#eaa82a,#ffd66c);box-shadow:0 0 16px rgba(255,191,62,.24);transition:width .5s cubic-bezier(.2,.8,.2,1)}.hqReward{font-size:10px;color:#f6c966;font-weight:850;white-space:nowrap}
      @media(max-width:390px){#homeMomentum.homeQuestV7{padding:13px!important}.hqGoals{gap:5px}.hqGoal{padding:9px 6px;grid-template-columns:24px 1fr}.hqCheck{width:24px;height:24px}.hqGoal b{font-size:10px}.hqSub{font-size:10.8px}}
    `;document.head.appendChild(s);
  }

  function updateLedger(){
    const ledger=load(LEDGER_KEY,{xp:0,seen:[],bonusDays:[],days:{}});ledger.seen=Array.isArray(ledger.seen)?ledger.seen:[];ledger.bonusDays=Array.isArray(ledger.bonusDays)?ledger.bonusDays:[];ledger.days=ledger.days||{};const seen=new Set(ledger.seen),bonus=new Set(ledger.bonusDays);
    rows().forEach(r=>{if(!XP[r.type])return;const id=String(r.id||`${r.type}-${r.at}`);if(!seen.has(id)){ledger.xp+=XP[r.type];seen.add(id)}const d=dayKey(r.at);const dom=r.type==='todo_complete'?'do':r.type==='tube_complete'?'learn':'move';const set=new Set(ledger.days[d]||[]);set.add(dom);ledger.days[d]=[...set]});
    Object.entries(ledger.days).forEach(([d,ds])=>{if(Array.isArray(ds)&&ds.length>=3&&!bonus.has(d)){ledger.xp+=50;bonus.add(d)}});
    ledger.seen=[...seen].slice(-1200);ledger.bonusDays=[...bonus].slice(-120);save(LEDGER_KEY,ledger);return ledger;
  }
  function streakFor(ledger){
    let streak=0;const d=new Date();const today=dayKey(d);const todayCount=(ledger.days[today]||[]).length;if(todayCount<2)d.setDate(d.getDate()-1);
    for(let i=0;i<120;i++){const k=dayKey(d);if((ledger.days[k]||[]).length>=2){streak++;d.setDate(d.getDate()-1)}else break}return streak;
  }
  function questState(){const ledger=updateLedger(),today=dayKey(),done=new Set(ledger.days[today]||[]),count=done.size,streak=streakFor(ledger),level=Math.floor(ledger.xp/100)+1,progress=ledger.xp%100;return{ledger,done,count,streak,level,progress}}
  function subtitle(q){if(q.count===0)return'Complete <b>2 of 3</b> to protect your streak. All 3 unlock <b>+50 XP</b>.';if(q.count===1)return'One down. Finish one more to protect the streak — all 3 unlock <b>+50 XP</b>.';if(q.count===2)return'Streak secured. One more win unlocks <b>+50 XP</b>.';return'Daily Quest complete. <b>+50 XP unlocked.</b>'}
  function goal(name,key,label,done){return `<div class="hqGoal ${done?'done':''}"><div class="hqCheck">✓</div><div><b>${esc(name)}</b><span>${done?'Completed':esc(label)}</span></div></div>`}
  function renderQuest(){
    ensureStyles();const host=document.getElementById('homeMomentum');if(!host)return;const q=questState();host.classList.add('homeQuestV7');host.innerHTML=`<div class="hqTop"><div><div class="hqKicker">TODAY'S QUEST</div><div class="hqTitle">Build momentum that matters.</div></div><div class="hqStreak">🔥 ${q.streak}-day streak</div></div><div class="hqSub">${subtitle(q)}</div><div class="hqGoals">${goal('1 Task','do','0 / 1',q.done.has('do'))}${goal('1 Learn','learn','0 / 1',q.done.has('learn'))}${goal('1 Move','move','0 / 1',q.done.has('move'))}</div><div class="hqBottom"><div class="hqLevel">${q.level}</div><div><div class="hqBarMeta"><b>Level ${q.level}</b><span>${q.progress} / 100 XP</span></div><div class="hqTrack"><div class="hqFill" style="width:${q.progress}%"></div></div></div><div class="hqReward">+50 bonus</div></div>`;
  }

  function loadJournal(){let j=load(JOURNAL_KEY,null);if(Array.isArray(j))return j;try{if(typeof Native!=='undefined'&&Native.loadState){const raw=Native.loadState('sentenceJournalV7');j=JSON.parse(raw||'[]');if(Array.isArray(j)){save(JOURNAL_KEY,j);return j}}}catch(e){}return[]}
  function persistJournal(j){j=j.slice(-120);save(JOURNAL_KEY,j);try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState('sentenceJournalV7',JSON.stringify(j))}catch(e){}}
  function analyseSentence(text){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean),low=String(text||'').toLowerCase(),uniq=new Set(words.map(w=>w.toLowerCase().replace(/[^a-z0-9äöüß'-]/gi,''))).size;
    const causal=/\b(because|therefore|so that|which means|as a result|since|because of|deshalb|weil|daher|dadurch)\b/i.test(low);
    const applied=/\b(i|my|me|when i|i would|i can|in practice|for me|ich|mein|wenn ich|würde ich|kann ich|in der praxis)\b/i.test(low);
    const specific=/\b(for example|specifically|before|after|during|if|when|at |by |with |using|zum beispiel|konkret|bevor|nachdem|während|wenn|mit |durch )\b/i.test(low)||/\d/.test(low);
    const contrast=/\b(however|but|although|whereas|instead|aber|jedoch|obwohl|stattdessen)\b/i.test(low);
    const diversity=words.length?uniq/words.length:0;let depth=0;depth+=Math.min(35,words.length*2);depth+=causal?20:0;depth+=applied?18:0;depth+=specific?17:0;depth+=contrast?10:0;depth+=Math.round(Math.min(10,diversity*10));return{words:words.length,depth:Math.min(100,depth),causal,applied,specific,contrast,diversity:Number(diversity.toFixed(2))}
  }
  function buildLearningProfile(journal){
    const recent=journal.slice(-30);if(!recent.length)return{version:7,count:0,stage:'building',avgWords:0,avgDepth:0,applicationRate:0,causalRate:0,specificityRate:0,updatedAt:Date.now()};
    const metrics=recent.map(x=>x.metrics||analyseSentence(x.text||''));const avgWords=Math.round(avg(metrics.map(x=>x.words))),avgDepth=Math.round(avg(metrics.map(x=>x.depth))),applicationRate=Number(avg(metrics.map(x=>x.applied?1:0)).toFixed(2)),causalRate=Number(avg(metrics.map(x=>x.causal?1:0)).toFixed(2)),specificityRate=Number(avg(metrics.map(x=>x.specific?1:0)).toFixed(2));let stage='developing';if(avgDepth>=72&&avgWords>=14&&applicationRate>=.45)stage='advanced';else if(avgDepth<48||avgWords<10)stage='concise';return{version:7,count:recent.length,stage,avgWords,avgDepth,applicationRate,causalRate,specificityRate,updatedAt:Date.now()}
  }
  function applyLearningAdaptation(profile){
    try{const t=window.HOMEAdaptive?.config?.tube;if(!t)return;if(profile.stage==='advanced'){t.quizMode='mixed';t.readerDepth='deep';t.sectionLimit=4;t.sentenceTargetWords=18}else if(profile.stage==='concise'){t.quizMode='mcq_sentence';t.readerDepth='compact';t.sectionLimit=2;t.sentenceTargetWords=12}else{t.quizMode='mcq_sentence';t.readerDepth='balanced';t.sectionLimit=3;t.sentenceTargetWords=14}}catch(e){}
  }
  function saveSentence(text){
    text=String(text||'').trim();if(!text)return;const reader=document.getElementById('reader');const title=reader?.querySelector('.hero h1')?.textContent?.trim()||'';let topic='';try{const c=Object.values(cardMap||{}).find(x=>x&&x.title===title);topic=c?.topic||''}catch(e){}const journal=loadJournal();const last=journal[journal.length-1];if(last&&last.text===text&&last.title===title&&Date.now()-last.at<30000)return;const metrics=analyseSentence(text);journal.push({at:Date.now(),title,topic,text,metrics});persistJournal(journal);const profile=buildLearningProfile(journal);save(PROFILE_KEY,profile);try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState('sentenceLearningProfileV7',JSON.stringify(profile))}catch(e){}applyLearningAdaptation(profile);log('sentence_profile_updated',{count:profile.count,stage:profile.stage,avgWords:profile.avgWords,avgDepth:profile.avgDepth,applicationRate:profile.applicationRate,causalRate:profile.causalRate,specificityRate:profile.specificityRate})
  }
  function currentLearningProfile(){const j=loadJournal(),p=buildLearningProfile(j);save(PROFILE_KEY,p);applyLearningAdaptation(p);return p}

  function adaptiveTubeLayout(){
    document.getElementById('homeTubeLayoutBar')?.remove();let behaviour=load('homeBehaviourProfileV4',null),learning=currentLearningProfile(),mode='swipe';const rate=behaviour?.tube?.completionRate,seconds=behaviour?.tube?.avgReaderSeconds;if(rate!==null&&rate!==undefined&&rate<.45)mode='story';else if(seconds&&seconds<55)mode='swipe';else if(rate>.7&&learning.stage==='advanced')mode='stack';else mode='swipe';try{localStorage.setItem('homeTubeLayoutV6',mode);const grid=document.getElementById('grid');if(grid)grid.dataset.homeFlexLayout=mode}catch(e){}document.documentElement.dataset.homeAutoTube=mode
  }

  document.addEventListener('click',e=>{const submit=e.target?.closest?.('#submit');if(submit){const ans=document.getElementById('answer');if(ans&&ans.value.trim())saveSentence(ans.value)}},true);
  function refresh(){renderQuest();adaptiveTubeLayout();try{window.HOMEBehaviourProfile?.snapshot?.()}catch(e){}document.documentElement.dataset.homeQuest='7'}
  window.HOMELearningProfile={version:7,get:()=>load(PROFILE_KEY,currentLearningProfile()),journal:()=>loadJournal().slice(),refresh:currentLearningProfile};
  refresh();setTimeout(refresh,800);setTimeout(refresh,2500);setInterval(refresh,5000);
})();
