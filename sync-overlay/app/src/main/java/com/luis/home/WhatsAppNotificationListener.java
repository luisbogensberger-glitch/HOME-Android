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
 * Explicit user-enabled WhatsApp ingestion for HOME.
 *
 * Android does not expose the WhatsApp database. This listener receives new messages that
 * WhatsApp publishes as notifications. Unlike the first HOME prototype, it no longer throws
 * away the sender/message body after a local keyword check: new message notifications are
 * queued privately on-device and forwarded over the authenticated HOME Sync channel for AI
 * classification. Nothing from this class is written to public GitHub.
 */
public class WhatsAppNotificationListener extends NotificationListenerService {
    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final String LISTENER_PREFS = "home_whatsapp_capture";
    private static final long DUPLICATE_WINDOW_MS = 45_000L;
    private static final int MAX_LOCAL_MESSAGES = 120;

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

        Bundle extras = n.extras;
        String message = extractMessage(extras);
        if (message.isEmpty() || isSystemNoise(message)) return;

        String chat = clean(text(extras, Notification.EXTRA_CONVERSATION_TITLE), 180);
        String title = clean(text(extras, Notification.EXTRA_TITLE), 180);
        if (chat.isEmpty()) chat = title;
        String sender = deriveSender(title, chat, message);

        long at = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        String signature = pkg + "|" + chat + "|" + sender + "|" + message;
        if (isDuplicate(signature, at)) return;

        String id = "wa-" + shortHash(signature + "|" + at);
        JSONObject item = new JSONObject();
        try {
            item.put("id", id)
                    .put("source", "whatsapp-notification")
                    .put("package", pkg)
                    .put("chat", chat)
                    .put("sender", sender)
                    .put("message", message)
                    .put("at", at)
                    .put("timezone", "Europe/London");
        } catch (Exception ignored) { return; }

        rememberLocally(item);
        forwardPrivately(item, message, at);
    }

    private String text(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }

    private String extractMessage(Bundle extras) {
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (int i = lines.length - 1; i >= 0; i--) {
                if (lines[i] != null && !lines[i].toString().trim().isEmpty()) {
                    return clean(lines[i].toString(), 2400);
                }
            }
        }
        CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (big != null && !big.toString().trim().isEmpty()) return clean(big.toString(), 2400);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);
        return text == null ? "" : clean(text.toString(), 2400);
    }

    private String deriveSender(String title, String chat, String message) {
        if (!title.isEmpty() && (chat.isEmpty() || !title.equals(chat))) return title;
        int colon = message.indexOf(':');
        if (colon > 0 && colon < 80) {
            String maybe = clean(message.substring(0, colon), 80);
            if (!maybe.contains("http") && maybe.split(" ").length <= 8) return maybe;
        }
        return title;
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

    private void rememberLocally(JSONObject item) {
        SharedPreferences p = getSharedPreferences(LISTENER_PREFS, MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(p.getString("inbox", "[]"));
            JSONArray next = new JSONArray();
            int start = Math.max(0, old.length() - (MAX_LOCAL_MESSAGES - 1));
            for (int i = start; i < old.length(); i++) next.put(old.get(i));
            next.put(item);
            p.edit().putString("inbox", next.toString()).apply();
        } catch (Exception ignored) { }
    }

    private void forwardPrivately(JSONObject item, String message, long at) {
        new Thread(() -> {
            try {
                WorkerSync worker = new WorkerSync(getApplicationContext());
                if (!worker.isConfigured()) {
                    if (looksActionable(message)) addLocalFallbackTask("wa-review-" + shortHash(item.toString()), at);
                    return;
                }
                worker.reviewWhatsAppMessage(item);
            } catch (Exception ignored) {
                if (looksActionable(message)) addLocalFallbackTask("wa-review-" + shortHash(item.toString()), at);
            }
        }, "home-whatsapp-sync").start();
    }

    private void addLocalFallbackTask(String id, long at) {
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
                    .put("title", "Review WhatsApp request")
                    .put("area", "Personal")
                    .put("minutes", 5)
                    .put("note", "HOME detected a likely WhatsApp request, but AI classification was temporarily unavailable. Open WhatsApp to review it.")
                    .put("done", false)
                    .put("source", "whatsapp-local-fallback")
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
