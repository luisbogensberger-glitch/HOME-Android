/* V-Brain State Resilience v3 — permanent backup/restore + UI consistency. */
(function(){
  'use strict';
  if(window.__VBRAIN_STATE_RESILIENCE_V3__){try{window.VBrainState?.repair?.()}catch(e){}return}
  window.__VBRAIN_STATE_RESILIENCE_V3__=true;

  const VERSION=3;
  const NATIVE_KEYS=new Set(['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1','livingBrainGraphV6']);
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const CODE_CACHE=new Set(['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3']);
  const enc=new TextEncoder(),dec=new TextDecoder();

  function b64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function bytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
  function checksum(raw){let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<raw.length;i++){a=Math.imul((a^raw[i])>>>0,0x01000193)>>>0;b=Math.imul((b+raw[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}

  function collectBackup(){
    const storage={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k))continue;const v=localStorage.getItem(k);if(v!==null)storage[k]=v}}catch(e){}
    NATIVE_KEYS.forEach(k=>{try{if(typeof Native!=='undefined'&&Native.loadState){const v=Native.loadState(k);if(typeof v==='string'&&v.length)storage[k]=v}}catch(e){}});
    return{app:'HOME',brand:'V-Brain',version:3,createdAt:Date.now(),storage};
  }
  function makeBackupCode(){const raw=enc.encode(JSON.stringify(collectBackup()));return `HOME2J.${checksum(raw)}.${b64u(raw)}`}

  function hydrateNative(){
    if(typeof Native==='undefined'||!Native.loadState)return;
    NATIVE_KEYS.forEach(k=>{try{if(localStorage.getItem(k))return;const v=Native.loadState(k);if(v)localStorage.setItem(k,v)}catch(e){}});
  }

  function restoreCode(code){
    code=String(code||'').trim();const p=code.split('.');if(p.length!==3||p[0]!=='HOME2J')throw new Error('This is not a compatible V-Brain backup code.');
    const raw=bytes(p[2]);if(checksum(raw)!==p[1])throw new Error('Backup checksum does not match.');
    const payload=JSON.parse(dec.decode(raw));if(!payload?.storage||typeof payload.storage!=='object')throw new Error('Backup payload is invalid.');
    let restored=0;
    Object.entries(payload.storage).forEach(([k,v])=>{if(!k||SECRET_RE.test(k)||typeof v!=='string')return;try{localStorage.setItem(k,v);restored++;if(NATIVE_KEYS.has(k)&&typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}});
    try{localStorage.setItem('homeLastRestoreV2',JSON.stringify({at:Date.now(),createdAt:payload.createdAt||null,restored}))}catch(e){}
    return{restored,createdAt:payload.createdAt||null};
  }

  async function copyText(text,el){try{await navigator.clipboard.writeText(text);return true}catch(e){}try{el.focus();el.select();el.setSelectionRange(0,el.value.length);return document.execCommand('copy')}catch(e){return false}}

  function ensureStyle(){
    if(document.getElementById('vbrainDataStyle'))return;
    const s=document.createElement('style');s.id='vbrainDataStyle';s.textContent=`
      #vbrainDataButton{position:absolute!important;left:18px!important;top:92px!important;z-index:130!important;border:1px solid rgba(255,255,255,.20)!important;background:rgba(12,15,20,.46)!important;color:#fff!important;border-radius:18px!important;padding:10px 13px!important;font:inherit!important;font-size:10px!important;font-weight:850!important;letter-spacing:.12em!important;backdrop-filter:blur(15px)!important;-webkit-backdrop-filter:blur(15px)!important;pointer-events:auto!important;touch-action:manipulation!important}
      #vbrainDataModal{position:fixed;inset:0;z-index:2147483200;background:#080a0e;color:#f7f8fb;display:none;overflow:auto;-webkit-overflow-scrolling:touch}
      #vbrainDataModal.show{display:block}.vbDataTop{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:12px;padding:max(15px,env(safe-area-inset-top)) 18px 12px;background:rgba(8,10,14,.96);backdrop-filter:blur(18px)}.vbDataBack{width:42px;height:42px;border:1px solid rgba(255,255,255,.09);border-radius:21px;background:#151821;color:#fff;font-size:27px}.vbDataTop small{display:block;opacity:.48;font-size:9px;letter-spacing:.15em;font-weight:800}.vbDataTop h1{font-size:20px;margin:1px 0 0}.vbDataBody{padding:14px 16px 48px;max-width:760px;margin:auto}.vbDataCard{border:1px solid rgba(255,255,255,.08);background:#0e1117;border-radius:22px;padding:16px;margin:12px 0}.vbDataCard h2{font-size:18px;margin:0 0 6px}.vbDataCard p{font-size:12px;line-height:1.45;color:rgba(255,255,255,.58);margin:0 0 10px}.vbDataBtn{width:100%;border:0;border-radius:14px;padding:12px 13px;font-weight:850;background:#f2f3f7;color:#111318;margin-top:8px}.vbDataArea{width:100%;min-height:110px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#15171c;color:#fff;padding:11px;font-size:10px;line-height:1.35;margin-top:9px;resize:vertical}.vbDataStatus{font-size:10px;color:rgba(255,255,255,.62);min-height:16px;margin-top:8px}
    `;document.head.appendChild(s);
  }

  function closeData(){document.getElementById('vbrainDataModal')?.classList.remove('show');document.body.style.overflow=''}
  function ensureDataModal(){
    ensureStyle();let m=document.getElementById('vbrainDataModal');if(m)return m;
    m=document.createElement('div');m.id='vbrainDataModal';m.innerHTML=`
      <div class="vbDataTop"><button class="vbDataBack" type="button">‹</button><div><small>V-BRAIN DATA</small><h1>Backup & Restore</h1></div></div>
      <div class="vbDataBody">
        <div class="vbDataCard"><h2>Create backup</h2><p>Exports tasks, Tube progress, training state, interface state and your evolving brain graph. Passwords, tokens and credentials are excluded.</p><button class="vbDataBtn" id="vbCreateBackup" type="button">Create backup code</button><textarea class="vbDataArea" id="vbBackupOut" readonly placeholder="Your backup code appears here"></textarea><button class="vbDataBtn" id="vbCopyBackup" type="button">Copy backup code</button><div class="vbDataStatus" id="vbBackupStatus"></div></div>
        <div class="vbDataCard"><h2>Restore backup</h2><p>Paste a compatible backup code. Existing local state entries with matching keys will be replaced.</p><textarea class="vbDataArea" id="vbRestoreInput" placeholder="Paste backup code"></textarea><button class="vbDataBtn" id="vbRestoreButton" type="button">Restore V-Brain state</button><div class="vbDataStatus" id="vbRestoreStatus"></div></div>
      </div>`;
    document.body.appendChild(m);m.querySelector('.vbDataBack').onclick=closeData;
    const out=m.querySelector('#vbBackupOut'),bst=m.querySelector('#vbBackupStatus');
    m.querySelector('#vbCreateBackup').onclick=()=>{try{out.value=makeBackupCode();bst.textContent='Backup created from the current V-Brain state.'}catch(e){bst.textContent='Backup failed: '+(e?.message||e)}};
    m.querySelector('#vbCopyBackup').onclick=async()=>{if(!out.value){bst.textContent='Create a backup code first.';return}bst.textContent=(await copyText(out.value,out))?'Backup code copied.':'Select the code and copy it manually.'};
    const rin=m.querySelector('#vbRestoreInput'),rst=m.querySelector('#vbRestoreStatus');
    m.querySelector('#vbRestoreButton').onclick=()=>{try{const r=restoreCode(rin.value);rst.textContent=`Restored ${r.restored} V-Brain state entries. Reloading…`;setTimeout(()=>location.reload(),650)}catch(e){rst.textContent=e?.message||'Restore failed.'}};
    return m;
  }
  function openData(){ensureDataModal().classList.add('show');document.body.style.overflow='hidden'}
  function ensureDataButton(){
    ensureStyle();const home=document.getElementById('homeScreen');if(!home)return;
    if(getComputedStyle(home).position==='static')home.style.position='relative';
    let b=document.getElementById('vbrainDataButton');if(!b){b=document.createElement('button');b.id='vbrainDataButton';b.type='button';b.textContent='DATA';home.appendChild(b)}
    b.onclick=e=>{e.preventDefault();e.stopPropagation();openData()};
  }

  function actualTubeCount(){
    const grid=document.getElementById('grid');if(grid){const cards=[...grid.querySelectorAll('.card')].filter(x=>x.offsetParent!==null||!x.closest('#learningArchive'));if(cards.length)return cards.length}
    try{if(Array.isArray(window.cards))return window.cards.length}catch(e){}
    return null;
  }
  function updateHomeCounters(){
    const el=document.getElementById('homeTubeReady'),n=actualTubeCount();if(el&&Number.isFinite(n))el.textContent=`${n} card${n===1?'':'s'}`;
    try{const raw=(typeof Native!=='undefined'&&Native.loadState)?Native.loadState('todoState'):localStorage.getItem('todoState');const s=JSON.parse(raw||'{}'),c=Array.isArray(s.active)?s.active.length:null;const t=document.getElementById('homeTodoCount');if(t&&c!==null)t.textContent=`${c} open`}catch(e){}
  }

  function repair(){hydrateNative();updateHomeCounters();ensureDataButton();ensureDataModal()}
  window.VBrainState={version:VERSION,restoreCode,makeBackupCode,collectBackup,repair,hydrateNative,openData};
  window.HOMEStateV2=window.VBrainState;
  repair();setTimeout(repair,250);setTimeout(repair,900);setTimeout(repair,1800);setInterval(repair,5000);
})();