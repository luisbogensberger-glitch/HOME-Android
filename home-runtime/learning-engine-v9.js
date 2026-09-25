/* HOME Learning Engine v9 — semantic answer review + adaptive method/depth policy. */
(function(){
  'use strict';
  if(window.__HOME_LEARNING_ENGINE_V9__)return;window.__HOME_LEARNING_ENGINE_V9__=true;

  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const BEHAVIOUR_KEY='homeBehaviourProfileV4';
  const LOCAL_LEARNING_KEY='homeSentenceLearningProfileV7';
  const SEMANTIC_JOURNAL_KEY='homeSemanticReviewJournalV9';
  const SEMANTIC_PROFILE_KEY='homeSemanticLearningProfileV9';
  const DECISION_KEY='homeLearningDecisionHistoryV9';
  const pending=new Map();
  const decisions=new Map();

  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const log=(type,data)=>{try{if(window.homeAdaptiveLog)window.homeAdaptiveLog(type,data||{})}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function recent(days=21){
    const since=Date.now()-days*86400000,v=load(ACTIVITY_KEY,[]);
    return Array.isArray(v)?v.filter(x=>Number(x.at)>=since):[];
  }

  function semanticProfile(){
    const journal=load(SEMANTIC_JOURNAL_KEY,[]);const rows=Array.isArray(journal)?journal.slice(-30):[];
    if(!rows.length)return{version:9,count:0,stage:'building',overall:null,understanding:null,application:null,precision:null,depth:null,nextFocus:null,updatedAt:Date.now()};
    const reviews=rows.map(x=>x.review).filter(Boolean);const app=reviews.filter(x=>x.applicationObserved===true).map(x=>Number(x.application)).filter(Number.isFinite);
    const vals=k=>reviews.map(x=>Number(x[k])).filter(Number.isFinite);
    const focusCounts={};reviews.slice(-8).forEach(r=>{const k=String(r.nextFocus||'');if(k)focusCounts[k]=(focusCounts[k]||0)+1});
    const nextFocus=Object.entries(focusCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||reviews[reviews.length-1]?.nextFocus||null;
    const overall=Math.round(avg(vals('overall'))||0),understanding=Math.round(avg(vals('understanding'))||0),precision=Math.round(avg(vals('precision'))||0),depth=Math.round(avg(vals('depth'))||0),application=app.length?Math.round(avg(app)):null;
    let stage='developing';if(reviews.length<2)stage='building';else if(overall>=86&&understanding>=82&&precision>=78)stage='advanced';else if(overall<62)stage='foundation';
    const out={version:9,count:reviews.length,stage,overall,understanding,application,precision,depth,nextFocus,updatedAt:Date.now()};save(SEMANTIC_PROFILE_KEY,out);try{if(typeof Native!=='undefined'&&Native.saveState)Native.saveState('semanticLearningProfileV9',JSON.stringify(out))}catch(e){}return out;
  }

  function signals(){
    const b=load(BEHAVIOUR_KEY,{})||{},local=load(LOCAL_LEARNING_KEY,{})||{},semantic=semanticProfile(),rows=recent();
    const opens=rows.filter(x=>x.type==='tube_card_open').length,done=rows.filter(x=>x.type==='tube_complete');
    const scores=done.map(x=>Number(x.data?.score)).filter(Number.isFinite),dwell=rows.filter(x=>x.type==='tube_reader_dwell').map(x=>Number(x.data?.ms)/1000).filter(x=>x>2&&x<1800);
    return{
      opens,completions:done.length,
      completionRate:b.tube?.completionRate ?? (opens?done.length/opens:null),
      avgScore:b.tube?.avgQuizScore ?? avg(scores),readerSeconds:b.tube?.avgReaderSeconds ?? avg(dwell),scrollDepth:b.tube?.avgScrollDepth ?? null,
      stage:semantic.stage||local.stage||'building',semanticCount:semantic.count||0,sentenceCount:local.count||0,
      overall:semantic.overall,understanding:semantic.understanding,application:semantic.application,precision:semantic.precision,depth:semantic.depth,nextFocus:semantic.nextFocus,
      causalRate:local.causalRate ?? null,specificityRate:local.specificityRate ?? null
    };
  }

  function chooseLength(s){
    let level='balanced',sections=3,targetWords=14;
    const lowCompletion=s.completionRate!=null&&s.completionRate<.43,veryShort=s.readerSeconds!=null&&s.readerSeconds<48,heavyScroll=s.scrollDepth!=null&&s.scrollDepth>.82;
    const strongSemantic=s.semanticCount>=2&&s.overall!=null&&s.overall>=82&&s.depth!=null&&s.depth>=75;
    const strongFallback=s.avgScore!=null&&s.avgScore>=84;
    if(lowCompletion||veryShort||(heavyScroll&&!strongSemantic&&!strongFallback)){level='micro';sections=2;targetWords=10}
    else if(strongSemantic&&s.completionRate!=null&&s.completionRate>.68){level='deep';sections=5;targetWords=20}
    else if((strongSemantic||strongFallback)&&s.completionRate!=null&&s.completionRate>.58){level='expanded';sections=4;targetWords=17}
    return{level,sections,targetWords};
  }

  function chooseMethod(s){
    if(s.completionRate!=null&&s.completionRate<.38)return'quick_recall';
    if(s.semanticCount>=2){
      if(s.nextFocus==='understanding'||(s.understanding!=null&&s.understanding<68))return'retrieval';
      if(s.nextFocus==='application'||(s.application!=null&&s.application<68))return'application';
      if(s.nextFocus==='precision'||(s.precision!=null&&s.precision<68))return'precision';
      if(s.nextFocus==='depth'||(s.depth!=null&&s.depth<70))return'teachback';
      if(s.nextFocus==='advance')return s.semanticCount%2===0?'contrast':'scenario';
    }
    if(s.sentenceCount>=3){
      if(s.application!=null&&s.application<55)return'application';
      if(s.causalRate!=null&&s.causalRate<.45)return'teachback';
      if(s.specificityRate!=null&&s.specificityRate<.45)return'scenario';
    }
    if(s.avgScore!=null&&s.avgScore<66)return'retrieval';
    if(s.avgScore!=null&&s.avgScore>86&&s.completionRate!=null&&s.completionRate>.68)return'contrast';
    return'application';
  }

  function decide(card){
    const s=signals(),length=chooseLength(s),method=chooseMethod(s);let quizMode='reflection';
    if(method==='retrieval'&&s.semanticCount===0&&s.avgScore!=null&&s.avgScore<55)quizMode='mcq_sentence';
    const decision={at:Date.now(),cardId:card?.id||'',topic:card?.topic||'',method,content:length.level,sectionLimit:length.sections,sentenceTargetWords:length.targetWords,quizMode,signals:s};
    const hist=load(DECISION_KEY,[]),arr=Array.isArray(hist)?hist:[];arr.push(decision);save(DECISION_KEY,arr.slice(-100));if(card?.id)decisions.set(card.id,decision);return decision;
  }

  function promptFor(d,card){
    const topic=String(card?.title||card?.topic||'this idea');
    switch(d.method){
      case'retrieval':return`Without looking back, state the central mechanism behind “${topic}” in one precise sentence.`;
      case'teachback':return`Explain “${topic}” to an intelligent friend who has never heard of it. Make the causal logic clear.`;
      case'application':return`Apply “${topic}” to one real decision, project or situation you could actually face. What would you do differently?`;
      case'precision':return`State the idea behind “${topic}” precisely enough that it could not be confused with a similar concept.`;
      case'contrast':return`Contrast “${topic}” with the most plausible alternative approach. When would each work better?`;
      case'scenario':return`Imagine a realistic situation where “${topic}” matters. What is the best action, and why?`;
      default:return`Without looking back, give the most useful idea from “${topic}” in one precise sentence.`;
    }
  }
  function methodLabel(m){return({retrieval:'Recall',teachback:'Teach it',application:'Apply it',precision:'Make it precise',contrast:'Compare',scenario:'Scenario',quick_recall:'Quick recall'})[m]||'Recall'}
  function applyDecision(d){try{const t=window.HOMEAdaptive?.config?.tube;if(!t)return;t.quizMode=d.quizMode;t.sectionLimit=d.sectionLimit;t.sentenceTargetWords=d.sentenceTargetWords;t.readerDepth=d.content==='micro'?'compact':d.content==='deep'?'deep':'balanced'}catch(e){}}

  function cardForReader(){
    const id=document.getElementById('reader')?.dataset?.learningCardId||'';try{if(id&&cardMap?.[id])return cardMap[id]}catch(e){}
    const title=document.querySelector('#reader .hero h1')?.textContent?.trim()||'';try{return Object.values(cardMap||{}).find(x=>x&&x.title===title)||null}catch(e){return null}
  }

  function patchOpenCard(){
    if(typeof window.openCard!=='function'||window.openCard.__learningV9)return;
    const base=window.openCard;const wrapped=function(id,slot){let card=null;try{card=cardMap?.[id]||null}catch(e){}const d=decide(card);applyDecision(d);const r=base.apply(this,arguments);setTimeout(()=>{const reader=document.getElementById('reader');if(!reader)return;reader.dataset.learningCardId=String(id||'');reader.dataset.learningMethod=d.method;reader.dataset.learningDepth=d.content;const title=reader.querySelector('.adaptiveQuiz h2');if(title)title.textContent=methodLabel(d.method);const prompt=reader.querySelector('.promptText');if(prompt)prompt.textContent=promptFor(d,card);const tiny=reader.querySelector('.tiny');if(tiny)tiny.textContent=`HOME chose ${methodLabel(d.method)} · ${d.content} depth from your recent learning behaviour.`},0);log('learning_method_selected',{method:d.method,content:d.content,sections:d.sectionLimit,targetWords:d.sentenceTargetWords,topic:d.topic});return r};wrapped.__learningV9=true;window.openCard=wrapped;
  }

  function enrichAttempt(value){
    const p=window.__HOME_PENDING_REVIEW_V9__;if(!p||!value||!Array.isArray(value.completed)||!value.completed.length)return value;
    const latest=value.completed[value.completed.length-1];if(!latest||latest.id!==p.cardId||latest.sentence)return value;
    p.at=Number(latest.at)||Date.now();p.attemptId=`attempt-${p.cardId}-${p.at}`;
    Object.assign(latest,{cardId:p.cardId,topic:p.topic,question:p.question,prompt:p.prompt,sentence:p.sentence,selected:p.selected,correct:p.correct,learningMethod:p.method,contentDepth:p.contentDepth,reviewRequestId:p.requestId,attemptId:p.attemptId,context:{lead:p.lead,takeaway:p.takeaway,sections:p.sections}});
    return value;
  }

  function patchSaveStore(){
    if(typeof window.saveStore!=='function'||window.saveStore.__learningV9)return;const base=window.saveStore;const wrapped=function(key,value){if(key==='tubeState')try{enrichAttempt(value)}catch(e){}return base.apply(this,arguments)};wrapped.__learningV9=true;window.saveStore=wrapped;
  }

  function captureSubmission(e){
    const button=e.target?.closest?.('#submit');if(!button||button.disabled)return;const ans=document.getElementById('answer');if(!ans||!ans.value.trim())return;
    const card=cardForReader();if(!card)return;const reader=document.getElementById('reader'),selectedEl=reader?.querySelector('.option.selected');const selected=selectedEl?Number(selectedEl.dataset.n):null;const decision=decisions.get(card.id)||decide(card);const requestId=`sr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const ctx={requestId,cardId:String(card.id||''),title:String(card.title||''),topic:String(card.topic||''),question:String(card.q||''),prompt:String(reader?.querySelector('.promptText')?.textContent||card.prompt||card.q||''),sentence:ans.value.trim(),selected:Number.isInteger(selected)?selected:null,correct:Number.isInteger(card.correct)?card.correct:null,options:Array.isArray(card.options)?card.options.slice(0,4):[],lead:String(card.lead||''),takeaway:String(card.takeaway||''),sections:(Array.isArray(card.sections)?card.sections:[]).slice(0,5).map(s=>Array.isArray(s)?[String(s[0]||''),String(s[1]||'').slice(0,900)]:s),method:decision.method,contentDepth:decision.content,at:0,attemptId:'',fallbackHtml:''};
    pending.set(requestId,ctx);window.__HOME_PENDING_REVIEW_V9__=ctx;
    setTimeout(()=>{
      const fb=document.getElementById('feedback');if(fb){ctx.fallbackHtml=fb.innerHTML;fb.classList.add('show');fb.innerHTML='<h3>Reviewing your reasoning…</h3><p>HOME is reading the actual answer, not matching keywords.</p>'}
      try{
        if(typeof AdaptiveNative!=='undefined'&&AdaptiveNative&&typeof AdaptiveNative.reviewSentence==='function')AdaptiveNative.reviewSentence(JSON.stringify(ctx));
        else throw new Error('Install the latest HOME APK to enable semantic review.');
      }catch(err){showReviewError(ctx,String(err?.message||err||'Semantic review unavailable.'))}
    },0);
  }

  function showReviewError(ctx,message){
    const fb=document.getElementById('feedback');if(fb&&cardForReader()?.id===ctx.cardId){fb.classList.add('show');fb.innerHTML=(ctx.fallbackHtml||'<h3>Saved</h3>')+`<p class="tiny">AI review unavailable: ${esc(message)} Local fallback score was kept.</p>`}pending.delete(ctx.requestId);log('sentence_review_error',{cardId:ctx.cardId,error:String(message).slice(0,120)})
  }

  function saveSemanticReview(ctx,result){
    const review=result.review||{};const journal=load(SEMANTIC_JOURNAL_KEY,[]),arr=Array.isArray(journal)?journal:[];arr.push({at:Date.now(),cardId:ctx.cardId,title:ctx.title,topic:ctx.topic,method:ctx.method,review});save(SEMANTIC_JOURNAL_KEY,arr.slice(-120));const profile=semanticProfile();
    try{let state=typeof tubeState!=='undefined'?tubeState:null;if(state&&Array.isArray(state.completed)){const item=state.completed.slice().reverse().find(x=>x.reviewRequestId===ctx.requestId||((x.id===ctx.cardId)&&Math.abs(Number(x.at||0)-Number(ctx.at||0))<5000));if(item){item.semanticReview=review;item.semanticReviewedAt=Date.now();let score=Number(review.overall)||0;if(item.mode==='mcq_sentence'&&Number.isInteger(ctx.selected)&&Number.isInteger(ctx.correct))score=(ctx.selected===ctx.correct?40:0)+Math.round((Number(review.overall)||0)*.6);item.semanticScore=score;item.total=score;saveStore('tubeState',state)}}}catch(e){}
    log('semantic_learning_updated',{count:profile.count,stage:profile.stage,overall:profile.overall,understanding:profile.understanding,application:profile.application,precision:profile.precision,depth:profile.depth,nextFocus:profile.nextFocus});return profile;
  }

  window.onHomeSentenceReview=function(result){
    result=result||{};const requestId=String(result.requestId||''),ctx=pending.get(requestId)||window.__HOME_PENDING_REVIEW_V9__;if(!ctx)return;if(result.error){showReviewError(ctx,String(result.error));return}if(!result.review){showReviewError(ctx,'No semantic review returned.');return}
    saveSemanticReview(ctx,result);const r=result.review,fb=document.getElementById('feedback');if(fb&&cardForReader()?.id===ctx.cardId){const app=r.applicationObserved?`<span class="pill">Application ${Number(r.application)||0}</span>`:'';fb.classList.add('show');fb.innerHTML=`<h3>${esc(String(r.verdict||'Reviewed').replace(/^./,c=>c.toUpperCase()))} · ${Number(r.overall)||0}/100</h3><p>${esc(r.feedback||'')}</p><div class="scoreline"><span class="pill">Understanding ${Number(r.understanding)||0}</span><span class="pill">Precision ${Number(r.precision)||0}</span><span class="pill">Depth ${Number(r.depth)||0}</span>${app}</div>${r.misconception?`<p><b>Watch:</b> ${esc(r.misconception)}</p>`:''}<p><b>Next focus:</b> ${esc(String(r.nextFocus||'advance'))}</p>`}
    pending.delete(requestId);if(window.__HOME_PENDING_REVIEW_V9__?.requestId===requestId)window.__HOME_PENDING_REVIEW_V9__=null;
  };

  function expose(){window.HOMELearningEngine={version:9,signals,profile:semanticProfile,decide:(card)=>decide(card||null),refresh:()=>{patchOpenCard();patchSaveStore();return signals()}};document.documentElement.dataset.homeLearningEngine='9'}
  function init(){patchSaveStore();patchOpenCard();expose()}
  document.addEventListener('click',captureSubmission,true);
  init();setTimeout(init,700);setTimeout(init,2200);setInterval(init,5000);
})();
