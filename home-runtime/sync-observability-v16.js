/* HOME sync observability v16 — visible, privacy-safe transport health. */
(function(){
'use strict'; if(window.__HOME_SYNC_OBSERVABILITY_V16__)return; window.__HOME_SYNC_OBSERVABILITY_V16__=true;
function status(){
 try{
  const raw=window.AdaptiveNative?.homeSyncStatus?.();
  const s=raw?JSON.parse(raw):{configured:false,pending:0};
  window.__HOME_SYNC_STATUS__=s;
  document.documentElement.dataset.homeSync=s.configured?(Number(s.pending)>0?'pending':'ok'):'offline';
  return s;
 }catch(e){return {configured:false,pending:-1}}
}
function flush(){try{window.AdaptiveNative?.flushPrivateSync?.()}catch(e){} return status()}
window.HOMESyncV16={status,flush};
const old=window.onHomePrivateSync; window.onHomePrivateSync=function(v){try{old?.(v)}catch(e){}status()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')flush()});
window.addEventListener('online',flush);
setInterval(()=>{if(document.visibilityState==='visible')flush()},60000);
setTimeout(flush,800);
})();