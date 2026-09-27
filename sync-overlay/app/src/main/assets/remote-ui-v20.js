/* V-Brain Remote UI v20 — generic declarative interface renderer.
 * The APK contains the interpreter; adaptive-ui.json supplies layout/components later.
 * No arbitrary HTML or JavaScript is accepted from remote config.
 */
(function(){
  'use strict';
  if(window.__VBRAIN_REMOTE_UI_V20__)return;window.__VBRAIN_REMOTE_UI_V20__=true;
  const VERSION=20;
  const CONFIG_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/adaptive-ui.json';
  const ROOT_ID='vbrainRemoteUI20';
  const STYLE_ID='vbrainRemoteUI20Style';
  const MAX_COMPONENTS=80,MAX_DEPTH=6;
  const DEFAULT={
    enabled:false,replaceHome:true,refreshMs:30000,
    theme:{background:'#080a0e',text:'#f7f9fc',muted:'rgba(255,255,255,.58)',accent:'#82e8ff',padding:18,gap:12},
    canvas:{columns:2,minHeight:'100svh',background:'',backgroundImage:'',backgroundPosition:'center'},
    components:[]
  };
  let timer=0,current=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const arr=v=>Array.isArray(v)?v:[];
  const str=(v,max=300)=>String(v??'').trim().slice(0,max);
  const copy=v=>JSON.parse(JSON.stringify(v));
  function merge(a,b){const out=copy(a);if(!b||typeof b!=='object'||Array.isArray(b))return out;for(const k of Object.keys(b)){if(out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])&&b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k]))out[k]=merge(out[k],b[k]);else out[k]=b[k]}return out}
  function log(type,data){try{window.homeAdaptiveLog?.(type,data||{})}catch(_){} }
  function safeUrl(v){const s=str(v,1200);return /^https:\/\//i.test(s)?s:''}
  function safeColor(v,fallback=''){const s=str(v,100);return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent|currentColor)$/i.test(s)?s:fallback}
  function safeLength(v,fallback=''){if(typeof v==='number'&&Number.isFinite(v))return clamp(v,-2000,4000)+'px';const s=str(v,80);return /^(auto|0|-?\d+(?:\.\d+)?(?:px|%|vw|vh|svw|svh|dvw|dvh|rem|em))$/i.test(s)?s:fallback}
  function safePosition(v){const s=str(v,40);return /^(center|top|bottom|left|right)(?:\s+(?:center|top|bottom|left|right|\d{1,3}%)){0,1}$/i.test(s)?s:'center'}
  function route(target){
    const t=str(target,40).toLowerCase();
    try{
      if(t==='brain'){document.getElementById('vbrainScoreV8')?.click();return}
      if(t==='gym'&&typeof window.openHomeGym==='function'){window.openHomeGym();return}
      if(t==='status'){document.getElementById('vbrainLiveStatus17')?.click();return}
      if(typeof window.showScreen==='function'&&['home','calendar','todos','tube','gym'].includes(t)){window.showScreen(t);return}
      const node=document.getElementById(t+'Screen');if(node){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));node.classList.add('show')}
    }catch(_){}
  }
  function perform(action,id){
    const a=obj(action),type=str(a.type||'route',24).toLowerCase();
    log('remote_ui_action',{id:str(id,80),type,target:str(a.target||a.url,160)});
    if(type==='route'||type==='screen'||type==='brain'||type==='status')return route(type==='brain'?'brain':type==='status'?'status':a.target);
    if(type==='url'){
      const u=safeUrl(a.url);if(!u)return;
      try{if(typeof Native!=='undefined'&&Native.openUrl)Native.openUrl(u);else location.href=u}catch(_){location.href=u}
    }
    if(type==='scroll')document.getElementById(str(a.target,80))?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #homeScreen.vbr20Active{background:var(--vbr-bg,#080a0e)!important;overflow-x:hidden!important}
      #homeScreen.vbr20Active>.homeHero,#homeScreen.vbr20Active>.homeInner{display:none!important}
      #${ROOT_ID}{display:none;position:relative;min-height:100svh;color:var(--vbr-text,#f7f9fc);background:var(--vbr-bg,#080a0e);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;overflow:hidden}
      #homeScreen.vbr20Active>#${ROOT_ID}{display:block}
      #${ROOT_ID} *{box-sizing:border-box}
      .vbr20Canvas{position:relative;z-index:1;width:100%;display:grid;align-content:start}
      .vbr20Component{appearance:none;-webkit-appearance:none;position:relative;min-width:0;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:inherit;text-align:left;overflow:hidden;isolation:isolate;transition:transform 120ms ease,filter 160ms ease,border-color 160ms ease;backdrop-filter:blur(var(--vbr-blur,0px));-webkit-backdrop-filter:blur(var(--vbr-blur,0px));box-shadow:var(--vbr-shadow,none)}
      .vbr20Component[data-action="1"]{cursor:pointer;touch-action:manipulation}
      .vbr20Component[data-action="1"]:active{transform:scale(var(--vbr-press,.97));filter:brightness(.92)}
      .vbr20Component[data-shape="rounded"]{border-radius:28px}.vbr20Component[data-shape="soft"]{border-radius:18px}.vbr20Component[data-shape="square"]{border-radius:8px;aspect-ratio:1}.vbr20Component[data-shape="circle"]{border-radius:50%;aspect-ratio:1;display:flex;flex-direction:column;justify-content:center;text-align:center}.vbr20Component[data-shape="pill"],.vbr20Component[data-shape="capsule"]{border-radius:999px}.vbr20Component[data-shape="diamond"]{clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);aspect-ratio:1;border-radius:0}.vbr20Component[data-shape="hex"]{clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%);aspect-ratio:1;border-radius:0}.vbr20Component[data-shape="arch"]{border-radius:999px 999px 22px 22px}.vbr20Component[data-shape="bar"]{border-radius:16px}
      .vbr20Stack,.vbr20Row,.vbr20Grid{border:0;background:transparent;overflow:visible;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}.vbr20Stack{display:flex;flex-direction:column}.vbr20Row{display:flex;flex-direction:row;align-items:stretch}.vbr20Grid{display:grid}
      .vbr20Kicker{font-size:10px;line-height:1.1;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:var(--vbr-accent,#82e8ff);opacity:.88}.vbr20Title{font-size:26px;line-height:1.02;font-weight:760;letter-spacing:-.035em;margin-top:8px}.vbr20Text{font-size:13px;line-height:1.48;color:var(--vbr-muted,rgba(255,255,255,.58));margin-top:8px}.vbr20Metric{position:absolute;top:14px;right:15px;font-size:11px;font-weight:850;letter-spacing:.08em;color:rgba(255,255,255,.72)}.vbr20Icon{font-size:30px;line-height:1;margin-bottom:10px}.vbr20Badge{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.10);font-size:10px;font-weight:800;letter-spacing:.06em}.vbr20Image{display:block;width:100%;height:100%;object-fit:cover;border:0}.vbr20Progress{height:10px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden}.vbr20Progress>i{display:block;height:100%;border-radius:inherit;background:var(--vbr-accent,#82e8ff)}.vbr20Divider{height:1px;background:rgba(255,255,255,.10);border:0}.vbr20Spacer{border:0;background:transparent;box-shadow:none}
      .vbr20Float{position:fixed!important;z-index:9999!important}.vbr20Absolute{position:absolute!important}.vbr20Sticky{position:sticky!important;z-index:50}
      .vbr20Anim-fade{animation:vbr20Fade .42s ease both}.vbr20Anim-rise{animation:vbr20Rise .5s cubic-bezier(.2,.75,.2,1) both}.vbr20Anim-pulse{animation:vbr20Pulse 2.2s ease-in-out infinite}.vbr20Anim-spin{animation:vbr20Spin 9s linear infinite}.vbr20Anim-float{animation:vbr20Float 3.5s ease-in-out infinite}.vbr20Anim-glow{animation:vbr20Glow 2.4s ease-in-out infinite alternate}
      @keyframes vbr20Fade{from{opacity:0}to{opacity:1}}@keyframes vbr20Rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}@keyframes vbr20Pulse{50%{transform:scale(1.035)}}@keyframes vbr20Spin{to{transform:rotate(360deg)}}@keyframes vbr20Float{50%{transform:translateY(-8px)}}@keyframes vbr20Glow{to{box-shadow:0 0 34px color-mix(in srgb,var(--vbr-accent,#82e8ff) 38%,transparent)}}
      @media(prefers-reduced-motion:reduce){#${ROOT_ID} *{animation:none!important;transition:none!important}}
    `;document.head.appendChild(s);
  }
  function applyBox(el,c){
    const st=obj(c.style),shape=str(c.shape||st.shape||'rounded',20).toLowerCase();el.dataset.shape=['rounded','soft','square','circle','pill','capsule','diamond','hex','arch','bar'].includes(shape)?shape:'rounded';
    const pos=str(c.position||st.position,20).toLowerCase();if(pos==='fixed')el.classList.add('vbr20Float');else if(pos==='absolute')el.classList.add('vbr20Absolute');else if(pos==='sticky')el.classList.add('vbr20Sticky');
    const lengths={width:c.width??st.width,height:c.height??st.height,minHeight:c.minHeight??st.minHeight,maxHeight:c.maxHeight??st.maxHeight,maxWidth:c.maxWidth??st.maxWidth,top:c.top??st.top,right:c.right??st.right,bottom:c.bottom??st.bottom,left:c.left??st.left};
    for(const [k,v] of Object.entries(lengths)){const x=safeLength(v);if(x)el.style[k]=x}
    const span=clamp(c.span||st.span||1,1,12);el.style.gridColumn='span '+span;
    const rowSpan=clamp(c.rowSpan||st.rowSpan||1,1,12);if(rowSpan>1)el.style.gridRow='span '+rowSpan;
    const bg=safeColor(st.background||c.background);if(bg)el.style.background=bg;
    const color=safeColor(st.color||c.color);if(color)el.style.color=color;
    const border=safeColor(st.borderColor||c.borderColor);if(border)el.style.borderColor=border;
    if(st.borderWidth!=null)el.style.borderWidth=clamp(st.borderWidth,0,8)+'px';
    if(st.opacity!=null)el.style.opacity=String(clamp(st.opacity,0,1));
    if(st.padding!=null)el.style.padding=clamp(st.padding,0,80)+'px';else if(!['stack','row','grid','image','divider','spacer','progress'].includes(c.type))el.style.padding='18px';
    if(st.gap!=null)el.style.gap=clamp(st.gap,0,50)+'px';
    if(st.blur!=null)el.style.setProperty('--vbr-blur',clamp(st.blur,0,40)+'px');
    if(st.pressScale!=null)el.style.setProperty('--vbr-press',String(clamp(st.pressScale,.85,1)));
    if(st.shadow===true)el.style.setProperty('--vbr-shadow','0 18px 48px rgba(0,0,0,.28)');
    if(st.radius!=null)el.style.borderRadius=clamp(st.radius,0,999)+'px';
    if(st.fontSize!=null)el.style.fontSize=clamp(st.fontSize,8,80)+'px';
    if(st.align)el.style.alignItems=['start','center','end','stretch','flex-start','flex-end'].includes(st.align)?st.align:'';
    if(st.justify)el.style.justifyContent=['start','center','end','space-between','space-around','space-evenly','flex-start','flex-end'].includes(st.justify)?st.justify:'';
    const image=safeUrl(st.backgroundImage||c.backgroundImage);if(image){el.style.backgroundImage=`linear-gradient(180deg,rgba(5,7,10,.04),rgba(5,7,10,.44)),url("${image.replace(/["'()]/g,encodeURIComponent)}")`;el.style.backgroundSize='cover';el.style.backgroundPosition=safePosition(st.backgroundPosition||c.backgroundPosition)}
    const anim=str(c.animation||st.animation,20).toLowerCase();if(['fade','rise','pulse','spin','float','glow'].includes(anim))el.classList.add('vbr20Anim-'+anim);
  }
  function primitiveContent(el,c){
    const type=str(c.type||'card',20).toLowerCase();
    if(type==='image'){
      const u=safeUrl(c.src||c.image);if(!u)return;const img=document.createElement('img');img.className='vbr20Image';img.src=u;img.alt=str(c.alt,120);img.loading='lazy';el.appendChild(img);return;
    }
    if(type==='divider')return;
    if(type==='spacer')return;
    if(type==='progress'){
      const bar=document.createElement('div');bar.className='vbr20Progress';const i=document.createElement('i');i.style.width=clamp(c.value,0,100)+'%';bar.appendChild(i);el.appendChild(bar);return;
    }
    if(type==='badge'){
      const b=document.createElement('span');b.className='vbr20Badge';b.textContent=str(c.text||c.title,100);el.appendChild(b);return;
    }
    if(type==='text'){
      const t=document.createElement(str(c.tag,10).toLowerCase()==='h1'?'h1':'div');t.textContent=str(c.text||c.title,500);t.style.margin='0';el.appendChild(t);return;
    }
    if(str(c.icon,20)){const x=document.createElement('div');x.className='vbr20Icon';x.textContent=str(c.icon,20);el.appendChild(x)}
    if(str(c.kicker,80)){const x=document.createElement('div');x.className='vbr20Kicker';x.textContent=str(c.kicker,80);el.appendChild(x)}
    if(str(c.title,180)){const x=document.createElement('div');x.className='vbr20Title';x.textContent=str(c.title,180);el.appendChild(x)}
    if(str(c.text,500)){const x=document.createElement('div');x.className='vbr20Text';x.textContent=str(c.text,500);el.appendChild(x)}
    if(str(c.metric,60)){const x=document.createElement('div');x.className='vbr20Metric';x.textContent=str(c.metric,60);el.appendChild(x)}
  }
  function component(raw,depth,index){
    if(depth>MAX_DEPTH)return null;const c=obj(raw),type=str(c.type||'card',20).toLowerCase();
    const layout=['stack','row','grid'].includes(type);const el=document.createElement('div');el.className='vbr20Component';if(layout)el.classList.add(type==='stack'?'vbr20Stack':type==='row'?'vbr20Row':'vbr20Grid');if(type==='divider')el.classList.add('vbr20Divider');if(type==='spacer')el.classList.add('vbr20Spacer');
    el.id=str(c.id,80)||('vbr20-'+depth+'-'+index);el.dataset.type=type;applyBox(el,c);
    if(type==='grid'){const cols=clamp(c.columns||obj(c.style).columns||2,1,6);el.style.gridTemplateColumns=`repeat(${cols},minmax(0,1fr))`;el.style.gap=clamp(c.gap||obj(c.style).gap||12,0,50)+'px'}
    if(type==='row'||type==='stack')el.style.gap=clamp(c.gap||obj(c.style).gap||12,0,50)+'px';
    primitiveContent(el,c);
    const children=arr(c.children).slice(0,MAX_COMPONENTS);children.forEach((child,i)=>{const node=component(child,depth+1,i);if(node)el.appendChild(node)});
    if(c.action&&typeof c.action==='object'){el.dataset.action='1';el.setAttribute('role','button');el.tabIndex=0;const go=()=>perform(c.action,el.id);el.addEventListener('click',go);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}})}
    return el;
  }
  function ensureRoot(){ensureStyle();const home=document.getElementById('homeScreen');if(!home)return null;let root=document.getElementById(ROOT_ID);if(!root){root=document.createElement('div');root.id=ROOT_ID;home.insertBefore(root,home.firstChild)}return root}
  function disable(){const home=document.getElementById('homeScreen');home?.classList.remove('vbr20Active');const root=document.getElementById(ROOT_ID);if(root){root.innerHTML='';root.style.display='none'}document.documentElement.dataset.vbrainRemoteUi='off'}
  function render(override){
    const source=override&&typeof override==='object'?override:window.HOMEAdaptive?.config?.remoteUI;const cfg=merge(DEFAULT,source||{});current=cfg;const root=ensureRoot();if(!root)return cfg;
    if(cfg.enabled!==true){disable();return cfg}
    const home=document.getElementById('homeScreen');home.classList.toggle('vbr20Active',cfg.replaceHome!==false);root.style.display='block';root.innerHTML='';
    const theme=obj(cfg.theme);root.style.setProperty('--vbr-bg',safeColor(theme.background,'#080a0e'));root.style.setProperty('--vbr-text',safeColor(theme.text,'#f7f9fc'));root.style.setProperty('--vbr-muted',safeColor(theme.muted,'rgba(255,255,255,.58)'));root.style.setProperty('--vbr-accent',safeColor(theme.accent,'#82e8ff'));
    const canvasCfg=obj(cfg.canvas),canvas=document.createElement('div');canvas.className='vbr20Canvas';canvas.style.minHeight=safeLength(canvasCfg.minHeight,'100svh');canvas.style.padding=`max(${clamp(theme.padding,0,60)}px,env(safe-area-inset-top)) ${clamp(theme.padding,0,60)}px calc(${clamp(theme.padding,0,60)}px + env(safe-area-inset-bottom))`;canvas.style.gap=clamp(theme.gap,0,40)+'px';canvas.style.gridTemplateColumns=`repeat(${clamp(canvasCfg.columns||2,1,6)},minmax(0,1fr))`;
    const bg=safeColor(canvasCfg.background);if(bg)canvas.style.background=bg;const bgimg=safeUrl(canvasCfg.backgroundImage);if(bgimg){canvas.style.backgroundImage=`linear-gradient(180deg,rgba(5,7,10,.08),rgba(5,7,10,.72)),url("${bgimg.replace(/["'()]/g,encodeURIComponent)}")`;canvas.style.backgroundSize='cover';canvas.style.backgroundPosition=safePosition(canvasCfg.backgroundPosition)}
    const items=arr(cfg.components).filter(x=>obj(x).visible!==false).slice(0,MAX_COMPONENTS).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));items.forEach((item,i)=>{const node=component(item,0,i);if(node)canvas.appendChild(node)});root.appendChild(canvas);document.documentElement.dataset.vbrainRemoteUi=String(cfg.version||VERSION);log('remote_ui_render',{version:cfg.version||VERSION,components:items.length,replaceHome:cfg.replaceHome!==false});return cfg;
  }
  async function refresh(){
    try{if(window.HOMEAdaptive?.refresh)await window.HOMEAdaptive.refresh();else{const r=await fetch(CONFIG_URL+'?v='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();window.__VBrainRemoteFallbackConfig=j}}}catch(_){}
    const source=window.HOMEAdaptive?.config?.remoteUI||window.__VBrainRemoteFallbackConfig?.remoteUI;render(source);clearTimeout(timer);timer=setTimeout(refresh,clamp(source?.refreshMs||DEFAULT.refreshMs,10000,600000));
  }
  window.VBrainRemoteUI={version:VERSION,render,apply:render,refresh,disable,config:()=>copy(current||DEFAULT),capabilities:{nested:true,maxComponents:MAX_COMPONENTS,shapes:['rounded','soft','square','circle','pill','capsule','diamond','hex','arch','bar'],types:['card','button','text','image','badge','progress','divider','spacer','stack','row','grid'],positions:['flow','absolute','fixed','sticky'],actions:['route','brain','status','url','scroll'],animations:['fade','rise','pulse','spin','float','glow']}};
  ensureStyle();setTimeout(()=>render(),350);setTimeout(refresh,1500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
