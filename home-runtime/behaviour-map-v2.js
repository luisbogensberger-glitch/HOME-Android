/* HOME Behaviour Intelligence v2 — robust Day Score + living self-model overlay. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_MAP_V2__) return;
  window.__HOME_BEHAVIOUR_MAP_V2__=true;

  const ACT='homeAdaptiveActivityV1', TAP='homeBehaviourTapV2';
  const DAY=86400000, MAX_TAP_DAYS=90;
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const clamp=(n,a=0,b=100)=>Math.min(b,Math.max(a,Number(n)||0));
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const hour=t=>new Date(t||Date.now()).getHours();
  const rows=(days=30)=>{const r=load(ACT,[]);const since=Date.now()-days*DAY;return Array.isArray(r)?r.filter(x=>Number(x?.at||0)>=since):[]};
  const today=()=>{const k=dayKey();return rows(2).filter(x=>dayKey(x.at)===k)};
  const count=(r,t)=>r.filter(x=>x.type===t).length;
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const fmtMin=ms=>{const m=Math.max(0,Math.round((Number(ms)||0)/60000));return m<60?`${m}m`:`${Math.floor(m/60)}h ${m%60}m`};
  const pct=(n,d)=>d?Math.round(100*n/d):0;

  function classify(el){
    if(!el)return'other';
    if(el.closest?.('#homeDayScoreV2'))return'day_score';
    if(el.closest?.('#homeBehaviourOverlayV2')){
      if(el.closest?.('.hbClose'))return'insights_close';
      if(el.closest?.('.hbNode'))return'insights_node';
      if(el.closest?.('.hbNetwork'))return'insights_network';
      return'insights_control';
    }
    if(el.closest?.('.homeCard.calendar'))return'home_calendar';
    if(el.closest?.('.homeCard.todos'))return'home_todos';
    if(el.closest?.('.homeCard.tube'))return'home_tube';
    if(el.closest?.('.homeCard.gym'))return'home_gym';
    if(el.closest?.('.todoCheck'))return'todo_complete_control';
    if(el.closest?.('.todo'))return'todo_open';
    if(el.closest?.('#grid .card'))return'tube_card';
    if(el.closest?.('.option'))return'tube_option';
    if(el.closest?.('#submit,.submit'))return'tube_submit';
    if(el.closest?.('#next,.next'))return'tube_next';
    if(el.closest?.('.gymExercise'))return'gym_exercise';
    if(el.closest?.('.gymPrimary'))return'gym_action';
    if(el.closest?.('button'))return'other_button';
    if(el.closest?.('a'))return'link';
    return'other';
  }

  function recordTap(kind){
    const a=load(TAP,{days:{},buffer:{counts:{},startedAt:Date.now()}});a.days=a.days||{};a.buffer=a.buffer||{counts:{},startedAt:Date.now()};
    const k=dayKey(),d=a.days[k]||(a.days[k]={counts:{},hours:{},firstAt:Date.now(),lastAt:Date.now()});
    d.counts[kind]=(d.counts[kind]||0)+1;const h=String(hour());d.hours[h]=(d.hours[h]||0)+1;d.lastAt=Date.now();
    a.buffer.counts[kind]=(a.buffer.counts[kind]||0)+1;
    const cutoff=Date.now()-MAX_TAP_DAYS*DAY;Object.keys(a.days).forEach(x=>{const t=Date.parse(x+'T12:00:00');if(t<cutoff)delete a.days[x]});save(TAP,a);
  }
  document.addEventListener('pointerup',e=>{if(e.target?.closest?.('input,textarea'))return;recordTap(classify(e.target))},true);
  function flushTap(){const a=load(TAP,{buffer:{counts:{},startedAt:Date.now()}}),b=a.buffer||{counts:{},startedAt:Date.now()};if(!Object.keys(b.counts||{}).length)return;log('ui_usage_summary',{counts:b.counts,hour:hour(),windowMs:Date.now()-Number(b.startedAt||Date.now())});a.buffer={counts:{},startedAt:Date.now()};save(TAP,a)}
  setInterval(flushTap,45000);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushTap()});window.addEventListener('pagehide',flushTap);

  function tapCounts(days=30){const a=load(TAP,{days:{}}),since=Date.now()-days*DAY,out={};Object.entries(a.days||{}).forEach(([k,d])=>{const t=Date.parse(k+'T12:00:00');if(t<since)return;Object.entries(d.counts||{}).forEach(([x,n])=>out[x]=(out[x]||0)+Number(n||0))});return out}
  function observedDays(days=30){const s=new Set(rows(days).map(x=>dayKey(x.at)));const a=load(TAP,{days:{}}),since=Date.now()-days*DAY;Object.keys(a.days||{}).forEach(k=>{if(Date.parse(k+'T12:00:00')>=since)s.add(k)});return s.size}
  function activeMs(r){return r.filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.activeMs||0),0)}

  function score(){
    const r=today(),td=count(r,'todo_complete'),ld=count(r,'tube_complete'),gd=count(r,'gym_complete'),to=count(r,'todo_open'),lo=count(r,'tube_card_open'),gs=count(r,'gym_start');
    const task=Math.min(35,td*10+(td?5:0));const learn=Math.min(25,ld*15+(ld?10:0));const move=gd?20:(gs?8:0);const follow=Math.min(20,(td+ld+gd)*5);
    return{score:Math.round(task+learn+move+follow),task:Math.round(task),learn:Math.round(learn),move:Math.round(move),follow:Math.round(follow),td,ld,gd,to,lo,gs,active:activeMs(r)};
  }

  function model(){
    const r=rows(30),t=tapCounts(30),days=Math.max(1,observedDays(30));const td=count(r,'todo_complete'),to=count(r,'todo_open'),ta=count(r,'todo_add'),ld=count(r,'tube_complete'),lo=count(r,'tube_card_open'),gd=count(r,'gym_complete'),gs=count(r,'gym_start');
    const meaningful=td+ld+gd;const follow=clamp(100*meaningful/Math.max(1,to+lo+gs));
    const initiative=clamp(ta*15+td*7+meaningful*2);const learning=clamp(ld*15+(lo?35*ld/Math.max(1,lo):0));const movement=clamp(gd*28+gs*8);
    const curiosity=clamp(lo*7+(t.home_tube||0)*4);const planning=clamp((t.home_calendar||0)*8+(t.home_todos||0)*4+to*2);
    const daysDone=new Set(r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type)).map(x=>dayKey(x.at))).size;const routine=clamp(100*daysDone/days);
    const active=activeMs(r),allTaps=r.filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.taps||0),0);const focus=clamp(meaningful*7+Math.min(40,active/300000)-Math.max(0,allTaps-meaningful*14)*.15);
    const avoidance=clamp((to>=3?(1-td/Math.max(1,to))*70:18)+(lo>=4?(1-ld/Math.max(1,lo))*20:0));const friction=clamp(12+avoidance*.5+(to>=4&&td===0?20:0));
    const confidence=clamp((Math.min(1,r.length/120)*.55+Math.min(1,days/14)*.45)*100);
    const nodes=[
      ['initiative','Initiative',initiative,'How often you start useful action instead of only consuming or planning.'],['focus','Focus',focus,'How sustained and intentional your HOME use appears.'],['follow','Follow-through',follow,'How often starts become completed actions.'],['learning','Learning',learning,'Completed learning relative to opened learning material.'],['movement','Movement',movement,'Actual gym starts and completed sessions.'],['routine','Routine',routine,'How consistently meaningful actions repeat across days.'],['curiosity','Curiosity',curiosity,'How strongly you explore learning material.'],['planning','Planning',planning,'Calendar and task-orientation behaviour.'],['avoidance','Avoidance',avoidance,'Repeated opening without completion. Higher means more resistance is showing up.',true],['friction','Friction',friction,'Signals that the current interface or task framing may be asking too much.',true]
    ].map(x=>({id:x[0],label:x[1],value:Math.round(x[2]),desc:x[3],negative:!!x[4]}));
    const edges=[['initiative','follow'],['focus','follow'],['curiosity','learning'],['planning','initiative'],['routine','movement'],['routine','follow'],['avoidance','friction'],['focus','learning']];
    return{nodes,edges,confidence:Math.round(confidence),events:r.length,days,t,td,to,ld,lo,gd,gs,active};
  }

  function strongestHour(){const r=rows(30).filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type));const b={};r.forEach(x=>b[hour(x.at)]=(b[hour(x.at)]||0)+1);let h=null,n=0;Object.entries(b).forEach(([k,v])=>{if(v>n){h=Number(k);n=v}});return h}
  function reasons(m){const out=[],tr=pct(m.td,m.to),lr=pct(m.ld,m.lo),h=strongestHour();if(m.to>=4&&tr<45)out.push(['To-dos','Opened tasks convert at '+tr+'%. HOME should surface fewer, smaller next actions and make delayed tasks harder to ignore.']);else if(m.td>=3)out.push(['To-dos','Task follow-through is '+tr+'%. HOME can preserve the current action-first structure.']);if(m.lo>=4&&lr<55)out.push(['Learning','Only '+lr+'% of opened learning items were completed. HOME should favour concrete article/project-specific prompts over generic meta-questions.']);else if(m.ld>=2)out.push(['Learning','Learning completion is '+lr+'%. HOME can gradually test more recall and real application.']);if(h!==null)out.push(['Timing','Your strongest completion cluster is around '+String(h).padStart(2,'0')+':00. HOME can place higher-value actions closer to that window.']);if(m.gd===0&&m.days>=3)out.push(['Movement','No recent completed gym session is visible yet. HOME should reduce the starting barrier instead of merely showing the same Gym card.']);out.push(['Interface','Current HOME choices are provisional. They should change whenever your measured follow-through shows a better direction.']);return out.slice(0,5)}

  function style(){if(document.getElementById('hbV2Style'))return;const s=document.createElement('style');s.id='hbV2Style';s.textContent=`
#homeDayScoreV2{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;border-radius:14px;padding:7px 10px;min-width:62px;display:flex;flex-direction:column;align-items:flex-end;gap:1px;font:inherit}#homeDayScoreV2 small{font-size:8px;letter-spacing:.14em;opacity:.58;font-weight:800}#homeDayScoreV2 b{font-size:16px;line-height:1}.hbFloat{position:absolute;right:18px;top:70px;z-index:40}
#homeBehaviourOverlayV2{position:fixed;inset:0;z-index:20000;background:#090b0f;color:#f7f8fb;display:none;overflow:auto;-webkit-overflow-scrolling:touch}#homeBehaviourOverlayV2.show{display:block}.hbTop{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 18px 12px;background:rgba(9,11,15,.94);backdrop-filter:blur(16px)}.hbClose{width:40px;height:40px;border:0;border-radius:20px;background:#171a21;color:white;font-size:25px}.hbTop h1{font-size:20px;margin:0}.hbTop small{display:block;opacity:.5;font-size:10px;letter-spacing:.12em}.hbBody{padding:6px 16px 36px;max-width:760px;margin:auto}.hbHero{display:grid;grid-template-columns:110px 1fr;gap:16px;align-items:center;padding:16px 0 10px}.hbScore{width:104px;height:104px;border-radius:52px;border:1px solid rgba(255,255,255,.13);background:radial-gradient(circle at 35% 30%,rgba(157,177,255,.24),rgba(255,255,255,.03) 56%);display:grid;place-items:center;text-align:center}.hbScore b{font-size:36px}.hbScore span{font-size:9px;opacity:.5;letter-spacing:.12em}.hbHero h2{margin:0 0 5px;font-size:24px}.hbHero p{margin:0;opacity:.61;line-height:1.4;font-size:13px}.hbMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 18px}.hbMetric{padding:12px 8px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#10131a;text-align:center}.hbMetric b{font-size:18px;display:block}.hbMetric span{font-size:9px;opacity:.5}.hbCard{border:1px solid rgba(255,255,255,.08);background:#0f1218;border-radius:22px;padding:16px;margin:12px 0}.hbCard h3{margin:0 0 4px;font-size:17px}.hbCard>.sub{font-size:11px;opacity:.48;margin-bottom:12px}.hbNetwork{height:360px;border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(95,119,208,.17),rgba(8,10,14,.2) 54%,#080a0e);overflow:hidden;touch-action:none}.hbNetwork svg{width:100%;height:100%;display:block}.hbEdge{stroke:rgba(156,174,255,.28);stroke-width:1.4}.hbNode circle{fill:#151b29;stroke:rgba(174,190,255,.6);stroke-width:1.3}.hbNode.neg circle{stroke:rgba(255,166,132,.6)}.hbNode text{fill:#f8f9fc;font-size:10px;text-anchor:middle;pointer-events:none}.hbNode .v{font-size:12px;font-weight:800}.hbDetail{margin-top:12px;padding:12px 13px;border-radius:14px;background:#151922}.hbDetail b{display:block;margin-bottom:4px}.hbDetail p{margin:0;font-size:12px;line-height:1.45;opacity:.65}.hbWhy{display:grid;gap:8px}.hbReason{padding:12px 13px;border-radius:15px;background:#151922}.hbReason b{font-size:12px}.hbReason p{margin:4px 0 0;font-size:12px;line-height:1.45;opacity:.64}.hbConfidence{height:7px;border-radius:5px;background:#1a1d24;overflow:hidden;margin-top:7px}.hbConfidence i{display:block;height:100%;background:#9bb0ff;border-radius:5px}
`;document.head.appendChild(s)}

  function ensureButton(){style();const home=document.getElementById('homeScreen');if(!home)return;let b=document.getElementById('homeDayScoreV2');if(!b){b=document.createElement('button');b.id='homeDayScoreV2';b.type='button';b.innerHTML='<small>DAY SCORE</small><b>0</b>';b.onclick=openOverlay;const right=document.querySelector('#homeMomentum .homeMomentumRight');if(right)right.prepend(b);else{home.style.position='relative';b.classList.add('hbFloat');home.appendChild(b)}}b.querySelector('b').textContent=String(score().score)}

  function ensureOverlay(){style();let o=document.getElementById('homeBehaviourOverlayV2');if(o)return o;o=document.createElement('div');o.id='homeBehaviourOverlayV2';o.innerHTML='<div class="hbTop"><button class="hbClose">‹</button><div><small>BEHAVIOUR INTELLIGENCE</small><h1>Your living model</h1></div></div><div class="hbBody"><div id="hbContent"></div></div>';document.body.appendChild(o);o.querySelector('.hbClose').onclick=closeOverlay;return o}

  function render(){const o=ensureOverlay(),s=score(),m=model(),rs=reasons(m),content=o.querySelector('#hbContent');content.innerHTML=`<div class="hbHero"><div class="hbScore"><div><b>${s.score}</b><br><span>TODAY</span></div></div><div><h2>Your behaviour, not a personality test.</h2><p>${m.days<3?'HOME is still learning you. The model is intentionally sparse and low-confidence right now.':'The model strengthens only when repeated behaviour supports a pattern.'}</p><div style="margin-top:10px;font-size:11px;opacity:.55">Model confidence ${m.confidence}%</div><div class="hbConfidence"><i style="width:${m.confidence}%"></i></div></div></div><div class="hbMetrics"><div class="hbMetric"><b>${s.td}</b><span>TASKS</span></div><div class="hbMetric"><b>${s.ld}</b><span>LEARNING</span></div><div class="hbMetric"><b>${s.gd}</b><span>GYM</span></div><div class="hbMetric"><b>${fmtMin(s.active)}</b><span>ACTIVE</span></div></div><div class="hbCard"><h3>Living self-map</h3><div class="sub">Drag to move · pinch to zoom · tap a node</div><div class="hbNetwork" id="hbNetwork"></div><div class="hbDetail" id="hbDetail"><b>Explore a node</b><p>Each strand is based on observed HOME behaviour. Weak evidence stays visually quiet.</p></div></div><div class="hbCard"><h3>Why HOME adapted</h3><div class="sub">Concrete reasons behind the current interface</div><div class="hbWhy">${rs.map(x=>`<div class="hbReason"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')}</div></div><div class="hbCard"><h3>Evidence base</h3><div class="sub">No hidden certainty</div><div class="hbReason"><b>${m.events} behavioural events · ${m.days} observed day${m.days===1?'':'s'}</b><p>Button frequency, screen time and opens diagnose friction. They do not count as success by themselves; meaningful completion remains the stronger signal.</p></div></div>`;drawNetwork(m);log('behaviour_insights_open',{score:s.score,confidence:m.confidence,days:m.days,events:m.events})}

  function drawNetwork(m){const host=document.getElementById('hbNetwork');if(!host)return;const W=360,H=360,cx=180,cy=180,R=125;const pos={};m.nodes.forEach((n,i)=>{const a=-Math.PI/2+i*2*Math.PI/m.nodes.length;pos[n.id]={x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R}});const edges=m.edges.map(([a,b])=>`<line class="hbEdge" x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}" style="opacity:${.12+.58*(Math.min(m.nodes.find(n=>n.id===a)?.value||0,m.nodes.find(n=>n.id===b)?.value||0)/100)*(m.confidence/100)}"/>`).join('');const nodes=m.nodes.map(n=>{const p=pos[n.id],r=18+n.value*.09,op=.35+.65*m.confidence/100;return `<g class="hbNode ${n.negative?'neg':''}" data-id="${n.id}" transform="translate(${p.x} ${p.y})" style="opacity:${op}"><circle r="${r}"/><text y="-2">${n.label}</text><text class="v" y="13">${n.value}</text></g>`}).join('');host.innerHTML=`<svg viewBox="0 0 ${W} ${H}"><g id="hbWorld">${edges}${nodes}</g></svg>`;const world=host.querySelector('#hbWorld');let tx=0,ty=0,scale=1,pointers=new Map(),lastDist=0,start=null;const apply=()=>world.setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);host.addEventListener('pointerdown',e=>{host.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)start={x:e.clientX,y:e.clientY,tx,ty};if(pointers.size===2){const q=[...pointers.values()];lastDist=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y)}});host.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1&&start){tx=start.tx+(e.clientX-start.x);ty=start.ty+(e.clientY-start.y);apply()}else if(pointers.size===2){const q=[...pointers.values()],d=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y);if(lastDist>0)scale=clamp(scale*d/lastDist,.65,2.2);lastDist=d;apply()}});['pointerup','pointercancel'].forEach(ev=>host.addEventListener(ev,e=>{pointers.delete(e.pointerId);if(pointers.size<2)lastDist=0;if(!pointers.size)start=null}));host.querySelectorAll('.hbNode').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const n=m.nodes.find(x=>x.id===el.dataset.id),d=document.getElementById('hbDetail');if(n&&d){d.innerHTML=`<b>${n.label} · ${n.value}</b><p>${n.desc}</p>`;log('behaviour_node_open',{node:n.id,value:n.value})}}))}

  function openOverlay(){const o=ensureOverlay();render();o.classList.add('show');document.body.style.overflow='hidden'}
  function closeOverlay(){document.getElementById('homeBehaviourOverlayV2')?.classList.remove('show');document.body.style.overflow='';log('behaviour_insights_close',{})}

  function init(){ensureButton();ensureOverlay();document.documentElement.dataset.behaviourMap='2'}
  init();setTimeout(init,400);setTimeout(init,1400);setTimeout(init,3500);setInterval(()=>{ensureButton();const b=document.querySelector('#homeDayScoreV2 b');if(b)b.textContent=String(score().score)},15000);
  const mo=new MutationObserver(()=>ensureButton());mo.observe(document.documentElement,{childList:true,subtree:true});
  window.HOMEBehaviourIntelligence={open:openOverlay,close:closeOverlay,score,model,version:2};
})();
