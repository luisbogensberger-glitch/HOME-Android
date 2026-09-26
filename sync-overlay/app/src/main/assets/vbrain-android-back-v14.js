/* V-Brain v14 — Android system Back integration for the living-model overlay. */
(function(){
  'use strict';
  if(window.__VBRAIN_ANDROID_BACK_V14__) return;
  window.__VBRAIN_ANDROID_BACK_V14__=true;

  const previousBack = typeof window.handleAndroidBack === 'function'
    ? window.handleAndroidBack
    : null;

  window.handleAndroidBack = function(){
    try{
      const brain = document.getElementById('vBrainV8');
      if(brain && brain.classList.contains('show')){
        const visualBack = brain.querySelector('.vb8Back');
        if(visualBack) visualBack.click();
        else {
          brain.classList.remove('show');
          document.body.style.overflow='';
        }
        return 'handled';
      }
    }catch(e){}

    return previousBack ? previousBack.apply(this, arguments) : 'home';
  };
})();
