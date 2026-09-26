/* V-Brain dashboard v4 — stable four-card baseline with direct navigation. */
(function(){
  'use strict';
  const home=document.getElementById('homeScreen');if(!home)return;
  home.innerHTML=`
    <div class="homeHero"><div class="homeBrand" aria-hidden="true"><div class="homeMonogram"><span></span><i></i></div><div class="homeBrandName">V-BRAIN</div></div></div>
    <div class="homeInner">
      <div class="homeGrid">
        <button class="homeCard calendar" data-route="calendar" type="button" aria-label="Open today's calendar"><div class="homeCardHead"><span class="homeCardLabel">Today</span><span><span class="homeCardMetric" id="homeCalendarCount">Calendar</span><span class="homeCardChevron">›</span></span></div><div class="homeMetricRow"><div class="homeDateTile"><strong id="homeDayNumber">--</strong><span id="homeDayMonth">---</span></div><div class="homeSummary"><h2 id="homeWeekday">Today</h2><p id="homeCalendarText">Open your day</p></div></div></button>
        <button class="homeCard todos" data-route="todos" type="button" aria-label="Open tasks"><div class="homeCardHead"><span class="homeCardLabel">Tasks</span><span><span class="homeCardMetric" id="homeTodoCount">0 open</span><span class="homeCardChevron">›</span></span></div><div class="homeMetricRow"><div class="homeTaskVisual" aria-hidden="true"><span class="homeTaskDot"></span><span class="homeTaskLines"><i></i><i></i></span></div><div class="homeSummary"><h2>To-Dos</h2><p id="homeTodoText">Keep the list calm.</p></div></div></button>
        <button class="homeCard tube" data-route="tube" type="button" aria-label="Open Tube Learning"><div class="homeCardHead"><span class="homeCardLabel">Learn</span><span><span class="homeCardMetric" id="homeTubeReady">Cards</span><span class="homeCardChevron">›</span></span></div><div class="homeLearnRow"><div class="homeLearnCopy"><h2>Tube Learning</h2><p id="homeTubeText">One useful thing at a time.</p></div><div class="homeLearnRing" id="homeLearnRing"><div class="homeLearnRingInner"><strong id="homeLearnCount">0</strong><span>learned</span></div></div></div></button>
        <button class="homeCard gym" data-route="gym" type="button" aria-label="Open training"><div class="homeCardHead"><span class="homeCardLabel">Gym</span><span><span class="homeCardMetric" id="homeGymReady">Ready</span><span class="homeCardChevron">›</span></span></div><div class="homeMetricRow"><div class="homeTaskVisual" aria-hidden="true"><span style="font-size:34px;line-height:1">↑</span></div><div class="homeSummary"><h2>Train</h2><p>Strength · movement</p></div></div></button>
      </div>
    </div>`;

  function route(name){try{if(typeof window.showScreen==='function')return window.showScreen(name)}catch(e){}const target=document.getElementById(name+'Screen');if(!target)return;document.querySelectorAll('.screen').forEach(x=>x.classList.remove('show'));target.classList.add('show')}
  function bind(){home.querySelectorAll('[data-route]').forEach(el=>{const name=el.dataset.route;el.onclick=e=>{e.preventDefault();e.stopPropagation();route(name)};el.style.pointerEvents='auto';el.style.touchAction='manipulation'})}
  function todayEvents(){try{if(typeof hasNative==='function'&&hasNative()&&Native.hasCalendarPermission()){const b=dayBounds(new Date());return JSON.parse(Native.getCalendarEvents(b[0],b[1])||'[]')}}catch(e){}return null}
  function tubeCount(){try{if(Array.isArray(window.cards))return window.cards.length}catch(e){}try{return document.querySelectorAll('#grid .card').length||null}catch(e){return null}}
  window.updateHome=function(){
    const now=new Date();document.getElementById('homeDayNumber').textContent=new Intl.DateTimeFormat('en-GB',{day:'2-digit'}).format(now);document.getElementById('homeDayMonth').textContent=new Intl.DateTimeFormat('en-GB',{month:'short'}).format(now).toUpperCase();document.getElementById('homeWeekday').textContent=new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(now);
    const ev=todayEvents(),cc=document.getElementById('homeCalendarCount'),ct=document.getElementById('homeCalendarText');if(ev){cc.textContent=ev.length===1?'1 event':`${ev.length} events`;ct.textContent=ev.length?`${ev.length} scheduled today`:'Nothing scheduled'}
    try{const open=Array.isArray(todoState?.active)?todoState.active.length:0;document.getElementById('homeTodoCount').textContent=`${open} open`;document.getElementById('homeTodoText').textContent=open?`${open} things to finish`:'Everything is done'}catch(e){}
    try{const learned=Array.isArray(tubeState?.completed)?tubeState.completed.length:0;document.getElementById('homeLearnCount').textContent=learned;document.getElementById('homeTubeText').textContent=learned?`${learned} completed so far`:'One useful thing at a time.';document.getElementById('homeLearnRing').style.setProperty('--learn-angle',`${Math.min(learned,5)/5*360}deg`)}catch(e){}
    const n=tubeCount();if(Number.isFinite(n))document.getElementById('homeTubeReady').textContent=`${n} card${n===1?'':'s'}`;
    bind();
  };
  bind();updateHome();setTimeout(()=>{bind();updateHome()},500);setTimeout(()=>{bind();updateHome()},1600);requestAnimationFrame(()=>requestAnimationFrame(()=>home.classList.add('homeReady')));
})();