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
import java.time.LocalDate;
import java.time.ZoneId;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** A personal, narrowly scoped Notion connection. The token never crosses the WebView bridge. */
final class NotionSync {
    static final String DATA_SOURCE_ID = "8988dbb4-1e89-4c43-8482-1b834c6cac0e";
    private static final String API = "https://api.notion.com/v1";
    private static final String API_VERSION = "2026-03-11";
    private static final String KEY_ALIAS = "home_notion_token_v1";
    private static final int MAX_PAGES = 5;
    private final Context context;

    NotionSync(Context context) { this.context = context.getApplicationContext(); }

    private File tokenFile() { return new File(context.getNoBackupFilesDir(), "notion-token.bin"); }

    boolean isConfigured() { return readToken() != null; }

    void saveToken(String token) throws Exception {
        String clean = token == null ? "" : token.trim();
        if (clean.isEmpty() || clean.length() > 512 || clean.contains("\n")) {
            throw new IllegalArgumentException("Enter a valid Notion integration token.");
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

    void clearToken() { tokenFile().delete(); }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }

    private String readToken() {
        if (!tokenFile().exists()) return null;
        try (FileInputStream in = new FileInputStream(tokenFile())) {
            int n = in.read();
            if (n != 12) return null;
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
            return new String(cipher.doFinal(bytes.toByteArray()), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return null; // e.g. Android restored app data without the device-bound Keystore key.
        }
    }

    private JSONObject request(String method, String path, JSONObject body) throws Exception {
        String token = readToken();
        if (token == null) throw new IllegalStateException("Connect Notion in the app first.");
        for (int attempt = 0; attempt < 3; attempt++) {
            HttpURLConnection connection = (HttpURLConnection) new URL(API + path).openConnection();
            try {
                connection.setRequestMethod(method);
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("Authorization", "Bearer " + token);
                connection.setRequestProperty("Notion-Version", API_VERSION);
                connection.setRequestProperty("Content-Type", "application/json");
                if (body != null) {
                    connection.setDoOutput(true);
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }
                }
                int status = connection.getResponseCode();
                if (status == 429 && attempt < 2) {
                    int seconds = 2;
                    try { seconds = Integer.parseInt(connection.getHeaderField("Retry-After")); }
                    catch (Exception ignored) { }
                    Thread.sleep(Math.min(5, Math.max(1, seconds)) * 1000L);
                    continue;
                }
                if (status < 200 || status >= 300) {
                    if (status == 401) throw new IllegalStateException("Notion rejected the token. Reconnect in the app.");
                    if (status == 403 || status == 404) throw new IllegalStateException("Share Action Center with your Notion connection.");
                    throw new IllegalStateException("Notion sync failed (HTTP " + status + "). Try again.");
                }
                try (InputStream in = connection.getInputStream()) {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    for (int count; (count = in.read(buffer)) != -1;) {
                        bytes.write(buffer, 0, count);
                        if (bytes.size() > 3_000_000) throw new IllegalStateException("Too many tasks to sync at once.");
                    }
                    return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
                }
            } finally { connection.disconnect(); }
        }
        throw new IllegalStateException("Notion is temporarily rate-limiting requests.");
    }

    JSONObject snapshot() throws Exception {
        JSONArray open = query(new JSONObject().put("and", new JSONArray()
                .put(checkbox("Today", true)).put(checkbox("Done", false))));
        String today = LocalDate.now(ZoneId.of("Europe/London")).toString();
        JSONArray completed = query(new JSONObject().put("and", new JSONArray()
                .put(checkbox("Done", true))
                .put(new JSONObject().put("property", "Completed on")
                        .put("date", new JSONObject().put("equals", today)))));
        return new JSONObject().put("open", open).put("completed", completed);
    }

    private JSONObject checkbox(String property, boolean checked) throws Exception {
        return new JSONObject().put("property", property)
                .put("checkbox", new JSONObject().put("equals", checked));
    }

    private JSONArray query(JSONObject filter) throws Exception {
        JSONArray all = new JSONArray();
        String cursor = null;
        for (int page = 0; page < MAX_PAGES; page++) {
            JSONObject body = new JSONObject().put("filter", filter).put("page_size", 100);
            if (cursor != null) body.put("start_cursor", cursor);
            JSONObject response = request("POST", "/data_sources/" + DATA_SOURCE_ID + "/query", body);
            JSONArray results = response.getJSONArray("results");
            for (int i = 0; i < results.length(); i++) all.put(taskFromPage(results.getJSONObject(i)));
            if (!response.optBoolean("has_more")) return all;
            cursor = response.optString("next_cursor", "");
            if (cursor.isEmpty()) break;
        }
        throw new IllegalStateException("Task list is too large to sync safely.");
    }

    private String text(JSONArray richText) {
        StringBuilder out = new StringBuilder();
        if (richText != null) for (int i = 0; i < richText.length(); i++) {
            JSONObject part = richText.optJSONObject(i);
            if (part != null) out.append(part.optString("plain_text", ""));
        }
        return out.toString();
    }

    private JSONObject taskFromPage(JSONObject page) throws Exception {
        JSONObject p = page.getJSONObject("properties");
        JSONObject task = new JSONObject();
        task.put("id", "notion:" + page.getString("id"));
        task.put("notionId", page.getString("id"));
        task.put("title", text(p.optJSONObject("Name") == null ? null : p.getJSONObject("Name").optJSONArray("title")));
        JSONObject duration = p.optJSONObject("Duration min");
        task.put("minutes", duration == null ? 0 : duration.optInt("number", 0));
        JSONObject area = p.optJSONObject("Area");
        task.put("area", area == null ? "Personal" : area.optJSONObject("select") == null
                ? "Personal" : area.getJSONObject("select").optString("name", "Personal"));
        JSONObject notes = p.optJSONObject("Notes");
        task.put("note", text(notes == null ? null : notes.optJSONArray("rich_text")));
        JSONObject taskPage = p.optJSONObject("Task page");
        task.put("taskPageUrl", taskPage == null ? "" : taskPage.optString("url", ""));
        task.put("source", "notion");
        return task;
    }

    JSONObject create(String title) throws Exception {
        String clean = title == null ? "" : title.trim();
        if (clean.isEmpty() || clean.length() > 120) throw new IllegalArgumentException("Enter a short task name.");
        JSONObject properties = new JSONObject()
                .put("Name", new JSONObject().put("title", new JSONArray()
                        .put(new JSONObject().put("text", new JSONObject().put("content", clean)))))
                .put("Today", new JSONObject().put("checkbox", true))
                .put("Done", new JSONObject().put("checkbox", false))
                .put("State", new JSONObject().put("select", new JSONObject().put("name", "Next")))
                .put("Area", new JSONObject().put("select", new JSONObject().put("name", "Admin & Home")));
        JSONObject page = request("POST", "/pages", new JSONObject()
                .put("parent", new JSONObject().put("type", "data_source_id")
                        .put("data_source_id", DATA_SOURCE_ID))
                .put("properties", properties));
        return taskFromPage(page);
    }

    void setDone(String id, boolean done) throws Exception {
        if (id == null || !id.matches("[0-9a-fA-F-]{36}")) throw new IllegalArgumentException("Invalid task ID.");
        JSONObject p = new JSONObject()
                .put("Done", new JSONObject().put("checkbox", done))
                .put("Today", new JSONObject().put("checkbox", !done))
                .put("State", new JSONObject().put("select", new JSONObject().put("name", done ? "Done" : "Next")))
                .put("Completed on", new JSONObject().put("date", done
                        ? new JSONObject().put("start", LocalDate.now(ZoneId.of("Europe/London")).toString())
                        : JSONObject.NULL));
        request("PATCH", "/pages/" + id, new JSONObject().put("properties", p));
    }
}
