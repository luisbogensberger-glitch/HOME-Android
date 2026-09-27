package com.luis.home;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** A complete UI is staged and verified before use. The previous healthy UI remains available. */
final class LiveRuntime {
    static final int HOST = 18;
    private static final String BASE = "https://raw.githubusercontent.com/luisbogensberger-glitch/HOME-Android/main/home-runtime/";
    private final Context context;
    private final SharedPreferences state;
    private final File root;
    private String loading = "";
    private boolean recovered;

    LiveRuntime(Context context) {
        this.context = context.getApplicationContext();
        this.state = context.getSharedPreferences("vbrain_live_runtime", Context.MODE_PRIVATE);
        this.root = new File(context.getNoBackupFilesDir(), "vbrain-live");
        root.mkdirs();
        int storedHost = state.getInt("host", 0);
        if (storedHost != HOST) {
            // A native-host upgrade invalidates only cached UI releases. App data lives elsewhere.
            state.edit().putInt("host", HOST).remove("active").remove("previous").remove("ready")
                    .remove("readyVersion").remove("rejected").remove("version").remove("error")
                    .putBoolean("bootPending", false).commit();
        } else if (state.getBoolean("bootPending", false)) rollback();
    }

    private byte[] read(InputStream input, int limit) throws Exception {
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[8192];
            for (int n; (n = in.read(b)) != -1;) {
                out.write(b, 0, n);
                if (out.size() > limit) throw new IOException("UI release exceeds size limit");
            }
            return out.toByteArray();
        }
    }

    private byte[] download(String file, int limit) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(BASE+file+"?check="+System.currentTimeMillis()).openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(12000); c.setUseCaches(false);
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != 200) throw new IOException("UI server HTTP "+c.getResponseCode());
            return read(c.getInputStream(), limit);
        } finally { c.disconnect(); }
    }

    private String hash(byte[] data) throws Exception {
        StringBuilder hex = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) hex.append(String.format("%02x", b & 255));
        return hex.toString();
    }

    JSONObject check() {
        try {
            JSONObject manifest = new JSONObject(new String(download("live-release.json", 12000), StandardCharsets.UTF_8));
            if (manifest.optInt("schema") != 1 || manifest.optInt("minNative", 999) > HOST
                    || !"live-app.html".equals(manifest.optString("file"))) throw new IOException("Incompatible UI release");
            String sha = manifest.getString("sha256");
            if (!sha.matches("[a-f0-9]{64}")) throw new IOException("Invalid release hash");
            state.edit().putLong("checkedAt", System.currentTimeMillis()).putString("error", "").apply();
            if (sha.equals(state.getString("rejected", ""))) return status();
            if (sha.equals(state.getString("active", "")) || sha.equals(bundledHash())) return status();
            File file = new File(root, sha+".html");
            if (!file.exists()) {
                byte[] data = download("live-app.html", 3_000_000);
                if (data.length != manifest.getInt("bytes") || !hash(data).equals(sha)) throw new IOException("Incomplete UI download");
                String html = new String(data, StandardCharsets.UTF_8);
                if (!html.contains("name=\"vbrain-host\" content=\"18\"")) throw new IOException("Missing host contract");
                AtomicFile target = new AtomicFile(file);
                FileOutputStream stream = target.startWrite();
                try { stream.write(data); target.finishWrite(stream); }
                catch (Exception e) { target.failWrite(stream); throw e; }
            }
            synchronized (this) {
                // Downloads never hold the UI/status lock. Activation may have changed while offline.
                if (!sha.equals(state.getString("rejected", "")) && !sha.equals(state.getString("active", "")))
                    state.edit().putString("ready", sha).putString("readyVersion", manifest.getString("version")).commit();
            }
        } catch (Exception e) { state.edit().putString("error", e.getMessage() == null ? "Update unavailable" : e.getMessage()).apply(); }
        return status();
    }

    private String bundledHash() throws Exception {
        return new JSONObject(new String(read(context.getAssets().open("live-release.json"), 12000), StandardCharsets.UTF_8)).getString("sha256");
    }

    synchronized boolean activate() {
        String ready = state.getString("ready", "");
        if (ready.isEmpty() || !new File(root, ready+".html").exists()) return false;
        state.edit().putString("previous", state.getString("active", ""))
                .putString("active", ready).putString("version", state.getString("readyVersion", ""))
                .remove("ready").putBoolean("bootPending", true).commit();
        return true;
    }

    synchronized String document() throws Exception {
        loading = state.getString("active", "");
        if (!loading.isEmpty()) {
            try {
                byte[] bytes = read(new FileInputStream(new File(root, loading+".html")), 3_000_000);
                if (!hash(bytes).equals(loading)) throw new IOException("Stored UI hash mismatch");
                state.edit().putBoolean("bootPending", true).commit();
                return new String(bytes, StandardCharsets.UTF_8);
            } catch (Exception e) { rollback(); return document(); }
        }
        return new String(read(context.getAssets().open("live-app.html"), 3_000_000), StandardCharsets.UTF_8);
    }

    synchronized void healthy() { state.edit().putBoolean("bootPending", false).commit(); }

    synchronized boolean rollback() {
        String active = state.getString("active", "");
        if (active.isEmpty()) return false;
        String previous = state.getString("previous", "");
        if (previous.equals(active)) previous = "";
        state.edit().putString("rejected", active).putString("active", previous).remove("previous")
                .remove("ready").putBoolean("bootPending", false).commit();
        recovered = true;
        return true;
    }

    synchronized JSONObject status() {
        JSONObject out = new JSONObject();
        try {
            String active = state.getString("active", "");
            String sha = active.isEmpty() ? bundledHash() : active;
            out.put("nativeVersion", HOST).put("version", "18."+sha.substring(0, 12))
                    .put("source", active.isEmpty() ? "bundled" : "live")
                    .put("ready", !state.getString("ready", "").isEmpty())
                    .put("checkedAt", state.getLong("checkedAt", 0)).put("recovered", recovered)
                    .put("healthy", !state.getBoolean("bootPending", false))
                    .put("error", state.getString("error", ""));
        } catch (Exception ignored) { }
        return out;
    }
}
