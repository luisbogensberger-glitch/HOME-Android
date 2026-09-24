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

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;

/** Native capabilities used by the server-driven adaptive WebView UI. */
final class AdaptiveBridge {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 64;
    private final Activity activity;
    private final Context context;
    private final WorkerSync worker;
    private final ExecutorService queue;

    AdaptiveBridge(Activity activity, WorkerSync worker, ExecutorService queue) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
        this.worker = worker;
        this.queue = queue;
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
