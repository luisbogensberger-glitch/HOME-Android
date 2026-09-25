/* HOME Habit Adaptation v1 — goal-aware, low-friction behaviour shaping that learns which UI interventions actually work. */
(function(){
  'use strict';
  if(window.__HOME_HABIT_ADAPTATION_V1__)return;window.__HOME_HABIT_ADAPTATION_V1__=true;

  const VERSION=1;
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const STATE_KEY='homeHabitAdaptationV1';
  const DAY=86400000;
  const HOUR=3600000;
  const VARIANTS=['tiny','choice','meaning','novelty'];
  const PRIOR={
    source:'16Personalities',
    type:'ENFP-T',
    weight:.15,
    note:'Weak starting prior only. Observed behaviour overrides this.',
    variantBias:{tiny:.18,choice:.26,meaning:.25,novelty:.31}
  };
  const DOMAIN={
    gym:{success:['gym_complete','gym_micro_complete'],engage:['gym_open','gym_start','gym_plan_select'],selector:'#homeScreen .homeCard.gym'},
    todos:{success:['todo_complete'],engage:['todo_open'],selector:'#homeScreen .homeCard.todos'},
    tube:{success:['tube_complete'],engage:['tube_card_open'],selector:'#homeScreen .homeCard.tube'}
  };

  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now=()=>Date.now();
  const dayKey=t=>{const d=new Date(t||now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const rows=(days=30)=>{const since=now()-days*DAY,v=load(ACTIVITY_KEY,[]);return Array.isArray(v)?v.filter(x=>Number(x.at)>=since):[]};
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};

  function blankStats(){const out={};VARIANTS.forEach(v=>out[v]={wins:0,losses:0});return out}
  function initialState(){return{version:VERSION,firstSeen:now(),personaPrior:PRIOR,domains:{gym:{stats:blankStats()},todos:{stats:blankStats()},tube:{stats:blankStats()}},updatedAt:now()}}
  function state(){
    const s=load(STATE_KEY,initialState());s.version=VERSION;s.personaPrior=PRIOR;s.domains=s.domains||{};
    Object.keys(DOMAIN).forEach(k=>{s.domains[k]=s.domains[k]||{};s.domains[k].stats=s.domains[k].stats||blankStats();VARIANTS.forEach(v=>s.domains[k].stats[v]=s.domains[k].stats[v]||{wins:0,losses:0})});
    return s;
  }
  function commit(s){s.updatedAt=now();save(STATE_KEY,s)}

  function eventsFor(domain,types,days=30){const set=new Set(types);return rows(days).filter(r=>set.has(r.type))}
  function latestAt(list){return list.reduce((m,r)=>Math.max(m,Number(r.at)||0),0)}
  function domainSignals(domain){
    const cfg=DOMAIN[domain],s=state(),d=s.domains[domain],success=eventsFor(domain,cfg.success),engage=eventsFor(domain,cfg.engage);
    const lastSuccess=latestAt(success),lastEngage=latestAt(engage),baseline=Math.min(Number(s.firstSeen)||now(),latestAt(rows(30))||now());
    const inactiveFrom=lastSuccess||baseline;
    const inactiveDays=Math.max(0,(now()-inactiveFrom)/DAY);
    const opens7=engage.filter(r=>r.at>=now()-7*DAY).length,success7=success.filter(r=>r.at>=now()-7*DAY).length;
    const conversion=opens7?success7/opens7:(success7?1:0);
    const todaySuccess=success.some(r=>dayKey(r.at)===dayKey());
    return{domain,lastSuccess,lastEngage,inactiveDays,opens7,success7,conversion,todaySuccess};
  }

  function levelFor(sig){
    if(sig.todaySuccess)return 0;
    if(sig.inactiveDays>=7)return 3;
    if(sig.inactiveDays>=4)return 2;
    if(sig.inactiveDays>=2)return 1;
    if(sig.opens7>=3&&sig.conversion<.25)return 2;
    return 0;
  }

  function settleExpired(s){
    Object.keys(DOMAIN).forEach(domain=>{
      const d=s.domains[domain],a=d.activeExperiment;if(!a||a.settled)return;
      const success=eventsFor(domain,DOMAIN[domain].success,10).some(r=>Number(r.at)>Number(a.shownAt));
      if(success){d.stats[a.variant].wins++;a.settled=true;a.outcome='success';a.settledAt=now();return}
      if(now()-Number(a.shownAt)>20*HOUR){d.stats[a.variant].losses++;a.settled=true;a.outcome='no_action';a.settledAt=now()}
    });
  }

  function chooseVariant(domain,level){
    const s=state();settleExpired(s);const d=s.domains[domain],today=dayKey();
    if(d.activeExperiment&&!d.activeExperiment.settled&&dayKey(d.activeExperiment.shownAt)===today){commit(s);return d.activeExperiment.variant}
    const total=VARIANTS.reduce((n,v)=>n+d.stats[v].wins+d.stats[v].losses,0)+1;
    const ranked=VARIANTS.map(v=>{
      const st=d.stats[v],prior=PRIOR.variantBias[v]||.25,n=st.wins+st.losses;
      const observed=(st.wins+prior*2)/(n+2),explore=.34*Math.sqrt(Math.log(total+2)/(n+1));
      let score=observed+explore;
      if(level>=2&&v==='tiny')score+=.12;
      if(level===1&&v==='choice')score+=.06;
      return{v,score};
    }).sort((a,b)=>b.score-a.score||a.v.localeCompare(b.v));
    const variant=ranked[0]?.v||'tiny';
    d.activeExperiment={variant,shownAt:now(),day:today,level,settled:false};commit(s);
    log('habit_experiment_shown',{domain,variant,level});return variant;
  }

  function markSuccess(domain,type){
    const s=state(),d=s.domains[domain],a=d.activeExperiment;
    if(a&&!a.settled&&now()-Number(a.shownAt)<48*HOUR){d.stats[a.variant].wins++;a.settled=true;a.outcome=type||'success';a.settledAt=now()}
    d.lastSuccessAt=now();d.recoveryUntil=now()+20*HOUR;commit(s);
  }

  function copyFor(domain,variant,level){
    const strong=level>=2;
    const map={
      gym:{
        tiny:{metric:'2 MIN',title:'Move now',body:strong?'8 squats · 6 push-ups · 20s plank':'A tiny start counts. No gym bag needed.',action:'micro'},
        choice:{metric:'YOUR CALL',title:'Pick the easy start',body:'2-minute reset now — or open the full workout.',action:'micro'},
        meaning:{metric:'ENERGY',title:'Create momentum',body:'Do something physical before waiting to feel motivated.',action:'micro'},
        novelty:{metric:'WILDCARD',title:'Today’s mini challenge',body:strong?'10 squats · 8 push-ups · 30s plank':'One different mini-session. Then decide if you want more.',action:'micro'}
      },
      todos:{
        tiny:{metric:'5 MIN',title:'One small win',body:'Open To-dos and do the smallest useful next action.',action:'open'},
        choice:{metric:'PICK ONE',title:'Make the first move',body:'Choose either the easiest task or the most important one.',action:'open'},
        meaning:{metric:'PROACTIVE',title:'Act before reacting',body:'Move one important thing forward before new inputs take over.',action:'open'},
        novelty:{metric:'FRESH START',title:'Change the angle',body:'Open To-dos — HOME will surface a different first target today.',action:'open'}
      },
      tube:{
        tiny:{metric:'3 MIN',title:'One idea only',body:'No feed commitment. Learn one useful thing and leave.',action:'open'},
        choice:{metric:'2 CHOICES',title:'Pick what pulls you in',body:'Choose one useful card. Ignore the rest.',action:'open'},
        meaning:{metric:'BUILD',title:'Sharpen one edge',body:'One idea that can improve a decision, habit or conversation.',action:'open'},
        novelty:{metric:'SURPRISE',title:'Give me something new',body:'Open Tube for one deliberately different idea.',action:'open'}
      }
    };
    return map[domain]?.[variant]||map[domain]?.tiny;
  }

  function ensureStyle(){
    let s=document.getElementById('homeHabitAdaptV1Style');if(s)return;
    s=document.createElement('style');s.id='homeHabitAdaptV1Style';s.textContent=`
      .homeCard[data-habit-level="1"],.homeCard[data-habit-level="2"],.homeCard[data-habit-level="3"]{position:relative;overflow:hidden!important}
      .homeCard[data-habit-level="2"]{transform:translateY(-1px)}
      .homeCard[data-habit-level="3"]{transform:translateY(-2px)}
      .homeHabitCue{margin-top:8px;display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.78)}
      .homeHabitCue:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.7;box-shadow:0 0 0 4px rgba(255,255,255,.05)}
      .homeCard[data-habit-domain="gym"][data-habit-level="2"] .homeHabitCue,.homeCard[data-habit-domain="gym"][data-habit-level="3"] .homeHabitCue{color:#d7ffc8}
      .homeHabitSheet{position:fixed;inset:0;z-index:12000;background:rgba(6,8,11,.68);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);display:flex;align-items:flex-end;padding:0}
      .homeHabitPanel{width:100%;box-sizing:border-box;background:#11161c;border:1px solid rgba(255,255,255,.12);border-radius:28px 28px 0 0;padding:22px 18px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -24px 70px rgba(0,0,0,.5)}
      .homeHabitEyebrow{font-size:10px;font-weight:900;letter-spacing:.12em;color:#95a2b0;text-transform:uppercase}.homeHabitPanel h2{margin:6px 0 5px;color:#fff;font-size:26px;line-height:1.05}.homeHabitPanel p{margin:0 0 17px;color:#aeb8c3;font-size:13px;line-height:1.45}
      .homeHabitMoves{display:grid;gap:8px;margin:12px 0 18px}.homeHabitMove{display:flex;justify-content:space-between;gap:12px;padding:12px 13px;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:rgba(255,255,255,.035);color:#f5f7fa}.homeHabitMove span{color:#97a2ae;font-size:12px}
      .homeHabitActions{display:grid;grid-template-columns:1fr 1.35fr;gap:9px}.homeHabitActions button{border:0;border-radius:15px;padding:14px 12px;font-weight:850;font-size:13px}.homeHabitSecondary{background:#202730;color:#d8dee5}.homeHabitPrimary{background:#eef3f7;color:#101419}.homeHabitDone{background:#dfffd3!important;color:#142015!important}
      html[data-habit-recovery="gym"] #homeScreen .homeCard.gym{order:1!important}
      html[data-habit-recovery="todos"] #homeScreen .homeCard.todos{order:1!important}
      html[data-habit-recovery="tube"] #homeScreen .homeCard.tube{order:1!important}
      html[data-habit-recovery] #homeScreen .homeCard.calendar{order:0!important}
    `;document.head.appendChild(s);
  }

  function setCardText(card,domain,copy,level){
    card.dataset.habitDomain=domain;card.dataset.habitLevel=String(level);card.dataset.habitVariant=copy.variant||'';
    const headMetric=card.querySelector('.homeCardMetric');if(headMetric)headMetric.textContent=copy.metric;
    const title=card.querySelector('.homeSummary h2');if(title)title.textContent=copy.title;
    const body=card.querySelector('.homeSummary p');if(body)body.textContent=copy.body;
    let cue=card.querySelector('.homeHabitCue');if(!cue){cue=document.createElement('div');cue.className='homeHabitCue';const summary=card.querySelector('.homeSummary');(summary||card).appendChild(cue)}
    cue.textContent=level>=3?'HOME is lowering the friction':level===2?'Tiny start available':'A lighter entry point';
  }

  function clearCard(card,domain){
    if(!card)return;card.removeAttribute('data-habit-level');card.removeAttribute('data-habit-domain');card.removeAttribute('data-habit-variant');card.querySelector('.homeHabitCue')?.remove();
    if(domain==='gym'){card.onclick=window.openHomeGym||card.onclick;try{window.__homeRemoteV2Refresh&&window.__homeRemoteV2Refresh()}catch(e){}}
  }

  function microPlan(){
    const gym=domainSignals('gym'),s=state().domains.gym;
    const wins=Object.values(s.stats).reduce((n,x)=>n+Number(x.wins||0),0);
    if(gym.inactiveDays>=7||wins<2)return{title:'2-minute reset',intro:'Small enough to start without negotiating with yourself.',moves:[['Squats','8 reps'],['Push-ups','6 reps'],['Plank','20 sec']]};
    return{title:'4-minute reset',intro:'You’ve shown the tiny start works. Add just a little more.',moves:[['Squats','12 reps'],['Push-ups','10 reps'],['Reverse lunges','8 / side'],['Plank','30 sec']]};
  }

  function openMicroGym(){
    document.querySelector('.homeHabitSheet')?.remove();const p=microPlan(),sheet=document.createElement('div');sheet.className='homeHabitSheet';
    sheet.innerHTML=`<div class="homeHabitPanel"><div class="homeHabitEyebrow">MOVE · LOW FRICTION</div><h2>${esc(p.title)}</h2><p>${esc(p.intro)}</p><div class="homeHabitMoves">${p.moves.map(x=>`<div class="homeHabitMove"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('')}</div><div class="homeHabitActions"><button class="homeHabitSecondary" type="button">Full workout</button><button class="homeHabitPrimary" type="button">Start now</button></div></div>`;
    document.body.appendChild(sheet);log('gym_micro_open',{title:p.title});
    let started=false,startAt=0;const secondary=sheet.querySelector('.homeHabitSecondary'),primary=sheet.querySelector('.homeHabitPrimary');
    secondary.onclick=()=>{sheet.remove();try{window.openHomeGym&&window.openHomeGym()}catch(e){}};
    primary.onclick=()=>{
      if(!started){started=true;startAt=now();primary.textContent='Mark done';primary.classList.add('homeHabitDone');log('gym_micro_start',{title:p.title});return}
      const sec=Math.max(1,Math.round((now()-startAt)/1000));log('gym_micro_complete',{title:p.title,seconds:sec});log('gym_complete',{plan:'micro',minutes:Math.max(1,Math.round(sec/60)),completed:p.moves.length,total:p.moves.length,micro:true});markSuccess('gym','micro');sheet.remove();applyAll();
    };
    sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.remove()});
  }

  function applyDomain(domain){
    const sig=domainSignals(domain),s=state(),d=s.domains[domain],level=(d.recoveryUntil&&now()<d.recoveryUntil)?0:levelFor(sig),card=document.querySelector(DOMAIN[domain].selector);
    if(!card)return{domain,level,sig};
    if(level===0){clearCard(card,domain);return{domain,level,sig}}
    const variant=chooseVariant(domain,level),copy={...copyFor(domain,variant,level),variant};setCardText(card,domain,copy,level);
    if(domain==='gym'&&copy.action==='micro')card.onclick=(e)=>{e?.preventDefault?.();e?.stopPropagation?.();openMicroGym()};
    return{domain,level,sig,variant};
  }

  function recoveryPriority(results){
    const candidates=results.filter(x=>x.level>0).sort((a,b)=>b.level-a.level||b.sig.inactiveDays-a.sig.inactiveDays);
    const chosen=candidates[0];if(chosen)document.documentElement.dataset.habitRecovery=chosen.domain;else delete document.documentElement.dataset.habitRecovery;
  }

  function patchLog(){
    if(typeof window.homeAdaptiveLog!=='function'||window.homeAdaptiveLog.__habitAdaptV1)return;
    const base=window.homeAdaptiveLog;const wrapped=function(type,data){const out=base.apply(this,arguments);if(type==='todo_complete')markSuccess('todos',type);if(type==='tube_complete')markSuccess('tube',type);if(type==='gym_complete'||type==='gym_micro_complete')markSuccess('gym',type);if(['todo_complete','tube_complete','gym_complete','gym_micro_complete'].includes(type))setTimeout(applyAll,80);return out};wrapped.__habitAdaptV1=true;window.homeAdaptiveLog=wrapped;
  }

  function applyAll(){
    ensureStyle();patchLog();const s=state();settleExpired(s);commit(s);
    const results=['gym','todos','tube'].map(applyDomain);recoveryPriority(results);
    document.documentElement.dataset.habitAdaptation=String(VERSION);
    try{window.HOMEHabitAdaptation={version:VERSION,signals:()=>Object.fromEntries(Object.keys(DOMAIN).map(k=>[k,domainSignals(k)])),state:()=>state(),openMicroGym,refresh:applyAll}}catch(e){}
  }

  applyAll();setTimeout(applyAll,700);setTimeout(applyAll,2200);setInterval(applyAll,15000);
  log('habit_adaptation_ready',{version:VERSION,personaPrior:PRIOR.type,priorWeight:PRIOR.weight});
})();
