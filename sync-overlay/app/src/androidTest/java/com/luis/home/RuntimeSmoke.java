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

/** Tests the real WebView/native update boundary, including dirty upgrade state, without private user data. */
public class RuntimeSmoke extends Instrumentation {
    private Activity activity;
    private WebView web;
    private String phase="boot";
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    private String eval(String js)throws Exception{
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>("");
        runOnMainSync(()->web.evaluateJavascript(js,v->{result.set(v);done.countDown();}));
        if(!done.await(8,TimeUnit.SECONDS))throw new Exception("WebView JS callback timed out");return result.get();
    }
    private void waitFor(String js,int seconds)throws Exception{
        long end=System.currentTimeMillis()+seconds*1000L;
        while(System.currentTimeMillis()<end){if("true".equals(eval(js)))return;Thread.sleep(250);}
        throw new Exception("Condition failed in "+phase+": "+js+" result="+eval(js)+" status="+eval("typeof Native!=='undefined'?Native.liveRuntimeStatus():'no bridge'")+" DOM="+eval("document.body.innerText.slice(-500)"));
    }
    private String sha(byte[] bytes)throws Exception{
        StringBuilder digest=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))digest.append(String.format("%02x",b&255));return digest.toString();
    }
    private String stage(String html)throws Exception{
        byte[] bytes=html.getBytes(StandardCharsets.UTF_8);String hash=sha(bytes);File dir=new File(getTargetContext().getNoBackupFilesDir(),"vbrain-live");dir.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(dir,hash+".html"))){out.write(bytes);out.getFD().sync();}
        getTargetContext().getSharedPreferences("vbrain_live_runtime",Context.MODE_PRIVATE).edit().putString("ready",hash).putString("readyVersion","18."+hash.substring(0,12)).commit();
        return hash;
    }
    private void seedDirtyUpgradeState()throws Exception{
        String poison="<!doctype html><meta name=\"vbrain-host\" content=\"18\"><script>window.__OLD_LIVE_POISON__=true</script><p>old poisoned live</p>";
        byte[] bytes=poison.getBytes(StandardCharsets.UTF_8);String hash=sha(bytes);File dir=new File(getTargetContext().getNoBackupFilesDir(),"vbrain-live");dir.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(dir,hash+".html"))){out.write(bytes);out.getFD().sync();}
        getTargetContext().getSharedPreferences("vbrain_live_runtime",Context.MODE_PRIVATE).edit()
            .putInt("host",18).putInt("rescueEpoch",19).putString("active",hash).putString("previous",hash)
            .putString("ready",hash).putBoolean("bootPending",true).putString("error","legacy state").commit();
        getTargetContext().getSharedPreferences("home_state",Context.MODE_PRIVATE).edit()
            .putString("vbrainUpgradeSentinel","KEEP_ME").commit();
    }
    private void startTarget(){
        Intent start=new Intent(Intent.ACTION_MAIN).setClassName(getTargetContext(),"com.luis.home.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity=startActivitySync(start);web=(WebView)((FrameLayout)activity.findViewById(android.R.id.content)).getChildAt(0);
    }
    private void restartTarget()throws Exception{
        runOnMainSync(()->activity.finish());Thread.sleep(900);startTarget();
    }
    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            phase="dirty upgrade boot";seedDirtyUpgradeState();startTarget();
            waitFor("!!window.VBrainShell && VBrainShell.version===24 && document.documentElement.dataset.vbrainUiOwner==='24'",12);
            waitFor("document.documentElement.dataset.vbrainHydrated==='24' && !!window.VBrain && !!window.VBrainRemoteUI && !!window.VBrainGraph && !!window.VBrainTodos",20);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).rescueEpoch===20 && JSON.parse(Native.liveRuntimeStatus()).source==='bundled'",8);
            waitFor("!window.__OLD_LIVE_POISON__ && Native.loadState('vbrainUpgradeSentinel')==='KEEP_ME'",5);

            phase="legacy HOME cache quarantine";
            eval("localStorage.setItem('homeRemoteCacheSchema','host17-v3');localStorage.setItem('homeRemoteJsV2','window.__LEGACY_REMOTE_POISON__=true');localStorage.setItem('homeBehaviorJsV3','window.__LEGACY_BEHAVIOR_POISON__=true');true");
            restartTarget();
            waitFor("!!window.VBrainShell && !!window.HOMERemoteExtension",20);
            waitFor("HOMERemoteExtension.version===4 && HOMERemoteExtension.status().schema==='host18-v5' && !window.__LEGACY_REMOTE_POISON__ && !window.__LEGACY_BEHAVIOR_POISON__",8);
            waitFor("localStorage.getItem('homeRemoteJsV2')===null && localStorage.getItem('homeBehaviorJsV3')===null",5);

            phase="lean home essentials";
            waitFor("document.querySelectorAll('#homeScreen .homeGrid>.homeCard').length===4 && !!document.getElementById('vbrainScoreV8')",8);
            waitFor("!document.getElementById('homeDayScoreV4') && !document.getElementById('homeMomentum') && !document.querySelector('.homeQuestV7') && !document.querySelector('.vb11Module') && !document.getElementById('vbrainCompatReminderV1') && !document.getElementById('vbrainLiveStatus17')",5);
            waitFor("localStorage.getItem('homeTubeLayoutV6')==='stack' && document.documentElement.dataset.vbrainUiOwner==='24'",5);
            eval("var i=document.querySelector('#homeScreen .homeInner'),g=i.querySelector('.homeGrid'),q=document.createElement('section');q.id='homeMomentum';q.className='homeQuestV7';q.textContent='stale';i.insertBefore(q,g);var d=document.querySelector('.homeCard.todos').cloneNode(true);d.id='smokeDuplicate';g.appendChild(d);true");
            waitFor("!document.getElementById('homeMomentum') && !document.getElementById('smokeDuplicate') && document.querySelectorAll('#homeScreen .homeGrid>.homeCard').length===4",5);

            phase="resume single owner";
            eval("window.onAppResume&&window.onAppResume();true");
            waitFor("document.documentElement.dataset.vbrainUiOwner==='24' && document.querySelectorAll('#homeScreen .homeGrid>.homeCard').length===4 && !document.querySelector('.homeQuestV7')",5);

            phase="native back";
            eval("VBrain.openBrain();true");waitFor("document.getElementById('vBrainV19').classList.contains('show')",5);
            runOnMainSync(()->activity.onBackPressed());waitFor("!document.getElementById('vBrainV19').classList.contains('show')",5);
            if(activity.isFinishing())throw new Exception("Back closed the activity");
            eval("localStorage.setItem('vbrainSmokeSentinel','persist');Native.saveState('vbrainSmokeSentinel','persist');true");

            String html;
            try(InputStream in=getTargetContext().getAssets().open("live-app.html");ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] b=new byte[8192];for(int n;(n=in.read(b))!=-1;)out.write(b,0,n);html=out.toString("UTF-8");
            }
            phase="activate live document";
            stage(html.replace("</head>","<meta name=\"vbrain-smoke\" content=\"live-test\"></head>"));
            eval("Native.applyLiveUpdate();true");
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && !!window.VBrainShell && VBrainShell.version===24",12);
            waitFor("document.documentElement.dataset.vbrainHydrated==='24' && !!window.VBrain && !!window.VBrainRemoteUI && !!window.VBrainGraph && !!window.VBrainTodos",20);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).source==='live'",5);
            waitFor("localStorage.getItem('vbrainSmokeSentinel')==='persist' && Native.loadState('vbrainSmokeSentinel')==='persist'",5);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",10);
            waitFor("document.querySelectorAll('#homeScreen .homeGrid>.homeCard').length===4 && !document.querySelector('.homeQuestV7') && !document.getElementById('homeDayScoreV4')",5);

            phase="reject unhealthy document";
            stage("<!doctype html><meta name=\"vbrain-host\" content=\"18\"><p id=\"broken\">Unhealthy update</p>");
            eval("Native.applyLiveUpdate();true");waitFor("!!document.getElementById('broken')",10);
            phase="rollback to healthy document";
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && !!window.VBrainShell && !!window.VBrainRemoteUI && !!window.VBrainGraph && !!window.VBrainTodos",30);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",10);
            waitFor("document.documentElement.dataset.vbrainUiOwner==='24' && document.querySelectorAll('#homeScreen .homeGrid>.homeCard').length===4",5);

            result.putString("stream","VBRAIN_SMOKE_OK: dirty Host17-style state quarantined, user state preserved, single-owner v24 stable across resume, legacy UI cannot reappear, Tube stack retained, HOME loader quarantines legacy JS, persistent V19 brain/graph, unified To-Dos, native Back, live activation and failed-release rollback\n");
            runOnMainSync(()->activity.finish());finish(Activity.RESULT_OK,result);
        }catch(Throwable e){result.putString("stream","VBRAIN_SMOKE_FAILED: "+phase+": "+e.toString()+"\n");
            try { if(activity!=null) runOnMainSync(()->activity.finish()); } catch(Throwable ignored) { }
            finish(Activity.RESULT_CANCELED,result);}
    }
}
