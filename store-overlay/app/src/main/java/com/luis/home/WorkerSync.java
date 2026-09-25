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

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Store client: per-user Supabase session + HOME multi-user API. */
final class WorkerSync {
    private static final String KEY_ALIAS = "home_store_session_v1";
    private final Context context;

    WorkerSync(Context context) {
        this.context = context.getApplicationContext();
    }

    private String apiBase() {
        String value = BuildConfig.HOME_API_URL == null ? "" : BuildConfig.HOME_API_URL.trim();
        if (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        if (!value.startsWith("https://")) throw new IllegalStateException("HOME API is not configured.");
        return value;
    }

    private String supabaseBase() {
        String value = BuildConfig.HOME_SUPABASE_URL == null ? "" : BuildConfig.HOME_SUPABASE_URL.trim();
        if (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        if (!value.startsWith("https://")) throw new IllegalStateException("HOME authentication is not configured.");
        return value;
    }

    private String supabaseAnonKey() {
        String value = BuildConfig.HOME_SUPABASE_ANON_KEY == null ? "" : BuildConfig.HOME_SUPABASE_ANON_KEY.trim();
        if (value.length() < 20) throw new IllegalStateException("HOME authentication key is not configured.");
        return value;
    }

    private File sessionFile() {
        return new File(context.getNoBackupFilesDir(), "home-store-session.bin");
    }

    boolean isConfigured() {
        JSONObject session = readSession();
        return session != null && (!session.optString("access_token").isEmpty() || !session.optString("refresh_token").isEmpty());
    }

    String sessionEmail() {
        JSONObject session = readSession();
        return session == null ? "" : session.optString("email", "");
    }

    void signUp(String email, String password) throws Exception {
        JSONObject input = credentials(email, password);
        JSONObject result = supabaseRequest("POST", "/auth/v1/signup", input, null);
        if (result.optString("access_token").isEmpty()) {
            throw new IllegalStateException("Account created. Confirm your email, then sign in.");
        }
        saveAuthResponse(result, email);
    }

    void signIn(String email, String password) throws Exception {
        JSONObject input = credentials(email, password);
        JSONObject result = supabaseRequest("POST", "/auth/v1/token?grant_type=password", input, null);
        saveAuthResponse(result, email);
    }

    void signOut() {
        JSONObject session = readSession();
        String access = session == null ? "" : session.optString("access_token", "");
        if (!access.isEmpty()) {
            try { supabaseRequest("POST", "/auth/v1/logout", null, access); } catch (Exception ignored) { }
        }
        clearSession();
    }

    void deleteAccount() throws Exception {
        requestObject("DELETE", "/api/account", null, 20000);
        clearSession();
    }

    // Compatibility with the private build API. Store builds never accept manually pasted shared tokens.
    void saveToken(String ignored) {
        throw new IllegalStateException("Store builds use a HOME account instead of HOME_TOKEN.");
    }

    void clearToken() { signOut(); }

    private JSONObject credentials(String email, String password) {
        String e = email == null ? "" : email.trim().toLowerCase();
        String p = password == null ? "" : password;
        if (!e.contains("@") || e.length() > 320) throw new IllegalArgumentException("Enter a valid email address.");
        if (p.length() < 8 || p.length() > 200) throw new IllegalArgumentException("Password must be at least 8 characters.");
        return new JSONObject().put("email", e).put("password", p);
    }

    private void saveAuthResponse(JSONObject result, String fallbackEmail) throws Exception {
        String access = result.optString("access_token", "").trim();
        String refresh = result.optString("refresh_token", "").trim();
        long expiresIn = result.optLong("expires_in", 3600L);
        if (access.isEmpty() || refresh.isEmpty()) throw new IllegalStateException("Authentication did not return a usable session.");
        String email = fallbackEmail == null ? "" : fallbackEmail.trim().toLowerCase();
        JSONObject user = result.optJSONObject("user");
        if (user != null && !user.optString("email", "").isEmpty()) email = user.optString("email", email);
        JSONObject session = new JSONObject()
                .put("access_token", access)
                .put("refresh_token", refresh)
                .put("email", email)
                .put("expires_at", System.currentTimeMillis() + Math.max(60, expiresIn) * 1000L);
        writeSession(session);
    }

    private String accessToken() throws Exception {
        JSONObject session = readSession();
        if (session == null) throw new IllegalStateException("Sign in to HOME first.");
        String access = session.optString("access_token", "");
        long expiresAt = session.optLong("expires_at", 0L);
        if (!access.isEmpty() && expiresAt > System.currentTimeMillis() + 90_000L) return access;
        return refreshSession(session);
    }

    private synchronized String refreshSession(JSONObject existing) throws Exception {
        JSONObject latest = readSession();
        if (latest != null && latest.optLong("expires_at", 0L) > System.currentTimeMillis() + 90_000L
                && !latest.optString("access_token", "").isEmpty()) return latest.optString("access_token");
        JSONObject source = latest != null ? latest : existing;
        String refresh = source == null ? "" : source.optString("refresh_token", "");
        if (refresh.isEmpty()) throw new IllegalStateException("Your HOME session expired. Sign in again.");
        JSONObject result = supabaseRequest("POST", "/auth/v1/token?grant_type=refresh_token",
                new JSONObject().put("refresh_token", refresh), null);
        saveAuthResponse(result, source.optString("email", ""));
        JSONObject saved = readSession();
        if (saved == null) throw new IllegalStateException("Could not refresh HOME session.");
        return saved.optString("access_token", "");
    }

    private JSONObject supabaseRequest(String method, String path, JSONObject body, String bearer) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(supabaseBase() + path).openConnection();
        try {
            c.setRequestMethod(method);
            c.setConnectTimeout(10000);
            c.setReadTimeout(20000);
            c.setRequestProperty("apikey", supabaseAnonKey());
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("Accept", "application/json");
            if (bearer != null && !bearer.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + bearer);
            if (body != null) {
                c.setDoOutput(true);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = c.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? c.getInputStream() : c.getErrorStream();
            String raw = stream == null ? "" : readAll(stream);
            JSONObject result = raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
            if (status < 200 || status >= 300) {
                String msg = result.optString("msg", result.optString("message", result.optString("error_description", "Authentication failed")));
                throw new IllegalStateException(msg);
            }
            return result;
        } finally { c.disconnect(); }
    }

    private JSONObject requestObject(String method, String path, JSONObject body) throws Exception {
        return requestObject(method, path, body, 15000);
    }

    private JSONObject requestObject(String method, String path, JSONObject body, int readTimeoutMs) throws Exception {
        String raw = request(method, path, body, readTimeoutMs);
        return raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    }

    private JSONArray requestArray(String method, String path, JSONObject body) throws Exception {
        String raw = request(method, path, body, 15000);
        return raw.isEmpty() ? new JSONArray() : new JSONArray(raw);
    }

    private String request(String method, String path, JSONObject body, int timeout) throws Exception {
        String token = accessToken();
        ApiResponse first = perform(method, path, body, timeout, token);
        if (first.status == 401) {
            JSONObject s = readSession();
            token = refreshSession(s);
            first = perform(method, path, body, timeout, token);
        }
        if (first.status < 200 || first.status >= 300) {
            String message = "HOME Sync failed (HTTP " + first.status + ")";
            try {
                String server = new JSONObject(first.body).optString("error", "");
                if (!server.isEmpty()) message += ": " + server;
            } catch (Exception ignored) { }
            throw new IllegalStateException(message);
        }
        return first.body;
    }

    private ApiResponse perform(String method, String path, JSONObject body, int timeout, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(apiBase() + path).openConnection();
        try {
            c.setRequestMethod(method);
            c.setConnectTimeout(10000);
            c.setReadTimeout(Math.max(5000, timeout));
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("Cache-Control", "no-cache");
            if (body != null) {
                c.setDoOutput(true);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = c.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? c.getInputStream() : c.getErrorStream();
            return new ApiResponse(status, stream == null ? "" : readAll(stream));
        } finally { c.disconnect(); }
    }

    private static final class ApiResponse {
        final int status; final String body;
        ApiResponse(int status, String body) { this.status = status; this.body = body; }
    }

    private String readAll(InputStream in) throws Exception {
        try (InputStream input = in; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int count; (count = input.read(buffer)) != -1;) {
                bytes.write(buffer, 0, count);
                if (bytes.size() > 4_000_000) throw new IllegalStateException("HOME response is too large.");
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    JSONObject snapshot() throws Exception { return requestObject("GET", "/api/snapshot", null); }
    JSONArray tasks() throws Exception { return requestArray("GET", "/api/tasks", null); }
    JSONObject upsertTask(JSONObject task) throws Exception {
        String id = task.optString("id", "").trim();
        if (id.isEmpty()) return requestObject("POST", "/api/tasks", new JSONObject(task.toString()));
        return requestObject("PATCH", "/api/tasks/" + encodePath(id), new JSONObject(task.toString()));
    }
    void deleteTask(String id) throws Exception {
        if (id == null || id.trim().isEmpty()) throw new IllegalArgumentException("Task id required.");
        requestObject("DELETE", "/api/tasks/" + encodePath(id.trim()), null);
    }
    JSONObject saveCard(JSONObject card) throws Exception { return requestObject("POST", "/api/cards", new JSONObject(card.toString())); }
    JSONObject saveAttempt(JSONObject attempt) throws Exception { return requestObject("POST", "/api/attempts", new JSONObject(attempt.toString())); }
    JSONObject saveActivity(JSONObject activity) throws Exception { return requestObject("POST", "/api/activity", new JSONObject(activity.toString())); }
    JSONObject reviewSentence(JSONObject payload) throws Exception { return requestObject("POST", "/api/review-sentence", new JSONObject(payload.toString()), 35000); }
    JSONObject reviewWhatsAppMessage(JSONObject payload) throws Exception { throw new IllegalStateException("WhatsApp reading is not enabled in the Store build."); }
    JSONObject reviewGmailNotification(JSONObject payload) throws Exception { throw new IllegalStateException("Gmail notification reading is not enabled in the Store build."); }

    private String encodePath(String value) throws Exception { return URLEncoder.encode(value, "UTF-8").replace("+", "%20"); }

    private void writeSession(JSONObject session) throws Exception {
        SecretKey key = getOrCreateKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] encrypted = cipher.doFinal(session.toString().getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        try (FileOutputStream out = new FileOutputStream(sessionFile())) {
            out.write(iv.length); out.write(iv); out.write(encrypted);
        }
    }

    private JSONObject readSession() {
        if (!sessionFile().exists()) return null;
        try (FileInputStream in = new FileInputStream(sessionFile())) {
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
            for (int count; (count = in.read(buffer)) != -1;) bytes.write(buffer, 0, count);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new JSONObject(new String(cipher.doFinal(bytes.toByteArray()), StandardCharsets.UTF_8));
        } catch (Exception ignored) { return null; }
    }

    private void clearSession() { sessionFile().delete(); }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }
}
