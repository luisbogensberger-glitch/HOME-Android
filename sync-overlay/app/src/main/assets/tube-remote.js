(async function(){
  const FEED_URL='https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/tube-feed.json';
  const DAY=24*60*60*1000;
  const now=Date.now();

  function recentCompleted(id){
    return Array.isArray(tubeState.completed)&&tubeState.completed.some(x=>x&&x.id===id&&now-Number(x.at||0)<14*DAY);
  }

  function newestAvailable(exclude){
    const blocked=new Set(exclude||[]);
    return cards.find(c=>c&&c.remote===true&&!blocked.has(c.id)&&!recentCompleted(c.id)) ||
           cards.find(c=>c&&!blocked.has(c.id)&&!recentCompleted(c.id)) || null;
  }

  try{
    const res=await fetch(FEED_URL+'?t='+now,{cache:'no-store'});
    if(!res.ok) throw new Error('feed '+res.status);
    const feed=await res.json();
    const remote=Array.isArray(feed.cards)?feed.cards:[];

    remote.slice().reverse().forEach(raw=>{
      if(!raw||!raw.id||!raw.title||!Array.isArray(raw.options)||raw.options.length!==4)return;
      const c={...raw,remote:true};
      const idx=cards.findIndex(x=>x.id===c.id);
      if(idx>=0)cards.splice(idx,1);
      cards.unshift(c);
      cardMap[c.id]=c;
    });

    if(!tubeState.activeSince||typeof tubeState.activeSince!=='object'){
      tubeState.activeSince={};
      (tubeState.activeIds||[]).forEach(id=>tubeState.activeSince[id]=now);
    }

    while(tubeState.activeIds.length<6){
      const c=newestAvailable(tubeState.activeIds);
      if(!c)break;
      tubeState.activeIds.push(c.id);
      tubeState.activeSince[c.id]=now;
    }

    for(let i=0;i<tubeState.activeIds.length;i++){
      const id=tubeState.activeIds[i];
      const born=Number(tubeState.activeSince[id]||now);
      if(!cardMap[id]||now-born>=7*DAY){
        const c=newestAvailable(tubeState.activeIds);
        if(c){
          tubeState.activeIds[i]=c.id;
          tubeState.activeSince[c.id]=now;
        }
      }
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

    tubeState.remoteFeedVersion=String(feed.version||feed.generatedAt||'');
    saveStore('tubeState',tubeState);
    if(typeof renderDeck==='function'&&currentScreen==='tube')renderDeck();
    if(typeof updateHome==='function')updateHome();
  }catch(e){
    // Offline-safe: the bundled cards and saved state continue to work.
  }
})();
