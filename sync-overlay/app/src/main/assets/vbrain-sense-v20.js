/* V-Brain Sense v20 — lightweight UI interaction telemetry. Private text remains owned by V-Brain Live v17. */
(function(){
  'use strict';
  if(window.__VBRAIN_SENSE_V20__)return;window.__VBRAIN_SENSE_V20__=true;

  const VERSION=20;
  const SESSION='s20-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const GENERIC_DEBOUNCE_MS=320;
  const HEARTBEAT_MS=60000;
  const IDLE_MS=90000;
  const SECRET_RE=/(password|passwd|passcode|secret|token|credential|cookie|session|bearer|api[_ -]?key|private[_ -]?key)/i;

  const now=()=>Date.now();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  let startedAt=now(),lastActive=now(),lastBeat=now();
  let lastScreen='',screenAt=now(),maxScroll=0,presses=0,inputs=0;

  function currentScreen(){
    return String(window.currentScreen||document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home').slice(0,100);
  }
  function safe(s,n=160){return String(s??'').replace(/\s+/g,' ').trim().slice(0,n)}
  function generic(kind,data){
    try{
      if(typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logActivity!=='function')return false;
      AdaptiveNative.logActivity(JSON.stringify({
        id:'s20-'+kind+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
        kind,type:kind,at:now(),screen:currentScreen(),source:'vbrain-sense-v20',sessionId:SESSION,data:data||{}
      }));
      return true;
    }catch(_){return false}
  }
  function semantic(el){
    const t=el?.closest?.('button,a,[role="button"],[data-route],[data-action],.todo,.card,.homeCard,.gymExercise,input,textarea,[contenteditable="true"]');
    if(!t)return null;
    const route=t.dataset?.route||t.dataset?.action||'';
    const classes=[...(t.classList||[])].slice(0,4).join('.');
    return{tag:safe(t.tagName||'',30).toLowerCase(),id:safe(t.id,100),route:safe(route,80),classes:safe(classes,120)};
  }
  function fieldMeta(el){
    if(!el)return{field:'field',type:''};
    const raw=[el.id,el.name,el.dataset?.field,el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder')].filter(Boolean).join('|')||el.tagName||'field';
    return{field:safe(raw,180),type:safe(el.type||el.tagName||'',40).toLowerCase()};
  }
  function isTextField(el){
    if(!el||!(el instanceof Element))return false;
    if(el.matches('textarea,[contenteditable="true"]'))return true;
    if(!el.matches('input'))return false;
    return ['','text','search','url','tel','email'].includes(String(el.type||'text').toLowerCase());
  }
  function isSensitiveField(el){
    if(!el)return true;
    const type=String(el.type||'').toLowerCase();
    const ac=String(el.autocomplete||'').toLowerCase();
    const meta=fieldMeta(el);
    return type==='password'||/password/.test(ac)||SECRET_RE.test(meta.field);
  }
  function fieldLength(el){
    if(!isTextField(el)||isSensitiveField(el))return 0;
    const raw=el?.isContentEditable?el.innerText:el?.value;
    return Math.min(4000,String(raw??'').trim().length);
  }
  function scrollDepth(){
    const root=document.scrollingElement||document.documentElement;
    const h=Math.max(1,(root?.scrollHeight||document.documentElement.scrollHeight)-innerHeight);
    return clamp(Math.round((root?.scrollTop||scrollY||0)/h*100),0,100);
  }
  function touch(){lastActive=now()}
  function noteScreen(next,reason){
    next=String(next||currentScreen());
    if(!lastScreen){lastScreen=next;screenAt=now();generic('screen_enter_v20',{name:next,reason:'boot',viewportW:innerWidth,viewportH:innerHeight});return}
    if(next===lastScreen)return;
    generic('screen_exit_v20',{name:lastScreen,dwellMs:now()-screenAt,maxScroll,presses,inputs,reason:safe(reason,40)});
    lastScreen=next;screenAt=now();maxScroll=0;presses=0;inputs=0;
    generic('screen_enter_v20',{name:next,reason:safe(reason,40),viewportW:innerWidth,viewportH:innerHeight});
  }

  document.addEventListener('pointerdown',touch,{capture:true,passive:true});
  document.addEventListener('touchstart',touch,{capture:true,passive:true});
  document.addEventListener('keydown',touch,{capture:true,passive:true});
  document.addEventListener('click',e=>{
    touch();const s=semantic(e.target);if(!s)return;presses++;
    generic('ui_press_v20',{...s,sinceScreenOpenMs:now()-screenAt,scrollDepth:scrollDepth()});
  },true);
  document.addEventListener('input',e=>{
    touch();inputs++;const el=e.target;if(!(el instanceof Element))return;
    const m=fieldMeta(el),chars=fieldLength(el);
    const prior=el.__vbrainSenseGenericTimer;if(prior)clearTimeout(prior);
    el.__vbrainSenseGenericTimer=setTimeout(()=>generic('field_activity_v20',{...m,chars}),GENERIC_DEBOUNCE_MS);
  },true);
  addEventListener('scroll',()=>{touch();maxScroll=Math.max(maxScroll,scrollDepth())},{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      generic('session_background_v20',{sessionMs:now()-startedAt,screen:lastScreen,maxScroll,presses,inputs,idleMs:now()-lastActive});
    }else{
      startedAt=now();lastBeat=now();lastActive=now();noteScreen(currentScreen(),'foreground');generic('session_foreground_v20',{screen:currentScreen()});
    }
  });
  addEventListener('pagehide',()=>generic('session_end_v20',{sessionMs:now()-startedAt,screen:lastScreen,maxScroll,presses,inputs,idleMs:now()-lastActive}));
  setInterval(()=>{
    noteScreen(currentScreen(),'poll');
    if(document.hidden)return;
    const t=now(),span=t-lastBeat,idle=t-lastActive;lastBeat=t;
    generic('session_heartbeat_v20',{screen:lastScreen,activeMs:idle<IDLE_MS?span:0,idleMs:Math.min(idle,3600000),sessionMs:t-startedAt,maxScroll,presses,inputs});
  },HEARTBEAT_MS);
  setInterval(()=>noteScreen(currentScreen(),'poll'),1000);

  lastScreen=currentScreen();screenAt=now();
  generic('vbrain_sense_ready',{version:VERSION,sessionId:SESSION,privateTextOwner:'vbrain-v17',uiOnly:true});
  generic('screen_enter_v20',{name:lastScreen,reason:'boot',viewportW:innerWidth,viewportH:innerHeight});
  window.VBrainSense={version:VERSION,status:()=>({version:VERSION,sessionId:SESSION,screen:lastScreen,startedAt,privateTextOwner:'vbrain-v17',uiOnly:true})};
})();
