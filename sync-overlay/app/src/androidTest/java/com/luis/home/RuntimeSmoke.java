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

/** Tests the real WebView/native live boundary with the single-owner One UI v25 architecture. */
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
        throw new Exception("Condition failed in "+phase+": "+js+" result="+eval(js)+" status="+eval("typeof Native!=='undefined'?Native.liveRuntimeStatus():'no bridge'")+" DOM="+eval("document.body.innerText.slice(-700)"));
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
            waitFor("window.VBrainLean?.version===25 && window.VBrainLive?.version===25 && window.VBrain?.version===25 && document.querySelectorAll('.v25HomeCard').length===4 && document.getElementById('vbrainScoreV8')?.innerText.includes('Your signal today')",15);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).rescueEpoch===20 && JSON.parse(Native.liveRuntimeStatus()).source==='bundled'",8);
            waitFor("!window.__OLD_LIVE_POISON__ && Native.loadState('vbrainUpgradeSentinel')==='KEEP_ME'",5);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",5);

            phase="legacy cache quarantine";
            eval("localStorage.setItem('homeRemoteCacheSchema','host17-v3');localStorage.setItem('homeRemoteJsV2','window.__LEGACY_REMOTE_POISON__=true');localStorage.setItem('homeBehaviorJsV3','window.__LEGACY_BEHAVIOR_POISON__=true');true");
            restartTarget();
            waitFor("window.VBrainLean?.version===25 && document.querySelectorAll('script[data-source]').length===1",15);
            waitFor("!window.__LEGACY_REMOTE_POISON__ && !window.__LEGACY_BEHAVIOR_POISON__ && localStorage.getItem('homeRemoteJsV2')===null && localStorage.getItem('homeBehaviorJsV3')===null",5);

            phase="deterministic repeated resume";
            eval("window.onAppResume?.();window.onAppResume?.();window.onAppResume?.();true");
            waitFor("document.querySelectorAll('.v25HomeCard').length===4 && [...document.querySelectorAll('.v25HomeCard')].map(x=>x.dataset.route).join(',')==='gym,tube,todos,calendar' && document.querySelectorAll('#homeDayScoreV4,#homeMomentum,.homeQuestV7,#vbrainLiveStatus17,#vbRestoreInline,#v24BrainOverlay').length===0",5);
            waitFor("(()=>{const cards=[...document.querySelectorAll('.v25HomeCard')],heights=cards.map(x=>x.getBoundingClientRect().height);return Math.max(...heights)-Math.min(...heights)<3&&getComputedStyle(cards[3]).backgroundImage.includes('photo-1513635269975-59663e0ac1ad')})()",5);

            phase="three gym plans";
            eval("showScreen('gym');true");
            waitFor("document.querySelectorAll('#v25GymTabs button').length===3 && document.getElementById('gymScreen').classList.contains('show')",5);
            eval("document.querySelector('#v25GymTabs button[data-plan=quick]').click();document.getElementById('v25GymDone').click();document.querySelector('#v25GymSession [data-step=\"0\"]').click();document.getElementById('v25GymDone').click();true");
            waitFor("JSON.parse(Native.loadState('homeGymStateV1')).history.length===1",5);
            eval("showScreen('home');true");

            phase="bounded todos with HOME Sync";
            eval("showScreen('todos');true");
            waitFor("document.getElementById('todosScreen').classList.contains('show') && document.querySelectorAll('#todoList .todo').length<=18 && document.getElementById('todoStats').textContent!=='193 open' && !!document.querySelector('.syncBar')",5);
            eval("showScreen('home');true");

            phase="tube stack";
            eval("showScreen('tube');true");
            waitFor("document.getElementById('tubeScreen').classList.contains('show') && localStorage.getItem('homeTubeLayoutV6')==='stack' && document.getElementById('grid').dataset.layout==='stack' && document.querySelectorAll('#grid .card').length===5",5);
            eval("showScreen('home');true");

            phase="living brain and native back";
            eval("document.getElementById('vbrainScoreV8').click();true");
            waitFor("document.getElementById('v25Brain').classList.contains('show') && document.getElementById('v25BrainCanvas').width>0",5);
            runOnMainSync(()->activity.onBackPressed());
            waitFor("!document.getElementById('v25Brain').classList.contains('show')",5);
            if(activity.isFinishing())throw new Exception("Back closed the activity");

            eval("localStorage.setItem('vbrainSmokeSentinel','persist');Native.saveState('vbrainSmokeSentinel','persist');true");
            String html;
            try(InputStream in=getTargetContext().getAssets().open("live-app.html");ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] b=new byte[8192];for(int n;(n=in.read(b))!=-1;)out.write(b,0,n);html=out.toString("UTF-8");
            }

            phase="activate live document";
            stage(html.replace("</head>","<meta name=\"vbrain-smoke\" content=\"live-test\"></head>"));
            eval("Native.applyLiveUpdate();true");
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && window.VBrainLean?.version===25 && window.VBrainLive?.version===25",15);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).source==='live' && JSON.parse(Native.liveRuntimeStatus()).healthy===true",8);
            waitFor("localStorage.getItem('vbrainSmokeSentinel')==='persist' && Native.loadState('vbrainSmokeSentinel')==='persist'",5);

            phase="reject unhealthy document";
            stage("<!doctype html><meta name=\"vbrain-host\" content=\"18\"><p id=\"broken\">Unhealthy update</p>");
            eval("Native.applyLiveUpdate();true");
            waitFor("!!document.getElementById('broken')",8);

            phase="rollback to healthy One UI document";
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && window.VBrainLean?.version===25 && document.querySelectorAll('.v25HomeCard').length===4",20);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",8);

            result.putString("stream","VBRAIN_SMOKE_OK: single One UI v25 runtime, screenshot-2 Home preserved across repeated resume, dirty legacy release quarantined, user state preserved, old JS caches purged, bounded To-Dos, stack Tube, living Brain/native Back, live activation and failed-release rollback\n");
            runOnMainSync(()->activity.finish());finish(Activity.RESULT_OK,result);
        }catch(Throwable e){
            result.putString("stream","VBRAIN_SMOKE_FAILED: "+phase+": "+e.toString()+"\n");
            try{if(activity!=null)runOnMainSync(()->activity.finish());}catch(Throwable ignored){}
            finish(Activity.RESULT_CANCELED,result);
        }
    }
}
