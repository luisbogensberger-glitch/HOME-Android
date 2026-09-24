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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class HomeSync {
    static final String API = "https://luis-home-sync.luisbogensberger.workers.dev";
    private static final String KEY_ALIAS = "home_sync_token_v1";
    private final Context context;

    HomeSync(Context context) {
        this.context = context.getApplicationContext();
    }

    private File tokenFile() {
        return new File(context.getNoBackupFilesDir(), "home-sync-token.bin");
    }

    boolean isConfigured() {
        return readToken() != null;
    }

    void saveToken(String token) throws Exception {
        String clean = token == null ? "" : token.trim();
        if (clean.length() < 20 || clean.length() > 512 || clean.contains("\n")) {
            throw new IllegalArgumentException("Enter the HOME_TOKEN from Cloudflare.");
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
        try {
            request("GET", "/api/tasks", null);
        } catch (Exception ex) {
            clearToken();
            throw ex;
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
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
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
            if (n != 12) return null;
            byte[] iv = new byte[n];
            int off = 0;
            while (off < n) {
                int count = in.read(iv, off, n - off);
                if (count < 0) return null;
                off += count;
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            for (int count; (count = in.read(buffer)) != -1;) bytes.write(buffer, 0, count);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(bytes.toByteArray()), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return null;
        }
    }

    private String request(String method, String path, JSONObject body) throws Exception {
        String token = readToken();
        if (token == null) throw new IllegalStateException("Connect HOME Sync first.");
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
        try {
            c.setRequestMethod(method);
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestProperty("X-HOME-TOKEN", token);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (body != null) {
                c.setDoOutput(true);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = c.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? c.getInputStream() : c.getErrorStream();
            String payload = readAll(stream);
            if (status == 401 || status == 403) throw new IllegalStateException("HOME_TOKEN was rejected.");
            if (status < 200 || status >= 300) throw new IllegalStateException("HOME Sync failed (HTTP " + status + ").");
            return payload;
        } finally {
            c.disconnect();
        }
    }

    private String readAll(InputStream in) throws Exception {
        if (in == null) return "";
        try (InputStream stream = in; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int count; (count = stream.read(buffer)) != -1;) {
                bytes.write(buffer, 0, count);
                if (bytes.size() > 3000000) throw new IllegalStateException("HOME response too large.");
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private String pathId(String id) {
        return URLEncoder.encode(id, StandardCharsets.UTF_8).replace("+", "%20");
    }

    JSONArray remoteTasks() throws Exception {
        return new JSONArray(request("GET", "/api/tasks", null));
    }

    JSONObject snapshot() throws Exception {
        JSONArray rows = remoteTasks();
        JSONArray open = new JSONArray();
        JSONArray completed = new JSONArray();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject raw = rows.getJSONObject(i);
            JSONObject task = new JSONObject(raw.toString());
            String id = raw.optString("id");
            task.put("id", id);
            task.put("notionId", id);
            task.remove("updatedAt");
            if (raw.optBoolean("done", false)) completed.put(task); else open.put(task);
        }
        return new JSONObject().put("open", open).put("completed", completed);
    }

    JSONObject create(String title) throws Exception {
        String clean = title == null ? "" : title.trim();
        if (clean.isEmpty() || clean.length() > 160) throw new IllegalArgumentException("Enter a short task name.");
        String id = UUID.randomUUID().toString();
        JSONObject task = new JSONObject()
                .put("id", id)
                .put("title", clean)
                .put("minutes", 0)
                .put("area", "Personal")
                .put("note", "")
                .put("done", false)
                .put("details", new JSONObject()
                        .put("outcome", "")
                        .put("info", new JSONArray())
                        .put("tips", new JSONArray())
                        .put("links", new JSONArray())
                        .put("personalNote", ""));
        putTask(id, task);
        task.put("notionId", id);
        return task;
    }

    void setDone(String id, boolean done) throws Exception {
        JSONArray rows = remoteTasks();
        JSONObject task = null;
        for (int i = 0; i < rows.length(); i++) {
            JSONObject candidate = rows.getJSONObject(i);
            if (id.equals(candidate.optString("id"))) {
                task = new JSONObject(candidate.toString());
                break;
            }
        }
        if (task == null) task = new JSONObject().put("title", "Task");
        task.remove("updatedAt");
        task.put("done", done);
        if (done) task.put("completedAt", System.currentTimeMillis()); else task.remove("completedAt");
        putTask(id, task);
    }

    void syncTodoState(String json) throws Exception {
        if (!isConfigured() || json == null || json.trim().isEmpty()) return;
        JSONObject state = new JSONObject(json);
        syncTasks(state.optJSONArray("active"), false);
        syncTasks(state.optJSONArray("archive"), true);
    }

    private void syncTasks(JSONArray tasks, boolean done) throws Exception {
        if (tasks == null) return;
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject task = new JSONObject(tasks.getJSONObject(i).toString());
            String id = task.optString("id");
            if (id.isEmpty()) continue;
            task.remove("notionId");
            task.remove("taskPageUrl");
            task.put("done", done);
            if (!done) task.remove("completedAt");
            putTask(id, task);
        }
    }

    void bootstrapFromLocalIfNeeded(String localState) throws Exception {
        if (remoteTasks().length() == 0 && localState != null && !localState.trim().isEmpty()) syncTodoState(localState);
    }

    private void putTask(String id, JSONObject task) throws Exception {
        JSONObject body = new JSONObject(task.toString());
        body.remove("id");
        body.remove("notionId");
        body.remove("updatedAt");
        request("PUT", "/api/tasks/" + pathId(id), body);
    }

    void syncTubeState(String json) throws Exception {
        if (!isConfigured() || json == null || json.trim().isEmpty()) return;
        JSONObject state = new JSONObject(json);
        request("POST", "/api/cards", new JSONObject()
                .put("id", "home-tube-state")
                .put("type", "tube_state")
                .put("state", state));
    }
}
