/* HOME Interface Policy v10 — AI-controlled UI, compact Tube stack, no manual layout/image settings. */
(function(){
  'use strict';
  if(window.__HOME_INTERFACE_POLICY_V10__)return;window.__HOME_INTERFACE_POLICY_V10__=true;

  const STYLE_ID='homeInterfacePolicyV10Style';
  const MANUAL_LAYOUT_KEY='homeTubeLayoutV6';

  function ensureStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){
      s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s);
    }
    s.textContent=`
      /* Manual controls are intentionally absent: HOME adapts itself. */
      #homeFlexEdit,#homeFlexModal,#homeTubeLayoutBar{display:none!important;visibility:hidden!important;pointer-events:none!important}

      /* Restore the original information-dense Tube overview. */
      #tubeScreen #grid,
      #tubeScreen #grid[data-layout],
      #tubeScreen #grid[data-home-flex-layout]{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:11px!important;
        width:100%!important;
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
        scroll-snap-type:none!important;
        padding:0!important;
        margin:0!important;
      }
      #tubeScreen #grid>.card,
      #tubeScreen #grid[data-layout]>.card,
      #tubeScreen #grid[data-home-flex-layout]>.card{
        display:grid!important;
        grid-template-columns:108px minmax(0,1fr)!important;
        grid-template-rows:auto!important;
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        min-height:118px!important;
        height:auto!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
        scroll-snap-align:none!important;
        scroll-snap-stop:normal!important;
        border-radius:22px!important;
      }
      #tubeScreen #grid>.card>.art{
        width:108px!important;
        min-width:108px!important;
        height:100%!important;
        min-height:118px!important;
        grid-column:1!important;
        grid-row:1!important;
        background-size:cover!important;
        background-position:center!important;
      }
      #tubeScreen #grid>.card>.cardbody{
        grid-column:2!important;
        grid-row:1!important;
        min-width:0!important;
        padding:14px 14px 13px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
      }
      #tubeScreen #grid>.card .meta{font-size:11px!important;line-height:1.2!important}
      #tubeScreen #grid>.card h2{font-size:17px!important;line-height:1.15!important;margin:5px 24px 6px 0!important}
      #tubeScreen #grid>.card .hook{
        display:-webkit-box!important;
        -webkit-line-clamp:2!important;
        -webkit-box-orient:vertical!important;
        overflow:hidden!important;
        font-size:12.5px!important;
        line-height:1.35!important;
      }
      #tubeScreen #grid>.card .chev{right:12px!important;top:12px!important}
      #tubeScreen .tubeTop{padding-bottom:14px!important}
      @media(max-width:420px){
        #tubeScreen #grid>.card,#tubeScreen #grid[data-layout]>.card,#tubeScreen #grid[data-home-flex-layout]>.card{grid-template-columns:96px minmax(0,1fr)!important;min-height:108px!important}
        #tubeScreen #grid>.card>.art{width:96px!important;min-width:96px!important;min-height:108px!important}
        #tubeScreen #grid>.card>.cardbody{padding:12px!important}
        #tubeScreen #grid>.card h2{font-size:16px!important}
      }
    `;
  }

  function removeManualControls(){
    document.getElementById('homeFlexEdit')?.remove();
    document.getElementById('homeFlexModal')?.remove();
    document.getElementById('homeTubeLayoutBar')?.remove();
  }

  function forceCompactStack(){
    try{localStorage.removeItem(MANUAL_LAYOUT_KEY)}catch(e){}
    const grid=document.getElementById('grid');
    if(grid){
      grid.dataset.layout='stack';
      grid.dataset.homeFlexLayout='stack';
      grid.style.removeProperty('height');
      grid.style.removeProperty('overflow-x');
      grid.style.removeProperty('overflow-y');
    }
    document.documentElement.dataset.homeFlexTube='stack';
  }

  function neutralizeManualFlexAPI(){
    try{
      if(window.HOMEFlex){
        window.HOMEFlex.setTubeLayout=function(){forceCompactStack()};
        window.HOMEFlex.getTubeLayout=function(){return'stack'};
        window.HOMEFlex.editHomeImages=function(){};
      }
    }catch(e){}
  }

  function patchRenderDeck(){
    if(typeof window.renderDeck!=='function'||window.renderDeck.__interfacePolicyV10)return;
    const base=window.renderDeck;
    const wrapped=function(){
      const out=base.apply(this,arguments);
      requestAnimationFrame(()=>{removeManualControls();forceCompactStack()});
      return out;
    };
    wrapped.__interfacePolicyV10=true;
    window.renderDeck=wrapped;
  }

  function apply(){
    ensureStyle();removeManualControls();forceCompactStack();neutralizeManualFlexAPI();patchRenderDeck();
    try{
      const tube=window.HOMEAdaptive?.config?.tube;
      if(tube){tube.layout='stack';tube.visibleCount=Math.max(6,Number(tube.visibleCount)||0)}
      const home=window.HOMEAdaptive?.config?.home;
      if(home)home.editable=false;
    }catch(e){}
    document.documentElement.dataset.homeInterfacePolicy='10';
  }

  const observer=new MutationObserver(()=>{removeManualControls();forceCompactStack()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  apply();setTimeout(apply,500);setTimeout(apply,1800);setInterval(apply,3000);
})();
