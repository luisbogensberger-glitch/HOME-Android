/* V-Brain Observability v13 — direct native, content-minimised interaction telemetry. */
(function(){
  'use strict';
  if(window.__VBRAIN_OBSERVABILITY_V13__)return;window.__VBRAIN_OBSERVABILITY_V13__=true;
  const VERSION=13;
  const started=Date.now();
  let lastInput=started,lastBeat=started,lastScreen='',screenAt=started,maxScroll=0,presses=0,seq=0;
  const sid='s13-'+started.toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const now=()=>Date.now();
  const clean=(v,n=80)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
  const screen=()=>clean(window.currentScreen||document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home',60);
  const depth=()=>{const h=Math.max(1,document.documentElement.scrollHeight-innerHeight);return Math.max(0,Math.min(100,Math.round(scrollY/h*100)))};
  function send(kind,data){
    try{
      if(typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logActivity!=='function')return false;
      const row={id:'v13-'+now()+'-'+(++seq),kind,source:'vbrain-v13',at:now(),sessionId:sid,data:data||{}};
      AdaptiveNative.logActivity(JSON.stringify(row));return true;
    }catch(e){return false}
  }
  function semantic(el){
    const t=el?.closest?.('button,a,[role="button"],[data-route],.homeCard,.todo,.card,.gymExercise');if(!t)return null;
    const classes=[...t.classList||[]].filter(c=>/^(calendar|todos|tube|gym|todo|card|option|submit|next|readerBack|gymExercise|vb)/i.test(c)).slice(0,4);
    return {id:clean(t.id,70),route:clean(t.dataset?.route,40),classes:classes.join(' ').slice(0,100),tag:clean(t.tagName,16).toLowerCase()};
  }
  function leave(reason){const s=lastScreen||screen();send('vbrain_screen_v13',{phase:'exit',screen:s,dwellMs:Math.max(0,now()-screenAt),maxScroll,presses,reason:clean(reason,30)});maxScroll=0;presses=0}
  function enter(reason){lastScreen=screen();screenAt=now();maxScroll=depth();send('vbrain_screen_v13',{phase:'enter',screen:lastScreen,reason:clean(reason,30),viewportW:innerWidth,viewportH:innerHeight})}
  function checkScreen(reason){const s=screen();if(s!==lastScreen){if(lastScreen)leave(reason||'change');lastScreen=s;screenAt=now();maxScroll=depth();send('vbrain_screen_v13',{phase:'enter',screen:s,reason:clean(reason||'change',30),viewportW:innerWidth,viewportH:innerHeight})}}
  function heartbeat(){
    if(document.hidden)return;const t=now(),idle=t-lastInput,span=t-lastBeat;lastBeat=t;maxScroll=Math.max(maxScroll,depth());
    send('vbrain_heartbeat_v13',{screen:screen(),foregroundMs:idle<65000?span:0,idleMs:Math.min(idle,3600000),sessionMs:t-started,scrollDepth:maxScroll,presses});
  }
  function install(){
    try{const n=Number(localStorage.getItem('vbrainLaunchCountV13')||0)+1;localStorage.setItem('vbrainLaunchCountV13',String(n));send('vbrain_v13_ready',{version:VERSION,launchCount:n,screen:screen()})}catch(e){send('vbrain_v13_ready',{version:VERSION,screen:screen()})}
    ['pointerdown','touchstart','keydown'].forEach(type=>document.addEventListener(type,()=>{lastInput=now()},{capture:true,passive:true}));
    document.addEventListener('click',e=>{lastInput=now();checkScreen('click-before');const m=semantic(e.target);if(!m)return;presses++;send('vbrain_press_v13',{...m,screen:screen(),sinceScreenEnterMs:now()-screenAt,scrollDepth:depth()});setTimeout(()=>checkScreen('click-after'),0)},true);
    addEventListener('scroll',()=>{lastInput=now();maxScroll=Math.max(maxScroll,depth())},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){leave('background');send('vbrain_visibility_v13',{state:'background',sessionMs:now()-started})}else{lastInput=now();lastBeat=now();send('vbrain_visibility_v13',{state:'foreground',screen:screen()});enter('foreground')}});
    const oldResume=window.onAppResume;window.onAppResume=function(){const r=typeof oldResume==='function'?oldResume.apply(this,arguments):undefined;lastInput=now();lastBeat=now();send('vbrain_resume_v13',{screen:screen(),sessionMs:now()-started});setTimeout(()=>checkScreen('resume'),0);return r};
    lastScreen=screen();screenAt=now();maxScroll=depth();send('vbrain_screen_v13',{phase:'enter',screen:lastScreen,reason:'startup',viewportW:innerWidth,viewportH:innerHeight});
    setInterval(heartbeat,45000);setInterval(()=>checkScreen('poll'),3000);
  }
  window.VBrainObservability={version:VERSION,health:()=>({version:VERSION,sessionId:sid,screen:screen(),sessionMs:now()-started,lastInputAgoMs:now()-lastInput,scrollDepth:maxScroll})};
  install();
})();
