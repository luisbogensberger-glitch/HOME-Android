/* HOME Adaptive Runtime
 * Stable APK-side interpreter. Design, layout, quiz and density settings come from
 * adaptive-ui.json so normal UI experiments do not require a new APK.
 */
(function(){
  'use strict';
  const CONFIG_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/adaptive-ui.json';
  const CONFIG_CACHE='homeAdaptiveConfigV1';
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const LOCAL_OVERRIDE_KEY='homeAdaptiveLocalOverrideV1';
  const LAST_ADAPT_KEY='homeAdaptiveLastAdaptV1';
  const MAX_ACTIVITY=600;

  const defaults={
    version:1,
    theme:{radius:22,density:'comfortable',motion:'smooth',accent:'#8ea8ff',surfaceOpacity:.78},
    tube:{layout:'stack',visibleCount:5,cardImageRatio:.34,showHooks:true,showTopic:true,readerDepth:'balanced',sectionLimit:3,paragraphScale:1,quizMode:'mcq_sentence',sentenceMinWords:5,sentenceTargetWords:14,completionAction:'replace_card',swipeDirection:'vertical'},
    todos:{layout:'cards',maxVisible:8,showMeta:true,showArea:true,showMinutes:true,showNotes:false,groupBy:'none',archiveCollapsed:true,focusCount:3},
    notifications:{enabled:false},
    adaptation:{enabled:true,localDaily:true,allowLayoutChanges:true,allowQuizChanges:true,allowDensityChanges:true,minEventsBeforeChange:12,cooldownHours:20}
  };

  let config=clone(defaults);
  let screenEnteredAt=Date.now();
  let screenName=(typeof currentScreen==='string'?currentScreen:'home');
  let readerOpenedAt=0;
  let readerCardId='';

  function clone(v){return JSON.parse(JSON.stringify(v))}
  function isObj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
  function merge(a,b){
    const out=clone(a);
    if(!isObj(b))return out;
    Object.keys(b).forEach(k=>{
      if(isObj(b[k])&&isObj(out[k]))out[k]=merge(out[k],b[k]);
      else out[k]=b[k];
    });
    return out;
  }
  function clamp(n,min,max){n=Number(n);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min}
  function html(v){
    if(typeof esc==='function')return esc(String(v??''));
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function loadJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')||fallback}catch(e){return fallback}}
  function saveJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}

  function activities(){const rows=loadJson(ACTIVITY_KEY,[]);return Array.isArray(rows)?rows:[]}
  function adaptiveLog(type,data){
    const row={id:'a-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),type,at:Date.now(),screen:screenName,data:data||{}};
    const rows=activities();rows.push(row);if(rows.length>MAX_ACTIVITY)rows.splice(0,rows.length-MAX_ACTIVITY);saveJson(ACTIVITY_KEY,rows);
    try{
      if(typeof AdaptiveNative!=='undefined'&&AdaptiveNative&&typeof AdaptiveNative.logActivity==='function')AdaptiveNative.logActivity(JSON.stringify(row));
    }catch(e){}
    return row;
  }
  window.homeAdaptiveLog=adaptiveLog;

  function recentRows(days){const since=Date.now()-days*86400000;return activities().filter(x=>Number(x.at)>=since)}
  function dailyLocalOverride(base){
    const ad=base.adaptation||{};
    if(!ad.enabled||!ad.localDaily)return {};
    const last=Number(localStorage.getItem(LAST_ADAPT_KEY)||0);
    const cooldown=clamp(ad.cooldownHours||20,8,72)*3600000;
    if(Date.now()-last<cooldown)return loadJson(LOCAL_OVERRIDE_KEY,{});
    const rows=recentRows(7);
    if(rows.length<clamp(ad.minEventsBeforeChange||12,6,100))return loadJson(LOCAL_OVERRIDE_KEY,{});

    const opens=rows.filter(x=>x.type==='tube_card_open');
    const completes=rows.filter(x=>x.type==='tube_complete');
    const scores=completes.map(x=>Number(x.data&&x.data.score)).filter(Number.isFinite);
    const rate=opens.length?completes.length/opens.length:0;
    const avgScore=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
    const dwell=rows.filter(x=>x.type==='tube_reader_dwell').map(x=>Number(x.data&&x.data.ms)).filter(n=>n>0&&n<3600000);
    const avgDwell=dwell.length?dwell.reduce((a,b)=>a+b,0)/dwell.length:0;
    const todoDone=rows.filter(x=>x.type==='todo_complete').length;
    const todoOpen=rows.filter(x=>x.type==='todo_open').length;
    const override={tube:{},todos:{},theme:{}};

    if(ad.allowDensityChanges){
      if(opens.length>=5&&rate<.38){override.tube.readerDepth='compact';override.tube.sectionLimit=2;override.tube.visibleCount=3;override.theme.density='compact'}
      else if(completes.length>=4&&rate>.72&&avgScore>=78){override.tube.readerDepth='deep';override.tube.sectionLimit=5;override.tube.visibleCount=5;override.theme.density='comfortable'}
      else {override.tube.readerDepth='balanced';override.tube.sectionLimit=3}
    }
    if(ad.allowLayoutChanges&&opens.length>=7){
      if(avgDwell>0&&avgDwell<75000&&rate<.6)override.tube.layout='swipe';
      else if(rate>.68)override.tube.layout='stack';
    }
    if(ad.allowQuizChanges&&completes.length>=4){
      if(avgScore<68)override.tube.quizMode='mcq_sentence';
      else if(avgScore>86)override.tube.quizMode='mixed';
      else override.tube.quizMode='mcq';
    }
    if(todoOpen>=4&&todoDone/Math.max(1,todoOpen)<.35){override.todos.layout='focus';override.todos.focusCount=3;override.todos.showNotes=false}
    else if(todoDone>=3){override.todos.layout='cards'}

    saveJson(LOCAL_OVERRIDE_KEY,override);
    localStorage.setItem(LAST_ADAPT_KEY,String(Date.now()));
    adaptiveLog('adaptive_profile_updated',{tubeRate:Number(rate.toFixed(2)),avgScore:Math.round(avgScore||0),avgReaderSeconds:Math.round((avgDwell||0)/1000),events:rows.length});
    return override;
  }

  function applyTheme(){
    const t=config.theme||{};
    const root=document.documentElement;
    root.style.setProperty('--adaptive-radius',clamp(t.radius||22,12,36)+'px');
    root.style.setProperty('--adaptive-accent',String(t.accent||'#8ea8ff'));
    root.style.setProperty('--adaptive-surface-opacity',String(clamp(t.surfaceOpacity??.78,.45,.95)));
    root.dataset.homeDensity=t.density||'comfortable';
    root.dataset.homeMotion=t.motion||'smooth';
    const tube=document.getElementById('tubeScreen');if(tube)tube.dataset.adaptiveLayout=config.tube?.layout||'stack';
    const todos=document.getElementById('todosScreen');if(todos)todos.dataset.adaptiveLayout=config.todos?.layout||'cards';
  }

  async function fetchConfig(){
    let remote=null;
    try{
      const r=await fetch(CONFIG_URL+'?v='+Date.now(),{cache:'no-store'});
      if(r.ok){const txt=await r.text();if(txt.length<120000)remote=JSON.parse(txt)}
    }catch(e){}
    if(remote){saveJson(CONFIG_CACHE,remote)}else remote=loadJson(CONFIG_CACHE,{});
    const local=dailyLocalOverride(merge(defaults,remote));
    config=merge(merge(defaults,remote),local);
    window.HOMEAdaptive.config=config;
    applyTheme();
    if(typeof renderTodos==='function'&&screenName==='todos')try{renderTodos()}catch(e){}
    if(typeof renderDeck==='function'&&screenName==='tube')try{renderDeck()}catch(e){}
    scheduleConfiguredNotifications();
    return config;
  }

  function scheduleConfiguredNotifications(){
    const n=config.notifications||{};
    if(!n.enabled||typeof AdaptiveNative==='undefined')return;
    try{
      const asked=localStorage.getItem('homeNotificationPromptedV1')==='1';
      if(!AdaptiveNative.hasNotificationPermission()&&!asked){localStorage.setItem('homeNotificationPromptedV1','1');AdaptiveNative.requestNotificationPermission()}
    }catch(e){}
    const schedule=(id,spec)=>{
      if(!spec||!spec.enabled||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(spec.time||''))return;
      const [h,m]=spec.time.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);if(d.getTime()<=Date.now()+30000)d.setDate(d.getDate()+1);
      try{AdaptiveNative.scheduleNotification(id,String(spec.title||'HOME'),String(spec.body||''),d.getTime())}catch(e){}
    };
    schedule('learning-reminder',n.learningReminder);
    schedule('todo-reminder',n.todoReminder);
  }

  function patchScreenTracking(){
    if(typeof window.showScreen!=='function'||window.showScreen.__adaptive)return;
    const base=window.showScreen;
    function wrapped(name){
      const now=Date.now();if(screenName)adaptiveLog('screen_dwell',{name:screenName,ms:now-screenEnteredAt});
      const result=base.apply(this,arguments);screenName=String(name||'');screenEnteredAt=now;adaptiveLog('screen_open',{name:screenName});
      setTimeout(()=>{applyTheme();if(screenName==='todos'&&typeof renderTodos==='function')renderTodos();if(screenName==='tube'&&typeof renderDeck==='function')renderDeck()},0);
      return result;
    }
    wrapped.__adaptive=true;window.showScreen=wrapped;
  }

  function patchTodos(){
    if(typeof window.renderTodos!=='function'||window.renderTodos.__adaptive)return;
    const base=window.renderTodos;
    function wrapped(){
      const result=base.apply(this,arguments);const cfg=config.todos||{};const list=document.getElementById('todoList');if(!list)return result;
      const active=[...list.querySelectorAll('.todo:not(.archiveItem)')];
      list.dataset.layout=cfg.layout||'cards';
      active.forEach((el,i)=>{
        el.classList.toggle('adaptiveHidden',i>=clamp(cfg.maxVisible||99,1,99));
        const meta=el.querySelector('.todoMeta');if(meta)meta.classList.toggle('adaptiveMetaHidden',cfg.showMeta===false);
        const tag=el.querySelector('.tag');if(tag)tag.classList.toggle('adaptiveMetaHidden',cfg.showArea===false);
      });
      list.querySelectorAll('.adaptiveMore').forEach(x=>x.remove());
      const hidden=active.filter(x=>x.classList.contains('adaptiveHidden'));
      if(hidden.length){const b=document.createElement('button');b.className='adaptiveMore';b.textContent=`Show ${hidden.length} more`;b.onclick=()=>{hidden.forEach(x=>x.classList.remove('adaptiveHidden'));b.remove();adaptiveLog('todo_show_more',{count:hidden.length})};list.appendChild(b)}
      if((cfg.layout||'cards')==='focus'){
        const focus=clamp(cfg.focusCount||3,1,6);active.forEach((el,i)=>el.classList.toggle('adaptiveSecondary',i>=focus));
      }
      return result;
    }
    wrapped.__adaptive=true;window.renderTodos=wrapped;

    if(typeof window.openTodoDetail==='function'&&!window.openTodoDetail.__adaptive){const old=window.openTodoDetail;const w=function(id){adaptiveLog('todo_open',{id:String(id||'')});return old.apply(this,arguments)};w.__adaptive=true;window.openTodoDetail=w}
    if(typeof window.completeTodo==='function'&&!window.completeTodo.__adaptive){const old=window.completeTodo;const w=function(id){adaptiveLog('todo_complete',{id:String(id||''),openBefore:Array.isArray(todoState?.active)?todoState.active.length:null});return old.apply(this,arguments)};w.__adaptive=true;window.completeTodo=w}
    if(typeof window.addTodo==='function'&&!window.addTodo.__adaptive){const old=window.addTodo;const w=function(){adaptiveLog('todo_add',{});return old.apply(this,arguments)};w.__adaptive=true;window.addTodo=w}
  }

  function chooseQuizMode(card){
    const mode=config.tube?.quizMode||'mcq_sentence';
    if(mode!=='mixed')return mode;
    const n=Array.isArray(tubeState?.completed)?tubeState.completed.length:0;
    if((n+1)%4===0)return 'flashcard';
    if((n+1)%3===0)return 'reflection';
    return n%2===0?'mcq':'mcq_sentence';
  }
  function sentenceGrade(card,text){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean);const low=String(text||'').toLowerCase();let score=0;const checks=[];
    const target=clamp(config.tube?.sentenceTargetWords||14,6,50);
    if(words.length>=Math.max(7,Math.round(target*.6))){score+=34;checks.push('clear enough to evaluate')}else checks.push('make it a little more complete');
    const keys=Array.isArray(card.keywords)?card.keywords:[];const hits=keys.filter(k=>low.includes(String(k).toLowerCase())).length;
    if(!keys.length||hits>=1){score+=33;checks.push('uses the core idea')}else checks.push('name the core idea more explicitly');
    if(/\b(i|my|when|before|during|because|so that|to verify|to understand|would|could|for|with|at)\b/i.test(text)){score+=33;checks.push('connects it to a situation or action')}else checks.push('add a concrete situation or action');
    return{score:Math.min(100,score),checks,words:words.length};
  }

  function adaptiveOpenCard(id,slot){
    const c=cardMap[id];if(!c)return;
    const mode=chooseQuizMode(c);const depth=config.tube?.readerDepth||'balanced';let sectionLimit=clamp(config.tube?.sectionLimit||3,1,8);if(depth==='compact')sectionLimit=Math.min(sectionLimit,2);if(depth==='deep')sectionLimit=Math.max(sectionLimit,5);
    const sections=(Array.isArray(c.sections)?c.sections:[]).slice(0,sectionLimit);
    deck.classList.add('hidden');reader.classList.add('show');document.getElementById('tubeHeader')?.classList.add('hidden');
    readerOpenedAt=Date.now();readerCardId=id;adaptiveLog('tube_card_open',{id:c.id,topic:c.topic||'',mode,depth});
    const options=Array.isArray(c.options)?c.options:[];
    const quizHtml=mode==='flashcard'
      ? `<div class="quiz adaptiveQuiz"><h2>Recall</h2><div class="question">${html(c.q)}</div><button class="submit adaptiveReveal" id="adaptiveReveal">Reveal answer</button><div class="feedback" id="feedback"></div><div class="adaptiveConfidence" id="adaptiveConfidence"><button data-score="100">Got it</button><button data-score="55">Needs work</button></div></div>`
      : `<div class="quiz adaptiveQuiz" data-mode="${html(mode)}"><h2>${mode==='reflection'?'One-sentence recall':'Quick quiz'}</h2>${mode==='reflection'?'':`<div class="question">${html(c.q)}</div><div class="options">${options.map((o,n)=>`<button class="option" data-n="${n}"><span class="letter">${String.fromCharCode(65+n)}</span><span>${html(o)}</span></button>`).join('')}</div>`}${mode==='mcq'?'':`<div class="prompt">One-sentence prompt</div><div class="promptText">${html(c.prompt||c.q)}</div><textarea class="answer" id="answer" inputmode="text" autocomplete="off" autocapitalize="sentences" placeholder="Type one useful sentence…"></textarea>`}<button class="submit" id="submit" disabled>Submit</button><div class="feedback" id="feedback"></div><button class="next" id="next">Done — choose another card</button><div class="tiny">Progress is saved automatically.</div></div>`;
    reader.innerHTML=`<button class="readerBack" id="readerBack">← Cards</button><div class="hero" style="background-image:url('${html(c.img)}')"><div class="heroText"><div class="heroMeta">${html(c.icon)} ${html(c.time)} · ${html(c.topic)}</div><h1>${html(c.title)}</h1></div></div><div class="content adaptiveReader"><div class="lead">${html(c.lead)}</div>${sections.map(s=>`<div class="section"><h3>${html(s[0])}</h3><p>${html(s[1])}</p></div>`).join('')}<div class="takeaway"><b>Takeaway</b><br>${html(c.takeaway)}</div>${quizHtml}</div>`;
    document.getElementById('readerBack').onclick=()=>closeReader();

    const finish=(score,extra)=>{
      const completed={id:c.id,title:c.title,total:Math.round(score),mode,at:Date.now()};tubeState.completed.push(completed);delete tubeState.drafts[id];const active=tubeState.activeIds.slice();if((config.tube?.completionAction||'replace_card')==='replace_card')tubeState.activeIds[slot]=nextCardId(active);saveStore('tubeState',tubeState);updateHome();adaptiveLog('tube_complete',{id:c.id,score:Math.round(score),mode,...(extra||{})});
    };

    if(mode==='flashcard'){
      const reveal=document.getElementById('adaptiveReveal'),fb=document.getElementById('feedback'),conf=document.getElementById('adaptiveConfidence');reveal.onclick=()=>{fb.classList.add('show');fb.innerHTML=`<h3>Answer</h3><p>${html(options[c.correct]||c.takeaway)}</p>`;conf.classList.add('show');reveal.disabled=true};conf.querySelectorAll('button').forEach(b=>b.onclick=()=>{finish(Number(b.dataset.score),{confidence:Number(b.dataset.score)});closeReader()});window.scrollTo(0,0);return;
    }

    let selected=null,submitted=false;const opts=[...reader.querySelectorAll('.option')],ans=document.getElementById('answer'),submit=document.getElementById('submit'),next=document.getElementById('next'),fb=document.getElementById('feedback');const draft=tubeState.drafts[id]||{selected:null,text:''};selected=draft.selected??null;if(ans)ans.value=draft.text||'';if(selected!==null&&opts[selected])opts[selected].classList.add('selected');
    const minWords=clamp(config.tube?.sentenceMinWords||5,1,30);
    const persist=()=>{tubeState.drafts[id]={selected,text:ans?ans.value:''};saveStore('tubeState',tubeState)};
    const valid=()=>{const words=ans?ans.value.trim().split(/\s+/).filter(Boolean).length:999;submit.disabled=submitted||(mode!=='reflection'&&selected===null)||(mode!=='mcq'&&words<minWords)};
    opts.forEach(o=>o.onclick=()=>{if(submitted)return;selected=+o.dataset.n;opts.forEach(x=>x.classList.toggle('selected',x===o));persist();valid()});if(ans){ans.addEventListener('input',()=>{persist();valid()});ans.addEventListener('touchstart',()=>setTimeout(()=>ans.focus(),0),{passive:true});ans.addEventListener('pointerdown',()=>setTimeout(()=>ans.focus(),0))}valid();
    submit.onclick=()=>{if(submitted)return;submitted=true;let total=0;let extra={};if(mode==='reflection'){const sg=sentenceGrade(c,ans?.value||'');total=sg.score;extra={words:sg.words};fb.classList.add('show');fb.innerHTML=`<h3>${total>=67?'Good recall':'Keep sharpening it'}</h3><p>${html(sg.checks.join(' · '))}.</p><div class="scoreline"><span class="pill">Recall ${total}/100</span></div>`}else{const correct=selected===c.correct;opts.forEach((o,n)=>{o.disabled=true;o.classList.remove('selected');if(n===c.correct)o.classList.add('correct');if(n===selected&&n!==c.correct)o.classList.add('wrong')});if(mode==='mcq'){total=correct?100:45;extra={correct};fb.classList.add('show');fb.innerHTML=`<h3>${correct?'✓ Correct':'Not quite'}</h3><p>${correct?'You picked the key mechanism.':'Strongest answer: <b>'+html(options[c.correct])+'</b>.'}</p><div class="scoreline"><span class="pill">${total}/100</span></div>`}else{const sg=sentenceGrade(c,ans?.value||'');total=(correct?40:0)+Math.round(sg.score*.6);extra={correct,words:sg.words};fb.classList.add('show');fb.innerHTML=`<h3>${correct?'✓ Correct answer':'Correct answer: '+String.fromCharCode(65+c.correct)}</h3><p>${correct?'You picked the key mechanism.':'The strongest answer is: <b>'+html(options[c.correct])+'</b>.'}</p><div class="scoreline"><span class="pill">Quiz ${correct?40:0}/40</span><span class="pill">Sentence ${Math.round(sg.score*.6)}/60</span><span class="pill">Total ${total}/100</span></div><p><b>Sentence:</b> ${html(sg.checks.join(' · '))}.</p>`}}
      if(ans)ans.disabled=true;submit.disabled=true;finish(total,extra);next?.classList.add('show')};if(next)next.onclick=()=>closeReader();window.scrollTo(0,0);
  }

  function patchTube(){
    if(typeof window.renderDeck==='function'&&!window.renderDeck.__adaptive){const base=window.renderDeck;const wrapped=function(){const result=base.apply(this,arguments);const cfg=config.tube||{};const g=document.getElementById('grid');if(!g)return result;g.dataset.layout=cfg.layout||'stack';g.style.setProperty('--adaptive-image-ratio',String(clamp(cfg.cardImageRatio||.34,.22,.55)));const cards=[...g.querySelectorAll('.card')];cards.forEach((el,i)=>{el.classList.toggle('adaptiveHidden',i>=clamp(cfg.visibleCount||5,1,8));const hook=el.querySelector('.hook');if(hook)hook.classList.toggle('adaptiveMetaHidden',cfg.showHooks===false);const meta=el.querySelector('.meta');if(meta)meta.classList.toggle('adaptiveMetaHidden',cfg.showTopic===false)});return result};wrapped.__adaptive=true;window.renderDeck=wrapped}
    if(typeof window.openCard==='function'){adaptiveOpenCard.__adaptive=true;window.openCard=adaptiveOpenCard}
    if(typeof window.closeReader==='function'&&!window.closeReader.__adaptive){const base=window.closeReader;const wrapped=function(){if(readerOpenedAt){adaptiveLog('tube_reader_dwell',{id:readerCardId,ms:Date.now()-readerOpenedAt});readerOpenedAt=0;readerCardId=''}return base.apply(this,arguments)};wrapped.__adaptive=true;window.closeReader=wrapped}
  }

  function install(){
    patchScreenTracking();patchTodos();patchTube();applyTheme();
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(screenName)adaptiveLog('screen_dwell',{name:screenName,ms:Date.now()-screenEnteredAt});if(readerOpenedAt)adaptiveLog('tube_reader_dwell',{id:readerCardId,ms:Date.now()-readerOpenedAt})}else{screenEnteredAt=Date.now();fetchConfig()}});
    const oldResume=window.onAppResume;window.onAppResume=function(){try{oldResume&&oldResume()}catch(e){}screenEnteredAt=Date.now();fetchConfig()};
  }

  window.HOMEAdaptive={config,refresh:fetchConfig,log:adaptiveLog,activity:()=>activities().slice()};
  install();fetchConfig();
})();
