/* HOME live behaviour bootstrap — stable core + isolated safe tools. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';

  /* Keep every legacy Behaviour Intelligence overlay disabled. Safe Tools use separate IDs and only become interactive when opened deliberately. */
  try{
    document.body && (document.body.style.overflow='');
    ['homeDayScoreV2','homeDayScoreV3','homeDayScoreV4','homeBehaviourOverlayV2','homeBehaviourOverlayV3','homeBehaviourOverlayV4'].forEach(id=>document.getElementById(id)?.remove());
    document.querySelectorAll('[data-home-behaviour-card]').forEach(el=>{
      delete el.dataset.homeBehaviourCard;
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      if(el.getAttribute('aria-label')==='Open Behaviour Intelligence')el.removeAttribute('aria-label');
    });
    document.querySelectorAll('.hbQuestHint').forEach(el=>el.remove());
    let kill=document.getElementById('homeBehaviourEmergencyDisable');
    if(!kill){kill=document.createElement('style');kill.id='homeBehaviourEmergencyDisable';document.head.appendChild(kill)}
    kill.textContent=`
      #homeDayScoreV2,#homeDayScoreV3,#homeDayScoreV4,
      #homeBehaviourOverlayV2,#homeBehaviourOverlayV3,#homeBehaviourOverlayV4,
      .hbQuestHint{display:none!important;pointer-events:none!important;visibility:hidden!important}
      body{overflow:auto!important}
    `;
  }catch(e){}

  async function get(name){const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status+' '+name);return r.text()}
  function run(js,name){new Function(js+'\n//# sourceURL='+name)()}
  async function safeLoad(file,label){try{run(await get(file),label||file);return true}catch(e){try{console.warn('HOME component failed',file,e)}catch(_){}return false}}

  (async()=>{
    await safeLoad('behavior-v3-base.js','home-behaviour-v3-base.js');
    await safeLoad('learning-engine-v10.js','home-learning-engine-v10.js');
    await safeLoad('learning-resilience-v11.js','home-learning-resilience-v11.js');
    await safeLoad('interface-policy-v10.js','home-interface-policy-v10.js');
    await safeLoad('habit-adaptation-v1.js','home-habit-adaptation-v1.js');
    await safeLoad('todo-pressure-v1.js','home-todo-pressure-v1.js');
    await safeLoad('post-install-resilience-v1.js','home-post-install-resilience-v1.js');

    /* Safe replacement: no legacy Brain overlay, no page rerender, no always-on pointer layer. */
    const safeTools=await safeLoad('safe-tools-v1.js','home-safe-tools-v1.js');
    try{window.HOMESafeTools?.repair?.()}catch(e){}
    setTimeout(()=>{try{window.HOMESafeTools?.repair?.()}catch(e){}},500);
    setTimeout(()=>{try{window.HOMESafeTools?.repair?.()}catch(e){}},1800);

    try{window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,postInstall:1,behaviourMap:0,safeTools:safeTools?1:0,recovery:'legacy-overlays-disabled'})}catch(e){}
  })();
})();
