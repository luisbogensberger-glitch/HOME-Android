/* Loads arbitrary HOME web-layer overrides from GitHub at runtime.
 * Future design/structure/quiz experiments can ship without a new APK.
 */
(function(){
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  const CSS_KEY='homeRemoteCssV1',JS_KEY='homeRemoteJsV1';
  async function text(name){const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}
  function applyCss(css){let s=document.getElementById('homeRemoteExtensionCss');if(!s){s=document.createElement('style');s.id='homeRemoteExtensionCss';document.head.appendChild(s)}s.textContent=css}
  function run(js){new Function(js+'\n//# sourceURL=home-runtime-remote.js')()}
  async function refresh(){
    try{
      const [css,js]=await Promise.all([text('runtime.css'),text('runtime.js')]);
      localStorage.setItem(CSS_KEY,css);localStorage.setItem(JS_KEY,js);applyCss(css);run(js);
      if(window.homeAdaptiveLog)window.homeAdaptiveLog('remote_extension_loaded',{});
    }catch(e){
      const css=localStorage.getItem(CSS_KEY),js=localStorage.getItem(JS_KEY);if(css)applyCss(css);if(js)try{run(js)}catch(_){}
    }
  }
  window.HOMERemoteExtension={refresh};
  refresh();
  const old=window.onAppResume;window.onAppResume=function(){try{if(old)old()}catch(e){}refresh()};
})();