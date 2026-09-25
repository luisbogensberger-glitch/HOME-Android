/* HOME live behaviour bootstrap — stable core only. Behaviour Intelligence UI is temporarily disabled after tap-blocking regressions. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';

  /* Emergency recovery: never let an experimental behaviour overlay/launcher block HOME. */
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
    if(!kill){
      kill=document.createElement('style');
      kill.id='homeBehaviourEmergencyDisable';
      kill.textContent=`
        #homeDayScoreV2,#homeDayScoreV3,#homeDayScoreV4,
        #homeBehaviourOverlayV2,#homeBehaviourOverlayV3,#homeBehaviourOverlayV4,
        .hbQuestHint{display:none!important;pointer-events:none!important;visibility:hidden!important}
        body{overflow:auto!important}
      `;
      document.head.appendChild(kill);
    }
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
    const feedback=await safeLoad('feedback-pulse-v1.js','home-feedback-pulse-v1.js');
    try{window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,postInstall:1,feedbackPulse:feedback?1:0,behaviourMap:0,recovery:'behaviour-ui-disabled'})}catch(e){}
  })();
})();
