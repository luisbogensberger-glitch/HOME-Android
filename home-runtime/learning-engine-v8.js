/* HOME Learning Engine v8 — chooses learning method, depth and friction from behaviour. */
(function(){
  'use strict';
  if(window.__HOME_LEARNING_ENGINE_V8__)return;window.__HOME_LEARNING_ENGINE_V8__=true;

  const ACTIVITY_KEY='homeAdaptiveActivityV1';
  const BEHAVIOUR_KEY='homeBehaviourProfileV4';
  const LOCAL_LEARNING_KEY='homeSentenceLearningProfileV7';
  const SEMANTIC_KEY='homeSemanticLearningProfileV8';
  const DECISION_KEY='homeLearningDecisionHistoryV8';

  const load=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v??f}catch(e){return f}};
  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const log=(type,data)=>{try{if(window.homeAdaptiveLog)window.homeAdaptiveLog(type,data||{})}catch(e){}};

  function recent(days=21){
    const since=Date.now()-days*86400000,v=load(ACTIVITY_KEY,[]);
    return Array.isArray(v)?v.filter(x=>Number(x.at)>=since):[];
  }
  function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}

  function signals(){
    const b=load(BEHAVIOUR_KEY,{})||{};
    const local=load(LOCAL_LEARNING_KEY,{})||{};
    const semantic=load(SEMANTIC_KEY,{})||{};
    const rows=recent();
    const opens=rows.filter(x=>x.type==='tube_card_open').length;
    const done=rows.filter(x=>x.type==='tube_complete');
    const scores=done.map(x=>Number(x.data?.score)).filter(Number.isFinite);
    const dwell=rows.filter(x=>x.type==='tube_reader_dwell').map(x=>Number(x.data?.ms)/1000).filter(x=>x>2&&x<1800);
    return {
      opens,
      completions:done.length,
      completionRate:b.tube?.completionRate ?? (opens?done.length/opens:null),
      avgScore:b.tube?.avgQuizScore ?? avg(scores),
      readerSeconds:b.tube?.avgReaderSeconds ?? avg(dwell),
      scrollDepth:b.tube?.avgScrollDepth ?? null,
      stage:semantic.stage||local.stage||'building',
      understanding:semantic.understanding ?? semantic.avgUnderstanding ?? null,
      application:semantic.application ?? semantic.avgApplication ?? (local.applicationRate!=null?Math.round(local.applicationRate*100):null),
      precision:semantic.precision ?? semantic.avgPrecision ?? null,
      depth:semantic.depth ?? semantic.avgDepth ?? local.avgDepth ?? null,
      causalRate:local.causalRate ?? null,
      specificityRate:local.specificityRate ?? null,
      semanticCount:semantic.count||0,
      sentenceCount:local.count||0
    };
  }

  function chooseLength(s){
    let level='balanced',sections=3,targetWords=14;
    const lowCompletion=s.completionRate!=null&&s.completionRate<.43;
    const veryShort=s.readerSeconds!=null&&s.readerSeconds<48;
    const heavyScroll=s.scrollDepth!=null&&s.scrollDepth>.82;
    const strong=s.avgScore!=null&&s.avgScore>=84;
    const deep=s.depth!=null&&s.depth>=78;

    if(lowCompletion||veryShort||(heavyScroll&&!strong)){
      level='micro';sections=2;targetWords=10;
    }else if(strong&&deep&&s.completionRate!=null&&s.completionRate>.68){
      level='deep';sections=5;targetWords=20;
    }else if(strong&&s.completionRate!=null&&s.completionRate>.58){
      level='expanded';sections=4;targetWords=17;
    }
    return{level,sections,targetWords};
  }

  function chooseMethod(s){
    /* Prefer the weakest useful skill, not the most entertaining format. */
    if(s.semanticCount>=2){
      if(s.understanding!=null&&s.understanding<68)return'retrieval';
      if(s.application!=null&&s.application<68)return'application';
      if(s.precision!=null&&s.precision<68)return'precision';
      if(s.depth!=null&&s.depth<70)return'teachback';
    }
    if(s.sentenceCount>=3){
      if(s.application!=null&&s.application<55)return'application';
      if(s.causalRate!=null&&s.causalRate<.45)return'teachback';
      if(s.specificityRate!=null&&s.specificityRate<.45)return'scenario';
    }
    if(s.avgScore!=null&&s.avgScore<66)return'retrieval';
    if(s.avgScore!=null&&s.avgScore>86&&s.completionRate!=null&&s.completionRate>.68)return'contrast';
    if(s.completionRate!=null&&s.completionRate<.42)return'quick_recall';
    return'application';
  }

  function decide(card){
    const s=signals(),length=chooseLength(s),method=chooseMethod(s);
    let quizMode='reflection';
    if(method==='retrieval')quizMode=(s.avgScore!=null&&s.avgScore<55)?'mcq_sentence':'reflection';
    if(method==='quick_recall')quizMode='reflection';
    if(method==='contrast'||method==='application'||method==='scenario'||method==='teachback'||method==='precision')quizMode='reflection';

    const decision={
      at:Date.now(),cardId:card?.id||'',topic:card?.topic||'',method,
      content:length.level,sectionLimit:length.sections,sentenceTargetWords:length.targetWords,
      quizMode,signals:s
    };
    const hist=load(DECISION_KEY,[]);const arr=Array.isArray(hist)?hist:[];arr.push(decision);save(DECISION_KEY,arr.slice(-100));
    return decision;
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
      default:return`In one sentence, recall the most useful idea from “${topic}” without copying the wording.`;
    }
  }

  function methodLabel(method){
    return({retrieval:'Recall',teachback:'Teach it',application:'Apply it',precision:'Make it precise',contrast:'Compare',scenario:'Scenario',quick_recall:'Quick recall'})[method]||'Recall';
  }

  function applyDecisionBeforeOpen(d){
    try{
      const t=window.HOMEAdaptive?.config?.tube;if(!t)return;
      t.quizMode=d.quizMode;
      t.sectionLimit=d.sectionLimit;
      t.sentenceTargetWords=d.sentenceTargetWords;
      t.readerDepth=d.content==='micro'?'compact':d.content==='deep'?'deep':'balanced';
    }catch(e){}
  }

  function patchOpenCard(){
    if(typeof window.openCard!=='function'||window.openCard.__learningV8)return;
    const base=window.openCard;
    const wrapped=function(id,slot){
      let card=null;try{card=cardMap?.[id]||null}catch(e){}
      const d=decide(card);applyDecisionBeforeOpen(d);
      const r=base.apply(this,arguments);
      setTimeout(()=>{
        const reader=document.getElementById('reader');if(!reader)return;
        const title=reader.querySelector('.adaptiveQuiz h2');if(title)title.textContent=methodLabel(d.method);
        const prompt=reader.querySelector('.promptText');if(prompt)prompt.textContent=promptFor(d,card);
        const tiny=reader.querySelector('.tiny');if(tiny)tiny.textContent=`HOME chose ${methodLabel(d.method)} · ${d.content} depth from your recent learning behaviour.`;
        reader.dataset.learningMethod=d.method;reader.dataset.learningDepth=d.content;
      },0);
      log('learning_method_selected',{method:d.method,content:d.content,sections:d.sectionLimit,targetWords:d.sentenceTargetWords,topic:d.topic});
      return r;
    };
    wrapped.__learningV8=true;window.openCard=wrapped;
  }

  function expose(){
    const s=signals();
    window.HOMELearningEngine={
      version:8,
      signals:()=>signals(),
      decide:(card)=>decide(card||null),
      current:s,
      refresh:()=>{patchOpenCard();return signals()}
    };
    document.documentElement.dataset.homeLearningEngine='8';
  }

  function init(){patchOpenCard();expose()}
  init();setTimeout(init,700);setTimeout(init,2200);setInterval(init,5000);
})();
