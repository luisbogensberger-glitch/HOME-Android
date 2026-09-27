/* V-Brain sync recovery v21 — surface rejected HOME tokens without exposing credentials to the WebView. */
(function(){
  'use strict';
  if(window.__VBRAIN_SYNC_RECONNECT_V21__)return;window.__VBRAIN_SYNC_RECONNECT_V21__=true;
  const rejected=s=>s?.authMode!=='veqrya'&&/HOME token rejected|Reconnect HOME Sync/i.test(String(s?.lastError||''));
  const state=()=>{try{return typeof AdaptiveNative!=='undefined'&&AdaptiveNative.homeSyncStatus?JSON.parse(AdaptiveNative.homeSyncStatus()):{}}catch(_){return{}}};
  function paint(){
    const s=state();if(!rejected(s))return false;
    const status=document.getElementById('vbrainLiveStatus17');if(status)status.textContent='V BRAIN 17 · Reconnect HOME';
    const panel=document.getElementById('vbrainControl17');
    if(panel?.classList.contains('show')){
      for(const dt of panel.querySelectorAll('dt'))if(dt.textContent?.trim()==='Private sync'){const dd=dt.nextElementSibling;if(dd)dd.textContent='HOME token rejected · reconnect required'}
      const button=document.getElementById('vb17Sync');if(button)button.textContent='Reconnect HOME';
    }
    return true;
  }
  document.addEventListener('click',e=>{
    const button=e.target?.closest?.('#vb17Sync');if(!button)return;
    if(!rejected(state()))return;
    e.preventDefault();e.stopImmediatePropagation();
    try{
      if(typeof Native!=='undefined'&&Native.configureVeqrya)Native.configureVeqrya();
      else if(typeof Native!=='undefined'&&Native.configureNotion)Native.configureNotion();
    }catch(_){}
    button.textContent=(typeof Native!=='undefined'&&Native.configureVeqrya)?'Veqrya sign-in opened':'Reconnect opened';
  },true);
  const previousConnected=window.onNotionConnected;
  window.onNotionConnected=function(){
    try{previousConnected?.apply(this,arguments)}catch(_){}
    try{AdaptiveNative?.flushPrivateSync?.()}catch(_){}
    try{AdaptiveNative?.checkDeviceCommands?.()}catch(_){}
    setTimeout(paint,500);
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(paint,250)});
  setTimeout(paint,2200);setInterval(()=>{if(!document.hidden)paint()},5000);
})();
