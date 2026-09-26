/* V-Brain Live v9 — damped 3D renderer, private app-context mirror and safe declarative live controls. */
(function(){
  'use strict';
  if(window.__VBRAIN_LIVE_V9__)return;window.__VBRAIN_LIVE_V9__=true;

  const VERSION=9;
  const DEFAULTS={
    motion:{dragSensitivity:.0045,rotationDamping:.18,zoomDamping:.16,minZoom:.72,maxZoom:1.90,idleDrift:.00022,tapMovePx:10},
    brain:{nodeScale:1,edgeOpacity:.88,detailMaxHeight:.34,showHint:true},
    score:{title:'Your signal today',showDomainMini:true},
    home:{orderMode:'adaptive',cardOrder:['calendar','todos','tube','gym']},
    context:{mirrorText:true,debounceMs:1500,maxChars:5000},
    interface:{publishManifest:true}
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const merge=(a,b)=>{const o=JSON.parse(JSON.stringify(a));if(!isObj(b))return o;Object.keys(b).forEach(k=>{o[k]=isObj(b[k])&&isObj(o[k])?merge(o[k],b[k]):b[k]});return o};
  const safeText=(v,f,max=80)=>{const s=String(v??'').trim();return(s||f).slice(0,max)};
  let cfg=JSON.parse(JSON.stringify(DEFAULTS));

  function readConfig(){
    const raw=window.HOMEAdaptive?.config?.vbrain||{};const c=merge(DEFAULTS,raw);
    c.motion.dragSensitivity=clamp(c.motion.dragSensitivity,.001,.012);c.motion.rotationDamping=clamp(c.motion.rotationDamping,.05,.45);c.motion.zoomDamping=clamp(c.motion.zoomDamping,.05,.45);c.motion.minZoom=clamp(c.motion.minZoom,.5,1.1);c.motion.maxZoom=clamp(c.motion.maxZoom,1.2,2.6);if(c.motion.maxZoom<c.motion.minZoom+.2)c.motion.maxZoom=c.motion.minZoom+.2;c.motion.idleDrift=clamp(c.motion.idleDrift,0,.0012);c.motion.tapMovePx=clamp(c.motion.tapMovePx,6,20);
    c.brain.nodeScale=clamp(c.brain.nodeScale,.75,1.45);c.brain.edgeOpacity=clamp(c.brain.edgeOpacity,.3,1.4);c.brain.detailMaxHeight=clamp(c.brain.detailMaxHeight,.22,.48);c.brain.showHint=c.brain.showHint!==false;
    c.score.title=safeText(c.score.title,'Your signal today',42);c.score.showDomainMini=c.score.showDomainMini!==false;
    const allowed=['calendar','todos','tube','gym'];c.home.orderMode=c.home.orderMode==='fixed'?'fixed':'adaptive';c.home.cardOrder=Array.isArray(c.home.cardOrder)?c.home.cardOrder.filter(x=>allowed.includes(x)):allowed;if(c.home.cardOrder.length!==4)c.home.cardOrder=allowed;
    c.context.mirrorText=c.context.mirrorText!==false;c.context.debounceMs=clamp(c.context.debounceMs,700,5000);c.context.maxChars=clamp(c.context.maxChars,500,8000);c.interface.publishManifest=c.interface.publishManifest!==false;
    cfg=c;applyConfig();return cfg;
  }

  function style(){if(document.getElementById('vBrainLiveV9Style'))return;const s=document.createElement('style');s.id='vBrainLiveV9Style';s.textContent=`
    #vBrainV9{position:fixed;inset:0;z-index:2147483400;background:linear-gradient(180deg,#07090d,#0a0d13 62%,#080a0e);color:#fff;display:none;pointer-events:none;overflow:hidden;contain:layout paint size}
    #vBrainV9.show{display:block;pointer-events:auto}
    #vBrainV9 canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
    .vb9Top{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:max(15px,env(safe-area-inset-top)) 18px 12px;background:linear-gradient(180deg,rgba(7,9,13,.96),rgba(7,9,13,.57),transparent)}
    .vb9Back{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.11);background:#151922;color:#fff;font-size:28px;touch-action:manipulation}.vb9Top small{display:block;font-size:9px;letter-spacing:.18em;color:rgba(255,255,255,.46);font-weight:900}.vb9Top h1{margin:1px 0 0;font-size:21px;letter-spacing:-.02em}.vb9Meta{margin-left:auto;text-align:right;font-size:9px;color:rgba(255,255,255,.45);line-height:1.45}
    .vb9Hint{position:absolute;left:50%;transform:translateX(-50%);top:max(83px,calc(env(safe-area-inset-top) + 70px));z-index:3;font-size:9px;letter-spacing:.10em;color:rgba(255,255,255,.38);white-space:nowrap;pointer-events:none}
    .vb9Detail{position:absolute;z-index:5;left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom));padding:15px 16px 16px;border-radius:24px;border:1px solid rgba(255,255,255,.10);background:rgba(15,18,25,.90);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 20px 60px rgba(0,0,0,.38);max-height:var(--vb9-detail-max,34vh);overflow:auto}
    .vb9Tag{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#f0c95d;font-weight:900}.vb9Title{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.vb9Title h2{font-size:21px;margin:4px 0}.vb9Title b{font-size:28px}.vb9Detail p{font-size:11px;line-height:1.48;color:rgba(255,255,255,.64);margin:5px 0}.vb9Reasons{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.vb9Reason{padding:6px 8px;border:1px solid rgba(255,255,255,.08);border-radius:999px;font-size:9px;color:rgba(255,255,255,.58)}
    #homeScreen .homeCard{transition:transform .14s cubic-bezier(.2,.72,.2,1),border-color .14s ease,filter .14s ease!important;will-change:auto!important}
    @media(prefers-reduced-motion:reduce){#homeScreen .homeCard{transition:none!important}.vb9Hint{display:none!important}}
  `;document.head.appendChild(s)}

  function applyConfig(){
    style();document.documentElement.style.setProperty('--vb9-detail-max',Math.round(cfg.brain.detailMaxHeight*100)+'vh');
    const hint=document.querySelector('#vBrainV9 .vb9Hint');if(hint)hint.style.display=cfg.brain.showHint?'':'none';
    const title=document.querySelector('#vbrainScoreV8 .vb8ScoreTitle');if(title)title.textContent=cfg.score.title;
    const mini=document.querySelector('#vbrainScoreV8 .vb8Mini');if(mini)mini.style.display=cfg.score.showDomainMini?'':'none';
    applyHomeVisuals();applyHomeOrder();
  }

  function applyHomeVisuals(){const cards=window.HOMEAdaptive?.config?.home?.cards||{};for(const key of ['calendar','todos','tube','gym']){const el=document.querySelector('#homeScreen .homeCard.'+key),spec=cards[key];if(!el||!spec)continue;const img=String(spec.image||'').trim();if(/^https:\/\//i.test(img)||/^data:image\//i.test(img)){const safe=img.replace(/["'()]/g,c=>encodeURIComponent(c));el.style.setProperty('background-image',`linear-gradient(180deg,rgba(7,9,13,.10),rgba(7,9,13,.50)),url("${safe}")`,'important');el.style.setProperty('background-size','cover','important');el.style.setProperty('background-position',safeText(spec.position,'center',40),'important')}}}
  function applyHomeOrder(){if(cfg.home.orderMode!=='fixed')return;const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;cfg.home.cardOrder.forEach(k=>{const el=grid.querySelector('.homeCard.'+k);if(el)grid.appendChild(el)})}

  const palette={action:'#f1ca62',attention:'#8fb2ff',growth:'#bba0ff',health:'#79d2ac',stability:'#83a6c8',structure:'#8bd0df',rhythm:'#e6a66e',friction:'#df8d80'};
  let shell,canvas,ctx,detail,model,basePos={},projected=[],raf=0,lastFrame=0,lastInput=0;
  let rotX=.20,rotY=-.45,targetX=.20,targetY=-.45,zoom=1,targetZoom=1;
  const pointers=new Map(),starts=new Map();let pinch=null;
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
  function seeded(id){let h=2166136261;for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return()=>((h=Math.imul(h^h>>>15,2246822519))>>>0)/4294967295}
  function positions(nodes){const out={};nodes.forEach((n,i)=>{const rnd=seeded(n.id),N=Math.max(1,nodes.length),phi=Math.acos(1-2*(i+.5)/N),theta=Math.PI*(1+Math.sqrt(5))*i+(rnd()-.5)*.45,rad=.72+(rnd()-.5)*.18;out[n.id]={x:Math.sin(phi)*Math.cos(theta)*rad,y:Math.cos(phi)*rad,z:Math.sin(phi)*Math.sin(theta)*rad}});return out}
  function rotate(p){const cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX),x1=p.x*cy-p.z*sy,z1=p.x*sy+p.z*cy,y1=p.y*cx-z1*sx,z2=p.y*sx+z1*cx;return{x:x1,y:y1,z:z2}}

  function draw(ts){
    if(!shell?.classList.contains('show'))return;const now=Number(ts)||performance.now(),step=lastFrame?clamp((now-lastFrame)/16.667,.25,2.4):1;lastFrame=now,rm=reduced(),rd=rm?1:1-Math.pow(1-cfg.motion.rotationDamping,step),zd=rm?1:1-Math.pow(1-cfg.motion.zoomDamping,step);
    if(!rm&&!pointers.size&&now-lastInput>2400&&cfg.motion.idleDrift)targetY+=cfg.motion.idleDrift*step;rotX+=(targetX-rotX)*rd;rotY+=(targetY-rotY)*rd;zoom+=(targetZoom-zoom)*zd;
    const dpr=Math.min(2,devicePixelRatio||1),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h){raf=requestAnimationFrame(draw);return}const W=Math.floor(w*dpr),H=Math.floor(h*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cx=w/2,cy=h*.46,scale=Math.min(w,h)*.40*zoom;projected=[];for(const n of model.nodes){const p=rotate(basePos[n.id]||{x:0,y:0,z:0}),pers=1/(1.55-p.z*.58),x=cx+p.x*scale*pers,y=cy+p.y*scale*pers;projected.push({n,p,x,y,r:(8+n.confidence*.075)*pers*cfg.brain.nodeScale})}
    const by=Object.fromEntries(projected.map(q=>[q.n.id,q]));for(const e of model.edges.slice().sort((a,b)=>((by[a.a]?.p.z||0)+(by[a.b]?.p.z||0))-((by[b.a]?.p.z||0)+(by[b.b]?.p.z||0)))){const a=by[e.a],b=by[e.b];if(!a||!b)continue;const alpha=Math.min(.78,(.10+e.w/240)*cfg.brain.edgeOpacity);ctx.strokeStyle=`rgba(145,165,235,${alpha})`;ctx.lineWidth=.55+e.w/85;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    for(const q of projected.slice().sort((a,b)=>a.p.z-b.p.z)){const n=q.n,col=palette[n.group]||'#9fb5ff',depth=clamp((q.p.z+1.2)/2.4,0,1);ctx.globalAlpha=.48+depth*.52;ctx.shadowBlur=n.emergent?18:8;ctx.shadowColor=col;ctx.fillStyle='#101620';ctx.strokeStyle=col;ctx.lineWidth=n.emergent?2:1.25;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`${Math.max(8,Math.min(12,q.r*.65))}px system-ui`;ctx.fillText(n.label,q.x,q.y-q.r-5);ctx.font=`700 ${Math.max(8,Math.min(11,q.r*.62))}px system-ui`;ctx.fillText(String(n.value),q.x,q.y+3);ctx.globalAlpha=1}
    raf=requestAnimationFrame(draw)
  }

  function showNode(n){if(!detail||!n)return;const linked=model.edges.filter(e=>e.a===n.id||e.b===n.id).map(e=>model.nodes.find(x=>x.id===(e.a===n.id?e.b:e.a))?.label).filter(Boolean),level=n.confidence<25?'Early signal':n.confidence<55?'Developing pattern':'Established signal';detail.innerHTML=`<div class="vb9Tag">${esc(level)} · ${n.confidence}% confidence · ${n.evidenceCount} signals</div><div class="vb9Title"><h2>${esc(n.label)}</h2><b>${n.value}</b></div><p>${esc(n.description)}</p><p>${n.value>=70?'V-Brain currently sees this as one of the stronger patterns in your behaviour.':n.value>=45?'This pattern is becoming visible, but can still change as more evidence arrives.':'The signal is weak or early. V-Brain will not treat it as a fixed trait.'}</p>${linked.length?`<p><b>Connected with:</b> ${esc(linked.slice(0,5).join(', '))}</p>`:''}<div class="vb9Reasons">${(n.reasons||[]).map(x=>`<span class="vb9Reason">${esc(x)}</span>`).join('')}</div>`}
  function ensureShell(){
    if(shell)return;style();shell=document.createElement('section');shell.id='vBrainV9';shell.innerHTML=`<div class="vb9Top"><button class="vb9Back" type="button">‹</button><div><small>V-BRAIN · LIVING MODEL</small><h1>Behaviour network</h1></div><div class="vb9Meta"></div></div><div class="vb9Hint">drag to rotate · pinch to zoom · tap a node</div><canvas></canvas><div class="vb9Detail"><div class="vb9Tag">Living model</div><div class="vb9Title"><h2>Explore your network</h2></div><p>The network grows as repeated behaviour supports new traits and connections.</p></div>`;document.body.appendChild(shell);canvas=shell.querySelector('canvas');ctx=canvas.getContext('2d',{alpha:true});detail=shell.querySelector('.vb9Detail');shell.querySelector('.vb9Back').onclick=closeBrain;applyConfig();
    const multi=()=>starts.forEach(v=>v.hadMulti=true);
    canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}const p={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,p);starts.set(e.pointerId,{x:p.x,y:p.y,t:Date.now(),moved:false,hadMulti:pointers.size>1});lastInput=performance.now();if(pointers.size===2){multi();const a=[...pointers.values()];pinch={d:Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)),z:targetZoom}}});
    canvas.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId),st=starts.get(e.pointerId);if(!prev)return;const next={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,next);if(st&&Math.hypot(next.x-st.x,next.y-st.y)>cfg.motion.tapMovePx)st.moved=true;lastInput=performance.now();if(pointers.size===1&&!pinch){targetY+=(next.x-prev.x)*cfg.motion.dragSensitivity;targetX=clamp(targetX+(next.y-prev.y)*cfg.motion.dragSensitivity,-1.18,1.18)}else if(pointers.size>=2){multi();const a=[...pointers.values()],d=Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y));if(!pinch)pinch={d,z:targetZoom};targetZoom=clamp(pinch.z*d/pinch.d,cfg.motion.minZoom,cfg.motion.maxZoom)}});
    const up=e=>{const st=starts.get(e.pointerId),tap=!!st&&!st.moved&&!st.hadMulti&&Date.now()-st.t<320;pointers.delete(e.pointerId);starts.delete(e.pointerId);if(pointers.size<2){pinch=null;starts.forEach(v=>v.hadMulti=true)}lastInput=performance.now();if(tap){const q=projected.map(p=>({...p,d:Math.hypot(p.x-e.clientX,p.y-e.clientY)})).sort((a,b)=>a.d-b.d)[0];if(q&&q.d<Math.max(30,q.r*1.75))showNode(q.n)}};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('lostpointercapture',up);canvas.addEventListener('wheel',e=>{e.preventDefault();lastInput=performance.now();targetZoom=clamp(targetZoom*(e.deltaY>0?.93:1.075),cfg.motion.minZoom,cfg.motion.maxZoom)},{passive:false})
  }
  function openBrain(){readConfig();ensureShell();try{document.getElementById('vBrainV8')?.classList.remove('show')}catch(e){}model=window.VBrain?.model?.();if(!model?.nodes)return;shell.querySelector('.vb9Meta').innerHTML=`${model.nodes.length} nodes<br>${model.edges.length} connections`;basePos=positions(model.nodes);shell.classList.add('show');document.body.style.overflow='hidden';targetX=rotX;targetY=rotY;targetZoom=clamp(zoom,cfg.motion.minZoom,cfg.motion.maxZoom);lastFrame=0;lastInput=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);const best=model.nodes.slice().sort((a,b)=>b.confidence*b.value-a.confidence*a.value)[0];if(best)showNode(best)}
  function closeBrain(){shell?.classList.remove('show');document.body.style.overflow='';pointers.clear();starts.clear();pinch=null;cancelAnimationFrame(raf);raf=0}

  const BLOCK=/(password|passwd|token|secret|auth|credential|cookie|session|bearer|api[_-]?key|otp|pin)/i,timers=new WeakMap(),lastText=new Map();
  const screenOf=el=>el?.closest?.('.screen')?.id||String(window.currentScreen||document.querySelector('.screen.show')?.id||'unknown');
  function fieldMeta(el){const raw=[el?.id,el?.name,el?.dataset?.field,el?.getAttribute?.('aria-label'),el?.getAttribute?.('placeholder')].filter(Boolean).join('|');return{field:safeText(raw||el?.tagName||'field','field',160),screen:screenOf(el),type:String(el?.type||el?.tagName||'').toLowerCase()}}
  function eligible(el){if(!el||!cfg.context.mirrorText)return false;const tag=String(el.tagName||'').toLowerCase(),type=String(el.type||'text').toLowerCase(),m=[el.id,el.name,el.className,el.getAttribute?.('autocomplete'),el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder')].join(' ');if(BLOCK.test(m)||type==='password'||type==='hidden')return false;if(tag==='textarea'||el.isContentEditable)return true;return tag==='input'&&['text','search','url'].includes(type)}
  const valueOf=el=>String(el?.isContentEditable?el.innerText:el?.value??'').slice(0,cfg.context.maxChars);
  function pushText(el,reason){if(!eligible(el)||typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logPrivateActivity!=='function')return;const m=fieldMeta(el),text=valueOf(el),key=m.screen+'|'+m.field;if(lastText.get(key)===text)return;lastText.set(key,text);const payload={kind:'private_text_field',source:'vbrain',at:Date.now(),screen:m.screen,field:m.field,fieldType:m.type,reason:String(reason||'draft'),text};try{if(typeof currentTodoDetailId!=='undefined'&&currentTodoDetailId)payload.taskId=String(currentTodoDetailId)}catch(e){}try{AdaptiveNative.logPrivateActivity(JSON.stringify(payload))}catch(e){}}
  function scheduleText(el,instant,reason){if(!eligible(el))return;const old=timers.get(el);if(old)clearTimeout(old);timers.set(el,setTimeout(()=>pushText(el,reason),instant?0:cfg.context.debounceMs))}
  function installTextMirror(){if(window.__VBRAIN_TEXT_MIRROR_V9__)return;window.__VBRAIN_TEXT_MIRROR_V9__=true;document.addEventListener('input',e=>scheduleText(e.target,false,'draft'),true);document.addEventListener('change',e=>scheduleText(e.target,true,'change'),true);document.addEventListener('focusout',e=>scheduleText(e.target,true,'blur'),true)}

  function interfaceState(){const screens=[...document.querySelectorAll('.screen')].map(x=>({id:x.id||'',visible:x.classList.contains('show')||getComputedStyle(x).display!=='none'})),cards=[...document.querySelectorAll('#homeScreen .homeCard')].map(x=>({kind:['calendar','todos','tube','gym'].find(k=>x.classList.contains(k))||'other',visible:getComputedStyle(x).display!=='none'})),fields=[...document.querySelectorAll('textarea,input[type="text"],input[type="search"],input[type="url"],[contenteditable="true"]')].filter(x=>!BLOCK.test([x.id,x.name,x.className,x.getAttribute('autocomplete')].join(' '))).map(x=>{const m=fieldMeta(x);return{screen:m.screen,field:m.field,type:m.type}}).slice(0,80),m=window.VBrain?.model?.();return{version:VERSION,screens,cards,fields,brain:{nodes:m?.nodes?.length||0,connections:m?.edges?.length||0},control:{motion:cfg.motion,home:cfg.home}}}
  function publishManifest(force=false){if(!cfg.interface.publishManifest||typeof window.homeAdaptiveLog!=='function')return;try{const st=interfaceState(),sig=JSON.stringify(st),prev=localStorage.getItem('vbrainManifestSigV9')||'',last=Number(localStorage.getItem('vbrainManifestAtV9')||0);if(!force&&sig===prev&&Date.now()-last<43200000)return;localStorage.setItem('vbrainManifestSigV9',sig);localStorage.setItem('vbrainManifestAtV9',String(Date.now()));window.homeAdaptiveLog('interface_manifest',st)}catch(e){}}

  function intercept(){if(window.__VBRAIN_SCORE_CAPTURE_V9__)return;window.__VBRAIN_SCORE_CAPTURE_V9__=true;document.addEventListener('click',e=>{const card=e.target?.closest?.('#vbrainScoreV8');if(!card)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openBrain()},true);document.addEventListener('keydown',e=>{const card=e.target?.closest?.('#vbrainScoreV8');if(!card||!['Enter',' '].includes(e.key))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openBrain()},true)}
  function repair(){readConfig();intercept();installTextMirror();applyConfig();publishManifest();document.documentElement.dataset.vbrainLive='9'}
  window.VBrainLive={version:VERSION,openBrain,closeBrain,getControl:()=>JSON.parse(JSON.stringify(cfg)),getInterfaceState:interfaceState,refresh:async()=>{try{await window.HOMEAdaptive?.refresh?.()}catch(e){}repair();return cfg}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else{repair();if(shell?.classList.contains('show')){lastFrame=0;raf=requestAnimationFrame(draw)}}});
  repair();setTimeout(repair,700);setTimeout(()=>{repair();publishManifest(true)},2400);setInterval(repair,10000);
  setInterval(async()=>{if(document.hidden)return;try{await window.HOMEAdaptive?.refresh?.()}catch(e){}repair()},600000);
})();
