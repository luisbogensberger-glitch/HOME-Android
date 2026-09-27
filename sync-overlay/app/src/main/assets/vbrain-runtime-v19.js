/* V-Brain Runtime v19 — authoritative private ready/heartbeat evidence for the installed phone runtime. */
(function(){
  'use strict';
  if(window.__VBRAIN_RUNTIME_V19__)return;window.__VBRAIN_RUNTIME_V19__=true;
  const VERSION=19;let last=0;
  function snapshot(){let live={},sync={},hot={};try{live=JSON.parse(Native?.liveRuntimeStatus?.()||'{}')}catch(_){}try{sync=JSON.parse(AdaptiveNative?.homeSyncStatus?.()||'{}')}catch(_){}try{hot=window.VBrainHotLoader?.status?.()||{}}catch(_){}return{runtimeVersion:VERSION,nativeVersion:Number(live.nativeVersion||0),liveVersion:String(live.version||''),liveSource:String(live.source||''),liveHealthy:live.healthy!==false,hotPatchVersion:String(hot.version||'none'),hotHealthy:hot.healthy!==false,pendingSync:Number(sync.pending??sync.pendingUser??0),screen:document.querySelector('.screen.show')?.id?.replace(/Screen$/,'')||'home'}}
  function updateBadge(){const s=snapshot(),b=document.getElementById('vbrainLiveStatus17');if(b)b.textContent=`V BRAIN ${VERSION} · ${s.nativeVersion?`HOST ${s.nativeVersion}`:'LIVE'}`;const meta=document.querySelector('#vbrainControl17 small');if(meta&&/V BRAIN/i.test(meta.textContent||''))meta.textContent=`V BRAIN ${VERSION} · CONNECTION`;return s}
  function emit(kind,force=false){if(!force&&Date.now()-last<55000)return;last=Date.now();const data=updateBadge(),row={id:'runtime19-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),kind,at:Date.now(),source:'vbrain-runtime-v19',data};try{AdaptiveNative?.queuePrivateActivity?.(JSON.stringify(row));AdaptiveNative?.flushPrivateSync?.()}catch(_){}try{window.homeAdaptiveLog?.(kind,row.data)}catch(_){}return row}
  function ready(){const row=emit('runtime_ready',true);document.documentElement.dataset.vbrainRuntime=String(VERSION);updateBadge();return row}
  const old=window.onAppResume;window.onAppResume=function(){try{old?.()}catch(_){}emit('runtime_heartbeat',true)};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)emit('runtime_heartbeat',true)});
  window.VBrainRuntime={version:VERSION,snapshot,emit,updateBadge};
  setTimeout(ready,2200);setInterval(()=>{if(!document.hidden)emit('runtime_heartbeat')},60000);setInterval(()=>{if(!document.hidden)updateBadge()},5000);
})();
