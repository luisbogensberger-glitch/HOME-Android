package com.luis.home;

import android.app.job.*;
import android.content.*;
import org.json.*;
import java.util.concurrent.*;

/** Android schedules retries and private commands even when the WebView is closed. */
public class HomeSyncJob extends JobService {
    private ExecutorService executor;
    static void schedule(Context c){
        JobScheduler s=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if(s!=null)s.schedule(new JobInfo.Builder(1701,new ComponentName(c,HomeSyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setPeriodic(15*60*1000L).build());
    }
    @Override public boolean onStartJob(JobParameters params){
        executor=Executors.newSingleThreadExecutor();
        executor.execute(()->{WorkerSync w=new WorkerSync(this);w.flushOutbox();pollCommands(this,w);jobFinished(params,w.pendingOutboxCount()>0);executor.shutdown();});return true;
    }
    @Override public boolean onStopJob(JobParameters params){if(executor!=null)executor.shutdownNow();return true;}
    static synchronized void pollCommands(Context c,WorkerSync w){
        if(!w.isConfigured())return;
        try{
            JSONArray commands=w.deviceCommands().optJSONArray("commands");if(commands==null)return;
            SharedPreferences seen=c.getSharedPreferences("vbrain_commands",Context.MODE_PRIVATE);
            for(int n=0;n<commands.length();n++){
                JSONObject cmd=commands.getJSONObject(n);String id=cmd.getString("id"),kind=cmd.optString("kind");
                if(!seen.getBoolean(id,false)){
                    JSONObject payload=cmd.optJSONObject("payload");if(payload==null)continue;
                    if("notification".equals(kind)||"notify".equals(kind)||"schedule_notification".equals(kind)){
                        payload.put("id","command-"+id);HomeNotificationReceiver.schedule(c,payload);
                    }else if("ui_patch".equals(kind)){
                        String raw=payload.toString();if(raw.length()>120000)continue;
                        c.getSharedPreferences("home_state",Context.MODE_PRIVATE).edit().putString("vbrainPrivatePatch",raw).commit();
                    }else if("brain_context".equals(kind)){
                        String raw=payload.toString();if(raw.length()>120000)continue;
                        c.getSharedPreferences("home_state",Context.MODE_PRIVATE).edit().putString("vbrainBrainContext",raw).commit();
                    }else continue;
                    seen.edit().putBoolean(id,true).commit();
                    HomeNotificationReceiver.event(c,"device_command_applied",new JSONObject().put("id",id).put("kind",kind));
                }
                try{w.acknowledgeCommand(id);}catch(Exception e){w.enqueue("command_ack",new JSONObject().put("id",id));}
            }
        }catch(Exception ignored){}
    }
}
