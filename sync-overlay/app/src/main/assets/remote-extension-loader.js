/* HOME live loader v5 — signed-in shell, remotely versioned UI modules with local/cache fallback. */
(function(){
'use strict'; if(window.__HOME_REMOTE_LOADER_V5__)return; window.__HOME_REMOTE_LOADER_V5__=true;
const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
const CORE=[
 {name:'runtime.css',kind:'css',id:'homeRemoteExtensionCss'},
 {name:'runtime.js',kind:'js'},
 {name:'behavior-v3.css',kind:'css',id:'homeBehaviourExtensionCss'},
 {name:'behavior-v3.js',kind:'js'}
];
const key=n=>'homeLiveV5:'+n;
const okName=n=>/^[a-zA-Z0-9._/-]+\.(?:js|css)$/.test(n)&&!n.includes('..')&&n.length<120;
async function get(url){const r=await fetch(url+(url.includes('?')?'&':'?')+'v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return r.text()}
function apply(p,t,label){if(!t)return false;try{if(p.kind==='css'){let s=document.getElementById(p.id||('homeLive-'+p.name.replace(/\W/g,'-')));if(!s){s=document.createElement('style');s.id=p.id||('homeLive-'+p.name.replace(/\W/g,'-'));document.head.appendChild(s)}s.textContent=t}else{new Function(t+'\n//# sourceURL='+label)()}return true}catch(e){console.warn('HOME live module failed',p.name,e);return false}}
function cache(p,t){try{localStorage.setItem(key(p.name),t)}catch(e){}}
function cached(p){try{return localStorage.getItem(key(p.name))||''}catch(e){return''}}
async function localCore(){for(const p of CORE){try{const t=await get(p.name);apply(p,t,'home-local-'+p.name)}catch(e){}}}
async function manifest(){try{const m=JSON.parse(await get(BASE+'manifest-v5.json'));const mods=Array.isArray(m.modules)?m.modules:[];return mods.filter(x=>x&&okName(String(x.name||''))&&['js','css'].includes(x.kind)).slice(0,40)}catch(e){return CORE}}
async function refresh(){
 const parts=await manifest(), state={fresh:[],cache:[],failed:[]};
 for(const p of parts){try{const t=await get(BASE+p.name);if(apply(p,t,'home-live-'+p.name)){cache(p,t);state.fresh.push(p.name)}else throw Error('apply')}catch(e){const old=cached(p);if(old&&apply(p,old,'home-cache-'+p.name))state.cache.push(p.name);else state.failed.push(p.name)}}
 try{window.HOMELivingBrainV6?.repair?.();window.HOMEStateV2?.repair?.();window.VBrainStability?.repair?.();window.__homeRemoteV2Refresh?.();AdaptiveNative?.flushPrivateSync?.()}catch(e){}
 try{window.homeAdaptiveLog?.('remote_extension_loaded',{version:5,...state})}catch(e){}
 return state;
}
window.HOMERemoteExtension={version:5,refresh};
CORE.forEach(p=>{const t=cached(p);if(t)apply(p,t,'home-cache-'+p.name)});
localCore().then(refresh);
const old=window.onAppResume;window.onAppResume=function(){try{old?.()}catch(e){}refresh()};
setInterval(()=>{if(document.visibilityState==='visible')refresh()},5*60*1000);
})();