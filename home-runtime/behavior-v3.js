/* HOME live behaviour bootstrap — stable core + classic Day Score Brain. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';

  /* Undo the emergency layer that intentionally hid the classic Day Score/Brain. */
  try{
    document.getElementById('homeBehaviourEmergencyDisable')?.remove();
    document.getElementById('homeBrainAllowV4')?.remove();
    document.getElementById('homeSafeToolsStyle')?.remove();
    ['homeSafeBrainModal','homeSafeBackupModal','homeSafeBackupBtn'].forEach(id=>document.getElementById(id)?.remove());
    document.body && (document.body.style.overflow='');

    /* Keep only genuinely obsolete v2/v3 launchers out of the way. v4 is the active one again. */
    ['homeDayScoreV2','homeDayScoreV3','homeBehaviourOverlayV2','homeBehaviourOverlayV3']
      .forEach(id=>document.getElementById(id)?.remove());
  }catch(e){}

  async function get(name){
    try{
      const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});
      if(r.ok)return r.text();
    }catch(e){}
    try{
      const r=await fetch(name+'?v='+Date.now(),{cache:'no-store'});
      if(r.ok)return r.text();
    }catch(e){}
    throw new Error('Could not load '+name);
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

    /* Classic working path: behaviour-map-v4 creates the visible DAY SCORE button itself. */
    const brain=await safeLoad('behaviour-map-v4.js','home-behaviour-map-v4.js');

    function repair(){
      try{
        document.getElementById('homeBehaviourEmergencyDisable')?.remove();
        const api=window.HOMEBehaviourIntelligence;
        if(api){
          /* If another script removed the launcher, reload v4 after clearing its one-shot guard. */
          if(!document.getElementById('homeDayScoreV4')){
            try{delete window.__HOME_BEHAVIOUR_MAP_V4__}catch(e){window.__HOME_BEHAVIOUR_MAP_V4__=false}
            safeLoad('behaviour-map-v4.js','home-behaviour-map-v4-repair.js');
          }
        }
      }catch(e){}
    }
    setTimeout(repair,300);
    setTimeout(repair,1200);
    setTimeout(repair,3000);

    try{
      window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{
        version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,
        postInstall:1,behaviourMap:brain?4:0,recovery:'classic-day-score-restored'
      });
    }catch(e){}
  })();
})();
