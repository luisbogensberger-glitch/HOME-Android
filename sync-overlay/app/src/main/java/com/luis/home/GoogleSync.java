package com.luis.home;

import android.content.Context;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Google owns task/calendar data; this private, atomic cache owns offline writes. */
final class GoogleSync {
    static final Object LOCK = new Object();
    static final AtomicBoolean BUSY = new AtomicBoolean(false);
    private final Context context;
    private final AtomicFile file;
    interface Transport { JSONObject call(String method,String url,JSONObject body,String etag) throws Exception; }
    private final Transport transport;
    private static final String TASKS = "https://tasks.googleapis.com/tasks/v1/";
    private static final String CALENDAR = "https://www.googleapis.com/calendar/v3/";

    GoogleSync(Context context) {
        this(context,null);
    }
    GoogleSync(Context context,Transport transport) {
        this.context = context.getApplicationContext();
        this.transport=transport;
        file = new AtomicFile(new File(this.context.getNoBackupFilesDir(), "vbrain-google-v31.json"));
    }
    boolean connected() { return context.getSharedPreferences("vbrain_google",0).getBoolean("connected",false); }
    void connected(boolean value) { context.getSharedPreferences("vbrain_google",0).edit().putBoolean("connected",value).commit(); }
    private JSONObject read() {
        synchronized(LOCK) {
            if(!file.getBaseFile().exists()&&!new File(file.getBaseFile().getPath()+".bak").exists()) return new JSONObject();
            try(InputStream in=file.openRead()) { return new JSONObject(readBytes(in,12_000_000)); }
            catch(Exception e) { throw new IllegalStateException("Google cache needs recovery; saved writes were retained.",e); }
        }
    }
    private void write(JSONObject data) throws Exception {
        synchronized(LOCK) {
            FileOutputStream out=file.startWrite();
            try { out.write(data.toString().getBytes(StandardCharsets.UTF_8));file.finishWrite(out); }
            catch(Exception e) { file.failWrite(out);throw e; }
        }
    }
    private static JSONArray array(JSONObject obj,String key) { JSONArray a=obj.optJSONArray(key);return a==null?new JSONArray():a; }
    private static JSONObject object(JSONObject obj,String key) { JSONObject a=obj.optJSONObject(key);return a==null?new JSONObject():a; }
    private static String encode(String s) throws Exception { return URLEncoder.encode(s,"UTF-8"); }
    private static String marker(String id) { return "\n\n[V-Brain ref:"+id+"]"; }
    private static String reference(String notes) {
        int i=notes.lastIndexOf("\n\n[V-Brain ref:");
        if(i<0||!notes.endsWith("]"))return "";
        String id=notes.substring(i+15,notes.length()-1);
        return id.matches("[a-zA-Z0-9._:-]{1,160}")?id:"";
    }
    private static String visibleNotes(String notes) {
        String id=reference(notes);return id.isEmpty()?notes:notes.substring(0,notes.length()-marker(id).length());
    }
    static final class ApiError extends IOException {
        final int code;
        ApiError(int code,String message) {super(message);this.code=code;}
    }
    private static String readBytes(InputStream input,int limit) throws Exception {
        try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] b=new byte[8192];for(int n;(n=in.read(b))!=-1;) {out.write(b,0,n);if(out.size()>limit)throw new IOException("Google response too large");}
            return out.toString("UTF-8");
        }
    }
    private JSONObject request(String token,String method,String url,JSONObject body,String etag) throws Exception {
        if(transport!=null)return transport.call(method,url,body,etag);
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(8000);c.setReadTimeout(15000);c.setInstanceFollowRedirects(false);
        c.setRequestMethod(method);c.setRequestProperty("Authorization","Bearer "+token);
        c.setRequestProperty("Accept","application/json");c.setRequestProperty("Content-Type","application/json; charset=utf-8");
        if(etag!=null&&!etag.isEmpty())c.setRequestProperty("If-Match",etag);
        try {
            if(body!=null) {c.setDoOutput(true);try(OutputStream out=c.getOutputStream()) {out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
            int status=c.getResponseCode();InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream();
            String raw=in==null?"":readBytes(in,8_000_000);
            if(status<200||status>=300)throw new ApiError(status,status==401?"Google access needs renewal":status==403?"Google denied access. Enable Tasks and Calendar APIs and register this signed Android app in Google Cloud.":"Google sync failed ("+status+")");
            return raw.isEmpty()?new JSONObject():new JSONObject(raw);
        } finally {c.disconnect();}
    }
    private JSONArray pages(String token,String url) throws Exception {
        JSONArray out=new JSONArray();String next="";Set<String> seen=new HashSet<>();
        do {
            JSONObject page=request(token,"GET",url+(next.isEmpty()?"":"&pageToken="+encode(next)),null,null);
            JSONArray items=array(page,"items");for(int i=0;i<items.length();i++)out.put(items.get(i));
            next=page.optString("nextPageToken","");
            if(!next.isEmpty()&&!seen.add(next))throw new IOException("Google pagination did not advance");
        } while(!next.isEmpty());
        return out;
    }
    /** Returns only a full snapshot, never a partially fetched task list. */
    JSONObject snapshot() throws Exception {
        synchronized(LOCK) {
            JSONObject data=read();JSONArray rows=array(data,"tasks"),pending=array(data,"pending"),open=new JSONArray(),done=new JSONArray(),ids=new JSONArray();
            LinkedHashMap<String,JSONObject> byId=new LinkedHashMap<>();
            for(int i=0;i<rows.length();i++){JSONObject t=rows.getJSONObject(i);byId.put(t.getString("id"),new JSONObject(t.toString()));}
            for(int i=0;i<pending.length();i++) {
                JSONObject op=pending.getJSONObject(i),t=byId.get(op.getString("localId"));
                if(t==null)t=new JSONObject().put("id",op.getString("localId")).put("title",object(op,"fields").optString("title","Task")).put("source","google-tasks");
                apply(t,object(op,"fields"));byId.put(t.getString("id"),t);ids.put(t.getString("id"));
            }
            for(JSONObject t:byId.values()) {if(t.optBoolean("done"))done.put(t);else open.put(t);}
            return new JSONObject().put("open",open).put("completed",done).put("pendingTaskIds",ids)
                .put("lists",array(data,"lists")).put("selectedListId",data.optString("selectedListId",""))
                .put("syncedAt",data.optLong("syncedAt",0)).put("calendarSyncedAt",object(data,"calendar").optLong("syncedAt",0))
                .put("conflicts",array(data,"conflicts")).put("connected",connected());
        }
    }
    private static void apply(JSONObject t,JSONObject f) throws Exception {
        if(f.has("title"))t.put("title",f.getString("title"));
        if(f.has("notes")){t.put("note",f.getString("notes"));t.put("details",new JSONObject().put("personalNote",f.getString("notes")));}
        if(f.has("due"))t.put("due",f.opt("due"));
        if(f.has("status")){boolean done="completed".equals(f.getString("status"));t.put("done",done);if(done)t.put("completedAt",System.currentTimeMillis());else t.remove("completedAt");}
    }
    boolean enqueue(String raw) throws Exception {
        JSONObject op=new JSONObject(raw),fields=object(op,"fields");String id=op.optString("localId","");
        if(!id.matches("[a-zA-Z0-9._:=~+-]{1,300}")||fields.length()==0)throw new IllegalArgumentException("Invalid task change");
        for(Iterator<String> it=fields.keys();it.hasNext();)if(!Arrays.asList("title","notes","status","due").contains(it.next()))throw new IllegalArgumentException("Invalid task field");
        if(fields.has("title")&&(fields.getString("title").trim().isEmpty()||fields.getString("title").length()>1024))throw new IllegalArgumentException("Task title is too long");
        if(fields.optString("notes","").length()>7800)throw new IllegalArgumentException("Task notes are too long");
        if(fields.has("status")&&!Arrays.asList("needsAction","completed").contains(fields.getString("status")))throw new IllegalArgumentException("Invalid task status");
        synchronized(LOCK) {
            JSONObject data=read();JSONArray pending=array(data,"pending"),merged=new JSONArray();
            for(int i=0;i<pending.length();i++) {
                JSONObject older=pending.getJSONObject(i);
                if(id.equals(older.optString("localId"))) {JSONObject prior=object(older,"fields");for(Iterator<String> it=fields.keys();it.hasNext();) {String k=it.next();prior.put(k,fields.get(k));}fields=prior;if(op.optString("googleId","").isEmpty())op.put("googleId",older.optString("googleId",""));if(op.optString("listId","").isEmpty())op.put("listId",older.optString("listId",""));}
                else merged.put(older);
            }
            op.put("mutationId",UUID.randomUUID().toString()).put("fields",fields).put("at",System.currentTimeMillis());
            merged.put(op);data.put("pending",merged);write(data);return true;
        }
    }
    void selectList(String id) throws Exception {
        synchronized(LOCK){JSONObject data=read();boolean found=false;JSONArray lists=array(data,"lists");for(int i=0;i<lists.length();i++)if(id.equals(lists.getJSONObject(i).optString("id")))found=true;if(!found)throw new IllegalArgumentException("Choose a Google task list");data.put("selectedListId",id);write(data);}
    }
    void sync(String token) throws Exception {
        JSONObject initial=read();JSONArray lists=pages(token,TASKS+"users/@me/lists?maxResults=100"),raw=new JSONArray();
        Map<String,String> listNames=new HashMap<>();String selected=initial.optString("selectedListId","");
        for(int i=0;i<lists.length();i++) {JSONObject list=lists.getJSONObject(i);String listId=list.getString("id");listNames.put(listId,list.optString("title","Tasks"));
            JSONArray tasks=pages(token,TASKS+"lists/"+encode(listId)+"/tasks?maxResults=100&showCompleted=true&showHidden=true&showDeleted=true");
            for(int j=0;j<tasks.length();j++)raw.put(tasks.getJSONObject(j).put("listId",listId));}
        if(!listNames.containsKey(selected))selected=lists.length()>0?lists.getJSONObject(0).getString("id"):"";
        JSONObject identities=object(initial,"identities");Set<String> ack=new HashSet<>();JSONArray conflicts=new JSONArray();
        JSONArray pending=array(initial,"pending");
        for(int i=0;i<pending.length();i++) {
            JSONObject op=pending.getJSONObject(i),fields=new JSONObject(object(op,"fields").toString());String localId=op.getString("localId"),gid=op.optString("googleId",""),listId=op.optString("listId","");if(listId.isEmpty())listId=selected;
            if(listId.isEmpty())throw new IOException("No Google task list is available");
            JSONObject existing=null;
            for(int j=0;j<raw.length();j++){JSONObject t=raw.getJSONObject(j);if(!listId.equals(t.optString("listId")))continue;String key=listId+"/"+t.optString("id");if((!gid.isEmpty()&&gid.equals(t.optString("id")))||localId.equals(identities.optString(key))||localId.equals(reference(t.optString("notes","")))){existing=t;gid=t.optString("id");break;}}
            if(existing!=null&&existing.optBoolean("deleted")) {
                conflicts.put(new JSONObject().put("localId",localId).put("reason","deleted_in_google").put("change",op));ack.add(op.getString("mutationId"));continue;
            }
            try {
                JSONObject result;
                if(gid.isEmpty()) {fields.put("notes",fields.optString("notes","")+marker(localId));result=request(token,"POST",TASKS+"lists/"+encode(listId)+"/tasks",fields,null);}
                else {if(fields.has("notes")){String ref=existing==null?"":reference(existing.optString("notes",""));if(!ref.isEmpty())fields.put("notes",fields.getString("notes")+marker(ref));}if(fields.has("status")&&"needsAction".equals(fields.getString("status")))fields.put("completed",JSONObject.NULL);
                    result=request(token,"PATCH",TASKS+"lists/"+encode(listId)+"/tasks/"+encode(gid),fields,existing==null?null:existing.optString("etag",""));}
                result.put("listId",listId);identities.put(listId+"/"+result.getString("id"),localId);
                if(existing!=null){for(int j=0;j<raw.length();j++)if(raw.optJSONObject(j)==existing){raw.put(j,result);break;}}else raw.put(result);
                ack.add(op.getString("mutationId"));
            } catch(ApiError e) {if(e.code==404||e.code==410){conflicts.put(new JSONObject().put("localId",localId).put("reason","deleted_in_google").put("change",op));ack.add(op.getString("mutationId"));}else if(e.code==412){/* A concurrent Google edit wins until a fresh fetch; keep this exact write. */}else {commitTasks(raw,lists,selected,identities,ack,conflicts);throw e;}}
        }
        commitTasks(raw,lists,selected,identities,ack,conflicts);
        // Calendar commits separately; a calendar outage cannot undo acknowledged task writes.
        JSONObject calendar=fetchCalendar(token);
        synchronized(LOCK){JSONObject data=read();data.put("calendar",calendar);write(data);}
    }
    private void commitTasks(JSONArray raw,JSONArray lists,String selected,JSONObject identities,Set<String> ack,JSONArray conflicts) throws Exception {
        synchronized(LOCK) {
            JSONObject data=read();JSONArray rows=new JSONArray();Map<String,String> names=new HashMap<>();for(int i=0;i<lists.length();i++)names.put(lists.getJSONObject(i).getString("id"),lists.getJSONObject(i).optString("title","Tasks"));
            String currentSelection=data.optString("selectedListId","");if(names.containsKey(currentSelection))selected=currentSelection;
            for(int i=0;i<raw.length();i++) {
                JSONObject g=raw.getJSONObject(i);if(g.optBoolean("deleted"))continue;String listId=g.getString("listId"),gid=g.getString("id"),ref=reference(g.optString("notes","")),key=listId+"/"+gid;
                String id=identities.optString(key,ref.isEmpty()?"gt:"+listId+":"+gid:ref);identities.put(key,id);
                JSONObject t=new JSONObject().put("id",id).put("googleId",gid).put("googleListId",listId).put("source","google-tasks").put("title",g.optString("title","Task"))
                    .put("area",names.get(listId)).put("note",visibleNotes(g.optString("notes",""))).put("etag",g.optString("etag",""))
                    .put("done","completed".equals(g.optString("status"))).put("details",new JSONObject().put("personalNote",visibleNotes(g.optString("notes",""))));
                if(g.has("due"))t.put("due",g.get("due"));if(t.optBoolean("done"))t.put("completedAt",instant(g.optString("completed",g.optString("updated",""))));rows.put(t);
            }
            JSONArray keep=new JSONArray(),current=array(data,"pending");for(int i=0;i<current.length();i++)if(!ack.contains(current.getJSONObject(i).getString("mutationId")))keep.put(current.get(i));
            // A newer edit queued while HTTP was in flight is deliberately not acknowledged.
            JSONArray journal=array(data,"conflicts");for(int i=0;i<conflicts.length();i++)journal.put(conflicts.get(i));
            data.put("tasks",rows).put("lists",lists).put("selectedListId",selected).put("identities",identities).put("pending",keep).put("conflicts",journal).put("syncedAt",System.currentTimeMillis());write(data);
        }
    }
    private static long instant(String s) {try{return OffsetDateTime.parse(s).toInstant().toEpochMilli();}catch(Exception e){return 0;}}
    private JSONObject fetchCalendar(String token) throws Exception {
        long from=System.currentTimeMillis()-31L*86400000,to=System.currentTimeMillis()+366L*86400000;
        JSONArray calendars=pages(token,CALENDAR+"users/me/calendarList?maxResults=250"),events=new JSONArray();
        for(int i=0;i<calendars.length();i++) {
            JSONObject cal=calendars.getJSONObject(i);if(cal.optBoolean("deleted")||cal.optBoolean("hidden"))continue;
            if(!cal.optBoolean("selected")&&!cal.optBoolean("primary"))continue;String cid=cal.getString("id");
            JSONArray rows=pages(token,CALENDAR+"calendars/"+encode(cid)+"/events?singleEvents=true&maxResults=2500&timeMin="+encode(Instant.ofEpochMilli(from).toString())+"&timeMax="+encode(Instant.ofEpochMilli(to).toString()));
            for(int j=0;j<rows.length();j++) {
                JSONObject e=rows.getJSONObject(j);if("cancelled".equals(e.optString("status")))continue;JSONObject start=object(e,"start"),end=object(e,"end");boolean allDay=start.has("date");
                long a=allDay?LocalDate.parse(start.getString("date")).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli():instant(start.optString("dateTime",""));
                long b=allDay?LocalDate.parse(end.getString("date")).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli():instant(end.optString("dateTime",""));
                events.put(new JSONObject().put("id","google:"+cid+":"+e.getString("id")).put("title",e.optString("summary","Untitled event")).put("start",a).put("end",b)
                    .put("allDay",allDay).put("location",e.optString("location","")).put("url",e.optString("htmlLink","")));
            }
        }
        return new JSONObject().put("events",events).put("from",from).put("to",to).put("syncedAt",System.currentTimeMillis());
    }
    String calendar(long from,long to) {
        try {JSONObject cal=object(read(),"calendar");if(cal.optLong("syncedAt")==0||from<cal.optLong("from")||to>cal.optLong("to"))return null;
            JSONArray rows=array(cal,"events"),out=new JSONArray();List<JSONObject> sorted=new ArrayList<>();for(int i=0;i<rows.length();i++){JSONObject e=rows.getJSONObject(i);if(e.optLong("start")<to&&e.optLong("end")>from)sorted.add(e);}sorted.sort(Comparator.comparingLong(e->e.optLong("start")));for(JSONObject e:sorted)out.put(e);return out.toString();
        } catch(Exception e){return null;}
    }
    String calendarUrl(String id) {try{JSONArray rows=array(object(read(),"calendar"),"events");for(int i=0;i<rows.length();i++){JSONObject e=rows.getJSONObject(i);if(id.equals(e.optString("id")))return e.optString("url","");}}catch(Exception ignored){}return "";}
}
