/* HOME Feedback Pulse v1 — sparse, low-friction questions that reduce uncertainty in the adaptive model. */
(function(){
  'use strict';
  if(window.__HOME_FEEDBACK_PULSE_V1__)return;window.__HOME_FEEDBACK_PULSE_V1__=true;
  const ACT='homeAdaptiveActivityV1',STATE='homeFeedbackPulseV1',DAY=86400000;
  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const rows=()=>{const v=load(ACT,[]);return Array.isArray(v)?v:[]};
  const count=(r,t)=>r.filter(x=>x.type===t).length;
  function choose(){
    const since=Date.now()-14*DAY,r=rows().filter(x=>Number(x?.at||0)>=since);
    const to=count(r,'todo_open'),td=count(r,'todo_complete'),lo=count(r,'tube_card_open'),ld=count(r,'tube_complete'),gs=count(r,'gym_start'),gd=count(r,'gym_complete');
    if(to>=4&&td/Math.max(1,to)<.5)return{id:'todo_blocker',q:'When a to-do keeps surviving, what is usually the real blocker?',opts:[['too_big','It feels too big'],['unclear','The next step is unclear'],['timing','Wrong moment'],['priority','It is not important enough']]};
    if(lo>=4&&ld/Math.max(1,lo)<.6)return{id:'learning_friction',q:'When you leave a learning card unfinished, what is usually the reason?',opts:[['generic','Too generic'],['long','Too long'],['easy','Too easy'],['timing','Wrong moment']]};
    if(gs>=2&&gd/Math.max(1,gs)<.6)return{id:'movement_blocker',q:'What most often stops a planned workout from becoming a finished one?',opts:[['time','Not enough time'],['energy','Low energy'],['environment','Wrong place / setup'],['plan','Plan feels too large']]};
    return{id:'current_priority',q:'What should HOME optimize more strongly for you right now?',opts:[['action','Getting things done'],['learning','Learning deeply'],['energy','Health & energy'],['friction','Less friction / fewer decisions']]};
  }
  function due(){
    const s=load(STATE,{}),now=Date.now();
    if(Number(s.dismissUntil||0)>now)return false;
    if(Number(s.lastAnsweredAt||0)&&now-Number(s.lastAnsweredAt)<4*DAY)return false;
    if(Number(s.lastShownAt||0)&&now-Number(s.lastShownAt)<2*DAY)return false;
    return rows().length>=12;
  }
  function style(){if(document.getElementById('homeFeedbackPulseStyle'))return;const s=document.createElement('style');s.id='homeFeedbackPulseStyle';s.textContent=`
#homeFeedbackPulse{border:1px solid rgba(255,255,255,.10);border-radius:24px;padding:17px;background:linear-gradient(145deg,rgba(23,27,34,.94),rgba(13,16,21,.94));box-shadow:0 14px 36px rgba(0,0,0,.18);color:#fff}.hfpTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hfpKicker{font-size:9px;font-weight:900;letter-spacing:.16em;color:#9eb2ff}.hfpQuestion{font-size:16px;font-weight:800;line-height:1.25;margin-top:5px}.hfpLater{border:0;background:transparent;color:rgba(255,255,255,.45);font-size:11px;padding:3px 0}.hfpOptions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.hfpOptions button{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:#f5f7fb;border-radius:14px;padding:11px 10px;text-align:left;font-size:11px;line-height:1.25}.hfpThanks{font-size:12px;color:rgba(255,255,255,.66);padding:5px 0 1px}
`;document.head.appendChild(s)}
  function render(){
    if(!due()||document.getElementById('homeFeedbackPulse'))return;
    const grid=document.querySelector('#homeScreen .homeGrid');if(!grid)return;
    style();const q=choose(),card=document.createElement('div');card.id='homeFeedbackPulse';card.innerHTML=`<div class="hfpTop"><div><div class="hfpKicker">HELP HOME LEARN YOU</div><div class="hfpQuestion">${q.q}</div></div><button class="hfpLater" type="button">Later</button></div><div class="hfpOptions">${q.opts.map(([id,label])=>`<button type="button" data-choice="${id}">${label}</button>`).join('')}</div>`;
    grid.appendChild(card);const st=load(STATE,{});st.lastShownAt=Date.now();st.lastQuestion=q.id;save(STATE,st);log('feedback_prompt_shown',{questionId:q.id});
    card.querySelector('.hfpLater').onclick=()=>{const s=load(STATE,{});s.dismissUntil=Date.now()+7*DAY;save(STATE,s);log('feedback_prompt_dismissed',{questionId:q.id});card.remove()};
    card.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const choice=b.dataset.choice||'';const s=load(STATE,{});s.lastAnsweredAt=Date.now();s.dismissUntil=0;s.lastQuestion=q.id;s.lastChoice=choice;save(STATE,s);log('feedback_response',{questionId:q.id,choice});card.innerHTML='<div class="hfpThanks">Thanks — HOME will use this as one signal, not as a permanent label.</div>';setTimeout(()=>card.remove(),2200)});
  }
  setTimeout(render,2200);
  window.HOMEFeedbackPulse={render,choose,version:1};
})();

