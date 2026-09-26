/* V-Brain Safe Shell v2 — no overlays, no global interception, guaranteed tappable core. */
(function(){
  'use strict';
  if(window.__VBRAIN_SAFE_SHELL_V2__) return;
  window.__VBRAIN_SAFE_SHELL_V2__=true;

  const NATIVE_KEYS=new Set(['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1','livingBrainGraphV6']);
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const dec=new TextDecoder();

  function b64bytes(s){s=String(s||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
  function checksum(raw){let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<raw.length;i++){a=Math.imul((a^raw[i])>>>0,0x01000193)>>>0;b=Math.imul((b+raw[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}
  function restore(code){
    const p=String(code||'').trim().split('.');
    if(p.length!==3||p[0]!=='HOME2J') throw new Error('Paste the complete HOME2J backup code.');
    const raw=b64bytes(p[2]);
    if(checksum(raw)!==p[1]) throw new Error('Backup checksum does not match.');
    const payload=JSON.parse(dec.decode(raw));
    if(!payload||!payload.storage||typeof payload.storage!=='object') throw new Error('Backup payload is invalid.');
    let restored=0;
    for(const [k,v] of Object.entries(payload.storage)){
      if(!k||SECRET_RE.test(k)||typeof v!=='string') continue;
      try{localStorage.setItem(k,v);restored++;if(NATIVE_KEYS.has(k)&&typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}
    }
    try{localStorage.setItem('vbrainSafeRestoreDoneV2',JSON.stringify({at:Date.now(),restored,createdAt:payload.createdAt||null}))}catch(e){}
    return restored;
  }

  function addCss(){
    if(document.getElementById('vbrainSafeShellCss')) return;
    const s=document.createElement('style');s.id='vbrainSafeShellCss';s.textContent=`
      html,body{pointer-events:auto!important}
      #homeScreen{pointer-events:auto!important;overflow:visible!important}
      #homeScreen .homeInner,#homeScreen .homeGrid,#homeScreen .homeCard{pointer-events:auto!important}
      #homeScreen .homeCard{touch-action:manipulation!important;cursor:pointer!important;opacity:1!important}
      #homeScreen .homeCard *{pointer-events:none!important}
      #vbrainSafeRestore{position:relative;z-index:6;margin:0 0 14px;padding:17px;border-radius:22px;border:1px solid rgba(255,255,255,.13);background:#11151b;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.22)}
      #vbrainSafeRestore h2{font-size:20px;margin:0 0 5px}#vbrainSafeRestore p{font-size:12px;line-height:1.45;color:rgba(255,255,255,.64);margin:0 0 11px}
      #vbrainSafeRestore textarea{display:block;width:100%;min-height:112px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#090c10;color:#fff;padding:11px;font-size:11px;line-height:1.4;resize:vertical;pointer-events:auto!important;touch-action:auto!important;-webkit-user-select:text!important;user-select:text!important}
      #vbrainSafeRestore button{display:block;width:100%;margin-top:9px;border:0;border-radius:14px;background:#fff;color:#111318;padding:13px;font-weight:900;pointer-events:auto!important;touch-action:manipulation!important}
      #vbrainSafeRestoreStatus{min-height:17px;margin-top:7px;font-size:11px;color:rgba(255,255,255,.62)}
      #homeScreen .homeCard.gym{background:linear-gradient(135deg,#4a3427,#34251e)!important;border-color:#6c4b39!important}
      .homeGymRow{display:flex;align-items:center;gap:17px;position:relative;z-index:2}.homeGymIcon{width:68px;height:68px;flex:0 0 68px;border-radius:20px;display:grid;place-items:center;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1);font-size:31px}
    `;document.head.appendChild(s);
  }

  function removeBlockers(){
    document.body.style.overflow='';
    ['homeBehaviourOverlayV4','vbrainDataModal','homeFlexSheet','vbrainLegacyBackup','homeSafeBrainModal','homeSafeBackupModal'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove()});
  }

  function ensureRestore(){
    const home=document.getElementById('homeScreen'),inner=home&&home.querySelector('.homeInner');if(!inner)return;
    let p=document.getElementById('vbrainSafeRestore');
    if(!p){p=document.createElement('section');p.id='vbrainSafeRestore';p.innerHTML='<h2>Restore your previous data</h2><p>Paste the complete HOME2J backup code from the old app.</p><textarea id="vbrainSafeRestoreInput" placeholder="Paste HOME2J… code here" spellcheck="false"></textarea><button id="vbrainSafeRestoreBtn" type="button">RESTORE DATA</button><div id="vbrainSafeRestoreStatus"></div>';inner.insertBefore(p,inner.firstChild)}
    const input=p.querySelector('#vbrainSafeRestoreInput'),btn=p.querySelector('#vbrainSafeRestoreBtn'),status=p.querySelector('#vbrainSafeRestoreStatus');
    btn.onclick=function(e){e.preventDefault();e.stopPropagation();try{const n=restore(input.value);status.textContent='Restored '+n+' entries. Reloading…';setTimeout(()=>location.reload(),600)}catch(err){status.textContent=err&&err.message?err.message:'Restore failed.'}};
  }

  function ensureGymCard(){
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;
    let card=document.querySelector('#homeScreen .homeCard.gym');
    if(!card){card=document.createElement('button');card.type='button';card.id='homeGymCard';card.className='homeCard gym';card.innerHTML='<div class="homeCardHead"><span class="homeCardLabel">Gym</span><span><span class="homeCardMetric" id="homeGymMetric">Ready</span><span class="homeCardChevron">›</span></span></div><div class="homeGymRow"><div class="homeGymIcon">↑</div><div class="homeSummary"><h2>Train</h2><p id="homeGymText">Strength · 45 min</p></div></div>';grid.appendChild(card)}
  }

  function bind(){
    const route=(sel,name)=>{const el=document.querySelector(sel);if(!el)return;el.onclick=function(e){e.preventDefault();e.stopPropagation();if(typeof window.showScreen==='function')window.showScreen(name)}};
    route('#homeScreen .homeCard.calendar','calendar');
    route('#homeScreen .homeCard.todos','todos');
    route('#homeScreen .homeCard.tube','tube');
    const gym=document.querySelector('#homeScreen .homeCard.gym');if(gym)gym.onclick=function(e){e.preventDefault();e.stopPropagation();if(typeof window.openHomeGym==='function')window.openHomeGym();else if(typeof window.__homeRemoteV2Refresh==='function'){window.__homeRemoteV2Refresh();setTimeout(()=>window.openHomeGym&&window.openHomeGym(),50)}};
  }

  function boot(){addCss();removeBlockers();ensureRestore();ensureGymCard();bind();try{window.__homeRemoteV2Refresh&&window.__homeRemoteV2Refresh()}catch(e){}try{window.updateHome&&window.updateHome()}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setTimeout(boot,300);setTimeout(boot,1000);
  window.VBrainSafeShell={restore,repair:boot};
})();
