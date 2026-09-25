/* HOME Learning Engine v10 — diverse adaptive learning, semantic answer review, anti-repeat policy. */
(function(){
  'use strict';
  if(window.__HOME_LEARNING_ENGINE_V10__)return;window.__HOME_LEARNING_ENGINE_V10__=true;

  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const BEHAVIOUR_KEY='homeBehaviourProfileV4';
  const SEMANTIC_JOURNAL_KEY='homeSemanticReviewJournalV10';
  const SEMANTIC_PROFILE_KEY='homeSemanticLearningProfileV10';
  const DECISION_KEY='homeLearningDecisionHistoryV10';
  const pending=new Map(), decisions=new Map();

  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const log=(type,data)=>{try{window.homeAdaptiveLog&&window.homeAdaptiveLog(type,data||{})}catch(e){}};

  function recent(days=21){const since=Date.now()-days*86400000,v=load(ACTIVITY_KEY,[]);return Array.isArray(v)?v.filter(x=>Number(x.at)>=since):[]}
  function decisionHistory(){const v=load(DECISION_KEY,[]);return Array.isArray(v)?v:[]}
  function semanticJournal(){const v=load(SEMANTIC_JOURNAL_KEY,[]);return Array.isArray(v)?v:[]}

  function semanticProfile(){
    const rows=semanticJournal().slice(-30), reviews=rows.map(x=>x.review).filter(Boolean);
    if(!reviews.length)return{version:10,count:0,stage:'building',overall:null,understanding:null,application:null,precision:null,depth:null,nextFocus:null};
    const vals=k=>reviews.map(r=>Number(r[k])).filter(Number.isFinite);
    const app=reviews.filter(r=>r.applicationObserved===true).map(r=>Number(r.application)).filter(Number.isFinite);
    const counts={};reviews.slice(-8).forEach(r=>{const k=String(r.nextFocus||'');if(k)counts[k]=(counts[k]||0)+1});
    const overall=Math.round(avg(vals('overall'))||0),understanding=Math.round(avg(vals('understanding'))||0),precision=Math.round(avg(vals('precision'))||0),depth=Math.round(avg(vals('depth'))||0),application=app.length?Math.round(avg(app)):null;
    const nextFocus=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||reviews.at(-1)?.nextFocus||null;
    let stage='developing';if(reviews.length<2)stage='building';else if(overall>=86&&understanding>=82&&precision>=78)stage='advanced';else if(overall<62)stage='foundation';
    const out={version:10,count:reviews.length,stage,overall,understanding,application,precision,depth,nextFocus,updatedAt:Date.now()};
    save(SEMANTIC_PROFILE_KEY,out);try{Native?.saveState&&Native.saveState('semanticLearningProfileV10',JSON.stringify(out))}catch(e){}return out;
  }

  function signals(){
    const b=load(BEHAVIOUR_KEY,{})||{},s=semanticProfile(),rows=recent();
    const opens=rows.filter(x=>x.type==='tube_card_open').length,done=rows.filter(x=>x.type==='tube_complete');
    const scores=done.map(x=>Number(x.data?.score)).filter(Number.isFinite),dwell=rows.filter(x=>x.type==='tube_reader_dwell').map(x=>Number(x.data?.ms)/1000).filter(x=>x>2&&x<1800);
    return{opens,completions:done.length,completionRate:b.tube?.completionRate??(opens?done.length/opens:null),avgScore:b.tube?.avgQuizScore??avg(scores),readerSeconds:b.tube?.avgReaderSeconds??avg(dwell),scrollDepth:b.tube?.avgScrollDepth??null,...s};
  }

  function chooseLength(s){
    let level='balanced',sections=3,targetWords=14;
    const enough=s.opens>=4||s.completions>=3;
    const low=enough&&s.completionRate!=null&&s.completionRate<.40;
    const short=enough&&s.readerSeconds!=null&&s.readerSeconds<42;
    const strong=s.count>=2&&s.overall!=null&&s.overall>=82&&s.depth!=null&&s.depth>=74;
    if(low||short){level='micro';sections=2;targetWords=10}
    else if(strong&&s.completionRate!=null&&s.completionRate>.72){level='deep';sections=5;targetWords=20}
    else if((strong||(s.avgScore!=null&&s.avgScore>=84))&&s.completionRate!=null&&s.completionRate>.58){level='expanded';sections=4;targetWords=17}
    return{level,sections,targetWords};
  }

  const METHODS=['quiz','recall','application','teachback','scenario','contrast','reflection','critique','prediction'];
  const labels={quiz:'Knowledge check',recall:'Recall',application:'Apply it',teachback:'Teach it',scenario:'Scenario',contrast:'Compare',reflection:'Your take',critique:'Challenge it',prediction:'Predict'};

  function methodScores(s){
    const q={quiz:1.5,recall:1.2,application:1.1,teachback:1.0,scenario:1.0,contrast:.9,reflection:1.15,critique:.8,prediction:.8};
    if(s.nextFocus==='understanding'||(s.understanding!=null&&s.understanding<68)){q.quiz+=2;q.recall+=2;q.teachback+=1.2}
    if(s.nextFocus==='application'||(s.application!=null&&s.application<68)){q.application+=2.4;q.scenario+=1.8;q.prediction+=.8}
    if(s.nextFocus==='precision'||(s.precision!=null&&s.precision<68)){q.contrast+=2;q.quiz+=1.2;q.critique+=1}
    if(s.nextFocus==='depth'||(s.depth!=null&&s.depth<70)){q.teachback+=2;q.critique+=1.5;q.prediction+=1.2}
    if(s.nextFocus==='advance'||s.stage==='advanced'){q.contrast+=1.8;q.critique+=1.8;q.prediction+=1.8;q.scenario+=1.2}
    if(s.completionRate!=null&&s.completionRate<.4){q.quiz+=.6;q.recall+=.6;q.reflection+=.7}
    return q;
  }

  function chooseMethod(s){
    const hist=decisionHistory().slice(-8), recentMethods=hist.map(x=>x.method), last=recentMethods.at(-1), prev=recentMethods.at(-2);
    const scores=methodScores(s);
    // Anti-lock: same method can never run 3 times in a row.
    if(last&&prev===last)scores[last]=-999;
    // Every 3 cards, bring back an objective knowledge check if none occurred recently.
    if(!recentMethods.slice(-3).includes('quiz'))scores.quiz+=3.2;
    // Ensure HOME also learns how the user thinks, not just what they remember.
    if(!recentMethods.slice(-4).some(m=>['reflection','critique','application','contrast','scenario','prediction'].includes(m)))scores.reflection+=2.6;
    // Controlled exploration: favour methods not used recently.
    METHODS.forEach(m=>{const age=[...recentMethods].reverse().indexOf(m);if(age<0)scores[m]+=1.1;else if(age>=4)scores[m]+=.55});
    const ranked=METHODS.filter(m=>scores[m]>-100).sort((a,b)=>scores[b]-scores[a]);
    const top=ranked.slice(0,Math.min(3,ranked.length));
    // Deterministic rotation across the top candidates avoids random-feeling UI while preserving variety.
    const index=(hist.length+s.count+s.completions)%Math.max(1,top.length);
    return top[index]||'quiz';
  }

  function quizModeFor(method,hist){
    if(method==='quiz')return hist.length%2===0?'mcq_sentence':'mcq';
    if(method==='recall')return hist.length%3===0?'flashcard':'reflection';
    return'reflection';
  }

  function decide(card){
    const s=signals(),hist=decisionHistory(),length=chooseLength(s),method=chooseMethod(s),quizMode=quizModeFor(method,hist);
    const d={at:Date.now(),cardId:card?.id||'',topic:card?.topic||'',method,quizMode,content:length.level,sectionLimit:length.sections,sentenceTargetWords:length.targetWords,signals:s};
    hist.push(d);save(DECISION_KEY,hist.slice(-120));if(card?.id)decisions.set(card.id,d);return d;
  }

  function promptFor(d,card){
    const t=String(card?.title||card?.topic||'this idea');
    switch(d.method){
      case'recall':return`Without looking back, explain the central mechanism behind “${t}” in your own words.`;
      case'application':return`Where in a real decision, project, habit, conversation or piece of work would “${t}” actually change what you do? Be specific.`;
      case'teachback':return`Explain “${t}” to an intelligent friend who has never heard of it. What must they understand for the idea to make sense?`;
      case'scenario':return`Imagine a realistic situation where “${t}” matters. What would you do, and why?`;
      case'contrast':return`What is the most plausible alternative to the idea in “${t}”? When would that alternative be better?`;
      case'reflection':return`What part of “${t}” most changes, confirms or challenges how you currently think? Explain why.`;
      case'critique':return`What is the strongest limitation, counterargument or condition under which “${t}” would fail?`;
      case'prediction':return`If the mechanism in “${t}” is true, what concrete result would you expect to observe next in the real world?`;
      case'quiz':return`After the knowledge check, explain briefly why the correct mechanism matters rather than just naming the answer.`;
      default:return`What is the most useful implication of “${t}” for how you think or act?`;
    }
  }

  function applyDecision(d){
    try{const t=window.HOMEAdaptive?.config?.tube;if(!t)return;t.quizMode=d.quizMode;t.sectionLimit=d.sectionLimit;t.sentenceTargetWords=d.sentenceTargetWords;t.readerDepth=d.content==='micro'?'compact':d.content==='deep'?'deep':'balanced'}catch(e){}
  }

  function cardForReader(){
    const id=document.getElementById('reader')?.dataset?.learningCardId||'';try{if(id&&cardMap?.[id])return cardMap[id]}catch(e){}
    const title=document.querySelector('#reader .hero h1')?.textContent?.trim()||'';try{return Object.values(cardMap||{}).find(x=>x&&x.title===title)||null}catch(e){return null}
  }

  function patchOpenCard(){
    if(typeof window.openCard!=='function'||window.openCard.__learningV10)return;
    const base=window.openCard;
    const wrapped=function(id,slot){
      let card=null;try{card=cardMap?.[id]||null}catch(e){}
      const d=decide(card);applyDecision(d);const r=base.apply(this,arguments);
      setTimeout(()=>{
        const reader=document.getElementById('reader');if(!reader)return;
        reader.dataset.learningCardId=String(id||'');reader.dataset.learningMethod=d.method;reader.dataset.learningDepth=d.content;
        const h=reader.querySelector('.adaptiveQuiz h2');if(h)h.textContent=labels[d.method]||'Learn';
        const p=reader.querySelector('.promptText');if(p)p.textContent=promptFor(d,card);
        const tiny=reader.querySelector('.tiny');if(tiny)tiny.textContent=`HOME chose ${labels[d.method]||d.method} · ${d.content} depth. It will vary the next interaction from your results.`;
      },0);
      log('learning_method_selected',{method:d.method,quizMode:d.quizMode,content:d.content,sections:d.sectionLimit,targetWords:d.sentenceTargetWords,topic:d.topic});return r;
    };
    wrapped.__learningV10=true;window.openCard=wrapped;
  }

  function captureSubmission(e){
    const button=e.target?.closest?.('#submit');if(!button||button.disabled)return;
    const ans=document.getElementById('answer');if(!ans||!ans.value.trim())return; // pure MCQ/flashcard has no semantic answer by design
    const card=cardForReader();if(!card)return;
    const reader=document.getElementById('reader'),selectedEl=reader?.querySelector('.option.selected'),selected=selectedEl?Number(selectedEl.dataset.n):null;
    const d=decisions.get(card.id)||decide(card),requestId=`sr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,attemptId=`attempt-${card.id}-${Date.now()}`;
    const ctx={requestId,attemptId,cardId:String(card.id||''),title:String(card.title||''),topic:String(card.topic||''),question:String(card.q||''),prompt:String(reader?.querySelector('.promptText')?.textContent||card.prompt||card.q||''),sentence:ans.value.trim(),selected:Number.isInteger(selected)?selected:null,correct:Number.isInteger(card.correct)?card.correct:null,options:Array.isArray(card.options)?card.options.slice(0,4):[],lead:String(card.lead||''),takeaway:String(card.takeaway||''),sections:(Array.isArray(card.sections)?card.sections:[]).slice(0,5).map(s=>Array.isArray(s)?[String(s[0]||''),String(s[1]||'').slice(0,900)]:s),method:d.method,contentDepth:d.content,at:Date.now(),fallbackHtml:''};
    pending.set(requestId,ctx);
    setTimeout(()=>{
      const fb=document.getElementById('feedback');if(fb){ctx.fallbackHtml=fb.innerHTML;fb.classList.add('show');fb.innerHTML='<h3>Reviewing your reasoning…</h3><p>HOME is judging the actual idea in your answer, not matching keywords.</p>'}
      try{if(typeof AdaptiveNative!=='undefined'&&typeof AdaptiveNative.reviewSentence==='function')AdaptiveNative.reviewSentence(JSON.stringify(ctx));else throw new Error('Semantic reviewer unavailable.')}catch(err){showError(ctx,String(err?.message||err))}
    },0);
  }

  function showError(ctx,message){const fb=document.getElementById('feedback');if(fb&&cardForReader()?.id===ctx.cardId){fb.classList.add('show');fb.innerHTML=(ctx.fallbackHtml||'<h3>Saved</h3>')+`<p class="tiny">AI review unavailable: ${esc(message)}.</p>`}pending.delete(ctx.requestId);log('sentence_review_error',{cardId:ctx.cardId,error:String(message).slice(0,120)})}

  function saveReview(ctx,result){
    const review=result.review||{},rows=semanticJournal();rows.push({at:Date.now(),cardId:ctx.cardId,title:ctx.title,topic:ctx.topic,method:ctx.method,review});save(SEMANTIC_JOURNAL_KEY,rows.slice(-120));const profile=semanticProfile();
    log('semantic_learning_updated',{count:profile.count,stage:profile.stage,overall:profile.overall,understanding:profile.understanding,application:profile.application,precision:profile.precision,depth:profile.depth,nextFocus:profile.nextFocus});return profile;
  }

  window.onHomeSentenceReview=function(result){
    result=result||{};const id=String(result.requestId||''),ctx=pending.get(id);if(!ctx)return;if(result.error){showError(ctx,String(result.error));return}if(!result.review){showError(ctx,'No semantic review returned');return}
    saveReview(ctx,result);const r=result.review,fb=document.getElementById('feedback');if(fb&&cardForReader()?.id===ctx.cardId){const app=r.applicationObserved?`<span class="pill">Application ${Number(r.application)||0}</span>`:'';fb.classList.add('show');fb.innerHTML=`<h3>${esc(String(r.verdict||'Reviewed').replace(/^./,c=>c.toUpperCase()))} · ${Number(r.overall)||0}/100</h3><p>${esc(r.feedback||'')}</p><div class="scoreline"><span class="pill">Understanding ${Number(r.understanding)||0}</span><span class="pill">Precision ${Number(r.precision)||0}</span><span class="pill">Depth ${Number(r.depth)||0}</span>${app}</div>${r.misconception?`<p><b>Watch:</b> ${esc(r.misconception)}</p>`:''}<p><b>Next focus:</b> ${esc(String(r.nextFocus||'advance'))}</p>`}
    pending.delete(id);
  };

  function init(){patchOpenCard();document.documentElement.dataset.homeLearningEngine='10';window.HOMELearningEngine={version:10,signals,profile:semanticProfile,decide}}
  document.addEventListener('click',captureSubmission,true);init();setTimeout(init,700);setTimeout(init,2200);setInterval(init,5000);
})();