/* HOME Brain entry v2 — compatible with APKs that still contain the old CSS kill-switch. */
(function(){
  'use strict';
  if(window.__HOME_BRAIN_ENTRY_V2__)return;window.__HOME_BRAIN_ENTRY_V2__=true;
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';

  function installOverride(){
    let s=document.getElementById('homeBrainEntryV2Style');
    if(!s){s=document.createElement('style');s.id='homeBrainEntryV2Style';document.head.appendChild(s)}
    s.textContent=`
      #homeDayScoreV2,#homeDayScoreV3,#homeDayScoreV4{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #homeBehaviourOverlayV4{visibility:visible!important;pointer-events:auto!important;opacity:1!important}
      #homeBehaviourOverlayV4.show{display:block!important;visibility:visible!important;pointer-events:auto!important}
      #homeMomentum .homeMomentumXp,[data-home-brain-entry="1"]{cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    `;
    const kill=document.getElementById('homeBehaviourEmergencyDisable');
    if(kill)kill.textContent=`
      #homeDayScoreV2,#homeDayScoreV3,#homeDayScoreV4,
      #homeBehaviourOverlayV2,#homeBehaviourOverlayV3,
      .hbQuestHint{display:none!important;pointer-events:none!important;visibility:hidden!important}
      body{overflow:auto!important}
    `;
  }

  function openBrain(){
    installOverride();
    try{window.HOMEBehaviourIntelligence?.open?.()}catch(e){}
    setTimeout(()=>{
      installOverride();
      const o=document.getElementById('homeBehaviourOverlayV4');
      if(o){o.classList.add('show');o.style.setProperty('visibility','visible','important');o.style.setProperty('pointer-events','auto','important')}
    },30);
  }

  function candidates(){
    const out=[];
    const exact=document.querySelector('#homeMomentum .homeMomentumXp');if(exact)out.push(exact);
    document.querySelectorAll('#homeMomentum *').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(/\b(score|xp)\b/i.test(t)&&t.length<45)out.push(el);
    });
    return [...new Set(out)];
  }

  function bind(){
    installOverride();
    candidates().forEach(el=>{
      if(el.dataset.homeBrainBound)return;
      el.dataset.homeBrainBound='1';el.dataset.homeBrainEntry='1';
      el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','Open HOME Brain');
      el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openBrain()},true);
      el.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();openBrain()},true);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBrain()}},true);
    });
    const o=document.getElementById('homeBehaviourOverlayV4');
    if(o){const a=o.querySelector('.hb4Top small'),b=o.querySelector('.hb4Top h1');if(a)a.textContent='HOME BRAIN';if(b)b.textContent='Your living model'}
  }

  async function loadBrain(){
    installOverride();
    if(window.HOMEBehaviourIntelligence){bind();return}
    try{
      const r=await fetch(BASE+'behaviour-map-v4.js?v='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      const js=await r.text();
      new Function(js+'\n//# sourceURL=home-brain-v4-live.js')();
      bind();setTimeout(bind,150);setTimeout(bind,700);
    }catch(e){}
  }

  loadBrain();setTimeout(loadBrain,500);setTimeout(loadBrain,1600);
  setInterval(bind,2500);
})();
