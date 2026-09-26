/* V-Brain Sense v13 — independent behavioural telemetry, live inbox status and foreground sync. */
(function(){
  'use strict';
  if(window.__VBRAIN_SENSE_V13__)return;window.__VBRAIN_SENSE_V13__=true;

  const VERSION=13, SESSION='s13-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  const now=()=>Date.now();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const screen=()=>String(window.currentScreen||document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home');
  let startedAt=now(),lastInput=now(),lastBeat=now(),maxScroll=0,presses=0,inputs=0,lastScreen=screen(),screenAt=now();

  function direct(kind,data){
    try{
      if(typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logActivity!=='function')return false;
      AdaptiveNative.logActivity(JSON.stringify({
        id:'s13-'+kind+'-'+now()+'-'+Math.random().toString(36).slice(2,7),
        kind,type:kind,at:now(),screen:screen(),source:'vbrain-v13',sessionId:SESSION,data:data||{}
      }));
      return true;
    }catch(e){return false}
  }

  function scrollDepth(){
    const root=document.scrollingElement||document.documentElement;
    const h=Math.max(1,(root?.scrollHeight||document.documentElement.scrollHeight)-innerHeight);
    return clamp(Math.round((root?.scrollTop||scrollY||0)/h*100),0,100);
  }
  function semantic(el){
    const t=el?.closest?.('button,a,[role="button"],[data-route],.todo,.card,.homeCard,.gymExercise,input,textarea,[contenteditable="true"]');
    if(!t)return null;
    let kind=t.dataset?.route||t.id||'';
    if(!kind){for(const c of ['calendar','todos','tube','gym','todo','card','homeCard','gymExercise'])if(t.classList?.contains(c)){kind=c;break}}
    return{kind:String(kind||t.tagName||'control').slice(0,100),tag:String(t.tagName||'').toLowerCase(),id:String(t.id||'').slice(0,100),route:String(t.dataset?.route||'').slice(0,60)};
  }
  function fieldMeta(el){
    const raw=[el?.id,el?.name,el?.dataset?.field,el?.getAttribute?.('aria-label'),el?.getAttribute?.('placeholder')].filter(Boolean).join('|')||el?.tagName||'field';
    return{field:String(raw).slice(0,160),type:String(el?.type||el?.tagName||'').toLowerCase()};
  }

  function screenChanged(next,reason){
    next=String(next||screen());if(next===lastScreen)return;
    direct('screen_exit_v13',{name:lastScreen,dwellMs:now()-screenAt,maxScroll,presses,inputs,reason:String(reason||'change')});
    lastScreen=next;screenAt=now();maxScroll=0;presses=0;inputs=0;
    direct('screen_enter_v13',{name:lastScreen,reason:String(reason||'change'),viewportW:innerWidth,viewportH:innerHeight});
  }

  function installTracking(){
    const touch=()=>{lastInput=now()};
    ['pointerdown','touchstart','keydown'].forEach(t=>document.addEventListener(t,touch,{capture:true,passive:true}));
    document.addEventListener('click',e=>{lastInput=now();const s=semantic(e.target);if(!s)return;presses++;direct('ui_press_v13',{...s,sinceScreenOpenMs:now()-screenAt,scrollDepth:scrollDepth()})},true);
    document.addEventListener('input',e=>{lastInput=now();inputs++;const m=fieldMeta(e.target);direct('field_activity_v13',{...m,chars:String(e.target?.value??e.target?.innerText??'').length})},true);
    addEventListener('scroll',()=>{maxScroll=Math.max(maxScroll,scrollDepth())},{passive:true});

    const base=window.showScreen;
    if(typeof base==='function'&&!base.__vbrainSense13){
      const wrapped=function(name){const r=base.apply(this,arguments);setTimeout(()=>screenChanged(String(name||screen()),'showScreen'),0);return r};
      wrapped.__vbrainSense13=true;window.showScreen=wrapped;
    }
    const obs=new MutationObserver(()=>screenChanged(screen(),'dom'));
    document.querySelectorAll('.screen').forEach(x=>obs.observe(x,{attributes:true,attributeFilter:['class','style']}));

    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){direct('session_background_v13',{sessionMs:now()-startedAt,screen:lastScreen,maxScroll,presses,inputs,idleMs:now()-lastInput})}
      else{startedAt=now();lastBeat=now();lastInput=now();screenChanged(screen(),'foreground');direct('session_foreground_v13',{screen:screen()});setTimeout(refreshPrivateState,250)}
    });

    setInterval(()=>{
      if(document.hidden)return;
      const t=now(),span=t-lastBeat,idle=t-lastInput;lastBeat=t;
      direct('session_heartbeat_v13',{screen:lastScreen,activeMs:idle<65000?span:0,idleMs:Math.min(idle,3600000),sessionMs:t-startedAt,maxScroll,presses,inputs});
    },30000);
  }

  function ensureStyle(){if(document.getElementById('vbrainSense13Style'))return;const s=document.createElement('style');s.id='vbrainSense13Style';s.textContent=`
    #vbrainAccessV13{margin:18px 0 0;border:1px solid rgba(255,255,255,.10);border-radius:23px;background:rgba(19,22,29,.88);padding:15px;color:#fff;display:none}
    #vbrainAccessV13.show{display:block}#vbrainAccessV13 small{display:block;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#9fb5ff;font-weight:900;margin-bottom:5px}#vbrainAccessV13 b{display:block;font-size:16px;margin-bottom:5px}#vbrainAccessV13 p{font-size:11px;line-height:1.45;color:rgba(255,255,255,.62);margin:0 0 11px}.vb13Btns{display:flex;gap:8px;flex-wrap:wrap}.vb13Btns button{border:1px solid rgba(255,255,255,.12);background:#202633;color:#fff;border-radius:14px;padding:10px 12px;font-size:11px;font-weight:850}.vb13Btns button.primary{background:#263c66;border-color:#47689e}
  `;document.head.appendChild(s)}

  function accessState(){
    const out={notificationAccess:false,whatsappScreenAccess:false};
    try{if(typeof VBrainNative!=='undefined'){out.notificationAccess=!!VBrainNative.notificationAccessEnabled();out.whatsappScreenAccess=!!VBrainNative.whatsappAccessibilityEnabled()}}catch(e){}
    return out;
  }
  function renderAccess(){
    ensureStyle();const home=document.querySelector('#homeScreen .homeInner');if(!home)return;let box=document.getElementById('vbrainAccessV13');if(!box){box=document.createElement('section');box.id='vbrainAccessV13';home.appendChild(box)}
    const st=accessState();
    if(st.notificationAccess){box.classList.remove('show');return st}
    box.classList.add('show');box.innerHTML=`<small>V-Brain · live inbox</small><b>Connect private message intelligence</b><p>Notification access lets V-Brain privately analyse incoming Gmail and WhatsApp notifications and create a task only when a concrete action is strongly supported. Optional Accessibility access can also read selected visible WhatsApp chats while WhatsApp is open.</p><div class="vb13Btns"><button class="primary" id="vb13Notif">Enable notification access</button><button id="vb13Access">Optional WhatsApp screen access</button></div>`;
    box.querySelector('#vb13Notif').onclick=()=>{direct('permission_open_v13',{kind:'notification_listener'});try{VBrainNative.openNotificationAccessSettings()}catch(e){}};
    box.querySelector('#vb13Access').onclick=()=>{direct('permission_open_v13',{kind:'whatsapp_accessibility'});try{VBrainNative.openAccessibilitySettings()}catch(e){}};
    return st;
  }

  function refreshPrivateState(){
    const st=renderAccess();direct('inbox_access_status_v13',st);
    try{if(!document.hidden&&typeof refreshNotion==='function'&&typeof notionConnected==='function'&&notionConnected())refreshNotion()}catch(e){}
    return st;
  }

  function oneTimeNotification(){
    try{
      if(localStorage.getItem('vbrainV13ReadyNotice')==='1')return;
      if(typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.hasNotificationPermission!=='function'||typeof AdaptiveNative.showNotification!=='function')return;
      if(!AdaptiveNative.hasNotificationPermission())return;
      AdaptiveNative.showNotification('vbrain-v13-ready','V-Brain','Live adaptation and behaviour sensing are connected.');
      localStorage.setItem('vbrainV13ReadyNotice','1');direct('notification_shown_v13',{id:'vbrain-v13-ready',reason:'runtime-ready'});
    }catch(e){}
  }

  function boot(){
    ensureStyle();installTracking();
    let launches=Number(localStorage.getItem('vbrainLaunchCountV13')||0)+1;localStorage.setItem('vbrainLaunchCountV13',String(launches));
    direct('vbrain_runtime_ready',{version:VERSION,launches,capabilities:['direct-press-telemetry','screen-dwell-v13','active-idle-heartbeat','scroll-depth','live-inbox-status','foreground-task-pull','live-config']});
    direct('session_start_v13',{launches,screen:lastScreen});
    setTimeout(()=>{refreshPrivateState();oneTimeNotification()},850);
    setInterval(()=>{if(!document.hidden)refreshPrivateState()},90000);
  }

  window.VBrainSense={version:VERSION,accessState,refreshPrivateState,log:direct};
  boot();
})();
