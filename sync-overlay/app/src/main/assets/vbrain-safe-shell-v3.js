/* V-Brain v8 — stable adaptive core with 3D living model, local-first state and no visible recovery UI. */
(function(){
  'use strict';
  if(window.__VBRAIN_V8__)return; window.__VBRAIN_V8__=true;

  const VERSION=8, ACT='homeAdaptiveActivityV1', GRAPH='homeLivingGraphV8', DAY=86400000;
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const part=t=>{const h=new Date(t||Date.now()).getHours();return h<5?'night':h<11?'morning':h<15?'midday':h<21?'evening':'night'};
  const rows=(days=60)=>{const v=load(ACT,[]),since=Date.now()-days*DAY;return Array.isArray(v)?v.filter(x=>Number(x?.at||0)>=since):[]};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function removeRecoveryUi(){
    ['vbRestoreInline','vbrainDataButton','vbrainDataModal','legacyBackupCenter','vbrainLegacyBackup','homeRecoveryLauncher','homeMigrationTools'].forEach(id=>{try{document.getElementById(id)?.remove()}catch(e){}});
    try{document.querySelectorAll('[id*="Backup"],[id*="Restore"]').forEach(el=>{if(el.closest('#vBrainV8'))return;if(/backup|restore/i.test(el.textContent||''))el.remove()})}catch(e){}
  }

  function addStyle(){
    if(document.getElementById('vBrainV8Style'))return;
    const s=document.createElement('style');s.id='vBrainV8Style';s.textContent=`
      :root{--vb-glass:rgba(15,18,24,.76);--vb-line:rgba(255,255,255,.11);--vb-text:#f6f7fa;--vb-muted:rgba(255,255,255,.60);--vb-gold:#f0c95d}
      html,body{pointer-events:auto!important}
      #homeScreen,#homeScreen .homeInner,#homeScreen .homeGrid,#homeScreen .homeCard{pointer-events:auto!important}
      #homeScreen .homeCard{touch-action:manipulation!important;cursor:pointer!important;opacity:1!important;visibility:visible!important;transform:translateZ(0);transition:transform .18s ease,border-color .18s ease,filter .18s ease}
      #homeScreen .homeCard:active{transform:scale(.985)!important;filter:brightness(.94)}
      #homeScreen .homeCard *{pointer-events:none!important}
      #vbrainScoreV8{position:relative;z-index:6;margin:8px 0 18px;border:1px solid rgba(241,202,90,.30);background:radial-gradient(circle at 87% 18%,rgba(240,201,93,.18),transparent 34%),linear-gradient(145deg,rgba(18,20,26,.97),rgba(11,13,18,.92));border-radius:28px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.28);overflow:hidden;color:#fff;touch-action:manipulation}
      #vbrainScoreV8:before{content:'';position:absolute;inset:-60% 48% auto -15%;height:150%;background:radial-gradient(circle,rgba(110,137,255,.17),transparent 65%);pointer-events:none}
      .vb8ScoreTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.vb8Kicker{font-size:10px;font-weight:900;letter-spacing:.19em;color:var(--vb-gold);text-transform:uppercase}.vb8ScoreTitle{font-size:27px;font-weight:800;letter-spacing:-.035em;margin:4px 0 4px}.vb8ScoreSub{font-size:12px;color:var(--vb-muted);line-height:1.4;max-width:260px}.vb8Orb{flex:0 0 84px;width:84px;height:84px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--vb-gold) var(--vb-angle),rgba(255,255,255,.09) 0);position:relative;box-shadow:0 0 34px rgba(240,201,93,.12)}.vb8Orb:after{content:'';position:absolute;inset:7px;border-radius:50%;background:#11141a}.vb8Orb strong{z-index:1;font-size:29px;line-height:1}.vb8Orb span{z-index:1;position:absolute;bottom:18px;font-size:7px;letter-spacing:.13em;color:rgba(255,255,255,.58)}
      .vb8Mini{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:15px}.vb8Mini div{border-top:1px solid rgba(255,255,255,.08);padding-top:10px}.vb8Mini b{display:block;font-size:15px}.vb8Mini small{font-size:8px;letter-spacing:.09em;color:rgba(255,255,255,.44);text-transform:uppercase}.vb8Open{margin-top:13px;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:800;color:rgba(255,255,255,.82)}.vb8Open span:last-child{font-size:22px;color:var(--vb-gold)}
      #vBrainV8{position:fixed;inset:0;z-index:2147483000;background:linear-gradient(180deg,#07090d,#0a0d13 62%,#080a0e);color:#fff;display:none;pointer-events:none;overflow:hidden}
      #vBrainV8.show{display:block;pointer-events:auto}
      .vb8BrainTop{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:max(15px,env(safe-area-inset-top)) 18px 12px;background:linear-gradient(180deg,rgba(7,9,13,.94),rgba(7,9,13,.55),transparent)}.vb8Back{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.11);background:#151922;color:#fff;font-size:28px}.vb8BrainTop small{display:block;font-size:9px;letter-spacing:.18em;color:rgba(255,255,255,.46);font-weight:900}.vb8BrainTop h1{margin:1px 0 0;font-size:21px;letter-spacing:-.02em}.vb8BrainMeta{margin-left:auto;text-align:right;font-size:9px;color:rgba(255,255,255,.45);line-height:1.45}
      #vb8Canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
      .vb8Hint{position:absolute;left:50%;transform:translateX(-50%);top:max(83px,calc(env(safe-area-inset-top) + 70px));z-index:3;font-size:9px;letter-spacing:.10em;color:rgba(255,255,255,.38);white-space:nowrap}
      #vb8Detail{position:absolute;z-index:5;left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom));padding:15px 16px 16px;border-radius:24px;border:1px solid rgba(255,255,255,.10);background:rgba(15,18,25,.88);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 20px 60px rgba(0,0,0,.38);max-height:35vh;overflow:auto}.vb8DetailTag{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--vb-gold);font-weight:900}.vb8DetailTitle{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.vb8DetailTitle h2{font-size:21px;margin:4px 0 4px}.vb8DetailTitle b{font-size:28px}.vb8Detail p{font-size:11px;line-height:1.48;color:rgba(255,255,255,.64);margin:5px 0}.vb8Reasons{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.vb8Reason{padding:6px 8px;border:1px solid rgba(255,255,255,.08);border-radius:999px;font-size:9px;color:rgba(255,255,255,.58)}
      .vb8Toast{position:fixed;z-index:2147483600;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translate(-50%,20px);opacity:0;pointer-events:none;background:#171b23;color:#fff;border:1px solid rgba(255,255,255,.10);padding:10px 14px;border-radius:999px;font-size:11px;transition:.2s}.vb8Toast.show{opacity:1;transform:translate(-50%,0)}
      #todoScreen .syncError,#todoScreen [class*="sync-error"],#todoScreen [class*="syncError"]{border-color:rgba(255,255,255,.08)!important;background:rgba(20,22,27,.78)!important;color:rgba(255,255,255,.62)!important}
      #todoScreen .todoItem,#todoScreen [class*="todoCard"]{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
      #todoScreen input,#todoScreen textarea{caret-color:#fff}
    `;document.head.appendChild(s);
  }

  function activity(){return rows(60)}
  function evidence(){
    const r=activity(),done=r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type));
    const c=t=>r.filter(x=>x.type===t).length, days=[...new Set(r.map(x=>dayKey(x.at)))],doneDays=[...new Set(done.map(x=>dayKey(x.at)))];
    const dp={morning:0,midday:0,evening:0,night:0};done.forEach(x=>dp[part(x.at)]++);
    const domains={};done.forEach(x=>{const k=dayKey(x.at),s=domains[k]||(domains[k]=new Set());s.add(x.type)});
    const summaries=r.filter(x=>x.type==='behavior_summary');
    return{r,done,days,doneDays,dp,multi:Object.values(domains).filter(s=>s.size>=2).length,full:Object.values(domains).filter(s=>s.size>=3).length,
      todoOpen:c('todo_open'),todoDone:c('todo_complete'),todoAdd:c('todo_add'),tubeOpen:c('tube_card_open'),tubeDone:c('tube_complete'),gymStart:c('gym_start'),gymDone:c('gym_complete'),calendarOpen:c('calendar_open'),
      active:summaries.reduce((a,x)=>a+Number(x.data?.activeMs||0),0),learning:load('homeSentenceLearningProfileV7',{}),journal:load('homeSentenceJournalV7',[])};
  }
  function N(id,label,value,confidence,count,group,reasons,description,emergent=false){return{id,label,value:Math.round(clamp(value)),confidence:Math.round(clamp(confidence)),evidenceCount:count||0,group,reasons:reasons.filter(Boolean).slice(0,4),description,emergent}}
  function model(){
    const e=evidence(),done=e.todoDone+e.tubeDone+e.gymDone,starts=e.todoOpen+e.tubeOpen+e.gymStart,conf=Math.min(96,e.r.length*.42+e.days.length*8.5),journalN=Array.isArray(e.journal)?e.journal.length:0;
    const nodes=[
      N('initiative','Initiative',Math.min(100,e.todoAdd*11+e.todoDone*7+done*2),conf,e.todoAdd+e.todoDone,'action',[`${e.todoDone} tasks completed`,e.todoAdd?`${e.todoAdd} tasks created`:null],'How readily you turn intention into self-started action.'),
      N('focus','Focus',Math.min(100,done*6+Math.min(35,e.active/300000)),conf,e.r.length,'attention',[`${Math.round(e.active/60000)} active minutes`,`${done} meaningful completions`],'How sustained and goal-directed your observed activity appears.'),
      N('follow','Follow-through',starts?100*done/starts:0,conf,starts,'action',[`${done} completions from ${starts} starts or opens`],'How often attention turns into completion.'),
      N('learning','Learning',Math.min(100,e.tubeDone*12+Number(e.learning?.avgDepth||0)*.55+journalN*2),conf,e.tubeOpen+e.tubeDone+journalN,'growth',[`${e.tubeDone} learning items completed`,e.learning?.avgDepth?`Answer depth ${Math.round(e.learning.avgDepth)}/100`:null,journalN?`${journalN} written reflections`:null],'How strongly your behaviour shows active learning rather than passive browsing.'),
      N('movement','Movement',Math.min(100,e.gymDone*24+e.gymStart*7),conf,e.gymDone+e.gymStart,'health',[`${e.gymDone} workouts completed`,e.gymStart?`${e.gymStart} workouts started`:null],'How consistently physical training appears in your routine.'),
      N('routine','Routine',e.days.length?100*e.doneDays.length/Math.min(30,e.days.length):0,conf,e.doneDays.length,'stability',[`${e.doneDays.length} completion days`,`Observed across ${e.days.length} active days`],'How consistently useful actions repeat across days.'),
      N('curiosity','Curiosity',Math.min(100,e.tubeOpen*6+journalN*5),conf,e.tubeOpen+journalN,'growth',[`${e.tubeOpen} learning items explored`,journalN?`${journalN} reflections`:null],'How strongly you explore ideas and continue deeper.'),
      N('planning','Planning',Math.min(100,e.todoOpen*3+e.todoAdd*8+e.calendarOpen*3),conf,e.todoOpen+e.todoAdd+e.calendarOpen,'structure',[`${e.todoOpen} task opens`,`${e.calendarOpen} calendar opens`],'How strongly you use structure to orient action.'),
      N('adaptability','Adaptability',Math.min(100,18+e.days.length*3+e.multi*8),conf,e.days.length+e.multi,'growth',[`${e.multi} multi-domain days`],'How readily your behaviour moves across work, learning and movement.'),
      N('friction','Friction',clamp(12+(e.todoOpen>=3?(1-e.todoDone/Math.max(1,e.todoOpen))*58:8)+(e.tubeOpen>=4?(1-e.tubeDone/Math.max(1,e.tubeOpen))*18:0)),conf,e.todoOpen+e.tubeOpen,'friction',[e.todoOpen?`${Math.max(0,e.todoOpen-e.todoDone)} task opens without recorded completion`:null],'A provisional signal for where the current workflow may be getting in your way.')
    ];
    const best=Object.entries(e.dp).sort((a,b)=>b[1]-a[1])[0];
    if(best&&best[1]>=4)nodes.push(N(`rhythm_${best[0]}`,`${best[0][0].toUpperCase()+best[0].slice(1)} drive`,100*best[1]/Math.max(1,e.done.length),Math.min(95,best[1]*12),best[1],'rhythm',[`${best[1]} meaningful completions in the ${best[0]}`],'A time-of-day pattern V-Brain discovered from repeated completions.',true));
    if(e.multi>=3)nodes.push(N('balanced_momentum','Balanced momentum',Math.min(100,e.multi*13+e.full*8),Math.min(95,e.multi*14),e.multi,'stability',[`${e.multi} days moved at least two domains`,e.full?`${e.full} days moved all three`:null],'A repeated tendency to build momentum across more than one area.',true));
    if(e.todoOpen>=6&&e.todoDone/Math.max(1,e.todoOpen)>=.6)nodes.push(N('action_bias','Action bias',Math.min(100,100*e.todoDone/e.todoOpen+10),Math.min(95,e.todoOpen*7),e.todoOpen,'action',[`Task follow-through ${Math.round(100*e.todoDone/e.todoOpen)}%`],'A repeated tendency to convert task attention into action.',true));
    if(e.gymDone>=3)nodes.push(N('training_consistency','Training consistency',Math.min(100,e.gymDone*18),Math.min(95,e.gymDone*16),e.gymDone,'health',[`${e.gymDone} completed workouts`],'Physical training is becoming a repeated pattern.',true));
    if(e.tubeOpen>=8&&e.tubeDone>=4)nodes.push(N('intellectual_exploration','Intellectual exploration',Math.min(100,e.tubeOpen*5+e.tubeDone*7),Math.min(95,(e.tubeOpen+e.tubeDone)*5),e.tubeOpen+e.tubeDone,'growth',[`${e.tubeOpen} items explored`,`${e.tubeDone} completed`],'Broad exploration combined with actual completion.',true));
    if(Number(e.learning?.avgDepth||0)>=58&&journalN>=4)nodes.push(N('reflective_depth','Reflective depth',Math.min(100,Number(e.learning.avgDepth)+journalN),Math.min(95,journalN*11),journalN,'growth',[`${journalN} written reflections`,`Answer depth ${Math.round(e.learning.avgDepth)}/100`],'Your learning increasingly includes explanation and reflection, not only recall.',true));

    const ids=new Set(nodes.map(x=>x.id)),edges=[];const E=(a,b,w,why)=>{if(ids.has(a)&&ids.has(b))edges.push({a,b,w,why})};
    E('initiative','follow',78,'Starting and finishing repeatedly move together.');E('focus','follow',68,'Sustained attention supports completion.');E('curiosity','learning',82,'Exploration becomes useful when it turns into learning.');E('planning','initiative',57,'Structure can create a launch point for action.');E('routine','follow',72,'Consistency supports follow-through.');E('adaptability','balanced_momentum',73,'Cross-domain behaviour supports flexible momentum.');E('movement','training_consistency',90,'Repeated workouts strengthen the movement pattern.');E('initiative','action_bias',88,'Repeated conversion from intention to action.');E('learning','reflective_depth',88,'Reflection deepens learning evidence.');E('friction','follow',42,'Friction and completion move in opposite directions.');
    const rhythm=nodes.find(x=>x.id.startsWith('rhythm_'));if(rhythm){E(rhythm.id,'routine',62,'Repeated timing can become routine.');E(rhythm.id,'focus',52,'Your strongest completion window overlaps with focus.');}

    const old=load(GRAPH,{nodes:{},history:[]}),map=old.nodes||{},now=Date.now();
    nodes.forEach(x=>{const p=map[x.id]||{};map[x.id]={...p,...x,firstSeen:p.firstSeen||now,lastSeen:now,maxValue:Math.max(p.maxValue||0,x.value),maxConfidence:Math.max(p.maxConfidence||0,x.confidence)}});
    const history=Array.isArray(old.history)?old.history:[];if(!history.length||now-Number(history[history.length-1]?.at||0)>21600000)history.push({at:now,nodeCount:nodes.length,edgeCount:edges.length,events:e.r.length});if(history.length>180)history.splice(0,history.length-180);
    const graph={version:VERSION,updatedAt:now,nodes:map,visible:nodes.map(x=>x.id),edges,history};save(GRAPH,graph);try{Native?.saveState?.('homeLivingGraphV8',JSON.stringify(graph))}catch(e){}
    return{e,nodes,edges,graph};
  }

  function todayScore(m){
    const today=dayKey(),r=m.e.r.filter(x=>dayKey(x.at)===today),todo=r.filter(x=>x.type==='todo_complete').length,tube=r.filter(x=>x.type==='tube_complete').length,gym=r.filter(x=>x.type==='gym_complete').length;
    const domains=(todo>0?1:0)+(tube>0?1:0)+(gym>0?1:0),progress=Math.min(100,domains*25+(domains===3?25:0));
    return{value:progress,todo,tube,gym};
  }

  function scoreCopy(sc,m){
    if(sc.value>=100)return'Work, learning and movement all moved today.';
    if(sc.value>=50)return'Momentum is building. One more useful domain changes the shape of the day.';
    if(sc.value>0)return'You have started moving. V-Brain is watching for follow-through, not taps.';
    const best=m.nodes.filter(n=>n.group!=='friction').sort((a,b)=>b.confidence*b.value-a.confidence*a.value)[0];
    return best&&best.confidence>25?`Your strongest current signal is ${best.label.toLowerCase()}.`:'V-Brain is still collecting enough behaviour to understand your patterns.';
  }

  function ensureScore(){
    const inner=document.querySelector('#homeScreen .homeInner'),grid=inner?.querySelector('.homeGrid');if(!inner||!grid)return;
    let card=document.getElementById('vbrainScoreV8');if(!card){card=document.createElement('section');card.id='vbrainScoreV8';card.setAttribute('role','button');card.tabIndex=0;inner.insertBefore(card,grid)}
    const m=model(),sc=todayScore(m);card.style.setProperty('--vb-angle',`${sc.value*3.6}deg`);card.innerHTML=`<div class="vb8ScoreTop"><div><div class="vb8Kicker">Behaviour intelligence</div><div class="vb8ScoreTitle">Your signal today</div><div class="vb8ScoreSub">${esc(scoreCopy(sc,m))}</div></div><div class="vb8Orb"><strong>${sc.value}</strong><span>V SCORE</span></div></div><div class="vb8Mini"><div><b>${sc.todo}</b><small>Tasks</small></div><div><b>${sc.tube}</b><small>Learn</small></div><div><b>${sc.gym}</b><small>Move</small></div></div><div class="vb8Open"><span>${m.nodes.length} live traits · ${m.edges.length} connections</span><span>›</span></div>`;
    card.onclick=openBrain;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBrain()}};
  }

  function adaptiveOrder(){
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;
    const hour=new Date().getHours();let order=hour<11?['calendar','todos','gym','tube']:hour<17?['todos','calendar','tube','gym']:['gym','tube','todos','calendar'];
    const r=rows(14),count=t=>r.filter(x=>x.type===t).length;
    if(count('tube_card_open')>count('todo_open')*1.7&&hour>=16)order=['tube','gym','todos','calendar'];
    order.forEach(c=>{const el=grid.querySelector('.homeCard.'+c);if(el)grid.appendChild(el)});
  }

  function route(name){try{if(typeof window.showScreen==='function')return window.showScreen(name)}catch(e){}const target=document.getElementById(name+'Screen');if(!target)return;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));target.classList.add('show')}
  function bindCards(){[['calendar','calendar'],['todos','todos'],['tube','tube'],['gym','gym']].forEach(([c,r])=>{const el=document.querySelector('#homeScreen .homeCard.'+c);if(!el)return;el.style.pointerEvents='auto';el.onclick=e=>{e.preventDefault();e.stopPropagation();route(r)}})}

  let brain,canvas,ctx,detail,currentModel,anim=0,rotX=.20,rotY=-.45,zoom=1,pointers=new Map(),downInfo=null,projected=[];
  const palette={action:'#f1ca62',attention:'#8fb2ff',growth:'#bba0ff',health:'#79d2ac',stability:'#83a6c8',structure:'#8bd0df',rhythm:'#e6a66e',friction:'#df8d80'};
  function seeded(id){let h=2166136261;for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return ()=>((h=Math.imul(h^h>>>15,2246822519))>>>0)/4294967295}
  function positions(nodes){const out={};nodes.forEach((n,i)=>{const rnd=seeded(n.id),N=nodes.length,phi=Math.acos(1-2*(i+.5)/N),theta=Math.PI*(1+Math.sqrt(5))*i+(rnd()-.5)*.45;const rad=.72+(rnd()-.5)*.18;out[n.id]={x:Math.sin(phi)*Math.cos(theta)*rad,y:Math.cos(phi)*rad,z:Math.sin(phi)*Math.sin(theta)*rad}});return out}
  function rotate(p){let x=p.x,y=p.y,z=p.z;const cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX);let x1=x*cy-z*sy,z1=x*sy+z*cy;let y1=y*cx-z1*sx,z2=y*sx+z1*cx;return{x:x1,y:y1,z:z2}}
  function draw(){
    if(!brain?.classList.contains('show'))return;const dpr=Math.min(2,window.devicePixelRatio||1),w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const pos=positions(currentModel.nodes),cx=w/2,cy=h*.46,scale=Math.min(w,h)*.40*zoom;projected=[];
    currentModel.nodes.forEach(n=>{const p=rotate(pos[n.id]),pers=1/(1.55-p.z*.58),x=cx+p.x*scale*pers,y=cy+p.y*scale*pers;projected.push({n,p,x,y,r:(8+n.confidence*.075)*pers})});
    const by=Object.fromEntries(projected.map(q=>[q.n.id,q]));
    currentModel.edges.slice().sort((a,b)=>((by[a.a]?.p.z||0)+(by[a.b]?.p.z||0))-((by[b.a]?.p.z||0)+(by[b.b]?.p.z||0))).forEach(e=>{const a=by[e.a],b=by[e.b];if(!a||!b)return;const alpha=.10+e.w/240;ctx.strokeStyle=`rgba(145,165,235,${alpha})`;ctx.lineWidth=.55+e.w/85;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()});
    projected.sort((a,b)=>a.p.z-b.p.z).forEach(q=>{const n=q.n,col=palette[n.group]||'#9fb5ff',depth=clamp((q.p.z+1.2)/2.4,0,1);ctx.globalAlpha=.48+depth*.52;ctx.shadowBlur=n.emergent?20:10;ctx.shadowColor=col;ctx.fillStyle='#101620';ctx.strokeStyle=col;ctx.lineWidth=n.emergent?2:1.25;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`${Math.max(8,Math.min(12,q.r*.65))}px system-ui`;ctx.fillText(n.label,q.x,q.y-q.r-5);ctx.font=`700 ${Math.max(8,Math.min(11,q.r*.62))}px system-ui`;ctx.fillText(String(n.value),q.x,q.y+3);ctx.globalAlpha=1});
    anim=requestAnimationFrame(draw);
  }
  function showDetail(n){if(!detail||!n)return;const linked=currentModel.edges.filter(e=>e.a===n.id||e.b===n.id).map(e=>currentModel.nodes.find(x=>x.id===(e.a===n.id?e.b:e.a))?.label).filter(Boolean);const level=n.confidence<25?'Early signal':n.confidence<55?'Developing pattern':'Established signal';detail.innerHTML=`<div class="vb8DetailTag">${esc(level)} · ${n.confidence}% confidence · ${n.evidenceCount} signals</div><div class="vb8DetailTitle"><h2>${esc(n.label)}</h2><b>${n.value}</b></div><p>${esc(n.description)}</p><p>${n.value>=70?'V-Brain currently sees this as one of the stronger patterns in your behaviour.':n.value>=45?'This pattern is becoming visible, but can still change as more evidence arrives.':'The signal is weak or early. V-Brain will not treat it as a fixed trait.'}</p>${linked.length?`<p><b>Connected with:</b> ${esc(linked.slice(0,5).join(', '))}</p>`:''}<div class="vb8Reasons">${n.reasons.map(x=>`<span class="vb8Reason">${esc(x)}</span>`).join('')}</div>`}
  function ensureBrain(){
    if(brain)return;brain=document.createElement('section');brain.id='vBrainV8';brain.innerHTML=`<div class="vb8BrainTop"><button class="vb8Back" type="button">‹</button><div><small>V-BRAIN · LIVING MODEL</small><h1>Behaviour network</h1></div><div class="vb8BrainMeta" id="vb8Meta"></div></div><div class="vb8Hint">drag to rotate · pinch to zoom · tap a node</div><canvas id="vb8Canvas"></canvas><div id="vb8Detail" class="vb8Detail"><div class="vb8DetailTag">Living model</div><div class="vb8DetailTitle"><h2>Explore your network</h2></div><p>The network grows as repeated behaviour supports new traits and connections.</p></div>`;document.body.appendChild(brain);canvas=brain.querySelector('#vb8Canvas');ctx=canvas.getContext('2d');detail=brain.querySelector('#vb8Detail');brain.querySelector('.vb8Back').onclick=closeBrain;
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});downInfo={x:e.clientX,y:e.clientY,t:Date.now()}});
    canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){rotY+=(e.clientX-prev.x)*.007;rotX+=(e.clientY-prev.y)*.007;rotX=clamp(rotX,-1.25,1.25)}else if(pointers.size===2){const pts=[...pointers.values()],dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(canvas._lastPinch)zoom=clamp(zoom*dist/canvas._lastPinch,.65,2.3);canvas._lastPinch=dist}});
    const up=e=>{const wasTap=downInfo&&Date.now()-downInfo.t<280&&Math.hypot(e.clientX-downInfo.x,e.clientY-downInfo.y)<12;pointers.delete(e.pointerId);if(pointers.size<2)canvas._lastPinch=0;if(wasTap){const q=projected.map(p=>({...p,d:Math.hypot(p.x-e.clientX,p.y-e.clientY)})).sort((a,b)=>a.d-b.d)[0];if(q&&q.d<Math.max(28,q.r*1.8))showDetail(q.n)}downInfo=null};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.92:1.08),.65,2.3)},{passive:false});
  }
  function openBrain(){ensureBrain();currentModel=model();brain.querySelector('#vb8Meta').innerHTML=`${currentModel.nodes.length} nodes<br>${currentModel.edges.length} connections`;brain.classList.add('show');document.body.style.overflow='hidden';cancelAnimationFrame(anim);draw();if(currentModel.nodes.length)showDetail(currentModel.nodes.slice().sort((a,b)=>b.confidence*b.value-a.confidence*a.value)[0])}
  function closeBrain(){brain?.classList.remove('show');document.body.style.overflow='';cancelAnimationFrame(anim)}

  function toast(msg){let t=document.getElementById('vb8Toast');if(!t){t=document.createElement('div');t.id='vb8Toast';t.className='vb8Toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),2300)}
  function hideStaleSyncErrors(){
    try{document.querySelectorAll('#todoScreen *').forEach(el=>{const txt=(el.textContent||'').trim();if(txt.length<180&&/sync failed/i.test(txt)&&/(404|task not found)/i.test(txt)){const candidate=el.closest('[class*="sync"], [id*="sync"]')||el;if(candidate&&candidate!==document.getElementById('todoScreen'))candidate.style.display='none'}})}catch(e){}
  }
  function patchSync(){
    if(window.__VBRAIN_V8_SYNC__)return;window.__VBRAIN_V8_SYNC__=true;const base=window.onNotionSyncError;
    window.onNotionSyncError=function(result){const msg=String(result?.message||result||'');if(/404|task not found/i.test(msg)){hideStaleSyncErrors();try{setSyncStatus('Saved on device · sync will repair automatically')}catch(e){}toast('Saved on device');return}if(typeof base==='function')return base.apply(this,arguments)};
  }
  function persistTodos(){try{if(typeof saveStore==='function')saveStore('todoState',todoState);else{const raw=JSON.stringify(todoState);localStorage.setItem('todoState',raw);Native?.saveState?.('todoState',raw)};renderTodos?.();updateHome?.()}catch(e){}}
  function patchTodoLocalFirst(){
    if(window.__VBRAIN_V8_TODOS__)return;if(typeof todoState==='undefined'||!todoState||!Array.isArray(todoState.active)||!Array.isArray(todoState.archive))return;window.__VBRAIN_V8_TODOS__=true;
    window.completeTodo=function(id){let i=todoState.active.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id));if(i<0)return;const [t]=todoState.active.splice(i,1);t.completedAt=Date.now();todoState.archive.push(t);persistTodos();try{window.homeAdaptiveLog?.('todo_complete',{id:String(t.id||'')})}catch(e){}try{const rid=String(t.notionId||t.id||'');if(rid&&Native?.setNotionTaskDone)Native.setNotionTaskDone(rid,true)}catch(e){}toast('Task completed')};
    window.restoreTodo=function(id){let i=todoState.archive.findIndex(t=>String(t.id)===String(id)||String(t.notionId||'')===String(id));if(i<0)return;const [t]=todoState.archive.splice(i,1);delete t.completedAt;todoState.active.push(t);persistTodos();try{const rid=String(t.notionId||t.id||'');if(rid&&Native?.setNotionTaskDone)Native.setNotionTaskDone(rid,false)}catch(e){}};
  }

  function silentSnapshot(){try{const pack={at:Date.now(),todo:localStorage.getItem('todoState'),tube:localStorage.getItem('tubeState'),gym:localStorage.getItem('homeGymStateV1'),graph:localStorage.getItem(GRAPH)};localStorage.setItem('vbrainSilentSnapshotV8',JSON.stringify(pack))}catch(e){}}
  function repair(){addStyle();removeRecoveryUi();bindCards();adaptiveOrder();ensureScore();patchSync();patchTodoLocalFirst();hideStaleSyncErrors();silentSnapshot();document.documentElement.dataset.vbrain='8'}

  window.VBrain={version:VERSION,openBrain,model,repair};
  repair();setTimeout(repair,350);setTimeout(repair,1200);setTimeout(repair,2600);setInterval(repair,12000);
})();
