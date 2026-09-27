VBrainHotAPI.register({
  id:'home-reminder-card-v1',
  install(){
    const STYLE_ID='vbrain-hot-reminder-style-v1';
    const CARD_ID='vbrainHotReminderV1';
    const state=window.__vbrainReminderHotV1={observer:null,timer:null};

    const css=`
#${CARD_ID}{
  position:relative;min-height:112px;padding:18px 19px 17px;border-radius:27px;
  border:1px solid rgba(255,211,115,.28);overflow:hidden;cursor:pointer;
  background:
    radial-gradient(circle at 88% 18%,rgba(255,214,122,.24),transparent 26%),
    radial-gradient(circle at 12% 120%,rgba(157,125,255,.28),transparent 38%),
    linear-gradient(118deg,#24202f 0%,#182130 52%,#142525 100%);
  box-shadow:0 18px 42px rgba(0,0,0,.24);
  color:#fff;text-align:left;grid-column:1/-1;
  transform:translateZ(0);transition:transform .16s ease,filter .16s ease,border-color .16s ease;
}
#${CARD_ID}:active{transform:scale(.985);filter:brightness(.96)}
#${CARD_ID}::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(110deg,rgba(255,255,255,.09),transparent 34%,rgba(255,255,255,.025) 70%,transparent);
}
#${CARD_ID} .vrTop{position:relative;z-index:2;display:flex;align-items:center;gap:9px;margin-bottom:12px}
#${CARD_ID} .vrDot{width:8px;height:8px;border-radius:50%;background:#ffd77f;box-shadow:0 0 0 0 rgba(255,215,127,.55);animation:vrPulse 2.2s infinite}
#${CARD_ID} .vrKicker{font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,236,197,.83)}
#${CARD_ID} .vrTime{margin-left:auto;font-size:10px;font-weight:760;color:rgba(255,255,255,.48)}
#${CARD_ID} .vrMain{position:relative;z-index:2;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end}
#${CARD_ID} .vrTitle{font-size:18px;line-height:1.18;font-weight:830;letter-spacing:-.015em;margin:0 0 5px}
#${CARD_ID} .vrSub{font-size:11.5px;line-height:1.4;color:rgba(255,255,255,.61)}
#${CARD_ID} .vrArrow{font-size:25px;line-height:1;color:rgba(255,228,174,.7);padding-bottom:2px}
@keyframes vrPulse{0%{box-shadow:0 0 0 0 rgba(255,215,127,.55)}70%{box-shadow:0 0 0 9px rgba(255,215,127,0)}100%{box-shadow:0 0 0 0 rgba(255,215,127,0)}}
`;
    let style=document.getElementById(STYLE_ID);
    if(!style){style=document.createElement('style');style.id=STYLE_ID;style.textContent=css;document.head.appendChild(style)}

    const getReminder=()=>{
      const active=Array.isArray(window.todoState?.active)?window.todoState.active:[];
      const first=active.find(t=>t&&String(t.title||'').trim());
      const hour=new Date().getHours();
      const phase=hour<11?'Morning cue':hour<17?'Today’s nudge':'Evening reset';
      if(first)return {title:String(first.title).trim(),sub:`${active.length} open ${active.length===1?'task':'tasks'} · tap to focus`,phase};
      return {title:'Choose one thing worth finishing.',sub:'Your list is clear — create the next meaningful action.',phase};
    };
    const paint=()=>{
      const el=document.getElementById(CARD_ID);if(!el)return;
      const r=getReminder();
      el.querySelector('.vrKicker').textContent=r.phase;
      el.querySelector('.vrTitle').textContent=r.title;
      el.querySelector('.vrSub').textContent=r.sub;
      el.querySelector('.vrTime').textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    };
    const mount=()=>{
      const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return false;
      let card=document.getElementById(CARD_ID);
      if(!card){
        card=document.createElement('button');card.type='button';card.id=CARD_ID;
        card.setAttribute('aria-label','Open reminders and to-dos');
        card.innerHTML='<div class="vrTop"><span class="vrDot"></span><span class="vrKicker">Today’s nudge</span><span class="vrTime"></span></div><div class="vrMain"><div><div class="vrTitle"></div><div class="vrSub"></div></div><span class="vrArrow">↗</span></div>';
        card.addEventListener('click',()=>{const todo=document.querySelector('#homeScreen .homeCard.todos');if(todo)todo.click()});
        grid.prepend(card);
      }
      paint();return true;
    };
    mount();
    state.observer=new MutationObserver(()=>{if(!document.getElementById(CARD_ID))mount();else paint()});
    state.observer.observe(document.body,{childList:true,subtree:true});
    state.timer=setInterval(()=>{mount();paint()},15000);
  },
  uninstall(){
    const s=window.__vbrainReminderHotV1;
    try{s?.observer?.disconnect()}catch(_){}
    try{if(s?.timer)clearInterval(s.timer)}catch(_){}
    document.getElementById('vbrainHotReminderV1')?.remove();
    document.getElementById('vbrain-hot-reminder-style-v1')?.remove();
    delete window.__vbrainReminderHotV1;
  },
  health(){
    return !!document.getElementById('vbrain-hot-reminder-style-v1');
  }
});