package com.luis.home;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

/** Minimal native settings/status bridge for explicitly user-enabled V-Brain live inbox access. */
final class VBrainNativeBridge {
    private final Activity activity;
    private final Context context;

    VBrainNativeBridge(Activity activity) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
    }

    @JavascriptInterface
    public boolean notificationAccessEnabled() {
        try {
            String enabled = Settings.Secure.getString(
                    context.getContentResolver(), "enabled_notification_listeners");
            return enabled != null && enabled.contains(context.getPackageName());
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean whatsappAccessibilityEnabled() {
        try {
            String enabled = Settings.Secure.getString(
                    context.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            return enabled != null
                    && enabled.toLowerCase().contains(
                    (context.getPackageName() + "/com.luis.home.whatsappaccessibilityservice").toLowerCase());
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public void openNotificationAccessSettings() {
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (Exception ignored) { }
        });
    }

    @JavascriptInterface
    public void openAccessibilitySettings() {
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            } catch (Exception ignored) { }
        });
    }
}
