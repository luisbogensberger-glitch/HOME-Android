/* V-Brain dashboard v3 — rebuild launch screen, preserve data/routes, enhance calendar. */
(function(){
  const home=document.getElementById('homeScreen');
  if(!home)return;

  home.innerHTML=`
    <div class="homeHero">
      <div class="homeBrand" aria-hidden="true">
        <div class="homeMonogram"><span></span><i></i></div>
        <div class="homeBrandName">V-BRAIN</div>
      </div>
    </div>
    <div class="homeInner">
      <div class="homeGrid">
        <button class="homeCard calendar" onclick="showScreen('calendar')" aria-label="Open today's calendar">
          <div class="homeCardHead">
            <span class="homeCardLabel">Today</span>
            <span><span class="homeCardMetric" id="homeCalendarCount">Calendar</span><span class="homeCardChevron">›</span></span>
          </div>
          <div class="homeMetricRow">
            <div class="homeDateTile"><strong id="homeDayNumber">--</strong><span id="homeDayMonth">---</span></div>
            <div class="homeSummary"><h2 id="homeWeekday">Today</h2><p id="homeCalendarText">Open your day</p></div>
          </div>
        </button>

        <button class="homeCard todos" onclick="showScreen('todos')" aria-label="Open tasks">
          <div class="homeCardHead">
            <span class="homeCardLabel">Tasks</span>
            <span><span class="homeCardMetric" id="homeTodoCount">0 open</span><span class="homeCardChevron">›</span></span>
          </div>
          <div class="homeMetricRow">
            <div class="homeTaskVisual" aria-hidden="true"><span class="homeTaskDot"></span><span class="homeTaskLines"><i></i><i></i></span></div>
            <div class="homeSummary"><h2>To-Dos</h2><p id="homeTodoText">Keep the list calm.</p></div>
          </div>
        </button>

        <button class="homeCard tube" onclick="showScreen('tube')" aria-label="Open Tube Learning">
          <div class="homeCardHead">
            <span class="homeCardLabel">Learn</span>
            <span><span class="homeCardMetric" id="homeTubeReady">5 cards</span><span class="homeCardChevron">›</span></span>
          </div>
          <div class="homeLearnRow">
            <div class="homeLearnCopy"><h2>Tube Learning</h2><p id="homeTubeText">One useful thing at a time.</p></div>
            <div class="homeLearnRing" id="homeLearnRing"><div class="homeLearnRingInner"><strong id="homeLearnCount">0</strong><span>learned</span></div></div>
          </div>
        </button>
      </div>
    </div>`;

  function todayEvents(){
    try{
      if(!hasNative()||!Native.hasCalendarPermission())return null;
      const bounds=dayBounds(new Date());
      return JSON.parse(Native.getCalendarEvents(bounds[0],bounds[1])||'[]');
    }catch(e){return null}
  }

  updateHome=function(){
    const now=new Date();
    const day=document.getElementById('homeDayNumber');
    const month=document.getElementById('homeDayMonth');
    const weekday=document.getElementById('homeWeekday');
    if(day)day.textContent=new Intl.DateTimeFormat('en-GB',{day:'2-digit'}).format(now);
    if(month)month.textContent=new Intl.DateTimeFormat('en-GB',{month:'short'}).format(now).toUpperCase();
    if(weekday)weekday.textContent=new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(now);

    const events=todayEvents();
    const calendarCount=document.getElementById('homeCalendarCount');
    const calendarText=document.getElementById('homeCalendarText');
    if(events){
      const n=events.length;
      if(calendarCount)calendarCount.textContent=n===1?'1 event':`${n} events`;
      if(calendarText)calendarText.textContent=n?`${n} scheduled today`:'Nothing scheduled';
    }else{
      if(calendarCount)calendarCount.textContent='Calendar';
      if(calendarText)calendarText.textContent='Open your day';
    }

    const open=Array.isArray(todoState?.active)?todoState.active.length:0;
    const todoCount=document.getElementById('homeTodoCount');
    const todoText=document.getElementById('homeTodoText');
    if(todoCount)todoCount.textContent=`${open} open`;
    if(todoText)todoText.textContent=open?`${open} things to finish`:'Everything is done';

    const learned=Array.isArray(tubeState?.completed)?tubeState.completed.length:0;
    const learnCount=document.getElementById('homeLearnCount');
    const tubeText=document.getElementById('homeTubeText');
    const ring=document.getElementById('homeLearnRing');
    if(learnCount)learnCount.textContent=learned;
    if(tubeText)tubeText.textContent=learned?`${learned} completed so far`:'One useful thing at a time.';
    if(ring)ring.style.setProperty('--learn-angle',`${Math.min(learned,5)/5*360}deg`);
  };

  function calendarIcon(title){
    const t=(title||'').toLowerCase();
    if(t.includes('morning')||t.includes('launch')||t.includes('breakfast'))return '☀️';
    if(t.includes('read')||t.includes('book')||t.includes('study'))return '📖';
    if(t.includes('ucl')||t.includes('lecture')||t.includes('module'))return '🎓';
    if(t.includes('python')||t.includes('fintech')||t.includes('code'))return '💻';
    if(t.includes('international')||t.includes('global'))return '🌍';
    if(t.includes('walk')||t.includes('buffer')||t.includes('travel'))return '🚶';
    if(t.includes('meeting')||t.includes('call'))return '◌';
    if(t.includes('email')||t.includes('mail'))return '✉️';
    return '✦';
  }

  function decorateCalendar(){
    const screen=document.getElementById('calendarScreen');
    if(!screen)return;
    const date=document.getElementById('calendarDate');
    try{if(date&&typeof selectedDate!=='undefined'){const weekday=new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(selectedDate);const day=new Intl.DateTimeFormat('en-GB',{day:'numeric'}).format(selectedDate);const month=new Intl.DateTimeFormat('en-GB',{month:'long'}).format(selectedDate);date.textContent=`${weekday} ${day} ${month}`}}catch(e){}
    screen.querySelectorAll('.event').forEach((event)=>{const body=event.querySelector('.eventBody');const title=body&&body.querySelector('h3');if(!body||!title)return;const raw=title.textContent.trim();if(!body.querySelector('.eventIcon')){const icon=document.createElement('span');icon.className='eventIcon';icon.setAttribute('aria-hidden','true');icon.textContent=calendarIcon(raw);body.insertBefore(icon,body.firstChild)}if(raw.includes('|')&&!title.querySelector('small')){const parts=raw.split('|').map(v=>v.trim()).filter(Boolean);if(parts.length>1){title.textContent='';const primary=document.createElement('span');primary.textContent=parts.shift();const secondary=document.createElement('small');secondary.textContent=parts.join(' · ');title.append(primary,secondary)}}});
  }

  const originalRenderCalendar=typeof window.renderCalendar==='function'?window.renderCalendar:null;
  if(originalRenderCalendar){window.renderCalendar=function(){const result=originalRenderCalendar.apply(this,arguments);decorateCalendar();return result}};
  const calendarList=document.getElementById('calendarList');if(calendarList){new MutationObserver(()=>decorateCalendar()).observe(calendarList,{childList:true,subtree:true})}
  const originalShowScreen=typeof window.showScreen==='function'?window.showScreen:null;
  if(originalShowScreen){window.showScreen=function(name){const result=originalShowScreen.apply(this,arguments);if(name==='calendar'){const screen=document.getElementById('calendarScreen');decorateCalendar();if(screen){screen.classList.remove('calendarEnter');requestAnimationFrame(()=>requestAnimationFrame(()=>screen.classList.add('calendarEnter')))}}if(name==='home')updateHome();return result}};
  updateHome();requestAnimationFrame(()=>requestAnimationFrame(()=>home.classList.add('homeReady')));
})();