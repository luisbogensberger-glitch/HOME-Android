/* V-Brain Personalizer v21 view hook — mount private context on the active Brain shell. */
(function(){
  'use strict';
  if(window.__VBRAIN_PERSONALIZER_HOOK_V21__)return;window.__VBRAIN_PERSONALIZER_HOOK_V21__=true;
  const refresh=()=>{try{return window.VBrainPersonalizer?.refresh?.()}catch(_){return null}};
  const text=(el,v)=>{if(el)el.textContent=String(v??'')};
  function mountV19(){
    const brain=document.getElementById('vBrainV19'),top=brain?.querySelector('.vb19Top');
    if(!brain||!top||!window.VBrainPersonalizer)return false;
    let btn=document.getElementById('vb21ContextBtn');
    let panel=document.getElementById('vb21ContextPanel');
    if(btn&&btn.closest('#vBrainV8'))btn.remove();
    if(panel&&panel.closest('#vBrainV8'))panel.remove();
    btn=document.getElementById('vb21ContextBtn');panel=document.getElementById('vb21ContextPanel');
    if(!btn){
      btn=document.createElement('button');btn.id='vb21ContextBtn';btn.type='button';
      top.insertBefore(btn,top.querySelector('.vb19Meta')||null);
    }
    if(!panel){
      panel=document.createElement('section');panel.id='vb21ContextPanel';
      panel.innerHTML='<div class="vb21Head"><small>V-BRAIN · PRIVATE CONTEXT</small><button type="button" aria-label="Close">×</button></div><div class="vb21List"></div>';
      brain.appendChild(panel);
      panel.querySelector('button').onclick=()=>panel.classList.remove('show');
      btn.onclick=()=>panel.classList.toggle('show');
    }
    const ctx=window.VBrainPersonalizer.context?.()||{items:[]};
    text(btn,`CONTEXT · ${ctx.items?.length||0}`);
    const list=panel.querySelector('.vb21List');if(!list)return true;list.innerHTML='';
    if(!ctx.items?.length){const e=document.createElement('div');e.className='vb21Empty';e.textContent='No synchronized semantic context yet. Behaviour learning continues locally.';list.appendChild(e);return true}
    for(const item of ctx.items){
      const row=document.createElement('article');row.className='vb21Item';
      const kind=document.createElement('div');kind.className='vb21Kind';kind.textContent=String(item.kind||'context');
      const st=document.createElement('div');st.className='vb21Statement';st.textContent=String(item.statement||'');
      const meta=document.createElement('div');meta.className='vb21Meta';meta.textContent=`${Math.round(Number(item.confidence||0)*100)}% confidence · ${Number(item.evidenceCount||0)} evidence`;
      row.append(kind,st,meta);list.appendChild(row);
    }
    return true;
  }
  function mountWhenReady(){
    const v19=document.getElementById('vBrainV19');
    const v8=document.getElementById('vBrainV8');
    if(!v19&&!v8)return false;
    refresh();
    if(v19)return mountV19();
    return !!v8;
  }
  if(mountWhenReady())return;
  const observer=new MutationObserver(()=>{if(mountWhenReady())observer.disconnect()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
