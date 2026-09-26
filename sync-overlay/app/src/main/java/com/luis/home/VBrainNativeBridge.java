package com.luis.home;

import android.app.Activity;
import android.webkit.JavascriptInterface;

/** Compatibility name used by the v13 build pipeline. */
final class VBrainNativeBridge {
    private final VBrainSettingsBridge delegate;

    VBrainNativeBridge(Activity activity) {
        delegate = new VBrainSettingsBridge(activity);
    }

    @JavascriptInterface
    public boolean notificationAccessEnabled() {
        return delegate.notificationAccessEnabled();
    }

    @JavascriptInterface
    public boolean whatsappAccessibilityEnabled() {
        return delegate.whatsappAccessibilityEnabled();
    }

    @JavascriptInterface
    public void openNotificationAccessSettings() {
        delegate.openNotificationAccessSettings();
    }

    @JavascriptInterface
    public void openAccessibilitySettings() {
        delegate.openAccessibilitySettings();
    }
}
