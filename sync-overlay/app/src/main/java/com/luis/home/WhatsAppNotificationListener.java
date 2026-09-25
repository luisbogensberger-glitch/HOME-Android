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
 * Explicit user-enabled live inbox ingestion for HOME.
 *
 * The service is registered as the HOME notification listener. It handles:
 * - WhatsApp / WhatsApp Business: sender/chat/message text from new notifications.
 * - Gmail: sender + subject/snippet from new mail notifications.
 *
 * Notification access does not expose the underlying WhatsApp/Gmail databases. This is a
 * near-real-time signal layer; the hourly Gmail connector remains the full-text reconciliation
 * layer. Raw notification content is sent only to the authenticated private HOME Worker.
 */
public class WhatsAppNotificationListener extends NotificationListenerService {
    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final String GMAIL = "com.google.android.gm";
    private static final String PREFS = "home_live_inbox_capture";
    private static final long DUPLICATE_WINDOW_MS = 45_000L;
    private static final int MAX_LOCAL_MESSAGES = 180;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (!WHATSAPP.equals(pkg) && !WHATSAPP_BUSINESS.equals(pkg) && !GMAIL.equals(pkg)) return;

        Notification n = sbn.getNotification();
        if (n == null || n.extras == null) return;
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
        if (Notification.CATEGORY_CALL.equals(n.category)) return;

