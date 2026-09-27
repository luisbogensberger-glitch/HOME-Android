package com.luis.home;

import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.FrameLayout;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Tests the real WebView/native live boundary with the single-runtime v24 architecture. */
public class RuntimeSmoke extends Instrumentation {
    private Activity activity;
    private WebView web;
    private String phase="boot";

    @Override public void onCreate(Bundle args){super.onCreate(args);start();}

    private String eval(String js)throws Exception{
        CountDownLatch done=new CountDownLatch(1);
        AtomicReference<String> result=new AtomicReference<>("");
        runOnMainSync(()->web.evaluateJavascript(js,v->{result.set(v);done.countDown();}));
        if(!done.await(8,TimeUnit.SECONDS))throw new Exception("WebView JS callback timed out");
        return result.get();
    }

    private void waitFor(String js,int seconds)throws Exception{
        long end=System.currentTimeMillis()+seconds*1000L;
        while(System.currentTimeMillis()<end){if("true".equals(eval(js)))return;Thread.sleep(200);}
        throw new Exception("Condition failed in "+phase+": "+js+" result="+eval(js)+" status="+eval("typeof Native!=='undefined'?Native.liveRuntimeStatus():'no bridge'")+" DOM="+eval("document.body.innerText.slice(-500)"));
    }

