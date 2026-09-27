/* HOME Learning Resilience v11 — durable written attempts without a background repair loop. */
(function(){
  'use strict';
  if(window.__HOME_LEARNING_RESILIENCE_V11__)return;window.__HOME_LEARNING_RESILIENCE_V11__=true;
  const VERSION=11,RAW_KEY='homeRawLearningAttemptsV11',MAX_ROWS=160;
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')??f}catch(_){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){} };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const log=(type,data)=>{try{window.homeAdaptiveLog?.(type,data||{})}catch(_){} };
  function cardForReader(){
    const reader=document.getElementById('reader'),id=reader?.dataset?.learningCardId||'';
    try{if(id&&typeof cardMap!=='undefined'&&cardMap?.[id])return cardMap[id]}catch(_){}
    const title=reader?.querySelector('.hero h1')?.textContent?.trim()||'';
    try{return Object.values(cardMap||{}).find(x=>x&&x.title===title)||null}catch(_){return null}
  }
  function rows(){const v=load(RAW_KEY,[]);return Array.isArray(v)?v:[]}
  function persist(list){
    const trimmed=list.slice(-MAX_ROWS);save(RAW_KEY,trimmed);
    try{Native?.saveState?.('rawLearningAttemptsV11',JSON.stringify(trimmed))}catch(_){}
  }
  function selection(reader){const el=reader?.querySelector('.option.selected'),n=el?Number(el.dataset.n):null;return Number.isInteger(n)?n:null}
  function mirrorCompletion(card,sentence,selected,correct,at){
    setTimeout(()=>{
      try{
        if(typeof tubeState==='undefined'||!Array.isArray(tubeState?.completed))return;
        const row=[...tubeState.completed].reverse().find(x=>String(x?.id||'')===String(card.id||'')&&Math.abs(Number(x?.at||0)-at)<5000);
        if(!row)return;
        row.sentence=sentence;row.selected=selected;row.correct=correct;row.quizCorrect=Number.isInteger(selected)&&Number.isInteger(correct)?selected===correct:null;row.reviewStatus=row.reviewStatus||'pending';
        if(typeof saveStore==='function')saveStore('tubeState',tubeState);else{const raw=JSON.stringify(tubeState);localStorage.setItem('tubeState',raw);try{Native?.saveState?.('tubeState',raw)}catch(_){}}
      }catch(_){}
    },0);
  }
  function captureRawAttempt(e){
    const button=e.target?.closest?.('#submit');if(!button||button.disabled)return;
    const sentence=document.getElementById('answer')?.value?.trim()||'';if(!sentence)return;
    const card=cardForReader();if(!card)return;
    const reader=document.getElementById('reader'),selected=selection(reader),correct=Number.isInteger(card.correct)?card.correct:null,at=Date.now(),list=rows();
    list.push({id:`local-${String(card.id||'card')}-${at}`,at,cardId:String(card.id||''),title:String(card.title||''),topic:String(card.topic||''),method:String(reader?.dataset?.learningMethod||''),contentDepth:String(reader?.dataset?.learningDepth||''),prompt:String(reader?.querySelector('.promptText')?.textContent||card.prompt||card.q||''),sentence,selected,correct,quizCorrect:Number.isInteger(selected)&&Number.isInteger(correct)?selected===correct:null,reviewStatus:'pending',review:null});
    persist(list);mirrorCompletion(card,sentence,selected,correct,at);log('learning_raw_attempt_saved',{cardId:String(card.id||''),method:String(reader?.dataset?.learningMethod||''),hasQuiz:Number.isInteger(selected),chars:sentence.length});
  }
  function latestPending(cardId,withinMs=5*60*1000){const list=rows();for(let i=list.length-1;i>=0;i--){const r=list[i];if(String(r.cardId||'')===String(cardId||'')&&r.reviewStatus==='pending'&&Date.now()-Number(r.at||0)<=withinMs)return{list,index:i,row:r}}return null}
  function markResult(result){
    const cardId=String(result?.cardId||cardForReader()?.id||''),hit=latestPending(cardId);if(!hit)return null;
    if(result?.review){hit.row.reviewStatus='reviewed';hit.row.review=result.review;hit.row.reviewedAt=Date.now()}
    else if(result?.error){hit.row.reviewStatus='pending';hit.row.lastReviewError=String(result.error).slice(0,300);hit.row.lastReviewAttemptAt=Date.now()}
    persist(hit.list);return hit.row;
  }
  function renderPending(result,row){
    const fb=document.getElementById('feedback');if(!fb)return;
    const hasQuiz=Number.isInteger(row?.selected)&&Number.isInteger(row?.correct),quizText=hasQuiz?(row.selected===row.correct?'✓ Quiz answer correct':'Quiz answer recorded'):'Answer saved';
    const status=String(result?.error||'AI review unavailable').replace(/HOME Sync failed\s*\([^)]*\)\s*:\s*/i,'').slice(0,220);
    fb.classList.add('show');fb.innerHTML=`<h3>${esc(quizText)}</h3><p>Your written answer is saved, but HOME could not perform the semantic AI review right now.</p><div class="scoreline"><span class="pill">Written answer · pending review</span></div><p><b>No sentence score was guessed.</b> HOME will keep the answer and can review it later when the reviewer is available.</p><p class="tiny">Reviewer status: ${esc(status)}</p>`;
  }
  function wrapReviewCallback(){
    const base=window.onHomeSentenceReview;if(typeof base!=='function'||base.__homeResilienceV11)return false;
    const wrapped=function(result){const row=markResult(result||{}),out=base.apply(this,arguments);if(result?.error)setTimeout(()=>renderPending(result,row),0);return out};
    wrapped.__homeResilienceV11=true;wrapped.__base=base;window.onHomeSentenceReview=wrapped;return true;
  }
  function objectiveProfile(){
    const recent=rows().slice(-40),withQuiz=recent.filter(r=>typeof r.quizCorrect==='boolean'),method={};
    recent.forEach(r=>{const m=String(r.method||'unknown'),x=method[m]||(method[m]={attempts:0,quizCorrect:0,quizN:0,reviewed:0,semanticTotal:0});x.attempts++;if(typeof r.quizCorrect==='boolean'){x.quizN++;if(r.quizCorrect)x.quizCorrect++}if(r.review&&Number.isFinite(Number(r.review.overall))){x.reviewed++;x.semanticTotal+=Number(r.review.overall)}});
    Object.values(method).forEach(x=>{x.quizAccuracy=x.quizN?Math.round(100*x.quizCorrect/x.quizN):null;x.semanticAverage=x.reviewed?Math.round(x.semanticTotal/x.reviewed):null;delete x.semanticTotal});
    return{version:VERSION,attempts:recent.length,quizAccuracy:withQuiz.length?Math.round(100*withQuiz.filter(r=>r.quizCorrect).length/withQuiz.length):null,methods:method,reviewed:recent.filter(r=>r.reviewStatus==='reviewed').length,pending:recent.filter(r=>r.reviewStatus==='pending').length};
  }
  document.addEventListener('click',captureRawAttempt,true);
  wrapReviewCallback();setTimeout(wrapReviewCallback,0);
  window.HOMELearningResilience={version:VERSION,profile:objectiveProfile,attempts:()=>rows().map(r=>({...r}))};
  document.documentElement.dataset.homeLearningResilience=String(VERSION);
  log('learning_resilience_ready',{version:VERSION,mode:'event-driven'});
})();
