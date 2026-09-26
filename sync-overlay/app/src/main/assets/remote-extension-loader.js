/* V-Brain remote extension loader v4 — local core first, remote layers second. */
(function(){
  'use strict';
  if(window.__HOME_REMOTE_LOADER_V4__)return;window.__HOME_REMOTE_LOADER_V4__=true;
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  const PARTS=[
    {name:'runtime.css',key:'homeRemoteCssV2',kind:'css',id:'homeRemoteExtensionCss'},
    {name:'runtime.js',key:'homeRemoteJsV2',kind:'js',label:'home-runtime-remote.js'},
    {name:'behavior-v3.css',key:'homeBehaviorCssV3',kind:'css',id:'homeBehaviourExtensionCss'},
    {name:'behavior-v3.js',key:'homeBehaviorJsV3',kind:'js',label:'home-behaviour-remote.js'}
  ];
  async function fetchRemote(name){try{const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(e){}throw new Error('Remote failed '+name)}
  async function fetchLocal(name){try{const r=await fetch(name+'?local='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(e){}throw new Error('Local failed '+name)}
  function applyCss(id,css){if(!css)return false;let s=document.getElementById(id);if(!s){s=document.createElement('style');s.id=id;document.head.appendChild(s)}s.textContent=css;return true}
  function run(js,name){if(!js)return false;new Function(js+'\n//# sourceURL='+name)();return true}
  function apply(part,text,source){try{if(part.kind==='css')return applyCss(part.id,text);if(part.name==='runtime.js'&&window.HOMERemote)return true;return run(text,source==='cache'?part.label.replace('remote','cache'):part.label)}catch(e){try{console.warn('V-Brain layer failed',part.name,e)}catch(_){}return false}}
  function cached(part){try{return localStorage.getItem(part.key)||''}catch(e){return''}}
  function save(part,text){try{if(text)localStorage.setItem(part.key,text)}catch(e){}}

  async function bootstrapLocalCore(){
    const css=PARTS[0],js=PARTS[1];
    try{apply(css,await fetchLocal(css.name),'local')}catch(e){}
    try{if(!window.HOMERemote)apply(js,await fetchLocal(js.name),'local')}catch(e){}
    try{if(!window.__VBRAIN_STABILITY_V1__)run(await fetchLocal('vbrain-stability-v1.js'),'vbrain-stability-local.js')}catch(e){}
    try{window.__homeRemoteV2Refresh?.();window.VBrainStability?.repair?.()}catch(e){}
  }

  async function refresh(){
    const results=await Promise.allSettled(PARTS.map(p=>fetchRemote(p.name)));
    const state={fresh:[],cache:[],failed:[]};
    PARTS.forEach((part,i)=>{const result=results[i];if(result.status==='fulfilled'&&result.value){if(apply(part,result.value,'remote')){save(part,result.value);state.fresh.push(part.name)}else state.failed.push(part.name)}else{const old=cached(part);if(old&&apply(part,old,'cache'))state.cache.push(part.name);else state.failed.push(part.name)}});
    try{window.HOMELivingBrainV6?.repair?.();window.HOMEStateV2?.repair?.();window.VBrainStability?.repair?.();window.__homeRemoteV2Refresh?.()}catch(e){}
    try{window.homeAdaptiveLog&&window.homeAdaptiveLog('remote_extension_loaded',{version:4,fresh:state.fresh,cache:state.cache,failed:state.failed})}catch(e){}
    return state;
  }

  PARTS.forEach(p=>{const old=cached(p);if(old)apply(p,old,'cache')});
  window.HOMERemoteExtension={version:4,refresh};
  bootstrapLocalCore().then(refresh);
  const oldResume=window.onAppResume;window.onAppResume=function(){try{if(oldResume)oldResume()}catch(e){}bootstrapLocalCore().then(refresh)};
})();
