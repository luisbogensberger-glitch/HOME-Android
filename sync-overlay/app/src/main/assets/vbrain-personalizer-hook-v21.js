/* V-Brain Personalizer v21 view hook — refresh context as soon as the Brain DOM exists. */
(function(){
  'use strict';
  if(window.__VBRAIN_PERSONALIZER_HOOK_V21__)return;window.__VBRAIN_PERSONALIZER_HOOK_V21__=true;
  const refresh=()=>{try{window.VBrainPersonalizer?.refresh?.()}catch(_){}};
  if(document.getElementById('vBrainV8'))return refresh();
  const observer=new MutationObserver(()=>{if(document.getElementById('vBrainV8')){observer.disconnect();setTimeout(refresh,0)}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
