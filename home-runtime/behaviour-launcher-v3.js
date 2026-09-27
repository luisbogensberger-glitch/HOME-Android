/* HOME Behaviour Intelligence launcher v3 — binds Day Score to the live Today's Quest card. */
(function(){
  'use strict';
  if(window.__HOME_BEHAVIOUR_LAUNCHER_V3__)return;
  window.__HOME_BEHAVIOUR_LAUNCHER_V3__=true;
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';

  async function loadV7(){
    if(window.__VBRAIN_BEHAVIOUR_V7__)return;
    try{
      const r=await fetch(BASE+'behaviour-engine-v7.js?v='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('v7 '+r.status);
      new Function(await r.text()+'\n//# sourceURL=vbrain-behaviour-engine-v7.js')();
    }catch(e){try{console.warn('V-Brain behaviour v7 failed to load',e)}catch(_) {}}
  }

  const open=()=>{try{window.HOMEBehaviourIntelligence?.open?.()}catch(e){try{document.getElementById('homeDayScoreV2')?.click()}catch(_){}}};

  function style(){
    if(document.getElementById('homeBehaviourLauncherV3Style'))return;
    const s=document.createElement('style');s.id='homeBehaviourLauncherV3Style';s.textContent=`
      #homeMomentum.homeQuestV7{position:relative;cursor:pointer}
      #homeMomentum.homeQuestV7 .hqTop{align-items:flex-start}
      #homeQuestDayScoreV3{margin-left:auto;margin-right:8px;flex:0 0 auto;border:1px solid rgba(255,255,255,.18);background:rgba(12,14,18,.62);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;border-radius:13px;padding:7px 10px;min-width:61px;display:flex;flex-direction:column;align-items:flex-end;gap:1px;box-shadow:0 8px 22px rgba(0,0,0,.18);font:inherit;position:relative;z-index:5}
      #homeQuestDayScoreV3 small{font-size:8px;line-height:1;letter-spacing:.13em;opacity:.62;font-weight:850;white-space:nowrap}
      #homeQuestDayScoreV3 b{font-size:16px;line-height:1.05;font-weight:900}
      #homeDayScoreV2.hbFloat{display:none!important}
      #homeMomentum.homeQuestV7:after{content:'Tap for Behaviour Intelligence';position:absolute;right:18px;bottom:10px;font-size:8px;letter-spacing:.08em;opacity:.34;pointer-events:none}
    `;document.head.appendChild(s);
  }

  function score(){
    try{return Math.round(Number(window.HOMEBehaviourIntelligence?.score?.().score)||0)}catch(e){return 0}
  }

  function bind(){
    style();
    const quest=document.getElementById('homeMomentum');
    if(!quest)return;
    const top=quest.querySelector('.hqTop');
    if(!top)return;
    let b=document.getElementById('homeQuestDayScoreV3');
    if(!b){
      b=document.createElement('button');b.id='homeQuestDayScoreV3';b.type='button';b.setAttribute('aria-label','Open Behaviour Intelligence');
      b.innerHTML='<small>DAY SCORE</small><b>0</b>';
      const streak=top.querySelector('.hqStreak');
      if(streak)top.insertBefore(b,streak);else top.appendChild(b);
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open()},true);
    }
    const n=b.querySelector('b');if(n)n.textContent=String(score());
    if(!quest.__homeBehaviourBound){
      quest.__homeBehaviourBound=true;
      quest.addEventListener('click',e=>{
        if(e.target.closest('button,a,input,textarea,select'))return;
        open();
      },false);
    }
  }

  loadV7();setTimeout(loadV7,900);setTimeout(loadV7,3000);
  bind();setTimeout(bind,250);setTimeout(bind,900);setTimeout(bind,2200);setTimeout(bind,5000);
  const mo=new MutationObserver(()=>requestAnimationFrame(bind));
  mo.observe(document.documentElement,{subtree:true,childList:true});
  setInterval(bind,10000);
  window.HOMEBehaviourLauncherV3={refresh:bind,open};
})();
