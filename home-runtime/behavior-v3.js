/* HOME Behaviour Engine v3 — privacy-conscious interaction telemetry + adaptive gamification. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_V3__)return;window.__HOME_BEHAVIOUR_V3__=true;
  const VERSION=3;
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const UI_DECISION_KEY='homeBehaviourDecisionV3';
  const NOTIF_KEY='homeBehaviourNotificationsV3';
  const SESSION_FLUSH_MS=60000;
  const IDLE_MS=90000;

  const safeJson=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const saveJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const now=()=>Date.now();
  const log=(type,data)=>{try{if(window.homeAdaptiveLog)window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const partFor=t=>{const h=new Date(t||Date.now()).getHours();return h<5?'night':h<11?'morning':h<15?'midday':h<21?'evening':'night'};
  const screenNow=()=>document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home';
  const recent=(days=14)=>{const since=Date.now()-days*86400000;const rows=safeJson(ACTIVITY_KEY,[]);return Array.isArray(rows)?rows.filter(x=>Number(x.at)>=since):[]};

  function classifyTarget(el){
    if(!el)return'other';
    if(el.closest?.('.homeCard.calendar'))return'home_calendar';
    if(el.closest?.('.homeCard.todos'))return'home_todos';
    if(el.closest?.('.homeCard.tube'))return'home_tube';
    if(el.closest?.('.homeCard.gym'))return'home_gym';
    if(el.closest?.('.todoCheck'))return'todo_complete';
    if(el.closest?.('.todo'))return'todo_open';
    if(el.closest?.('#grid .card'))return'tube_card';
    if(el.closest?.('.option'))return'quiz_option';
    if(el.closest?.('.submit'))return'quiz_submit';
    if(el.closest?.('.gymExercise'))return'gym_exercise';
    if(el.closest?.('.gymPrimary'))return'gym_action';
    if(el.closest?.('input,textarea'))return'input';
    if(el.closest?.('button'))return'button';
    if(el.closest?.('a'))return'link';
    return'other';
  }

  const session={startedAt:now(),lastActive:now(),lastFlush:now(),lastScrollY:window.scrollY||0,activeMs:0,taps:0,scrollPx:0,maxDepth:0,zones:{},targets:{},screen:screenNow()};
  function zoneFor(x,y){
    const cx=x<innerWidth/3?'L':x>innerWidth*2/3?'R':'C';
    const cy=y<innerHeight/3?'T':y>innerHeight*2/3?'B':'M';
    return cy+cx;
  }
  function touchActive(){session.lastActive=now()}
  document.addEventListener('pointerup',e=>{
    if(e.target?.closest?.('input,textarea'))return;
    touchActive();session.taps++;
    const z=zoneFor(e.clientX,e.clientY),target=classifyTarget(e.target);
    session.zones[z]=(session.zones[z]||0)+1;session.targets[target]=(session.targets[target]||0)+1;
  },true);
  let scrollTick=false;
  window.addEventListener('scroll',()=>{
    touchActive();if(scrollTick)return;scrollTick=true;
    requestAnimationFrame(()=>{
      const y=window.scrollY||0;session.scrollPx+=Math.abs(y-session.lastScrollY);session.lastScrollY=y;
      const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);session.maxDepth=Math.max(session.maxDepth,Math.min(1,y/max));
      scrollTick=false;
    });
  },{passive:true});
  ['keydown','touchstart'].forEach(n=>document.addEventListener(n,touchActive,{passive:true}));

  let activeTick=now();
  setInterval(()=>{
    const n=now(),delta=Math.min(5000,n-activeTick);activeTick=n;
    if(!document.hidden&&n-session.lastActive<IDLE_MS)session.activeMs+=delta;
    if(n-session.lastFlush>=SESSION_FLUSH_MS)flushBehaviour(false);
  },5000);

  function flushBehaviour(force){
    const n=now();
    if(!force&&session.taps===0&&session.scrollPx<150&&session.activeMs<15000){session.lastFlush=n;return}
    const current=screenNow();
    log('behavior_summary',{
      daypart:partFor(n),screen:current,activeMs:Math.round(session.activeMs),taps:session.taps,scrollPx:Math.round(session.scrollPx),maxDepth:Number(session.maxDepth.toFixed(2)),zones:session.zones,targets:session.targets
    });
    session.lastFlush=n;session.activeMs=0;session.taps=0;session.scrollPx=0;session.maxDepth=0;session.zones={};session.targets={};session.screen=current;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushBehaviour(true);else{activeTick=now();touchActive()}});
  window.addEventListener('pagehide',()=>flushBehaviour(true));

  function completionRows(days=30){return recent(days).filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type))}
  function gameStats(){
    const rows=completionRows(30),today=dayKey();let xp=0;const domains=new Set();const days={};
    rows.forEach(r=>{
      let add=0,domain='';
      if(r.type==='todo_complete'){add=12;domain='Do'}
      if(r.type==='tube_complete'){add=15+(Number(r.data?.score)>=80?5:0);domain='Learn'}
      if(r.type==='gym_complete'){add=25;domain='Move'}
      xp+=add;const dk=dayKey(r.at);days[dk]=days[dk]||new Set();days[dk].add(domain);if(dk===today)domains.add(domain);
    });
    const activeDays=Object.values(days).filter(s=>s.size>=2).length;
    const todayRows=rows.filter(r=>dayKey(r.at)===today);let todayXp=0;todayRows.forEach(r=>{todayXp+=r.type==='todo_complete'?12:r.type==='tube_complete'?(15+(Number(r.data?.score)>=80?5:0)):25});
    return{xp,todayXp,domains,activeDays};
  }

  function ensureMomentum(){
    const inner=document.querySelector('#homeScreen .homeInner'),grid=inner?.querySelector('.homeGrid');if(!inner||!grid)return null;
    let bar=document.getElementById('homeMomentum');
    if(!bar){bar=document.createElement('div');bar.id='homeMomentum';bar.className='homeMomentum';bar.innerHTML='<div><div class="homeMomentumLabel">MOMENTUM</div><div class="homeMomentumMain" id="homeMomentumMain">Start with one small win</div></div><div class="homeMomentumRight"><div class="homeMomentumDots"><i data-d="Do"></i><i data-d="Learn"></i><i data-d="Move"></i></div><div class="homeMomentumXp" id="homeMomentumXp">0 XP</div></div>';inner.insertBefore(bar,grid)}
    return bar;
  }
  function updateMomentum(){
    ensureMomentum();const s=gameStats();const main=document.getElementById('homeMomentumMain'),xp=document.getElementById('homeMomentumXp');
    if(main)main.textContent=s.domains.size===0?'Start with one small win':s.domains.size===1?'Good start — one domain moved':s.domains.size===2?'Strong day — 2 of 3 moved':'Full momentum — Do · Learn · Move';
    if(xp)xp.textContent=`${s.todayXp} XP today`;
    document.querySelectorAll('#homeMomentum i[data-d]').forEach(i=>i.classList.toggle('done',s.domains.has(i.dataset.d)));
  }

  function bestHour(type,fallback){
    const rows=recent(21).filter(x=>x.type===type);if(rows.length<3)return fallback;
    const buckets={};rows.forEach(r=>{const h=new Date(r.at).getHours();buckets[h]=(buckets[h]||0)+1});
    let best=fallback,count=-1;Object.entries(buckets).forEach(([h,c])=>{const hour=Number(h);if(hour>=7&&hour<=21&&c>count){best=hour;count=c}});return best;
  }
  function todayHas(type){return recent(2).some(x=>x.type===type&&dayKey(x.at)===dayKey())}
  function nextTime(hour,minute=0){const d=new Date();d.setHours(hour,minute,0,0);if(d.getTime()<Date.now()+45*60000)d.setDate(d.getDate()+1);return d.getTime()}
  function scheduleAdaptiveNotifications(){
    if(typeof AdaptiveNative==='undefined')return;
    try{
      const asked=localStorage.getItem('homeBehaviourNotifAskedV3')==='1';
      if(!AdaptiveNative.hasNotificationPermission()&&!asked){localStorage.setItem('homeBehaviourNotifAskedV3','1');AdaptiveNative.requestNotificationPermission();return}
      if(!AdaptiveNative.hasNotificationPermission())return;
    }catch(e){return}
    const stamp=dayKey();if(localStorage.getItem(NOTIF_KEY)===stamp)return;
    const plan=[];
    if(!todayHas('todo_complete'))plan.push({id:'smart-todo',hour:bestHour('todo_complete',9),title:'HOME · Focus',body:'Your usual productive window is near. One task is enough.'});
    if(!todayHas('tube_complete'))plan.push({id:'smart-tube',hour:bestHour('tube_complete',13),title:'HOME · Learn',body:'A short learning card fits this window.'});
    if(!todayHas('gym_complete'))plan.push({id:'smart-gym',hour:bestHour('gym_complete',18),title:'HOME · Gym',body:'This looks like a good training window based on your routine.'});
    const chosen=plan.sort((a,b)=>a.hour-b.hour).slice(0,2);
    try{['smart-todo','smart-tube','smart-gym'].forEach(id=>AdaptiveNative.cancelNotification(id));chosen.forEach(x=>AdaptiveNative.scheduleNotification(x.id,x.title,x.body,nextTime(x.hour,0)));localStorage.setItem(NOTIF_KEY,stamp);log('notification_plan',{items:chosen.map(x=>({id:x.id,hour:x.hour}))})}catch(e){}
  }

  function daypartProductivity(){
    const part=partFor(),rows=completionRows(21).filter(r=>partFor(r.at)===part),score={todos:0,tube:0,gym:0};
    rows.forEach(r=>{if(r.type==='todo_complete')score.todos+=1;if(r.type==='tube_complete')score.tube+=1;if(r.type==='gym_complete')score.gym+=1});
    return{part,score,total:Object.values(score).reduce((a,b)=>a+b,0)};
  }
  function adaptHomeOrder(){
    const p=daypartProductivity();document.documentElement.dataset.homeDaypart=p.part;
    const cards={calendar:document.querySelector('#homeScreen .homeCard.calendar'),todos:document.querySelector('#homeScreen .homeCard.todos'),tube:document.querySelector('#homeScreen .homeCard.tube'),gym:document.querySelector('#homeScreen .homeCard.gym')};
    if(!cards.calendar)return;
    cards.calendar.style.order='0';
    if(p.total<5){if(cards.todos)cards.todos.style.order='1';if(cards.tube)cards.tube.style.order='2';if(cards.gym)cards.gym.style.order='3';return}
    const ranked=['todos','tube','gym'].sort((a,b)=>p.score[b]-p.score[a]);ranked.forEach((k,i)=>{if(cards[k])cards[k].style.order=String(i+1)});
  }

  function decideInterface(){
    const key=dayKey(),saved=safeJson(UI_DECISION_KEY,null);if(saved&&saved.day===key){applyDecision(saved);return saved}
    const rows=recent(14),beh=rows.filter(x=>x.type==='behavior_summary');
    const todoOpen=rows.filter(x=>x.type==='todo_open').length,todoDone=rows.filter(x=>x.type==='todo_complete').length;
    const tubeOpen=rows.filter(x=>x.type==='tube_card_open').length,tubeDone=rows.filter(x=>x.type==='tube_complete').length;
    const tubeBeh=beh.filter(x=>x.data?.screen==='tube');const todoBeh=beh.filter(x=>x.data?.screen==='todos');
    const avg=(arr,k)=>arr.length?arr.reduce((s,x)=>s+Number(x.data?.[k]||0),0)/arr.length:0;
    const decision={day:key,todoDensity:'normal',tubeMode:'keep'};
    if(todoBeh.length>=4&&avg(todoBeh,'maxDepth')>.72&&todoOpen>=5)decision.todoDensity='compact';
    if(todoOpen>=6&&todoDone/Math.max(1,todoOpen)<.35)decision.todoDensity='focus';
    if(tubeOpen>=7&&tubeDone/Math.max(1,tubeOpen)<.45&&avg(tubeBeh,'maxDepth')>.6)decision.tubeMode='story';
    else if(tubeDone>=5&&tubeDone/Math.max(1,tubeOpen)>.68)decision.tubeMode='stack';
    saveJson(UI_DECISION_KEY,decision);applyDecision(decision);log('behavior_ui_decision',decision);return decision;
  }
  function applyDecision(d){
    document.documentElement.dataset.behaviourTodoDensity=d.todoDensity||'normal';
    document.documentElement.dataset.behaviourTubeMode=d.tubeMode||'keep';
    const list=document.getElementById('todoList');if(list&&d.todoDensity==='focus')list.dataset.layout='focus';
    if(list&&d.todoDensity==='compact')list.dataset.behaviourDensity='compact';
    const grid=document.getElementById('grid');if(grid&&['story','stack'].includes(d.tubeMode))grid.dataset.layout=d.tubeMode;
  }

  function patchLifecycle(){
    if(typeof window.showScreen==='function'&&!window.showScreen.__behaviourV3){
      const base=window.showScreen;const w=function(name){flushBehaviour(true);const r=base.apply(this,arguments);setTimeout(()=>{session.screen=screenNow();adaptHomeOrder();updateMomentum();decideInterface()},30);return r};w.__behaviourV3=true;window.showScreen=w;
    }
    if(typeof window.homeAdaptiveLog==='function'&&!window.homeAdaptiveLog.__behaviourV3){
      const base=window.homeAdaptiveLog;const w=function(type,data){const r=base.apply(this,arguments);if(['todo_complete','tube_complete','gym_complete'].includes(type))setTimeout(()=>{updateMomentum();adaptHomeOrder();scheduleAdaptiveNotifications()},80);return r};w.__behaviourV3=true;window.homeAdaptiveLog=w;
    }
  }

  function init(){patchLifecycle();ensureMomentum();updateMomentum();adaptHomeOrder();decideInterface();scheduleAdaptiveNotifications();document.documentElement.dataset.behaviourEngine='3';log('behaviour_engine_ready',{version:VERSION,daypart:partFor()})}
  init();setTimeout(init,700);setTimeout(init,2000);setInterval(()=>{updateMomentum();adaptHomeOrder()},30000);
})();
