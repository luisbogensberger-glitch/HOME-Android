/* HOME Behaviour Intelligence v4 — stable launcher + low-cost living self-model. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_MAP_V4__) return;
  window.__HOME_BEHAVIOUR_MAP_V4__=true;

  const ACT='homeAdaptiveActivityV1';
  const QUEST='homeQuestLedgerV7';
  const TAP='homeBehaviourTapV4';
  const DAY=86400000;
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const clamp=(n,a=0,b=100)=>Math.min(b,Math.max(a,Number(n)||0));
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const rows=(days=30)=>{const v=load(ACT,[]),since=Date.now()-days*DAY;return Array.isArray(v)?v.filter(x=>Number(x?.at||0)>=since):[]};
  const todayRows=()=>{const k=dayKey();return rows(2).filter(x=>dayKey(x.at)===k)};
  const count=(r,t)=>r.filter(x=>x.type===t).length;
  const activeMs=r=>r.filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.activeMs||0),0);
  const fmtMin=ms=>{const m=Math.max(0,Math.round((Number(ms)||0)/60000));return m<60?`${m}m`:`${Math.floor(m/60)}h ${m%60}m`};

  function questDomains(){const q=load(QUEST,{days:{}});return new Set(Array.isArray(q?.days?.[dayKey()])?q.days[dayKey()]:[])}
  function score(){
    const r=todayRows(),q=questDomains();
    const td=Math.max(count(r,'todo_complete'),q.has('do')?1:0);
    const ld=Math.max(count(r,'tube_complete'),q.has('learn')?1:0);
    const gd=Math.max(count(r,'gym_complete'),q.has('move')?1:0);
    const domains=(td>0?1:0)+(ld>0?1:0)+(gd>0?1:0);
    const value=Math.min(100,domains*25+(domains===3?25:0));
    return{score:value,td,ld,gd,active:activeMs(r)};
  }

  function tapCounts(days=30){const a=load(TAP,{days:{}}),since=Date.now()-days*DAY,out={};Object.entries(a.days||{}).forEach(([k,d])=>{if(Date.parse(k+'T12:00:00')<since)return;Object.entries(d.counts||{}).forEach(([x,n])=>out[x]=(out[x]||0)+Number(n||0))});return out}
  function recordTap(kind){const a=load(TAP,{days:{}});a.days=a.days||{};const k=dayKey(),d=a.days[k]||(a.days[k]={counts:{},hours:{}});d.counts[kind]=(d.counts[kind]||0)+1;const h=String(new Date().getHours());d.hours[h]=(d.hours[h]||0)+1;save(TAP,a);log('ui_usage_summary',{counts:{[kind]:1},hour:Number(h),windowMs:0})}

  function observedDays(days=30){return Math.max(1,new Set(rows(days).map(x=>dayKey(x.at))).size)}
  function model(){
    const r=rows(30),t=tapCounts(30),days=observedDays(30);
    const td=count(r,'todo_complete'),to=count(r,'todo_open'),ta=count(r,'todo_add'),ld=count(r,'tube_complete'),lo=count(r,'tube_card_open'),gd=count(r,'gym_complete'),gs=count(r,'gym_start');
    const meaningful=td+ld+gd;
    const follow=clamp(100*meaningful/Math.max(1,to+lo+gs));
    const initiative=clamp(ta*12+td*6+meaningful*2);
    const learning=clamp(ld*15+(lo?35*ld/Math.max(1,lo):0));
    const movement=clamp(gd*28+gs*8);
    const curiosity=clamp(lo*7+(t.home_tube||0)*4);
    const planning=clamp((t.home_calendar||0)*8+(t.home_todos||0)*4+to*2);
    const doneDays=new Set(r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type)).map(x=>dayKey(x.at))).size;
    const routine=clamp(100*doneDays/days);
    const active=activeMs(r),allTaps=r.filter(x=>x.type==='behavior_summary').reduce((s,x)=>s+Number(x.data?.taps||0),0);
    const focus=clamp(meaningful*7+Math.min(40,active/300000)-Math.max(0,allTaps-meaningful*14)*.12);
    const avoidance=clamp((to>=3?(1-td/Math.max(1,to))*70:18)+(lo>=4?(1-ld/Math.max(1,lo))*20:0));
    const friction=clamp(12+avoidance*.5+(to>=4&&td===0?20:0));
    const confidence=clamp((Math.min(1,r.length/180)*.3+Math.min(1,days/14)*.7)*100);
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
    return{nodes,confidence:Math.round(confidence),events:r.length,days,td,to,ld,lo,gd,gs,active};
  }

  function reasons(m){
    const out=[];const tr=m.to?Math.round(100*m.td/m.to):0,lr=m.lo?Math.round(100*m.ld/m.lo):0;
    if(m.to>=4&&tr<45)out.push(['To-dos',`Only ${tr}% of opened tasks became completions. HOME should surface smaller next actions and make repeatedly delayed tasks harder to ignore.`]);
    else if(m.td>=3)out.push(['To-dos',`Task follow-through is ${tr||100}%. HOME can keep the current action-first structure.`]);
    if(m.lo>=4&&lr<55)out.push(['Learning',`Only ${lr}% of opened learning items were completed. HOME should favour concrete article- or project-specific prompts over generic meta-questions.`]);
    else if(m.ld>=2)out.push(['Learning',`Learning completion is ${lr||100}%. HOME can increasingly test recall and real application.`]);
    out.push(['Interface','HOME uses taps and dwell time as friction signals, but meaningful completion remains the stronger signal.']);
    return out.slice(0,4);
  }

  function cleanupOld(){
    ['homeDayScoreV2','homeBehaviourOverlayV2','homeBehaviourOverlayV3','hbV2Style','hbV3Style'].forEach(id=>document.getElementById(id)?.remove());
    document.querySelectorAll('.hbQuestHint').forEach(x=>x.remove());
    document.querySelectorAll('[data-home-behaviour-card]').forEach(x=>{delete x.dataset.homeBehaviourCard;x.removeAttribute('role');x.removeAttribute('tabindex');x.removeAttribute('aria-label')});
  }

  function ensureStyle(){if(document.getElementById('hbV4Style'))return;const s=document.createElement('style');s.id='hbV4Style';s.textContent=`
    #homeDayScoreV4{position:absolute!important;right:18px!important;top:92px!important;z-index:2147482000!important;min-width:86px!important;padding:9px 12px!important;border-radius:18px!important;border:1px solid rgba(255,255,255,.28)!important;background:rgba(12,15,20,.28)!important;backdrop-filter:blur(15px)!important;color:#fff!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:2px!important;font:inherit!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    #homeDayScoreV4 small{font-size:9px!important;letter-spacing:.17em!important;font-weight:850!important;opacity:.72!important}#homeDayScoreV4 b{font-size:26px!important;line-height:1!important}
    #homeBehaviourOverlayV4{position:fixed!important;inset:0!important;z-index:2147483000!important;background:#080a0e!important;color:#f7f8fb!important;display:none!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important}#homeBehaviourOverlayV4.show{display:block!important}
    .hb4Top{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:12px;padding:max(15px,env(safe-area-inset-top)) 18px 12px;background:rgba(8,10,14,.95);backdrop-filter:blur(18px)}.hb4Back{width:42px;height:42px;border:1px solid rgba(255,255,255,.09);border-radius:21px;background:#151821;color:#fff;font-size:27px;padding:0}.hb4Top small{display:block;opacity:.48;font-size:9px;letter-spacing:.15em;font-weight:800}.hb4Top h1{font-size:20px;margin:1px 0 0}.hb4Body{padding:8px 16px 44px;max-width:760px;margin:auto}
    .hb4Hero{display:grid;grid-template-columns:108px 1fr;gap:16px;align-items:center;padding:14px 0}.hb4Score{width:104px;height:104px;border-radius:54px;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 35% 28%,rgba(132,156,255,.26),rgba(255,255,255,.03) 58%);display:grid;place-items:center;text-align:center}.hb4Score b{font-size:38px}.hb4Score span{font-size:9px;opacity:.52;letter-spacing:.14em}.hb4Hero h2{margin:0 0 5px;font-size:24px;line-height:1.06}.hb4Hero p{margin:0;font-size:12.5px;line-height:1.45;opacity:.62}.hb4Confidence{height:7px;background:#171b23;border-radius:6px;overflow:hidden;margin-top:9px}.hb4Confidence i{display:block;height:100%;background:linear-gradient(90deg,#7f98ff,#c7d1ff);border-radius:6px}
    .hb4Metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 15px}.hb4Metric{padding:12px 6px;border:1px solid rgba(255,255,255,.075);background:#0f1218;border-radius:16px;text-align:center}.hb4Metric b{display:block;font-size:18px}.hb4Metric span{font-size:8px;letter-spacing:.08em;opacity:.48}.hb4Card{border:1px solid rgba(255,255,255,.075);background:#0e1117;border-radius:22px;padding:16px;margin:12px 0}.hb4Card h3{font-size:17px;margin:0 0 3px}.hb4Sub{font-size:10px;opacity:.47;margin-bottom:11px}.hb4Network{height:360px;border-radius:18px;background:radial-gradient(circle at 50% 48%,rgba(87,107,192,.20),rgba(7,9,13,.2) 56%,#07090d);overflow:hidden;touch-action:none}.hb4Network svg{width:100%;height:100%;display:block}.hb4Edge{stroke:rgba(156,174,255,.25);stroke-width:1.2}.hb4Node circle{fill:#151b29;stroke:rgba(178,191,255,.6);stroke-width:1.2}.hb4Node.neg circle{stroke:rgba(255,166,132,.58)}.hb4Node text{fill:#f7f8fc;font-size:10px;text-anchor:middle;pointer-events:none}.hb4Node .val{font-size:12px;font-weight:850}.hb4Detail,.hb4Reason{margin-top:10px;padding:12px 13px;border-radius:14px;background:#151922}.hb4Detail b,.hb4Reason b{font-size:12px}.hb4Detail p,.hb4Reason p{margin:4px 0 0;font-size:12px;line-height:1.45;opacity:.64}.hb4Why{display:grid;gap:8px}
  `;document.head.appendChild(s)}

  function ensureLauncher(){
    cleanupOld();ensureStyle();const home=document.getElementById('homeScreen');if(!home)return null;if(getComputedStyle(home).position==='static')home.style.position='relative';
    let b=document.getElementById('homeDayScoreV4');if(!b){b=document.createElement('button');b.type='button';b.id='homeDayScoreV4';b.innerHTML='<small>DAY SCORE</small><b>0</b>';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openOverlay()});home.appendChild(b)}
    const v=b.querySelector('b');if(v)v.textContent=String(score().score);return b;
  }

  function ensureOverlay(){ensureStyle();let o=document.getElementById('homeBehaviourOverlayV4');if(o)return o;o=document.createElement('div');o.id='homeBehaviourOverlayV4';o.innerHTML='<div class="hb4Top"><button class="hb4Back" type="button" aria-label="Back">‹</button><div><small>BEHAVIOUR INTELLIGENCE</small><h1>Your living model</h1></div></div><div class="hb4Body" id="hb4Body"></div>';document.body.appendChild(o);o.querySelector('.hb4Back').addEventListener('click',closeOverlay);return o}

  function renderNetwork(m){
    const host=document.getElementById('hb4Network');if(!host)return;const W=600,H=420,cx=300,cy=205,pos={};
    m.nodes.forEach((n,i)=>{const ring=i<5?118:175,idx=i<5?i:i-5,a=-Math.PI/2+idx*(Math.PI*2/5)+(i>=5?.24:0);pos[n.id]={x:cx+Math.cos(a)*ring,y:cy+Math.sin(a)*ring}});
    const links=[['initiative','follow'],['focus','follow'],['curiosity','learning'],['planning','initiative'],['routine','movement'],['routine','follow'],['avoidance','friction'],['focus','learning']];
    const edges=links.map(([a,b])=>`<line class="hb4Edge" x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}"></line>`).join('');
    const nodes=m.nodes.map(n=>{const p=pos[n.id],r=16+n.value*.12;return `<g class="hb4Node ${n.negative?'neg':''}" data-node="${n.id}" transform="translate(${p.x} ${p.y})"><circle r="${r}"></circle><text y="-2">${n.label}</text><text class="val" y="13">${n.value}</text></g>`}).join('');
    host.innerHTML=`<svg viewBox="0 0 ${W} ${H}"><g id="hb4World">${edges}${nodes}</g></svg>`;
    host.querySelectorAll('.hb4Node').forEach(g=>g.addEventListener('click',e=>{e.stopPropagation();const n=m.nodes.find(x=>x.id===g.dataset.node),d=document.getElementById('hb4Detail');if(n&&d)d.innerHTML=`<b>${n.label} · ${n.value}</b><p>${n.desc}</p>`}));
    const world=host.querySelector('#hb4World'),pts=new Map();let tx=0,ty=0,scale=1,lastDist=0;
    const apply=()=>world?.setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);
    host.addEventListener('pointerdown',e=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});host.setPointerCapture?.(e.pointerId)});
    host.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const old=pts.get(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...pts.values()];if(a.length===1){tx+=(e.clientX-old.x)*.75;ty+=(e.clientY-old.y)*.75}else if(a.length>=2){const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(lastDist)scale=clamp(scale*d/lastDist,.7,2.2);lastDist=d}apply()});
    const end=e=>{pts.delete(e.pointerId);lastDist=0};host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
  }

  function render(){
    const s=score(),m=model(),why=reasons(m),body=ensureOverlay().querySelector('#hb4Body');
    body.innerHTML=`<div class="hb4Hero"><div class="hb4Score"><div><b>${s.score}</b><br><span>TODAY</span></div></div><div><h2>Your behaviour, made visible.</h2><p>${m.days<3?'HOME is still learning you. Weak evidence stays weak.':'The model grows only when repeated behaviour supports a pattern.'}</p><div style="font-size:10px;opacity:.52;margin-top:9px">Model confidence ${m.confidence}%</div><div class="hb4Confidence"><i style="width:${m.confidence}%"></i></div></div></div><div class="hb4Metrics"><div class="hb4Metric"><b>${s.td}</b><span>TASKS</span></div><div class="hb4Metric"><b>${s.ld}</b><span>LEARNING</span></div><div class="hb4Metric"><b>${s.gd}</b><span>GYM</span></div><div class="hb4Metric"><b>${fmtMin(s.active)}</b><span>ACTIVE</span></div></div><div class="hb4Card"><h3>Living self-map</h3><div class="hb4Sub">Drag · pinch · tap a node</div><div class="hb4Network" id="hb4Network"></div><div class="hb4Detail" id="hb4Detail"><b>Explore a node</b><p>Connections stay provisional until repeated behaviour supports them.</p></div></div><div class="hb4Card"><h3>Why HOME adapted</h3><div class="hb4Sub">Concrete reasons behind the current interface</div><div class="hb4Why">${why.map(x=>`<div class="hb4Reason"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('')}</div></div><div class="hb4Card"><h3>Evidence base</h3><div class="hb4Reason"><b>${m.events} behavioural events · ${m.days} observed day${m.days===1?'':'s'}</b><p>Button frequency and screen time diagnose friction; they are not treated as success by themselves.</p></div></div>`;
    requestAnimationFrame(()=>renderNetwork(m));
  }

  function openOverlay(){const o=ensureOverlay();render();o.classList.add('show');document.body.style.overflow='hidden';recordTap('day_score');log('behaviour_insights_open',{score:score().score})}
  function closeOverlay(){document.getElementById('homeBehaviourOverlayV4')?.classList.remove('show');document.body.style.overflow='';recordTap('insights_close')}

  cleanupOld();ensureLauncher();ensureOverlay();
  setTimeout(ensureLauncher,700);setTimeout(ensureLauncher,1800);setInterval(ensureLauncher,5000);
  const baseBack=window.handleAndroidBack;window.handleAndroidBack=function(){if(document.getElementById('homeBehaviourOverlayV4')?.classList.contains('show')){closeOverlay();return'handled'}return typeof baseBack==='function'?baseBack.apply(this,arguments):'home'};
  window.HOMEBehaviourIntelligence={version:4,open:openOverlay,close:closeOverlay,score,model};
})();
