/* V-Brain Stability v1 — hard startup safety, direct restore, guaranteed tappable home. */
(function(){
  'use strict';
  if(window.__VBRAIN_STABILITY_V1__)return;window.__VBRAIN_STABILITY_V1__=true;
  const NATIVE_KEYS=new Set(['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1','livingBrainGraphV6']);
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const dec=new TextDecoder();
  const bytes=s=>{s=String(s||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o};
  const checksum=raw=>{let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<raw.length;i++){a=Math.imul((a^raw[i])>>>0,0x01000193)>>>0;b=Math.imul((b+raw[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')};

  function restoreCode(code){
    const p=String(code||'').trim().split('.');
    if(p.length!==3||p[0]!=='HOME2J')throw new Error('Paste the complete HOME2J backup code.');
    const raw=bytes(p[2]);if(checksum(raw)!==p[1])throw new Error('Backup checksum does not match.');
    const payload=JSON.parse(dec.decode(raw));if(!payload?.storage||typeof payload.storage!=='object')throw new Error('Backup payload is invalid.');
    let restored=0;
    Object.entries(payload.storage).forEach(([k,v])=>{if(!k||SECRET_RE.test(k)||typeof v!=='string')return;try{localStorage.setItem(k,v);restored++;if(NATIVE_KEYS.has(k)&&typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}});
    localStorage.setItem('vbrainRestoreCompletedV1',JSON.stringify({at:Date.now(),restored,createdAt:payload.createdAt||null}));
    return restored;
  }

  function initialReset(){
    try{document.body.style.overflow=''}catch(e){}
    ['homeBehaviourOverlayV4','vbrainDataModal','homeFlexSheet','vbrainLegacyBackup','homeSafeBrainModal','homeSafeBackupModal'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.classList.remove('show');el.style.removeProperty('pointer-events');el.style.removeProperty('display')});
    const home=document.getElementById('homeScreen');if(home){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));home.classList.add('show');home.style.pointerEvents='auto';home.style.position='relative'}
  }

  function hasRestored(){try{return !!localStorage.getItem('vbrainRestoreCompletedV1')}catch(e){return false}}
  function ensureRestorePanel(){
    const home=document.getElementById('homeScreen'),inner=home?.querySelector('.homeInner');if(!inner)return;
    let panel=document.getElementById('vbrainDirectRestore');
    if(!panel){
      panel=document.createElement('section');panel.id='vbrainDirectRestore';
      panel.innerHTML=`<div class="vbrEyebrow">DATA RECOVERY</div><h2>Restore your previous V-Brain</h2><p>Paste the full <b>HOME2J…</b> code from the old app. This restores tasks, Tube progress, gym state and saved brain data.</p><textarea id="vbrainDirectRestoreInput" spellcheck="false" autocomplete="off" placeholder="Paste HOME2J backup code here"></textarea><button id="vbrainDirectRestoreButton" type="button">RESTORE DATA</button><div id="vbrainDirectRestoreStatus"></div>`;
      inner.insertBefore(panel,inner.firstChild);
      const style=document.createElement('style');style.id='vbrainStabilityStyle';style.textContent=`
        #vbrainDirectRestore{position:relative!important;z-index:3000!important;margin:0 0 14px;padding:18px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:linear-gradient(145deg,rgba(24,27,34,.98),rgba(13,15,20,.98));box-shadow:0 18px 48px rgba(0,0,0,.34);pointer-events:auto!important}
        #vbrainDirectRestore.restored{display:none!important}#vbrainDirectRestore .vbrEyebrow{font-size:10px;font-weight:850;letter-spacing:.16em;color:#aab6d0;margin-bottom:7px}#vbrainDirectRestore h2{font-size:21px;line-height:1.1;margin:0 0 7px;color:#fff}#vbrainDirectRestore p{font-size:12px;line-height:1.45;margin:0 0 12px;color:rgba(255,255,255,.64)}
        #vbrainDirectRestore textarea{display:block!important;width:100%!important;min-height:118px!important;resize:vertical!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:15px!important;background:#0d1015!important;color:#fff!important;padding:12px!important;font-size:11px!important;line-height:1.4!important;outline:none!important;pointer-events:auto!important;touch-action:auto!important;-webkit-user-select:text!important;user-select:text!important}
        #vbrainDirectRestore textarea:focus{border-color:#7ea8ff!important;box-shadow:0 0 0 3px rgba(126,168,255,.12)!important}#vbrainDirectRestore button{display:block!important;width:100%!important;margin-top:10px!important;padding:13px!important;border:0!important;border-radius:15px!important;background:#f4f5f8!important;color:#111318!important;font-weight:900!important;letter-spacing:.04em!important;pointer-events:auto!important;touch-action:manipulation!important}#vbrainDirectRestoreStatus{min-height:18px;margin-top:8px;font-size:11px;color:rgba(255,255,255,.62)}
        #homeScreen .homeGrid,#homeScreen .homeCard{position:relative!important;z-index:10!important;pointer-events:auto!important;touch-action:manipulation!important}#homeScreen .homeCard *{pointer-events:none!important}
        #homeScreen .homeCard.gym{background-image:linear-gradient(100deg,rgba(50,30,20,.86),rgba(58,38,28,.54)),url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=82')!important;background-size:cover!important;background-position:center!important;border-color:rgba(211,148,106,.30)!important;opacity:1!important;transform:none!important}
        .homeGymRow{display:flex;align-items:center;gap:17px;position:relative;z-index:2}.homeGymIcon{width:72px;height:72px;flex:0 0 72px;border-radius:22px;display:grid;place-items:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);font-size:34px;color:#fff}
      `;document.head.appendChild(style);
    }
    panel.classList.toggle('restored',hasRestored());
    const input=panel.querySelector('#vbrainDirectRestoreInput'),btn=panel.querySelector('#vbrainDirectRestoreButton'),status=panel.querySelector('#vbrainDirectRestoreStatus');
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();try{const n=restoreCode(input.value);status.textContent=`Restored ${n} state entries. Reloading…`;setTimeout(()=>location.reload(),700)}catch(err){status.textContent=err?.message||'Restore failed.'}};
    return panel;
  }

  function ensureGymCard(){
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return null;
    let card=document.querySelector('#homeScreen .homeCard.gym');
    if(!card){card=document.createElement('button');card.id='homeGymCard';card.className='homeCard gym';card.type='button';card.innerHTML='<div class="homeCardHead"><span class="homeCardLabel">Gym</span><span><span class="homeCardMetric" id="homeGymMetric">Ready</span><span class="homeCardChevron">›</span></span></div><div class="homeGymRow"><div class="homeGymIcon" aria-hidden="true">↑</div><div class="homeSummary"><h2>Train</h2><p id="homeGymText">Strength · 45 min</p></div></div>';grid.appendChild(card)}
    return card;
  }

  function ensureHomeActions(){
    document.querySelectorAll('#homeScreen button,#homeScreen input,#homeScreen textarea,#homeScreen .homeCard').forEach(el=>{el.style.pointerEvents='auto'});
    const route=(selector,name)=>{const el=document.querySelector(selector);if(!el)return;el.onclick=e=>{e.preventDefault();e.stopPropagation();try{window.showScreen(name)}catch(err){}}};
    route('#homeScreen .homeCard.calendar','calendar');route('#homeScreen .homeCard.todos','todos');route('#homeScreen .homeCard.tube','tube');
    const gym=ensureGymCard();if(gym)gym.onclick=e=>{e.preventDefault();e.stopPropagation();try{if(typeof window.openHomeGym==='function')window.openHomeGym();else window.__homeRemoteV2Refresh?.()}catch(err){}};
    const data=document.getElementById('vbrainDataButton');if(data)data.style.pointerEvents='auto';const day=document.getElementById('homeDayScoreV4');if(day)day.style.pointerEvents='auto';
  }

  function repair(){try{window.__homeRemoteV2Refresh?.()}catch(e){}ensureRestorePanel();ensureGymCard();ensureHomeActions();try{window.updateHome?.()}catch(e){}}
  function boot(){initialReset();repair()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setTimeout(repair,500);setTimeout(repair,1500);
  window.VBrainStability={version:1,restoreCode,repair};
})();
