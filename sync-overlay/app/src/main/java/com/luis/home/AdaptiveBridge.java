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

import org.json.JSONObject;

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
        if (!worker.isConfigured() || rawJson == null || rawJson.trim().isEmpty()) return;
        final String payload = rawJson;
        queue.execute(() -> {
            try {
                JSONObject activity = new JSONObject(payload);
                if (!activity.has("at")) activity.put("at", System.currentTimeMillis());
                activity.remove("answer");
                activity.remove("text");
                worker.saveActivity(activity);
            } catch (Exception ignored) { }
        });
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
    public void scheduleNotification(String id, String title, String body, long atMillis) {
        if (atMillis <= System.currentTimeMillis()) return;
        Intent intent = new Intent(context, HomeNotificationReceiver.class);
        intent.setAction("com.luis.home.ADAPTIVE_NOTIFICATION");
        intent.putExtra("id", safeId(id));
        intent.putExtra("title", clean(title, 90));
        intent.putExtra("body", clean(body, 240));

        int requestCode = Math.abs(safeId(id).hashCode());
        PendingIntent pending = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending);
        } else {
            alarms.set(AlarmManager.RTC_WAKEUP, atMillis, pending);
        }
    }

    @JavascriptInterface
    public void cancelNotification(String id) {
        Intent intent = new Intent(context, HomeNotificationReceiver.class);
        intent.setAction("com.luis.home.ADAPTIVE_NOTIFICATION");
        int requestCode = Math.abs(safeId(id).hashCode());
        PendingIntent pending = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(pending);
        pending.cancel();
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
