/* V-Brain Patch v10.1 — declarative live UI control without layout churn. */
(function(){
  'use strict';
  if(window.__VBRAIN_PATCH_V10__)return;window.__VBRAIN_PATCH_V10__=true;
  const DEFAULT={
    refreshMs:120000,
    home:{orderMode:'adaptive',order:['calendar','todos','tube','gym'],visible:{calendar:true,todos:true,tube:true,gym:true},gap:14,minHeight:132,scale:1,heroImage:'',heroPosition:'center'},
    score:{title:'',subtitle:'',showMini:true},
    brain:{hint:'',detailMaxVh:35,nodeScale:1},
    motion:{cardMs:140,pressScale:.985},
    banner:{visible:false,title:'',text:'',target:'todos'}
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const str=(v,max=180)=>String(v??'').trim().slice(0,max);
  const merge=(a,b)=>{const out=JSON.parse(JSON.stringify(a));if(!b||typeof b!=='object'||Array.isArray(b))return out;for(const k of Object.keys(b)){if(out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])&&b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k]))out[k]=merge(out[k],b[k]);else out[k]=b[k]}return out};
  let cfg=JSON.parse(JSON.stringify(DEFAULT)),timer=0,lastFixedOrder='';

  function current(){return window.HOMEAdaptive?.config?.vbrainPatch||{} }
  function ensureStyle(){if(document.getElementById('vbrainPatchV10Style'))return;const s=document.createElement('style');s.id='vbrainPatchV10Style';s.textContent=`
    #vbrainLiveBanner{margin:0 0 16px;border:1px solid rgba(142,168,255,.22);background:linear-gradient(145deg,rgba(33,39,57,.92),rgba(19,22,30,.95));border-radius:24px;padding:15px 16px;color:#fff;text-align:left;width:100%;box-shadow:0 18px 48px rgba(0,0,0,.20);display:none}
    #vbrainLiveBanner.show{display:block}#vbrainLiveBanner small{display:block;font-size:9px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#9fb5ff;margin-bottom:5px}#vbrainLiveBanner b{display:block;font-size:16px;line-height:1.25;margin-bottom:5px}#vbrainLiveBanner span{display:block;font-size:12px;line-height:1.45;color:rgba(255,255,255,.68)}
    .vbrainHomeSettled #homeScreen .homeCard{animation:none!important;opacity:1!important;transform:none!important}
  `;document.head.appendChild(s)}
  function safeImage(v){const x=str(v,900);return /^https:\/\//i.test(x)?x:''}
  function card(kind){return document.querySelector('#homeScreen .homeCard.'+kind)}
  function applyHome(c){
    const grid=document.querySelector('#homeScreen .homeGrid');
    if(grid){
      grid.style.gap=clamp(c.gap,6,28)+'px';
      const order=Array.isArray(c.order)?c.order.filter(x=>['calendar','todos','tube','gym'].includes(x)):DEFAULT.home.order;
      const fixed=c.orderMode==='fixed';
      const sig=fixed?order.join('|'):'';
      for(const k of ['calendar','todos','tube','gym']){const el=card(k);if(el)el.style.order=''}
      if(fixed&&sig!==lastFixedOrder){order.forEach((k,i)=>{const el=card(k);if(el)el.style.order=String(i+1)});lastFixedOrder=sig}
      if(!fixed)lastFixedOrder='';
    }
    for(const k of ['calendar','todos','tube','gym']){
      const el=card(k);if(!el)continue;
      el.style.display=c.visible?.[k]===false?'none':'';
      el.style.minHeight=clamp(c.minHeight,104,210)+'px';
      el.style.setProperty('--vbrain-card-scale',String(clamp(c.scale,.94,1.06)));
      const img=safeImage(window.HOMEAdaptive?.config?.home?.cards?.[k]?.image||'');
      if(img){el.style.backgroundImage=`linear-gradient(180deg,rgba(8,10,14,.10),rgba(8,10,14,.48)),url("${img.replace(/["'()]/g,encodeURIComponent)}")`;el.style.backgroundSize='cover';el.style.backgroundPosition=str(window.HOMEAdaptive?.config?.home?.cards?.[k]?.position||'center',40)}
    }
    const hero=document.querySelector('#homeScreen .homeHero'),hi=safeImage(c.heroImage);if(hero&&hi){hero.style.backgroundImage=`linear-gradient(180deg,rgba(17,18,20,.03),rgba(17,18,20,.15)),url("${hi.replace(/["'()]/g,encodeURIComponent)}")`;hero.style.backgroundPosition=str(c.heroPosition||'center',40)}
  }
  function applyScore(c){const box=document.getElementById('vbrainScoreV8');if(!box)return;const title=box.querySelector('.vb8ScoreTitle'),sub=box.querySelector('.vb8ScoreSub'),mini=box.querySelector('.vb8Mini');if(title&&str(c.title))title.textContent=str(c.title,56);if(sub&&str(c.subtitle))sub.textContent=str(c.subtitle,150);if(mini)mini.style.display=c.showMini===false?'none':''}
  function applyBrain(c){const hint=document.querySelector('#vBrainV8 .vb8Hint'),detail=document.getElementById('vb8Detail');if(hint&&str(c.hint))hint.textContent=str(c.hint,100);if(detail)detail.style.maxHeight=clamp(c.detailMaxVh,22,48)+'vh';document.documentElement.style.setProperty('--vbrain-node-scale',String(clamp(c.nodeScale,.8,1.35)))}
  function applyMotion(c){ensureStyle();const ms=clamp(c.cardMs,0,500),scale=clamp(c.pressScale,.94,1);let s=document.getElementById('vbrainPatchV10Motion');if(!s){s=document.createElement('style');s.id='vbrainPatchV10Motion';document.head.appendChild(s)}s.textContent=`.vbrainHomeSettled #homeScreen .homeCard{transition:filter ${ms}ms ease,border-color ${ms}ms ease,opacity ${ms}ms ease!important}.vbrainHomeSettled #homeScreen .homeCard:active{transform:scale(${scale})!important;transition:transform 95ms ease-out,filter ${ms}ms ease!important}`}
  function route(name){try{if(typeof window.showScreen==='function')return window.showScreen(name)}catch(e){}const el=document.getElementById(name+'Screen');if(!el)return;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));el.classList.add('show')}
  function applyBanner(c){ensureStyle();const inner=document.querySelector('#homeScreen .homeInner');if(!inner)return;let b=document.getElementById('vbrainLiveBanner');if(!b){b=document.createElement('button');b.id='vbrainLiveBanner';b.type='button';const grid=inner.querySelector('.homeGrid');inner.insertBefore(b,grid||null)}b.classList.toggle('show',c.visible===true&&!!str(c.title||c.text));b.innerHTML=`<small>V-Brain · live focus</small><b></b><span></span>`;b.querySelector('b').textContent=str(c.title,80);b.querySelector('span').textContent=str(c.text,240);const target=['calendar','todos','tube','gym'].includes(c.target)?c.target:'todos';b.onclick=()=>route(target)}
  function apply(){cfg=merge(DEFAULT,current());cfg.refreshMs=clamp(cfg.refreshMs,30000,600000);applyHome(cfg.home);applyScore(cfg.score);applyBrain(cfg.brain);applyMotion(cfg.motion);applyBanner(cfg.banner);document.documentElement.dataset.vbrainPatch='10.1';return cfg}
  async function refresh(){try{await window.HOMEAdaptive?.refresh?.()}catch(e){}apply();clearTimeout(timer);timer=setTimeout(refresh,cfg.refreshMs)}
  window.VBrainPatch={version:10.1,apply,refresh,config:()=>JSON.parse(JSON.stringify(cfg))};
  ensureStyle();apply();setTimeout(()=>document.documentElement.classList.add('vbrainHomeSettled'),1150);setTimeout(refresh,1200);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
