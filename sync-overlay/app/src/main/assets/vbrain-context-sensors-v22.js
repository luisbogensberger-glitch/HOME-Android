/* V-Brain Context Sensors v22 — consented foreground sampling, private raw location. */
(function(){
  'use strict';
  if(window.__VBRAIN_CONTEXT_SENSORS_V22__)return;window.__VBRAIN_CONTEXT_SENSORS_V22__=true;
  const VERSION=22,CAPTURE_MS=5*60*1000;
  const parse=raw=>{try{return JSON.parse(raw||'{}')||{}}catch(_){return{}}};
  const capable=()=>typeof AdaptiveNative!=='undefined'&&typeof AdaptiveNative.contextSensorStatus==='function'&&typeof AdaptiveNative.captureContextSignals==='function';
  function status(){
    if(!capable())return{version:VERSION,native:false,enabled:false,location:false};
    try{return{native:true,...parse(AdaptiveNative.contextSensorStatus())}}catch(_){return{version:VERSION,native:true,enabled:false,location:false}}
  }
  function generic(result){
    const accuracy=Number(result?.accuracyMeters)||0;
    const bucket=accuracy<=0?'unknown':accuracy<=25?'high':accuracy<=100?'medium':'low';
    const data={version:VERSION,state:String(result?.state||''),precision:String(result?.precision||''),movementClass:String(result?.movementClass||''),movedMeters:Number.isFinite(Number(result?.movedMeters))?Math.max(0,Math.round(Number(result.movedMeters))):null,sampleAgeMinutes:Number.isFinite(Number(result?.sampleAgeMs))?Math.max(0,Math.round(Number(result.sampleAgeMs)/60000)):null,accuracyBucket:bucket,rawPrivate:true};
    try{window.homeAdaptiveLog?.('context_signal_summary',data)}catch(_){}
  }
  const prior=window.onVBrainContextSignals;
  window.onVBrainContextSignals=function(result){try{prior?.(result)}catch(_){}generic(result||{});mount()};
  function request(){
    if(!capable())return false;
    try{AdaptiveNative.setContextSensorsEnabled?.(true);AdaptiveNative.requestContextSensorPermissions?.();window.homeAdaptiveLog?.('context_sensor_permission_requested',{version:VERSION});setTimeout(mount,900);return true}catch(_){return false}
  }
  function capture(){
    if(!capable()||document.hidden)return false;const s=status();if(!s.enabled||!s.location)return false;
    try{AdaptiveNative.captureContextSignals();return true}catch(_){return false}
  }
  function ensureStyle(){if(document.getElementById('vb22Style'))return;const el=document.createElement('style');el.id='vb22Style';el.textContent=`
    .vb22SensorRow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 3px;padding:11px 0;border-top:1px solid rgba(255,255,255,.075)}
    .vb22SensorCopy b{display:block;font:750 10px system-ui;color:rgba(255,255,255,.82)}.vb22SensorCopy span{display:block;margin-top:3px;font:500 8px/1.35 system-ui;color:rgba(255,255,255,.40)}
    #vb22SensorBtn{flex:0 0 auto;border:1px solid rgba(255,255,255,.12);background:#171d27;color:#e9edf5;border-radius:999px;min-height:38px;padding:0 12px;font:800 8px system-ui;letter-spacing:.09em}#vb22SensorBtn:disabled{opacity:.48}
  `;document.head.appendChild(el)}
  function mount(){
    const panel=document.getElementById('vb21ContextPanel');if(!panel)return false;ensureStyle();let row=document.getElementById('vb22SensorRow');
    if(!row){row=document.createElement('div');row.id='vb22SensorRow';row.className='vb22SensorRow';row.innerHTML='<div class="vb22SensorCopy"><b>Movement + location</b><span>Raw coordinates stay in private sync. Foreground sampling only in v22.</span></div><button id="vb22SensorBtn" type="button"></button>';const list=panel.querySelector('.vb21List');if(list)panel.insertBefore(row,list);else panel.appendChild(row)}
    const button=row.querySelector('#vb22SensorBtn'),s=status();
    if(!s.native){button.textContent='APK UPDATE';button.disabled=true;return true}
    button.disabled=false;
    if(!s.enabled)button.textContent='ENABLE';else if(!s.location)button.textContent='PERMISSION';else button.textContent='ON · SAMPLE';
    button.onclick=()=>{const next=status();if(!next.enabled||!next.location)request();else capture()};return true;
  }
  const oldResume=window.onAppResume;window.onAppResume=function(){const out=oldResume?.apply(this,arguments);setTimeout(()=>{mount();capture()},800);return out};
  setTimeout(()=>{mount();capture()},3500);setInterval(()=>{if(!document.hidden){mount();capture()}},CAPTURE_MS);document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{mount();capture()},700)});
  window.VBrainContextSensors={version:VERSION,status,request,capture,mount};
})();