    private String sha(byte[] bytes)throws Exception{
        StringBuilder digest=new StringBuilder();
        for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))digest.append(String.format("%02x",b&255));
        return digest.toString();
    }

    private String stage(String html)throws Exception{
        byte[] bytes=html.getBytes(StandardCharsets.UTF_8);String hash=sha(bytes);
        File dir=new File(getTargetContext().getNoBackupFilesDir(),"vbrain-live");dir.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(dir,hash+".html"))){out.write(bytes);out.getFD().sync();}
        getTargetContext().getSharedPreferences("vbrain_live_runtime",Context.MODE_PRIVATE).edit()
            .putString("ready",hash).putString("readyVersion","18."+hash.substring(0,12)).commit();
        return hash;
    }

    private void seedDirtyUpgradeState()throws Exception{
        String poison="<!doctype html><meta name=\"vbrain-host\" content=\"18\"><script>window.__OLD_LIVE_POISON__=true</script><p>old poisoned live</p>";
        byte[] bytes=poison.getBytes(StandardCharsets.UTF_8);String hash=sha(bytes);
        File dir=new File(getTargetContext().getNoBackupFilesDir(),"vbrain-live");dir.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(dir,hash+".html"))){out.write(bytes);out.getFD().sync();}
        getTargetContext().getSharedPreferences("vbrain_live_runtime",Context.MODE_PRIVATE).edit()
            .putInt("host",18).putInt("rescueEpoch",19).putString("active",hash).putString("previous",hash)
            .putString("ready",hash).putBoolean("bootPending",true).putString("error","legacy state").commit();
        getTargetContext().getSharedPreferences("home_state",Context.MODE_PRIVATE).edit()
            .putString("vbrainUpgradeSentinel","KEEP_ME").commit();
    }

    private void startTarget(){
        Intent start=new Intent(Intent.ACTION_MAIN).setClassName(getTargetContext(),"com.luis.home.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity=startActivitySync(start);
        web=(WebView)((FrameLayout)activity.findViewById(android.R.id.content)).getChildAt(0);
    }

    private void restartTarget()throws Exception{
        runOnMainSync(()->activity.finish());Thread.sleep(700);startTarget();
    }

    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            phase="dirty upgrade boot";
            seedDirtyUpgradeState();startTarget();
            waitFor("window.VBrainLean?.version===24 && window.VBrainLive?.version===24 && window.VBrain?.version===24 && document.querySelectorAll('.v24Nav [data-v24-route]').length===3",15);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).rescueEpoch===20 && JSON.parse(Native.liveRuntimeStatus()).source==='bundled'",8);
            waitFor("!window.__OLD_LIVE_POISON__ && Native.loadState('vbrainUpgradeSentinel')==='KEEP_ME'",5);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",5);

            phase="legacy cache quarantine";
            eval("localStorage.setItem('homeRemoteCacheSchema','host17-v3');localStorage.setItem('homeRemoteJsV2','window.__LEGACY_REMOTE_POISON__=true');localStorage.setItem('homeBehaviorJsV3','window.__LEGACY_BEHAVIOR_POISON__=true');true");
            restartTarget();
            waitFor("window.VBrainLean?.version===24 && document.querySelectorAll('script[data-source]').length===1",15);
            waitFor("!window.__LEGACY_REMOTE_POISON__ && !window.__LEGACY_BEHAVIOR_POISON__ && localStorage.getItem('homeRemoteJsV2')===null && localStorage.getItem('homeBehaviorJsV3')===null",5);

            phase="deterministic resume";
            eval("window.onAppResume?.();window.onAppResume?.();true");
            waitFor("document.querySelectorAll('.v24Nav [data-v24-route]').length===3 && document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#vbRestoreInline').length===0",5);

            phase="tube stack";
            eval("showScreen('tube');true");
            waitFor("document.getElementById('tubeScreen').classList.contains('show') && localStorage.getItem('homeTubeLayoutV6')==='stack' && document.getElementById('grid').dataset.layout==='stack'",5);
            eval("showScreen('home');true");

            phase="lean brain and native back";
            eval("document.getElementById('vbrainScoreV8').click();true");
            waitFor("document.getElementById('v24BrainOverlay').classList.contains('show')",5);
            runOnMainSync(()->activity.onBackPressed());
            waitFor("!document.getElementById('v24BrainOverlay').classList.contains('show')",5);
            if(activity.isFinishing())throw new Exception("Back closed the activity");

            eval("localStorage.setItem('vbrainSmokeSentinel','persist');Native.saveState('vbrainSmokeSentinel','persist');true");
            String html;
            try(InputStream in=getTargetContext().getAssets().open("live-app.html");ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] b=new byte[8192];for(int n;(n=in.read(b))!=-1;)out.write(b,0,n);html=out.toString("UTF-8");
            }

            phase="activate live document";
            stage(html.replace("</head>","<meta name=\"vbrain-smoke\" content=\"live-test\"></head>"));
            eval("Native.applyLiveUpdate();true");
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && window.VBrainLean?.version===24 && window.VBrainLive?.version===24",15);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).source==='live' && JSON.parse(Native.liveRuntimeStatus()).healthy===true",8);
            waitFor("localStorage.getItem('vbrainSmokeSentinel')==='persist' && Native.loadState('vbrainSmokeSentinel')==='persist'",5);

            phase="reject unhealthy document";
            stage("<!doctype html><meta name=\"vbrain-host\" content=\"18\"><p id=\"broken\">Unhealthy update</p>");
            eval("Native.applyLiveUpdate();true");
            waitFor("!!document.getElementById('broken')",8);

            phase="rollback to healthy lean document";
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && window.VBrainLean?.version===24 && document.querySelectorAll('.v24Nav [data-v24-route]').length===3",20);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",8);

            result.putString("stream","VBRAIN_SMOKE_OK: single lean v24 runtime, dirty legacy release quarantined, user state preserved, legacy JS caches purged, deterministic repeated resume, stack Tube, lightweight Brain/native Back, live activation and failed-release rollback\n");
            runOnMainSync(()->activity.finish());finish(Activity.RESULT_OK,result);
        }catch(Throwable e){
            result.putString("stream","VBRAIN_SMOKE_FAILED: "+phase+": "+e.toString()+"\n");
            try{if(activity!=null)runOnMainSync(()->activity.finish());}catch(Throwable ignored){}
            finish(Activity.RESULT_CANCELED,result);
        }
    }
}
