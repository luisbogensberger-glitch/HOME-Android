/* HOME live behaviour bootstrap — preserves v3/v6 behaviour and layers v8 learning policy. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  async function get(name){const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}
  function run(js,name){new Function(js+'\n//# sourceURL='+name)()}
  (async()=>{
    try{
      const [behaviour,learning]=await Promise.all([get('behavior-v3-base.js'),get('learning-engine-v8.js')]);
      run(behaviour,'home-behaviour-v3-base.js');
      run(learning,'home-learning-engine-v8.js');
      try{window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{version:8})}catch(e){}
    }catch(e){
      try{console.warn('HOME learning bootstrap failed',e)}catch(_){}
    }
  })();
})();
