/* HOME State Resilience v2 — safe migration/restore + UI consistency. */
(function(){
  'use strict';
  if(window.__HOME_STATE_RESILIENCE_V2__){try{window.HOMEStateV2?.repair?.()}catch(e){}return}
  window.__HOME_STATE_RESILIENCE_V2__=true;

  const VERSION=2;
  const NATIVE_KEYS=new Set(['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1','livingBrainGraphV6']);
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const enc=new TextEncoder(),dec=new TextDecoder();

  function bytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
  function checksum(raw){let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<raw.length;i++){a=Math.imul((a^raw[i])>>>0,0x01000193)>>>0;b=Math.imul((b+raw[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}

  function hydrateNative(){
    if(typeof Native==='undefined'||!Native.loadState)return;
    NATIVE_KEYS.forEach(k=>{try{if(localStorage.getItem(k))return;const v=Native.loadState(k);if(v)localStorage.setItem(k,v)}catch(e){}});
  }

  function restoreCode(code){
    code=String(code||'').trim();const p=code.split('.');if(p.length!==3||p[0]!=='HOME2J')throw new Error('This is not a HOME2J backup code.');
    const raw=bytes(p[2]);if(checksum(raw)!==p[1])throw new Error('Backup checksum does not match.');
    const payload=JSON.parse(dec.decode(raw));if(payload?.app!=='HOME'||!payload.storage||typeof payload.storage!=='object')throw new Error('Backup payload is invalid.');
    let restored=0;
    Object.entries(payload.storage).forEach(([k,v])=>{if(!k||SECRET_RE.test(k)||typeof v!=='string')return;try{localStorage.setItem(k,v);restored++;if(NATIVE_KEYS.has(k)&&typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}});
    try{localStorage.setItem('homeLastRestoreV2',JSON.stringify({at:Date.now(),createdAt:payload.createdAt||null,restored}))}catch(e){}
    return{restored,createdAt:payload.createdAt||null};
  }

  function actualTubeCount(){
    const grid=document.getElementById('grid');if(grid){const cards=[...grid.querySelectorAll('.card')].filter(x=>x.offsetParent!==null||!x.closest('#learningArchive'));if(cards.length)return cards.length}
    try{if(Array.isArray(window.cards))return window.cards.length}catch(e){}
    return null;
  }

  function updateHomeCounters(){
    const el=document.getElementById('homeTubeReady'),n=actualTubeCount();if(el&&Number.isFinite(n))el.textContent=`${n} card${n===1?'':'s'}`;
    try{
      const raw=(typeof Native!=='undefined'&&Native.loadState)?Native.loadState('todoState'):localStorage.getItem('todoState');
      const s=JSON.parse(raw||'{}'),c=Array.isArray(s.active)?s.active.length:null;const t=document.getElementById('homeTodoCount');if(t&&c!==null)t.textContent=`${c} open`;
    }catch(e){}
  }

  function ensureRestoreUi(){
    const card=[...document.querySelectorAll('.lb6Card')].find(x=>x.querySelector('h3')?.textContent?.trim()==='State safety');if(!card||card.querySelector('#homeRestoreV2'))return;
    const wrap=document.createElement('div');wrap.id='homeRestoreV2';wrap.innerHTML=`<div style="height:1px;background:rgba(255,255,255,.08);margin:15px 0 12px"></div><div class="lb6Sub">Restore a HOME2J code from your previous installation. Existing tokens/passwords are never imported.</div><textarea class="lb6Area" id="homeRestoreInput" placeholder="Paste HOME2J backup code"></textarea><button class="lb6BackupBtn" id="homeRestoreButton" type="button">Restore previous HOME state</button><div class="lb6Status" id="homeRestoreStatus"></div>`;card.appendChild(wrap);
    const input=wrap.querySelector('#homeRestoreInput'),status=wrap.querySelector('#homeRestoreStatus');
    wrap.querySelector('#homeRestoreButton').onclick=()=>{try{const r=restoreCode(input.value);status.textContent=`Restored ${r.restored} HOME state entries. Reloading…`;setTimeout(()=>location.reload(),650)}catch(e){status.textContent=e?.message||'Restore failed.'}};
  }

  function ensureFreshInstallHint(){
    let has=false;try{has=!!(localStorage.getItem('todoState')||localStorage.getItem('tubeState')||(typeof Native!=='undefined'&&((Native.loadState('todoState')||'').length||(Native.loadState('tubeState')||'').length)))}catch(e){}
    if(has)return;
    const inner=document.querySelector('#homeScreen .homeInner');if(!inner||document.getElementById('homeRestoreHint'))return;
    const b=document.createElement('button');b.id='homeRestoreHint';b.type='button';b.textContent='Restore previous HOME data';b.style.cssText='width:100%;margin:0 0 12px;padding:11px 13px;border-radius:15px;border:1px solid rgba(241,212,106,.35);background:rgba(241,212,106,.08);color:#f1d46a;font-weight:800';b.onclick=()=>{try{window.HOMELivingBrainV6?.open?.();setTimeout(ensureRestoreUi,80)}catch(e){window.HOMEClassicBrain?.open?.()}};inner.insertBefore(b,inner.firstChild);
  }

  function repair(){hydrateNative();updateHomeCounters();ensureRestoreUi();ensureFreshInstallHint()}
  window.HOMEStateV2={version:VERSION,restoreCode,repair,hydrateNative};
  repair();setTimeout(repair,450);setTimeout(repair,1600);setInterval(repair,5000);
})();