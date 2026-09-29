package com.luis.home;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Secure client for Luis HOME Cloudflare Worker backend. */
final class WorkerSync {
    static final String API = "https://luis-home-sync.luisbogensberger.workers.dev";
    private static final String LEARNING_INGEST = "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-learning-ingest";
    private static final String LEARNING_LATEST = "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-learning-latest";
    private static final String SUPABASE_FUNCTIONS = "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/";
    private static final String KEY_ALIAS = "home_worker_token_v1";
    private final Context context;
    private final File outboxFile;
    private static final Object outboxLock = new Object();
    private static final AtomicBoolean flushing = new AtomicBoolean(false);

    WorkerSync(Context context) {
        this.context = context.getApplicationContext();
        this.outboxFile = new File(this.context.getNoBackupFilesDir(), "home-private-outbox.json");
    }

    private File tokenFile() {
        return new File(context.getNoBackupFilesDir(), "home-worker-token.bin");
    }

    boolean isConfigured() {
        return readToken() != null;
    }

    void saveToken(String token) throws Exception {
        String clean = token == null ? "" : token.trim();
        if (clean.length() < 16 || clean.length() > 512 || clean.contains("\n")) {
            throw new IllegalArgumentException("Enter the HOME token from Cloudflare.");
        }
        SecretKey key = getOrCreateKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] encrypted = cipher.doFinal(clean.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        try (FileOutputStream out = new FileOutputStream(tokenFile())) {
            out.write(iv.length);
            out.write(iv);
            out.write(encrypted);
        }
    }

