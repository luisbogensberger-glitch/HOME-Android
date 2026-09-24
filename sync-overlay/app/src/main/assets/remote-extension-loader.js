/* Loads arbitrary HOME web-layer overrides from GitHub at runtime.
 * Design, structure, behaviour experiments and gamification can ship without a new APK.
 */
(function(){
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  const CSS_KEY='homeRemoteCssV2',JS_KEY='homeRemoteJsV2',BCSS_KEY='homeBehaviorCssV3',BJS_KEY='homeBehaviorJsV3';
  async function text(name){const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}
  function applyCss(id,css){let s=document.getElementById(id);if(!s){s=document.createElement('style');s.id=id;document.head.appendChild(s)}s.textContent=css}
  function run(js,name){new Function(js+'\n//# sourceURL='+name)()}
  async function refresh(){
    try{
      const [css,js,bcss,bjs]=await Promise.all([text('runtime.css'),text('runtime.js'),text('behavior-v3.css'),text('behavior-v3.js')]);
      localStorage.setItem(CSS_KEY,css);localStorage.setItem(JS_KEY,js);localStorage.setItem(BCSS_KEY,bcss);localStorage.setItem(BJS_KEY,bjs);
      applyCss('homeRemoteExtensionCss',css);applyCss('homeBehaviourExtensionCss',bcss);run(js,'home-runtime-remote.js');run(bjs,'home-behaviour-remote.js');
      if(window.homeAdaptiveLog)window.homeAdaptiveLog('remote_extension_loaded',{behaviour:3});
    }catch(e){
      const css=localStorage.getItem(CSS_KEY),js=localStorage.getItem(JS_KEY),bcss=localStorage.getItem(BCSS_KEY),bjs=localStorage.getItem(BJS_KEY);
      if(css)applyCss('homeRemoteExtensionCss',css);if(bcss)applyCss('homeBehaviourExtensionCss',bcss);if(js)try{run(js,'home-runtime-cache.js')}catch(_){}if(bjs)try{run(bjs,'home-behaviour-cache.js')}catch(_){}
    }
  }
  window.HOMERemoteExtension={refresh};
  refresh();
  const old=window.onAppResume;window.onAppResume=function(){try{if(old)old()}catch(e){}refresh()};
})();
