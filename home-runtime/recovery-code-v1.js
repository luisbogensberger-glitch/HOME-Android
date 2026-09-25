/* HOME Recovery Code v2 — standalone backup/restore that also works in legacy APKs. */
(function(){
  'use strict';
  if(window.__HOME_RECOVERY_CODE_V2__){try{window.HOMERecovery?.ensureUi?.()}catch(e){}return}
  window.__HOME_RECOVERY_CODE_V2__=true;

  const VERSION=2;
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session)/i;
  const CODE_CACHE=new Set(['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3']);
  const NATIVE_KEYS=new Set(['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1']);
  const enc=new TextEncoder(),dec=new TextDecoder();

  function bytesToB64u(bytes){
    let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64uToBytes(s){
    s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';
    const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
  }

  /* Pure-JS checksum: works in file:// Android WebViews without crypto.subtle. */
  function checksum(bytes){
    let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;
    for(let i=0;i<bytes.length;i++){
      a=Math.imul((a^bytes[i])>>>0,0x01000193)>>>0;
      b=Math.imul((b+bytes[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;
      b^=b>>>13;
    }
    return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
  }
  async function gzip(bytes){
    if(typeof CompressionStream==='undefined')return null;
    try{const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer())}catch(e){return null}
  }
  async function gunzip(bytes){
    if(typeof DecompressionStream==='undefined')throw new Error('This HOME version cannot decompress this backup yet.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function collect(){
    const storage={};
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k))continue;
        const v=localStorage.getItem(k);if(v!==null)storage[k]=v;
      }
    }catch(e){}

    /* Critical HOME state is mirrored natively in some APKs. Prefer the native copy when present. */
    NATIVE_KEYS.forEach(k=>{
      try{
        if(typeof Native!=='undefined'&&Native.loadState){
          const v=Native.loadState(k);
          if(typeof v==='string'&&v.length)storage[k]=v;
        }
      }catch(e){}
    });
    return {app:'HOME',version:VERSION,createdAt:Date.now(),storage};
  }

  async function exportCode(){
    const raw=enc.encode(JSON.stringify(collect()));
    const zipped=await gzip(raw);
    const mode=zipped?'G':'J',payload=zipped||raw,hash=checksum(payload);
    return `HOME2${mode}.${hash}.${bytesToB64u(payload)}`;
  }

  async function importCode(code){
    const clean=String(code||'').trim().replace(/\s+/g,'');
    const m=/^HOME2([GJ])\.([0-9a-f]{16})\.([A-Za-z0-9_-]+)$/i.exec(clean);
    if(!m)throw new Error('Not a valid HOME Recovery Code.');
    const mode=m[1].toUpperCase(),expected=m[2].toLowerCase(),payload=b64uToBytes(m[3]);
    const actual=checksum(payload);if(actual!==expected)throw new Error('Recovery Code is damaged or incomplete.');
    const raw=mode==='G'?await gunzip(payload):payload;
    const pack=JSON.parse(dec.decode(raw));
    if(pack?.app!=='HOME'||Number(pack?.version)!==VERSION||!pack.storage||typeof pack.storage!=='object')throw new Error('Unsupported HOME backup.');

    Object.entries(pack.storage).forEach(([k,v])=>{
      if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k)||typeof v!=='string')return;
      try{localStorage.setItem(k,v)}catch(e){}
      if(NATIVE_KEYS.has(k))try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}
    });
    try{localStorage.setItem('homeRecoveryLastRestoreV2',JSON.stringify({restoredAt:Date.now(),backupCreatedAt:Number(pack.createdAt||0)}))}catch(e){}
    return {createdAt:Number(pack.createdAt||0),keys:Object.keys(pack.storage).length};
  }

  async function copyText(text,el){
    try{await navigator.clipboard.writeText(text);return true}catch(e){}
    try{if(el){el.focus();el.select();el.setSelectionRange(0,el.value.length)}return document.execCommand('copy')}catch(e){return false}
  }

  function style(){
    if(document.getElementById('homeRecoveryStyle'))return;
    const s=document.createElement('style');s.id='homeRecoveryStyle';s.textContent=`
      #homeRecoveryLauncher{width:100%;margin:12px 0 2px;border:1px solid rgba(241,212,106,.24);border-radius:17px;background:rgba(241,212,106,.075);color:#f1d46a;padding:12px 14px;font-size:12px;font-weight:850;letter-spacing:.02em;text-align:center;cursor:pointer;touch-action:manipulation}
      #homeRecoveryLauncher:active{transform:scale(.99)}
      #homeRecoveryModal{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.66);display:none;align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      #homeRecoveryModal.show{display:flex}
      #homeRecoveryPanel{width:100%;max-width:720px;max-height:88vh;overflow:auto;border-radius:27px 27px 0 0;background:#121318;color:#fff;padding:20px 18px max(28px,env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.38)}
      .hrHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px}.hrClose{border:0;background:#25272d;color:#fff;width:38px;height:38px;border-radius:19px;font-size:22px;line-height:1}
      .hrKicker{font-size:10px;font-weight:900;letter-spacing:.14em;color:#f1d46a;margin-bottom:5px}.hrTitle{font-size:21px;font-weight:850;margin-bottom:6px}.hrText{font-size:12px;line-height:1.48;color:rgba(255,255,255,.60);margin-bottom:12px}
      .hrBtn{width:100%;border:0;border-radius:14px;padding:12px 13px;font-weight:850;background:#f1d46a;color:#17150d;margin-top:8px}.hrBtn.secondary{background:#24262d;color:#fff;border:1px solid rgba(255,255,255,.10)}
      .hrArea{width:100%;min-height:96px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#17191e;color:#f5f7fb;padding:11px 12px;font-size:11px;line-height:1.35;resize:vertical;outline:none;margin-top:8px}.hrArea:focus{border-color:rgba(241,212,106,.55)}
      .hrStatus{min-height:18px;margin-top:9px;font-size:11px;color:rgba(255,255,255,.64)}
      .hrDivider{height:1px;background:rgba(255,255,255,.09);margin:18px 0 12px}
      #homeRecoveryFlexEntry{margin:18px 0 0;border-top:1px solid rgba(255,255,255,.10);padding-top:16px}
    `;document.head.appendChild(s);
  }

  function ensureModal(){
    let modal=document.getElementById('homeRecoveryModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='homeRecoveryModal';modal.innerHTML=`
      <div id="homeRecoveryPanel">
        <div class="hrHead"><div><div class="hrKicker">BACKUP & RESTORE</div><div class="hrTitle">HOME Recovery Code</div></div><button class="hrClose" type="button" aria-label="Close">×</button></div>
        <div class="hrText">This saves your current HOME state without passwords or connection tokens. Keep the code somewhere safe before replacing or reinstalling HOME.</div>
        <button class="hrBtn" id="hrCreate" type="button">Create current recovery code</button>
        <textarea class="hrArea" id="hrExport" readonly placeholder="Your recovery code will appear here"></textarea>
        <button class="hrBtn secondary" id="hrCopy" type="button">Copy code</button>
        <div class="hrDivider"></div>
        <textarea class="hrArea" id="hrImport" placeholder="Paste a HOME Recovery Code here"></textarea>
        <button class="hrBtn secondary" id="hrRestore" type="button">Restore this backup</button>
        <div class="hrStatus" id="hrStatus"></div>
      </div>`;
    document.body.appendChild(modal);
    const close=()=>modal.classList.remove('show');
    modal.querySelector('.hrClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    const status=modal.querySelector('#hrStatus'),out=modal.querySelector('#hrExport'),input=modal.querySelector('#hrImport');
    modal.querySelector('#hrCreate').onclick=async()=>{status.textContent='Creating backup…';try{out.value=await exportCode();status.textContent='Recovery Code created from your current HOME state.'}catch(e){status.textContent='Could not create backup: '+(e?.message||e)}};
    modal.querySelector('#hrCopy').onclick=async()=>{if(!out.value){status.textContent='Create a recovery code first.';return}status.textContent=(await copyText(out.value,out))?'Recovery Code copied.':'Select the code and copy it manually.'};
    modal.querySelector('#hrRestore').onclick=async()=>{status.textContent='Checking backup…';try{const r=await importCode(input.value);const d=r.createdAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(r.createdAt)):'saved backup';status.textContent=`Restored ${r.keys} HOME state items from ${d}. Reloading…`;setTimeout(()=>location.reload(),900)}catch(e){status.textContent=e?.message||String(e)}};
    return modal;
  }

  function open(){style();ensureModal().classList.add('show')}

  function ensureLegacyLauncher(){
    const home=document.getElementById('homeScreen');if(!home)return;
    let b=document.getElementById('homeRecoveryLauncher');if(b)return;
    b=document.createElement('button');b.id='homeRecoveryLauncher';b.type='button';b.textContent='Backup & Restore';b.setAttribute('aria-label','Open HOME Backup and Restore');b.onclick=open;
    const inner=home.querySelector('.homeInner')||home.querySelector('.pad')||home;
    inner.appendChild(b);
  }

  function ensureFlexEntry(){
    const panel=document.getElementById('homeFlexPanel');if(!panel||document.getElementById('homeRecoveryFlexEntry'))return;
    const wrap=document.createElement('div');wrap.id='homeRecoveryFlexEntry';wrap.innerHTML='<div class="hrKicker">BACKUP & RESTORE</div><div class="hrText">Create or restore a HOME Recovery Code.</div><button class="hrBtn secondary" type="button">Open Backup & Restore</button>';
    wrap.querySelector('button').onclick=open;panel.appendChild(wrap);
  }

  function ensureUi(){style();ensureModal();ensureLegacyLauncher();ensureFlexEntry()}

  const obs=new MutationObserver(ensureUi);obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(ensureUi,120);setTimeout(ensureUi,500);setTimeout(ensureUi,1500);setInterval(ensureUi,3000);
  window.HOMERecovery={version:VERSION,exportCode,importCode,collect,ensureUi,open};
})();
