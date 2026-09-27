package com.luis.home;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

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

/**
 * Native-only Veqrya session store. Passwords are sent directly to Supabase Auth and are never
 * persisted. Access/refresh tokens are encrypted with Android Keystore and never exposed to the
 * WebView or repository.
 */
final class VeqryaSession {
    static final String SUPABASE_URL = "https://skgmgxthymnzubbobqxu.supabase.co";
    static final String PUBLISHABLE_KEY = "sb_publishable_o-_ElRSRtRanLOZCZLLRbg_n4yHFv3-";
    private static final String KEY_ALIAS = "veqrya_session_key_v1";
    private static final long REFRESH_EARLY_MS = 90_000L;

    private final Context context;

    VeqryaSession(Context context) {
        this.context = context.getApplicationContext();
    }

    private File sessionFile() {
        return new File(context.getNoBackupFilesDir(), "veqrya-session.bin");
    }

    synchronized boolean isConfigured() {
        return readSession() != null;
    }

    synchronized void clear() {
        sessionFile().delete();
    }

    synchronized void signIn(String email, String password) throws Exception {
        String cleanEmail = email == null ? "" : email.trim();
        String cleanPassword = password == null ? "" : password;
        if (cleanEmail.isEmpty() || cleanEmail.length() > 320 || !cleanEmail.contains("@")) {
            throw new IllegalArgumentException("Enter your Veqrya email.");
        }
        if (cleanPassword.length() < 6 || cleanPassword.length() > 512) {
            throw new IllegalArgumentException("Enter your Veqrya password.");
        }
        JSONObject response = authRequest("password", new JSONObject()
                .put("email", cleanEmail)
                .put("password", cleanPassword));
        saveResponse(response);
    }

    synchronized String accessToken() throws Exception {
        JSONObject session = readSession();
        if (session == null) throw new IllegalStateException("Sign in to Veqrya first.");
        long expiresAt = session.optLong("expiresAt", 0L);
        String access = session.optString("accessToken", "");
        if (!access.isEmpty() && expiresAt > System.currentTimeMillis() + REFRESH_EARLY_MS) return access;
        return refreshAccessToken();
    }

    synchronized String refreshAccessToken() throws Exception {
        JSONObject session = readSession();
        String refresh = session == null ? "" : session.optString("refreshToken", "");
        if (refresh.isEmpty()) {
            clear();
            throw new IllegalStateException("Veqrya session expired. Sign in again.");
        }
        try {
            JSONObject response = authRequest("refresh_token", new JSONObject().put("refresh_token", refresh));
            saveResponse(response);
            JSONObject updated = readSession();
            String access = updated == null ? "" : updated.optString("accessToken", "");
            if (access.isEmpty()) throw new IllegalStateException("Veqrya session refresh failed.");
            return access;
        } catch (Exception ex) {
            clear();
            throw new IllegalStateException("Veqrya session expired. Sign in again.");
        }
    }

    private JSONObject authRequest(String grantType, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(
                SUPABASE_URL + "/auth/v1/token?grant_type=" + grantType).openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("apikey", PUBLISHABLE_KEY);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-store");
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream() : connection.getErrorStream();
            String raw = stream == null ? "" : readAll(stream);
            JSONObject payload;
            try { payload = raw.isEmpty() ? new JSONObject() : new JSONObject(raw); }
            catch (Exception ignored) { payload = new JSONObject(); }
            if (status < 200 || status >= 300) {
                String message = payload.optString("error_description",
                        payload.optString("msg", payload.optString("error", "Veqrya sign-in failed.")));
                throw new IllegalStateException(message);
            }
            return payload;
        } finally {
            connection.disconnect();
        }
    }

    private void saveResponse(JSONObject response) throws Exception {
        String access = response.optString("access_token", "");
        String refresh = response.optString("refresh_token", "");
        long expiresIn = Math.max(60L, response.optLong("expires_in", 3600L));
        if (access.isEmpty() || refresh.isEmpty()) {
            throw new IllegalStateException("Veqrya did not return a complete session.");
        }
        JSONObject session = new JSONObject()
                .put("accessToken", access)
                .put("refreshToken", refresh)
                .put("expiresAt", System.currentTimeMillis() + expiresIn * 1000L);
        writeSession(session);
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

    private void writeSession(JSONObject session) throws Exception {
        SecretKey key = getOrCreateKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] encrypted = cipher.doFinal(session.toString().getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        android.util.AtomicFile target = new android.util.AtomicFile(sessionFile());
        FileOutputStream out = target.startWrite();
        try {
            out.write(iv.length);
            out.write(iv);
            out.write(encrypted);
            target.finishWrite(out);
        } catch (Exception ex) {
            target.failWrite(out);
            throw ex;
        }
    }

    private JSONObject readSession() {
        if (!sessionFile().exists()) return null;
        try (FileInputStream in = new android.util.AtomicFile(sessionFile()).openRead()) {
            int n = in.read();
            if (n <= 0 || n > 32) return null;
            byte[] iv = new byte[n];
            for (int offset = 0; offset < n;) {
                int count = in.read(iv, offset, n - offset);
                if (count < 0) return null;
                offset += count;
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[2048];
            for (int count; (count = in.read(buffer)) != -1;) bytes.write(buffer, 0, count);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            String raw = new String(cipher.doFinal(bytes.toByteArray()), StandardCharsets.UTF_8);
            JSONObject session = new JSONObject(raw);
            if (session.optString("refreshToken", "").isEmpty()) return null;
            return session;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String readAll(InputStream in) throws Exception {
        try (InputStream input = in; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int count; (count = input.read(buffer)) != -1;) {
                bytes.write(buffer, 0, count);
                if (bytes.size() > 1_000_000) throw new IllegalStateException("Veqrya auth response too large.");
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
