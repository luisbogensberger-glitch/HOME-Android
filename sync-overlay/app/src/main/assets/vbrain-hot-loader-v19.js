/* V-Brain Hot Loader v19 — verified, lifecycle-managed JS/CSS hot patches above Host 18. */
(function(){
  'use strict';
  if(window.__VBRAIN_HOT_LOADER_V19__)return;window.__VBRAIN_HOT_LOADER_V19__=true;
  const VERSION=19,BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/',MANIFEST='hot-manifest-v19.json';
  const GOOD='vbrainHotGoodV19',PREV='vbrainHotPrevV19',REJECT='vbrainHotRejectedV19';
  const MAX_MODULES=40,MAX_BYTES=1600000,REFRESH=45000;
  let applying=false,lastCheck=0,active=null,previous=null;
  let status={loader:VERSION,version:'none',source:'stable',modules:0,healthy:true,lastCheck:0,error:'',atomic:true};
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{});AdaptiveNative?.queuePrivateActivity?.(JSON.stringify({id:'hot-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),kind,at:Date.now(),source:'vbrain-hot-v19',data:data||{}}))}catch(_){}};
  const safeName=n=>/^[a-zA-Z0-9._/-]+\.(?:js|css)$/.test(String(n||''))&&!String(n).includes('..')&&String(n).length<160;
  async function text(url){const r=await fetch(url+(url.includes('?')?'&':'?')+'v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.text()}
  function rotr(n,x){return(x>>>n)|(x<<(32-n))}
  function sha256Fallback(ascii){const mathPow=Math.pow,maxWord=mathPow(2,32),lengthProperty='length',words=[],asciiBitLength=ascii[lengthProperty]*8,hash=sha256Fallback.h=sha256Fallback.h||[],k=sha256Fallback.k=sha256Fallback.k||[],primeCounter=k[lengthProperty],isComposite={};for(let candidate=2;primeCounter<64;candidate++){if(!isComposite[candidate]){for(let i=0;i<313;i+=candidate)isComposite[i]=candidate;hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0}}ascii+='\x80';while(ascii[lengthProperty]%64-56)ascii+='\x00';for(let i=0;i<ascii[lengthProperty];i++){const j=ascii.charCodeAt(i);if(j>>8)throw Error('sha256 fallback expects utf8');words[i>>2]|=j<<((3-i)%4)*8}words[words[lengthProperty]]=((asciiBitLength/maxWord)|0);words[words[lengthProperty]]=asciiBitLength;for(let j=0;j<words[lengthProperty];){const w=words.slice(j,j+=16),oldHash=hash.slice(0);hash=hash.slice(0,8);for(let i=0;i<64;i++){const w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4],temp1=hash[7]+(rotr(6,e)^rotr(11,e)^rotr(25,e))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rotr(7,w15)^rotr(18,w15)^(w15>>>3))+w[i-7]+(rotr(17,w2)^rotr(19,w2)^(w2>>>10)))|0),temp2=(rotr(2,a)^rotr(13,a)^rotr(22,a))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));hash=[(temp1+temp2)|0,a,hash[1],hash[2],(hash[3]+temp1)|0,hash[4],hash[5],hash[6]]}for(let i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0}let result='';for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;result+=(b<16?'0':'')+b.toString(16)}return result}
  function utf8(s){return unescape(encodeURIComponent(s))}
  async function sha256(s){try{if(crypto?.subtle){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}}catch(_){}return sha256Fallback(utf8(s))}
  function nativeHost(){try{return Number(JSON.parse(Native.liveRuntimeStatus()).nativeVersion||0)}catch(_){return 0}}
  function validate(m){
    if(!m||![1,2].includes(Number(m.schema)))throw Error('Invalid hot manifest');
    if(Number(m.minHost||18)>nativeHost())throw Error('Hot patch requires newer host');
    const mods=Array.isArray(m.modules)?m.modules:[];if(mods.length>MAX_MODULES)throw Error('Too many hot modules');
    for(const p of mods){if(!safeName(p.name)||!['js','css'].includes(p.kind)||!/^[a-f0-9]{64}$/i.test(String(p.sha256||'')))throw Error('Invalid hot module '+String(p.name||''));if(p.kind==='js'&&String(p.mode||'managed')!=='managed')throw Error('Unmanaged hot JS is disabled: '+p.name)}
    return mods;
  }
  async function downloadBundle(m){const mods=validate(m),parts=[];let bytes=0;for(const p of mods){const body=await text(BASE+p.name);bytes+=new Blob([body]).size;if(bytes>MAX_BYTES)throw Error('Hot patch too large');const digest=await sha256(body);if(digest.toLowerCase()!==String(p.sha256).toLowerCase())throw Error('Hash mismatch '+p.name);parts.push({...p,mode:p.kind==='js'?'managed':'style',body})}return{manifest:m,parts,downloadedAt:Date.now()}}
  function put(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){} }
  function get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}}
  function rejected(v){try{return JSON.parse(localStorage.getItem(REJECT)||'[]').includes(String(v))}catch(_){return false}}
  function reject(v){try{const a=JSON.parse(localStorage.getItem(REJECT)||'[]');if(!a.includes(String(v)))a.push(String(v));while(a.length>12)a.shift();localStorage.setItem(REJECT,JSON.stringify(a))}catch(_){} }
  function candidate(bundle,source){
    const version=String(bundle?.manifest?.version||'unknown'),styles=[],modules=[];
    const api={
      version,context:Object.freeze({host:nativeHost(),live:(()=>{try{return JSON.parse(Native.liveRuntimeStatus())}catch(_){return{}}})()}),
      register(def){if(!def||typeof def!=='object'||typeof def.id!=='string'||!def.id.trim()||typeof def.install!=='function'||typeof def.uninstall!=='function')throw Error('Managed module must register id/install/uninstall');if(modules.some(x=>x.id===def.id))throw Error('Duplicate hot module id '+def.id);modules.push({id:def.id,install:def.install,uninstall:def.uninstall,health:typeof def.health==='function'?def.health:null})}
    };
    for(const p of bundle.parts||[]){
      if(p.kind==='css'){const s=document.createElement('style');s.dataset.vbrainHot=version;s.dataset.source=p.name;s.media='not all';s.textContent=p.body;styles.push(s)}
      else{const before=modules.length;const fn=new Function('VBrainHotAPI','"use strict";\n'+p.body+'\n//# sourceURL=vbrain-hot/'+p.name);fn(api);if(modules.length===before)throw Error('Managed module did not register: '+p.name)}
    }
    return{bundle,source,version,styles,modules,installed:[]};
  }
  async function health(c){for(const m of c?.modules||[]){if(!m.health)continue;const ok=await Promise.resolve(m.health());if(ok===false)throw Error('Health check failed '+m.id)}return true}
  async function uninstall(c){if(!c)return;for(const m of [...(c.installed||[])].reverse()){try{await Promise.resolve(m.uninstall())}catch(_){}}c.installed=[];for(const s of c.styles||[])try{s.remove()}catch(_){} }
  async function install(c){
    for(const s of c.styles||[])document.head.appendChild(s);
    try{
      for(const m of c.modules){await Promise.resolve(m.install());c.installed.push(m)}
      for(const s of c.styles||[])s.media='all';await health(c);return true;
    }catch(e){await uninstall(c);throw e}
  }
  async function stageAndSwap(bundle,source){
    const v=String(bundle?.manifest?.version||'unknown');if(rejected(v))return false;
    let next;try{next=candidate(bundle,source)}catch(e){reject(v);throw e}
    const old=active;
    try{
      if(old)await uninstall(old);
      await install(next);
      previous=old;active=next;
      if(old?.bundle)put(PREV,old.bundle);put(GOOD,bundle);
      status={...status,version:v,source,modules:(bundle.parts||[]).length,healthy:true,error:'',atomic:true};document.documentElement.dataset.vbrainHot=v;log('hot_patch_applied',{version:v,source,modules:status.modules,atomic:true});return true;
    }catch(e){
      reject(v);status={...status,version:v,source,healthy:false,error:String(e?.message||e),atomic:true};
      try{if(old){const restore=candidate(old.bundle,old.source||'rollback');await install(restore);active=restore;status={...status,version:restore.version,source:'rollback',modules:(restore.bundle.parts||[]).length,healthy:true,error:'rolled back: '+String(e?.message||e)}}}catch(re){active=null;status.error+='; rollback failed: '+String(re?.message||re)}
      log('hot_patch_rejected',{version:v,error:String(e?.message||e),rolledBack:!!active});return false;
    }
  }
  async function rollback(){const b=previous?.bundle||get(PREV);if(!b)return false;return stageAndSwap(b,'manual-rollback')}
  async function refresh(force=false){
    if(applying)return status;if(!force&&Date.now()-lastCheck<12000)return status;applying=true;lastCheck=Date.now();status.lastCheck=lastCheck;
    try{if(active)await health(active);const m=JSON.parse(await text(BASE+MANIFEST)),v=String(m.version||'');if(rejected(v))return status;if(v&&v===status.version)return status;const bundle=await downloadBundle(m);await stageAndSwap(bundle,'network')}
    catch(e){status.error=String(e?.message||e);status.healthy=!!active||status.version==='none';log('hot_patch_check_failed',{error:status.error})}
    finally{applying=false}return status;
  }
  async function boot(){const c=get(GOOD);if(c){try{await stageAndSwap(c,'cache')}catch(_){}}await refresh(true)}
  window.VBrainHotLoader={version:VERSION,refresh:()=>refresh(true),rollback,status:()=>({...status}),active:()=>active?.version||'none'};
  const old=window.onAppResume;window.onAppResume=function(){try{old?.()}catch(_){}refresh(true)};
  boot();setInterval(()=>{if(!document.hidden)refresh(false)},REFRESH);
})();
