package com.luis.home;

import android.content.Context;
import org.json.*;
import java.util.*;

/** Offline Android contract test of durable Google writes and the actual native cache. */
final class GoogleSyncSmoke {
    static void check(boolean condition,String message) {if(!condition)throw new AssertionError(message);}
    static void run(Context context) throws Exception {
        java.io.File file=new java.io.File(context.getNoBackupFilesDir(),"vbrain-google-v31.json");file.delete();
        final List<JSONObject> remote=new ArrayList<>();final int[] creates={0},patches={0};final boolean[] loseCreate={true},failSecondPage={false},conflictNextPatch={false};final GoogleSync[] holder={null};
        GoogleSync.Transport transport=(method,url,body,etag)->{
            if(url.contains("calendarList"))return new JSONObject().put("items",new JSONArray().put(new JSONObject().put("id","C").put("selected",true)));
            if(url.contains("/calendars/"))return new JSONObject().put("items",new JSONArray().put(new JSONObject().put("id","event").put("summary","Calendar smoke").put("start",new JSONObject().put("date","2026-10-25")).put("end",new JSONObject().put("date","2026-10-26"))));
            if(url.contains("users/@me/lists"))return new JSONObject().put("items",new JSONArray().put(new JSONObject().put("id","L").put("title","Tasks")));
            if(method.equals("GET")){
                check(url.contains("showHidden=true")&&url.contains("showDeleted=true")&&url.contains("showCompleted=true"),"Google-native completions and deletion tombstones must be fetched");
                if(failSecondPage[0]){if(url.contains("pageToken="))throw new java.io.IOException("Second page failed");return new JSONObject().put("items",new JSONArray()).put("nextPageToken","next");}
                JSONArray rows=new JSONArray();for(JSONObject r:remote)rows.put(new JSONObject(r.toString()));return new JSONObject().put("items",rows);
            }
            if(method.equals("POST")){creates[0]++;JSONObject t=new JSONObject(body.toString()).put("id","server-"+creates[0]).put("etag","etag");remote.add(t);if(loseCreate[0]){loseCreate[0]=false;throw new java.io.IOException("Response lost after Google committed");}return new JSONObject(t.toString());}
            patches[0]++;String id=url.substring(url.lastIndexOf('/')+1);JSONObject row=null;for(JSONObject t:remote)if(id.equals(t.optString("id")))row=t;
            if(row==null)throw new GoogleSync.ApiError(404,"Deleted");check("etag".equals(etag),"Updates need the fresh Google etag");
            if(conflictNextPatch[0]){conflictNextPatch[0]=false;row.put("title","Edited concurrently on Google");throw new GoogleSync.ApiError(412,"Concurrent edit");}
            for(Iterator<String> it=body.keys();it.hasNext();) {String k=it.next();row.put(k,body.get(k));}
            if(patches[0]==1)holder[0].enqueue(new JSONObject().put("localId","local-contract").put("googleId",id).put("listId","L").put("fields",new JSONObject().put("notes","A newer offline edit")).toString());
            return new JSONObject(row.toString());
        };
        GoogleSync store=new GoogleSync(context,transport);holder[0]=store;
        String op=new JSONObject().put("localId","local-contract").put("listId","L").put("fields",new JSONObject().put("title","Native test").put("notes","Private note").put("status","needsAction")).toString();
        store.enqueue(op);check(new GoogleSync(context).snapshot().getJSONArray("pendingTaskIds").length()==1,"Queued offline writes must survive process recreation");
        try{store.sync("synthetic-token");throw new AssertionError("Lost response should be reported");}catch(java.io.IOException expected){}
        store.sync("synthetic-token");check(creates[0]==1,"Retry after a lost insert response must not duplicate a task");
        check(store.snapshot().getJSONArray("pendingTaskIds").length()==1,"A newer write arriving in flight must not be acknowledged with the older write");
        store.sync("synthetic-token");check(store.snapshot().getJSONArray("pendingTaskIds").length()==0,"The newer pending write should retry successfully");
        JSONObject current=store.snapshot().getJSONArray("open").getJSONObject(0);check(current.getString("id").equals("local-contract"),"Local identity must remain stable after creation");check(current.getString("note").equals("A newer offline edit"),"Private deduplication marker must not appear in the app");
        int before=store.snapshot().getJSONArray("open").length();failSecondPage[0]=true;
        try{store.sync("synthetic-token");throw new AssertionError("Partial fetch should fail");}catch(java.io.IOException expected){}
        check(store.snapshot().getJSONArray("open").length()==before,"Failed pagination must preserve the last full snapshot");failSecondPage[0]=false;
        store.enqueue(new JSONObject().put("localId","local-contract").put("googleId",current.getString("googleId")).put("listId","L").put("fields",new JSONObject().put("notes","Notes after conflict")).toString());conflictNextPatch[0]=true;store.sync("synthetic-token");
        check(store.snapshot().getJSONArray("pendingTaskIds").length()==1,"An etag conflict must retain the queued change");store.sync("synthetic-token");
        check(store.snapshot().getJSONArray("pendingTaskIds").length()==0&&store.snapshot().getJSONArray("open").getJSONObject(0).getString("title").equals("Edited concurrently on Google"),"A note retry must preserve unrelated Google edits");
        remote.get(0).put("status","completed").put("completed","2026-10-05T10:00:00Z");store.sync("synthetic-token");check(store.snapshot().getJSONArray("completed").length()==1,"Google-side completion must be imported");
        remote.get(0).put("deleted",true);store.sync("synthetic-token");check(store.snapshot().getJSONArray("open").length()+store.snapshot().getJSONArray("completed").length()==0,"Google deletion must not resurrect a task");
        TimeZone original=TimeZone.getDefault();try{TimeZone.setDefault(TimeZone.getTimeZone("Europe/London"));store.sync("synthetic-token");java.time.ZoneId zone=java.time.ZoneId.systemDefault();long from=java.time.LocalDate.parse("2026-10-25").atStartOfDay(zone).toInstant().toEpochMilli(),to=java.time.LocalDate.parse("2026-10-26").atStartOfDay(zone).toInstant().toEpochMilli();
            JSONArray events=new JSONArray(store.calendar(from,to));check(events.length()==1&&events.getJSONObject(0).getLong("end")-events.getJSONObject(0).getLong("start")==25L*3600000,"All-day events must retain their local date over the DST transition");
        }finally{TimeZone.setDefault(original);}
        file.delete();new java.io.File(file.getPath()+".bak").delete();
    }
}
