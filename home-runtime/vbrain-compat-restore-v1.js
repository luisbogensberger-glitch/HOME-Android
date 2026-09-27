/* V-Brain compatibility restore v1 — restores V8 score/UI and persistent v19 traits on older live documents. */
(function(){
  'use strict';
  if(window.__VBRAIN_COMPAT_RESTORE_V1__)return;window.__VBRAIN_COMPAT_RESTORE_V1__=true;
  const VERSION=1;
  const ASSET='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/sync-overlay/app/src/main/assets/';
  const log=(kind,data)=>{try{window.homeAdaptiveLog?.(kind,data||{})}catch(_){}};
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch(_){return f}};
  async function runAsset(name){
    const r=await fetch(ASSET+name+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(name+' HTTP '+r.status);
    new Function((await r.text())+'\n//# sourceURL='+name)();
  }
  function ensureReminder(){
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return false;
    let b=document.getElementById('vbrainCompatReminderV1');
    if(!b){
      const s=document.createElement('style');s.id='vbrainCompatReminderStyleV1';s.textContent=`
#vbrainCompatReminderV1{grid-column:1/-1;width:100%;min-height:116px;padding:18px 19px;border:1px solid rgba(255,209,113,.30);border-radius:27px;color:#fff;text-align:left;background:radial-gradient(circle at 88% 16%,rgba(255,214,122,.24),transparent 27%),radial-gradient(circle at 10% 125%,rgba(151,119,255,.27),transparent 40%),linear-gradient(118deg,#24202f 0%,#182130 53%,#142525 100%);box-shadow:0 18px 42px rgba(0,0,0,.22);position:relative;z-index:5}.vcrTop{display:flex;align-items:center;gap:9px;margin-bottom:12px}.vcrDot{width:8px;height:8px;border-radius:50%;background:#ffd77f;box-shadow:0 0 0 5px rgba(255,215,127,.08)}.vcrKick{font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,236,197,.84)}.vcrTime{margin-left:auto;font-size:10px;color:rgba(255,255,255,.49)}.vcrMain{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end}.vcrTitle{font-size:18px;line-height:1.18;font-weight:830;margin-bottom:5px}.vcrSub{font-size:11.5px;line-height:1.4;color:rgba(255,255,255,.62)}.vcrArrow{font-size:24px;color:rgba(255,228,174,.74)}
#homeScreen .homeGrid:has(#vbrainCompatReminderV1)::before,#homeScreen .homeGrid:has(#vbrainCompatReminderV1)::after{display:none!important}`;document.head.appendChild(s);
      b=document.createElement('button');b.type='button';b.id='vbrainCompatReminderV1';b.innerHTML='<div class="vcrTop"><span class="vcrDot"></span><span class="vcrKick"></span><span class="vcrTime"></span></div><div class="vcrMain"><div><div class="vcrTitle"></div><div class="vcrSub"></div></div><span class="vcrArrow">↗</span></div>';
      b.onclick=e=>{e.preventDefault();e.stopPropagation();try{window.showScreen?.('todos')}catch(_){document.querySelector('#homeScreen .homeCard.todos')?.click()}};
      grid.prepend(b);
    }
    let active=[];try{active=Array.isArray(window.todoState?.active)?window.todoState.active:load('todoState',{}).active||[]}catch(_){}
    const task=active.find(t=>String(t?.title||'').trim()),h=new Date().getHours();
    b.querySelector('.vcrKick').textContent=h<11?'Morning cue':h<17?'Today’s nudge':'Evening reset';
    b.querySelector('.vcrTitle').textContent=task?String(task.title).trim():'Choose one thing worth finishing.';
    b.querySelector('.vcrSub').textContent=task?`${active.length} open ${active.length===1?'task':'tasks'} · tap to focus`:'Your list is clear — create the next meaningful action.';
    b.querySelector('.vcrTime').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return true;
  }
  function restoreHistoricalTraits(){
    try{
      const old=load('homeLivingGraphV8',{nodes:{},edges:[]}),g19=load('vbrainGraphV19',{nodes:{},edges:{}});g19.nodes=g19.nodes||{};g19.edges=g19.edges||{};
      for(const [id,n] of Object.entries(old.nodes||{})){if(!g19.nodes[id])g19.nodes[id]={...n,id,active:false,historical:true,firstSeen:n.firstSeen||Date.now(),lastSeen:n.lastSeen||Date.now()}}
      for(const e of old.edges||[]){if(!e?.a||!e?.b)continue;const k=[String(e.a),String(e.b)].sort().join('::');if(!g19.edges[k])g19.edges[k]={...e,active:false,historical:true}}
      localStorage.setItem('vbrainGraphV19',JSON.stringify(g19));try{Native?.saveState?.('vbrainGraphV19',JSON.stringify(g19))}catch(_){}
    }catch(_){}
  }
  function fixVersionButton(){
    const b=document.getElementById('vbrainLiveStatus17');if(!b)return;
    b.textContent='V BRAIN · HOME LIVE';b.style.pointerEvents='none';b.onclick=null;
  }
  function refreshScore(){
    try{window.VBrain?.repair?.()}catch(_){}
    try{window.VBrainGraph?.refresh?.()}catch(_){}
    const stats=(()=>{try{return window.VBrainGraph?.stats?.()||{}}catch(_){return{}}})();
    const line=document.querySelector('#vbrainScoreV8 .vb8Open span:first-child');if(line&&stats.nodes)line.textContent=`${stats.nodes} persistent traits · ${stats.edges||0} connections`;
  }
  async function boot(){
    try{if(!window.__VBRAIN_V8__||!window.VBrain)await runAsset('vbrain-safe-shell-v3.js')}catch(e){log('vbrain_compat_error',{stage:'v8',error:String(e?.message||e)})}
    restoreHistoricalTraits();
    try{if(!window.VBrainGraph)await runAsset('vbrain-graph-v19.js')}catch(e){log('vbrain_compat_error',{stage:'graph19',error:String(e?.message||e)})}
    refreshScore();ensureReminder();fixVersionButton();
    const s=(()=>{try{return window.VBrainGraph?.stats?.()||{}}catch(_){return{}}})();
    log('vbrain_compat_ready',{version:VERSION,v8:!!window.VBrain,graph19:!!window.VBrainGraph,score:!!document.getElementById('vbrainScoreV8'),reminder:!!document.getElementById('vbrainCompatReminderV1'),traits:Number(s.nodes||0),edges:Number(s.edges||0)});
  }
  window.VBrainCompatRestore={version:VERSION,repair:()=>{restoreHistoricalTraits();refreshScore();ensureReminder();fixVersionButton()}};
  boot();setTimeout(()=>window.VBrainCompatRestore.repair(),900);setTimeout(()=>window.VBrainCompatRestore.repair(),2400);setInterval(()=>{if(!document.hidden)window.VBrainCompatRestore.repair()},12000);
})();
