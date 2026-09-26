/* V Brand v1 — visible branding only; internal HOME storage/API keys remain untouched for compatibility. */
(function(){
  'use strict';
  if(window.__V_BRAND_V1__){try{window.VBrand?.repair?.()}catch(e){}return}
  window.__V_BRAND_V1__=true;

  function style(){
    if(document.getElementById('vBrandStyle'))return;
    const s=document.createElement('style');s.id='vBrandStyle';s.textContent=`
      .homeMonogram span::before,.homeMonogram span::after{top:0!important;height:100%!important;width:1.5px!important;background:rgba(255,255,255,.92)!important;transform-origin:top center!important}
      .homeMonogram span::before{left:29px!important;right:auto!important;transform:rotate(6deg)!important}
      .homeMonogram span::after{right:29px!important;left:auto!important;transform:rotate(-6deg)!important}
      .homeMonogram i{display:none!important}
    `;document.head.appendChild(s);
  }

  const pairs=[
    ['HOME Recovery Code','V Backup Code'],
    ['current HOME state','current V state'],
    ['previous HOME data','previous V data'],
    ['previous HOME state','previous V state'],
    ['reinstalling HOME','reinstalling V'],
    ['replacing or reinstalling HOME','replacing or reinstalling V'],
    ['How HOME currently reads you','How V-Brain currently reads you'],
    ['HOME explains what it currently sees','V-Brain explains what it currently sees'],
    ['HOME currently sees this as a strong pattern','V-Brain currently sees this as a strong pattern'],
    ['HOME currently sees this as a developing pattern','V-Brain currently sees this as a developing pattern'],
    ['HOME currently sees only a weak or early signal here','V-Brain currently sees only a weak or early signal here'],
    ['HOME is still collecting enough evidence','V-Brain is still collecting enough evidence'],
    ['your HOME activity','your V activity'],
    ['HOME treats taps and dwell as friction clues','V-Brain treats taps and dwell as friction clues'],
    ['HOME discovered from repeated completion behaviour','V-Brain discovered from repeated completion behaviour'],
    ['Backup created from the current HOME state','Backup created from the current V state'],
    ['HOME state entries','V state entries'],
    ['HOME state items','V state items'],
    ['portable HOME2 backup','portable V backup'],
    ['Open HOME Backup and Restore','Open V Backup and Restore']
  ];

  function replaceText(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{
      const p=n.parentElement;if(!p||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(p.tagName))return;
      let t=n.nodeValue||'',next=t;pairs.forEach(([a,b])=>{next=next.split(a).join(b)});if(next!==t)n.nodeValue=next;
    });
  }

  function repair(){
    style();document.title='V';
    document.querySelectorAll('.homeBrandName').forEach(el=>{if(el.textContent!=='V')el.textContent='V'});
    const roots=[document.getElementById('homeBehaviourOverlayV4'),document.getElementById('homeRecoveryModal'),document.getElementById('homeRestoreHint'),document.getElementById('vBackupCard')];
    roots.forEach(replaceText);
    document.querySelectorAll('#homeScreen *').forEach(el=>{
      const t=(el.childNodes.length===1&&el.firstChild?.nodeType===Node.TEXT_NODE)?el.textContent:'';
      if(t==="HOME WON'T HIDE IT"||t==='HOME WON’T HIDE IT')el.textContent=t.replace('HOME','V');
    });
  }

  const obs=new MutationObserver(()=>repair());obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  repair();setTimeout(repair,300);setTimeout(repair,1200);setInterval(repair,5000);
  window.VBrand={repair};
})();
