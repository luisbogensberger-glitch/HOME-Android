/* V-Brain Core v24 — headless config/activity plane. It never owns DOM or layout. */
(function(){
  'use strict';
  if(window.__VBRAIN_CORE_V24__)return;window.__VBRAIN_CORE_V24__=true;
  window.__VBRAIN_SINGLE_UI_OWNER_V24__=true;
  const VERSION=24;
  const CONFIG_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/adaptive-ui.json';
  const CACHE='vbrainConfigV24',LEGACY_CACHE='homeAdaptiveConfigV1',ACT='homeAdaptiveActivityV1',MAX_ACTIVITY=600;
  const DEFAULT={version:24,theme:{radius:22,accent:'#f0c95d'},tube:{layout:'stack'},todos:{layout:'focus'},remoteUI:{enabled:false,replaceHome:false,refreshMs:2500,components:[]},notifications:{enabled:true}};
  let busy=false,lastFetch=0,lastSig='';
  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function merge(a,b){const out=clone(a);if(!isObj(b))return out;for(const k of Object.keys(b)){out[k]=isObj(out[k])&&isObj(b[k])?merge(out[k],b[k]):b[k]}return out}
  function load(k,f){try{return JSON.parse(localStorage.getItem(k)||'')??f}catch(_){return f}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){} }
  function activity(){const rows=load(ACT,[]);return Array.isArray(rows)?rows:[]}
  function log(type,data){
    const row={id:'v24-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),type,kind:type,at:Date.now(),screen:String(window.currentScreen||document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home'),source:'vbrain-core-v24',data:data||{}};
    const rows=activity();rows.push(row);if(rows.length>MAX_ACTIVITY)rows.splice(0,rows.length-MAX_ACTIVITY);save(ACT,rows);
    try{AdaptiveNative?.logActivity?.(JSON.stringify(row))}catch(_){}
    return row;
  }
  let initial=load(CACHE,null)||load(LEGACY_CACHE,{});
  let config=merge(DEFAULT,initial||{});config.tube=merge(config.tube||{},{layout:'stack'});
  function privatePatch(){try{return JSON.parse(Native?.loadState?.('vbrainPrivatePatch')||'{}')||{}}catch(_){return{}}}
  function publish(next,source){
    next=merge(DEFAULT,next||{});next=merge(next,privatePatch());next.tube=merge(next.tube||{},{layout:'stack'});
    let sig='';try{sig=JSON.stringify(next)}catch(_){sig=String(Date.now())}
    const changed=sig!==lastSig;config=next;window.HOMEAdaptive.config=config;save(CACHE,config);lastSig=sig;
    if(changed){try{window.dispatchEvent(new CustomEvent('vbrain:config',{detail:{version:VERSION,source,config}}))}catch(_){} }
    return config;
  }
  async function refresh(force=false){
    const now=Date.now();if(busy)return config;if(!force&&now-lastFetch<1800)return config;busy=true;lastFetch=now;
    let next=null,source='cache',controller=null,timer=0;
    try{
      controller=new AbortController();timer=setTimeout(()=>controller.abort(),1400);
      const r=await fetch(CONFIG_URL+'?v='+now,{cache:'no-store',signal:controller.signal});
      if(r.ok){const txt=await r.text();if(txt.length<100000){next=JSON.parse(txt);source='remote'}}
    }catch(_){}finally{clearTimeout(timer);busy=false}
    if(!next)next=load(CACHE,config);
    return publish(next,source);
  }
  window.homeAdaptiveLog=log;
  window.HOMEAdaptive={config,version:VERSION,refresh:()=>refresh(true),log,activity:()=>activity().slice()};
  publish(config,'boot-cache');
  const poll=()=>{if(!document.hidden)refresh(false)};
  setTimeout(()=>refresh(true),180);
  setInterval(poll,2500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true)});
  const prior=window.onAppResume;window.onAppResume=function(){try{prior?.()}catch(_){}refresh(true)};
})();
