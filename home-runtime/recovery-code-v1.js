/* HOME Recovery Code v1 — self-contained backup/restore for HOME state. */
(function(){
  'use strict';
  if(window.__HOME_RECOVERY_CODE_V1__)return;window.__HOME_RECOVERY_CODE_V1__=true;

  const VERSION=1;
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
  async function digest(bytes){
    const h=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    return [...h.slice(0,8)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function gzip(bytes){
    if(typeof CompressionStream==='undefined')return null;
    const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function gunzip(bytes){
    if(typeof DecompressionStream==='undefined')throw new Error('This HOME version cannot decompress this backup yet.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function collect(){
    const storage={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k))continue;
      const v=localStorage.getItem(k);if(v!==null)storage[k]=v;
    }
    return {app:'HOME',version:VERSION,createdAt:Date.now(),storage};
  }

  async function exportCode(){
    const raw=enc.encode(JSON.stringify(collect()));
    const zipped=await gzip(raw);
    const mode=zipped?'G':'J',payload=zipped||raw,hash=await digest(payload);
    return `HOME1${mode}.${hash}.${bytesToB64u(payload)}`;
  }

  async function importCode(code){
    const clean=String(code||'').trim().replace(/\s+/g,'');
    const m=/^HOME1([GJ])\.([0-9a-f]{16})\.([A-Za-z0-9_-]+)$/i.exec(clean);
    if(!m)throw new Error('Not a valid HOME Recovery Code.');
    const mode=m[1].toUpperCase(),expected=m[2].toLowerCase(),payload=b64uToBytes(m[3]);
    const actual=await digest(payload);if(actual!==expected)throw new Error('Recovery Code is damaged or incomplete.');
    const raw=mode==='G'?await gunzip(payload):payload;
    const pack=JSON.parse(dec.decode(raw));
    if(pack?.app!=='HOME'||Number(pack?.version)!==1||!pack.storage||typeof pack.storage!=='object')throw new Error('Unsupported HOME backup.');

    Object.entries(pack.storage).forEach(([k,v])=>{
      if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k)||typeof v!=='string')return;
      try{localStorage.setItem(k,v)}catch(e){}
      if(NATIVE_KEYS.has(k))try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,v)}catch(e){}
    });
    localStorage.setItem('homeRecoveryLastRestoreV1',JSON.stringify({restoredAt:Date.now(),backupCreatedAt:Number(pack.createdAt||0)}));
    return {createdAt:Number(pack.createdAt||0),keys:Object.keys(pack.storage).length};
  }

  async function copyText(text,el){
    try{await navigator.clipboard.writeText(text);return true}catch(e){}
    try{if(el){el.focus();el.select();el.setSelectionRange(0,el.value.length)}return document.execCommand('copy')}catch(e){return false}
  }

  function style(){
    if(document.getElementById('homeRecoveryStyle'))return;
    const s=document.createElement('style');s.id='homeRecoveryStyle';s.textContent=`
      #homeRecoveryBox{margin:22px 0 4px;padding-top:18px;border-top:1px solid rgba(255,255,255,.10)}
      .hrKicker{font-size:10px;font-weight:900;letter-spacing:.14em;color:#f1d46a;margin-bottom:5px}.hrTitle{font-size:17px;font-weight:850;margin-bottom:6px}.hrText{font-size:12px;line-height:1.45;color:rgba(255,255,255,.58);margin-bottom:12px}
      .hrBtn{width:100%;border:0;border-radius:14px;padding:12px 13px;font-weight:850;background:#f1d46a;color:#17150d;margin-top:8px}.hrBtn.secondary{background:#24262d;color:#fff;border:1px solid rgba(255,255,255,.10)}
      .hrArea{width:100%;min-height:92px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#17191e;color:#f5f7fb;padding:11px 12px;font-size:11px;line-height:1.35;resize:vertical;outline:none;margin-top:8px}.hrArea:focus{border-color:rgba(241,212,106,.55)}
      .hrStatus{min-height:17px;margin-top:8px;font-size:11px;color:rgba(255,255,255,.62)}
    `;document.head.appendChild(s);
  }

  function ensureUi(){
    style();
    const panel=document.getElementById('homeFlexPanel');if(!panel||document.getElementById('homeRecoveryBox'))return;
    const box=document.createElement('div');box.id='homeRecoveryBox';box.innerHTML=`
      <div class="hrKicker">BACKUP & RESTORE</div><div class="hrTitle">HOME Recovery Code</div>
      <div class="hrText">Saves your HOME state without passwords or connection tokens. Keep the code somewhere safe.</div>
      <button class="hrBtn" id="hrCreate" type="button">Create current recovery code</button>
      <textarea class="hrArea" id="hrExport" readonly placeholder="Your recovery code will appear here"></textarea>
      <button class="hrBtn secondary" id="hrCopy" type="button">Copy code</button>
      <textarea class="hrArea" id="hrImport" placeholder="Paste a HOME Recovery Code here"></textarea>
      <button class="hrBtn secondary" id="hrRestore" type="button">Restore this backup</button>
      <div class="hrStatus" id="hrStatus"></div>`;
    panel.appendChild(box);
    const status=box.querySelector('#hrStatus'),out=box.querySelector('#hrExport'),input=box.querySelector('#hrImport');
    box.querySelector('#hrCreate').onclick=async()=>{status.textContent='Creating backup…';try{out.value=await exportCode();status.textContent='Recovery Code created from your current HOME state.'}catch(e){status.textContent='Could not create backup: '+(e?.message||e)}};
    box.querySelector('#hrCopy').onclick=async()=>{if(!out.value){status.textContent='Create a recovery code first.';return}status.textContent=(await copyText(out.value,out))?'Recovery Code copied.':'Select the code and copy it manually.'};
    box.querySelector('#hrRestore').onclick=async()=>{status.textContent='Checking backup…';try{const r=await importCode(input.value);const d=r.createdAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(r.createdAt)):'saved backup';status.textContent=`Restored ${r.keys} HOME state items from ${d}. Reloading…`;setTimeout(()=>location.reload(),900)}catch(e){status.textContent=e?.message||String(e)}};
  }

  const obs=new MutationObserver(ensureUi);obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(ensureUi,300);setTimeout(ensureUi,1200);setInterval(ensureUi,4000);
  window.HOMERecovery={version:VERSION,exportCode,importCode,collect,ensureUi};
})();
