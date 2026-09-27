/* HOME remote extension loader v4 — same direct HOME mechanism, upgrade-safe cache + fast refresh. */
(function(){
  'use strict';
  if(window.__HOME_REMOTE_LOADER_V4__)return;window.__HOME_REMOTE_LOADER_V4__=true;
  const VERSION=4;
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  const CACHE_SCHEMA='host18-v4';
  const PARTS=[
    {name:'runtime.css',kind:'css',id:'homeRemoteExtensionCss'},
    {name:'runtime.js',kind:'js',label:'home-runtime-remote.js'},
    {name:'behavior-v3.css',kind:'css',id:'homeBehaviourExtensionCss'},
    {name:'behavior-v3.js',kind:'js',label:'home-behaviour-remote.js'},
    {name:'vbrain-compat-restore-v1.js',kind:'js',label:'vbrain-compat-restore-v1.js'}
  ].map(p=>({...p,key:'homeRemote:'+CACHE_SCHEMA+':'+p.name}));
  const LEGACY_KEYS=['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3','vbrainCompatRestoreV1'];
  const applied=Object.create(null);
  let refreshing=false,lastRefresh=0;
  function log(kind,data){try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}}
  function purgeLegacy(){
    try{
      if(localStorage.getItem('homeRemoteCacheSchema')===CACHE_SCHEMA)return;
      LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));
      localStorage.setItem('homeRemoteCacheSchema',CACHE_SCHEMA);
      log('remote_legacy_cache_purged',{version:VERSION,schema:CACHE_SCHEMA});
    }catch(_){}
  }
  async function fetchText(name){
    try{const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(_){}
    try{const r=await fetch(name+'?local='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(_){}
    throw new Error('Could not load '+name);
  }
  function applyCss(id,css){
    if(!css)return false;let s=document.getElementById(id);if(!s){s=document.createElement('style');s.id=id;document.head.appendChild(s)}
    if(s.textContent!==css)s.textContent=css;return true;
  }
  function run(js,name){
    if(!js)return false;
    /* Compile first. Execution deliberately remains the old HOME direct-JS model. */
    const fn=new Function(js+'\n//# sourceURL='+name);
    fn();return true;
  }
  function apply(part,text,source){
    try{
      if(part.kind==='css')return applyCss(part.id,text);
      if(applied[part.name]===text)return true;
      if(run(text,source==='cache'?part.label.replace('remote','cache'):part.label)){applied[part.name]=text;return true}
    }catch(e){try{console.warn('HOME remote layer failed',part.name,e)}catch(_){}log('remote_layer_failed',{name:part.name,source,error:String(e?.message||e)});}
    return false;
  }
  function cached(part){try{return localStorage.getItem(part.key)||''}catch(_){return''}}
  function save(part,text){try{if(text)localStorage.setItem(part.key,text)}catch(_){} }
  function drop(part){try{localStorage.removeItem(part.key)}catch(_){} }
  async function refresh(force=false){
    const now=Date.now();if(refreshing)return{busy:true};if(!force&&now-lastRefresh<3000)return{throttled:true};
    refreshing=true;lastRefresh=now;
    try{
      const results=await Promise.allSettled(PARTS.map(p=>fetchText(p.name)));
      const state={fresh:[],cache:[],same:[],failed:[]};
      PARTS.forEach((part,i)=>{
        const result=results[i],old=cached(part);
        if(result.status==='fulfilled'&&result.value){
          const text=result.value;
          if(applied[part.name]===text){if(old!==text)save(part,text);state.same.push(part.name);return}
          if(apply(part,text,'remote')){save(part,text);state.fresh.push(part.name);return}
          if(old&&old!==text&&apply(part,old,'cache')){state.cache.push(part.name);return}
          state.failed.push(part.name);return;
        }
        if(old){if(apply(part,old,'cache'))state.cache.push(part.name);else{drop(part);state.failed.push(part.name)}}else state.failed.push(part.name);
      });
      try{window.HOMELivingBrainV6?.repair?.();window.HOMEStateV2?.repair?.();window.VBrainCompatRestore?.repair?.()}catch(_){}
      log('remote_extension_loaded',{version:VERSION,schema:CACHE_SCHEMA,...state});return state;
    }finally{refreshing=false}
  }
  function boot(){
    purgeLegacy();
    /* New-schema cache is safe to use immediately; Host-17 cache is never executed. */
    PARTS.forEach(p=>{const old=cached(p);if(old)apply(p,old,'cache')});
    setTimeout(()=>refresh(true),120);
  }
  window.HOMERemoteExtension={version:VERSION,refresh:()=>refresh(true),status:()=>({version:VERSION,schema:CACHE_SCHEMA,lastRefresh,refreshing})};
  const oldResume=window.onAppResume;
  window.onAppResume=function(){try{oldResume?.()}catch(_){}refresh(true)};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(true)});
  window.addEventListener('focus',()=>refresh(false));window.addEventListener('online',()=>refresh(true));
  setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},15000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
