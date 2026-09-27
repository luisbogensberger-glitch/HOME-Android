package com.luis.home;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;
import java.util.concurrent.ExecutorService;

/** Native capabilities used by the server-driven adaptive WebView UI. */
final class AdaptiveBridge {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 64;
    private final Activity activity;
    private final Context context;
    private final WorkerSync worker;
    private final ExecutorService queue;
    private final WebView webView;

    AdaptiveBridge(Activity activity, WorkerSync worker, ExecutorService queue, WebView webView) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
        this.worker = worker;
        this.queue = queue;
        this.webView = webView;
    }

    @JavascriptInterface
    public void logActivity(String rawJson) {
        if (rawJson == null || rawJson.length() > 60000) return;
            try {
                JSONObject activity = new JSONObject(rawJson);
                if (!activity.has("at")) activity.put("at", System.currentTimeMillis());
                activity.remove("answer");
                activity.remove("text");
                if (!activity.has("id")) activity.put("id", UUID.randomUUID().toString());
                worker.enqueue("activity",activity);
            } catch (Exception ignored) { }
    }

    /**
     * Explicit private HOME-context channel. This is intentionally separate from generic
     * telemetry because the payload may include content the user typed inside HOME, such as
     * To-Do notes, task details or other app-internal state. It is sent only to the authenticated
     * private HOME Worker and is never written to the public repository.
     */
    @JavascriptInterface
    public void logPrivateActivity(String rawJson) {
        queuePrivateActivity(rawJson);
    }

    @JavascriptInterface
    public String queuePrivateActivity(String rawJson) {
        if (rawJson == null || rawJson.length()>60000) return "";
        try {
                JSONObject activity = new JSONObject(rawJson);
                if (!activity.has("at")) activity.put("at", System.currentTimeMillis());
                if (!activity.has("kind")) activity.put("kind", "private_home_context");
                if (!activity.has("source")) activity.put("source", "android");
                if (!activity.has("id")) activity.put("id", UUID.randomUUID().toString());
                return worker.enqueue("private_activity", activity);
        } catch (Exception ignored) { return ""; }
    }

    /** Persist the complete HOME To-Do state, including the user's notes/details, to HOME Sync. */
    @JavascriptInterface
    public void saveTodoState(String rawJson) {
        if (!worker.isConfigured() || rawJson == null || rawJson.trim().isEmpty()) return;
        if (rawJson.length() > 120000) return;
        final String payload = rawJson;
        queue.execute(() -> {
            try {
                JSONObject state = new JSONObject(payload);
                saveTaskArray(state.optJSONArray("active"), false);
                saveTaskArray(state.optJSONArray("archive"), true);
            } catch (Exception ignored) { }
        });
    }

    private void saveTaskArray(JSONArray items, boolean done) {
        if (items == null) return;
        int limit = Math.min(items.length(), 250);
        for (int i = 0; i < limit; i++) {
            try {
                JSONObject input = items.optJSONObject(i);
                if (input == null) continue;
                JSONObject task = new JSONObject(input.toString());
                String id = task.optString("id", "").trim();
                if (id.isEmpty()) task.put("id", UUID.randomUUID().toString());
                task.remove("notionId");
                task.put("done", done);
                task.put("source", "android");
                if (done) {
                    if (!task.has("completedAt")) task.put("completedAt", System.currentTimeMillis());
                } else {
                    task.remove("completedAt");
                }
                worker.upsertTask(task);
            } catch (Exception ignored) { }
        }
    }

    /**
     * Explicit private learning channel. Unlike generic telemetry, this method is allowed
     * to send the raw one-sentence answer because the user asked HOME to have the model
     * judge the actual text. It travels only to the authenticated HOME Worker.
     *
     * The raw attempt is persisted BEFORE semantic review. This means learning history is
     * not lost when the AI provider is unavailable, billing is exhausted, or review fails.
     */
    @JavascriptInterface
    public void reviewSentence(String rawJson) {
        if (rawJson == null || rawJson.trim().isEmpty()) return;
        if (rawJson.length() > 20000) {
            deliverReviewError("", "Sentence review payload is too large.");
            return;
        }

        final String payload = rawJson;
        queue.execute(() -> {
            String requestId = "";
            try {
                JSONObject input = new JSONObject(payload);
                requestId = input.optString("requestId", "");
                String sentence = input.optString("sentence", "").trim();
                if (sentence.isEmpty() || sentence.length() > 2400) {
                    throw new IllegalArgumentException("Enter a short answer before requesting review.");
                }

                String attemptId = input.optString("attemptId", "").trim();
                if (attemptId.isEmpty()) attemptId = "attempt-" + System.currentTimeMillis();

                // Save only the private learning fields needed for longitudinal adaptation.
                // This is intentionally separate from generic telemetry.
                try {
                    JSONObject attempt = new JSONObject()
                            .put("id", attemptId)
                            .put("attemptId", attemptId)
                            .put("cardId", input.optString("cardId", ""))
                            .put("title", input.optString("title", ""))
                            .put("topic", input.optString("topic", ""))
                            .put("prompt", input.optString("prompt", ""))
                            .put("question", input.optString("question", ""))
                            .put("sentence", sentence)
                            .put("learningMethod", input.optString("method", ""))
                            .put("contentDepth", input.optString("contentDepth", ""))
                            .put("reviewStatus", "pending")
                            .put("at", input.optLong("at", System.currentTimeMillis()));
                    if (input.has("selected")) attempt.put("selected", input.opt("selected"));
                    if (input.has("correct")) attempt.put("correct", input.opt("correct"));
                    worker.saveAttempt(attempt);
                } catch (Exception ignored) {
                    // Review may still succeed even if the persistence write had a transient failure.
                }

                JSONObject result = worker.reviewSentence(input);
                deliver("onHomeSentenceReview", result);
            } catch (Exception ex) {
                deliverReviewError(requestId, ex.getMessage() == null ? "Sentence review failed." : ex.getMessage());
            }
        });
    }

    @JavascriptInterface
    public void loadLatestLearning(int limit) {
        if (!worker.isConfigured()) return;
        final int safeLimit = Math.max(1, Math.min(limit, 20));
        queue.execute(() -> {
            try {
                deliver("onHomeLatestLearning", worker.latestLearning(safeLimit));
            } catch (Exception ex) {
                try {
                    deliver("onHomeLatestLearning", new JSONObject()
                            .put("ok", false)
                            .put("error", clean(ex.getMessage(), 300)));
                } catch (Exception ignored) { }
            }
        });
    }

    private void deliverReviewError(String requestId, String message) {
        try {
            JSONObject error = new JSONObject()
                    .put("requestId", requestId == null ? "" : requestId)
                    .put("error", clean(message, 300));
            deliver("onHomeSentenceReview", error);
        } catch (Exception ignored) { }
    }

    private void deliver(String callbackName, JSONObject payload) {
        if (webView == null || callbackName == null || payload == null) return;
        final String json = payload.toString();
        activity.runOnUiThread(() -> webView.evaluateJavascript(
                "(function(){try{if(window." + callbackName + ")window." + callbackName + "(" + json + ");}catch(e){}})();",
                null));
    }

    @JavascriptInterface
    public String homeSyncStatus() {
        return worker.syncStatus().toString();
    }

    @JavascriptInterface
    public int pendingPrivateSyncCount() { return worker.pendingOutboxCount(); }

    @JavascriptInterface
    public void flushPrivateSync() {
        if (!worker.isConfigured()) return;
        queue.execute(() -> {
            worker.flushOutbox();
            try { deliver("onHomePrivateSync", new JSONObject()
                    .put("pending", worker.pendingOutboxCount())
                    .put("at", System.currentTimeMillis())); } catch (Exception ignored) { }
        });
    }

    @JavascriptInterface
    public boolean hasNotificationPermission() {
        return Build.VERSION.SDK_INT < 33 ||
                activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33 || hasNotificationPermission()) return;
        activity.runOnUiThread(() -> activity.requestPermissions(
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                NOTIFICATION_PERMISSION_REQUEST));
    }

    @JavascriptInterface
    public void showNotification(String id, String title, String body) {
        HomeNotificationReceiver.show(context, safeId(id), clean(title, 90), clean(body, 240));
    }

    @JavascriptInterface
    public void scheduleSmartReminder(String raw) {
        try { HomeNotificationReceiver.schedule(context, new JSONObject(raw)); }
        catch (Exception ignored) { }
    }

    @JavascriptInterface
    public String notificationSettings() { return HomeNotificationReceiver.settings(context).toString(); }

    @JavascriptInterface
    public void setRemindersEnabled(boolean enabled) { HomeNotificationReceiver.setEnabled(context, enabled); }

    @JavascriptInterface
    public void checkDeviceCommands() {
        queue.execute(() -> HomeSyncJob.pollCommands(context,worker));
    }

    @JavascriptInterface
    public void scheduleNotification(String id, String title, String body, long atMillis) {
        try { HomeNotificationReceiver.schedule(context, new JSONObject().put("id",safeId(id))
            .put("title",clean(title,90)).put("body",clean(body,240)).put("atMillis",atMillis)); }
        catch(Exception ignored) { }
    }

    @JavascriptInterface
    public void cancelNotification(String id) { HomeNotificationReceiver.cancel(context,safeId(id)); }

    @JavascriptInterface
    public String queueLearningAttempt(String raw) {
        try { return worker.enqueue("attempt",new JSONObject(raw)); }
        catch(Exception ignored) { return ""; }
    }

    private String safeId(String value) {
        String out = value == null ? "home" : value.trim();
        if (out.isEmpty()) out = "home";
        return out.length() > 80 ? out.substring(0, 80) : out;
    }

    private String clean(String value, int max) {
        String out = value == null ? "" : value.trim();
        if (out.length() > max) out = out.substring(0, max);
        return out;
    }
}
