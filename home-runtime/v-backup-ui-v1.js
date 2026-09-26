/* V Backup UI v1 — permanent, visible backup surface independent of the Brain. */
(function(){
  'use strict';
  if(window.__V_BACKUP_UI_V1__){try{window.VBackupUI?.repair?.()}catch(e){}return}
  window.__V_BACKUP_UI_V1__=true;

  function style(){
    if(document.getElementById('vBackupStyle'))return;
    const s=document.createElement('style');s.id='vBackupStyle';s.textContent=`
      #vBackupCard{margin:14px 0 4px;padding:16px;border-radius:23px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(145deg,rgba(24,28,36,.96),rgba(13,16,22,.96));box-shadow:0 14px 34px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.04);color:#fff}
      #vBackupCard .vbTop{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:11px}
      #vBackupCard .vbKicker{font-size:10px;font-weight:850;letter-spacing:.17em;text-transform:uppercase;color:#8fb5ff;margin-bottom:5px}
      #vBackupCard h3{font-size:20px;line-height:1.08;margin:0;font-weight:720;letter-spacing:-.025em}
      #vBackupCard .vbBadge{flex:0 0 auto;font-size:10px;font-weight:800;color:#a8c4ff;border:1px solid rgba(109,154,255,.24);background:rgba(77,141,255,.08);padding:6px 8px;border-radius:999px}
      #vBackupCard p{font-size:12px;line-height:1.45;color:rgba(255,255,255,.58);margin:0 0 12px}
      #vBackupCard .vbActions{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:8px}
      #vBackupCard button{min-height:43px;border-radius:14px;font-size:12px;font-weight:820;border:1px solid rgba(255,255,255,.10);touch-action:manipulation}
      #vBackupCreate{background:#f3f5fa;color:#11141a;border-color:transparent!important}
      #vBackupManage{background:#20242c;color:#e8ecf4}
      #vBackupCard .vbCodeWrap{display:none;margin-top:11px}.vbCodeWrap.show{display:block!important}
      #vBackupCode{width:100%;box-sizing:border-box;min-height:76px;max-height:140px;resize:vertical;border:1px solid rgba(255,255,255,.11);border-radius:13px;background:#11141a;color:#eaf0fb;padding:10px;font-size:10px;line-height:1.35;outline:none}
      #vBackupCopy{width:100%;margin-top:7px;background:#20242c;color:#fff}
      #vBackupStatus{min-height:15px;margin-top:8px;font-size:10px;color:rgba(255,255,255,.52)}
    `;document.head.appendChild(s);
  }

  async function copy(text,el){
    try{await navigator.clipboard.writeText(text);return true}catch(e){}
    try{el.focus();el.select();el.setSelectionRange(0,el.value.length);return document.execCommand('copy')}catch(e){return false}
  }

  function ensureCard(){
    style();
    const inner=document.querySelector('#homeScreen .homeInner');if(!inner)return;
    let card=document.getElementById('vBackupCard');
    if(card){if(card.parentElement!==inner)inner.appendChild(card);return}
    card=document.createElement('section');card.id='vBackupCard';card.setAttribute('aria-label','Backup and restore');
    card.innerHTML=`
      <div class="vbTop"><div><div class="vbKicker">Data safety</div><h3>Backup &amp; Restore</h3></div><span class="vbBadge">Portable</span></div>
      <p>Create a recovery code before replacing or reinstalling V. Passwords, tokens and connection secrets are excluded.</p>
      <div class="vbActions"><button id="vBackupCreate" type="button">Create backup code</button><button id="vBackupManage" type="button">Restore</button></div>
      <div class="vbCodeWrap" id="vBackupCodeWrap"><textarea id="vBackupCode" readonly placeholder="Your backup code appears here"></textarea><button id="vBackupCopy" type="button">Copy backup code</button></div>
      <div id="vBackupStatus"></div>`;
    inner.appendChild(card);
    const wrap=card.querySelector('#vBackupCodeWrap'),out=card.querySelector('#vBackupCode'),status=card.querySelector('#vBackupStatus');
    card.querySelector('#vBackupCreate').onclick=async()=>{
      status.textContent='Creating backup…';
      try{
        if(!window.HOMERecovery?.exportCode)throw new Error('Backup engine is not ready yet.');
        out.value=await window.HOMERecovery.exportCode();wrap.classList.add('show');status.textContent='Backup created from the current V state.';
      }catch(e){status.textContent=e?.message||'Could not create backup.'}
    };
    card.querySelector('#vBackupManage').onclick=()=>{try{window.HOMERecovery?.open?.()}catch(e){status.textContent='Restore panel is not ready yet.'}};
    card.querySelector('#vBackupCopy').onclick=async()=>{if(!out.value){status.textContent='Create a backup first.';return}status.textContent=(await copy(out.value,out))?'Backup code copied.':'Code selected — copy it manually.'};
  }

  function ensureBrainButtons(){
    const card=[...document.querySelectorAll('#homeBehaviourOverlayV4 .lb6Card')].find(x=>/State safety/i.test(x.querySelector('h3')?.textContent||''));
    if(!card||card.querySelector('#vBrainOpenBackup'))return;
    const b=document.createElement('button');b.id='vBrainOpenBackup';b.className='lb6BackupBtn';b.type='button';b.textContent='Open Backup & Restore';b.onclick=()=>window.HOMERecovery?.open?.();card.appendChild(b);
  }

  function repair(){ensureCard();ensureBrainButtons();}
  const obs=new MutationObserver(()=>repair());obs.observe(document.documentElement,{childList:true,subtree:true});
  repair();setTimeout(repair,250);setTimeout(repair,900);setInterval(repair,4000);
  window.VBackupUI={repair};
})();
