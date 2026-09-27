/* HOME remote extension loader v4 — lean compatibility bridge; complete UI now ships in the verified live release. */
(function(){
  'use strict';
  if(window.__HOME_REMOTE_LOADER_V4__)return;
  window.__HOME_REMOTE_LOADER_V4__=true;
  const VERSION=4,CACHE_SCHEMA='host18-v5';
  const LEGACY_KEYS=['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3','vbrainCompatRestoreV1'];
  let lastRefresh=0;

  function log(kind,data){try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}}
  function purgeLegacy(){
    try{
      const remove=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);if(!k)continue;
        if(LEGACY_KEYS.includes(k)||k.startsWith('homeRemote:host18-v4:')||k.startsWith('homeRemote:host17-'))remove.push(k);
      }
      remove.forEach(k=>localStorage.removeItem(k));
      localStorage.setItem('homeRemoteCacheSchema',CACHE_SCHEMA);
      log('remote_legacy_cache_purged',{version:VERSION,schema:CACHE_SCHEMA,count:remove.length});
    }catch(_){}
  }
  async function refresh(){
    purgeLegacy();lastRefresh=Date.now();
    const state={version:VERSION,schema:CACHE_SCHEMA,mode:'bundled-live-release',networkLoads:0,lastRefresh};
    log('remote_extension_loaded',state);return state;
  }
  function boot(){purgeLegacy();lastRefresh=Date.now();log('remote_extension_ready',{version:VERSION,schema:CACHE_SCHEMA,mode:'bundled-live-release'})}
  window.HOMERemoteExtension={version:VERSION,refresh,status:()=>({version:VERSION,schema:CACHE_SCHEMA,lastRefresh,mode:'bundled-live-release'})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
