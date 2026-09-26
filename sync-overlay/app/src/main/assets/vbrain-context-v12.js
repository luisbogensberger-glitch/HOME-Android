/* V-Brain Context v12 — redundant private text/learning sync + task link enhancement. */
(function(){
  'use strict';
  if(window.__VBRAIN_CONTEXT_V12__)return;window.__VBRAIN_CONTEXT_V12__=true;
  const BLOCK=/(password|passwd|token|secret|auth|credential|cookie|session|bearer|api[_-]?key|otp|pin)/i;
  const timers=new WeakMap(),sent=new Map();
  const now=()=>Date.now();
  const screen=()=>String(window.currentScreen||document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'unknown');
  const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
  const log=(type,data)=>{try{window.homeAdaptiveLog?.(type,data||{})}catch(e){}};
  const fieldMeta=el=>{const raw=[el?.id,el?.name,el?.dataset?.field,el?.getAttribute?.('aria-label'),el?.getAttribute?.('placeholder')].filter(Boolean).join('|')||el?.tagName||'field';return{screen:screen(),field:String(raw).slice(0,180),type:String(el?.type||el?.tagName||'').toLowerCase()}};
  function eligible(el){if(!el)return false;const tag=String(el.tagName||'').toLowerCase(),type=String(el.type||'text').toLowerCase(),meta=[el.id,el.name,el.className,el.getAttribute?.('autocomplete'),el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder')].join(' ');if(BLOCK.test(meta)||type==='password'||type==='hidden')return false;return tag==='textarea'||el.isContentEditable||(tag==='input'&&['text','search','url'].includes(type))}
  const textOf=el=>String(el?.isContentEditable?el.innerText:el?.value??'').slice(0,6000);

  function privateSync(el,reason){
    if(!eligible(el)||typeof AdaptiveNative==='undefined'||typeof AdaptiveNative.logPrivateActivity!=='function')return;
    const meta=fieldMeta(el),text=textOf(el),key=meta.screen+'|'+meta.field;if(sent.get(key)===text)return;sent.set(key,text);
    const payload={id:'ctx-'+hash(key+'|'+text),kind:'private_text_field',source:'vbrain-v12',at:now(),screen:meta.screen,field:meta.field,fieldType:meta.type,reason:String(reason||'draft'),text};
    try{if(typeof currentTodoDetailId!=='undefined'&&currentTodoDetailId)payload.taskId=String(currentTodoDetailId)}catch(e){}
    try{AdaptiveNative.logPrivateActivity(JSON.stringify(payload))}catch(e){}
    if(el.id==='detailPersonalNote'){
      try{if(typeof todoState!=='undefined'&&typeof AdaptiveNative.saveTodoState==='function')AdaptiveNative.saveTodoState(JSON.stringify(todoState))}catch(e){}
    }
    log('private_context_synced',{screen:meta.screen,field:meta.field,chars:text.length,reason:String(reason||'draft')});
  }
  function schedule(el,instant,reason){if(!eligible(el))return;const old=timers.get(el);if(old)clearTimeout(old);timers.set(el,setTimeout(()=>privateSync(el,reason),instant?0:1250))}

  function currentTubeCard(){
    const title=document.querySelector('#reader .hero h1')?.textContent?.trim()||'';if(!title)return null;
    try{if(typeof cardMap!=='undefined'&&cardMap){const all=Object.values(cardMap);return all.find(c=>c&&String(c.title||'').trim()===title)||null}}catch(e){}
    try{if(Array.isArray(window.cards))return window.cards.find(c=>c&&String(c.title||'').trim()===title)||null}catch(e){}
    return null;
  }
  function selectedOption(){const o=document.querySelector('#reader .option.selected');return o?Number(o.dataset.n):null}
  function completedAttempt(card){
    try{const rows=Array.isArray(tubeState?.completed)?tubeState.completed:[];for(let i=rows.length-1;i>=0;i--){const x=rows[i];if(x&&String(x.id)===String(card.id)&&now()-Number(x.at||0)<15000)return x}}catch(e){}return null;
  }
  function persistTubeSentence(card,sentence,selected,capturedAt){
    if(!card||!sentence.trim())return;
    setTimeout(()=>{
      const done=completedAttempt(card),at=Number(done?.at||capturedAt),attemptId=`attempt-${String(card.id||'card')}-${at}`;
      const payload={requestId:'review-'+attemptId,attemptId,cardId:String(card.id||''),title:String(card.title||''),topic:String(card.topic||''),prompt:String(card.prompt||''),question:String(card.q||''),sentence:sentence.trim(),method:'tube',contentDepth:String(window.HOMEAdaptive?.config?.tube?.readerDepth||'balanced'),at};
      if(Number.isFinite(selected)){payload.selected=selected;if(Number.isFinite(Number(card.correct))){payload.correct=Number(card.correct);payload.quizCorrect=selected===Number(card.correct)}}
      let review=false,privateOk=false;
      try{if(typeof AdaptiveNative!=='undefined'&&typeof AdaptiveNative.reviewSentence==='function'){AdaptiveNative.reviewSentence(JSON.stringify(payload));review=true}}catch(e){}
      try{if(typeof AdaptiveNative!=='undefined'&&typeof AdaptiveNative.logPrivateActivity==='function'){AdaptiveNative.logPrivateActivity(JSON.stringify({id:'tube-text-'+hash(attemptId+'|'+sentence),kind:'private_text_field',source:'vbrain-tube-v12',at,screen:'tube',field:'tube_sentence',fieldType:'textarea',reason:'submit',cardId:String(card.id||''),title:String(card.title||''),text:sentence.trim()}));privateOk=true}}catch(e){}
      log('tube_text_sync',{cardId:String(card.id||''),attemptId,chars:sentence.trim().length,reviewChannel:review,privateChannel:privateOk});
    },90);
  }
  function captureTubeSubmit(e){
    const submit=e.target?.closest?.('#reader #submit');if(!submit)return;const ans=document.querySelector('#reader #answer');if(!ans)return;const sentence=String(ans.value||'').trim();if(!sentence)return;const card=currentTubeCard();if(!card)return;persistTubeSentence(card,sentence,selectedOption(),now());
  }

  function urlsFrom(text){return [...new Set(String(text||'').match(/https?:\/\/[^\s<>"')]+/gi)||[])].slice(0,8)}
  function labelFor(url){try{const u=new URL(url),slug=u.pathname.split('/').filter(Boolean).pop()||'';if(slug){const words=slug.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());return words.slice(0,48)}return u.hostname.replace(/^www\./,'')}catch(e){return'Open link'}}
  function enhanceTaskLinks(){
    const detail=document.getElementById('todoDetailScreen');if(!detail?.classList.contains('show'))return;const host=document.getElementById('detailLinks');if(!host)return;
    const found=[];detail.querySelectorAll('.detailInfoItem').forEach(item=>{const text=item.textContent||'',urls=urlsFrom(text);urls.forEach(u=>found.push(u));if(urls.length){let clean=text;urls.forEach(u=>clean=clean.replace(u,''));clean=clean.replace(/\s{2,}/g,' ').trim();if(clean)item.textContent=clean}});
    try{const t=typeof findTodo==='function'&&typeof currentTodoDetailId!=='undefined'?findTodo(currentTodoDetailId):null;(t?.details?.links||[]).forEach(l=>{if(l?.url)found.push(String(l.url))});urlsFrom(t?.details?.personalNote||'').forEach(u=>found.push(u))}catch(e){}
    const unique=[...new Set(found)].filter(u=>/^https:\/\//i.test(u));if(!unique.length)return;
    const existing=new Set([...host.querySelectorAll('button[data-vb-url]')].map(x=>x.dataset.vbUrl));const empty=host.querySelector('.detailEmpty');if(empty)empty.remove();
    unique.forEach(url=>{if(existing.has(url))return;const b=document.createElement('button');b.className='detailLink';b.type='button';b.dataset.vbUrl=url;b.innerHTML='<span></span><span>↗</span>';b.querySelector('span').textContent=labelFor(url);b.onclick=()=>{log('todo_link_open',{host:(()=>{try{return new URL(url).hostname}catch(e){return''}})()});try{if(typeof openTodoLink==='function')openTodoLink(url);else if(typeof Native!=='undefined'&&Native.openUrl)Native.openUrl(url);else location.href=url}catch(e){location.href=url}};host.appendChild(b)})
  }
  function patchTodoRender(){if(typeof window.renderTodoDetail!=='function'||window.renderTodoDetail.__vbrain12)return;const base=window.renderTodoDetail;const wrapped=function(){const r=base.apply(this,arguments);setTimeout(enhanceTaskLinks,0);return r};wrapped.__vbrain12=true;window.renderTodoDetail=wrapped}

  function install(){
    document.addEventListener('click',captureTubeSubmit,true);
    document.addEventListener('input',e=>schedule(e.target,false,'draft'),true);
    document.addEventListener('change',e=>schedule(e.target,true,'change'),true);
    document.addEventListener('focusout',e=>schedule(e.target,true,'blur'),true);
    patchTodoRender();setTimeout(enhanceTaskLinks,300);
    log('vbrain_runtime_ready',{version:12,capabilities:['tube-learning-direct-sync','private-text-redundancy','todo-state-direct-sync','rich-task-links']});
  }
  window.VBrainContext={version:12,syncField:privateSync,enhanceTaskLinks};
  install();setInterval(()=>{patchTodoRender();enhanceTaskLinks()},5000);
})();