    void clearToken() {
        tokenFile().delete();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    private String readToken() {
        if (!tokenFile().exists()) return null;
        try (FileInputStream in = new FileInputStream(tokenFile())) {
            int n = in.read();
            if (n <= 0 || n > 32) return null;
            byte[] iv = new byte[n];
            for (int offset = 0; offset < n;) {
                int count = in.read(iv, offset, n - offset);
                if (count < 0) return null;
                offset += count;
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            for (int count; (count = in.read(buffer)) != -1;) {
                bytes.write(buffer, 0, count);
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(bytes.toByteArray()), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }

    private JSONObject requestObject(String method, String path, JSONObject body) throws Exception {
        String raw = request(method, path, body, 15000);
        return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    }

    private JSONObject requestObject(String method, String path, JSONObject body, int readTimeoutMs) throws Exception {
        String raw = request(method, path, body, readTimeoutMs);
        return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    }

    private JSONArray requestArray(String method, String path, JSONObject body) throws Exception {
        String raw = request(method, path, body, 15000);
        return raw.isEmpty() ? new JSONArray() : new JSONArray(raw);
    }

    private String request(String method, String path, JSONObject body, int readTimeoutMs) throws Exception {
        return requestAbsolute(method, API + path, body, readTimeoutMs);
    }

    private String requestAbsolute(String method, String url, JSONObject body, int readTimeoutMs) throws Exception {
        String token = readToken();
        if (token == null) throw new IllegalStateException("Connect HOME Sync in the app first.");

        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setRequestMethod(method);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(Math.max(5000, readTimeoutMs));
            String bearer = "Bearer " + token;
            connection.setRequestProperty("Authorization", bearer);
            if (url.startsWith(SUPABASE_FUNCTIONS)) {
                // Authorization is reserved for Supabase user JWTs. Keep it for compatibility,
                // but mirror the HOME bearer through an explicit private header so Edge
                // Functions can validate the exact HOME token without relying on that header.
                connection.setRequestProperty("X-Home-Authorization", bearer);
            }
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");

            if (body != null) {
                connection.setDoOutput(true);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
            String payload = stream == null ? "" : readAll(stream);

            if (status == 401) throw new IllegalStateException("HOME token rejected. Reconnect HOME Sync.");
            if (status < 200 || status >= 300) {
                String message = "HOME Sync failed (HTTP " + status + ")";
                try {
                    String server = new JSONObject(payload).optString("error", "");
                    if (!server.isEmpty()) message += ": " + server;
                } catch (Exception ignored) { }
                throw new IllegalStateException(message);
            }
            return payload;
        } finally {
            connection.disconnect();
        }
    }

    private String readAll(InputStream in) throws Exception {
        try (InputStream input = in; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int count; (count = input.read(buffer)) != -1;) {
                bytes.write(buffer, 0, count);
                if (bytes.size() > 4_000_000) {
                    throw new IllegalStateException("HOME Sync response is too large.");
                }
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private JSONArray readOutbox() {
        synchronized (outboxLock) {
            if (!outboxFile.exists()) return new JSONArray();
            try (FileInputStream in = new android.util.AtomicFile(outboxFile).openRead()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                for (int n; (n=in.read(buffer))!=-1;) bytes.write(buffer,0,n);
                String raw = bytes.toString("UTF-8");
                return raw.trim().isEmpty() ? new JSONArray() : new JSONArray(raw);
            } catch (Exception ignored) { return new JSONArray(); }
        }
    }

    private void writeOutbox(JSONArray rows) throws Exception {
        synchronized (outboxLock) {
            android.util.AtomicFile target = new android.util.AtomicFile(outboxFile);
            FileOutputStream out = target.startWrite();
            try { out.write(rows.toString().getBytes(StandardCharsets.UTF_8)); target.finishWrite(out); }
            catch (Exception e) { target.failWrite(out); throw e; }
        }
    }

    String enqueue(String type, JSONObject payload) throws Exception {
        JSONObject row = new JSONObject()
                .put("queueId", java.util.UUID.randomUUID().toString())
                .put("type", type)
                .put("createdAt", System.currentTimeMillis())
                .put("payload", new JSONObject(payload.toString()));
        synchronized (outboxLock) {
            JSONArray rows = readOutbox();
            JSONArray merged = new JSONArray();
            String id = payload.optString("id", "");
            for (int i=0;i<rows.length();i++) {
                JSONObject old=rows.optJSONObject(i);
                if (old == null) continue;
                JSONObject previous=old.optJSONObject("payload");
                if (!id.isEmpty() && type.equals(old.optString("type")) && previous!=null && id.equals(previous.optString("id"))) continue;
                merged.put(old);
            }
            merged.put(row);
            writeOutbox(merged);
        }
        return row.getString("queueId");
    }

    private void removeQueued(String queueId) throws Exception {
        synchronized (outboxLock) {
            JSONArray rows = readOutbox(), keep = new JSONArray();
            for (int i=0;i<rows.length();i++) {
                JSONObject row=rows.optJSONObject(i);
                if (row!=null && !queueId.equals(row.optString("queueId"))) keep.put(row);
            }
            writeOutbox(keep);
        }
    }

    int pendingOutboxCount() { return readOutbox().length(); }

    JSONObject syncStatus() {
        JSONObject out=new JSONObject();
        try {
            android.content.SharedPreferences p=context.getSharedPreferences("vbrain_sync",Context.MODE_PRIVATE);
            out.put("configured",isConfigured()).put("pending",pendingOutboxCount())
               .put("lastSyncedAt",p.getLong("lastSyncedAt",0)).put("lastError",p.getString("lastError",""));
        } catch(Exception ignored) { }
        return out;
    }

    void flushOutbox() {
        if (!isConfigured() || !flushing.compareAndSet(false, true)) return;
        long deadline=System.currentTimeMillis()+40000;
        try {
            JSONArray rows = readOutbox();
            int failures=0;
            for (int i=0;i<rows.length() && System.currentTimeMillis()<deadline;i++) {
                JSONObject row=rows.optJSONObject(i); if(row==null) continue;
                String q=row.optString("queueId"), type=row.optString("type"); JSONObject p=row.optJSONObject("payload");
                if(p==null) continue;
                try {
                    if ("attempt".equals(type)) sendAttemptNow(p);
                    else if ("private_activity".equals(type) || "activity".equals(type)) sendPrivateActivityNow(p);
                    else if ("task".equals(type)) sendTaskNow(p);
                    else if ("command_ack".equals(type)) acknowledgeCommand(p.getString("id"));
                    else continue;
                    removeQueued(q);
                    context.getSharedPreferences("vbrain_sync",Context.MODE_PRIVATE).edit()
                        .putLong("lastSyncedAt",System.currentTimeMillis()).putString("lastError", "").apply();
                } catch (Exception e) {
                    context.getSharedPreferences("vbrain_sync",Context.MODE_PRIVATE).edit()
                        .putString("lastError",e.getMessage()==null?"Waiting for connection":e.getMessage()).apply();
                    if(++failures>=2) break;
                }
            }
        } finally { flushing.set(false); }
    }

    JSONObject deviceCommands() throws Exception {
        return new JSONObject(requestAbsolute("GET", "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/vbrain-device-commands", null, 10000));
    }

    void acknowledgeCommand(String id) throws Exception {
        requestAbsolute("POST", "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/vbrain-device-commands",
            new JSONObject().put("ack",new JSONArray().put(id)),10000);
    }

    void stageTodoState() {
        try {
            JSONObject state=new JSONObject(context.getSharedPreferences("home_state",Context.MODE_PRIVATE).getString("todoState","{}"));
            for(String name:new String[]{"active","archive"}) {
                JSONArray tasks=state.optJSONArray(name); if(tasks==null)continue;
                for(int i=0;i<tasks.length();i++) {
                    JSONObject task=tasks.optJSONObject(i); if(task==null)continue;
                    JSONObject copy=new JSONObject(task.toString()).put("done","archive".equals(name));
                    copy.remove("notionId"); enqueue("task",copy);
                }
            }
        } catch(Exception ignored) { }
    }

    void stageChangedTodos(String before, String after) {
        try {
            JSONObject old=new JSONObject(before==null||before.isEmpty()?"{}":before), next=new JSONObject(after);
            java.util.Map<String,String> previous=new java.util.HashMap<>();
            for(String name:new String[]{"active","archive"}) {
                JSONArray items=old.optJSONArray(name);if(items==null)continue;
                for(int i=0;i<items.length();i++){JSONObject t=items.getJSONObject(i);previous.put(t.optString("id"),name+":"+t.toString());}
            }
            for(String name:new String[]{"active","archive"}) {
                JSONArray items=next.optJSONArray(name);if(items==null)continue;
                for(int i=0;i<items.length();i++){
                    JSONObject t=items.getJSONObject(i);String id=t.optString("id");
                    if((name+":"+t.toString()).equals(previous.get(id)))continue;
                    JSONObject copy=new JSONObject(t.toString()).put("done","archive".equals(name));copy.remove("notionId");enqueue("task",copy);
                }
            }
        } catch(Exception ignored) { }
    }

    JSONArray pendingTaskIds() {
        JSONArray ids=new JSONArray(),rows=readOutbox();
        for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r!=null&&"task".equals(r.optString("type")))ids.put(r.optJSONObject("payload").optString("id"));}
        return ids;
    }

    JSONObject snapshot() throws Exception {
        return requestObject("GET", "/api/snapshot", null);
    }

    JSONArray tasks() throws Exception {
        return requestArray("GET", "/api/tasks", null);
    }

    JSONObject upsertTask(JSONObject task) throws Exception {
        String q=enqueue("task",task);
        JSONObject saved=sendTaskNow(task);
        removeQueued(q);
        return saved;
    }

    private JSONObject sendTaskNow(JSONObject task) throws Exception {
        String id = task.optString("id", "").trim();
        if (id.isEmpty()) return requestObject("POST", "/api/tasks", new JSONObject(task.toString()));
        try { return requestObject("PATCH", "/api/tasks/" + encodePath(id), new JSONObject(task.toString())); }
        catch (IllegalStateException e) {
            if (e.getMessage()!=null && e.getMessage().contains("HTTP 404"))
                return requestObject("POST", "/api/tasks", new JSONObject(task.toString()));
            throw e;
        }
    }

    void deleteTask(String id) throws Exception {
        if (id == null || id.trim().isEmpty()) throw new IllegalArgumentException("Task id required.");
        requestObject("DELETE", "/api/tasks/" + encodePath(id.trim()), null);
    }

    JSONObject saveCard(JSONObject card) throws Exception {
        return requestObject("POST", "/api/cards", new JSONObject(card.toString()));
    }

    private JSONObject sendAttemptNow(JSONObject attempt) throws Exception {
        JSONObject saved = requestObject("POST", "/api/attempts", new JSONObject(attempt.toString()));
        mirrorLearningAttempt(attempt);
        return saved;
    }

    JSONObject saveAttempt(JSONObject attempt) throws Exception {
        if (attempt == null) throw new IllegalArgumentException("Learning attempt required.");
        String q = enqueue("attempt", attempt);
        try {
            JSONObject saved = sendAttemptNow(attempt);
            removeQueued(q);
            flushOutbox();
            return saved;
        } catch (Exception ex) {
            throw ex;
        }
    }

    JSONObject mirrorLearningAttempt(JSONObject attempt) throws Exception {
        if (attempt == null) throw new IllegalArgumentException("Learning attempt required.");
        JSONArray attempts = new JSONArray().put(new JSONObject(attempt.toString()));
        JSONObject body = new JSONObject().put("attempts", attempts);
        String raw = requestAbsolute("POST", LEARNING_INGEST, body, 20000);
        return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    }

    JSONObject saveActivity(JSONObject activity) throws Exception {
        return savePrivateActivity(activity);
    }

    private JSONObject sendPrivateActivityNow(JSONObject activity) throws Exception {
        JSONObject copy = new JSONObject(activity.toString());
        JSONObject saved = requestObject("POST", "/api/activity", copy);
        JSONArray activityRows = new JSONArray().put(new JSONObject(copy.toString()));
        JSONObject body = new JSONObject().put("activity", activityRows);
        requestAbsolute("POST", LEARNING_INGEST, body, 20000);
        return saved;
    }

    JSONObject savePrivateActivity(JSONObject activity) throws Exception {
        if (activity == null) throw new IllegalArgumentException("Private activity required.");
        String q = enqueue("private_activity", activity);
        try {
            JSONObject saved = sendPrivateActivityNow(activity);
            removeQueued(q);
            flushOutbox();
            return saved;
        } catch (Exception ex) {
            throw ex;
        }
    }

    JSONObject latestLearning(int limit) throws Exception {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        String raw = requestAbsolute("GET", LEARNING_LATEST + "?limit=" + safeLimit, null, 20000);
        return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    }

    JSONObject reviewSentence(JSONObject payload) throws Exception {
        if (payload == null) throw new IllegalArgumentException("Sentence review payload required.");
        return requestObject("POST", "/api/review-sentence", new JSONObject(payload.toString()), 35000);
    }

    JSONObject reviewWhatsAppMessage(JSONObject payload) throws Exception {
        if (payload == null) throw new IllegalArgumentException("WhatsApp message payload required.");
        return requestObject("POST", "/api/whatsapp-message", new JSONObject(payload.toString()), 35000);
    }

    JSONObject reviewGmailNotification(JSONObject payload) throws Exception {
        if (payload == null) throw new IllegalArgumentException("Gmail notification payload required.");
        return requestObject("POST", "/api/gmail-notification", new JSONObject(payload.toString()), 35000);
    }

    private String encodePath(String value) throws Exception {
        return java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20");
    }
}
