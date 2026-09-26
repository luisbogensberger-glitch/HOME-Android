/* V-Brain Autonomy v11 — stable Home, single Gym, richer behaviour telemetry, private in-app context, dynamic modules and adaptive notifications. */
(function(){
  'use strict';
  if(window.__VBRAIN_AUTONOMY_V11__)return;window.__VBRAIN_AUTONOMY_V11__=true;
  const ACT='homeAdaptiveActivityV1',OUT='vbrainPrivateOutboxV11',DAY=86400000;
  const blocked=/(password|passwd|token|secret|auth|credential|cookie|session|bearer|api[_-]?key|otp|pin)/i;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const now=()=>Date.now();
  const rows=(days=30)=>{const a=load(ACT,[]),since=now()-days*DAY;return Array.isArray(a)?a.filter(x=>Number(x?.at||0)>=since):[]};
  const log=(type,data)=>{try{window.homeAdaptiveLog?.(type,data||{})}catch(e){}};
  const screen=()=>String(window.currentScreen||document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home');
  const dayKey=t=>{const d=new Date(t||now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const hour=t=>new Date(t||now()).getHours();

  function ensureStyle(){if(document.getElementById('vbrainAutonomyV11Style'))return;const s=document.createElement('style');s.id='vbrainAutonomyV11Style';s.textContent=`
    .vbrainHomeSettled #homeScreen .homeCard{animation:none!important;opacity:1!important;transform:none!important}
    .vbrainHomeSettled #homeScreen .homeCard:active{transform:scale(.985)!important}
    .vb11Module{position:relative;width:100%;border:1px solid rgba(255,255,255,.12);border-radius:26px;padding:17px 18px;color:#fff;text-align:left;min-height:112px;overflow:hidden;background:linear-gradient(145deg,rgba(25,29,38,.96),rgba(13,16,22,.95));box-shadow:0 18px 48px rgba(0,0,0,.22);touch-action:manipulation}
    .vb11Module:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 85% 18%,rgba(142,168,255,.15),transparent 34%);pointer-events:none}.vb11Module[data-tone='health']:before{background:radial-gradient(circle at 85% 18%,rgba(121,210,172,.18),transparent 34%)}.vb11Module[data-tone='focus']:before{background:radial-gradient(circle at 85% 18%,rgba(240,201,93,.18),transparent 34%)}.vb11Module[data-tone='learn']:before{background:radial-gradient(circle at 85% 18%,rgba(187,160,255,.18),transparent 34%)}
    .vb11Module small,.vb11Module b,.vb11Module span{position:relative;z-index:1;display:block}.vb11Module small{font-size:9px;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,255,255,.52);font-weight:900;margin-bottom:7px}.vb11Module b{font-size:20px;line-height:1.14;margin-bottom:6px}.vb11Module span{font-size:12px;line-height:1.42;color:rgba(255,255,255,.66);max-width:86%}.vb11Metric{position:absolute!important;right:17px;top:16px;font-size:11px!important;font-weight:850;color:rgba(255,255,255,.75)!important}
  `;document.head.appendChild(s)}

  function dedupeGym(){
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;
    const gyms=[...grid.querySelectorAll('.homeCard.gym')];if(!gyms.length)return;
    let keep=document.getElementById('homeGymCard')||gyms.find(x=>x.id==='homeGymCard')||gyms[0];
    gyms.forEach(x=>{if(x!==keep)x.remove()});
    if(!keep.id)keep.id='homeGymCard';
    keep.dataset.route='gym';
    if(!keep.dataset.vb11Gym){keep.dataset.vb11Gym='1';keep.addEventListener('click',e=>{if(typeof window.openHomeGym!=='function')return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.openHomeGym()},true)}
  }

  function semantic(el){
    if(!el)return null;const target=el.closest?.('button,a,[role="button"],[data-route],.todo,.card,.gymExercise');if(!target)return null;
    const route=target.dataset?.route||'';const id=target.id||'';let kind=route||id||'';
    if(!kind){for(const c of ['calendar','todos','tube','gym','todo','card','gymExercise'])if(target.classList?.contains(c)){kind=c;break}}
    if(!kind)kind=target.tagName?.toLowerCase()||'control';
    return{kind:String(kind).slice(0,80),route:String(route).slice(0,40),id:String(id).slice(0,80)};
  }

  let lastInput=now(),sessionStart=now(),lastHeartbeat=now(),screenOpened=now(),maxScroll=0,presses=0;
  function scrollDepth(){const h=Math.max(1,document.documentElement.scrollHeight-innerHeight);return clamp(Math.round(scrollY/h*100),0,100)}
  function installTracking(){if(window.__VBRAIN_TRACK_V11__)return;window.__VBRAIN_TRACK_V11__=true;
    const touch=()=>{lastInput=now()};['pointerdown','touchstart','keydown'].forEach(t=>document.addEventListener(t,touch,{capture:true,passive:true}));
    document.addEventListener('click',e=>{lastInput=now();const s=semantic(e.target);if(!s)return;presses++;log('ui_press',{...s,screen:screen(),sinceScreenOpenMs:now()-screenOpened,scrollDepth:scrollDepth()})},true);
    addEventListener('scroll',()=>{maxScroll=Math.max(maxScroll,scrollDepth())},{passive:true});
    const base=window.showScreen;if(typeof base==='function'&&!base.__vb11){const wrapped=function(name){log('screen_exit_detail',{screen:screen(),dwellMs:now()-screenOpened,maxScroll,presses});const r=base.apply(this,arguments);screenOpened=now();maxScroll=0;presses=0;setTimeout(()=>log('screen_enter_detail',{screen:String(name||''),viewportH:innerHeight,viewportW:innerWidth}),0);return r};wrapped.__vb11=true;window.showScreen=wrapped}
    setInterval(()=>{if(document.hidden)return;const t=now(),idle=t-lastInput,span=t-lastHeartbeat;lastHeartbeat=t;log('session_heartbeat',{screen:screen(),foreground:true,activeMs:idle<65000?span:0,idleMs:Math.min(idle,3600000),scrollDepth:maxScroll,sessionMs:t-sessionStart})},60000);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)log('session_background',{screen:screen(),sessionMs:now()-sessionStart,maxScroll});else{sessionStart=now();lastInput=now();lastHeartbeat=now();log('session_foreground',{screen:screen()})}});
  }

  function privateMeta(el){const field=[el.id,el.name,el.dataset?.field,el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder')].filter(Boolean).join('|')||el.tagName;return{screen:screen(),field:String(field).slice(0,180),type:String(el.type||el.tagName||'').toLowerCase()}}
  function eligible(el){if(!el)return false;const tag=String(el.tagName||'').toLowerCase(),type=String(el.type||'text').toLowerCase(),meta=[el.id,el.name,el.className,el.getAttribute?.('autocomplete'),el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder')].join(' ');if(blocked.test(meta)||['password','hidden'].includes(type))return false;return tag==='textarea'||(tag==='input'&&['text','search','url'].includes(type))||el.isContentEditable}
  function textOf(el){return String(el?.isContentEditable?el.innerText:el?.value??'').slice(0,6000)}
  function enqueuePrivate(el,reason){if(!eligible(el)||typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logPrivateActivity!=='function')return;const meta=privateMeta(el),text=textOf(el),id='ctx-'+Math.abs(hash(meta.screen+'|'+meta.field+'|'+text));const item={id,kind:'private_text_field',source:'vbrain-android',at:now(),screen:meta.screen,field:meta.field,fieldType:meta.type,reason:String(reason||'draft'),text,tries:0};let q=load(OUT,[]);q=q.filter(x=>x.id!==id&&!(x.screen===item.screen&&x.field===item.field));q.push(item);if(q.length>40)q=q.slice(-40);save(OUT,q);flushPrivate();try{if(meta.field.includes('detailPersonalNote')&&typeof todoState!=='undefined')AdaptiveNative.saveTodoState(JSON.stringify(todoState))}catch(e){}}
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function flushPrivate(){if(typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logPrivateActivity!=='function')return;let q=load(OUT,[]),next=[];q.forEach(x=>{try{const send={...x};delete send.tries;AdaptiveNative.logPrivateActivity(JSON.stringify(send));x.tries=(x.tries||0)+1;if(x.tries<3)next.push(x)}catch(e){next.push(x)}});save(OUT,next)}
  function installPrivateContext(){if(window.__VBRAIN_PRIVATE_V11__)return;window.__VBRAIN_PRIVATE_V11__=true;const timers=new WeakMap();const schedule=(el,instant,why)=>{if(!eligible(el))return;const old=timers.get(el);if(old)clearTimeout(old);timers.set(el,setTimeout(()=>enqueuePrivate(el,why),instant?0:1350))};document.addEventListener('input',e=>schedule(e.target,false,'draft'),true);document.addEventListener('change',e=>schedule(e.target,true,'change'),true);document.addEventListener('focusout',e=>schedule(e.target,true,'blur'),true);setInterval(flushPrivate,45000)}

  function route(name){try{if(typeof window.showScreen==='function')return window.showScreen(name)}catch(e){}const el=document.getElementById(name+'Screen');if(!el)return;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));el.classList.add('show')}
  function renderModules(){const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;grid.querySelectorAll('.vb11Module').forEach(x=>x.remove());const list=window.HOMEAdaptive?.config?.vbrainPatch?.modules;if(!Array.isArray(list))return;list.slice(0,3).forEach((m,i)=>{if(m?.visible===false||!m?.title)return;const b=document.createElement('button');b.className='vb11Module';b.type='button';b.dataset.tone=['focus','health','learn','neutral'].includes(m.tone)?m.tone:'neutral';b.style.order=String(Number.isFinite(Number(m.order))?Number(m.order):50+i);b.innerHTML=`<small></small><b></b><span></span>${m.metric?'<span class="vb11Metric"></span>':''}`;b.querySelector('small').textContent=String(m.kicker||'V-Brain').slice(0,60);b.querySelector('b').textContent=String(m.title).slice(0,100);b.querySelector('span:not(.vb11Metric)').textContent=String(m.text||'').slice(0,260);const metric=b.querySelector('.vb11Metric');if(metric)metric.textContent=String(m.metric).slice(0,40);const target=['calendar','todos','tube','gym'].includes(m.target)?m.target:'todos';b.onclick=()=>{log('dynamic_module_open',{id:String(m.id||i),target});route(target)};grid.appendChild(b)})}

  function todayHas(type){const d=dayKey();return rows(3).some(x=>x.type===type&&dayKey(x.at)===d)}
  function bestHour(types,min=3){const rs=rows(30).filter(x=>types.includes(x.type)),by={};rs.forEach(x=>{const h=hour(x.at);by[h]=(by[h]||0)+1});const best=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];return best&&best[1]>=min?{hour:Number(best[0]),count:Number(best[1])}:null}
  function atNext(h,m=0){const d=new Date();d.setHours(h,m,0,0);if(d.getTime()<=now()+60000)d.setDate(d.getDate()+1);return d.getTime()}
  function planNotifications(){const n=window.HOMEAdaptive?.config?.notifications||{};if(n.autonomous===false||typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.scheduleNotification!=='function')return;const activity=rows(30);if(activity.length<12)return;try{if(!AdaptiveNative.hasNotificationPermission()){const asked=localStorage.getItem('vbrainNotificationAskedV11')==='1';if(!asked){localStorage.setItem('vbrainNotificationAskedV11','1');AdaptiveNative.requestNotificationPermission()}return}}catch(e){}
    try{AdaptiveNative.cancelNotification('vbrain-prime-action');AdaptiveNative.cancelNotification('vbrain-learning-window')}catch(e){}
    const planned=[];let open=0;try{open=Array.isArray(todoState?.active)?todoState.active.length:0}catch(e){}
    const action=bestHour(['todo_complete','gym_complete','tube_complete'],4);if(action&&open>0&&!todayHas('todo_complete')){const when=atNext(action.hour,5);try{AdaptiveNative.scheduleNotification('vbrain-prime-action','V-Brain','This is usually one of your stronger action windows. Finish one concrete task.',when);planned.push({kind:'action',hour:action.hour,evidence:action.count})}catch(e){}}
    const learn=bestHour(['tube_card_open','tube_complete'],4);if(learn&&!todayHas('tube_complete')&&planned.length<2){const when=atNext(learn.hour,20);try{AdaptiveNative.scheduleNotification('vbrain-learning-window','V-Brain','A short learning block fits your usual rhythm around now.',when);planned.push({kind:'learning',hour:learn.hour,evidence:learn.count})}catch(e){}}
    if(planned.length)log('notification_plan',{planned})
  }

  function homeImpression(){const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;const order=[...grid.children].filter(x=>x.matches?.('.homeCard,.vb11Module')).map(x=>x.dataset?.route||[...x.classList].find(c=>['calendar','todos','tube','gym'].includes(c))||x.id||'module');log('home_impression',{order})}
  function repair(){ensureStyle();dedupeGym();renderModules();document.documentElement.classList.add('vbrainHomeSettled');setTimeout(homeImpression,120)}

  window.VBrainAutonomy={version:11,repair,planNotifications,flushPrivate};
  ensureStyle();installTracking();installPrivateContext();setTimeout(()=>document.documentElement.classList.add('vbrainHomeSettled'),900);repair();setTimeout(repair,700);setTimeout(()=>{repair();planNotifications()},2200);setInterval(()=>{if(!document.hidden){repair();planNotifications()}},180000);
})();
