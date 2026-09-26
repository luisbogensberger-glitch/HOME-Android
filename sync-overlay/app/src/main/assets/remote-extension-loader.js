/* HOME remote extension loader v3 — independent, failure-tolerant layers. */
(function(){
  'use strict';
  if(window.__HOME_REMOTE_LOADER_V3__)return;window.__HOME_REMOTE_LOADER_V3__=true;
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  const PARTS=[
    {name:'runtime.css',key:'homeRemoteCssV2',kind:'css',id:'homeRemoteExtensionCss'},
    {name:'runtime.js',key:'homeRemoteJsV2',kind:'js',label:'home-runtime-remote.js'},
    {name:'behavior-v3.css',key:'homeBehaviorCssV3',kind:'css',id:'homeBehaviourExtensionCss'},
    {name:'behavior-v3.js',key:'homeBehaviorJsV3',kind:'js',label:'home-behaviour-remote.js'}
  ];
  async function fetchText(name){
    try{const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(e){}
    try{const r=await fetch(name+'?local='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(e){}
    throw new Error('Could not load '+name);
  }
  function applyCss(id,css){if(!css)return false;let s=document.getElementById(id);if(!s){s=document.createElement('style');s.id=id;document.head.appendChild(s)}s.textContent=css;return true}
  function run(js,name){if(!js)return false;new Function(js+'\n//# sourceURL='+name)();return true}
  function apply(part,text,source){try{if(part.kind==='css')return applyCss(part.id,text);return run(text,source==='cache'?part.label.replace('remote','cache'):part.label)}catch(e){try{console.warn('HOME remote layer failed',part.name,e)}catch(_){}return false}}
  function cached(part){try{return localStorage.getItem(part.key)||''}catch(e){return''}}
  function save(part,text){try{if(text)localStorage.setItem(part.key,text)}catch(e){}}

  async function refresh(){
    const results=await Promise.allSettled(PARTS.map(p=>fetchText(p.name)));
    const state={fresh:[],cache:[],failed:[]};
    PARTS.forEach((part,i)=>{
      const result=results[i];
      if(result.status==='fulfilled'&&result.value){
        if(apply(part,result.value,'remote')){save(part,result.value);state.fresh.push(part.name)}else state.failed.push(part.name);
      }else{
        const old=cached(part);
        if(old&&apply(part,old,'cache'))state.cache.push(part.name);else state.failed.push(part.name);
      }
    });
    try{window.HOMELivingBrainV6?.repair?.();window.HOMEStateV2?.repair?.()}catch(e){}
    try{window.homeAdaptiveLog&&window.homeAdaptiveLog('remote_extension_loaded',{version:3,fresh:state.fresh,cache:state.cache,failed:state.failed})}catch(e){}
    return state;
  }

  PARTS.forEach(p=>{const old=cached(p);if(old)apply(p,old,'cache')});
  window.HOMERemoteExtension={version:3,refresh};
  refresh();
  const oldResume=window.onAppResume;
  window.onAppResume=function(){try{if(oldResume)oldResume()}catch(e){}refresh()};
})();
