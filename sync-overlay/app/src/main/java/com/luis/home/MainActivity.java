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
import android.widget.LinearLayout;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int CALENDAR_PERMISSION_REQUEST = 41;
    private WebView webView;
    private SharedPreferences prefs;
    private NotionSync notion;
    private HomeSync homeSync;
    private final ExecutorService notionQueue = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("home_state", MODE_PRIVATE);
        notion = new NotionSync(this);
        homeSync = new HomeSync(this);

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
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme()) && "android_asset".equals(uri.getHost())) return false;
                if ("https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(), "Native");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : 'home'", value -> {
            if ("\"home\"".equals(value) || "null".equals(value)) {
                finish();
            }
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
        notionQueue.shutdownNow();
        super.onDestroy();
    }

    private void callback(String name, JSONObject payload) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(
                "window." + name + " && window." + name + "(" + payload + ")", null));
    }

    private void notionError(Exception error) {
        String message = error.getMessage();
        try {
            callback("onNotionSyncError", new JSONObject().put("message",
                    message == null ? "Could not reach Notion. Try again." : message));
        } catch (Exception ignored) { }
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
        @JavascriptInterface public boolean hasHomeConnection() { return homeSync.isConfigured(); }

        @JavascriptInterface public void configureHome() {
            runOnUiThread(() -> {
                LinearLayout fields = new LinearLayout(MainActivity.this); fields.setOrientation(LinearLayout.VERTICAL);
                int padding = (int)(20 * getResources().getDisplayMetrics().density); fields.setPadding(padding, 0, padding, 0);
                EditText url = new EditText(MainActivity.this); url.setSingleLine(true); url.setHint("https://your-home.example");
                EditText token = new EditText(MainActivity.this); token.setSingleLine(true);
                token.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); token.setHint("HOME access token");
                fields.addView(url); fields.addView(token);
                AlertDialog dialog = new AlertDialog.Builder(MainActivity.this).setTitle("Connect HOME")
                        .setMessage("Use your private HOME service address and token. Never paste the token into a chat or GitHub.")
                        .setView(fields).setNegativeButton("Cancel", null).setPositiveButton("Connect", null).create();
                dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(button -> {
                    try { homeSync.configure(url.getText().toString(), token.getText().toString()); dialog.dismiss(); callback("onHomeConnected", new JSONObject()); }
                    catch (Exception ex) { url.setError(ex.getMessage()); }
                })); dialog.show();
            });
        }
        @JavascriptInterface public void disconnectHome() { homeSync.disconnect(); callback("onHomeDisconnected", new JSONObject()); }
        @JavascriptInterface public void requestHomeSync() {
            notionQueue.execute(() -> { try { callback("onHomeSnapshot", homeSync.request("GET", "/v1/snapshot", null)); } catch (Exception ex) { homeError(ex); } });
        }
        @JavascriptInterface public void createHomeTask(String title) {
            notionQueue.execute(() -> { try { callback("onHomeTaskCreated", homeSync.request("POST", "/v1/tasks", new JSONObject().put("title", title))); } catch (Exception ex) { homeError(ex); } });
        }
        @JavascriptInterface public void setHomeTaskDone(String id, boolean done) {
            notionQueue.execute(() -> { try { callback("onHomeTaskChanged", homeSync.request("POST", "/v1/tasks/" + id + "/done", new JSONObject().put("done", done))); } catch (Exception ex) { homeError(ex); } });
        }
        @JavascriptInterface public void submitHomeQuiz(String payload) {
            notionQueue.execute(() -> { try { callback("onHomeQuizSubmitted", homeSync.request("POST", "/v1/attempts", new JSONObject(payload))); } catch (Exception ex) { homeError(ex); } });
        }
        @JavascriptInterface public void importHomeState(String payload) {
            notionQueue.execute(() -> { try { homeSync.request("POST", "/v1/import", new JSONObject(payload)); callback("onHomeImported", new JSONObject()); } catch (Exception ex) { homeError(ex); } });
        }
        @JavascriptInterface
        public String loadState(String key) {
            return prefs.getString(key, "");
        }

        @JavascriptInterface
        public void saveState(String key, String value) {
            prefs.edit().putString(key, value == null ? "" : value).apply();
        }

        @JavascriptInterface
        public boolean hasNotionConnection() { return notion.isConfigured(); }

        @JavascriptInterface
        public void configureNotion() {
            runOnUiThread(() -> {
                EditText input = new EditText(MainActivity.this);
                input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
                input.setSingleLine(true);
                input.setHint("Notion integration token");
                AlertDialog dialog = new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Connect your Notion tasks")
                        .setMessage("Create a separate internal connection with read, insert and update access. Share only Action Center with it. Paste the token here on this phone, never in a chat or GitHub.")
                        .setView(input)
                        .setNegativeButton("Cancel", null)
                        .setPositiveButton("Connect", null)
                        .create();
                dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                        .setOnClickListener(button -> {
                            try {
                                notion.saveToken(input.getText().toString());
                                dialog.dismiss();
                                callback("onNotionConnected", new JSONObject());
                            } catch (Exception ex) {
                                input.setError("Could not save token. Try again.");
                            }
                        }));
                dialog.show();
            });
        }

        @JavascriptInterface
        public void disconnectNotion() {
            notion.clearToken();
            callback("onNotionDisconnected", new JSONObject());
        }

        @JavascriptInterface
        public void requestNotionSync() {
            notionQueue.execute(() -> {
                try { callback("onNotionSnapshot", notion.snapshot()); }
                catch (Exception ex) { notionError(ex); }
            });
        }

        @JavascriptInterface
        public void createNotionTask(String title) {
            notionQueue.execute(() -> {
                try { callback("onNotionTaskCreated", notion.create(title)); }
                catch (Exception ex) { notionError(ex); }
            });
        }

        @JavascriptInterface
        public void setNotionTaskDone(String pageId, boolean done) {
            notionQueue.execute(() -> {
                try {
                    notion.setDone(pageId, done);
                    callback("onNotionTaskChanged", new JSONObject().put("id", pageId).put("done", done));
                } catch (Exception ex) { notionError(ex); }
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
            } catch (Exception ignored) {
            }
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
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void openCalendarEvent(String eventId) {
            try {
                long id = Long.parseLong(eventId);
                Uri uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id);
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
            } catch (Exception ignored) {
            }
        }
    }

    private void homeError(Exception ex) {
        try { callback("onHomeSyncError", new JSONObject().put("message", ex.getMessage() == null ? "HOME is unavailable; saved data remains on this phone." : ex.getMessage())); }
        catch (Exception ignored) { }
    }
}
