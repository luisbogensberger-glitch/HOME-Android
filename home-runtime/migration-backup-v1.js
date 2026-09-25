/* HOME local migration backup v1 — user-triggered only, no network upload. */
(function(){
  'use strict';
  if(window.__HOME_MIGRATION_BACKUP_V1__)return;
  window.__HOME_MIGRATION_BACKUP_V1__=true;

  const VERSION=1;
  const PREFIX='HOME_BACKUP_V1:';
  const deny=/token|secret|password|credential|authorization/i;

  function collect(){
    const data={version:VERSION,createdAt:new Date().toISOString(),localStorage:{}};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k||deny.test(k))continue;
      try{data.localStorage[k]=localStorage.getItem(k)}catch(e){}
    }
    return data;
  }

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true}catch(e){}
    try{
      const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
      const ok=document.execCommand('copy');ta.remove();return !!ok;
    }catch(e){return false}
  }

  async function backup(){
    const payload=PREFIX+btoa(unescape(encodeURIComponent(JSON.stringify(collect()))));
    window.HOMEMigrationBackup.last=payload;
    const ok=await copyText(payload);
    alert(ok?'HOME backup copied to clipboard. Keep it until the migration is finished.':'HOME backup prepared. Open HOME migration again and copy the text manually.');
    return payload;
  }

  function restore(payload){
    const raw=String(payload||'').trim();
    if(!raw.startsWith(PREFIX))throw new Error('Not a HOME backup.');
    const json=decodeURIComponent(escape(atob(raw.slice(PREFIX.length))));
    const data=JSON.parse(json);
    if(!data||!data.localStorage||typeof data.localStorage!=='object')throw new Error('Invalid HOME backup.');
    let n=0;
    for(const [k,v] of Object.entries(data.localStorage)){
      if(deny.test(k)||typeof v!=='string')continue;
      localStorage.setItem(k,v);n++;
    }
    alert('HOME restored '+n+' local data entries. The app will reload now.');
    location.reload();
    return n;
  }

  function ensureUi(){
    const home=document.getElementById('homeScreen');if(!home||document.getElementById('homeMigrationTools'))return;
    const box=document.createElement('div');box.id='homeMigrationTools';box.style.cssText='margin:14px 20px 26px;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.03);font:14px system-ui;color:inherit';
    box.innerHTML='<div style="font-weight:700;margin-bottom:8px">HOME migration safety</div><div style="opacity:.7;margin-bottom:10px">Only needed if Android refuses an in-place APK update.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="homeBackupBtn" type="button">Copy backup</button><button id="homeRestoreBtn" type="button">Restore backup</button></div>';
    box.querySelectorAll('button').forEach(b=>b.style.cssText='border:0;border-radius:12px;padding:10px 12px;font-weight:700');
    box.querySelector('#homeBackupBtn').onclick=()=>backup();
    box.querySelector('#homeRestoreBtn').onclick=()=>{const p=prompt('Paste your HOME backup here:');if(!p)return;try{restore(p)}catch(e){alert(e.message||'Restore failed.')}};
    home.appendChild(box);
  }

  window.HOMEMigrationBackup={version:VERSION,collect,backup,restore,last:''};
  ensureUi();setTimeout(ensureUi,800);setTimeout(ensureUi,2500);setInterval(ensureUi,5000);
})();
