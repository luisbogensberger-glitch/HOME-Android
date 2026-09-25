/* HOME live behaviour bootstrap — behaviour, learning, habits, task pressure, sync repair, and transparent Behaviour Intelligence. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
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
    const mapOk=await safeLoad('behaviour-map-v4.js','home-behaviour-map-v4.js');
    try{window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,postInstall:1,behaviourMap:mapOk?4:0})}catch(e){}
  })();
})();
