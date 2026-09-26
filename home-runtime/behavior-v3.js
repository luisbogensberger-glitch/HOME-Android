/* HOME live behaviour bootstrap — inline classic Day Score + Brain + HOME2 backup. */
(function(){
  'use strict';
  const BASE='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/';
  const ACT='homeAdaptiveActivityV1';
  const QUEST='homeQuestLedgerV7';
  const SECRET_RE=/(token|secret|password|passwd|auth|credential|cookie|session|bearer|api[_-]?key)/i;
  const CODE_CACHE=new Set(['homeRemoteCssV2','homeRemoteJsV2','homeBehaviorCssV3','homeBehaviorJsV3']);
  const NATIVE_KEYS=['todoState','tubeState','homeVisualOverridesV5','homeGymStateV1'];
  const enc=new TextEncoder();

  try{
    ['homeBehaviourEmergencyDisable','homeBrainAllowV4','homeSafeToolsStyle'].forEach(id=>document.getElementById(id)?.remove());
    ['homeDayScoreV2','homeDayScoreV3','homeBehaviourOverlayV2','homeBehaviourOverlayV3','homeSafeBrainModal','homeSafeBackupModal','homeSafeBackupBtn']
      .forEach(id=>document.getElementById(id)?.remove());
    document.body&&(document.body.style.overflow='');
  }catch(e){}

  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const dayKey=t=>{const d=new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const rows=(days=30)=>{const v=load(ACT,[]),since=Date.now()-days*86400000;return Array.isArray(v)?v.filter(x=>Number(x?.at||0)>=since):[]};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const part=t=>{const h=new Date(t||Date.now()).getHours();return h<5?'night':h<11?'morning':h<15?'midday':h<21?'evening':'night'};

  function score(){
    const today=dayKey(),r=rows(2).filter(x=>dayKey(x.at)===today),q=load(QUEST,{days:{}}),done=new Set(Array.isArray(q?.days?.[today])?q.days[today]:[]);
    const td=Math.max(r.filter(x=>x.type==='todo_complete').length,done.has('do')?1:0);
    const ld=Math.max(r.filter(x=>x.type==='tube_complete').length,done.has('learn')?1:0);
    const gd=Math.max(r.filter(x=>x.type==='gym_complete').length,done.has('move')?1:0);
    const domains=(td>0?1:0)+(ld>0?1:0)+(gd>0?1:0);
    return Math.min(100,domains*25+(domains===3?25:0));
  }

  function brainModel(){
    const r=rows(30),done=r.filter(x=>['todo_complete','tube_complete','gym_complete'].includes(x.type));
    const todos=done.filter(x=>x.type==='todo_complete').length;
    const tube=done.filter(x=>x.type==='tube_complete').length;
    const gym=done.filter(x=>x.type==='gym_complete').length;
    const parts={morning:0,midday:0,evening:0,night:0};done.forEach(x=>parts[part(x.at)]++);
    const best=Object.entries(parts).sort((a,b)=>b[1]-a[1])[0];
    const days=new Set(done.map(x=>dayKey(x.at))).size;
    const profile=load('homeBehaviourProfileV4',null);
    const learning=load('homeSentenceLearningProfileV7',null);
    const decision=load('homeBehaviourDecisionV3',{});
    const todoOpens=r.filter(x=>x.type==='todo_open').length;
    const tubeOpens=r.filter(x=>x.type==='tube_card_open').length;
    return{score:score(),events:r.length,todos,tube,gym,days,best:best&&best[1]?best[0]:'not enough data',todoRate:todoOpens?Math.round(todos/todoOpens*100):null,tubeRate:tubeOpens?Math.round(tube/tubeOpens*100):null,confidence:profile?.evidence?.events>=150?'High-signal':profile?.evidence?.events>=50?'Learning well':'Still learning',learningStage:learning?.stage||'building',todoDensity:decision?.todoDensity||'normal',tubeMode:decision?.tubeMode||'keep'};
  }

  function bytesToB64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function checksum(bytes){let a=0x811c9dc5>>>0,b=0x9e3779b9>>>0;for(let i=0;i<bytes.length;i++){a=Math.imul((a^bytes[i])>>>0,0x01000193)>>>0;b=Math.imul((b+bytes[i]+((i+1)&255))>>>0,0x85ebca6b)>>>0;b^=b>>>13}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0')}
  function collectBackup(){
    const storage={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||SECRET_RE.test(k)||CODE_CACHE.has(k))continue;const v=localStorage.getItem(k);if(v!==null)storage[k]=v}}catch(e){}
    NATIVE_KEYS.forEach(k=>{try{if(typeof Native!=='undefined'&&Native.loadState){const v=Native.loadState(k);if(typeof v==='string'&&v.length)storage[k]=v}}catch(e){}});
    return{app:'HOME',version:2,createdAt:Date.now(),storage};
  }
  function makeBackupCode(){const raw=enc.encode(JSON.stringify(collectBackup()));return `HOME2J.${checksum(raw)}.${bytesToB64u(raw)}`}
  async function copyText(text,el){try{await navigator.clipboard.writeText(text);return true}catch(e){}try{el.focus();el.select();el.setSelectionRange(0,el.value.length);return document.execCommand('copy')}catch(e){return false}}

  function ensureStyle(){
    if(document.getElementById('homeClassicBrainStyle'))return;
    const s=document.createElement('style');s.id='homeClassicBrainStyle';s.textContent=`
      #homeDayScoreV4{position:absolute!important;right:18px!important;top:92px!important;z-index:120!important;min-width:86px!important;padding:9px 12px!important;border-radius:18px!important;border:1px solid rgba(255,255,255,.28)!important;background:rgba(12,15,20,.42)!important;backdrop-filter:blur(15px)!important;-webkit-backdrop-filter:blur(15px)!important;color:#fff!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:2px!important;font:inherit!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
      #homeDayScoreV4 small{font-size:9px!important;letter-spacing:.17em!important;font-weight:850!important;opacity:.72!important}#homeDayScoreV4 b{font-size:26px!important;line-height:1!important}
      #homeBehaviourOverlayV4{position:fixed!important;inset:0!important;z-index:2147483000!important;background:#080a0e!important;color:#f7f8fb!important;display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important}
      #homeBehaviourOverlayV4.show{display:block!important;visibility:visible!important;pointer-events:auto!important}
      .hbcTop{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:12px;padding:max(15px,env(safe-area-inset-top)) 18px 12px;background:rgba(8,10,14,.96);backdrop-filter:blur(18px)}.hbcBack{width:42px;height:42px;border:1px solid rgba(255,255,255,.09);border-radius:21px;background:#151821;color:#fff;font-size:27px;padding:0}.hbcTop small{display:block;opacity:.48;font-size:9px;letter-spacing:.15em;font-weight:800}.hbcTop h1{font-size:20px;margin:1px 0 0}.hbcBody{padding:10px 16px 46px;max-width:760px;margin:auto}
      .hbcHero{display:grid;grid-template-columns:106px 1fr;gap:16px;align-items:center;padding:14px 0}.hbcScore{width:102px;height:102px;border-radius:54px;border:1px solid rgba(255,255,255,.12);background:radial-gradient(circle at 35% 28%,rgba(132,156,255,.26),rgba(255,255,255,.03) 58%);display:grid;place-items:center;text-align:center}.hbcScore b{font-size:38px}.hbcScore span{font-size:9px;opacity:.52;letter-spacing:.14em}.hbcHero h2{margin:0 0 5px;font-size:23px;line-height:1.06}.hbcHero p{margin:0;font-size:12px;line-height:1.45;opacity:.62}
      .hbcMetrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 14px}.hbcMetric{padding:12px 6px;border:1px solid rgba(255,255,255,.075);background:#0f1218;border-radius:16px;text-align:center}.hbcMetric b{display:block;font-size:18px}.hbcMetric span{font-size:8px;letter-spacing:.08em;opacity:.48}.hbcCard{border:1px solid rgba(255,255,255,.075);background:#0e1117;border-radius:20px;padding:15px;margin:10px 0}.hbcCard small{display:block;color:#d5b969;font-size:9px;font-weight:900;letter-spacing:.12em;margin-bottom:5px}.hbcCard b{font-size:13px}.hbcCard p{font-size:11px;line-height:1.45;opacity:.62;margin:5px 0 0}
      .hbcBtn{width:100%;border:0;border-radius:14px;padding:12px 13px;font-weight:850;background:#f1d46a;color:#17150d;margin-top:8px}.hbcArea{width:100%;min-height:100px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#15171c;color:#fff;padding:11px;font-size:10px;line-height:1.35;margin-top:9px;resize:vertical}.hbcStatus{font-size:10px;opacity:.58;min-height:16px;margin-top:7px}
    `;document.head.appendChild(s);
  }

  function ensureLauncher(){
    ensureStyle();const home=document.getElementById('homeScreen');if(!home)return null;
    if(getComputedStyle(home).position==='static')home.style.position='relative';
    let b=document.getElementById('homeDayScoreV4');
    if(!b){b=document.createElement('button');b.id='homeDayScoreV4';b.type='button';b.innerHTML='<small>DAY SCORE</small><b>0</b>';home.appendChild(b)}
    b.onclick=function(e){e.preventDefault();e.stopPropagation();openBrain()};
    const v=b.querySelector('b');if(v)v.textContent=String(score());
    return b;
  }

  function ensureOverlay(){
    ensureStyle();let o=document.getElementById('homeBehaviourOverlayV4');if(o)return o;
    o=document.createElement('div');o.id='homeBehaviourOverlayV4';o.innerHTML=`<div class="hbcTop"><button class="hbcBack" type="button">‹</button><div><small>BEHAVIOUR INTELLIGENCE</small><h1>Your living model</h1></div></div><div class="hbcBody" id="hbcBody"></div>`;document.body.appendChild(o);
    o.querySelector('.hbcBack').onclick=closeBrain;return o;
  }
  function closeBrain(){document.getElementById('homeBehaviourOverlayV4')?.classList.remove('show');document.body.style.overflow=''}
  function openBrain(){
    const m=brainModel(),o=ensureOverlay(),body=o.querySelector('#hbcBody');
    body.innerHTML=`
      <div class="hbcHero"><div class="hbcScore"><div><b>${m.score}</b><br><span>DAY SCORE</span></div></div><div><h2>HOME is learning how you work.</h2><p>${esc(m.confidence)} · ${m.events} activity signals observed. Strongest completion window: ${esc(m.best)}.</p></div></div>
      <div class="hbcMetrics"><div class="hbcMetric"><b>${m.todos}</b><span>TASKS · 30D</span></div><div class="hbcMetric"><b>${m.tube}</b><span>LEARNED · 30D</span></div><div class="hbcMetric"><b>${m.gym}</b><span>WORKOUTS · 30D</span></div></div>
      <div class="hbcCard"><small>FOLLOW-THROUGH</small><b>Tasks ${m.todoRate===null?'—':m.todoRate+'%'} · Learning ${m.tubeRate===null?'—':m.tubeRate+'%'}</b><p>HOME compares openings with meaningful completions instead of rewarding taps alone.</p></div>
      <div class="hbcCard"><small>ADAPTIVE MODEL</small><b>${m.days} active days · Learning stage: ${esc(m.learningStage)}</b><p>Current interface tendency: tasks ${esc(m.todoDensity)}, Tube ${esc(m.tubeMode)}.</p></div>
      <div class="hbcCard"><small>BACKUP</small><b>Save your current HOME state</b><p>This excludes passwords, tokens and cached remote code. The resulting HOME2 code can be restored by the newer HOME APK.</p><button class="hbcBtn" id="hbcCreateBackup" type="button">Create backup code</button><textarea class="hbcArea" id="hbcBackupOut" readonly placeholder="Your HOME2 backup code appears here"></textarea><button class="hbcBtn" id="hbcCopyBackup" type="button">Copy backup code</button><div class="hbcStatus" id="hbcBackupStatus"></div></div>`;
    const out=body.querySelector('#hbcBackupOut'),status=body.querySelector('#hbcBackupStatus');
    body.querySelector('#hbcCreateBackup').onclick=()=>{try{out.value=makeBackupCode();status.textContent='Backup created from the current HOME state.'}catch(e){status.textContent='Backup failed: '+(e?.message||e)}};
    body.querySelector('#hbcCopyBackup').onclick=async()=>{if(!out.value){status.textContent='Create the backup code first.';return}status.textContent=(await copyText(out.value,out))?'Backup code copied.':'Select the code and copy it manually.'};
    o.classList.add('show');document.body.style.overflow='hidden';
  }
  window.HOMEClassicBrain={open:openBrain,close:closeBrain,repair:ensureLauncher,backup:makeBackupCode};

  ensureLauncher();setTimeout(ensureLauncher,250);setTimeout(ensureLauncher,900);setTimeout(ensureLauncher,2200);setInterval(ensureLauncher,10000);

  async function get(name){
    try{const r=await fetch(BASE+name+'?v='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(e){}
    try{const r=await fetch(name+'?v='+Date.now(),{cache:'no-store'});if(r.ok)return r.text()}catch(e){}
    throw new Error('Could not load '+name);
  }
  function run(js,name){new Function(js+'\n//# sourceURL='+name)()}
  async function safeLoad(file,label){try{run(await get(file),label||file);return true}catch(e){try{console.warn('HOME component failed',file,e)}catch(_){}return false}}

  (async()=>{
    await safeLoad('behavior-v3-base.js','home-behaviour-v3-base.js');
    await safeLoad('learning-engine-v10.js','home-learning-engine-v10.js');
    await safeLoad('learning-resilience-v11.js','home-learning-resilience-v11.js');
    await safeLoad('interface-policy-v10.js','home-interface-policy-v10.js');
    await safeLoad('habit-adaptation-v1.js','home-habit-adaptation-v1.js');
    await safeLoad('todo-pressure-v1.js','home-todo-pressure-v1.js');
    await safeLoad('post-install-resilience-v1.js','home-post-install-resilience-v1.js');
    ensureLauncher();
    try{window.homeAdaptiveLog&&window.homeAdaptiveLog('learning_engine_loaded',{version:10,resilience:11,interfacePolicy:10,habitAdaptation:1,todoPressure:1,postInstall:1,behaviourMap:'inline-classic',recovery:'HOME2J-inline'})}catch(e){}
  })();
})();
