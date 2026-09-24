(async function(){
  const FEED_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/tube-feed.json';
  const DAY=24*60*60*1000;
  const now=Date.now();
  const MIN_VISIBLE=5;
  const MAX_VISIBLE=7;

  function clampCount(value){
    const n=Math.round(Number(value));
    if(!Number.isFinite(n)) return 6;
    return Math.max(MIN_VISIBLE,Math.min(MAX_VISIBLE,n));
  }

  function recentCompleted(id){
    return Array.isArray(tubeState.completed)&&tubeState.completed.some(x=>x&&x.id===id&&now-Number(x.at||0)<14*DAY);
  }

  function newestAvailable(exclude){
    const blocked=new Set(exclude||[]);
    return cards.find(c=>c&&c.remote===true&&!blocked.has(c.id)&&!recentCompleted(c.id)) ||
           cards.find(c=>c&&!blocked.has(c.id)&&!recentCompleted(c.id)) || null;
  }

  function priorityFor(id,featured){
    const c=cardMap[id];
    if(!c) return -100000;
    let score=Number(c.priority||0);
    if(c.remote===true) score+=1000;
    if(featured.has(id)) score+=10000;
    const born=Number((tubeState.activeSince||{})[id]||0);
    if(born) score+=Math.min(200,(now-born)/DAY*-1+200);
    return score;
  }

  try{
    const res=await fetch(FEED_URL+'?t='+now,{cache:'no-store'});
    if(!res.ok) throw new Error('feed '+res.status);
    const feed=await res.json();
    const desired=clampCount(feed.visibleCount);
    const remote=Array.isArray(feed.cards)?feed.cards:[];

    remote.slice().reverse().forEach(raw=>{
      if(!raw||!raw.id||!raw.title||!Array.isArray(raw.options)||raw.options.length!==4)return;
      const c={...raw,remote:true};
      const idx=cards.findIndex(x=>x.id===c.id);
      if(idx>=0)cards.splice(idx,1);
      cards.unshift(c);
      cardMap[c.id]=c;
    });

    const featuredIds=(Array.isArray(feed.featuredIds)?feed.featuredIds:[])
      .filter(id=>cardMap[id]&&!recentCompleted(id))
      .slice(0,desired);
    const featured=new Set(featuredIds);

    if(!tubeState.activeSince||typeof tubeState.activeSince!=='object'){
      tubeState.activeSince={};
    }
    if(!Array.isArray(tubeState.activeIds)) tubeState.activeIds=[];
    tubeState.activeIds=tubeState.activeIds.filter((id,i,a)=>cardMap[id]&&a.indexOf(id)===i&&!recentCompleted(id));
    tubeState.activeIds.forEach(id=>{if(!tubeState.activeSince[id])tubeState.activeSince[id]=now;});

    // Replace cards that have been sitting unread for seven days.
    for(let i=0;i<tubeState.activeIds.length;i++){
      const id=tubeState.activeIds[i];
      const born=Number(tubeState.activeSince[id]||now);
      if(now-born>=7*DAY&&!featured.has(id)){
        const c=newestAvailable(tubeState.activeIds);
        if(c){
          tubeState.activeIds[i]=c.id;
          tubeState.activeSince[c.id]=now;
        }
      }
    }

    // Make sure today's explicitly featured cards surface immediately.
    featuredIds.forEach(id=>{
      if(tubeState.activeIds.includes(id)) return;
      if(tubeState.activeIds.length<desired){
        tubeState.activeIds.push(id);
      }else{
        let replaceIndex=-1;
        let worst=Infinity;
        tubeState.activeIds.forEach((activeId,index)=>{
          if(featured.has(activeId)) return;
          const score=priorityFor(activeId,featured);
          if(score<worst){worst=score;replaceIndex=index;}
        });
        if(replaceIndex>=0) tubeState.activeIds[replaceIndex]=id;
      }
      tubeState.activeSince[id]=now;
    });

    // The feed controls how much cognitive load the app presents today: 5, 6 or 7 cards.
    if(tubeState.activeIds.length>desired){
      const ranked=tubeState.activeIds
        .map((id,index)=>({id,index,score:priorityFor(id,featured)}))
        .sort((a,b)=>b.score-a.score || a.index-b.index)
        .slice(0,desired);
      const keep=new Set(ranked.map(x=>x.id));
      tubeState.activeIds=tubeState.activeIds.filter(id=>keep.has(id));
    }

    while(tubeState.activeIds.length<desired){
      const c=newestAvailable(tubeState.activeIds);
      if(!c)break;
      tubeState.activeIds.push(c.id);
      tubeState.activeSince[c.id]=now;
    }

    const originalNext=nextCardId;
    nextCardId=function(exclude){
      const c=newestAvailable(exclude);
      if(c){
        tubeState.activeSince[c.id]=Date.now();
        return c.id;
      }
      const id=originalNext(exclude);
      tubeState.activeSince[id]=Date.now();
      return id;
    };

    tubeState.visibleCount=desired;
    tubeState.remoteFeedVersion=String(feed.version||feed.generatedAt||'');
    saveStore('tubeState',tubeState);
    if(typeof renderDeck==='function'&&currentScreen==='tube')renderDeck();
    if(typeof updateHome==='function')updateHome();
  }catch(e){
    // Offline-safe: the bundled cards and saved state continue to work.
  }
})();
