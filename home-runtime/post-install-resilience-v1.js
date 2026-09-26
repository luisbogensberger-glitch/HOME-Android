/* Legacy HOME rescue v3 — always-visible backup code on the home screen. */
(function(){
  'use strict';
  if(window.__HOME_LEGACY_BACKUP_CENTER_V3__){try{window.HOMELegacyBackupCenterV3?.repair?.()}catch(e){}return}
  window.__HOME_LEGACY_BACKUP_CENTER_V3__=true;

  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const CODE_CACHE=new Set(['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3']);
  const NATIVE_KEYS=['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1','livingBrainGraphV6'];
  const enc=new TextEncoder();

  function bytesToB64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function checksum(bytes){let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<bytes.length;i++){a=Math.imul((a^bytes[i])>>>0,0x01000193)>>>0;b=Math.imul((b+bytes[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}
  function collect(){
    const storage={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k))continue;const v=localStorage.getItem(k);if(v!==null)storage[k]=v}}catch(e){}
    NATIVE_KEYS.forEach(k=>{try{if(typeof Native!=='undefined'&&Native.loadState){const v=Native.loadState(k);if(typeof v==='string'&&v.length)storage[k]=v}}catch(e){}});
    return{app:'HOME',version:2,createdAt:Date.now(),storage};
  }
  function makeCode(){
    try{if(typeof window.HOMEClassicBrain?.backup==='function')return window.HOMEClassicBrain.backup()}catch(e){}
    const raw=enc.encode(JSON.stringify(collect()));
    return `HOME2J.${checksum(raw)}.${bytesToB64u(raw)}`;
  }
  async function copyText(text,el){
    try{await navigator.clipboard.writeText(text);return true}catch(e){}
    try{el.focus();el.select();el.setSelectionRange(0,el.value.length);return document.execCommand('copy')}catch(e){return false}
  }

  function ensureStyle(){
    if(document.getElementById('legacyBackupCenterStyle'))return;
    const s=document.createElement('style');
    s.id='legacyBackupCenterStyle';
    s.textContent=`
      #legacyBackupCenter{width:calc(100% - 36px)!important;max-width:620px!important;box-sizing:border-box!important;margin:18px auto 24px!important;padding:18px!important;border-radius:24px!important;border:1px solid rgba(255,255,255,.18)!important;background:#11141a!important;color:#fff!important;position:relative!important;z-index:500!important;box-shadow:0 16px 44px rgba(0,0,0,.34)!important;text-align:center!important}
      #legacyBackupCenter .lbcEyebrow{font-size:10px!important;letter-spacing:.18em!important;font-weight:900!important;color:#f1d46a!important;margin-bottom:7px!important}
      #legacyBackupCenter h2{font-size:24px!important;line-height:1.1!important;margin:0 0 7px!important;color:#fff!important}
      #legacyBackupCenter p{font-size:12px!important;line-height:1.45!important;margin:0 0 12px!important;color:rgba(255,255,255,.63)!important}
      #legacyBackupCode{width:100%!important;min-height:145px!important;box-sizing:border-box!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:16px!important;background:#080a0e!important;color:#fff!important;padding:12px!important;font-size:10px!important;line-height:1.35!important;word-break:break-all!important;resize:vertical!important}
      #legacyBackupCopy,#legacyBackupRefresh{width:100%!important;border:0!important;border-radius:15px!important;padding:13px 14px!important;font-weight:900!important;font-size:13px!important;margin-top:9px!important;touch-action:manipulation!important}
      #legacyBackupCopy{background:#f4f5f8!important;color:#0d0f13!important}
      #legacyBackupRefresh{background:#232832!important;color:#fff!important}
      #legacyBackupStatus{min-height:18px!important;margin-top:8px!important;font-size:11px!important;color:rgba(255,255,255,.67)!important}
    `;
    document.head.appendChild(s);
  }

  function repair(){
    ensureStyle();
    const home=document.getElementById('homeScreen');if(!home)return;
    let box=document.getElementById('legacyBackupCenter');
    if(!box){
      box=document.createElement('section');
      box.id='legacyBackupCenter';
      box.innerHTML=`<div class="lbcEyebrow">OLD HOME · DATA RESCUE</div><h2>BACKUP CODE</h2><p>Copy this code before installing or deleting anything. It contains your current HOME state; passwords and tokens are excluded.</p><textarea id="legacyBackupCode" readonly></textarea><button id="legacyBackupCopy" type="button">COPY BACKUP CODE</button><button id="legacyBackupRefresh" type="button">RECREATE CODE</button><div id="legacyBackupStatus">Backup ready.</div>`;
      const inner=home.querySelector('.homeInner')||home.querySelector('.pad')||home;
      const grid=inner.querySelector('.homeGrid');
      if(grid&&grid.parentNode===inner)inner.insertBefore(box,grid);else inner.insertBefore(box,inner.firstChild);
    }
    const out=box.querySelector('#legacyBackupCode'),status=box.querySelector('#legacyBackupStatus');
    if(out&&!out.value){try{out.value=makeCode();status.textContent='Backup ready — copy this code now.'}catch(e){status.textContent='Backup creation failed: '+(e?.message||e)}}
    const copy=box.querySelector('#legacyBackupCopy');if(copy)copy.onclick=async()=>{if(!out.value){try{out.value=makeCode()}catch(e){}}status.textContent=(await copyText(out.value,out))?'BACKUP CODE COPIED.':'Select the code and copy it manually.'};
    const refresh=box.querySelector('#legacyBackupRefresh');if(refresh)refresh.onclick=()=>{try{out.value=makeCode();status.textContent='Backup recreated from the current app state.'}catch(e){status.textContent='Backup creation failed: '+(e?.message||e)}};
  }

  window.HOMELegacyBackupCenterV3={repair,makeCode};
  repair();setTimeout(repair,200);setTimeout(repair,700);setTimeout(repair,1800);setInterval(repair,4000);
})();
