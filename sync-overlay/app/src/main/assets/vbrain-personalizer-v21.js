/* V-Brain Personalizer v21 — private semantic context + bounded evidence-aware UI adaptation. */
(function(){
  'use strict';
  if(window.__VBRAIN_PERSONALIZER_V21__)return;window.__VBRAIN_PERSONALIZER_V21__=true;

  const VERSION=21,DAY=86400000,CTX_KEY='vbrainBrainContext',PROFILE_KEY='vbrainPersonalizationProfileV21',DECISION_KEY='vbrainUiDecisionV21';
  const ROUTES=['calendar','todos','tube','gym'];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const safe=(v,n=500)=>String(v??'').trim().slice(0,n);
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch(_){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const merge=(a,b)=>{const o=clone(a);if(!b||typeof b!=='object'||Array.isArray(b))return o;for(const k of Object.keys(b)){if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])&&b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k]))o[k]=merge(o[k],b[k]);else o[k]=b[k]}return o};
  let lastSignature='',lastContextSignature='';

  function nativeState(key){try{return typeof Native!=='undefined'&&Native.loadState?String(Native.loadState(key)||''):''}catch(_){return''}}
  function context(){
    let raw=nativeState(CTX_KEY),box={};try{box=raw?JSON.parse(raw):{}}catch(_){box={}}
    const items=Array.isArray(box.items)?box.items.slice(0,120):[];
    return{schema:Number(box.schema)||1,generatedAt:safe(box.generatedAt,80),items:items.map(x=>({key:safe(x?.key,180),kind:safe(x?.kind,40),statement:safe(x?.statement,1200),value:x?.value&&typeof x.value==='object'?x.value:{},confidence:clamp(x?.confidence,0,1),evidenceCount:Math.max(0,Number(x?.evidence_count??x?.evidenceCount)||0)})).filter(x=>x.key&&x.statement)};
  }
  function activities(){
    try{const rows=window.HOMEAdaptive?.activity?.();if(Array.isArray(rows))return rows}catch(_){}
    const rows=load('homeAdaptiveActivityV1',[]);return Array.isArray(rows)?rows:[];
  }
  function remotePrivatePatch(){let x={};try{x=JSON.parse(nativeState('vbrainPrivatePatch')||'{}')}catch(_){}return x&&typeof x==='object'?x:{}}
  function recencyWeight(at){const age=Math.max(0,Date.now()-Number(at||0));return Math.max(.18,1-age/(21*DAY))}
  function routeFromRow(r){const type=String(r?.type||r?.kind||''),d=r?.data||{};if(type==='screen_open'||type==='screen_dwell')return ROUTES.includes(String(d.name))?String(d.name):'';if(type.startsWith('todo_'))return'todos';if(type.startsWith('tube_'))return'tube';if(type.startsWith('gym_'))return'gym';if(type.startsWith('calendar_'))return'calendar';return''}
  function buildProfile(ctx){
    const rows=activities().filter(x=>Date.now()-Number(x?.at||0)<21*DAY),scores={calendar:1,todos:1,tube:1,gym:1},evidence={calendar:0,todos:0,tube:0,gym:0};
    for(const r of rows){const route=routeFromRow(r);if(!route)continue;const type=String(r?.type||r?.kind||''),w=recencyWeight(r.at);let add=.35;if(type==='screen_open')add=.55;if(type==='screen_dwell')add=Math.min(2.2,Math.log1p(Math.max(0,Number(r?.data?.ms||0))/30000)*.8);if(/_complete$/.test(type))add=2.4;if(/_start$/.test(type)||/_open$/.test(type))add=Math.max(add,.75);scores[route]+=add*w;evidence[route]++;}
    for(const item of ctx.items){if(item.kind==='goal'&&/wissen|lern|knowledge|intelligen|learning/i.test(item.statement+' '+item.key))scores.tube+=2.8*item.confidence;if(item.kind==='future_signal'&&/movement|beweg|training/i.test(item.statement+' '+item.key))scores.gym+=.5*item.confidence;}
    const ordered=ROUTES.slice().sort((a,b)=>scores[b]-scores[a]||ROUTES.indexOf(a)-ROUTES.indexOf(b));
    const total=Object.values(evidence).reduce((a,b)=>a+b,0),confidence=clamp((total/28)*.72+(ctx.items.length/12)*.28,0,1);
    return{version:VERSION,at:Date.now(),windowDays:21,scores,evidence,totalEvents:rows.length,ordered,confidence,contextCount:ctx.items.length};
  }
  function explicitRemoteLayout(){const p=remotePrivatePatch();return p?.remoteUI?.enabled===true||p?.vbrainPatch?.home?.orderMode==='fixed'||Array.isArray(p?.vbrainPatch?.home?.order)}
  function buildDecision(profile,ctx){
    const evidenceEnough=profile.totalEvents>=6||ctx.items.length>=2;
    const order=evidenceEnough?profile.ordered:['calendar','todos','tube','gym'];
    const top=order[0],topScore=profile.scores[top]||0,second=profile.scores[order[1]]||0,margin=topScore-second;
    const learnedGoal=ctx.items.find(x=>x.kind==='goal'&&/wissen|lern|knowledge|intelligen|learning/i.test(x.statement+' '+x.key));
    const hint=learnedGoal?'goals + behaviour shape this network':'behaviour + private context shape this network';
    const patch={brain:{hint},motion:{cardMs:Math.round(130+40*(1-profile.confidence)),pressScale:.985}};
    if(!explicitRemoteLayout()&&evidenceEnough)patch.home={orderMode:'fixed',order,visible:{calendar:true,todos:true,tube:true,gym:true},gap:14,scale:1};
    return{version:VERSION,at:Date.now(),order,top,margin:Number(margin.toFixed(2)),confidence:Number(profile.confidence.toFixed(3)),contextCount:ctx.items.length,evidenceCount:Object.values(profile.evidence).reduce((a,b)=>a+b,0),patch,remoteLayoutDeferred:explicitRemoteLayout()};
  }
  function logDecision(d){try{if(typeof AdaptiveNative!=='undefined'&&AdaptiveNative.logActivity)AdaptiveNative.logActivity(JSON.stringify({id:'p21-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),kind:'behavior_ui_decision',type:'behavior_ui_decision',at:Date.now(),screen:String(window.currentScreen||'home'),source:'vbrain-personalizer-v21',data:{version:VERSION,order:d.order,top:d.top,margin:d.margin,confidence:d.confidence,contextCount:d.contextCount,evidenceCount:d.evidenceCount,remoteLayoutDeferred:d.remoteLayoutDeferred}}))}catch(_){} }
  function applyDecision(d){
    const cfg=window.HOMEAdaptive?.config;if(!cfg)return false;
    cfg.vbrainPatch=merge(cfg.vbrainPatch||{},d.patch);try{window.VBrainPatch?.apply?.()}catch(_){}
    const sig=JSON.stringify({order:d.order,patch:d.patch,remote:d.remoteLayoutDeferred,confidence:Math.round(d.confidence*20)});if(sig!==lastSignature){lastSignature=sig;save(DECISION_KEY,d);logDecision(d)}return true;
  }
  function text(el,value){if(el)el.textContent=value}
  function ensureStyle(){if(document.getElementById('vb21Style'))return;const s=document.createElement('style');s.id='vb21Style';s.textContent=`
    #vb21ContextBtn{margin-left:auto;border:1px solid rgba(255,255,255,.12);background:rgba(19,24,33,.82);color:rgba(255,255,255,.76);border-radius:999px;min-height:38px;padding:0 12px;font:800 8px system-ui;letter-spacing:.13em;white-space:nowrap}
    #vBrainV8 .vb8BrainMeta{margin-left:0}
    #vb21ContextPanel{position:absolute;z-index:7;left:12px;right:12px;top:max(76px,calc(env(safe-area-inset-top) + 66px));max-height:62vh;overflow:auto;display:none;padding:16px;border:1px solid rgba(255,255,255,.11);border-radius:24px;background:rgba(12,16,23,.95);backdrop-filter:blur(24px);box-shadow:0 28px 80px rgba(0,0,0,.48)}
    #vb21ContextPanel.show{display:block}.vb21Head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.vb21Head small{font:900 8px system-ui;letter-spacing:.16em;color:#f0c95d}.vb21Head button{border:0;background:transparent;color:#fff;font-size:24px}.vb21Item{padding:11px 0;border-top:1px solid rgba(255,255,255,.075)}.vb21Item:first-of-type{border-top:0}.vb21Kind{font:800 8px system-ui;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.42)}.vb21Statement{margin-top:5px;font:500 11px/1.5 system-ui;color:rgba(255,255,255,.82)}.vb21Meta{margin-top:5px;font:500 8px system-ui;color:rgba(255,255,255,.35)}.vb21Empty{font:500 11px/1.5 system-ui;color:rgba(255,255,255,.55)}
  `;document.head.appendChild(s)}
  function renderContext(ctx){
    const brain=document.getElementById('vBrainV8'),top=brain?.querySelector('.vb8BrainTop');if(!brain||!top)return false;ensureStyle();let btn=document.getElementById('vb21ContextBtn');if(!btn){btn=document.createElement('button');btn.id='vb21ContextBtn';btn.type='button';top.insertBefore(btn,top.querySelector('.vb8BrainMeta')||null)}let panel=document.getElementById('vb21ContextPanel');if(!panel){panel=document.createElement('section');panel.id='vb21ContextPanel';panel.innerHTML='<div class="vb21Head"><small>V-BRAIN · PRIVATE CONTEXT</small><button type="button" aria-label="Close">×</button></div><div class="vb21List"></div>';brain.appendChild(panel);panel.querySelector('button').onclick=()=>panel.classList.remove('show');btn.onclick=()=>panel.classList.toggle('show')}
    text(btn,`CONTEXT · ${ctx.items.length}`);const list=panel.querySelector('.vb21List');list.innerHTML='';if(!ctx.items.length){const e=document.createElement('div');e.className='vb21Empty';e.textContent='No synchronized semantic context yet. Behaviour learning continues locally.';list.appendChild(e);return true}
    for(const item of ctx.items){const row=document.createElement('article');row.className='vb21Item';const kind=document.createElement('div');kind.className='vb21Kind';kind.textContent=item.kind;const st=document.createElement('div');st.className='vb21Statement';st.textContent=item.statement;const meta=document.createElement('div');meta.className='vb21Meta';meta.textContent=`${Math.round(item.confidence*100)}% confidence · ${item.evidenceCount} evidence`;row.append(kind,st,meta);list.appendChild(row)}return true;
  }
  function refresh(){const ctx=context(),profile=buildProfile(ctx),decision=buildDecision(profile,ctx);save(PROFILE_KEY,profile);applyDecision(decision);renderContext(ctx);const cs=JSON.stringify(ctx.items.map(x=>[x.key,x.confidence,x.evidenceCount]));if(cs!==lastContextSignature){lastContextSignature=cs;try{window.homeAdaptiveLog?.('brain_context_loaded',{version:VERSION,count:ctx.items.length})}catch(_){}}return{context:ctx,profile,decision}}

  window.VBrainPersonalizer={version:VERSION,refresh,context,profile:()=>load(PROFILE_KEY,{}),decision:()=>load(DECISION_KEY,{})};
  setTimeout(refresh,1800);setTimeout(refresh,4200);setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refresh,500)});
})();
