/* HOME dashboard v2 — rebuild only the launch screen and keep all existing routes/data. */
(function(){
  const home=document.getElementById('homeScreen');
  if(!home)return;

  home.innerHTML=`
    <div class="homeHero">
      <div class="homeBrand" aria-hidden="true">
        <div class="homeMonogram"><span></span><i></i></div>
        <div class="homeBrandName">HOME</div>
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

  updateHome();
  requestAnimationFrame(()=>requestAnimationFrame(()=>home.classList.add('homeReady')));
})();
