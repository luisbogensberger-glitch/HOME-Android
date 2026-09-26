package com.luis.home;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;

/** Small explicit bridge for user-controlled notification/accessibility permissions. */
final class VBrainSettingsBridge {
    private final Activity activity;

    VBrainSettingsBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean notificationAccessEnabled() {
        try {
            String flat = Settings.Secure.getString(
                    activity.getContentResolver(),
                    "enabled_notification_listeners");
            if (TextUtils.isEmpty(flat)) return false;
            ComponentName target = new ComponentName(activity, WhatsAppNotificationListener.class);
            for (String item : flat.split(":")) {
                ComponentName c = ComponentName.unflattenFromString(item);
                if (target.equals(c)) return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    @JavascriptInterface
    public boolean whatsappAccessibilityEnabled() {
        try {
            int enabled = Settings.Secure.getInt(
                    activity.getContentResolver(),
                    Settings.Secure.ACCESSIBILITY_ENABLED,
                    0);
            if (enabled != 1) return false;
            String flat = Settings.Secure.getString(
                    activity.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (TextUtils.isEmpty(flat)) return false;
            ComponentName target = new ComponentName(activity, WhatsAppAccessibilityService.class);
            for (String item : flat.split(":")) {
                ComponentName c = ComponentName.unflattenFromString(item);
                if (target.equals(c)) return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    @JavascriptInterface
    public void openNotificationAccessSettings() {
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                activity.startActivity(intent);
            } catch (Exception ignored) {
                try { activity.startActivity(new Intent(Settings.ACTION_SETTINGS)); } catch (Exception ignored2) { }
            }
        });
    }

    @JavascriptInterface
    public void openAccessibilitySettings() {
        activity.runOnUiThread(() -> {
            try {
                activity.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            } catch (Exception ignored) {
                try { activity.startActivity(new Intent(Settings.ACTION_SETTINGS)); } catch (Exception ignored2) { }
            }
        });
    }
}
