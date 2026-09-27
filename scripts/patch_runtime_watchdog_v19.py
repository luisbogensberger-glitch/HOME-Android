"""Harden Host-18 startup, upgrade recovery and WebView rollback without touching user data."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('sync-overlay/app/src/main/java/com/luis/home/MainActivity.java')
s = path.read_text()

startup_old = '''        if (!prefs.getBoolean("vbrainOutboxMigrated17",false)) {\n            worker.stageTodoState();prefs.edit().putBoolean("vbrainOutboxMigrated17",true).commit();\n        }\n        HomeSyncJob.schedule(this);\n        HomeNotificationReceiver.restore(this);\n'''
startup_new = '''        // Keep optional sync/reminder work off the critical Activity startup path.\n        // Old/corrupt app state must never prevent the UI from opening.\n'''
if startup_old not in s:
    raise SystemExit('Startup optional-services pattern not found; source contract changed')
s = s.replace(startup_old, startup_new, 1)

client_old = '''            @Override\n            public void onPageFinished(WebView view, String url) {\n                super.onPageFinished(view, url);\n                injectHomeSyncLabels();\n            }\n        });'''
client_new = '''            @Override\n            public void onPageFinished(WebView view, String url) {\n                super.onPageFinished(view, url);\n                injectHomeSyncLabels();\n            }\n\n            @Override\n            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {\n                // A poisoned/stale WebView runtime must not trap the app in a crash loop.\n                try { if (liveRuntime != null) liveRuntime.forceBundled("renderer recovery"); } catch (Throwable ignored) { }\n                try { prefs.edit().putBoolean("vbrainEmergencyBoot", true).commit(); } catch (Throwable ignored) { }\n                runOnUiThread(() -> recreate());\n                return true;\n            }\n        });'''
if client_old not in s:
    raise SystemExit('WebViewClient pattern not found; source contract changed')
s = s.replace(client_old, client_new, 1)

content_old = '''        setContentView(webView);\n        loadLiveDocument();\n    }\n\n    private void loadLiveDocument() {'''
content_new = '''        setContentView(webView);\n        boolean emergency=false;\n        try { emergency=prefs.getBoolean("vbrainEmergencyBoot", false); } catch (Throwable ignored) { }\n        if (emergency) {\n            try { prefs.edit().putBoolean("vbrainEmergencyBoot", false).commit(); } catch (Throwable ignored) { }\n            loadEmergencyDocument("previous renderer failure");\n        } else {\n            loadLiveDocument();\n        }\n        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::startOptionalServices, 900);\n    }\n\n    private void startOptionalServices() {\n        try {\n            if (!prefs.getBoolean("vbrainOutboxMigrated17",false)) {\n                worker.stageTodoState();prefs.edit().putBoolean("vbrainOutboxMigrated17",true).commit();\n            }\n        } catch (Throwable ignored) { }\n        try { HomeSyncJob.schedule(this); } catch (Throwable ignored) { }\n        try { HomeNotificationReceiver.restore(this); } catch (Throwable ignored) { }\n    }\n\n    private void loadEmergencyDocument(String reason) {\n        runtimeHealthy=false;\n        try { if (liveRuntime != null) liveRuntime.forceBundled(reason); } catch (Throwable ignored) { }\n        try { webView.loadUrl("file:///android_asset/index.html"); }\n        catch (Throwable ignored) {\n            try { webView.loadDataWithBaseURL("file:///android_asset/index.html",\n                    "<!doctype html><meta name=viewport content='width=device-width'><body style='background:#111214;color:white;font-family:sans-serif;padding:28px'><h2>V-Brain safe start</h2><p>Your local data is preserved. Reopen V-Brain to retry the full interface.</p></body>",\n                    "text/html","UTF-8",null); } catch (Throwable ignoredAgain) { }\n        }\n    }\n\n    private void loadLiveDocument() {'''
if content_old not in s:
    raise SystemExit('setContentView/loadLiveDocument pattern not found; source contract changed')
s = s.replace(content_old, content_new, 1)

load_old = '''        try {\n            String document=liveRuntime.document();\n            document=document.replace("</head>","<meta name=\\"vbrain-boot\\" content=\\""+runtimeToken+"\\"></head>");\n            webView.loadDataWithBaseURL("file:///android_asset/index.html",document,"text/html","UTF-8",null);\n            webView.postDelayed(()->{\n                if(generation==runtimeGeneration&&!runtimeHealthy&&liveRuntime.rollback())loadLiveDocument();\n            },15000);\n        } catch(Exception e) { webView.loadUrl("file:///android_asset/index.html"); }'''
load_new = '''        try {\n            String document=liveRuntime.document();\n            document=document.replace("</head>","<meta name=\\"vbrain-boot\\" content=\\""+runtimeToken+"\\"></head>");\n            webView.loadDataWithBaseURL("file:///android_asset/index.html",document,"text/html","UTF-8",null);\n            // Do not bind safety recovery to WebView's callback queue.\n            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->{\n                if(generation!=runtimeGeneration||runtimeHealthy)return;\n                try {\n                    if(liveRuntime.rollback()) loadLiveDocument();\n                    else loadEmergencyDocument("runtime health timeout");\n                } catch (Throwable ignored) { loadEmergencyDocument("runtime watchdog failure"); }\n            },15000);\n        } catch(Throwable e) {\n            loadEmergencyDocument("live document failure");\n        }'''
if load_old not in s:
    raise SystemExit('Host rollback watchdog pattern not found; source contract changed')
s = s.replace(load_old, load_new, 1)

healthy_old = '''            runtimeHealthy=true;liveRuntime.healthy();runOnUiThread(()->deliverReminderRoute());'''
healthy_new = '''            runtimeHealthy=true;liveRuntime.healthy();\n            try { prefs.edit().putBoolean("vbrainEmergencyBoot", false).commit(); } catch (Throwable ignored) { }\n            runOnUiThread(()->deliverReminderRoute());'''
if healthy_old not in s:
    raise SystemExit('markRuntimeHealthy pattern not found; source contract changed')
s = s.replace(healthy_old, healthy_new, 1)

path.write_text(s)
print(f'Patched {path}: rescue-first startup, main-looper watchdog, renderer recovery')
