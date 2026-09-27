/* HOME live JS/CSS: verified bundles, last-good offline boot, reload rollback. */
(function(){
 'use strict';if(window.__VBRAIN_HOT_LOADER_V19__)return;window.__VBRAIN_HOT_LOADER_V19__=true;
 const VERSION=20,BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/',GOOD='vbrainHotGoodV19',PREVIOUS='vbrainHotPreviousV20',PENDING='vbrainHotPendingV20',REJECT='vbrainHotRejectedV19',MAX_BYTES=1600000,encoder=new TextEncoder();
 let busy=false,staged=null,hasLiveJS=false,lastCheck=0,lastInput=0,status={loader:VERSION,version:'none',source:'stable',modules:0,healthy:true,lastCheck:0,error:'',applying:false,pending:''};
 const log=(kind,data)=>{try{AdaptiveNative.queuePrivateActivity(JSON.stringify({id:'hot-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),kind,at:Date.now(),source:'vbrain-hot-v20',data}))}catch(_){}};
 const read=(key,f=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??f}catch(_){return f}};
 const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
 const rejected=v=>read(REJECT,[]).includes(String(v));
 function reject(v){const values=read(REJECT,[]);if(!values.includes(String(v)))values.push(String(v));write(REJECT,values.slice(-30))}
 const nativeHost=()=>{try{return Number(JSON.parse(Native.liveRuntimeStatus()).nativeVersion||0)}catch(_){return 0}};
 function validate(m){
  if(!m||m.schema!==1||typeof m.version!=='string'||!m.version||m.version.length>100||Number(m.minHost||18)>nativeHost()||!Array.isArray(m.modules)||m.modules.length>40)throw Error('Invalid or incompatible manifest');
  const names=new Set();for(const p of m.modules){if(!p||!['js','css'].includes(p.kind)||!new RegExp('^[a-zA-Z0-9_/-][a-zA-Z0-9._/-]*\\.'+p.kind+'$').test(p.name)||p.name.includes('..')||p.name.length>160||names.has(p.name)||!/^[a-f0-9]{64}$/i.test(p.sha256))throw Error('Invalid or duplicate module');names.add(p.name)}return m.modules;
 }
 // Android file:// WebViews may lack crypto.subtle. Keep the fallback byte-correct.
 function fallback(bytes){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],buf=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);buf.set(bytes);buf[bytes.length]=128;const view=new DataView(buf.buffer);view.setUint32(buf.length-4,bytes.length*8);const R=(v,n)=>(v>>>n)|(v<<(32-n));
  for(let off=0;off<buf.length;off+=64){const W=new Uint32Array(64);for(let i=0;i<16;i++)W[i]=view.getUint32(off+i*4);for(let i=16;i<64;i++){const a=W[i-15],b=W[i-2];W[i]=(W[i-16]+(R(a,7)^R(a,18)^(a>>>3))+W[i-7]+(R(b,17)^R(b,19)^(b>>>10)))>>>0}let [a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const t1=(h+(R(e,6)^R(e,11)^R(e,25))+((e&f)^(~e&g))+K[i]+W[i]+0)>>>0,t2=((R(a,2)^R(a,13)^R(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}const v=[a,b,c,d,e,f,g,h];for(let i=0;i<8;i++)H[i]=(H[i]+v[i])>>>0}return H.map(x=>x.toString(16).padStart(8,'0')).join('');
 }
 async function sha256(text){const bytes=encoder.encode(text);if(globalThis.crypto?.subtle)try{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(_){}return fallback(bytes)}
 async function fetchText(file,limit){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch(BASE+file+'?v='+Date.now(),{cache:'no-store',signal:ctl.signal});if(!r.ok)throw Error('HTTP '+r.status);if(Number(r.headers?.get('content-length')||0)>limit)throw Error('Download too large');if(!r.body?.getReader){const t=await r.text();if(encoder.encode(t).length>limit)throw Error('Download too large');return t}const reader=r.body.getReader(),chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Download too large')}chunks.push(value)}const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}finally{clearTimeout(timer)}
 }
 async function verify(bundle){
  const mods=validate(bundle?.manifest);if(!Array.isArray(bundle.parts)||mods.length!==bundle.parts.length)throw Error('Incomplete bundle');let bytes=0;for(let i=0;i<mods.length;i++){const p=bundle.parts[i],m=mods[i];if(p.name!==m.name||p.kind!==m.kind||typeof p.body!=='string')throw Error('Module mismatch');bytes+=encoder.encode(p.body).length;if(bytes>MAX_BYTES)throw Error('Bundle too large');if(await sha256(p.body)!==m.sha256.toLowerCase())throw Error('Hash mismatch '+m.name);if(m.kind==='js')new Function(p.body)}return bundle;
 }
 function idle(){return !document.hidden&&Date.now()-lastInput>1200&&!!document.querySelector('#homeScreen.show')&&!document.querySelector('#vBrainV8.show,#vBrainV19.show,#vbrainControl17.show,#reader.show')&&!document.activeElement?.matches('input,textarea,[contenteditable="true"]')}
 function removeStyles(){document.querySelectorAll('style[data-vbrain-hot]').forEach(x=>x.remove())}
 async function apply(bundle,source){
  if(status.applying)return false;const v=bundle.manifest.version;if(rejected(v))return false;await verify(bundle);status.applying=true;let error=null;
  const onError=e=>{error=e.error||e.reason||Error(e.message||'Hot patch failed')};window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  try{
   write(PENDING,{version:v,at:Date.now()});removeStyles();
   for(const p of bundle.parts){if(p.kind==='css'){const s=document.createElement('style');s.dataset.vbrainHot=v;s.textContent=p.body;document.head.appendChild(s)}else new Function(p.body+'\n//# sourceURL=vbrain-hot/'+p.name)()}
   await new Promise(r=>setTimeout(r,1800));if(error)throw error;
   if(!window.VBrainTodos||!window.VBrainGraph||document.querySelectorAll('#homeScreen .homeCard').length!==4)throw Error('Core interface health check failed');
   if(source!=='cache'){const old=read(GOOD);if(old&&old.manifest?.version!==v)write(PREVIOUS,old);write(GOOD,bundle)}
   localStorage.removeItem(PENDING);hasLiveJS=bundle.parts.some(p=>p.kind==='js');status={...status,version:v,source,modules:bundle.parts.length,healthy:true,error:'',pending:''};document.documentElement.dataset.vbrainHot=v;log('hot_patch_applied',{version:v,source,modules:bundle.parts.length});return true;
  }catch(e){reject(v);if(read(GOOD)?.manifest?.version===v){const old=read(PREVIOUS);if(old)write(GOOD,old);else localStorage.removeItem(GOOD)}localStorage.removeItem(PENDING);status.error=String(e.message||e);status.healthy=false;removeStyles();log('hot_patch_rejected',{version:v,error:status.error});setTimeout(()=>window.location.reload(),0);return false}
  finally{status.applying=false;window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError)}
 }
 async function activateStaged(){if(!staged||busy||!idle())return;const next=staged;staged=null;busy=true;try{if(hasLiveJS){write('vbrainHotNextV20',next);status.applying=true;window.location.reload();return}await apply(next,'network')}catch(e){status.error=String(e.message||e)}finally{busy=false}}
 async function refresh(force=false){
  if(busy||(!force&&Date.now()-lastCheck<12000))return {...status};busy=true;lastCheck=Date.now();status.lastCheck=lastCheck;
  try{const m=JSON.parse(await fetchText('hot-manifest-v19.json',24000));validate(m);if(m.version===status.version||rejected(m.version))return {...status};const parts=[];let bytes=0;for(const p of m.modules){const body=await fetchText(p.name,MAX_BYTES);bytes+=encoder.encode(body).length;if(bytes>MAX_BYTES)throw Error('Bundle too large');parts.push({...p,body})}staged=await verify({manifest:m,parts});status.pending=m.version;status.error=''}catch(e){status.error=String(e.message||e);log('hot_patch_check_failed',{error:status.error})}finally{busy=false}await activateStaged();return {...status};
 }
 async function boot(){
  const interrupted=read(PENDING);if(interrupted){reject(interrupted.version);if(read(GOOD)?.manifest?.version===interrupted.version){const prior=read(PREVIOUS);if(prior)write(GOOD,prior);else localStorage.removeItem(GOOD)}localStorage.removeItem(PENDING)}
  busy=true;try{const next=read('vbrainHotNextV20');localStorage.removeItem('vbrainHotNextV20');const good=next||read(GOOD);if(good&&!rejected(good.manifest?.version))await apply(good,next?'network':'cache')}catch(e){status.error=String(e.message||e)}finally{busy=false}refresh(true);
 }
 document.addEventListener('input',()=>lastInput=Date.now(),true);document.addEventListener('pointerdown',()=>lastInput=Date.now(),true);
 window.VBrainHotLoader={version:VERSION,refresh:()=>refresh(true),status:()=>({...status}),sha256};const old=window.onAppResume;window.onAppResume=function(){try{old?.()}catch(_){}refresh(true)};
 boot();setInterval(()=>{if(!document.hidden)refresh()},45000);setInterval(activateStaged,2000);
})();
