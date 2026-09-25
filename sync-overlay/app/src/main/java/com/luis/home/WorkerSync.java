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

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Secure client for Luis HOME Cloudflare Worker backend. */
final class WorkerSync {
    static final String API = "https://luis-home-sync.luisbogensberger.workers.dev";
    private static final String KEY_ALIAS = "home_worker_token_v1";
    private final Context context;

    WorkerSync(Context context) {
        this.context = context.getApplicationContext();
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
        String token = readToken();
        if (token == null) throw new IllegalStateException("Connect HOME Sync in the app first.");

        HttpURLConnection connection = (HttpURLConnection) new URL(API + path).openConnection();
        try {
            connection.setRequestMethod(method);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(Math.max(5000, readTimeoutMs));
            connection.setRequestProperty("Authorization", "Bearer " + token);
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

    JSONObject snapshot() throws Exception {
        return requestObject("GET", "/api/snapshot", null);
    }

    JSONArray tasks() throws Exception {
        return requestArray("GET", "/api/tasks", null);
    }

    JSONObject upsertTask(JSONObject task) throws Exception {
        String id = task.optString("id", "").trim();
        if (id.isEmpty()) return requestObject("POST", "/api/tasks", new JSONObject(task.toString()));
        return requestObject("PATCH", "/api/tasks/" + encodePath(id), new JSONObject(task.toString()));
    }

    void deleteTask(String id) throws Exception {
        if (id == null || id.trim().isEmpty()) throw new IllegalArgumentException("Task id required.");
        requestObject("DELETE", "/api/tasks/" + encodePath(id.trim()), null);
    }

    JSONObject saveCard(JSONObject card) throws Exception {
        return requestObject("POST", "/api/cards", new JSONObject(card.toString()));
    }

    JSONObject saveAttempt(JSONObject attempt) throws Exception {
        return requestObject("POST", "/api/attempts", new JSONObject(attempt.toString()));
    }

    JSONObject saveActivity(JSONObject activity) throws Exception {
        return requestObject("POST", "/api/activity", new JSONObject(activity.toString()));
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
