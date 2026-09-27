/* V-Brain backup UI retirement v22 — remove legacy migration/recovery surfaces from the live home UI. */
(function(){
  'use strict';
  if(window.__VBRAIN_BACKUP_RETIREMENT_V22__)return;window.__VBRAIN_BACKUP_RETIREMENT_V22__=true;
  const IDS=['vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','vBrainOpenBackup','homeRecoveryFlexEntry','homeSafeBackupModal','vbrainDataModal'];
  const selector=IDS.map(id=>'#'+id).join(',');
  function remove(){
    try{document.querySelectorAll(selector).forEach(el=>el.remove())}catch(_){}
    try{document.getElementById('homeRecoveryModal')?.classList.remove('show')}catch(_){}
    try{document.body.style.overflow=''}catch(_){}
  }
  let style=document.getElementById('vbrainBackupRetirementV22Style');
  if(!style){style=document.createElement('style');style.id='vbrainBackupRetirementV22Style';style.textContent=`${selector},#homeRecoveryModal{display:none!important;visibility:hidden!important;pointer-events:none!important}`;document.head.appendChild(style)}
  const observer=new MutationObserver(records=>{
    for(const record of records){if(record.addedNodes?.length){remove();break}}
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  remove();setTimeout(remove,50);setTimeout(remove,500);setTimeout(remove,2200);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)remove()});
  window.addEventListener('focus',remove);
  window.VBrainBackupRetirement={version:22,remove};
})();