        if (GMAIL.equals(pkg)) handleGmail(sbn, n);
        else handleWhatsApp(sbn, n, pkg);
    }

    private void handleWhatsApp(StatusBarNotification sbn, Notification n, String pkg) {
        Bundle extras = n.extras;
        String message = extractMessage(extras);
        if (message.isEmpty() || isWhatsAppSystemNoise(message)) return;

        String chat = clean(text(extras, Notification.EXTRA_CONVERSATION_TITLE), 180);
        String title = clean(text(extras, Notification.EXTRA_TITLE), 180);
        if (chat.isEmpty()) chat = title;
        String sender = deriveSender(title, chat, message);

        long at = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        String signature = pkg + "|" + chat + "|" + sender + "|" + message;
        if (isDuplicate(signature, at)) return;

        String id = "wa-" + shortHash(signature + "|" + at);
        try {
            JSONObject item = new JSONObject()
                    .put("id", id)
                    .put("source", "whatsapp-notification")
                    .put("package", pkg)
                    .put("chat", chat)
                    .put("sender", sender)
                    .put("message", message)
                    .put("at", at)
                    .put("timezone", "Europe/London");
            rememberLocally(item);
            forwardWhatsApp(item, message, at);
        } catch (Exception ignored) { }
    }

    private void handleGmail(StatusBarNotification sbn, Notification n) {
        Bundle extras = n.extras;
        String sender = clean(text(extras, Notification.EXTRA_TITLE), 240);
        String subject = clean(text(extras, Notification.EXTRA_TEXT), 500);
        String big = clean(text(extras, Notification.EXTRA_BIG_TEXT), 2400);
        String account = clean(text(extras, Notification.EXTRA_SUB_TEXT), 240);
        String snippet = big.isEmpty() ? subject : big;

        if (sender.isEmpty() && subject.isEmpty() && snippet.isEmpty()) return;
        if (isGmailSystemNoise(sender, subject, snippet)) return;

        long at = sbn.getPostTime() > 0 ? sbn.getPostTime() : System.currentTimeMillis();
        String signature = GMAIL + "|" + sender + "|" + subject + "|" + snippet;
        if (isDuplicate(signature, at)) return;

        String id = "gm-" + shortHash(signature + "|" + at);
        try {
            JSONObject item = new JSONObject()
                    .put("id", id)
                    .put("source", "gmail-notification")
                    .put("package", GMAIL)
                    .put("sender", sender)
                    .put("subject", subject)
                    .put("snippet", snippet)
                    .put("account", account)
                    .put("at", at)
                    .put("timezone", "Europe/London");
            rememberLocally(item);
            forwardGmail(item, subject + " " + snippet, at);
        } catch (Exception ignored) { }
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
        CharSequence value = extras.getCharSequence(Notification.EXTRA_TEXT);
        return value == null ? "" : clean(value.toString(), 2400);
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

    private boolean isWhatsAppSystemNoise(String message) {
        String s = message.toLowerCase(Locale.ROOT);
        return s.matches("^[0-9]+ new messages?$")
                || s.contains("checking for new messages")
                || s.contains("you may have new messages")
                || s.contains("wird nach neuen nachrichten gesucht")
                || s.contains("du hast möglicherweise neue nachrichten")
                || s.equals("new message")
                || s.equals("neue nachricht");
    }

    private boolean isGmailSystemNoise(String sender, String subject, String snippet) {
        String s = (sender + " " + subject + " " + snippet).toLowerCase(Locale.ROOT);
        return s.contains("syncing mail")
                || s.contains("mail wird synchronisiert")
                || s.matches(".*\\b[0-9]+ new messages?\\b.*")
                || s.matches(".*\\b[0-9]+ neue nachrichten\\b.*")
                || s.trim().equals("gmail");
    }

    private boolean looksActionable(String message) {
        String s = " " + message.toLowerCase(Locale.ROOT) + " ";
        String[] phrases = new String[]{
                " kannst du ", " könntest du ", " könnt ihr ", " bitte schick", " bitte send",
                " bitte bring", " bitte ruf", " bitte antwort", " ruf mich ", " schick mir ",
                " sende mir ", " denk dran ", " vergiss nicht ", " bitte prüf", " bitte check",
                " check the ", " prüfe ", " can you ", " could you ", " would you ",
                " please send", " please bring", " please call", " please check", " please reply",
                " send me ", " call me ", " remember to ", " don't forget ", " dont forget ",
                " need you to ", " action required", " required action", " deadline", " due "
        };
        for (String phrase : phrases) if (s.contains(phrase)) return true;
        return false;
    }

    private boolean isDuplicate(String signature, long at) {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        String key = "last_signature_" + shortHash(signature.split("\\|")[0]);
        String previous = p.getString(key, "");
        long previousAt = p.getLong(key + "_at", 0L);
        if (signature.equals(previous) && Math.abs(at - previousAt) <= DUPLICATE_WINDOW_MS) return true;
        p.edit().putString(key, signature).putLong(key + "_at", at).apply();
        return false;
    }

    private void rememberLocally(JSONObject item) {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(p.getString("inbox", "[]"));
            JSONArray next = new JSONArray();
            int start = Math.max(0, old.length() - (MAX_LOCAL_MESSAGES - 1));
            for (int i = start; i < old.length(); i++) next.put(old.get(i));
            next.put(item);
            p.edit().putString("inbox", next.toString()).apply();
        } catch (Exception ignored) { }
    }

    private void forwardWhatsApp(JSONObject item, String message, long at) {
        new Thread(() -> {
            try {
                WorkerSync worker = new WorkerSync(getApplicationContext());
                if (!worker.isConfigured()) {
                    if (looksActionable(message)) addLocalFallbackTask("wa-review-" + shortHash(item.toString()), "Review WhatsApp request", at);
                    return;
                }
                worker.reviewWhatsAppMessage(item);
            } catch (Exception ignored) {
                if (looksActionable(message)) addLocalFallbackTask("wa-review-" + shortHash(item.toString()), "Review WhatsApp request", at);
            }
        }, "home-whatsapp-sync").start();
    }

    private void forwardGmail(JSONObject item, String text, long at) {
        new Thread(() -> {
            try {
                WorkerSync worker = new WorkerSync(getApplicationContext());
                if (!worker.isConfigured()) {
                    if (looksActionable(text)) addLocalFallbackTask("gm-review-" + shortHash(item.toString()), "Review email action", at);
                    return;
                }
                worker.reviewGmailNotification(item);
            } catch (Exception ignored) {
                if (looksActionable(text)) addLocalFallbackTask("gm-review-" + shortHash(item.toString()), "Review email action", at);
            }
        }, "home-gmail-sync").start();
    }

    private void addLocalFallbackTask(String id, String title, long at) {
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
                    .put("title", title)
                    .put("area", "Personal")
                    .put("minutes", 5)
                    .put("note", "HOME detected a likely action, but AI classification was temporarily unavailable. Open the source app to review it.")
                    .put("done", false)
                    .put("source", "live-inbox-local-fallback")
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
