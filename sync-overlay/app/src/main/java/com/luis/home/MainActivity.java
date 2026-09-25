package com.luis.home;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentUris;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.text.InputType;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int CALENDAR_PERMISSION_REQUEST = 41;
    private static final String PREF_SYNCED_ATTEMPTS = "home_synced_attempt_ids";

    private WebView webView;
    private SharedPreferences prefs;
    private WorkerSync worker;
    private final ExecutorService syncQueue = Executors.newSingleThreadExecutor();
    private volatile boolean syncReady = false;
    private volatile long todoSyncGeneration = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("home_state", MODE_PRIVATE);
        worker = new WorkerSync(this);

        getWindow().setStatusBarColor(0xFF111214);
        getWindow().setNavigationBarColor(0xFF111214);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF111214);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);
        webView.requestFocusFromTouch();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme()) && "android_asset".equals(uri.getHost())) return false;
                if ("https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectHomeSyncLabels();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(), "Native");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void injectHomeSyncLabels() {
        if (webView == null) return;
        String js = "(function(){" +
                "if(window.__homeWorkerPatched)return;window.__homeWorkerPatched=true;" +
                "if(typeof window.setSyncStatus==='function'){var oldStatus=window.setSyncStatus;window.setSyncStatus=function(s){oldStatus(String(s||'').replace(/Notion/g,'HOME Sync'));};}" +
                "if(typeof window.updateSyncUI==='function'){var oldUI=window.updateSyncUI;window.updateSyncUI=function(){oldUI();var b=document.getElementById('syncButton');if(b)b.textContent=(typeof Native!=='undefined'&&Native.hasNotionConnection())?'Sync now':'Connect HOME';var st=document.getElementById('syncStatus');if(st&&st.textContent==='Local tasks only')st.textContent='Local tasks only · HOME Sync is off';};window.updateSyncUI();}" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : 'home'", value -> {
            if ("\"home\"".equals(value) || "null".equals(value)) finish();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.post(() -> webView.evaluateJavascript(
                "window.onAppResume && window.onAppResume()", null));
    }

    @Override
    protected void onDestroy() {
        syncQueue.shutdownNow();
        super.onDestroy();
    }

    private void callback(String name, JSONObject payload) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(
                "window." + name + " && window." + name + "(" + payload + ")", null));
    }

    private void syncError(Exception error) {
        String message = error.getMessage();
        try {
            callback("onNotionSyncError", new JSONObject().put("message",
                    message == null ? "Could not reach HOME Sync. Try again." : message));
        } catch (Exception ignored) { }
    }

    private JSONObject taskForWorker(JSONObject local, boolean done) throws Exception {
        JSONObject out = new JSONObject(local.toString());
        String id = out.optString("id", "").trim();
        if (id.isEmpty()) out.put("id", UUID.randomUUID().toString());
        out.remove("notionId");
        out.put("done", done);
        if (done) {
            if (!out.has("completedAt")) out.put("completedAt", System.currentTimeMillis());
        } else {
            out.remove("completedAt");
        }
        out.put("source", "home-sync");
        return out;
    }

    private void pushLocalTodoState() throws Exception {
        String raw = prefs.getString("todoState", "");
        if (raw == null || raw.trim().isEmpty()) return;
        JSONObject state = new JSONObject(raw);
        JSONArray active = state.optJSONArray("active");
        JSONArray archive = state.optJSONArray("archive");
        if (active != null) {
            for (int i = 0; i < active.length(); i++) {
                JSONObject task = active.optJSONObject(i);
                if (task != null) worker.upsertTask(taskForWorker(task, false));
            }
        }
        if (archive != null) {
            for (int i = 0; i < archive.length(); i++) {
                JSONObject task = archive.optJSONObject(i);
                if (task != null) worker.upsertTask(taskForWorker(task, true));
            }
        }
    }

    private void scheduleTodoStateSync() {
        final long generation = ++todoSyncGeneration;
        if (webView == null || !worker.isConfigured()) return;
        webView.postDelayed(() -> {
            if (generation != todoSyncGeneration || !worker.isConfigured()) return;
            syncQueue.execute(() -> {
                try { pushLocalTodoState(); } catch (Exception ignored) { }
            });
        }, 1200L);
    }

    private String structuredNote(JSONObject task) {
        JSONObject details = task.optJSONObject("details");
        if (details == null) return task.optString("note", "");

        StringBuilder out = new StringBuilder();
        String outcome = details.optString("outcome", "").trim();
        if (!outcome.isEmpty()) out.append("Outcome: ").append(outcome).append('\n');

        JSONArray info = details.optJSONArray("info");
        if (info != null && info.length() > 0) {
            out.append("Info:\n");
            for (int i = 0; i < info.length(); i++) {
                String item = info.optString(i, "").trim();
                if (!item.isEmpty()) out.append("- ").append(item).append('\n');
            }
        }

        JSONArray tips = details.optJSONArray("tips");
        if (tips != null && tips.length() > 0) {
            out.append("Tips:\n");
            for (int i = 0; i < tips.length(); i++) {
                String item = tips.optString(i, "").trim();
                if (!item.isEmpty()) out.append("- ").append(item).append('\n');
            }
        }

        JSONArray links = details.optJSONArray("links");
        if (links != null && links.length() > 0) {
            out.append("Links:\n");
            for (int i = 0; i < links.length(); i++) {
                JSONObject link = links.optJSONObject(i);
                if (link == null) continue;
                String label = link.optString("label", link.optString("url", "")).trim();
                String url = link.optString("url", "").trim();
                if (!url.isEmpty()) out.append("- ").append(label).append(" | ").append(url).append('\n');
            }
        }

        String result = out.toString().trim();
        return result.isEmpty() ? task.optString("note", "") : result;
    }

    private JSONObject taskForUi(JSONObject task) throws Exception {
        JSONObject out = new JSONObject(task.toString());
        String id = out.optString("id", UUID.randomUUID().toString());
        out.put("id", id);
        out.put("notionId", id);
        out.put("note", structuredNote(task));
        out.put("taskPageUrl", "");
        out.put("source", "home-sync");
        return out;
    }

    private JSONObject snapshotForUi(JSONObject snapshot) throws Exception {
        JSONArray open = new JSONArray();
        JSONArray completed = new JSONArray();
        JSONArray tasks = snapshot.optJSONArray("tasks");
        if (tasks != null) {
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task == null) continue;
                JSONObject ui = taskForUi(task);
                if (task.optBoolean("done", false)) completed.put(ui); else open.put(ui);
            }
        }
        return new JSONObject().put("open", open).put("completed", completed);
    }

    private JSONObject findWorkerTask(String id) throws Exception {
        JSONArray tasks = worker.tasks();
        for (int i = 0; i < tasks.length(); i++) {
            JSONObject task = tasks.optJSONObject(i);
            if (task != null && id.equals(task.optString("id"))) return task;
        }
        return null;
    }

    private void syncNewTubeAttempts(String rawTubeState) {
        if (!worker.isConfigured() || rawTubeState == null || rawTubeState.trim().isEmpty()) return;
        syncQueue.execute(() -> {
            try {
                JSONObject state = new JSONObject(rawTubeState);
                JSONArray completed = state.optJSONArray("completed");
                if (completed == null) return;

                Set<String> synced = new HashSet<>(prefs.getStringSet(PREF_SYNCED_ATTEMPTS, new HashSet<>()));
                boolean changed = false;
                for (int i = 0; i < completed.length(); i++) {
                    JSONObject item = completed.optJSONObject(i);
                    if (item == null) continue;
                    String cardId = item.optString("id", "");
                    long at = item.optLong("at", 0L);
                    if (cardId.isEmpty() || at <= 0) continue;
                    String attemptId = "attempt-" + cardId + "-" + at;
                    if (synced.contains(attemptId)) continue;

                    JSONObject attempt = new JSONObject(item.toString());
                    attempt.put("id", attemptId);
                    attempt.put("cardId", cardId);
                    worker.saveAttempt(attempt);
                    synced.add(attemptId);
                    changed = true;
                }
                if (changed) prefs.edit().putStringSet(PREF_SYNCED_ATTEMPTS, synced).apply();
            } catch (Exception ignored) { }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CALENDAR_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                        "window.onCalendarPermissionResult && window.onCalendarPermissionResult(" + granted + ")", null));
            }
        }
    }

    public class NativeBridge {
        @JavascriptInterface
        public String loadState(String key) {
            return prefs.getString(key, "");
        }

        @JavascriptInterface
        public void saveState(String key, String value) {
            String clean = value == null ? "" : value;
            prefs.edit().putString(key, clean).apply();
            if ("tubeState".equals(key)) syncNewTubeAttempts(clean);
            if ("todoState".equals(key)) scheduleTodoStateSync();
        }

        @JavascriptInterface
        public boolean hasNotionConnection() {
            return worker.isConfigured();
        }

        @JavascriptInterface
        public void configureNotion() {
            runOnUiThread(() -> {
                EditText input = new EditText(MainActivity.this);
                input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
                input.setSingleLine(true);
                input.setHint("HOME_TOKEN");
                AlertDialog dialog = new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Connect HOME Sync")
                        .setMessage("Paste the HOME_TOKEN you created in Cloudflare. It is encrypted with Android Keystore on this phone and is never written to GitHub or the WebView.")
                        .setView(input)
                        .setNegativeButton("Cancel", null)
                        .setPositiveButton("Connect", null)
                        .create();
                dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                        .setOnClickListener(button -> {
                            try {
                                worker.saveToken(input.getText().toString());
                                syncReady = false;
                                dialog.dismiss();
                                callback("onNotionConnected", new JSONObject());
                                scheduleTodoStateSync();
                            } catch (Exception ex) {
                                input.setError("Could not save token. Check it and try again.");
                            }
                        }));
                dialog.show();
            });
        }

        @JavascriptInterface
        public void disconnectNotion() {
            worker.clearToken();
            syncReady = false;
            callback("onNotionDisconnected", new JSONObject());
        }

        @JavascriptInterface
        public void requestNotionSync() {
            syncQueue.execute(() -> {
                try {
                    pushLocalTodoState();
                    JSONObject snapshot = worker.snapshot();
                    callback("onNotionSnapshot", snapshotForUi(snapshot));
                    syncReady = true;
                } catch (Exception ex) {
                    syncError(ex);
                }
            });
        }

        @JavascriptInterface
        public void createNotionTask(String title) {
            syncQueue.execute(() -> {
                try {
                    String clean = title == null ? "" : title.trim();
                    if (clean.isEmpty() || clean.length() > 160) {
                        throw new IllegalArgumentException("Enter a short task name.");
                    }
                    String id = UUID.randomUUID().toString();
                    JSONObject task = new JSONObject()
                            .put("id", id)
                            .put("title", clean)
                            .put("minutes", 0)
                            .put("area", "Personal")
                            .put("note", "")
                            .put("done", false)
                            .put("source", "home-sync");
                    worker.upsertTask(task);
                    callback("onNotionTaskCreated", taskForUi(task));
                } catch (Exception ex) {
                    syncError(ex);
                }
            });
        }

        @JavascriptInterface
        public void setNotionTaskDone(String pageId, boolean done) {
            syncQueue.execute(() -> {
                try {
                    JSONObject task = findWorkerTask(pageId);
                    if (task == null) throw new IllegalStateException("Task not found in HOME Sync.");
                    task.put("done", done);
                    if (done) task.put("completedAt", System.currentTimeMillis());
                    else task.remove("completedAt");
                    worker.upsertTask(task);
                    callback("onNotionTaskChanged", new JSONObject().put("id", pageId).put("done", done));
                } catch (Exception ex) {
                    syncError(ex);
                }
            });
        }

        @JavascriptInterface
        public boolean hasCalendarPermission() {
            return checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestCalendarPermission() {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_CALENDAR}, CALENDAR_PERMISSION_REQUEST));
        }

        @JavascriptInterface
        public String getCalendarEvents(long startMillis, long endMillis) {
            JSONArray out = new JSONArray();
            if (!hasCalendarPermission()) return out.toString();

            Uri.Builder builder = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(builder, startMillis);
            ContentUris.appendId(builder, endMillis);

            String[] projection = new String[]{
                    CalendarContract.Instances.EVENT_ID,
                    CalendarContract.Instances.TITLE,
                    CalendarContract.Instances.BEGIN,
                    CalendarContract.Instances.END,
                    CalendarContract.Instances.EVENT_LOCATION,
                    CalendarContract.Instances.ALL_DAY
            };

            try (Cursor cursor = getContentResolver().query(
                    builder.build(), projection, null, null,
                    CalendarContract.Instances.BEGIN + " ASC")) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        JSONObject e = new JSONObject();
                        e.put("id", cursor.getLong(0));
                        e.put("title", cursor.isNull(1) ? "Untitled event" : cursor.getString(1));
                        e.put("start", cursor.getLong(2));
                        e.put("end", cursor.getLong(3));
                        e.put("location", cursor.isNull(4) ? "" : cursor.getString(4));
                        e.put("allDay", cursor.getInt(5) == 1);
                        out.put(e);
                    }
                }
            } catch (Exception ignored) { }
            return out.toString();
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null || url.trim().isEmpty()) return;
            try {
                Uri uri = Uri.parse(url);
                String scheme = uri.getScheme();
                if (!"https".equalsIgnoreCase(scheme) && !"mailto".equalsIgnoreCase(scheme)) return;
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void openCalendarEvent(String eventId) {
            try {
                long id = Long.parseLong(eventId);
                Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id);
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
            } catch (Exception ignored) { }
        }
    }
}
