/* HOME Living Brain v6 — persistent, extensible self-model with dynamic nodes and evidence. */
(function(){
  'use strict';
  if(window.__HOME_LIVING_BRAIN_V6__){try{window.HOMELivingBrainV6?.repair?.()}catch(e){}return}
  window.__HOME_LIVING_BRAIN_V6__=true;

  const VERSION=6, ACT='homeAdaptiveActivityV1', GRAPH='homeLivingGraphV6', QUEST='homeQuestLedgerV7';
  const DAY=86400000;
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const part=t=>{const h=new Date(t||Date.now()).getHours();return h<5?'night':h<11?'morning':h<15?'midday':h<21?'evening':'night'};
  const rows=(days=60)=>{const v=load(ACT,[]),since=Date.now()-days*DAY;return Array.isArray(v)?v.filter(x=>Number(x?.at||0)>=since):[]};
  const count=(r,t)=>r.filter(x=>x.type===t).length;
  const pct=(a,b)=>b?Math.round(100*a/b):0;

  const registry=[];
  function registerFacet(def){if(def&&def.id&&!registry.some(x=>x.id===def.id))registry.push(def)}

  function evidence(){
    const r=rows(60),done=r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type));
    const days=[...new Set(r.map(x=>dayKey(x.at)))];
    const doneDays=[...new Set(done.map(x=>dayKey(x.at)))];
    const todoOpen=count(r,'todo_open'),todoDone=count(r,'todo_complete'),todoAdd=count(r,'todo_add');
    const tubeOpen=count(r,'tube_card_open'),tubeDone=count(r,'tube_complete'),gymStart=count(r,'gym_start'),gymDone=count(r,'gym_complete');
    const summaries=r.filter(x=>x.type==='behavior_summary');
    const active=summaries.reduce((s,x)=>s+Number(x.data?.activeMs||0),0);
    const taps=summaries.reduce((s,x)=>s+Number(x.data?.taps||0),0);
    const learning=load('homeSentenceLearningProfileV7',{}),profile=load('homeBehaviourProfileV4',{}),quest=load(QUEST,{days:{}});
    const journal=load('homeSentenceJournalV7',[]);
    const parts={morning:0,midday:0,evening:0,night:0};done.forEach(x=>parts[part(x.at)]++);
    const domainDays={};done.forEach(x=>{const k=dayKey(x.at),d=domainDays[k]||(domainDays[k]=new Set());d.add(x.type==='todo_complete'?'do':x.type==='tube_complete'?'learn':'move')});
    const multiDays=Object.values(domainDays).filter(s=>s.size>=2).length;
    const fullDays=Object.values(domainDays).filter(s=>s.size>=3).length;
    return{r,done,days,doneDays,todoOpen,todoDone,todoAdd,tubeOpen,tubeDone,gymStart,gymDone,active,taps,learning,profile,quest,journal:Array.isArray(journal)?journal:[],parts,multiDays,fullDays};
  }

  function why(texts){return texts.filter(Boolean).slice(0,4)}
  function node(id,label,value,confidence,evidenceCount,group,reasons,description,emergent=false){return{id,label,value:Math.round(clamp(value)),confidence:Math.round(clamp(confidence)),evidenceCount:Number(evidenceCount)||0,group,reasons:why(reasons),description,emergent};}

  function coreNodes(e){
    const completion=e.todoDone+e.tubeDone+e.gymDone;
    const followDen=e.todoOpen+e.tubeOpen+e.gymStart;
    const focus=Math.min(100,completion*6+Math.min(35,e.active/300000)-Math.max(0,e.taps-completion*14)*.08);
    const routine=e.days.length?100*e.doneDays.length/Math.min(30,e.days.length):0;
    const curiosity=Math.min(100,e.tubeOpen*6+e.journal.length*5+Number(e.learning?.avgDepth||0)*.35);
    const planning=Math.min(100,e.todoOpen*3+e.todoAdd*8+(e.profile?.todos?.preferredCompletionHour!=null?12:0));
    const initiative=Math.min(100,e.todoAdd*12+e.todoDone*7+completion*2);
    const follow=100*completion/Math.max(1,followDen);
    const learning=Math.min(100,e.tubeDone*12+Number(e.learning?.avgDepth||0)*.55+(e.learning?.applicationRate||0)*25);
    const movement=Math.min(100,e.gymDone*24+e.gymStart*8);
    const adaptability=Math.min(100,18+e.days.length*3+e.multiDays*7+(e.learning?.count||0)*2);
    const avoidance=clamp((e.todoOpen>=3?(1-e.todoDone/Math.max(1,e.todoOpen))*65:18)+(e.tubeOpen>=4?(1-e.tubeDone/Math.max(1,e.tubeOpen))*20:0));
    const friction=clamp(10+avoidance*.45+(e.todoOpen>=4&&e.todoDone===0?20:0));
    const signal=Math.min(100,e.r.length/2.2),dayConf=Math.min(100,e.days.length*9),conf=(signal*.45+dayConf*.55);
    return[
      node('initiative','Initiative',initiative,conf,e.todoAdd+e.todoDone,'action',[`${e.todoDone} completed tasks`,e.todoAdd?`${e.todoAdd} tasks created by you`:null],'How readily you convert intention into self-started action.'),
      node('focus','Focus',focus,conf,e.r.length,'attention',[`${Math.round(e.active/60000)} active minutes observed`,`${completion} meaningful completions`],'How sustained and goal-directed your HOME activity appears.'),
      node('follow','Follow-through',follow,conf,followDen,'action',[`${completion} completions from ${followDen} recorded starts/opens`,e.todoOpen?`Task follow-through ${pct(e.todoDone,e.todoOpen)}%`:null],'How often starts become completed actions.'),
      node('learning','Learning',learning,conf,e.tubeOpen+e.tubeDone+e.journal.length,'growth',[`${e.tubeDone} learning items completed`,e.learning?.avgDepth?`Average written-answer depth ${Math.round(e.learning.avgDepth)}/100`:null],'How strongly your behaviour shows active learning rather than passive consumption.'),
      node('movement','Movement',movement,conf,e.gymStart+e.gymDone,'health',[`${e.gymDone} workouts completed`,e.gymStart?`${e.gymStart} workouts started`:null],'How consistently physical training appears in your routine.'),
      node('routine','Routine',routine,conf,e.doneDays.length,'stability',[`${e.doneDays.length} days with meaningful completion`,`Observed across ${e.days.length} active days`],'How consistently useful actions repeat across days.'),
      node('curiosity','Curiosity',curiosity,conf,e.tubeOpen+e.journal.length,'growth',[`${e.tubeOpen} learning items opened`,e.journal.length?`${e.journal.length} written reflections`:null],'How strongly you explore ideas and continue into deeper material.'),
      node('planning','Planning',planning,conf,e.todoOpen+e.todoAdd,'structure',[`${e.todoOpen} task opens`,e.todoAdd?`${e.todoAdd} tasks added`:null],'How much you use structure, tasks and timing to orient action.'),
      node('adaptability','Adaptability',adaptability,conf,e.days.length+e.multiDays,'growth',[`${e.multiDays} multi-domain days`,`Model has ${e.days.length} observed days`],'How readily your behaviour spans different domains and changes with context.'),
      node('avoidance','Avoidance',avoidance,conf,e.todoOpen+e.tubeOpen,'friction',[e.todoOpen?`${e.todoOpen-e.todoDone} task opens without a recorded completion`:null,e.tubeOpen?`${e.tubeOpen-e.tubeDone} learning opens without a recorded completion`:null],'Possible resistance signals. Higher does not mean a fixed trait; it means HOME sees more starting than finishing.',false),
      node('friction','Friction',friction,conf,e.r.length,'friction',[`Avoidance signal ${Math.round(avoidance)}/100`,'HOME treats taps and dwell as friction clues, not success.'],'How much the current task framing or interface may be getting in your way.',false)
    ];
  }

  function discoveredNodes(e){
    const out=[],totalDone=Math.max(1,e.done.length),best=Object.entries(e.parts).sort((a,b)=>b[1]-a[1])[0];
    if(best&&best[1]>=4){
      const share=100*best[1]/totalDone,label=best[0]==='morning'?'Morning drive':best[0]==='evening'?'Evening drive':best[0]==='midday'?'Midday drive':'Night drive';
      out.push(node(`rhythm_${best[0]}`,label,share,Math.min(95,best[1]*12),best[1],'rhythm',[`${best[1]} meaningful completions in the ${best[0]}`,`${Math.round(share)}% of recorded completions happen there`],`A time-of-day pattern HOME discovered from repeated completion behaviour.`,true));
    }
    if(e.multiDays>=3)out.push(node('balanced_momentum','Balanced momentum',Math.min(100,e.multiDays*13+e.fullDays*8),Math.min(95,e.multiDays*14),e.multiDays,'stability',[`${e.multiDays} days moved at least two domains`,e.fullDays?`${e.fullDays} days moved all three domains`:null],'You often create momentum by combining work, learning and/or movement rather than relying on one domain.',true));
    if((e.learning?.avgDepth||0)>=55&&e.journal.length>=4)out.push(node('reflective_depth','Reflective depth',Math.min(100,e.learning.avgDepth+(e.learning.applicationRate||0)*20),Math.min(95,e.journal.length*10),e.journal.length,'growth',[`${e.journal.length} written learning responses`,`Average answer depth ${Math.round(e.learning.avgDepth)}/100`,e.learning.applicationRate!=null?`Application rate ${Math.round(e.learning.applicationRate*100)}%`:null],'Your learning behaviour is beginning to show explanation and application, not only recall.',true));
    if(e.todoOpen>=6&&pct(e.todoDone,e.todoOpen)>=60)out.push(node('action_bias','Action bias',Math.min(100,pct(e.todoDone,e.todoOpen)+10),Math.min(95,e.todoOpen*7),e.todoOpen,'action',[`Task follow-through ${pct(e.todoDone,e.todoOpen)}%`,`Based on ${e.todoOpen} task opens`],'HOME currently sees a tendency to convert task attention into action.',true));
    if(e.gymDone>=3)out.push(node('training_consistency','Training consistency',Math.min(100,e.gymDone*18),Math.min(95,e.gymDone*16),e.gymDone,'health',[`${e.gymDone} completed workouts in the observation window`],'Physical training is becoming a repeated behavioural pattern rather than a one-off event.',true));
    if(e.tubeOpen>=8&&e.tubeDone>=4)out.push(node('intellectual_exploration','Intellectual exploration',Math.min(100,e.tubeOpen*5+e.tubeDone*7),Math.min(95,(e.tubeOpen+e.tubeDone)*5),e.tubeOpen+e.tubeDone,'growth',[`${e.tubeOpen} learning items explored`,`${e.tubeDone} completed`],'A growing pattern of broad exploration combined with actual completion.',true));
    registry.forEach(def=>{try{const n=def.evaluate?.(e);if(n)out.push({...n,emergent:true})}catch(_) {}});
    return out;
  }

  function buildEdges(nodes,e){
    const ids=new Set(nodes.map(n=>n.id)),edges=[];
    const add=(a,b,w,why)=>{if(ids.has(a)&&ids.has(b)&&a!==b&&!edges.some(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a)))edges.push({a,b,w:clamp(w,8,100),why})};
    add('initiative','follow',72,'Starting action and finishing it repeatedly move together.');
    add('focus','follow',64,'Sustained attention and completion reinforce each other.');
    add('curiosity','learning',78,'Exploration becomes useful when it turns into learning completion.');
    add('planning','initiative',55,'Planning can create a launch point for action.');
    add('routine','follow',68,'Consistency increases the chance that starts become finishes.');
    add('avoidance','friction',82,'Repeated starting without completion is treated as a friction signal.');
    add('adaptability','balanced_momentum',72,'Cross-domain behaviour supports flexible momentum.');
    add('learning','reflective_depth',86,'Written reflection deepens learning evidence.');
    add('movement','training_consistency',88,'Repeated workouts strengthen the movement pattern.');
    add('initiative','action_bias',84,'Fast conversion from intention to completion creates action bias.');
    const rhythm=nodes.find(n=>n.id.startsWith('rhythm_'));if(rhythm){add(rhythm.id,'routine',58,'Repeated timing patterns can become routines.');add(rhythm.id,'focus',46,'Your strongest completion window overlaps with focused action.');}
    return edges;
  }

  function persist(nodes,edges,e){
    const old=load(GRAPH,{version:VERSION,nodes:{},edges:[],history:[]}),now=Date.now(),map=old.nodes||{};
    nodes.forEach(n=>{const prev=map[n.id]||{};map[n.id]={...prev,...n,firstSeen:prev.firstSeen||now,lastSeen:now,maxValue:Math.max(prev.maxValue||0,n.value),maxConfidence:Math.max(prev.maxConfidence||0,n.confidence)};});
    const snapshot={at:now,nodeCount:nodes.length,edgeCount:edges.length,events:e.r.length,days:e.days.length};
    const history=Array.isArray(old.history)?old.history:[];if(!history.length||now-history[history.length-1].at>6*60*60*1000)history.push(snapshot);if(history.length>120)history.splice(0,history.length-120);
    const graph={version:VERSION,updatedAt:now,nodes:map,visible:nodes.map(n=>n.id),edges,history};save(GRAPH,graph);try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState('livingBrainGraphV6',JSON.stringify(graph))}catch(_){}return graph;
  }

  function model(){const e=evidence(),nodes=[...coreNodes(e),...discoveredNodes(e)].filter(n=>n.confidence>=10||!n.emergent).sort((a,b)=>(b.emergent-a.emergent)||(b.confidence-a.confidence));const edges=buildEdges(nodes,e);const graph=persist(nodes,edges,e);return{e,nodes,edges,graph};}

  function ensureStyle(){if(document.getElementById('homeLivingBrainV6Style'))return;const s=document.createElement('style');s.id='homeLivingBrainV6Style';s.textContent=`
    .lb6Intro{padding:8px 0 6px}.lb6Intro h2{margin:0 0 6px;font-size:27px;letter-spacing:-.035em}.lb6Intro p{margin:0;color:rgba(255,255,255,.58);font-size:12.5px;line-height:1.48}.lb6Pills{display:flex;gap:7px;overflow:auto;margin:12px 0}.lb6Pill{flex:0 0 auto;padding:7px 10px;border-radius:999px;background:#151923;border:1px solid rgba(255,255,255,.08);font-size:10px;color:rgba(255,255,255,.68)}
    .lb6Card{border:1px solid rgba(255,255,255,.08);background:#0e1117;border-radius:22px;padding:15px;margin:12px 0}.lb6Card h3{margin:0;font-size:18px}.lb6Sub{font-size:10px;color:rgba(255,255,255,.46);margin:3px 0 12px}.lb6Network{height:470px;border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(74,93,160,.18),rgba(5,7,11,.4) 58%,#07090d);position:relative}.lb6Network svg{width:100%;height:100%;display:block}.lb6Edge{stroke:rgba(142,161,235,.20);stroke-linecap:round}.lb6Edge.strong{stroke:rgba(182,198,255,.42)}.lb6Node{cursor:pointer}.lb6Node circle{fill:#141a27;stroke:rgba(178,191,255,.58);stroke-width:1.4}.lb6Node.emergent circle{fill:#1c1823;stroke:#d8b76d}.lb6Node.friction circle{stroke:#d98f79}.lb6Node text{fill:#fff;text-anchor:middle;pointer-events:none;font-size:10px}.lb6Node .lb6Val{font-size:12px;font-weight:900}.lb6Detail{margin-top:10px;padding:14px;border-radius:17px;background:#161b26;border:1px solid rgba(255,255,255,.06)}.lb6Detail h4{font-size:15px;margin:0 0 4px}.lb6Detail p{font-size:12px;line-height:1.48;color:rgba(255,255,255,.67);margin:5px 0}.lb6Detail ul{margin:8px 0 0;padding-left:18px}.lb6Detail li{font-size:11px;line-height:1.45;color:rgba(255,255,255,.56);margin:3px 0}.lb6Confidence{font-size:9px!important;text-transform:uppercase;letter-spacing:.12em;color:#d5b969!important;font-weight:850}.lb6Summary{font-size:13px!important;color:rgba(255,255,255,.78)!important}.lb6BackupBtn{width:100%;border:0;border-radius:14px;padding:12px 13px;font-weight:850;background:#f1d46a;color:#17150d;margin-top:8px}.lb6Area{width:100%;min-height:88px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#15171c;color:#fff;padding:10px;font-size:10px;margin-top:8px}.lb6Status{font-size:10px;color:rgba(255,255,255,.55);min-height:16px;margin-top:6px}
  `;document.head.appendChild(s)}

  function layout(nodes){const W=620,H=500,cx=W/2,cy=H/2,pos={};nodes.forEach((n,i)=>{const ring=i<6?118:i<12?192:238,idx=i<6?i:i<12?i-6:i-12,countRing=i<6?6:i<12?6:Math.max(1,nodes.length-12),a=-Math.PI/2+idx*(Math.PI*2/countRing)+(i>=6?.25:0);pos[n.id]={x:cx+Math.cos(a)*ring,y:cy+Math.sin(a)*ring}});return{W,H,pos};}

  function summary(m){const positives=m.nodes.filter(n=>!['avoidance','friction'].includes(n.id)).sort((a,b)=>(b.confidence*b.value)-(a.confidence*a.value)).slice(0,3);if(!positives.length)return'HOME is still collecting enough evidence to describe stable patterns.';return `Current pattern: ${positives.map(n=>n.label.toLowerCase()).join(', ')}. These are provisional behavioural signals, not fixed personality labels.`}

  function renderNetwork(m){const host=document.getElementById('lb6Network');if(!host)return;const {W,H,pos}=layout(m.nodes),by=Object.fromEntries(m.nodes.map(n=>[n.id,n]));const edges=m.edges.map(e=>`<line class="lb6Edge ${e.w>=70?'strong':''}" x1="${pos[e.a].x}" y1="${pos[e.a].y}" x2="${pos[e.b].x}" y2="${pos[e.b].y}" stroke-width="${(0.8+e.w/45).toFixed(1)}"></line>`).join('');const nodes=m.nodes.map(n=>{const p=pos[n.id],r=24+Math.min(18,n.confidence*.12);return `<g class="lb6Node ${n.emergent?'emergent':''} ${n.group==='friction'?'friction':''}" data-node="${n.id}" transform="translate(${p.x} ${p.y})"><circle r="${r}"></circle><text y="-4">${esc(n.label)}</text><text class="lb6Val" y="12">${n.value}</text></g>`}).join('');host.innerHTML=`<svg viewBox="0 0 ${W} ${H}"><g>${edges}${nodes}</g></svg>`;host.querySelectorAll('.lb6Node').forEach(g=>g.onclick=()=>showDetail(by[g.dataset.node],m));}

  function showDetail(n,m){const d=document.getElementById('lb6Detail');if(!d||!n)return;const linked=m.edges.filter(e=>e.a===n.id||e.b===n.id).map(e=>{const other=e.a===n.id?e.b:e.a;return m.nodes.find(x=>x.id===other)?.label}).filter(Boolean);d.innerHTML=`<div class="lb6Confidence">${n.confidence}% confidence · ${n.evidenceCount} evidence signals${n.emergent?' · discovered pattern':''}</div><h4>${esc(n.label)} · ${n.value}</h4><p>${esc(n.description)}</p><p>${n.value>=70?'HOME currently sees this as a strong pattern in how you behave.':n.value>=45?'HOME currently sees this as a developing pattern.':'HOME currently sees only a weak or early signal here.'}</p>${n.reasons.length?`<ul>${n.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${linked.length?`<p><b>Connected with:</b> ${esc(linked.slice(0,4).join(', '))}</p>`:''}`;}

  function render(){ensureStyle();const o=document.getElementById('homeBehaviourOverlayV4');if(!o)return false;const body=o.querySelector('#hbcBody')||o.querySelector('#hb4Body');if(!body)return false;const m=model(),newNodes=m.nodes.filter(n=>n.emergent);body.innerHTML=`
    <div class="lb6Intro"><h2>Your living model</h2><p>${esc(summary(m))}</p></div>
    <div class="lb6Pills"><span class="lb6Pill">${m.e.r.length} signals</span><span class="lb6Pill">${m.e.days.length} observed days</span><span class="lb6Pill">${m.nodes.length} active nodes</span><span class="lb6Pill">${m.edges.length} live connections</span></div>
    <div class="lb6Card"><h3>Living self-map</h3><div class="lb6Sub">Tap a node. The network can add new fields and links as evidence accumulates.</div><div class="lb6Network" id="lb6Network"></div><div class="lb6Detail" id="lb6Detail"><div class="lb6Confidence">MODEL IS PROVISIONAL</div><h4>Explore a node</h4><p>HOME explains what it currently sees, why the score exists, and how much evidence supports it.</p></div></div>
    <div class="lb6Card"><h3>How HOME currently reads you</h3><div class="lb6Sub">Behavioural interpretation, not a fixed personality verdict.</div><p class="lb6Summary">${esc(summary(m))}</p>${newNodes.length?`<p class="lb6Summary"><b>Newly discovered:</b> ${esc(newNodes.slice(0,5).map(n=>n.label).join(', '))}.</p>`:''}</div>
    <div class="lb6Card"><h3>Evidence base</h3><div class="lb6Sub">The graph grows from repeated behaviour, not one-off taps.</div><p class="lb6Summary">${m.e.todoDone} task completions · ${m.e.tubeDone} learning completions · ${m.e.gymDone} workouts · ${m.e.multiDays} multi-domain days.</p></div>
    <div class="lb6Card"><h3>State safety</h3><div class="lb6Sub">Create a portable HOME2 backup before replacing an installation.</div><button class="lb6BackupBtn" id="lb6MakeBackup" type="button">Create current backup code</button><textarea class="lb6Area" id="lb6BackupOut" readonly></textarea><button class="lb6BackupBtn" id="lb6CopyBackup" type="button">Copy backup code</button><div class="lb6Status" id="lb6BackupStatus"></div></div>`;
    renderNetwork(m);
    const out=body.querySelector('#lb6BackupOut'),status=body.querySelector('#lb6BackupStatus');
    body.querySelector('#lb6MakeBackup').onclick=()=>{try{out.value=window.HOMEClassicBrain?.backup?.()||'';status.textContent=out.value?'Backup created from the current HOME state.':'Backup engine unavailable.'}catch(e){status.textContent='Backup failed.'}};
    body.querySelector('#lb6CopyBackup').onclick=async()=>{if(!out.value){status.textContent='Create the backup first.';return}try{await navigator.clipboard.writeText(out.value);status.textContent='Backup copied.'}catch(e){out.focus();out.select();status.textContent='Selected — copy manually if needed.'}};
    return true;
  }

  function open(){const o=document.getElementById('homeBehaviourOverlayV4');if(!o)return false;render();o.classList.add('show');document.body.style.overflow='hidden';return true}
  function repair(){ensureStyle();const b=document.getElementById('homeDayScoreV4');if(b&&!b.dataset.lb6){b.dataset.lb6='1';b.onclick=e=>{e.preventDefault();e.stopPropagation();if(!open())window.HOMEClassicBrain?.open?.()}}}

  window.HOMELivingBrainV6={version:VERSION,model,open,render,repair,registerFacet};
  repair();setTimeout(repair,400);setTimeout(repair,1400);setInterval(()=>{repair();try{model()}catch(_){}},30000);
})();