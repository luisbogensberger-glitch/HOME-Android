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

/** Tests the real WebView/native update boundary without an account or private user data. */
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
        throw new Exception("Condition failed in "+phase+": "+js+" result="+eval(js)+" status="+eval("typeof Native!=='undefined'?Native.liveRuntimeStatus():'no bridge'")+" DOM="+eval("document.body.innerText.slice(-400)"));
    }
    private String stage(String html)throws Exception{
        byte[] bytes=html.getBytes(StandardCharsets.UTF_8);StringBuilder digest=new StringBuilder();
        for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))digest.append(String.format("%02x",b&255));
        String sha=digest.toString();File dir=new File(getTargetContext().getNoBackupFilesDir(),"vbrain-live");dir.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(dir,sha+".html"))){out.write(bytes);out.getFD().sync();}
        getTargetContext().getSharedPreferences("vbrain_live_runtime",Context.MODE_PRIVATE).edit().putString("ready",sha).putString("readyVersion","18."+sha.substring(0,12)).commit();
        return sha;
    }
    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            Intent start=new Intent(Intent.ACTION_MAIN).setClassName(getTargetContext(),"com.luis.home.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity=startActivitySync(start);web=(WebView)((FrameLayout)activity.findViewById(android.R.id.content)).getChildAt(0);
            waitFor("!!window.VBrainLive && !!window.VBrain && !!window.VBrainRemoteUI && !!window.VBrainGraph && !!window.VBrainTodos && !!window.VBrainRuntime && !!window.VBrainHotLoader && !!document.getElementById('vbrainLiveStatus17')",25);
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
            String sha=stage(html.replace("</head>","<meta name=\"vbrain-smoke\" content=\"live-test\"></head>"));
            eval("Native.applyLiveUpdate();true");
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && !!window.VBrainLive && !!window.VBrainRemoteUI && !!window.VBrainGraph && !!window.VBrainTodos && !!window.VBrainRuntime && !!window.VBrainHotLoader",25);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).source==='live'",5);
            waitFor("localStorage.getItem('vbrainSmokeSentinel')==='persist' && Native.loadState('vbrainSmokeSentinel')==='persist'",5);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",10);
            phase="reject unhealthy document";
            stage("<!doctype html><meta name=\"vbrain-host\" content=\"18\"><p id=\"broken\">Unhealthy update</p>");
            eval("Native.applyLiveUpdate();true");waitFor("!!document.getElementById('broken')",10);
            phase="rollback to healthy document";
            waitFor("!!document.querySelector('meta[name=vbrain-smoke]') && !!window.VBrainLive && !!window.VBrainRemoteUI && !!window.VBrainGraph && !!window.VBrainTodos",30);
            waitFor("JSON.parse(Native.liveRuntimeStatus()).healthy===true",10);
            result.putString("stream","VBRAIN_SMOKE_OK: real Android boot, persistent V19 brain, unified To-Dos, verified hot loader, runtime evidence, native Back, full live UI activation, storage continuity, failed-release rollback\n");
            runOnMainSync(()->activity.finish());
            finish(Activity.RESULT_OK,result);
        }catch(Throwable e){result.putString("stream","VBRAIN_SMOKE_FAILED: "+e.toString()+"\n");
            try { if(activity!=null) runOnMainSync(()->activity.finish()); } catch(Throwable ignored) { }
            finish(Activity.RESULT_CANCELED,result);}
    }
}
