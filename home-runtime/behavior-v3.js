/* HOME live behaviour bootstrap — preserves behaviour, semantic learning, resilient attempt capture, goal-aware habit adaptation, task pressure, AI-controlled interface policy, post-install sync repair, and transparent behaviour intelligence. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  async function get(name){const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}
  function run(js,name){new Function(js+'\n//# sourceURL='+name)()}
  (async()=>{
    try{
      const [behaviour,learning,resilience,interfacePolicy,habitAdaptation,todoPressure,postInstall,behaviourMap]=await Promise.all([
        get('behavior-v3-base.js'),
        get('learning-engine-v10.js'),
        get('learning-resilience-v11.js'),
        get('interface-policy-v10.js'),
        get('habit-adaptation-v1.js'),
        get('todo-pressure-v1.js'),
        get('post-install-resilience-v1.js'),
        get('behaviour-map-v1.js')
      ]);
      run(behaviour,'home-behaviour-v3-base.js');
      run(learning,'home-learning-engine-v10.js');
      run(resilience,'home-learning-resilience-v11.js');
      run(interfacePolicy,'home-interface-policy-v10.js');
      run(habitAdaptation,'home-habit-adaptation-v1.js');
      run(todoPressure,'home-todo-pressure-v1.js');
      run(postInstall,'home-post-install-resilience-v1.js');
      run(behaviourMap,'home-behaviour-map-v1.js');
      try{window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,postInstall:1,behaviourMap:1})}catch(e){}
    }catch(e){
      try{console.warn('HOME live bootstrap failed',e)}catch(_){}
    }
  })();
})();
