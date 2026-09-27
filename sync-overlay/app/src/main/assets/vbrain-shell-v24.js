/* V-Brain Shell v24 — the only owner of visible layout. Data layers may observe, never mutate Home. */
(function(){
  'use strict';
  if(window.__VBRAIN_SHELL_V24__)return;window.__VBRAIN_SHELL_V24__=true;
  const VERSION=24;
  const NOISE_IDS=['homeDayScoreV4','homeDayScoreV3','homeDayScoreV2','homeMomentum','homeTubeLayoutBar','homeBehaviourOverlayV4','vbrainLiveBanner','vbrainLiveStatus17','homeFlexEdit','homeFlexSheet','vbRestoreInline','vBackupCard','homeRecoveryLauncher','homeMigrationTools','legacyBackupCenter','homeRecoveryFlexEntry','vbrainDataButton','vbrainDataModal','vbrainCompatReminderV1'];
  let observer=null,cleanQueued=false,healthy=false,liveTimer=0;
  function style(){
    if(document.getElementById('vbrainShellV24Style'))return;
    const s=document.createElement('style');s.id='vbrainShellV24Style';s.textContent=`
      :root{--v24-bg:#080a0e;--v24-panel:#11151c;--v24-line:rgba(255,255,255,.10);--v24-gold:#f0c95d;--v24-gold-line:rgba(240,201,93,.27);--v24-muted:rgba(255,255,255,.60)}
      html,body{background:var(--v24-bg)!important;scroll-behavior:auto!important}
      #homeDayScoreV4,#homeDayScoreV3,#homeDayScoreV2,#homeMomentum,.homeQuestV7,#homeTubeLayoutBar,#homeBehaviourOverlayV4,#vbrainLiveBanner,#vbrainLiveStatus17,#homeFlexEdit,#homeFlexSheet,#vbrainCompatReminderV1,.vb11Module{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #homeScreen .homeCard{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important;transition:transform .08s ease,filter .08s ease,border-color .08s ease!important;contain:layout paint style}
      #homeScreen .homeCard:active{transform:scale(.994)!important;filter:brightness(.96)!important}
      #calendarScreen,#todosScreen,#tubeScreen,#todoDetailScreen,#gymScreen{background:radial-gradient(circle at 88% 4%,rgba(240,201,93,.07),transparent 27%),linear-gradient(180deg,#090b10,#080a0e 68%)!important;color:#f7f8fb!important}
      #calendarScreen .header,#todosScreen .header,#tubeScreen .header,#todoDetailScreen .header{background:rgba(8,10,14,.98)!important;border-bottom:1px solid rgba(240,201,93,.09)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      #calendarScreen .eyebrow,#todosScreen .eyebrow,#tubeScreen .eyebrow,#todoDetailScreen .eyebrow,#tubeScreen .tubeTop .eyebrow{font:850 10px/1.2 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.18em!important;text-transform:uppercase!important;color:var(--v24-gold)!important}
      #calendarScreen .headerTitle h1,#todosScreen .headerTitle h1,#tubeScreen .headerTitle h1,#todoDetailScreen .headerTitle h1,#tubeScreen .tubeTop h1{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-size:28px!important;line-height:1.02!important;font-weight:850!important;letter-spacing:-.035em!important;color:#f7f8fb!important;text-shadow:none!important}
      #calendarScreen .event,#todosScreen .todo,#tubeScreen #grid .card,#todoDetailScreen .detailOutcome,#todoDetailScreen .detailSection{border:1px solid var(--v24-gold-line)!important;border-radius:22px!important;background:radial-gradient(circle at 93% 2%,rgba(240,201,93,.08),transparent 28%),linear-gradient(145deg,rgba(18,21,28,.98),rgba(10,12,17,.97))!important;box-shadow:0 10px 26px rgba(0,0,0,.20)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:transform .08s ease,border-color .08s ease!important;contain:layout paint style}
      #calendarScreen .event:active,#todosScreen .todo:active,#tubeScreen #grid .card:active{transform:scale(.996)!important}
      #calendarScreen .eventBody h3,#todosScreen .todoBody h3,#tubeScreen #grid .card h2{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-weight:800!important;color:#f7f8fb!important}
      #calendarScreen .eventLoc,#todosScreen .todoMeta,#tubeScreen #grid .hook{color:var(--v24-muted)!important}
      #tubeScreen #grid,#tubeScreen #grid[data-layout],#tubeScreen #grid[data-home-flex-layout]{display:grid!important;grid-template-columns:1fr!important;gap:11px!important;overflow:visible!important;scroll-snap-type:none!important;transform:none!important;padding:0!important}
      #tubeScreen #grid .card{width:100%!important;min-width:0!important;max-width:none!important;min-height:116px!important;display:grid!important;grid-template-columns:104px minmax(0,1fr)!important;padding:0!important;scroll-snap-align:none!important;transform:none!important}
      #tubeScreen #grid .card .art{min-height:116px!important;width:104px!important}#tubeScreen #grid .cardbody{padding:14px 15px!important}#tubeScreen #grid .meta{color:var(--v24-gold)!important}
      #todosScreen .composer input,#todoDetailScreen .detailNote{border:1px solid var(--v24-line)!important;background:#101319!important;color:#fff!important;box-shadow:none!important}#todosScreen .composer button,.primaryBtn{background:var(--v24-gold)!important;color:#16130a!important;border:0!important;font-weight:900!important}
      #vbrainScoreV8{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:0 12px 30px rgba(0,0,0,.22)!important}
      @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    `;document.head.appendChild(s);
  }
  function forceTubeStack(){
    try{localStorage.setItem('homeTubeLayoutV6','stack')}catch(_){}
    const grid=document.getElementById('grid');if(grid){grid.dataset.layout='stack';grid.dataset.homeFlexLayout='stack';grid.dataset.flexMode='stack'}
    document.documentElement.dataset.homeFlexTube='stack';document.documentElement.dataset.behaviourTubeMode='stack';
    try{if(window.HOMEAdaptive?.config?.tube)window.HOMEAdaptive.config.tube.layout='stack'}catch(_){}
  }
  function removeNoise(){NOISE_IDS.forEach(id=>{try{document.getElementById(id)?.remove()}catch(_){}});try{document.querySelectorAll('.homeQuestV7,.vb11Module').forEach(x=>x.remove())}catch(_){} }
  function pruneHome(){
    removeNoise();const home=document.getElementById('homeScreen'),inner=home?.querySelector('.homeInner'),grid=inner?.querySelector('.homeGrid');if(!inner||!grid)return;
    [...inner.children].forEach(el=>{if(el===grid||el.id==='vbrainScoreV8')return;el.remove()});
    const seen=new Set();[...grid.children].forEach(el=>{const key=['calendar','todos','tube','gym'].find(k=>el.classList?.contains(k));if(!key||!el.classList?.contains('homeCard')||seen.has(key)){el.remove();return}seen.add(key)});
  }
  function clean(){cleanQueued=false;style();pruneHome();forceTubeStack();document.documentElement.dataset.vbrainUiOwner='24';}
  function queueClean(){if(cleanQueued)return;cleanQueued=true;requestAnimationFrame(clean)}
  function watch(){
    observer?.disconnect();const inner=document.querySelector('#homeScreen .homeInner');if(!inner)return;
    observer=new MutationObserver(queueClean);observer.observe(inner,{childList:true,subtree:true});
  }
  function markHealthy(){
    if(healthy)return;const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;healthy=true;window.__VBRAIN_V24_HEALTHY_AT__=performance.now();
    try{const token=document.querySelector('meta[name="vbrain-boot"]')?.content||'';Native?.markRuntimeHealthy?.(token)}catch(_){}
  }
  function renderRemote(){try{window.VBrainRemoteUI?.render?.()}catch(_){} }
  function fastLive(){
    if(liveTimer)return;const tick=()=>{if(document.hidden)return;try{Native?.checkLiveUpdate?.()}catch(_){} };
    setTimeout(tick,700);liveTimer=setInterval(tick,4000);
  }
  function install(){clean();watch();markHealthy();fastLive();renderRemote()}
  window.addEventListener('vbrain:config',()=>{forceTubeStack();renderRemote();queueClean()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){clean();markHealthy();try{window.HOMEAdaptive?.refresh?.()}catch(_){}try{Native?.checkLiveUpdate?.()}catch(_){}renderRemote()}});
  const prior=window.onAppResume;window.onAppResume=function(){try{prior?.()}catch(_){}clean();markHealthy();try{window.HOMEAdaptive?.refresh?.()}catch(_){}renderRemote()};
  window.VBrainShell={version:VERSION,clean,forceTubeStack,renderRemote,status:()=>({version:VERSION,healthy,healthyAt:window.__VBRAIN_V24_HEALTHY_AT__||0,uiOwner:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  setTimeout(()=>{clean();watch();markHealthy()},100);setTimeout(()=>{clean();watch();markHealthy()},700);
})();
