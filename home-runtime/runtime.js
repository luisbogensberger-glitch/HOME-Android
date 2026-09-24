/* HOME remote runtime v2 — hot-swappable without an APK rebuild. */
(function(){
  'use strict';
  const VERSION=2;
  const GYM_KEY='homeGymStateV1';

  window.HOMERemote={version:VERSION,loadedAt:Date.now(),capabilities:{tubeStructure:true,todoStructure:true,quizFormats:true,readerFormats:true,swipeModes:true,visualTheme:true,gym:true,richText:true}};
  document.documentElement.dataset.homeRemoteRuntime=String(VERSION);

  const log=(type,data)=>{try{if(window.homeAdaptiveLog)window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const escText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* Allow only the tiny formatting vocabulary used by HOME cards. This fixes literal
     <b>…</b> text while keeping remote card content constrained. */
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
