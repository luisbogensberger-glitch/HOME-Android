/* V-Brain Context Compat v21 — lets existing Host-18 APKs receive semantic context via ui_patch. */
(function(){
  'use strict';
  if(window.__VBRAIN_CONTEXT_COMPAT_V21__)return;window.__VBRAIN_CONTEXT_COMPAT_V21__=true;
  const KEY='vbrainBrainContext';
  const read=k=>{try{return typeof Native!=='undefined'&&Native.loadState?String(Native.loadState(k)||''):''}catch(_){return''}};
  const parse=raw=>{try{const v=JSON.parse(raw||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_){return{}}};
  function normalized(box){
    if(!box||typeof box!=='object'||!Array.isArray(box.items))return null;
    const items=box.items.slice(0,120).filter(x=>x&&typeof x==='object').map(x=>({
      key:String(x.key||'').slice(0,180),kind:String(x.kind||'').slice(0,40),statement:String(x.statement||'').slice(0,1200),
      value:x.value&&typeof x.value==='object'&&!Array.isArray(x.value)?x.value:{},confidence:Math.max(0,Math.min(1,Number(x.confidence)||0)),
      evidence_count:Math.max(0,Number(x.evidence_count??x.evidenceCount)||0),source:String(x.source||'').slice(0,80),source_ref:String(x.source_ref||'').slice(0,180),updated_at:x.updated_at||null
    })).filter(x=>x.key&&x.statement);
    return{schema:Number(box.schema)||1,generatedAt:String(box.generatedAt||'').slice(0,80),items};
  }
  function sync(){
    if(typeof Native==='undefined'||typeof Native.saveState!=='function')return false;
    const patch=parse(read('vbrainPrivatePatch')),incoming=normalized(patch.brainContext);if(!incoming)return false;
    const current=normalized(parse(read(KEY))),next=JSON.stringify(incoming),before=current?JSON.stringify(current):'';
    if(next===before)return true;
    try{Native.saveState(KEY,next);window.homeAdaptiveLog?.('brain_context_compat_synced',{version:21,count:incoming.items.length});return true}catch(_){return false}
  }
  sync();setTimeout(sync,1200);setInterval(sync,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(sync,250)});
  window.VBrainContextCompat={version:21,sync};
})();
