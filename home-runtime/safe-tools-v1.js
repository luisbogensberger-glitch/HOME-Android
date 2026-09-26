/* HOME Safe Tools v1 — isolated Brain + Recovery. No persistent overlays, no HOME rerendering. */
(function(){
  'use strict';
  if(window.__HOME_SAFE_TOOLS_V1__){try{window.HOMESafeTools?.repair?.()}catch(e){}return}
  window.__HOME_SAFE_TOOLS_V1__=true;

  const VERSION=1;
  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const CODE_CACHE=new Set(['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3']);
  const NATIVE_KEYS=['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1'];
  const enc=new TextEncoder(),dec=new TextDecoder();
  let lastRepair=0;

  function safeJson(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}}
  function dayKey(t){const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function daypart(t){const h=new Date(t||Date.now()).getHours();return h<5?'night':h<11?'morning':h<15?'midday':h<21?'evening':'night'}
  function bytesToB64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function b64uToBytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
  function checksum(bytes){let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<bytes.length;i++){a=Math.imul((a^bytes[i])>>>0,0x01000193)>>>0;b=Math.imul((b+bytes[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function ensureStyle(){
    if(document.getElementById('homeSafeToolsStyle'))return;
    const s=document.createElement('style');s.id='homeSafeToolsStyle';s.textContent=`
      #homeMomentumXp[data-home-safe-brain="1"]{cursor:pointer;pointer-events:auto;touch-action:manipulation;outline:none}
      #homeMomentumXp[data-home-safe-brain="1"]:focus-visible{box-shadow:0 0 0 2px rgba(241,212,106,.55)}
      #homeSafeBackupBtn{appearance:none;border:0;background:transparent;color:rgba(255,255,255,.52);font:800 10px/1.1 system-ui,-apple-system,sans-serif;padding:5px 0 0;letter-spacing:.02em;cursor:pointer;touch-action:manipulation}
      #homeSafeBackupBtn:active{opacity:.65}
      .homeSafeModal{position:fixed;inset:0;z-index:2147483000;display:none;pointer-events:none;background:rgba(4,5,8,.72);align-items:flex-end;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .homeSafeModal.show{display:flex;pointer-events:auto}
      .homeSafeSheet{width:100%;max-width:720px;max-height:88vh;overflow:auto;box-sizing:border-box;border-radius:27px 27px 0 0;background:#121318;color:#fff;padding:20px 18px max(28px,env(safe-area-inset-bottom));box-shadow:0 -18px 60px rgba(0,0,0,.38)}
      .homeSafeHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}.homeSafeClose{border:0;background:#25272d;color:#fff;width:38px;height:38px;border-radius:20px;font-size:23px;line-height:1;cursor:pointer}
      .homeSafeKicker{font-size:10px;font-weight:900;letter-spacing:.14em;color:#f1d46a;margin-bottom:5px}.homeSafeTitle{font-size:22px;font-weight:880;letter-spacing:-.03em}.homeSafeSub{font-size:12px;line-height:1.5;color:rgba(255,255,255,.58);margin-top:6px}
      .homeBrainScore{display:flex;align-items:flex-end;gap:8px;margin:18px 0 14px}.homeBrainScore strong{font-size:42px;line-height:1;letter-spacing:-.06em}.homeBrainScore span{font-size:11px;color:rgba(255,255,255,.5);padding-bottom:5px}
      .homeBrainGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.homeBrainMetric{background:#1b1d23;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px 10px}.homeBrainMetric b{display:block;font-size:18px}.homeBrainMetric span{display:block;font-size:10px;color:rgba(255,255,255,.48);margin-top:3px}
      .homeBrainCard{background:#181a20;border:1px solid rgba(255,255,255,.08);border-radius:17px;padding:13px;margin-top:9px}.homeBrainCard small{display:block;color:#f1d46a;font-size:9px;font-weight:900;letter-spacing:.12em;margin-bottom:5px}.homeBrainCard b{display:block;font-size:14px;margin-bottom:4px}.homeBrainCard p{margin:0;color:rgba(255,255,255,.6);font-size:11px;line-height:1.45}
      .homeSafeBtn{width:100%;box-sizing:border-box;border:0;border-radius:14px;padding:12px 13px;font-weight:850;background:#f1d46a;color:#17150d;margin-top:9px;cursor:pointer}.homeSafeBtn.secondary{background:#24262d;color:#fff;border:1px solid rgba(255,255,255,.10)}
      .homeSafeArea{width:100%;min-height:96px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#17191e;color:#f5f7fb;padding:11px 12px;font-size:11px;line-height:1.35;resize:vertical;outline:none;margin-top:9px}.homeSafeStatus{min-height:18px;margin-top:9px;font-size:11px;color:rgba(255,255,255,.62)}.homeSafeDivider{height:1px;background:rgba(255,255,255,.09);margin:18px 0 11px}
    `;document.head.appendChild(s);
  }

  function closeModal(id){document.getElementById(id)?.classList.remove('show')}
  function makeModal(id,title,kicker){
    let modal=document.getElementById(id);if(modal)return modal;
    modal=document.createElement('div');modal.id=id;modal.className='homeSafeModal';
    modal.innerHTML=`<div class="homeSafeSheet"><div class="homeSafeHead"><div><div class="homeSafeKicker">${esc(kicker)}</div><div class="homeSafeTitle">${esc(title)}</div></div><button class="homeSafeClose" type="button" aria-label="Close">×</button></div><div class="homeSafeBody"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.homeSafeClose').onclick=()=>closeModal(id);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal(id)});
    return modal;
  }

  function brainModel(){
    const rows=safeJson(ACTIVITY_KEY,[]);const list=Array.isArray(rows)?rows:[];const since7=Date.now()-7*86400000;const recent=list.filter(x=>Number(x?.at||0)>=since7);const today=dayKey();
    const done=recent.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type));
    const todos=done.filter(x=>x.type==='todo_complete').length,tube=done.filter(x=>x.type==='tube_complete').length,gym=done.filter(x=>x.type==='gym_complete').length;
    let todayXp=0;done.filter(x=>dayKey(x.at)===today).forEach(r=>{todayXp+=r.type==='todo_complete'?12:r.type==='tube_complete'?(15+(Number(r.data?.score)>=80?5:0)):25});
    const parts={morning:0,midday:0,evening:0,night:0};done.forEach(r=>{parts[daypart(r.at)]++});const best=Object.entries(parts).sort((a,b)=>b[1]-a[1])[0];
    const activeDays=new Set(done.map(r=>dayKey(r.at))).size;
    let streak=0;for(let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-i);if(done.some(r=>dayKey(r.at)===dayKey(d))||list.some(r=>dayKey(r.at)===dayKey(d)&&['todo_complete','tube_complete','gym_complete'].includes(r.type)))streak++;else if(i>0)break}
    const decision=safeJson('homeBehaviourDecisionV3',{});
    const observed=list.length;
    const confidence=observed<20?'Early model':observed<80?'Learning':observed<200?'Established':'High-signal';
    return{todayXp,todos,tube,gym,activeDays,streak,bestPart:best&&best[1]?best[0]:'not enough data',confidence,observed,todoDensity:decision?.todoDensity||'normal',tubeMode:decision?.tubeMode||'keep'};
  }

  function renderBrain(){
    const m=brainModel(),modal=makeModal('homeSafeBrainModal','Your living model','HOME BRAIN'),body=modal.querySelector('.homeSafeBody');
    body.innerHTML=`
      <div class="homeSafeSub">A live view of the patterns HOME has learned from your activity. It changes as you use the app.</div>
      <div class="homeBrainScore"><strong>${m.todayXp}</strong><span>XP today · ${esc(m.confidence)}</span></div>
      <div class="homeBrainGrid"><div class="homeBrainMetric"><b>${m.todos}</b><span>tasks · 7d</span></div><div class="homeBrainMetric"><b>${m.tube}</b><span>learned · 7d</span></div><div class="homeBrainMetric"><b>${m.gym}</b><span>workouts · 7d</span></div></div>
      <div class="homeBrainCard"><small>RHYTHM</small><b>${m.activeDays} active days · ${m.streak} day current run</b><p>Your strongest completion window is currently ${esc(m.bestPart)}.</p></div>
      <div class="homeBrainCard"><small>ADAPTIVE UI</small><b>Tasks: ${esc(m.todoDensity)} · Tube: ${esc(m.tubeMode)}</b><p>HOME uses your completion and interaction history to adjust density and learning presentation.</p></div>
      <div class="homeBrainCard"><small>MODEL DEPTH</small><b>${m.observed} activity signals observed</b><p>No passwords or message contents are shown here. The model is built from HOME interaction and completion signals.</p></div>`;
    return modal;
  }
  function openBrain(){ensureStyle();renderBrain().classList.add('show')}

  function collectBackup(){
    const storage={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k))continue;const v=localStorage.getItem(k);if(v!==null)storage[k]=v}}catch(e){}
    NATIVE_KEYS.forEach(k=>{try{if(typeof Native!=='undefined'&&Native.loadState){const v=Native.loadState(k);if(typeof v==='string'&&v.length)storage[k]=v}}catch(e){}});
    return{app:'HOME',version:1,createdAt:Date.now(),storage};
  }
  function exportCode(){const bytes=enc.encode(JSON.stringify(collectBackup()));return `HOME-SAFE1.${checksum(bytes)}.${bytesToB64u(bytes)}`}
  function importCode(code){const clean=String(code||'').trim().replace(/\s+/g,'');const m=/^HOME-SAFE1\.([0-9a-f]{16})\.([A-Za-z0-9_-]+)$/i.exec(clean);if(!m)throw new Error('Not a valid HOME backup code.');const bytes=b64uToBytes(m[2]);if(checksum(bytes)!==m[1].toLowerCase())throw new Error('Backup code is damaged or incomplete.');const pack=JSON.parse(dec.decode(bytes));if(pack?.app!=='HOME'||!pack.storage||typeof pack.storage!=='object')throw new Error('Unsupported HOME backup.');let n=0;Object.entries(pack.storage).forEach(([k,v])=>{if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k)||typeof v!=='string')return;try{localStorage.setItem(k,v);n++}catch(e){}if(NATIVE_KEYS.includes(k))try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}});return{count:n,createdAt:Number(pack.createdAt||0)}}
  async function copy(text,el){try{await navigator.clipboard.writeText(text);return true}catch(e){}try{el.focus();el.select();el.setSelectionRange(0,el.value.length);return document.execCommand('copy')}catch(e){return false}}

  function ensureBackupModal(){
    const modal=makeModal('homeSafeBackupModal','Backup & Restore','HOME RECOVERY'),body=modal.querySelector('.homeSafeBody');if(body.dataset.ready==='1')return modal;body.dataset.ready='1';
    body.innerHTML=`<div class="homeSafeSub">Create a copy of your current HOME state before replacing or reinstalling the app. Passwords, tokens and credentials are excluded.</div><button class="homeSafeBtn" id="homeSafeCreate" type="button">Create current backup code</button><textarea class="homeSafeArea" id="homeSafeOut" readonly placeholder="Your backup code will appear here"></textarea><button class="homeSafeBtn secondary" id="homeSafeCopy" type="button">Copy code</button><div class="homeSafeDivider"></div><textarea class="homeSafeArea" id="homeSafeIn" placeholder="Paste a HOME backup code here"></textarea><button class="homeSafeBtn secondary" id="homeSafeRestore" type="button">Restore this backup</button><div class="homeSafeStatus" id="homeSafeStatus"></div>`;
    const out=body.querySelector('#homeSafeOut'),input=body.querySelector('#homeSafeIn'),status=body.querySelector('#homeSafeStatus');
    body.querySelector('#homeSafeCreate').onclick=()=>{try{out.value=exportCode();status.textContent=`Backup created · ${Object.keys(collectBackup().storage).length} state items`}catch(e){status.textContent='Could not create backup: '+(e?.message||e)}};
    body.querySelector('#homeSafeCopy').onclick=async()=>{if(!out.value){status.textContent='Create a backup code first.';return}status.textContent=(await copy(out.value,out))?'Backup code copied.':'Select and copy the code manually.'};
    body.querySelector('#homeSafeRestore').onclick=()=>{try{const r=importCode(input.value);status.textContent=`Restored ${r.count} state items. Reloading…`;setTimeout(()=>location.reload(),700)}catch(e){status.textContent=e?.message||String(e)}};
    return modal;
  }
  function openBackup(){ensureStyle();ensureBackupModal().classList.add('show')}

  function repair(){
    const now=Date.now();if(now-lastRepair<250)return;lastRepair=now;ensureStyle();
    const xp=document.getElementById('homeMomentumXp');if(xp){xp.dataset.homeSafeBrain='1';xp.setAttribute('role','button');xp.setAttribute('tabindex','0');xp.setAttribute('aria-label','Open HOME Brain')}
    const right=document.querySelector('#homeMomentum .homeMomentumRight');if(right&&!document.getElementById('homeSafeBackupBtn')){const b=document.createElement('button');b.id='homeSafeBackupBtn';b.type='button';b.textContent='Backup';b.setAttribute('aria-label','Open HOME Backup and Restore');b.onclick=e=>{e.stopPropagation();openBackup()};right.appendChild(b)}
  }

  document.addEventListener('click',e=>{const x=e.target?.closest?.('#homeMomentumXp[data-home-safe-brain="1"]');if(!x)return;e.preventDefault();e.stopPropagation();openBrain()},true);
  document.addEventListener('keydown',e=>{const x=e.target?.closest?.('#homeMomentumXp[data-home-safe-brain="1"]');if(!x||!['Enter',' '].includes(e.key))return;e.preventDefault();openBrain()},true);
  repair();setTimeout(repair,350);setTimeout(repair,1100);setInterval(repair,2500);
  window.HOMESafeTools={version:VERSION,repair,openBrain,openBackup,exportCode,importCode,collectBackup};
})();