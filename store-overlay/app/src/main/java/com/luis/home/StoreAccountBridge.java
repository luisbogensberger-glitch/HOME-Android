package com.luis.home;

import android.app.Activity;
import android.app.AlertDialog;
import android.text.InputType;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native account UI kept outside the WebView: sign in/up, sign out and full deletion. */
final class StoreAccountBridge {
    private final Activity activity;
    private final WorkerSync worker;
    private final ExecutorService queue = Executors.newSingleThreadExecutor();
    private WebView webView;

    StoreAccountBridge(Activity activity, WorkerSync worker) {
        this.activity = activity;
        this.worker = worker;
    }

    void attach(WebView view) { this.webView = view; }

    @JavascriptInterface
    public boolean isSignedIn() { return worker.isConfigured(); }

    @JavascriptInterface
    public String email() { return worker.sessionEmail(); }

    @JavascriptInterface
    public void open() {
        activity.runOnUiThread(() -> {
            if (worker.isConfigured()) showSignedIn(); else showAuth();
        });
    }

    @JavascriptInterface
    public void signOut() {
        queue.execute(() -> {
            worker.signOut();
            activity.runOnUiThread(() -> {
                emit("onNotionDisconnected", new JSONObject());
                emitAccountChanged(false);
            });
        });
    }

    @JavascriptInterface
    public void deleteAccount() {
        activity.runOnUiThread(this::confirmDeletion);
    }

    private void showAuth() {
        LinearLayout box = new LinearLayout(activity);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(22);
        box.setPadding(pad, dp(4), pad, 0);

        EditText email = new EditText(activity);
        email.setHint("Email");
        email.setSingleLine(true);
        email.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        box.addView(email, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        EditText password = new EditText(activity);
        password.setHint("Password (8+ characters)");
        password.setSingleLine(true);
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        box.addView(password, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView note = new TextView(activity);
        note.setText("Your HOME account keeps your tasks and learning data separate from every other user.");
        note.setPadding(0, dp(10), 0, 0);
        box.addView(note);

        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("HOME account")
                .setView(box)
                .setNegativeButton("Cancel", null)
                .setNeutralButton("Create account", null)
                .setPositiveButton("Sign in", null)
                .create();

        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> authenticate(dialog, email, password, false));
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> authenticate(dialog, email, password, true));
        });
        dialog.show();
    }

    private void authenticate(AlertDialog dialog, EditText email, EditText password, boolean create) {
        String e = email.getText().toString().trim();
        String p = password.getText().toString();
        email.setEnabled(false); password.setEnabled(false);
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
        dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setEnabled(false);
        queue.execute(() -> {
            try {
                if (create) worker.signUp(e, p); else worker.signIn(e, p);
                activity.runOnUiThread(() -> {
                    dialog.dismiss();
                    emit("onNotionConnected", new JSONObject());
                    emitAccountChanged(true);
                });
            } catch (Exception error) {
                activity.runOnUiThread(() -> {
                    email.setEnabled(true); password.setEnabled(true);
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                    dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setEnabled(true);
                    password.setError(error.getMessage() == null ? "Could not sign in" : error.getMessage());
                });
            }
        });
    }

    private void showSignedIn() {
        String email = worker.sessionEmail();
        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("HOME account")
                .setMessage(email.isEmpty() ? "Signed in" : "Signed in as " + email)
                .setNegativeButton("Close", null)
                .setNeutralButton("Sign out", (d, w) -> signOut())
                .setPositiveButton("Delete account…", null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(v -> { dialog.dismiss(); confirmDeletion(); }));
        dialog.show();
    }

    private void confirmDeletion() {
        new AlertDialog.Builder(activity)
                .setTitle("Delete HOME account?")
                .setMessage("This permanently deletes your HOME account, tasks, learning progress and stored HOME activity. This cannot be undone.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Delete permanently", (d, w) -> performDeletion())
                .show();
    }

    private void performDeletion() {
        queue.execute(() -> {
            try {
                worker.deleteAccount();
                activity.runOnUiThread(() -> {
                    emit("onNotionDisconnected", new JSONObject());
                    emitAccountChanged(false);
                    new AlertDialog.Builder(activity).setTitle("Account deleted").setMessage("Your HOME account and associated HOME data were deleted.").setPositiveButton("OK", null).show();
                });
            } catch (Exception error) {
                activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
                        .setTitle("Could not delete account")
                        .setMessage(error.getMessage() == null ? "Try again." : error.getMessage())
                        .setPositiveButton("OK", null).show());
            }
        });
    }

    private void emitAccountChanged(boolean signedIn) {
        try { emit("onHomeAccountChanged", new JSONObject().put("signedIn", signedIn).put("email", worker.sessionEmail())); }
        catch (Exception ignored) { }
    }

    private void emit(String function, JSONObject payload) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript("window." + function + "&&window." + function + "(" + payload.toString() + ")", null));
    }

    private int dp(int value) { return Math.round(value * activity.getResources().getDisplayMetrics().density); }
}
