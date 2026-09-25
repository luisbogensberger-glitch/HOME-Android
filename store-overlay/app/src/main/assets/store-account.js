/* HOME Store account entry point. The actual credentials UI is native Android. */
(function(){
  function ready(){
    if(typeof HomeAccount==='undefined') return;
    let button=document.getElementById('homeAccountButton');
    if(!button){
      button=document.createElement('button');
      button.id='homeAccountButton';
      button.type='button';
      button.setAttribute('aria-label','HOME account');
      button.style.cssText='position:fixed;right:16px;top:16px;z-index:9998;border:1px solid rgba(255,255,255,.15);background:rgba(17,18,20,.78);backdrop-filter:blur(14px);color:#fff;border-radius:999px;padding:9px 13px;font:600 12px/1 system-ui;letter-spacing:.02em;box-shadow:0 8px 24px rgba(0,0,0,.16)';
      button.addEventListener('click',()=>HomeAccount.open());
      document.body.appendChild(button);
    }
    try{button.textContent=HomeAccount.isSignedIn()?'Account':'Sign in';}catch(_){button.textContent='Account'}
  }
  const old=window.onHomeAccountChanged;
  window.onHomeAccountChanged=function(state){try{if(old)old(state)}catch(_){}ready()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
