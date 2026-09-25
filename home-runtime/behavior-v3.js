/* HOME live behaviour bootstrap — stable core + safe HOME Brain entry. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';

  /*
   * IMPORTANT: this file is executed twice in current APKs:
   * 1) the baked asset, then 2) the live remote copy.
   * Therefore recovery must be idempotent and must NEVER delete/hide the stable v4 Brain.
   */
  function repairBrainSafety(){
    try{
      document.body && (document.body.style.overflow='');
      ['homeDayScoreV2','homeDayScoreV3','homeDayScoreV4','homeBehaviourOverlayV2','homeBehaviourOverlayV3']
        .forEach(id=>document.getElementById(id)?.remove());

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
        #homeBehaviourOverlayV2,#homeBehaviourOverlayV3,
        .hbQuestHint{display:none!important;pointer-events:none!important;visibility:hidden!important}
        body{overflow:auto!important}
      `;

      let allow=document.getElementById('homeBrainAllowV4');
      if(!allow){allow=document.createElement('style');allow.id='homeBrainAllowV4';document.head.appendChild(allow)}
      allow.textContent=`
        #homeBehaviourOverlayV4{visibility:visible!important;opacity:1!important}
        #homeBehaviourOverlayV4.show{display:block!important;visibility:visible!important;pointer-events:auto!important;opacity:1!important}
        #homeDayScoreV4{display:none!important;visibility:hidden!important;pointer-events:none!important}
      `;
    }catch(e){}
  }

  repairBrainSafety();

  async function get(name){
    try{
      const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});
      if(r.ok)return r.text();
    }catch(e){}
    /* New APKs bake critical behaviour files locally, so Brain also works if GitHub is temporarily unavailable. */
    const local=await fetch(name+'?v='+Date.now(),{cache:'no-store'});
    if(!local.ok)throw new Error('Could not load '+name);
    return local.text();
  }
  function run(js,name){new Function(js+'\n//# sourceURL='+name)()}
  async function safeLoad(file,label){
    try{run(await get(file),label||file);return true}
    catch(e){try{console.warn('HOME component failed',file,e)}catch(_){}return false}
  }

  (async()=>{
    await safeLoad('behavior-v3-base.js','home-behaviour-v3-base.js');
    await safeLoad('learning-engine-v10.js','home-learning-engine-v10.js');
    await safeLoad('learning-resilience-v11.js','home-learning-resilience-v11.js');
    await safeLoad('interface-policy-v10.js','home-interface-policy-v10.js');
    await safeLoad('habit-adaptation-v1.js','home-habit-adaptation-v1.js');
    await safeLoad('todo-pressure-v1.js','home-todo-pressure-v1.js');
    await safeLoad('post-install-resilience-v1.js','home-post-install-resilience-v1.js');
    const feedback=await safeLoad('feedback-pulse-v1.js','home-feedback-pulse-v1.js');

    repairBrainSafety();
    try{window.HOMEBrainEntryV3?.repair?.()}catch(e){}
    setTimeout(()=>{repairBrainSafety();try{window.HOMEBrainEntryV3?.repair?.()}catch(e){}},150);
    setTimeout(()=>{repairBrainSafety();try{window.HOMEBrainEntryV3?.repair?.()}catch(e){}},800);
    setTimeout(()=>{repairBrainSafety();try{window.HOMEBrainEntryV3?.repair?.()}catch(e){}},2200);

    try{
      window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{
        version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,
        postInstall:1,feedbackPulse:feedback?1:0,behaviourMap:4,recovery:'brain-v4-safe'
      });
    }catch(e){}
  })();
})();
