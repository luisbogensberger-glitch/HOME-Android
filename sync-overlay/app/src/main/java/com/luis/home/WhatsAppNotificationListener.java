package com.luis.home;

import android.app.Notification;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * User-enabled WhatsApp notification listener for HOME.
 *
 * The listener ignores every app except WhatsApp / WhatsApp Business. Message text is used
 * only on-device for action detection and is not uploaded or written into HOME Sync. When a
 * strong request is detected, HOME adds a generic local review task so the user can open
 * WhatsApp and decide what to do.
 */
public class WhatsAppNotificationListener extends NotificationListenerService {
    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final String LISTENER_PREFS = "home_whatsapp_capture";
    private static final long DUPLICATE_WINDOW_MS = 45_000L;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (!WHATSAPP.equals(pkg) && !WHATSAPP_BUSINESS.equals(pkg)) return;

        Notification n = sbn.getNotification();
        if (n == null || n.extras == null) return;
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
        if (Notification.CATEGORY_CALL.equals(n.category)) return;

        String message = extractMessage(n.extras);
        if (message.isEmpty() || isSystemNoise(message) || !looksActionable(message)) return;

        long at = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        String signature = pkg + "|" + message;
        if (isDuplicate(signature, at)) return;

        addLocalReviewTask("wa-review-" + shortHash(signature + "|" + at), at);
    }

    private String extractMessage(Bundle extras) {
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (int i = lines.length - 1; i >= 0; i--) {
                if (lines[i] != null && !lines[i].toString().trim().isEmpty()) {
                    return clean(lines[i].toString(), 700);
                }
            }
        }
        CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (big != null && !big.toString().trim().isEmpty()) return clean(big.toString(), 700);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);
        return text == null ? "" : clean(text.toString(), 700);
    }

    private String clean(String value, int max) {
        String out = value == null ? "" : value.replace('\u0000', ' ').replaceAll("\\s+", " ").trim();
        return out.length() > max ? out.substring(0, max) : out;
    }

    private boolean isSystemNoise(String message) {
        String s = message.toLowerCase(Locale.ROOT);
        return s.matches("^[0-9]+ new messages?$")
                || s.contains("checking for new messages")
                || s.contains("you may have new messages")
                || s.contains("wird nach neuen nachrichten gesucht")
                || s.contains("du hast möglicherweise neue nachrichten")
                || s.equals("new message")
                || s.equals("neue nachricht");
    }

    private boolean looksActionable(String message) {
        String s = " " + message.toLowerCase(Locale.ROOT) + " ";
        String[] phrases = new String[]{
                " kannst du ", " könntest du ", " könnt ihr ", " bitte schick", " bitte send",
                " bitte bring", " bitte ruf", " bitte antwort", " ruf mich ", " schick mir ",
                " sende mir ", " denk dran ", " vergiss nicht ", " bitte prüf", " bitte check",
                " can you ", " could you ", " would you ", " please send", " please bring",
                " please call", " please check", " please reply", " send me ", " call me ",
                " remember to ", " don't forget ", " dont forget ", " need you to "
        };
        for (String phrase : phrases) if (s.contains(phrase)) return true;
        return false;
    }

    private boolean isDuplicate(String signature, long at) {
        SharedPreferences p = getSharedPreferences(LISTENER_PREFS, MODE_PRIVATE);
        String previous = p.getString("last_signature", "");
        long previousAt = p.getLong("last_at", 0L);
        if (signature.equals(previous) && Math.abs(at - previousAt) <= DUPLICATE_WINDOW_MS) return true;
        p.edit().putString("last_signature", signature).putLong("last_at", at).apply();
        return false;
    }

    private void addLocalReviewTask(String id, long at) {
        SharedPreferences statePrefs = getSharedPreferences("home_state", MODE_PRIVATE);
        try {
            String raw = statePrefs.getString("todoState", "");
            JSONObject state = raw == null || raw.trim().isEmpty() ? new JSONObject() : new JSONObject(raw);
            JSONArray active = state.optJSONArray("active");
            if (active == null) active = new JSONArray();

            for (int i = 0; i < active.length(); i++) {
                JSONObject existing = active.optJSONObject(i);
                if (existing != null && id.equals(existing.optString("id"))) return;
            }

            JSONObject task = new JSONObject()
                    .put("id", id)
                    .put("title", "Review WhatsApp action request")
                    .put("area", "Personal")
                    .put("minutes", 5)
                    .put("note", "HOME detected a likely request in a WhatsApp notification. Open WhatsApp to review it; the message text stayed on this device.")
                    .put("done", false)
                    .put("source", "whatsapp-local")
                    .put("createdAt", at);
            active.put(task);
            state.put("active", active);
            if (!state.has("archive")) state.put("archive", new JSONArray());
            statePrefs.edit().putString("todoState", state.toString()).apply();
        } catch (Exception ignored) { }
    }

    private String shortHash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : hash) out.append(String.format(Locale.ROOT, "%02x", b));
            return out.substring(0, 24);
        } catch (Exception ignored) {
            return Integer.toHexString(value.hashCode());
        }
    }
}
