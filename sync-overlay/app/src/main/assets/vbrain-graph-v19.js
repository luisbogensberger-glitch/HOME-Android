/* V-Brain Graph v19 — append-only, collision-safe, scalable persistent 3D brain. */
(function(){
  'use strict';
  if(window.__VBRAIN_GRAPH_V19__)return;window.__VBRAIN_GRAPH_V19__=true;
  const VERSION=19,GRAPH='vbrainGraphV19',BRANCH='vbrainBranchesV19',LEGACY=['homeLivingGraphV8','homeLivingGraphV6'],RENDER_LIMIT=700;
  const baseModel=typeof window.VBrain?.model==='function'?window.VBrain.model.bind(window.VBrain):()=>({nodes:[],edges:[],e:{}});
  const parse=(raw,f)=>{try{return raw?JSON.parse(raw)??f:f}catch(_){return f}};
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
  const edgeKey=(a,b)=>[String(a),String(b)].sort().join('::');
  const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9äöüß]+/gi,' ').trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}};
  let shell,canvas,ctx,detail,currentAll,current,positionsCache={},raf=0,lastFrame=0,lastInput=0,rotX=.20,rotY=-.45,targetX=.20,targetY=-.45,zoom=1,targetZoom=1,pinch=null,query='',focusId='',cachedModel=null;
  let statCache={nodes:0,edges:0,renderLimit:RENDER_LIMIT,updatedAt:0};
  const pointers=new Map(),starts=new Map();
  const palette={action:'#f1ca62',attention:'#8fb2ff',growth:'#bba0ff',health:'#79d2ac',stability:'#83a6c8',structure:'#8bd0df',rhythm:'#e6a66e',friction:'#df8d80',custom:'#9fd0ff'};

  function load(k,f){
    let raw='';
    try{raw=localStorage.getItem(k)||'';if(raw)return parse(raw,f)}catch(_){}
    try{raw=Native?.loadState?.(k)||'';if(raw){try{localStorage.setItem(k,raw)}catch(_){}return parse(raw,f)}}catch(_){}
    try{raw=localStorage.getItem(k+':backup')||'';if(raw)return parse(raw,f)}catch(_){}
    try{raw=Native?.loadState?.(k+':backup')||'';if(raw)return parse(raw,f)}catch(_){}
    return f;
  }
  function save(k,v){
    const raw=JSON.stringify(v);let old='';
    try{old=localStorage.getItem(k)||'';if(old&&old!==raw)localStorage.setItem(k+':backup',old);localStorage.setItem(k,raw)}catch(_){}
    try{if(old&&old!==raw)Native?.saveState?.(k+':backup',old);Native?.saveState?.(k,raw)}catch(_){}
    return raw;
  }
  function localGraphStats(){
    try{const g=parse(localStorage.getItem(GRAPH)||'',null);if(g?.nodes){return{nodes:Object.keys(g.nodes).length,edges:Object.keys(g.edges||{}).length,renderLimit:RENDER_LIMIT,updatedAt:Number(g.updatedAt||0)}}}catch(_){}
    try{const b=parse(localStorage.getItem(BRANCH)||'',null);if(b?.nodes){return{nodes:Object.keys(b.nodes).length,edges:Object.keys(b.edges||{}).length,renderLimit:RENDER_LIMIT,updatedAt:0}}}catch(_){}
    return{nodes:0,edges:0,renderLimit:RENDER_LIMIT,updatedAt:0};
  }
  statCache=localGraphStats();
  function branchStore(){const s=load(BRANCH,{nodes:{},edges:{}});if(!s.nodes)s.nodes={};if(!s.edges)s.edges={};return s}
  function identity(n){return norm(n?.label||n?.description||n?.id||'')}
  function safeId(store,requested,raw){
    let id=String(requested||'').trim();if(!id)id='branch-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    const old=store.nodes[id];if(!old||identity(old)===identity(raw)||raw?.mergeExisting===true)return id;
    let i=2,next='';do{next=id+'~'+i++}while(store.nodes[next]);log('brain_branch_collision',{requested:id,assigned:next});return next;
  }
  function invalidate(){cachedModel=null;positionsCache={}}
  function updateBranchStats(s){statCache={nodes:Math.max(statCache.nodes,Object.keys(s.nodes||{}).length),edges:Math.max(statCache.edges,Object.keys(s.edges||{}).length),renderLimit:RENDER_LIMIT,updatedAt:Date.now()}}
  function registerBranch(parent,node){
    const s=branchStore(),parents=(Array.isArray(parent)?parent:[parent]).filter(Boolean).map(String),raw=node&&typeof node==='object'?{...node}:{label:String(node||'New branch')};
    const id=safeId(s,raw.id,raw),old=s.nodes[id]||{};delete raw.mergeExisting;
    s.nodes[id]={...old,...raw,id,label:String(raw.label||old.label||id),group:String(raw.group||old.group||'custom'),value:clamp(raw.value??old.value??50),confidence:clamp(raw.confidence??old.confidence??25),evidenceCount:Number(raw.evidenceCount??old.evidenceCount??0),description:String(raw.description||old.description||'A persistent V-Brain branch.'),reasons:Array.isArray(raw.reasons)?raw.reasons:(old.reasons||[]),emergent:true,pinned:true,parentIds:[...new Set([...(old.parentIds||[]),...parents])],firstSeen:old.firstSeen||Date.now(),lastSeen:Date.now()};
    for(const p of parents){const k=edgeKey(p,id);s.edges[k]={...(s.edges[k]||{}),a:p,b:id,w:clamp(raw.weight??s.edges[k]?.w??55,8,100),why:String(raw.why||s.edges[k]?.why||'Persistent branch connection.'),pinned:true,firstSeen:s.edges[k]?.firstSeen||Date.now(),lastSeen:Date.now()}}
    save(BRANCH,s);updateBranchStats(s);invalidate();log('brain_branch_added',{id,parents});return id;
  }
  function registerEdge(a,b,w=50,why='Persistent connection.'){
    if(!a||!b||String(a)===String(b))return false;const s=branchStore(),k=edgeKey(a,b);s.edges[k]={...(s.edges[k]||{}),a:String(a),b:String(b),w:clamp(w,8,100),why:String(why||''),pinned:true,firstSeen:s.edges[k]?.firstSeen||Date.now(),lastSeen:Date.now()};save(BRANCH,s);updateBranchStats(s);invalidate();return true;
  }
  function importLegacy(store){
    if(store.legacyImported)return store;
    for(const k of LEGACY){const g=load(k,null);if(!g)continue;for(const [id,n] of Object.entries(g.nodes||{})){if(!store.nodes[id])store.nodes[id]={...n,id,active:false,historical:true,source:k}}for(const e of Array.isArray(g.edges)?g.edges:[]){if(!e?.a||!e?.b)continue;const ek=edgeKey(e.a,e.b);if(!store.edges[ek])store.edges[ek]={...e,active:false,historical:true,source:k}}}
    store.legacyImported=true;return store;
  }
  function persistentModel(force=false){
    if(cachedModel&&!force)return cachedModel;
    let base={nodes:[],edges:[],e:{}};try{base=baseModel()||base}catch(_){}
    const custom=branchStore(),now=Date.now();let store=importLegacy(load(GRAPH,{schema:VERSION,nodes:{},edges:{},history:[]}));store.nodes=store.nodes||{};store.edges=store.edges||{};
    const active=new Set();
    for(const n of [...(base.nodes||[]),...Object.values(custom.nodes||{})]){if(!n?.id)continue;const id=String(n.id),prev=store.nodes[id]||{};active.add(id);store.nodes[id]={...prev,...n,id,active:true,historical:false,firstSeen:prev.firstSeen||n.firstSeen||now,lastSeen:now,maxValue:Math.max(Number(prev.maxValue||0),Number(n.value||0)),maxConfidence:Math.max(Number(prev.maxConfidence||0),Number(n.confidence||0))}}
    for(const [id,n] of Object.entries(store.nodes)){if(!active.has(id)&&!n.pinned)store.nodes[id]={...n,active:false,historical:true}}
    const activeEdges=new Set();
    for(const e of [...(base.edges||[]),...Object.values(custom.edges||{})]){if(!e?.a||!e?.b||String(e.a)===String(e.b))continue;const k=edgeKey(e.a,e.b),prev=store.edges[k]||{};activeEdges.add(k);store.edges[k]={...prev,...e,active:true,historical:false,firstSeen:prev.firstSeen||e.firstSeen||now,lastSeen:now}}
    for(const [k,e] of Object.entries(store.edges)){if(!activeEdges.has(k)&&!e.pinned)store.edges[k]={...e,active:false,historical:true}}
    const nodes=Object.values(store.nodes).sort((a,b)=>(b.active===true)-(a.active===true)||(Number(a.firstSeen||0)-Number(b.firstSeen||0))),ids=new Set(nodes.map(n=>String(n.id)));
    const edges=Object.values(store.edges).filter(e=>ids.has(String(e.a))&&ids.has(String(e.b)));
    const h=Array.isArray(store.history)?store.history:[];if(!h.length||now-Number(h[h.length-1]?.at||0)>21600000)h.push({at:now,nodes:nodes.length,active:[...active].length,edges:edges.length});while(h.length>365)h.shift();
    store={...store,schema:VERSION,updatedAt:now,nodes:Object.fromEntries(nodes.map(n=>[String(n.id),n])),edges:Object.fromEntries(edges.map(e=>[edgeKey(e.a,e.b),e])),history:h};save(GRAPH,store);
    statCache={nodes:nodes.length,edges:edges.length,renderLimit:RENDER_LIMIT,updatedAt:now};cachedModel={e:base.e||{},nodes,edges,graph:store};return cachedModel;
  }
  function cheapStats(){return{...statCache}}
  function visibleModel(model){
    const all=model.nodes||[],edges=model.edges||[];if(all.length<=RENDER_LIMIT&&!query&&!focusId)return model;
    const byId=new Map(all.map(n=>[String(n.id),n])),selected=new Set();
    if(query){const q=norm(query);for(const n of all){if(norm(n.label).includes(q)||norm(n.id).includes(q)||norm(n.description).includes(q))selected.add(String(n.id));if(selected.size>=RENDER_LIMIT)break}}
    if(focusId){selected.add(String(focusId));let frontier=[String(focusId)];for(let depth=0;depth<3&&frontier.length&&selected.size<RENDER_LIMIT;depth++){const next=[];const front=new Set(frontier);for(const e of edges){if(front.has(String(e.a))&&!selected.has(String(e.b))){selected.add(String(e.b));next.push(String(e.b))}if(front.has(String(e.b))&&!selected.has(String(e.a))){selected.add(String(e.a));next.push(String(e.a))}if(selected.size>=RENDER_LIMIT)break}frontier=next}}
    if(selected.size){for(const e of edges){if(selected.has(String(e.a))||selected.has(String(e.b))){selected.add(String(e.a));selected.add(String(e.b));if(selected.size>=RENDER_LIMIT)break}}}
    if(!selected.size){const ranked=all.slice().sort((a,b)=>Number(b.active===true)-Number(a.active===true)||Number(b.confidence||0)*Number(b.value||0)-Number(a.confidence||0)*Number(a.value||0)||Number(b.lastSeen||0)-Number(a.lastSeen||0));for(const n of ranked.slice(0,RENDER_LIMIT))selected.add(String(n.id))}
    const nodes=[...selected].slice(0,RENDER_LIMIT).map(id=>byId.get(id)).filter(Boolean),ids=new Set(nodes.map(n=>String(n.id)));return{...model,nodes,edges:edges.filter(e=>ids.has(String(e.a))&&ids.has(String(e.b)))};
  }
  function style(){
    if(document.getElementById('vBrainGraphV19Style'))return;const s=document.createElement('style');s.id='vBrainGraphV19Style';s.textContent=`
#vBrainV19{position:fixed;inset:0;z-index:2147483450;background:linear-gradient(180deg,#07090d,#0a0d13 62%,#080a0e);color:#fff;display:none;overflow:hidden;pointer-events:none}#vBrainV19.show{display:block;pointer-events:auto}#vBrainV19 canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}.vb19Top{position:absolute;z-index:7;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:max(15px,env(safe-area-inset-top)) 14px 10px;background:linear-gradient(180deg,rgba(7,9,13,.98),rgba(7,9,13,.72),transparent)}.vb19Back{width:42px;height:42px;flex:0 0 42px;border-radius:50%;border:1px solid rgba(255,255,255,.11);background:#151922;color:#fff;font-size:27px}.vb19Head{min-width:0}.vb19Top small{display:block;font-size:8px;letter-spacing:.16em;color:rgba(255,255,255,.46);font-weight:900}.vb19Top h1{margin:1px 0 0;font-size:19px}.vb19Meta{margin-left:auto;text-align:right;font-size:8px;color:rgba(255,255,255,.48);line-height:1.4}.vb19Search{position:absolute;z-index:7;top:max(70px,calc(env(safe-area-inset-top) + 58px));left:14px;right:14px;display:flex;gap:8px}.vb19Search input{min-width:0;flex:1;height:38px;border-radius:15px;border:1px solid rgba(255,255,255,.10);background:rgba(15,18,25,.90);color:#fff;padding:0 13px;outline:none}.vb19Search button{height:38px;border-radius:15px;border:1px solid rgba(255,255,255,.10);background:#151922;color:#fff;padding:0 12px}.vb19Hint{position:absolute;z-index:5;left:50%;top:max(116px,calc(env(safe-area-inset-top) + 104px));transform:translateX(-50%);font-size:8px;letter-spacing:.09em;color:rgba(255,255,255,.36);white-space:nowrap}.vb19Detail{position:absolute;z-index:6;left:14px;right:14px;bottom:max(14px,env(safe-area-inset-bottom));padding:15px 16px 16px;border-radius:24px;border:1px solid rgba(255,255,255,.10);background:rgba(15,18,25,.90);backdrop-filter:blur(24px);max-height:35vh;overflow:auto}.vb19Tag{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:#f0c95d;font-weight:900}.vb19Title{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.vb19Title h2{font-size:21px;margin:4px 0}.vb19Title b{font-size:28px}.vb19Detail p{font-size:11px;line-height:1.48;color:rgba(255,255,255,.64);margin:5px 0}.vb19Reason{display:inline-block;padding:6px 8px;margin:4px 4px 0 0;border:1px solid rgba(255,255,255,.08);border-radius:999px;font-size:9px;color:rgba(255,255,255,.58)}.vb19Actions{display:flex;gap:8px;margin-top:10px}.vb19Actions button{border:1px solid rgba(255,255,255,.10);background:#171b24;color:#fff;border-radius:12px;padding:8px 10px;font-size:9px}`;document.head.appendChild(s);
  }
  function seeded(id){let h=2166136261;for(const ch of String(id)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return()=>((h=Math.imul(h^h>>>15,2246822519))>>>0)/4294967295}
  function pos(nodes){const sig=nodes.map(n=>n.id).join('|');if(positionsCache.sig===sig)return positionsCache.map;const out={},N=Math.max(1,nodes.length);nodes.forEach((n,i)=>{const r=seeded(n.id),phi=Math.acos(1-2*(i+.5)/N),theta=Math.PI*(1+Math.sqrt(5))*i+(r()-.5)*.55,rad=.70+(r()-.5)*.22;out[n.id]={x:Math.sin(phi)*Math.cos(theta)*rad,y:Math.cos(phi)*rad,z:Math.sin(phi)*Math.sin(theta)*rad}});positionsCache={sig,map:out};return out}
  function rotate(p){const cy=Math.cos(rotY),sy=Math.sin(rotY),cx=Math.cos(rotX),sx=Math.sin(rotX),x1=p.x*cy-p.z*sy,z1=p.x*sy+p.z*cy,y1=p.y*cx-z1*sx,z2=p.y*sx+z1*cx;return{x:x1,y:y1,z:z2}}
  let projected=[];
  function draw(ts){
    if(!shell?.classList.contains('show'))return;const t=Number(ts)||performance.now(),step=lastFrame?Math.max(.25,Math.min(2.4,(t-lastFrame)/16.667)):1;lastFrame=t;if(!pointers.size&&t-lastInput>2600)targetY+=.00020*step;rotX+=(targetX-rotX)*.18;rotY+=(targetY-rotY)*.18;zoom+=(targetZoom-zoom)*.16;
    const dpr=Math.min(2,devicePixelRatio||1),w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h){raf=requestAnimationFrame(draw);return}const W=Math.floor(w*dpr),H=Math.floor(h*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const P=pos(current.nodes),cx=w/2,cy=h*.47,scale=Math.min(w,h)*.40*zoom;projected=current.nodes.map(n=>{const p=rotate(P[n.id]||{x:0,y:0,z:0}),pers=1/(1.55-p.z*.58);return{n,p,x:cx+p.x*scale*pers,y:cy+p.y*scale*pers,r:(8+Number(n.confidence||0)*.075)*pers}});const by=Object.fromEntries(projected.map(q=>[q.n.id,q]));
    for(const e of current.edges){const a=by[e.a],b=by[e.b];if(!a||!b)continue;ctx.globalAlpha=e.active===false?.15:.55;ctx.strokeStyle='rgba(145,165,235,.8)';ctx.lineWidth=.55+Number(e.w||40)/90;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.globalAlpha=1;
    const ordered=projected.slice().sort((a,b)=>a.p.z-b.p.z);for(const q of ordered){const n=q.n,col=palette[n.group]||palette.custom,active=n.active!==false;ctx.globalAlpha=active?.92:.28;ctx.shadowBlur=active&&n.emergent?15:active?7:0;ctx.shadowColor=col;ctx.fillStyle='#101620';ctx.strokeStyle=col;ctx.lineWidth=n.emergent?1.8:1.15;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1}
    const occupied=[];for(const q of ordered.slice().reverse()){const n=q.n;if(n.active===false)continue;const text=String(n.label||n.id),fontSize=Math.max(8,Math.min(11,q.r*.62));ctx.font=`${fontSize}px system-ui`;const width=Math.min(w*.42,ctx.measureText(text).width+10),x=q.x,y=q.y-q.r-7,box={l:x-width/2,r:x+width/2,t:y-fontSize-2,b:y+3};if(box.l<4||box.r>w-4||box.t<105||box.b>h*.69)continue;if(occupied.some(o=>!(box.r+5<o.l||box.l-5>o.r||box.b+3<o.t||box.t-3>o.b)))continue;occupied.push(box);ctx.globalAlpha=n.emergent?1:.88;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(text,x,y);ctx.globalAlpha=1}
    raf=requestAnimationFrame(draw);
  }
  function refreshView(){current=visibleModel(currentAll||persistentModel());positionsCache={};const m=shell?.querySelector('.vb19Meta');if(m)m.innerHTML=`${currentAll.nodes.length} branches<br>${current.nodes.length===currentAll.nodes.length?'all visible':current.nodes.length+' shown'}`;lastFrame=0}
  function show(n){
    if(!n||!detail)return;const by=new Map((currentAll?.nodes||[]).map(x=>[String(x.id),x])),linked=(currentAll?.edges||[]).filter(e=>String(e.a)===String(n.id)||String(e.b)===String(n.id)).map(e=>by.get(String(String(e.a)===String(n.id)?e.b:e.a))?.label).filter(Boolean),state=n.active===false?'Historical branch':n.emergent?'Discovered branch':'Active signal';
    detail.innerHTML=`<div class="vb19Tag">${esc(state)} · ${Math.round(Number(n.confidence||0))}% confidence · ${Number(n.evidenceCount||0)} signals</div><div class="vb19Title"><h2>${esc(n.label||n.id)}</h2><b>${Math.round(Number(n.value||0))}</b></div><p>${esc(n.description||'Persistent V-Brain branch.')}</p>${n.active===false?'<p>This branch is currently quiet, but it remains part of your history and will not be deleted automatically.</p>':''}${linked.length?`<p><b>Connected with:</b> ${esc(linked.slice(0,12).join(', '))}</p>`:''}<div>${(n.reasons||[]).map(x=>`<span class="vb19Reason">${esc(x)}</span>`).join('')}</div><div class="vb19Actions"><button data-act="focus">Focus branch</button><button data-act="all">Show overview</button></div>`;
    detail.querySelector('[data-act="focus"]').onclick=()=>{focusId=String(n.id);query='';const i=shell.querySelector('.vb19Search input');if(i)i.value='';refreshView()};detail.querySelector('[data-act="all"]').onclick=()=>{focusId='';query='';const i=shell.querySelector('.vb19Search input');if(i)i.value='';refreshView()};
  }
  function ensureShell(){
    if(shell)return;style();shell=document.createElement('section');shell.id='vBrainV19';shell.innerHTML=`<div class="vb19Top"><button class="vb19Back" type="button">‹</button><div class="vb19Head"><small>V-BRAIN · PERSISTENT MODEL</small><h1>Living brain</h1></div><div class="vb19Meta"></div></div><div class="vb19Search"><input type="search" placeholder="Find any branch…" autocomplete="off"><button type="button">Overview</button></div><div class="vb19Hint">drag to rotate · pinch to zoom · branches persist permanently</div><canvas></canvas><div class="vb19Detail"><div class="vb19Tag">Persistent graph</div><div class="vb19Title"><h2>Explore your network</h2></div><p>New branches and links can keep growing. Earlier branches remain stored even when a signal becomes quiet.</p></div>`;document.body.appendChild(shell);canvas=shell.querySelector('canvas');ctx=canvas.getContext('2d',{alpha:true});detail=shell.querySelector('.vb19Detail');shell.querySelector('.vb19Back').onclick=close;
    const search=shell.querySelector('.vb19Search input');search.addEventListener('input',()=>{query=search.value;focusId='';refreshView()});shell.querySelector('.vb19Search button').onclick=()=>{query='';focusId='';search.value='';refreshView()};
    canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}const p={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,p);starts.set(e.pointerId,{...p,t:Date.now(),moved:false,multi:pointers.size>1});lastInput=performance.now();if(pointers.size===2){const a=[...pointers.values()];pinch={d:Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)),z:targetZoom}}});
    canvas.addEventListener('pointermove',e=>{const prev=pointers.get(e.pointerId),st=starts.get(e.pointerId);if(!prev)return;const next={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,next);if(st&&Math.hypot(next.x-st.x,next.y-st.y)>10)st.moved=true;lastInput=performance.now();if(pointers.size===1&&!pinch){targetY+=(next.x-prev.x)*.0045;targetX=Math.max(-1.18,Math.min(1.18,targetX+(next.y-prev.y)*.0045))}else if(pointers.size>=2){for(const s of starts.values())s.multi=true;const a=[...pointers.values()],d=Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y));if(!pinch)pinch={d,z:targetZoom};targetZoom=Math.max(.62,Math.min(2.5,pinch.z*d/pinch.d))}});
    const up=e=>{const st=starts.get(e.pointerId),tap=st&&!st.moved&&!st.multi&&Date.now()-st.t<330;pointers.delete(e.pointerId);starts.delete(e.pointerId);if(pointers.size<2)pinch=null;if(tap){const q=projected.map(x=>({...x,d:Math.hypot(x.x-e.clientX,x.y-e.clientY)})).sort((a,b)=>a.d-b.d)[0];if(q&&q.d<Math.max(30,q.r*1.9))show(q.n)}};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  }
  function open(){ensureShell();try{document.getElementById('vBrainV8')?.classList.remove('show')}catch(_){}currentAll=persistentModel(true);refreshView();shell.classList.add('show');document.body.style.overflow='hidden';lastFrame=0;lastInput=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);const best=current.nodes.filter(n=>n.active!==false).sort((a,b)=>Number(b.confidence||0)*Number(b.value||0)-Number(a.confidence||0)*Number(a.value||0))[0]||current.nodes[0];if(best)show(best);log('brain_open_v19',{nodes:currentAll.nodes.length,shown:current.nodes.length,edges:currentAll.edges.length})}
  function close(){shell?.classList.remove('show');document.body.style.overflow='';pointers.clear();starts.clear();pinch=null;cancelAnimationFrame(raf);raf=0}
  function searchBranches(q){const m=cachedModel||persistentModel(),needle=norm(q);return m.nodes.filter(n=>!needle||norm(n.label).includes(needle)||norm(n.id).includes(needle)||norm(n.description).includes(needle))}
  function intercept(){if(window.__VBRAIN_GRAPH_CAPTURE_V19__)return;window.__VBRAIN_GRAPH_CAPTURE_V19__=true;document.addEventListener('click',e=>{if(!e.target?.closest?.('#vbrainScoreV8'))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open()},true)}
  const oldBack=window.handleAndroidBack;window.handleAndroidBack=function(){if(shell?.classList.contains('show')){close();return'handled'}return oldBack?oldBack():'home'};
  function warm(){try{persistentModel(true);log('brain_graph_warm',{version:VERSION,...cheapStats()})}catch(e){log('brain_graph_warm_failed',{error:String(e?.message||e)})}}
  intercept();
  if(window.VBrain){window.VBrain.model=persistentModel;window.VBrain.openBrain=open;window.VBrain.branch=registerBranch;window.VBrain.link=registerEdge;window.VBrain.graphVersion=VERSION}
  window.VBrainGraph={version:VERSION,model:persistentModel,branch:registerBranch,link:registerEdge,search:searchBranches,open,close,stats:cheapStats,refresh:()=>persistentModel(true)};
  document.documentElement.dataset.vbrainGraph=String(VERSION);log('brain_graph_ready',{version:VERSION,...cheapStats()});
  if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:5000});else setTimeout(warm,3200);
})();
