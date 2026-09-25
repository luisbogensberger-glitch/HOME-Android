/* HOME Behaviour Intelligence v1 — transparent self-model + detailed privacy-conscious usage telemetry. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_MAP_V1__)return;window.__HOME_BEHAVIOUR_MAP_V1__=true;

  const VERSION=1;
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const AGG_KEY='homeBehaviourAggregateV1';
  const BUFFER_KEY='homeBehaviourTapBufferV1';
  const MAX_DAYS=90;
  const FLUSH_MS=60000;
  const DAY_MS=86400000;
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const clamp=(n,a=0,b=100)=>Math.min(b,Math.max(a,Number(n)||0));
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const hour=t=>new Date(t||Date.now()).getHours();
  const currentScreen=()=>document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function rows(days=30){
    const since=Date.now()-days*DAY_MS;const r=load(ACTIVITY_KEY,[]);
    return Array.isArray(r)?r.filter(x=>Number(x?.at||0)>=since):[];
  }
  function recentType(type,days=30){return rows(days).filter(x=>x.type===type)}
  function todayRows(){const k=dayKey();return rows(2).filter(x=>dayKey(x.at)===k)}
  function count(list,type){return list.filter(x=>x.type===type).length}
  function fmtMinutes(ms){const m=Math.round((Number(ms)||0)/60000);return m<60?`${m}m`:`${Math.floor(m/60)}h ${m%60}m`}
  function pct(n,d){return d?Math.round(100*n/d):0}

  /* Fine-grained semantic tap counts. Never record typed text, task titles, message text, or button labels. */
  function classify(el){
    if(!el)return'other';
    if(el.closest?.('#homeDayScorePill'))return'day_score';
    if(el.closest?.('#behaviourInsightScreen')){
      if(el.closest?.('#behaviourBack'))return'insights_back';
      if(el.closest?.('#behaviourCanvas'))return'insights_network';
      return'insights_control';
    }
    if(el.closest?.('.homeCard.calendar'))return'home_calendar';
    if(el.closest?.('.homeCard.todos'))return'home_todos';
    if(el.closest?.('.homeCard.tube'))return'home_tube';
    if(el.closest?.('.homeCard.gym'))return'home_gym';
    if(el.closest?.('.todoCheck'))return'todo_complete_control';
    if(el.closest?.('#newTodo'))return'todo_input';
    if(el.closest?.('.composer button'))return'todo_add';
    if(el.closest?.('.todo'))return'todo_open';
    if(el.closest?.('#grid .card'))return'tube_card';
    if(el.closest?.('.option'))return'tube_option';
    if(el.closest?.('#submit,.submit'))return'tube_submit';
    if(el.closest?.('#next,.next'))return'tube_next';
    if(el.closest?.('.gymPlanTabs button'))return'gym_plan';
    if(el.closest?.('.gymExercise'))return'gym_exercise';
    if(el.closest?.('.gymPrimary'))return'gym_action';
    if(el.closest?.('.back,.gymBack,.readerBack'))return'back';
    if(el.closest?.('a'))return'link';
    if(el.closest?.('button'))return'other_button';
    return'other';
  }

  function ensureAggregate(){
    const a=load(AGG_KEY,{days:{}});if(!a.days||typeof a.days!=='object')a.days={};return a;
  }
  function pruneAggregate(a){
    const cutoff=Date.now()-MAX_DAYS*DAY_MS;
    Object.keys(a.days||{}).forEach(k=>{const t=Date.parse(k+'T12:00:00');if(Number.isFinite(t)&&t<cutoff)delete a.days[k]});
  }
  function recordTap(key){
    const a=ensureAggregate(),dk=dayKey(),h=String(hour());
    const d=a.days[dk]||(a.days[dk]={taps:{},hours:{},screens:{},firstAt:Date.now(),lastAt:Date.now()});
    d.taps[key]=(d.taps[key]||0)+1;d.hours[h]=(d.hours[h]||0)+1;d.screens[currentScreen()]=(d.screens[currentScreen()]||0)+1;d.lastAt=Date.now();
    pruneAggregate(a);save(AGG_KEY,a);
    const b=load(BUFFER_KEY,{counts:{},startedAt:Date.now()});b.counts[key]=(b.counts[key]||0)+1;b.screen=currentScreen();save(BUFFER_KEY,b);
  }
  document.addEventListener('pointerup',e=>{if(e.target?.closest?.('input,textarea'))return;recordTap(classify(e.target))},true);

  function flushUsage(){
    const b=load(BUFFER_KEY,{counts:{},startedAt:Date.now()});const keys=Object.keys(b.counts||{});if(!keys.length)return;
    log('ui_usage_summary',{counts:b.counts,screen:b.screen||currentScreen(),hour:hour(),windowMs:Date.now()-Number(b.startedAt||Date.now())});
    save(BUFFER_KEY,{counts:{},startedAt:Date.now()});
  }
  setInterval(flushUsage,FLUSH_MS);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushUsage()});
  window.addEventListener('pagehide',flushUsage);

  function aggregateTapCounts(days=30){
    const a=ensureAggregate(),cut=Date.now()-days*DAY_MS,out={};
    Object.entries(a.days||{}).forEach(([k,d])=>{const t=Date.parse(k+'T12:00:00');if(!Number.isFinite(t)||t<cut)return;Object.entries(d.taps||{}).forEach(([key,n])=>out[key]=(out[key]||0)+Number(n||0))});return out;
  }
  function observedDays(days=30){
    const set=new Set(rows(days).map(x=>dayKey(x.at)));const a=ensureAggregate(),cut=Date.now()-days*DAY_MS;Object.keys(a.days||{}).forEach(k=>{const t=Date.parse(k+'T12:00:00');if(Number.isFinite(t)&&t>=cut)set.add(k)});return set.size;
  }
  function topCompletionHour(days=30){
    const r=rows(days).filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type));const b={};r.forEach(x=>b[hour(x.at)]=(b[hour(x.at)]||0)+1);let best=null,n=0;Object.entries(b).forEach(([h,c])=>{if(c>n){best=Number(h);n=c}});return{hour:best,count:n};
  }
  function activeMsToday(){return todayRows().filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.activeMs||0),0)}

  function dayScore(){
    const r=todayRows();const td=count(r,'todo_complete'),to=count(r,'todo_open'),ld=count(r,'tube_complete'),lo=count(r,'tube_card_open'),gd=count(r,'gym_complete'),gs=count(r,'gym_start');
    const task=Math.min(35,td*10+(td?5:0)+(to?10*td/Math.max(1,to):0));
    const learn=Math.min(25,ld*15+(ld?10:0));
    const move=gd?20:(gs?8:0);
    const meaningful=td+ld+gd;const intent=Math.min(20,meaningful?8+meaningful*4:0);
    return{score:Math.round(task+learn+move+intent),task:Math.round(task),learn:Math.round(learn),move:Math.round(move),intent:Math.round(intent),td,to,ld,lo,gd,gs,meaningful};
  }

  function model(){
    const r=rows(30),tap=aggregateTapCounts(30),days=Math.max(1,observedDays(30));
    const td=count(r,'todo_complete'),to=count(r,'todo_open'),ta=count(r,'todo_add');
    const ld=count(r,'tube_complete'),lo=count(r,'tube_card_open');
    const gd=count(r,'gym_complete'),gs=count(r,'gym_start');
    const meaningful=td+ld+gd;
    const follow=clamp(100*(meaningful/Math.max(1,to+lo+gs)),0,100);
    const initiative=clamp(18*ta+8*td+Math.min(30,meaningful*3),0,100);
    const learning=clamp(ld*13+(lo?30*ld/Math.max(1,lo):0),0,100);
    const movement=clamp(gd*24+gs*7,0,100);
    const curiosity=clamp(lo*7+(tap.home_tube||0)*3,0,100);
    const planning=clamp((tap.home_calendar||0)*7+(tap.home_todos||0)*3+to*2,0,100);
    const completionDays={};r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type)).forEach(x=>{const k=dayKey(x.at);completionDays[k]=(completionDays[k]||new Set());completionDays[k].add(x.type.split('_')[0])});
    const balanced=Object.values(completionDays).filter(s=>s.size>=2).length;
    const routine=clamp((Object.keys(completionDays).length/days)*65+(balanced/days)*35,0,100);
    const summaries=r.filter(x=>x.type==='behavior_summary');const active=summaries.reduce((s,x)=>s+Number(x.data?.activeMs||0),0);const taps=summaries.reduce((s,x)=>s+Number(x.data?.taps||0),0);
    const focus=clamp(meaningful*7 + Math.min(40,active/60000/5) - Math.max(0,taps-meaningful*12)*.25,0,100);
    const avoidance=clamp((to>=3?(1-td/Math.max(1,to))*75:20)+(lo>=4?(1-ld/Math.max(1,lo))*20:0),0,100);
    const friction=clamp(15+avoidance*.45+(to>=4&&td===0?20:0),0,100);
    const events=r.length;const confidence=clamp((Math.min(1,events/100)*.55+Math.min(1,days/14)*.45)*100,0,100);
    const nodes=[
      {id:'initiative',label:'Initiative',value:initiative,desc:'How often you initiate useful action instead of only consuming or planning.'},
      {id:'focus',label:'Focus',value:focus,desc:'Sustained intentional HOME use relative to scattered interaction.'},
      {id:'follow',label:'Follow-through',value:follow,desc:'How reliably opens and starts become completed actions.'},
      {id:'learning',label:'Learning',value:learning,desc:'Completed learning relative to opened learning content.'},
      {id:'movement',label:'Movement',value:movement,desc:'Actual training starts and completed sessions.'},
      {id:'routine',label:'Routine',value:routine,desc:'How consistently meaningful actions repeat across days and domains.'},
      {id:'curiosity',label:'Curiosity',value:curiosity,desc:'How strongly you explore learning material and new information.'},
      {id:'planning',label:'Planning',value:planning,desc:'Calendar and task-orientation behaviour.'},
      {id:'avoidance',label:'Avoidance',value:avoidance,negative:true,desc:'Repeated opening without completion. Higher means more friction is showing up.'},
      {id:'friction',label:'Friction',value:friction,negative:true,desc:'Signals that the current interface or task framing may be asking too much.'}
    ];
    const edges=[
      ['initiative','follow',Math.min(initiative,follow),'Action becomes completion'],['focus','follow',Math.min(focus,follow),'Focus supports follow-through'],['curiosity','learning',Math.min(curiosity,learning),'Exploration becomes learning'],['planning','initiative',Math.min(planning,initiative),'Plans become starts'],['routine','movement',Math.min(routine,movement),'Routine supports movement'],['routine','follow',Math.min(routine,follow),'Consistency supports completion'],['avoidance','friction',Math.min(avoidance,friction),'Friction and avoidance reinforce each other'],['focus','learning',Math.min(focus,learning),'Focused sessions support learning']
    ];
    return{nodes,edges,confidence,events,days,tap,td,to,ld,lo,gd,gs,activeMs:active};
  }

  function adaptationReasons(m){
    const out=[];const best=topCompletionHour(30);const todoRate=pct(m.td,m.to),learnRate=pct(m.ld,m.lo);
    const todoDensity=document.documentElement.dataset.behaviourTodoDensity||document.getElementById('todoList')?.dataset.layout||'normal';
    const tubeLayout=document.documentElement.dataset.flexTubeLayout||document.getElementById('grid')?.dataset.layout||'stack';
    if(m.to>=4&&todoRate<45)out.push({title:'To-dos: reduce the starting barrier',text:`Only ${todoRate}% of opened tasks became completions recently. HOME is therefore justified in surfacing fewer, more concrete next actions rather than adding more information.`});
    else if(m.td>=3)out.push({title:'To-dos: preserve momentum',text:`Task follow-through is currently ${todoRate||100}%. HOME can keep useful tasks visible without over-simplifying the list.`});
    if(m.lo>=4&&learnRate<55)out.push({title:'Learning: less generic, more specific',text:`${learnRate}% of opened learning items were completed. HOME should favour concrete prompts tied directly to the article or your own projects, and reduce generic meta-questions.`});
    else if(m.ld>=2)out.push({title:'Learning: keep testing transfer',text:`You are completing learning items at ${learnRate||100}%. HOME can increasingly test recall, application and delayed retention rather than only recognition.`});
    if(best.hour!==null)out.push({title:'Timing: use your productive window',text:`Your strongest completion cluster is currently around ${String(best.hour).padStart(2,'0')}:00. HOME can place higher-value actions near that window and use quieter surfaces outside it.`});
    if(m.gd===0&&m.days>=3)out.push({title:'Gym: make starting easier',text:'No completed gym session is visible in the recent behaviour sample yet. HOME should keep the entry step small and test which kind of prompt actually creates movement.'});
    out.push({title:'Current interface evidence',text:`To-do mode: ${todoDensity}. Tube mode: ${tubeLayout}. These are provisional choices; HOME should change them when your behaviour shows a better direction.`});
    return out.slice(0,5);
  }

  function ensureStyle(){
    if(document.getElementById('homeBehaviourMapStyle'))return;
    const s=document.createElement('style');s.id='homeBehaviourMapStyle';s.textContent=`
      #homeDayScorePill{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.075);color:#fff;border-radius:14px;padding:7px 10px;display:flex;flex-direction:column;align-items:flex-end;gap:1px;min-width:62px;cursor:pointer}
      #homeDayScorePill small{font-size:8px;letter-spacing:.13em;opacity:.56;font-weight:850}#homeDayScorePill b{font-size:16px;line-height:1;font-weight:850}.homeMomentumRight{align-items:center}.homeMomentum{cursor:default}
      #behaviourInsightScreen{background:#090b0f;color:#f6f7fb;min-height:100vh;overflow-x:hidden}.biTop{position:sticky;top:0;z-index:20;padding:max(13px,env(safe-area-inset-top)) 18px 13px;display:flex;align-items:center;gap:13px;background:linear-gradient(180deg,rgba(9,11,15,.98),rgba(9,11,15,.88),rgba(9,11,15,0));backdrop-filter:blur(14px)}
      .biBack{width:40px;height:40px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:rgba(255,255,255,.06);color:#fff;font-size:24px}.biTopText{flex:1}.biEyebrow{font-size:9px;letter-spacing:.16em;font-weight:850;opacity:.46}.biTop h1{font-size:20px;margin:3px 0 0;letter-spacing:-.02em}.biConfidence{font-size:10px;color:#a9b0be;text-align:right}.biPad{padding:8px 18px 36px}.biHero{border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:20px;background:radial-gradient(circle at 82% 12%,rgba(111,137,255,.18),transparent 34%),linear-gradient(145deg,#141923,#0d1016);box-shadow:0 22px 55px rgba(0,0,0,.35)}
      .biScoreRow{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.biScoreLabel{font-size:10px;letter-spacing:.14em;font-weight:850;opacity:.52}.biScore{font-size:56px;line-height:.9;font-weight:900;letter-spacing:-.055em}.biScore small{font-size:16px;opacity:.38;letter-spacing:0}.biStage{font-size:12px;color:#bbc2d0;max-width:150px;text-align:right;line-height:1.4}.biMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:18px}.biMetric{padding:10px 8px;border:1px solid rgba(255,255,255,.075);border-radius:15px;background:rgba(255,255,255,.035)}.biMetric b{display:block;font-size:16px}.biMetric span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.08em;opacity:.45;margin-top:3px}
      .biSection{margin-top:24px}.biSectionHead{display:flex;align-items:flex-end;justify-content:space-between;margin:0 2px 10px}.biSectionHead h2{font-size:18px;margin:0}.biSectionHead p{font-size:10px;color:#7f8795;margin:0}.biNetwork{position:relative;border:1px solid rgba(255,255,255,.09);border-radius:27px;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(95,110,180,.12),transparent 38%),#0c0f15;box-shadow:inset 0 0 70px rgba(0,0,0,.35)}#behaviourCanvas{display:block;width:100%;height:430px;touch-action:none}.biNetworkHint{position:absolute;left:14px;top:12px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#6f7888;pointer-events:none}.biNetworkHint b{color:#b6c4ff}.biNodeDetail{min-height:82px;border-top:1px solid rgba(255,255,255,.07);padding:13px 15px 15px;background:rgba(255,255,255,.025)}.biNodeDetail b{font-size:14px}.biNodeDetail span{font-size:11px;line-height:1.45;color:#9ca5b4;display:block;margin-top:4px}.biNodeValue{float:right;color:#c9d5ff!important;font-weight:850}
      .biPatternGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.biPattern{border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:13px;background:#101319}.biPattern small{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#697281}.biPattern b{display:block;font-size:15px;margin-top:5px;line-height:1.25}.biPattern span{font-size:10px;color:#88919f;display:block;margin-top:4px}.biWhy{display:grid;gap:9px}.biWhyItem{border:1px solid rgba(255,255,255,.075);border-radius:19px;padding:14px 15px;background:#101319}.biWhyItem b{font-size:13px}.biWhyItem p{font-size:11px;line-height:1.5;color:#9ba4b2;margin:6px 0 0}.biFoot{font-size:10px;line-height:1.55;color:#636c79;margin:20px 3px 0}
    `;document.head.appendChild(s);
  }

  function ensureScreen(){
    ensureStyle();let s=document.getElementById('behaviourInsightScreen');if(s)return s;
    const host=document.querySelector('.app')||document.body;s=document.createElement('section');s.className='screen';s.id='behaviourInsightScreen';
    s.innerHTML=`<div class="biTop"><button id="behaviourBack" class="biBack">‹</button><div class="biTopText"><div class="biEyebrow">LIVING BEHAVIOUR MODEL</div><h1>Your HOME intelligence</h1></div><div class="biConfidence" id="biConfidence"></div></div><div class="biPad"><div class="biHero"><div class="biScoreRow"><div><div class="biScoreLabel">TODAY SCORE</div><div class="biScore" id="biScore">—<small>/100</small></div></div><div class="biStage" id="biStage">Still learning your patterns.</div></div><div class="biMetrics" id="biMetrics"></div></div><div class="biSection"><div class="biSectionHead"><h2>Your behaviour map</h2><p>drag · pinch · tap</p></div><div class="biNetwork"><canvas id="behaviourCanvas"></canvas><div class="biNetworkHint"><b>LIVE MODEL</b> · stronger links = more evidence</div><div class="biNodeDetail" id="biNodeDetail"><b>Touch a node</b><span>HOME will explain what the pattern means and what evidence it is based on.</span></div></div></div><div class="biSection"><div class="biSectionHead"><h2>What HOME sees</h2><p>recent behaviour</p></div><div class="biPatternGrid" id="biPatterns"></div></div><div class="biSection"><div class="biSectionHead"><h2>Why HOME adapted</h2><p>transparent AI</p></div><div class="biWhy" id="biWhy"></div></div><div class="biFoot">This model is descriptive, not a diagnosis. Early patterns stay deliberately weak. HOME increases confidence only when the same behaviour repeats across enough sessions and days.</div></div>`;
    host.appendChild(s);document.getElementById('behaviourBack').onclick=closeInsights;setupCanvas();return s;
  }

  function renderInsights(){
    ensureScreen();const d=dayScore(),m=model(),best=topCompletionHour(30);const a=ensureAggregate().days[dayKey()]||{taps:{}};const top=Object.entries(a.taps||{}).sort((x,y)=>y[1]-x[1]).slice(0,2);
    document.getElementById('biScore').innerHTML=`${d.score}<small>/100</small>`;
    document.getElementById('biConfidence').textContent=`${Math.round(m.confidence)}% model confidence\n${m.days} days observed`;
    document.getElementById('biStage').textContent=m.confidence<25?'Early model — HOME is collecting evidence.':m.confidence<55?'Patterns are beginning to repeat.':'Enough evidence to make stronger interface experiments.';
    document.getElementById('biMetrics').innerHTML=`<div class="biMetric"><b>${d.td}</b><span>tasks done</span></div><div class="biMetric"><b>${d.ld}</b><span>learned</span></div><div class="biMetric"><b>${d.gd}</b><span>workouts</span></div><div class="biMetric"><b>${fmtMinutes(activeMsToday())}</b><span>active</span></div>`;
    const patterns=[
      {k:'Best action window',v:best.hour===null?'Learning…':`${String(best.hour).padStart(2,'0')}:00`,s:best.count?`${best.count} recent completions in this hour`:'Need more completions'},
      {k:'Task follow-through',v:m.to?`${pct(m.td,m.to)}%`:'Learning…',s:`${m.td} completions · ${m.to} opens`},
      {k:'Learning conversion',v:m.lo?`${pct(m.ld,m.lo)}%`:'Learning…',s:`${m.ld} completions · ${m.lo} opens`},
      {k:'Most tapped today',v:top[0]?top[0][0].replace(/_/g,' '):'Learning…',s:top[0]?`${top[0][1]} taps today`:'No stable pattern yet'}
    ];
    document.getElementById('biPatterns').innerHTML=patterns.map(x=>`<div class="biPattern"><small>${esc(x.k)}</small><b>${esc(x.v)}</b><span>${esc(x.s)}</span></div>`).join('');
    document.getElementById('biWhy').innerHTML=adaptationReasons(m).map(x=>`<div class="biWhyItem"><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`).join('');
    networkState.model=m;networkState.selected=null;drawNetwork();
  }

  function ensureScorePill(){
    ensureStyle();const right=document.querySelector('#homeMomentum .homeMomentumRight');if(!right)return;
    let b=document.getElementById('homeDayScorePill');if(!b){b=document.createElement('button');b.id='homeDayScorePill';b.type='button';b.setAttribute('aria-label','Open behaviour intelligence');right.prepend(b);b.onclick=e=>{e.stopPropagation();openInsights()}}
    const d=dayScore();b.innerHTML=`<small>DAY SCORE</small><b>${d.score}</b>`;
  }

  function openInsights(){
    flushUsage();ensureScreen();document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));document.getElementById('behaviourInsightScreen').classList.add('show');try{window.currentScreen='behaviourInsight'}catch(e){}window.scrollTo(0,0);renderInsights();log('insights_open',{confidence:Math.round(model().confidence),days:observedDays(30)});
  }
  function closeInsights(){if(typeof window.showScreen==='function')window.showScreen('home');else{document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));document.getElementById('homeScreen')?.classList.add('show')}window.scrollTo(0,0);ensureScorePill()}
  window.openHOMEBehaviourIntelligence=openInsights;

  const pos={initiative:[-1.25,.35,.5],focus:[-.15,1.15,.15],follow:[.75,.45,.8],learning:[1.18,-.55,.2],movement:[.15,-1.3,.5],routine:[-.9,-.85,-.3],curiosity:[1.05,.72,-.7],planning:[-1.2,.85,-.75],avoidance:[-.35,-.1,-1.2],friction:[.55,-.2,-1.0]};
  const networkState={rx:-.2,ry:.35,zoom:1,model:null,selected:null,projected:[],pointers:new Map(),dragged:false,lastDist:0};
  let canvas,ctx,raf=0;
  function projectPoint(p,w,h){
    let[x,y,z]=p;const cy=Math.cos(networkState.ry),sy=Math.sin(networkState.ry),cx=Math.cos(networkState.rx),sx=Math.sin(networkState.rx);let x1=x*cy+z*sy,z1=-x*sy+z*cy,y1=y*cx-z1*sx,z2=y*sx+z1*cx;const perspective=3.4/(3.4-z2*.55);const scale=Math.min(w,h)*.23*networkState.zoom*perspective;return{x:w/2+x1*scale,y:h/2+y1*scale,z:z2,scale:perspective}}
  function resizeCanvas(){if(!canvas)return;const r=canvas.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.setTransform(d,0,0,d,0,0)}
  function drawNetwork(){
    if(!canvas||!ctx)return;resizeCanvas();const w=canvas.clientWidth,h=canvas.clientHeight,m=networkState.model||model();ctx.clearRect(0,0,w,h);networkState.projected=[];
    const points={};m.nodes.forEach(n=>points[n.id]=projectPoint(pos[n.id]||[0,0,0],w,h));
    m.edges.forEach(([a,b,strength])=>{const A=points[a],B=points[b],alpha=(.05+.32*(strength/100))*(.25+.75*m.confidence/100);ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineWidth=.6+2.4*(strength/100);ctx.strokeStyle=`rgba(126,151,255,${alpha.toFixed(3)})`;ctx.stroke()});
    const ordered=[...m.nodes].sort((a,b)=>points[a.id].z-points[b.id].z);ordered.forEach(n=>{const p=points[n.id],selected=networkState.selected===n.id,r=(7+14*n.value/100)*p.scale;const alpha=.24+.7*(m.confidence/100);ctx.save();ctx.shadowBlur=selected?24:12;ctx.shadowColor=n.negative?'rgba(255,140,120,.6)':'rgba(130,160,255,.7)';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=n.negative?`rgba(215,111,94,${Math.min(.9,alpha)})`:`rgba(115,143,231,${Math.min(.9,alpha)})`;ctx.fill();ctx.lineWidth=selected?2:1;ctx.strokeStyle=selected?'rgba(255,255,255,.9)':'rgba(255,255,255,.28)';ctx.stroke();ctx.restore();ctx.font=`${selected?'700':'600'} ${Math.max(9,10*p.scale)}px system-ui`;ctx.textAlign='center';ctx.fillStyle=`rgba(235,240,255,${.45+.5*m.confidence/100})`;ctx.fillText(n.label,p.x,p.y+r+14);networkState.projected.push({id:n.id,x:p.x,y:p.y,r:r+10})});
    if(document.getElementById('behaviourInsightScreen')?.classList.contains('show'))raf=requestAnimationFrame(drawNetwork)
  }
  function setupCanvas(){
    canvas=document.getElementById('behaviourCanvas');if(!canvas||canvas.__homeMapReady)return;canvas.__homeMapReady=true;ctx=canvas.getContext('2d');
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture?.(e.pointerId);networkState.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY});networkState.dragged=false;if(networkState.pointers.size===2){const v=[...networkState.pointers.values()];networkState.lastDist=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y)}});
    canvas.addEventListener('pointermove',e=>{const p=networkState.pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;const arr=[...networkState.pointers.values()];if(arr.length===1){const dx=p.x-p.px,dy=p.y-p.py;if(Math.abs(dx)+Math.abs(dy)>2)networkState.dragged=true;networkState.ry+=dx*.009;networkState.rx=clamp(networkState.rx+dy*.007,-1.15,1.15);p.px=p.x;p.py=p.y}else if(arr.length===2){const dist=Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y);if(networkState.lastDist>0)networkState.zoom=clamp(networkState.zoom*(dist/networkState.lastDist),.7,1.8);networkState.lastDist=dist;networkState.dragged=true}});
    const end=e=>{const p=networkState.pointers.get(e.pointerId);networkState.pointers.delete(e.pointerId);networkState.lastDist=0;if(!networkState.dragged&&p){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let hit=null,dist=Infinity;networkState.projected.forEach(n=>{const d=Math.hypot(x-n.x,y-n.y);if(d<n.r&&d<dist){hit=n;dist=d}});if(hit)selectNode(hit.id)}networkState.dragged=false};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);window.addEventListener('resize',resizeCanvas);
  }
  function selectNode(id){
    const m=networkState.model||model(),n=m.nodes.find(x=>x.id===id);if(!n)return;networkState.selected=id;const detail=document.getElementById('biNodeDetail');if(detail)detail.innerHTML=`<b>${esc(n.label)} <span class="biNodeValue">${Math.round(n.value)}/100</span></b><span>${esc(n.desc)} Current model confidence: ${Math.round(m.confidence)}%.</span>`;log('insights_node_open',{node:id,value:Math.round(n.value),confidence:Math.round(m.confidence)})
  }

  function patchBack(){
    if(window.handleAndroidBack?.__behaviourMapV1)return;const base=window.handleAndroidBack;const w=function(){if(document.getElementById('behaviourInsightScreen')?.classList.contains('show')){closeInsights();return'handled'}return typeof base==='function'?base.apply(this,arguments):'home'};w.__behaviourMapV1=true;window.handleAndroidBack=w;
  }
  function refresh(){ensureScorePill();ensureScreen();patchBack();if(document.getElementById('behaviourInsightScreen')?.classList.contains('show'))renderInsights()}
  window.HOMEBehaviourIntelligence={version:VERSION,open:openInsights,refresh,model,dayScore};
  refresh();setTimeout(refresh,600);setTimeout(refresh,1800);setInterval(ensureScorePill,30000);log('behaviour_intelligence_ready',{version:VERSION});
})();
