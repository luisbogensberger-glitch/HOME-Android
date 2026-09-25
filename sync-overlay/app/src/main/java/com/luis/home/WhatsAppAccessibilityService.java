package com.luis.home;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Explicit user-enabled WhatsApp screen reader for HOME.
 *
 * This service is intentionally restricted to WhatsApp packages and to a small set of
 * priority/test chats. It complements the NotificationListener: notifications cover incoming
 * background messages; Accessibility covers messages that are actually visible while WhatsApp
 * is open, including the user's own sent messages. It does not crawl the WhatsApp database.
 */
public class WhatsAppAccessibilityService extends AccessibilityService {
    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";
    private static final String PREFS = "home_whatsapp_accessibility";
    private static final int MAX_HASHES = 500;
    private static final long EVENT_THROTTLE_MS = 450L;

    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private long lastScanAt = 0L;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        if (!WHATSAPP.equals(pkg) && !WHATSAPP_BUSINESS.equals(pkg)) return;

        int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                && type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                && type != AccessibilityEvent.TYPE_VIEW_SCROLLED
                && type != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) return;

        long now = SystemClock.elapsedRealtime();
        if (now - lastScanAt < EVENT_THROTTLE_MS) return;
        lastScanAt = now;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        List<String> visible = new ArrayList<>();
        collectLeafText(root, visible, 0);
        root.recycle();
        if (visible.isEmpty()) return;

        ChatTarget target = detectTarget(visible);
        if (target == null) return;

        long at = System.currentTimeMillis();
        for (String candidate : visible) {
            String message = clean(candidate, 2400);
            if (!looksLikeMessage(message, target)) continue;
            String fingerprint = shortHash(target.chat + "|" + message);
            if (alreadySeen(fingerprint)) continue;
            rememberSeen(fingerprint);
            forward(target, message, at, pkg, fingerprint);
        }
    }

    @Override
    public void onInterrupt() { }

    @Override
    public void onDestroy() {
        queue.shutdownNow();
        super.onDestroy();
    }

    private void collectLeafText(AccessibilityNodeInfo node, List<String> out, int depth) {
        if (node == null || depth > 40 || out.size() > 240) return;
        int children = node.getChildCount();
        CharSequence text = node.getText();
        if (text != null && !text.toString().trim().isEmpty() && children == 0) {
            String clean = clean(text.toString(), 2400);
            if (!clean.isEmpty()) out.add(clean);
        }
        CharSequence desc = node.getContentDescription();
        if (children == 0 && (text == null || text.toString().trim().isEmpty()) && desc != null) {
            String clean = clean(desc.toString(), 500);
            if (!clean.isEmpty()) out.add(clean);
        }
        for (int i = 0; i < children; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) continue;
            collectLeafText(child, out, depth + 1);
            child.recycle();
        }
    }

    private ChatTarget detectTarget(List<String> visible) {
        for (String text : visible) {
            String lower = text.toLowerCase(Locale.ROOT);
            if (lower.contains("offer holder")) return new ChatTarget(text, true, false);
            if (lower.contains("msc unofficial")) return new ChatTarget(text, true, false);
        }
        boolean selfHint = false;
        String selfTitle = "Message yourself";
        for (String text : visible) {
            String lower = text.toLowerCase(Locale.ROOT);
            if (lower.contains("sende dir selbst eine nachricht")
                    || lower.contains("message yourself")
                    || lower.matches(".*\\(du\\).*")) {
                selfHint = true;
                if (lower.matches(".*\\(du\\).*")) selfTitle = text;
            }
        }
        return selfHint ? new ChatTarget(selfTitle, false, true) : null;
    }

    private boolean looksLikeMessage(String text, ChatTarget target) {
        if (text == null) return false;
        String s = text.trim();
        if (s.length() < 3 || s.length() > 2400) return false;
        String lower = s.toLowerCase(Locale.ROOT);
        String chatLower = target.chat.toLowerCase(Locale.ROOT);
        if (lower.equals(chatLower)) return false;
        if (lower.contains("sende dir selbst eine nachricht") || lower.contains("message yourself")) return false;
        if (lower.matches("^(heute|gestern|today|yesterday)$")) return false;
        if (lower.matches("^\\d{1,2}:\\d{2}$")) return false;
        if (lower.matches("^\\d{1,2}\\. [a-zäöü]+ \\d{4}$")) return false;
        if (lower.matches("^[0-9]+ ungelesene nachrichten$") || lower.matches("^[0-9]+ unread messages$")) return false;
        String[] ui = {
                "nachricht", "message", "suchen", "search", "videoanruf", "voice call",
                "sprachanruf", "more options", "weitere optionen", "online", "tippt…", "typing…",
                "ende-zu-ende-verschlüsselt", "end-to-end encrypted", "mehr erfahren", "learn more"
        };
        for (String label : ui) if (lower.equals(label)) return false;
        if (lower.length() < 8 && lower.matches("^[✓✔•·.!,?0-9]+$")) return false;
        return true;
    }

    private void forward(ChatTarget target, String message, long at, String pkg, String fingerprint) {
        queue.execute(() -> {
            try {
                WorkerSync worker = new WorkerSync(getApplicationContext());
                if (!worker.isConfigured()) return;
                JSONObject item = new JSONObject()
                        .put("id", "wa-screen-" + fingerprint)
                        .put("source", "whatsapp-accessibility")
                        .put("package", pkg)
                        .put("chat", target.chat)
                        .put("sender", "")
                        .put("message", message)
                        .put("at", at)
                        .put("timezone", "Europe/London")
                        .put("priorityChat", target.priority)
                        .put("selfChatTest", target.selfTest);
                worker.reviewWhatsAppMessage(item);
            } catch (Exception ignored) { }
        });
    }

    private boolean alreadySeen(String hash) {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            JSONArray rows = new JSONArray(p.getString("seen", "[]"));
            for (int i = 0; i < rows.length(); i++) if (hash.equals(rows.optString(i))) return true;
        } catch (Exception ignored) { }
        return false;
    }

    private void rememberSeen(String hash) {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(p.getString("seen", "[]"));
            JSONArray next = new JSONArray();
            int start = Math.max(0, old.length() - (MAX_HASHES - 1));
            for (int i = start; i < old.length(); i++) next.put(old.optString(i));
            next.put(hash);
            p.edit().putString("seen", next.toString()).apply();
        } catch (Exception ignored) { }
    }

    private String clean(String value, int max) {
        String out = value == null ? "" : value.replace('\u0000', ' ').replaceAll("\\s+", " ").trim();
        return out.length() > max ? out.substring(0, max) : out;
    }

    private String shortHash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : hash) out.append(String.format(Locale.ROOT, "%02x", b));
            return out.substring(0, 28);
        } catch (Exception ignored) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private static final class ChatTarget {
        final String chat;
        final boolean priority;
        final boolean selfTest;
        ChatTarget(String chat, boolean priority, boolean selfTest) {
            this.chat = chat;
            this.priority = priority;
            this.selfTest = selfTest;
        }
    }
}
