/* HOME Behaviour Intelligence v3 — make the visible Today's Quest card itself the Day Score entry point. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_MAP_V3__) return;
  window.__HOME_BEHAVIOUR_MAP_V3__=true;

  const ACT='homeAdaptiveActivityV1';
  const TAP='homeBehaviourTapV3';
  const DAY=86400000;
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const clamp=(n,a=0,b=100)=>Math.min(b,Math.max(a,Number(n)||0));
  const rows=(days=30)=>{const v=load(ACT,[]),since=Date.now()-days*DAY;return Array.isArray(v)?v.filter(x=>Number(x?.at||0)>=since):[]};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const today=()=>{const k=dayKey();return rows(2).filter(x=>dayKey(x.at)===k)};
  const count=(r,t)=>r.filter(x=>x.type===t).length;
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const fmtMin=ms=>{const m=Math.max(0,Math.round((Number(ms)||0)/60000));return m<60?`${m}m`:`${Math.floor(m/60)}h ${m%60}m`};
  const hour=t=>new Date(t||Date.now()).getHours();

  function activeMs(r){return r.filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.activeMs||0),0)}
  function score(){
    const r=today(),td=count(r,'todo_complete'),ld=count(r,'tube_complete'),gd=count(r,'gym_complete'),to=count(r,'todo_open'),lo=count(r,'tube_card_open'),gs=count(r,'gym_start');
    const task=Math.min(35,td*10+(td?5:0));
    const learn=Math.min(25,ld*15+(ld?10:0));
    const move=gd?20:(gs?8:0);
    const follow=Math.min(20,(td+ld+gd)*5);
    return{score:Math.round(task+learn+move+follow),td,ld,gd,to,lo,gs,active:activeMs(r)};
  }

  function tapCounts(days=30){
    const a=load(TAP,{days:{}}),since=Date.now()-days*DAY,out={};
    Object.entries(a.days||{}).forEach(([k,d])=>{if(Date.parse(k+'T12:00:00')<since)return;Object.entries(d.counts||{}).forEach(([x,n])=>out[x]=(out[x]||0)+Number(n||0))});
    return out;
  }
  function observedDays(days=30){const s=new Set(rows(days).map(x=>dayKey(x.at)));return Math.max(1,s.size)}
  function model(){
    const r=rows(30),t=tapCounts(30),days=observedDays(30);
    const td=count(r,'todo_complete'),to=count(r,'todo_open'),ta=count(r,'todo_add'),ld=count(r,'tube_complete'),lo=count(r,'tube_card_open'),gd=count(r,'gym_complete'),gs=count(r,'gym_start');
    const meaningful=td+ld+gd;
    const follow=clamp(100*meaningful/Math.max(1,to+lo+gs));
    const initiative=clamp(ta*15+td*7+meaningful*2);
    const learning=clamp(ld*15+(lo?35*ld/Math.max(1,lo):0));
    const movement=clamp(gd*28+gs*8);
    const curiosity=clamp(lo*7+(t.home_tube||0)*4);
    const planning=clamp((t.home_calendar||0)*8+(t.home_todos||0)*4+to*2);
    const doneDays=new Set(r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type)).map(x=>dayKey(x.at))).size;
    const routine=clamp(100*doneDays/days);
    const active=activeMs(r),allTaps=r.filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.taps||0),0);
    const focus=clamp(meaningful*7+Math.min(40,active/300000)-Math.max(0,allTaps-meaningful*14)*.15);
    const avoidance=clamp((to>=3?(1-td/Math.max(1,to))*70:18)+(lo>=4?(1-ld/Math.max(1,lo))*20:0));
    const friction=clamp(12+avoidance*.5+(to>=4&&td===0?20:0));
    const confidence=clamp((Math.min(1,r.length/120)*.55+Math.min(1,days/14)*.45)*100);
    const nodes=[
      ['initiative','Initiative',initiative,'How often you start useful action instead of only consuming or planning.'],
      ['focus','Focus',focus,'How sustained and intentional your HOME use appears.'],
      ['follow','Follow-through',follow,'How often starts become completed actions.'],
      ['learning','Learning',learning,'Completed learning relative to opened learning material.'],
      ['movement','Movement',movement,'Actual gym starts and completed sessions.'],
      ['routine','Routine',routine,'How consistently meaningful actions repeat across days.'],
      ['curiosity','Curiosity',curiosity,'How strongly you explore learning material.'],
      ['planning','Planning',planning,'Calendar and task-orientation behaviour.'],
      ['avoidance','Avoidance',avoidance,'Repeated opening without completion. Higher means more resistance is showing up.',true],
      ['friction','Friction',friction,'Signals that the current interface or task framing may be asking too much.',true]
    ].map(x=>({id:x[0],label:x[1],value:Math.round(x[2]),desc:x[3],negative:!!x[4]}));
    const edges=[['initiative','follow'],['focus','follow'],['curiosity','learning'],['planning','initiative'],['routine','movement'],['routine','follow'],['avoidance','friction'],['focus','learning']];
    return{nodes,edges,confidence:Math.round(confidence),events:r.length,days,td,to,ld,lo,gd,gs,active};
  }

  function strongestHour(){
    const r=rows(30).filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type)),b={};
    r.forEach(x=>b[hour(x.at)]=(b[hour(x.at)]||0)+1);let h=null,n=0;
    Object.entries(b).forEach(([k,v])=>{if(v>n){h=Number(k);n=v}});return h;
  }
  function reasons(m){
    const out=[],tr=m.to?Math.round(100*m.td/m.to):0,lr=m.lo?Math.round(100*m.ld/m.lo):0,h=strongestHour();
    if(m.to>=4&&tr<45)out.push(['To-dos',`Opened tasks convert at ${tr}%. HOME should surface fewer, smaller next actions and make delayed tasks harder to ignore.`]);
    else if(m.td>=3)out.push(['To-dos',`Task follow-through is ${tr||100}%. HOME can preserve the current action-first structure.`]);
    if(m.lo>=4&&lr<55)out.push(['Learning',`Only ${lr}% of opened learning items were completed. HOME should favour concrete article/project-specific prompts over generic meta-questions.`]);
    else if(m.ld>=2)out.push(['Learning',`Learning completion is ${lr||100}%. HOME can gradually test more recall and real application.`]);
    if(h!==null)out.push(['Timing',`Your strongest completion cluster is around ${String(h).padStart(2,'0')}:00. HOME can place higher-value actions closer to that window.`]);
    if(m.gd===0&&m.days>=3)out.push(['Movement','No recent completed gym session is visible yet. HOME should reduce the starting barrier instead of merely repeating the same Gym card.']);
    out.push(['Interface','Current HOME choices are provisional and should change whenever measured follow-through shows a better direction.']);
    return out.slice(0,5);
  }

  function style(){
    if(document.getElementById('hbV3Style'))return;
    const s=document.createElement('style');s.id='hbV3Style';s.textContent=`
      [data-home-behaviour-card="1"]{cursor:pointer!important;position:relative!important}
      .hbQuestHint{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,211,111,.32);background:rgba(255,197,70,.10);color:#ffd978;font-size:9px!important;line-height:1!important;letter-spacing:.08em!important;font-weight:800!important;vertical-align:middle;white-space:nowrap}
      #homeBehaviourOverlayV3{position:fixed!important;inset:0!important;z-index:2147483000!important;background:#080a0e!important;color:#f7f8fb!important;display:none;overflow:auto!important;-webkit-overflow-scrolling:touch!important}
      #homeBehaviourOverlayV3.show{display:block!important}
      .hb3Top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:max(15px,env(safe-area-inset-top)) 18px 12px;background:rgba(8,10,14,.94);backdrop-filter:blur(18px)}
      .hb3Back{width:42px;height:42px;border:1px solid rgba(255,255,255,.09);border-radius:21px;background:#151821;color:#fff;font-size:27px;display:grid;place-items:center;padding:0}.hb3Top small{display:block;opacity:.48;font-size:9px;letter-spacing:.15em;font-weight:800}.hb3Top h1{font-size:20px;margin:1px 0 0}
      .hb3Body{padding:8px 16px 42px;max-width:760px;margin:auto}.hb3Hero{display:grid;grid-template-columns:108px 1fr;gap:16px;align-items:center;padding:14px 0}.hb3Score{width:104px;height:104px;border-radius:54px;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 35% 28%,rgba(132,156,255,.26),rgba(255,255,255,.03) 58%);display:grid;place-items:center;text-align:center}.hb3Score b{font-size:38px}.hb3Score span{font-size:9px;opacity:.52;letter-spacing:.14em}.hb3Hero h2{margin:0 0 5px;font-size:24px;line-height:1.06}.hb3Hero p{margin:0;font-size:12.5px;line-height:1.45;opacity:.62}
      .hb3Confidence{height:7px;background:#171b23;border-radius:6px;overflow:hidden;margin-top:9px}.hb3Confidence i{display:block;height:100%;background:linear-gradient(90deg,#7f98ff,#c7d1ff);border-radius:6px}
      .hb3Metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 15px}.hb3Metric{padding:12px 6px;border:1px solid rgba(255,255,255,.075);background:#0f1218;border-radius:16px;text-align:center}.hb3Metric b{display:block;font-size:18px}.hb3Metric span{font-size:8px;letter-spacing:.08em;opacity:.48}
      .hb3Card{border:1px solid rgba(255,255,255,.075);background:#0e1117;border-radius:22px;padding:16px;margin:12px 0}.hb3Card h3{font-size:17px;margin:0 0 3px}.hb3Sub{font-size:10px;opacity:.47;margin-bottom:11px}.hb3Network{height:370px;border-radius:18px;background:radial-gradient(circle at 50% 48%,rgba(87,107,192,.20),rgba(7,9,13,.2) 56%,#07090d);overflow:hidden;touch-action:none}.hb3Network svg{width:100%;height:100%;display:block}.hb3Edge{stroke:rgba(156,174,255,.24);stroke-width:1.3}.hb3Node circle{fill:#151b29;stroke:rgba(178,191,255,.58);stroke-width:1.2}.hb3Node.neg circle{stroke:rgba(255,166,132,.58)}.hb3Node text{fill:#f7f8fc;font-size:10px;text-anchor:middle;pointer-events:none}.hb3Node .val{font-size:12px;font-weight:850}.hb3Detail,.hb3Reason{margin-top:10px;padding:12px 13px;border-radius:14px;background:#151922}.hb3Detail b,.hb3Reason b{font-size:12px}.hb3Detail p,.hb3Reason p{margin:4px 0 0;font-size:12px;line-height:1.45;opacity:.64}.hb3Why{display:grid;gap:8px}
    `;document.head.appendChild(s);
  }

  function questLabel(){
    const home=document.getElementById('homeScreen')||document.body;
    const els=[...home.querySelectorAll('*')];
    return els.find(el=>{const t=(el.textContent||'').trim().toUpperCase();return (t==="TODAY'S QUEST"||t==='TODAYS QUEST') && el.children.length===0}) || els.find(el=>(el.textContent||'').toUpperCase().includes("TODAY'S QUEST"));
  }
  function findQuestCard(){
    const label=questLabel();if(!label)return null;
    let el=label;
    for(let i=0;i<7&&el;i++,el=el.parentElement){
      const r=el.getBoundingClientRect?.();
      if(r&&r.width>260&&r.height>170&&r.height<700)return el;
    }
    return label.parentElement;
  }
  function wireQuest(){
    style();const card=findQuestCard();if(!card)return false;
    card.dataset.homeBehaviourCard='1';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','Open Behaviour Intelligence');
    const label=questLabel();if(label&&!label.querySelector('.hbQuestHint')){const h=document.createElement('span');h.className='hbQuestHint';h.textContent=`DAY SCORE ${score().score} ↗`;label.appendChild(h)}
    else{const h=label?.querySelector('.hbQuestHint');if(h)h.textContent=`DAY SCORE ${score().score} ↗`}
    return true;
  }

  function ensureOverlay(){
    style();let o=document.getElementById('homeBehaviourOverlayV3');if(o)return o;
    o=document.createElement('div');o.id='homeBehaviourOverlayV3';o.innerHTML='<div class="hb3Top"><button class="hb3Back" type="button" aria-label="Back">‹</button><div><small>BEHAVIOUR INTELLIGENCE</small><h1>Your living model</h1></div></div><div class="hb3Body" id="hb3Body"></div>';
    document.body.appendChild(o);o.querySelector('.hb3Back').onclick=closeOverlay;return o;
  }

  function render(){
    const s=score(),m=model(),o=ensureOverlay(),why=reasons(m),body=o.querySelector('#hb3Body');
    body.innerHTML=`<div class="hb3Hero"><div class="hb3Score"><div><b>${s.score}</b><br><span>TODAY</span></div></div><div><h2>Your behaviour, made visible.</h2><p>${m.days<3?'HOME is still learning you. Weak evidence stays weak.':'The model grows only when repeated behaviour supports a pattern.'}</p><div style="font-size:10px;opacity:.52;margin-top:9px">Model confidence ${m.confidence}%</div><div class="hb3Confidence"><i style="width:${m.confidence}%"></i></div></div></div>
    <div class="hb3Metrics"><div class="hb3Metric"><b>${s.td}</b><span>TASKS</span></div><div class="hb3Metric"><b>${s.ld}</b><span>LEARNING</span></div><div class="hb3Metric"><b>${s.gd}</b><span>GYM</span></div><div class="hb3Metric"><b>${fmtMin(s.active)}</b><span>ACTIVE</span></div></div>
    <div class="hb3Card"><h3>Living self-map</h3><div class="hb3Sub">Drag · pinch · tap a node</div><div class="hb3Network" id="hb3Network"></div><div class="hb3Detail" id="hb3Detail"><b>Explore a node</b><p>Each strand comes from observed HOME behaviour. It is not a personality diagnosis.</p></div></div>
    <div class="hb3Card"><h3>Why HOME adapted</h3><div class="hb3Sub">What your behaviour is currently changing</div><div class="hb3Why">${why.map(x=>`<div class="hb3Reason"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')}</div></div>
    <div class="hb3Card"><h3>Evidence</h3><div class="hb3Reason"><b>${m.events} behavioural events · ${m.days} observed day${m.days===1?'':'s'}</b><p>Button frequency and screen time diagnose friction; they do not count as success on their own.</p></div></div>`;
    drawNetwork(m);log('behaviour_insights_open',{score:s.score,confidence:m.confidence,days:m.days,events:m.events});
  }
  function openOverlay(){const o=ensureOverlay();render();o.classList.add('show');document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden'}
  function closeOverlay(){document.getElementById('homeBehaviourOverlayV3')?.classList.remove('show');document.documentElement.style.removeProperty('overflow');document.body.style.removeProperty('overflow');wireQuest()}

  function drawNetwork(m){
    const host=document.getElementById('hb3Network');if(!host)return;
    const W=600,H=420,cx=300,cy=205,n=m.nodes.length,pos={};
    m.nodes.forEach((node,i)=>{const ring=i<5?118:175,idx=i<5?i:i-5,total=i<5?5:5,a=-Math.PI/2+idx*(Math.PI*2/total)+(i>=5?.25:0);pos[node.id]={x:cx+Math.cos(a)*ring,y:cy+Math.sin(a)*ring}});
    const edgeHtml=m.edges.map(([a,b])=>`<line class="hb3Edge" x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}" style="opacity:${.10+.45*Math.min(m.nodes.find(x=>x.id===a)?.value||0,m.nodes.find(x=>x.id===b)?.value||0)/100}"></line>`).join('');
    const nodeHtml=m.nodes.map(n=>{const p=pos[n.id],r=15+Math.max(0,n.value)*.13,op=.28+.72*Math.max(.12,m.confidence/100);return `<g class="hb3Node ${n.negative?'neg':''}" data-node="${n.id}" transform="translate(${p.x} ${p.y})" style="opacity:${op}"><circle r="${r}"></circle><text y="-2">${n.label}</text><text class="val" y="13">${n.value}</text></g>`}).join('');
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><g id="hb3World">${edgeHtml}${nodeHtml}</g></svg>`;
    host.querySelectorAll('.hb3Node').forEach(g=>g.addEventListener('click',e=>{e.stopPropagation();const n=m.nodes.find(x=>x.id===g.dataset.node),d=document.getElementById('hb3Detail');if(n&&d)d.innerHTML=`<b>${n.label} · ${n.value}</b><p>${n.desc}</p>`}));
    const world=host.querySelector('#hb3World'),pts=new Map();let tx=0,ty=0,scale=1,lastDist=0,lastMid=null;
    const apply=()=>world.setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);
    host.addEventListener('pointerdown',e=>{host.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});lastMid=null;lastDist=0});
    host.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const old=pts.get(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const arr=[...pts.values()];if(arr.length===1){tx+=(e.clientX-old.x)*.8;ty+=(e.clientY-old.y)*.8}else if(arr.length>=2){const a=arr[0],b=arr[1],dist=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(lastDist>0)scale=clamp(scale*(dist/lastDist),.65,2.4);if(lastMid){tx+=(mid.x-lastMid.x)*.8;ty+=(mid.y-lastMid.y)*.8}lastDist=dist;lastMid=mid}apply()});
    const end=e=>{pts.delete(e.pointerId);lastDist=0;lastMid=null};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
  }

  function classify(el){
    if(el?.closest?.('[data-home-behaviour-card="1"]'))return'day_score';
    if(el?.closest?.('#homeBehaviourOverlayV3'))return'behaviour_insights';
    if(el?.closest?.('.homeCard.calendar'))return'home_calendar';if(el?.closest?.('.homeCard.todos'))return'home_todos';if(el?.closest?.('.homeCard.tube'))return'home_tube';if(el?.closest?.('.homeCard.gym'))return'home_gym';if(el?.closest?.('.todoCheck'))return'todo_complete_control';if(el?.closest?.('.todo'))return'todo_open';if(el?.closest?.('#grid .card'))return'tube_card';if(el?.closest?.('.option'))return'tube_option';if(el?.closest?.('#submit,.submit'))return'tube_submit';if(el?.closest?.('#next,.next'))return'tube_next';if(el?.closest?.('.gymExercise'))return'gym_exercise';if(el?.closest?.('.gymPrimary'))return'gym_action';if(el?.closest?.('button'))return'other_button';return'other';
  }
  function recordTap(kind){const a=load(TAP,{days:{}});a.days=a.days||{};const k=dayKey(),d=a.days[k]||(a.days[k]={counts:{},hours:{}});d.counts[kind]=(d.counts[kind]||0)+1;const h=String(hour());d.hours[h]=(d.hours[h]||0)+1;save(TAP,a)}

  document.addEventListener('pointerup',e=>{
    if(e.target?.closest?.('input,textarea'))return;
    recordTap(classify(e.target));
    const card=e.target?.closest?.('[data-home-behaviour-card="1"]');
    if(card&&!e.target.closest?.('a,input,textarea,select')){e.preventDefault();e.stopPropagation();openOverlay()}
  },true);
  document.addEventListener('keydown',e=>{const card=e.target?.closest?.('[data-home-behaviour-card="1"]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openOverlay()}});

  const baseBack=window.handleAndroidBack;
  window.handleAndroidBack=function(){if(document.getElementById('homeBehaviourOverlayV3')?.classList.contains('show')){closeOverlay();return'handled'}return typeof baseBack==='function'?baseBack.apply(this,arguments):'home'};

  style();wireQuest();ensureOverlay();
  setTimeout(wireQuest,300);setTimeout(wireQuest,900);setTimeout(wireQuest,1800);setTimeout(wireQuest,3500);
  const obs=new MutationObserver(()=>wireQuest());obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setInterval(wireQuest,10000);
  log('behaviour_map_ready',{version:3});
})();
