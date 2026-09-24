/* HOME To-Do behaviour: background sync by default, surface only real problems. */
(function(){
  'use strict';
  function connected(){try{return typeof notionConnected==='function'&&notionConnected()}catch(e){return false}}
  function decorateSync(){
    const bar=document.querySelector('#todosScreen .syncBar');
    const status=document.getElementById('syncStatus');
    const syncButton=document.getElementById('syncButton');
    const disconnect=document.getElementById('disconnectButton');
    if(!bar||!status)return;
    const text=String(status.textContent||'').toLowerCase();
    const bad=!connected()||/failed|rejected|disconnected|error|could not|offline/.test(text);
    bar.classList.toggle('homeSyncProblem',bad);
    if(disconnect)disconnect.classList.add('hidden');
    if(bad&&syncButton)syncButton.textContent=connected()?'Retry':'Reconnect';
  }
  const status=document.getElementById('syncStatus');
  if(status)new MutationObserver(decorateSync).observe(status,{childList:true,subtree:true,characterData:true});
  const oldUpdate=window.updateSyncUI;
  if(typeof oldUpdate==='function')window.updateSyncUI=function(){const r=oldUpdate.apply(this,arguments);setTimeout(decorateSync,0);return r};
  const oldShow=window.showScreen;
  if(typeof oldShow==='function')window.showScreen=function(name){const r=oldShow.apply(this,arguments);if(name==='todos')setTimeout(decorateSync,0);return r};
  decorateSync();setTimeout(decorateSync,500);setInterval(decorateSync,4000);
})();
