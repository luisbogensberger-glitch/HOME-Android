package com.luis.home;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.*;
import java.util.Calendar;
import java.util.Locale;

/** Persistent, bounded reminders. Notifications open the intended section and can be snoozed. */
public class HomeNotificationReceiver extends BroadcastReceiver {
    private static final String CHANNEL="vbrain_reminders_v17";
    private static final String ACTION="com.luis.home.SMART_REMINDER";
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("vbrain_reminders",Context.MODE_PRIVATE);}
    static JSONObject settings(Context c){
        JSONObject out=new JSONObject();
        try{out.put("enabled",prefs(c).getBoolean("enabled",true)).put("maxPerDay",2).put("quietHours","22:00–08:00");}catch(Exception ignored){}
        return out;
    }
    static void setEnabled(Context c,boolean enabled){prefs(c).edit().putBoolean("enabled",enabled).commit();}
    private static String safe(String value,int max){return value==null?"":value.substring(0,Math.min(max,value.length()));}
    private static int code(String id){return id.hashCode()&0x7fffffff;}
    private static String day(){Calendar d=Calendar.getInstance();return String.format(Locale.US,"%d-%02d-%02d",d.get(Calendar.YEAR),d.get(Calendar.MONTH)+1,d.get(Calendar.DAY_OF_MONTH));}
    private static long daylight(long at){
        Calendar d=Calendar.getInstance();d.setTimeInMillis(at);
        int hour=d.get(Calendar.HOUR_OF_DAY);
        if(hour>=22){d.add(Calendar.DATE,1);d.set(Calendar.HOUR_OF_DAY,8);d.set(Calendar.MINUTE,15);}
        else if(hour<8){d.set(Calendar.HOUR_OF_DAY,8);d.set(Calendar.MINUTE,15);}
        return d.getTimeInMillis();
    }
    static synchronized void schedule(Context c,JSONObject spec)throws Exception{
        String id=safe(spec.optString("id"),100);if(id.isEmpty())throw new IllegalArgumentException("Reminder id required");
        long at=daylight(Math.max(System.currentTimeMillis()+1000,spec.optLong("atMillis",System.currentTimeMillis()+1000)));
        if(at>System.currentTimeMillis()+31L*86400000)throw new IllegalArgumentException("Reminder too far away");
        JSONObject clean=new JSONObject().put("id",id).put("title",safe(spec.optString("title","V-Brain"),90))
            .put("body",safe(spec.optString("body"),240)).put("target",safe(spec.optString("target","home"),30))
            .put("taskId",safe(spec.optString("taskId"),180)).put("atMillis",at)
            .put("expiresAt",spec.optLong("expiresAt",at+86400000));
        JSONObject all=new JSONObject(prefs(c).getString("scheduled","{}"));
        all.put(id,clean);prefs(c).edit().putString("scheduled",all.toString()).commit();
        arm(c,clean);
    }
    private static void arm(Context c,JSONObject s){
        Intent i=new Intent(c,HomeNotificationReceiver.class).setAction(ACTION).putExtra("id",s.optString("id"));
        PendingIntent p=PendingIntent.getBroadcast(c,code(s.optString("id")),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        AlarmManager a=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(a!=null)a.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,s.optLong("atMillis"),p);
    }
    static synchronized void restore(Context c){
        try{
            JSONObject all=new JSONObject(prefs(c).getString("scheduled","{}")),keep=new JSONObject();
            for(java.util.Iterator<String> it=all.keys();it.hasNext();){String id=it.next();JSONObject s=all.getJSONObject(id);
                if(s.optLong("expiresAt")<System.currentTimeMillis())continue;
                s.put("atMillis",daylight(Math.max(System.currentTimeMillis()+15000,s.optLong("atMillis"))));keep.put(id,s);arm(c,s);
            }
            prefs(c).edit().putString("scheduled",keep.toString()).commit();
        }catch(Exception ignored){}
    }
    static synchronized void cancel(Context c,String id){
        try{JSONObject all=new JSONObject(prefs(c).getString("scheduled","{}"));all.remove(id);prefs(c).edit().putString("scheduled",all.toString()).commit();}catch(Exception ignored){}
        Intent i=new Intent(c,HomeNotificationReceiver.class).setAction(ACTION).putExtra("id",id);
        PendingIntent p=PendingIntent.getBroadcast(c,code(id),i,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);
        if(p!=null){AlarmManager a=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);if(a!=null)a.cancel(p);p.cancel();}
    }
    private static boolean taskOpen(Context c,String taskId){
        if(taskId.isEmpty())return true;
        try{JSONObject state=new JSONObject(c.getSharedPreferences("home_state",Context.MODE_PRIVATE).getString("todoState","{}"));
            JSONArray active=state.optJSONArray("active");if(active==null)return false;
            for(int i=0;i<active.length();i++)if(taskId.equals(active.getJSONObject(i).optString("id")))return true;
        }catch(Exception ignored){}return false;
    }
    static void event(Context c,String kind,JSONObject data){
        try{new WorkerSync(c).enqueue("activity",new JSONObject().put("id",kind+"-"+System.currentTimeMillis())
            .put("kind",kind).put("at",System.currentTimeMillis()).put("data",data));}catch(Exception ignored){}
    }
    @Override public void onReceive(Context c,Intent i){
        if(i==null)return;
        if(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())||Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction())){restore(c);HomeSyncJob.schedule(c);return;}
        try{
            String id=i.getStringExtra("id");if(id==null)return;
            if("com.luis.home.SNOOZE".equals(i.getAction())){
                JSONObject spec=new JSONObject(i.getStringExtra("spec"));spec.put("atMillis",System.currentTimeMillis()+3600000);schedule(c,spec);
                ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(code(id));event(c,"notification_snoozed",new JSONObject().put("id",id));return;
            }
            JSONObject spec=new JSONObject(prefs(c).getString("scheduled","{}")).optJSONObject(id);
            if(spec==null){ // Compatibility with reminders scheduled by earlier native versions.
                spec=new JSONObject().put("id",id).put("title",i.getStringExtra("title")).put("body",i.getStringExtra("body")).put("target","home");
            }
            cancel(c,id);
            if(!prefs(c).getBoolean("enabled",true)||!taskOpen(c,spec.optString("taskId")))return;
            if(spec.has("expiresAt")&&spec.optLong("expiresAt")<System.currentTimeMillis())return;
            long now=System.currentTimeMillis(),allowed=daylight(now);
            if(allowed>now+1000){spec.put("atMillis",allowed);schedule(c,spec);return;}
            int count=day().equals(prefs(c).getString("day",""))?prefs(c).getInt("count",0):0;
            if(count>=2){event(c,"notification_suppressed",new JSONObject().put("reason","daily_limit").put("id",id));return;}
            if(post(c,spec)){prefs(c).edit().putString("day",day()).putInt("count",count+1).commit();event(c,"notification_delivered",new JSONObject().put("id",id).put("target",spec.optString("target")));}
        }catch(Exception ignored){}
    }
    static void show(Context c,String id,String title,String body){
        try{schedule(c,new JSONObject().put("id",id).put("title",title).put("body",body).put("atMillis",System.currentTimeMillis()+1000));}catch(Exception ignored){}
    }
    private static boolean post(Context c,JSONObject s){
        if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
        NotificationManager m=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(m==null||!m.areNotificationsEnabled())return false;
        NotificationChannel channel=new NotificationChannel(CHANNEL,"V-Brain reminders",NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Personal reminders and small next steps");channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);m.createNotificationChannel(channel);
        String id=s.optString("id");
        Intent open=new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("vbrainTarget",s.optString("target","home")).putExtra("vbrainTaskId",s.optString("taskId")).putExtra("vbrainReminderId",id);
        PendingIntent content=PendingIntent.getActivity(c,code(id),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Intent snooze=new Intent(c,HomeNotificationReceiver.class).setAction("com.luis.home.SNOOZE").putExtra("id",id).putExtra("spec",s.toString());
        PendingIntent later=PendingIntent.getBroadcast(c,code("snooze-"+id),snooze,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(s.optString("title","V-Brain")).setContentText(s.optString("body"))
            .setStyle(new Notification.BigTextStyle().bigText(s.optString("body"))).setContentIntent(content)
            .addAction(new Notification.Action.Builder(null,"In 1 hour",later).build())
            .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).build();
        m.notify(code(id),n);return true;
    }
}
