/* V-Brain UI + performance v23 — lean home, unified surfaces, stack Tube and fast live checks. */
(function(){
  'use strict';
  if(window.__VBRAIN_UI_PERFORMANCE_V23__)return;window.__VBRAIN_UI_PERFORMANCE_V23__=true;
  const VERSION=23;
  const RETIRED=['homeDayScoreV4','homeDayScoreV3','homeDayScoreV2','homeMomentum','homeTubeLayoutBar','homeBehaviourOverlayV4'];
  let checkTimer=0;

  function retireNoise(){
    RETIRED.forEach(id=>{try{document.getElementById(id)?.remove()}catch(_){}});
    try{
      document.querySelectorAll('#homeScreen button,[role="button"]').forEach(el=>{
        const id=String(el.id||''),label=String(el.getAttribute('aria-label')||''),text=String(el.textContent||'');
        if(/settings|preferences|controls/i.test(id+' '+label+' '+text)&&el.id!=='vbrainScoreV8')el.style.display='none';
      });
    }catch(_){}
  }

  function forceTubeStack(){
    try{localStorage.setItem('homeTubeLayoutV6','stack')}catch(_){}
    const grid=document.getElementById('grid');
    if(grid){grid.dataset.homeFlexLayout='stack';grid.dataset.layout='stack'}
    document.documentElement.dataset.homeFlexTube='stack';
    document.documentElement.dataset.behaviourTubeMode='stack';
  }

  function style(){
    if(document.getElementById('vbrainUiPerformanceV23Style'))return;
    const s=document.createElement('style');s.id='vbrainUiPerformanceV23Style';s.textContent=`
      :root{--v23-bg:#080a0e;--v23-panel:#11151c;--v23-panel2:#171c24;--v23-line:rgba(255,255,255,.10);--v23-gold:#f0c95d;--v23-gold-line:rgba(240,201,93,.28);--v23-muted:rgba(255,255,255,.60)}
      html,body{background:var(--v23-bg)!important;scroll-behavior:auto!important}
      #homeDayScoreV4,#homeDayScoreV3,#homeDayScoreV2,#homeMomentum,.homeQuestV7,#homeTubeLayoutBar,#homeBehaviourOverlayV4,#vbrainLiveStatus17{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #homeScreen .homeHero{background-color:#121820!important}
      #homeScreen .homeBrand,#homeScreen .homeCard{opacity:1!important;transform:none!important;animation:none!important}
      #homeScreen .homeCard{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:transform .09s ease,filter .09s ease!important}
      #homeScreen .homeCard:active{transform:scale(.992)!important}

      #calendarScreen,#todosScreen,#tubeScreen,#todoDetailScreen{
        min-height:100svh!important;background-color:var(--v23-bg)!important;background-image:
          radial-gradient(circle at 88% 5%,rgba(240,201,93,.08),transparent 26%),
          radial-gradient(circle at 4% 42%,rgba(112,122,255,.08),transparent 31%),
          linear-gradient(180deg,#090b10,#080a0e 68%)!important;
        background-attachment:scroll!important;color:#f7f8fb!important;
      }
      #calendarScreen::before,#todosScreen::before,#tubeScreen::before,#todoDetailScreen::before{display:none!important}
      #calendarScreen .header,#todosScreen .header,#tubeScreen .header,#todoDetailScreen .header{
        position:sticky!important;top:0!important;z-index:30!important;display:flex!important;grid-template-columns:none!important;align-items:center!important;gap:13px!important;
        padding:max(14px,env(safe-area-inset-top)) 16px 12px!important;background:linear-gradient(180deg,rgba(8,10,14,.98),rgba(8,10,14,.92))!important;
        border-bottom:1px solid rgba(240,201,93,.09)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
      }
      #calendarScreen .back,#todosScreen .back,#tubeScreen .back,#todoDetailScreen .back{
        width:44px!important;height:44px!important;min-width:44px!important;border-radius:22px!important;border:1px solid rgba(255,255,255,.11)!important;
        background:#151922!important;color:#fff!important;font:500 27px/1 system-ui!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
      }
      #calendarScreen .headerTitle,#todosScreen .headerTitle,#tubeScreen .headerTitle,#todoDetailScreen .headerTitle{min-width:0!important;flex:1!important}
      #calendarScreen .eyebrow,#todosScreen .eyebrow,#tubeScreen .eyebrow,#todoDetailScreen .eyebrow,
      #tubeScreen .tubeTop .eyebrow{font:850 10px/1.2 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.18em!important;text-transform:uppercase!important;color:var(--v23-gold)!important;margin:0 0 5px!important}
      #calendarScreen .headerTitle h1,#todosScreen .headerTitle h1,#tubeScreen .headerTitle h1,#todoDetailScreen .headerTitle h1,
      #tubeScreen .tubeTop h1{
        font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-size:29px!important;line-height:1.02!important;font-weight:850!important;
        letter-spacing:-.035em!important;color:#f7f8fb!important;text-shadow:none!important;margin:0!important;
      }
      #calendarScreen .ghostBtn,#todosScreen .ghostBtn,#tubeScreen .ghostBtn,#todoDetailScreen .ghostBtn{
        border:1px solid var(--v23-line)!important;background:#151922!important;color:#eef1f6!important;border-radius:14px!important;padding:10px 12px!important;
        font:800 11px Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
      }
      #calendarScreen>.pad,#todosScreen>.pad,#tubeScreen>.pad,#todoDetailScreen>.pad{padding:18px 16px calc(28px + env(safe-area-inset-bottom))!important}

      #calendarScreen .dateStrip{margin:0 0 17px!important;padding:0!important;display:flex!important;align-items:flex-end!important;gap:14px!important}
      #calendarScreen .dateLabel{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-size:34px!important;line-height:1!important;font-weight:850!important;letter-spacing:-.045em!important;color:#fff!important;text-shadow:none!important}
      #calendarScreen .dateSub,#tubeScreen .sub,#todosScreen .todoStats{font-size:12px!important;color:var(--v23-muted)!important}
      #calendarScreen .navDay{width:44px!important;height:44px!important;border-radius:14px!important;border:1px solid var(--v23-line)!important;background:#151922!important;color:#fff!important;font-size:23px!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}

      #calendarScreen .calendarList,#todosScreen .todoList,#tubeScreen #grid{display:grid!important;grid-template-columns:1fr!important;gap:11px!important;overflow:visible!important;scroll-snap-type:none!important;padding:0!important}
      #calendarScreen .event,#todosScreen .todo,#tubeScreen #grid .card,
      #todoDetailScreen .detailOutcome,#todoDetailScreen .detailSection{
        border:1px solid var(--v23-gold-line)!important;border-radius:23px!important;color:#f7f8fb!important;
        background:radial-gradient(circle at 93% 2%,rgba(240,201,93,.095),transparent 27%),linear-gradient(145deg,rgba(18,21,28,.98),rgba(10,12,17,.97))!important;
        box-shadow:0 14px 34px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.035)!important;
        backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:transform .09s ease,border-color .09s ease!important;contain:layout paint style;
      }
      #calendarScreen .event:active,#todosScreen .todo:active,#tubeScreen #grid .card:active{transform:scale(.994)!important}
      #calendarScreen .event{grid-template-columns:68px 3px 1fr!important;gap:13px!important;min-height:94px!important;padding:15px 16px!important}
      #calendarScreen .eventBody h3,#todosScreen .todoBody h3,#tubeScreen #grid .card h2{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;font-weight:800!important;letter-spacing:-.015em!important;color:#f7f8fb!important}
      #calendarScreen .eventLoc,#todosScreen .todoMeta,#tubeScreen #grid .hook{color:var(--v23-muted)!important}

      #todosScreen .composer{gap:8px!important;margin-bottom:13px!important}
      #todosScreen .composer input,#todoDetailScreen .detailNote{border:1px solid var(--v23-line)!important;background:#101319!important;color:#fff!important;border-radius:16px!important;box-shadow:none!important}
      #todosScreen .composer input:focus,#todoDetailScreen .detailNote:focus{border-color:rgba(240,201,93,.48)!important;box-shadow:0 0 0 3px rgba(240,201,93,.07)!important}
      #todosScreen .composer button,.primaryBtn{background:var(--v23-gold)!important;color:#16130a!important;border:0!important;border-radius:15px!important;font-weight:900!important}
      #todosScreen .todo{grid-template-columns:35px 1fr auto!important;padding:14px 15px!important}
      #todosScreen .todoCheck{background:#11151b!important;border-color:rgba(255,255,255,.18)!important}

      #tubeScreen .tubeTop{padding:2px 0 17px!important;align-items:flex-end!important}
      #tubeScreen #grid[data-home-flex-layout],#tubeScreen #grid[data-layout]{display:grid!important;grid-template-columns:1fr!important;overflow:visible!important;scroll-snap-type:none!important;transform:none!important}
      #tubeScreen #grid .card{width:100%!important;min-width:0!important;max-width:none!important;min-height:116px!important;display:grid!important;grid-template-columns:104px minmax(0,1fr)!important;padding:0!important;scroll-snap-align:none!important;transform:none!important}
      #tubeScreen #grid .card .art{min-height:116px!important;width:104px!important}
      #tubeScreen #grid .cardbody{padding:14px 15px!important}
      #tubeScreen #grid .meta{color:var(--v23-gold)!important;font-size:9px!important;letter-spacing:.12em!important}
      #tubeScreen #grid .chev{background:#171b22!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}

      #todoDetailScreen .detailLabel{color:var(--v23-gold)!important}
      #todoDetailScreen .detailOutcome,#todoDetailScreen .detailSection{margin-bottom:11px!important;padding:16px!important}
      @media(max-width:520px){
        #calendarScreen .headerTitle h1,#todosScreen .headerTitle h1,#tubeScreen .headerTitle h1,#todoDetailScreen .headerTitle h1,#tubeScreen .tubeTop h1{font-size:27px!important}
        #calendarScreen .dateLabel{font-size:31px!important}
      }
    `;document.head.appendChild(s);
  }

  function tune(){style();retireNoise();forceTubeStack();document.documentElement.dataset.vbrainUi=String(VERSION)}

  function patchRouting(){
    if(typeof window.showScreen==='function'&&!window.showScreen.__vbrainUi23){
      const base=window.showScreen;
      const wrapped=function(name){const r=base.apply(this,arguments);requestAnimationFrame(()=>{if(name==='tube')forceTubeStack();retireNoise()});return r};
      wrapped.__vbrainUi23=true;window.showScreen=wrapped;
    }
  }

  function fastLiveChecks(){
    if(checkTimer)return;
    const tick=()=>{if(document.hidden)return;try{Native?.checkLiveUpdate?.()}catch(_){}try{window.VBrainHotLoader?.refresh?.()}catch(_){}};
    checkTimer=setInterval(tick,5000);setTimeout(tick,900);
  }

  tune();patchRouting();fastLiveChecks();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{tune();patchRouting()},{once:true});
  setTimeout(tune,120);setTimeout(tune,650);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){tune();try{Native?.checkLiveUpdate?.()}catch(_){}}});
  window.VBrainUIPerformance={version:VERSION,tune,forceTubeStack};
})();
