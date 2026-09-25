/* HOME Flex Shell v5 — user-editable HOME imagery + open remote extension surface. */
(function(){
  'use strict';
  if(window.__HOME_FLEX_V5__)return;window.__HOME_FLEX_V5__=true;
  const VERSION=5;
  const CONFIG_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/adaptive-ui.json';
  const OVERRIDE_KEY='homeVisualOverridesV5';
  const CACHE_KEY='homeFlexRemoteV5';
  const DEFAULTS={
    home:{cards:{
      calendar:{image:'https://images.unsplash.com/photo-1435527173128-983b87201f4d?auto=format&fit=crop&w=1400&q=84',position:'center 52%'},
      todos:{image:'',position:'center'},
      tube:{image:'',position:'center'},
      gym:{image:'',position:'center'}
    }},
    tube:{layout:'stack',visibleCount:5,readerDepth:'balanced',quizMode:'mcq_sentence'}
  };
  const sel={calendar:'#homeScreen .homeCard.calendar',todos:'#homeScreen .homeCard.todos',tube:'#homeScreen .homeCard.tube',gym:'#homeScreen .homeCard.gym'};
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState(k,JSON.stringify(v))}catch(e){}};
  const merge=(a,b)=>{const out=JSON.parse(JSON.stringify(a||{}));if(!b||typeof b!=='object')return out;Object.keys(b).forEach(k=>{if(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k]))out[k]=merge(out[k],b[k]);else out[k]=b[k]});return out};
  let remote=load(CACHE_KEY,{}),override=load(OVERRIDE_KEY,{}),effective=merge(merge(DEFAULTS,remote),override);

  function restoreNative(){
    if(Object.keys(override||{}).length)return;
    try{if(typeof Native!=='undefined'&&Native.loadState){const raw=Native.loadState(OVERRIDE_KEY);if(raw){override=JSON.parse(raw);effective=merge(merge(DEFAULTS,remote),override);localStorage.setItem(OVERRIDE_KEY,JSON.stringify(override))}}}catch(e){}
  }
  restoreNative();

  function safeImage(v){const s=String(v||'').trim();return /^(https:\/\/|data:image\/)/i.test(s)?s:''}
  function applyCards(){
    const cards=effective.home?.cards||{};
    Object.keys(sel).forEach(key=>{const el=document.querySelector(sel[key]);if(!el)return;const c=cards[key]||{};const img=safeImage(c.image);if(img){el.style.setProperty('background-image',`linear-gradient(180deg,rgba(9,10,13,.08),rgba(9,10,13,.48)),url("${img.replace(/"/g,'%22')}")`,'important');el.style.setProperty('background-size','cover','important');el.style.setProperty('background-position',String(c.position||'center'),'important')}else if(override?.home?.cards?.[key]?.image===''){el.style.removeProperty('background-image')}});
  }
  function applyTube(){
    const t=effective.tube||{};const grid=document.getElementById('grid');if(grid){grid.dataset.layout=String(t.layout||'stack');grid.dataset.flexMode=String(t.layout||'stack')}
    document.documentElement.dataset.flexTubeLayout=String(t.layout||'stack');
  }
  function apply(){effective=merge(merge(DEFAULTS,remote),override);applyCards();applyTube();ensureButton();return effective}

  async function refreshRemote(){
    try{const r=await fetch(CONFIG_URL+'?v='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();remote=j||{};localStorage.setItem(CACHE_KEY,JSON.stringify(remote))}}catch(e){}
    return apply();
  }

  function style(){
    if(document.getElementById('homeFlexV5Style'))return;
    const s=document.createElement('style');s.id='homeFlexV5Style';s.textContent=`
      #homeFlexEdit{position:absolute;right:18px;top:18px;z-index:25;width:38px;height:38px;border-radius:19px;border:1px solid rgba(255,255,255,.18);background:rgba(15,16,20,.46);backdrop-filter:blur(14px);color:#fff;font-size:22px;line-height:1;display:grid;place-items:center}
      #homeFlexSheet{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.46);display:none;align-items:flex-end}
      #homeFlexSheet.show{display:flex}
      #homeFlexPanel{width:100%;max-height:82vh;overflow:auto;border-radius:26px 26px 0 0;background:#121318;color:#fff;padding:22px 18px 30px;box-shadow:0 -20px 50px rgba(0,0,0,.32)}
      .homeFlexHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.homeFlexHead h2{font-size:22px;margin:0}.homeFlexClose{border:0;background:#24262d;color:white;border-radius:18px;width:36px;height:36px;font-size:22px}
      .homeFlexField{display:block;margin:14px 0}.homeFlexField span{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.58;margin:0 0 7px}.homeFlexField input,.homeFlexField select{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#1b1d23;color:#fff;padding:13px 14px;font-size:15px;outline:none}
      .homeFlexActions{display:flex;gap:10px;margin-top:18px}.homeFlexActions button{flex:1;border:0;border-radius:14px;padding:13px;font-weight:700}.homeFlexSave{background:#fff;color:#111}.homeFlexReset{background:#24262d;color:#fff}
      .homeFlexHint{font-size:12px;line-height:1.45;opacity:.6;margin-top:12px}
    `;document.head.appendChild(s);
  }

  function ensureButton(){
    style();const home=document.getElementById('homeScreen');if(!home)return;
    if(getComputedStyle(home).position==='static')home.style.position='relative';
    let b=document.getElementById('homeFlexEdit');if(!b){b=document.createElement('button');b.id='homeFlexEdit';b.type='button';b.setAttribute('aria-label','Customize HOME');b.textContent='⋯';b.onclick=openSheet;home.appendChild(b)}
  }

  function ensureSheet(){
    let sh=document.getElementById('homeFlexSheet');if(sh)return sh;
    sh=document.createElement('div');sh.id='homeFlexSheet';sh.innerHTML=`<div id="homeFlexPanel"><div class="homeFlexHead"><h2>Customize HOME</h2><button class="homeFlexClose">×</button></div>
      <label class="homeFlexField"><span>Calendar image URL</span><input data-img="calendar" inputmode="url" placeholder="https://…"></label>
      <label class="homeFlexField"><span>To-dos image URL</span><input data-img="todos" inputmode="url" placeholder="https://…"></label>
      <label class="homeFlexField"><span>Tube image URL</span><input data-img="tube" inputmode="url" placeholder="https://…"></label>
      <label class="homeFlexField"><span>Gym image URL</span><input data-img="gym" inputmode="url" placeholder="https://…"></label>
      <label class="homeFlexField"><span>Tube layout</span><select id="homeFlexTube"><option value="stack">Stack</option><option value="swipe">Swipe</option><option value="story">Story</option><option value="grid">Grid</option><option value="focus">Focus</option></select></label>
      <div class="homeFlexActions"><button class="homeFlexReset">Reset</button><button class="homeFlexSave">Save</button></div>
      <div class="homeFlexHint">Image links are stored locally on this phone. Remote HOME updates can still replace structure, animation, cards, reader and quiz logic without a new APK.</div></div>`;
    document.body.appendChild(sh);sh.addEventListener('click',e=>{if(e.target===sh)closeSheet()});sh.querySelector('.homeFlexClose').onclick=closeSheet;sh.querySelector('.homeFlexReset').onclick=()=>{override={};save(OVERRIDE_KEY,override);apply();fillSheet();};sh.querySelector('.homeFlexSave').onclick=saveSheet;return sh;
  }
  function fillSheet(){const sh=ensureSheet();Object.keys(sel).forEach(k=>{const i=sh.querySelector(`[data-img="${k}"]`);if(i)i.value=String(effective.home?.cards?.[k]?.image||'')});const t=sh.querySelector('#homeFlexTube');if(t)t.value=String(effective.tube?.layout||'stack')}
  function openSheet(){fillSheet();ensureSheet().classList.add('show')}
  function closeSheet(){document.getElementById('homeFlexSheet')?.classList.remove('show')}
  function saveSheet(){const sh=ensureSheet();const cards={};Object.keys(sel).forEach(k=>{cards[k]={image:String(sh.querySelector(`[data-img="${k}"]`)?.value||'').trim()}});override=merge(override,{home:{cards},tube:{layout:String(sh.querySelector('#homeFlexTube')?.value||'stack')}});save(OVERRIDE_KEY,override);apply();closeSheet()}

  window.HOMEFlex={version:VERSION,refresh:refreshRemote,apply,getConfig:()=>effective,setCardImage:(key,url)=>{override=merge(override,{home:{cards:{[key]:{image:String(url||'')}}}});save(OVERRIDE_KEY,override);return apply()},setTubeLayout:(layout)=>{override=merge(override,{tube:{layout:String(layout||'stack')}});save(OVERRIDE_KEY,override);return apply()}};
  refreshRemote();setTimeout(apply,600);setTimeout(apply,1800);
  const oldResume=window.onAppResume;window.onAppResume=function(){try{if(oldResume)oldResume()}catch(e){}refreshRemote()};
})();
