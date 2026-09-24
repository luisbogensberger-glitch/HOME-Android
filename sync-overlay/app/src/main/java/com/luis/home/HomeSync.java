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

/** Personal HOME endpoint; device-bound token never enters JavaScript or an Android backup. */
final class HomeSync {
    private static final String ALIAS = "home_sync_key_v1";
    private final Context context;

    HomeSync(Context context) { this.context = context.getApplicationContext(); }
    private File credentials() { return new File(context.getNoBackupFilesDir(), "home-sync.bin"); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        KeyStore.Entry existing = store.getEntry(ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }

    void configure(String origin, String token) throws Exception {
        String url = origin == null ? "" : origin.trim().replaceAll("/+$", "");
        String secret = token == null ? "" : token.trim();
        if (!url.matches("https://[^\\s/?#]+(?::[0-9]+)?") || secret.length() < 32 || secret.length() > 512)
            throw new IllegalArgumentException("Use a public HTTPS address and a HOME token of at least 32 characters.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(new JSONObject().put("url", url).put("token", secret).toString().getBytes(StandardCharsets.UTF_8));
        try (FileOutputStream out = new FileOutputStream(credentials())) { out.write(cipher.getIV()); out.write(encrypted); }
    }

    private JSONObject config() {
        try (FileInputStream in = new FileInputStream(credentials())) {
            byte[] iv = new byte[12]; if (in.read(iv) != 12) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[1024];
            for (int n; (n = in.read(buffer)) != -1;) bytes.write(buffer, 0, n);
            return new JSONObject(new String(cipher.doFinal(bytes.toByteArray()), StandardCharsets.UTF_8));
        } catch (Exception ignored) { return null; }
    }

    boolean isConfigured() { return config() != null; }
    void disconnect() { credentials().delete(); }

    JSONObject request(String method, String path, JSONObject payload) throws Exception {
        JSONObject settings = config(); if (settings == null) throw new IllegalStateException("Connect HOME first.");
        HttpURLConnection connection = (HttpURLConnection) new URL(settings.getString("url") + path).openConnection();
        try {
            connection.setRequestMethod(method); connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
            connection.setRequestProperty("Authorization", "Bearer " + settings.getString("token"));
            connection.setRequestProperty("Content-Type", "application/json");
            if (payload != null) { connection.setDoOutput(true); try (OutputStream out = connection.getOutputStream()) { out.write(payload.toString().getBytes(StandardCharsets.UTF_8)); } }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException(status == 401 ? "HOME rejected this token." : "HOME service returned HTTP " + status);
            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096];
                for (int n; (n = in.read(buffer)) != -1;) { bytes.write(buffer, 0, n); if (bytes.size() > 3_000_000) throw new IllegalStateException("HOME snapshot too large"); }
                return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            }
        } finally { connection.disconnect(); }
    }
}
