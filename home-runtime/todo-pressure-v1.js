/* HOME To-Do Pressure v1 — make repeatedly ignored tasks salient without blocking the user. */
(function(){
  'use strict';
  if(window.__HOME_TODO_PRESSURE_V1__) return;
  window.__HOME_TODO_PRESSURE_V1__=true;

  const VERSION=1, DAY=86400000, HOUR=3600000;
  const SEEN_KEY='homeTodoPressureSeenV1';
  const STATE_KEY='homeTodoPressureStateV1';
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const now=()=>Date.now();
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));

  function activities(days=30){
    const v=load(ACTIVITY_KEY,[]), since=now()-days*DAY;
    return Array.isArray(v)?v.filter(x=>Number(x.at)>=since):[];
  }

  function activeTodos(){
    let arr=[];
    try{if(typeof todoState!=='undefined'&&Array.isArray(todoState?.active))arr=todoState.active}catch(e){}
    try{if(!arr.length&&Array.isArray(window.todoState?.active))arr=window.todoState.active}catch(e){}
    if(arr.length)return arr.filter(Boolean);

    // Last-resort DOM view so this remains useful across UI revisions.
    return [...document.querySelectorAll('#todoList .todo:not(.archiveItem)')].map((el,i)=>({
      id:el.dataset.id||el.getAttribute('data-todo-id')||`dom-${i}`,
      title:el.querySelector('.todoTitle,.title,h3,b')?.textContent?.trim()||el.textContent?.trim().slice(0,120)||'Open task',
      _dom:el
    }));
  }

  function idOf(t,i){return String(t?.id??t?.taskId??t?.sourceKey??`task-${i}`)}
  function titleOf(t){return String(t?.title??t?.name??t?.text??'Open task').trim().slice(0,180)}
  function minutesOf(t){const n=Number(t?.minutes??t?.estimatedMinutes??t?.durationMinutes);return Number.isFinite(n)&&n>0?Math.round(n):null}
  function dueAt(t){
    const raw=t?.dueAt??t?.due??t?.dueDate??t?.date??t?.deadline;
    if(raw==null||raw==='')return 0;
    if(typeof raw==='number')return raw>1e12?raw:raw*1000;
    const x=Date.parse(String(raw));return Number.isFinite(x)?x:0;
  }

  function syncSeen(tasks){
    const seen=load(SEEN_KEY,{}), live=new Set();
    tasks.forEach((t,i)=>{const id=idOf(t,i);live.add(id);if(!seen[id])seen[id]={firstSeenAt:now(),lastSeenAt:now()};else seen[id].lastSeenAt=now()});
    Object.keys(seen).forEach(id=>{if(!live.has(id)&&now()-Number(seen[id]?.lastSeenAt||0)>14*DAY)delete seen[id]});
    save(SEEN_KEY,seen);return seen;
  }

  function signalsFor(t,i,seen){
    const id=idOf(t,i), first=Number(seen[id]?.firstSeenAt||now()), rows=activities(30);
    const opens=rows.filter(r=>r.type==='todo_open'&&String(r.data?.id??'')===id);
    const completes=rows.filter(r=>r.type==='todo_complete'&&String(r.data?.id??'')===id);
    const lastOpen=opens.reduce((m,r)=>Math.max(m,Number(r.at)||0),0);
    const lastComplete=completes.reduce((m,r)=>Math.max(m,Number(r.at)||0),0);
    const days=Math.max(0,(now()-first)/DAY), due=dueAt(t), overdue=due>0&&due<now();
    let level=0;
    if(days>=2)level=1;if(days>=4)level=2;if(days>=7)level=3;
    if(overdue)level=Math.max(level,3);
    if(opens.filter(r=>Number(r.at)>=now()-4*DAY).length>=3&&!lastComplete)level=Math.max(level,2);
    return{id,task:t,title:titleOf(t),minutes:minutesOf(t),days,lastOpen,lastComplete,overdue,due,level};
  }

  function taskScore(s){
    let x=s.level*100+s.days*8+(s.overdue?120:0)+(s.lastOpen?15:0);
    const m=s.minutes;if(m&&m<=15)x+=12; // easy wins can break avoidance loops
    return x;
  }

  function chosenTask(){
    const tasks=activeTodos();if(!tasks.length)return null;
    const seen=syncSeen(tasks), candidates=tasks.map((t,i)=>signalsFor(t,i,seen)).filter(s=>s.level>0);
    if(!candidates.length)return null;
    candidates.sort((a,b)=>taskScore(b)-taskScore(a));
    const st=load(STATE_KEY,{}), snoozed=st.snoozed||{};
    return candidates.find(s=>Number(snoozed[s.id]||0)<now())||null;
  }

  function copyFor(s){
    const d=Math.max(2,Math.floor(s.days));
    if(s.overdue)return{eyebrow:'OVERDUE · HOME WON’T HIDE IT',headline:s.title,body:'This is already past its date. Do the smallest concrete next step now.',cta:s.minutes&&s.minutes<=20?`Start · ${s.minutes} min`:'Start now'};
    if(s.level>=3)return{eyebrow:`STILL OPEN · ${d} DAYS`,headline:s.title,body:'You have carried this long enough. Five focused minutes count — but ignoring it again does not move it.',cta:s.minutes&&s.minutes<=20?`Do it · ${s.minutes} min`:'Give it 5 min'};
    if(s.level===2)return{eyebrow:`OPEN · ${d} DAYS`,headline:s.title,body:'HOME noticed this keeps surviving the list. Move it forward before it becomes background noise.',cta:s.minutes&&s.minutes<=20?`Start · ${s.minutes} min`:'Start the next step'};
    return{eyebrow:'DON’T LET THIS DRIFT',headline:s.title,body:'One unfinished task is starting to linger. A small move now is cheaper than another reminder tomorrow.',cta:s.minutes&&s.minutes<=15?`Finish · ${s.minutes} min`:'Move it forward'};
  }

  function openTask(s){
    log('todo_pressure_start',{id:s.id,level:s.level,days:Math.round(s.days)});
    try{if(typeof window.openTodoDetail==='function'){window.openTodoDetail(s.id);return}}catch(e){}
    try{if(typeof window.showScreen==='function'){window.showScreen('todos');setTimeout(()=>window.openTodoDetail?.(s.id),120);return}}catch(e){}
    document.querySelector('#homeScreen .homeCard.todos')?.click();
  }

  function snooze(s){
    const st=load(STATE_KEY,{});st.snoozed=st.snoozed||{};st.snoozed[s.id]=now()+6*HOUR;save(STATE_KEY,st);
    log('todo_pressure_snooze',{id:s.id,level:s.level});render();
  }

  function ensureStyle(){
    if(document.getElementById('homeTodoPressureV1Style'))return;
    const style=document.createElement('style');style.id='homeTodoPressureV1Style';style.textContent=`
      .homeTodoPressure{margin:0 0 14px;padding:16px;border-radius:22px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(145deg,rgba(40,45,53,.98),rgba(22,25,31,.98));box-shadow:0 16px 42px rgba(0,0,0,.22);color:#f7f8fb;position:relative;overflow:hidden}
      .homeTodoPressure[data-level="3"]{border-color:rgba(255,184,125,.42);box-shadow:0 18px 46px rgba(0,0,0,.28)}
      .homeTodoPressure[data-overdue="1"]{border-color:rgba(255,128,128,.48)}
      .homeTodoPressure:before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:rgba(255,255,255,.28)}
      .homeTodoPressure[data-level="3"]:before{background:#ffc28e}.homeTodoPressure[data-overdue="1"]:before{background:#ff8e8e}
      .homeTodoPressureEye{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#aeb8c5;margin-bottom:7px}.homeTodoPressure h2{font-size:22px;line-height:1.08;margin:0 0 7px;letter-spacing:-.02em}.homeTodoPressure p{font-size:13px;line-height:1.45;color:#b7c0cb;margin:0 0 14px}
      .homeTodoPressureActions{display:grid;grid-template-columns:1fr auto;gap:8px}.homeTodoPressureStart,.homeTodoPressureLater{border:0;border-radius:14px;padding:12px 14px;font-weight:850;font-size:13px}.homeTodoPressureStart{background:#f2f5f8;color:#101419}.homeTodoPressureLater{background:rgba(255,255,255,.07);color:#c7d0d9}
      #homeScreen[data-todo-pressure="3"] .homeCard.todos{transform:translateY(-2px);box-shadow:0 18px 52px rgba(0,0,0,.28)}
    `;document.head.appendChild(style);
  }

  function render(){
    ensureStyle();
    const home=document.getElementById('homeScreen');if(!home)return;
    home.querySelector('.homeTodoPressure')?.remove();
    const s=chosenTask();if(!s){home.removeAttribute('data-todo-pressure');return}
    const c=copyFor(s), box=document.createElement('section');box.className='homeTodoPressure';box.dataset.level=String(s.level);box.dataset.overdue=s.overdue?'1':'0';
    box.innerHTML=`<div class="homeTodoPressureEye">${esc(c.eyebrow)}</div><h2>${esc(c.headline)}</h2><p>${esc(c.body)}</p><div class="homeTodoPressureActions"><button class="homeTodoPressureStart" type="button">${esc(c.cta)}</button><button class="homeTodoPressureLater" type="button">Later</button></div>`;
    const grid=home.querySelector('.homeGrid');if(grid)grid.parentNode.insertBefore(box,grid);else home.prepend(box);
    home.dataset.todoPressure=String(s.level);
    box.querySelector('.homeTodoPressureStart').onclick=()=>openTask(s);box.querySelector('.homeTodoPressureLater').onclick=()=>snooze(s);
    log('todo_pressure_shown',{id:s.id,level:s.level,days:Math.round(s.days),overdue:s.overdue});
  }

  // Success should immediately remove pressure for that task and teach HOME that the intervention worked.
  document.addEventListener('click',()=>setTimeout(render,120),true);
  const baseShow=window.showScreen;
  if(typeof baseShow==='function'&&!baseShow.__todoPressureV1){
    const wrapped=function(){const out=baseShow.apply(this,arguments);setTimeout(render,100);return out};wrapped.__todoPressureV1=true;window.showScreen=wrapped;
  }

  window.HOMETodoPressure={version:VERSION,refresh:render,current:chosenTask};
  render();setTimeout(render,700);setTimeout(render,2200);setInterval(render,5*60*1000);
  log('todo_pressure_ready',{version:VERSION});
})();
