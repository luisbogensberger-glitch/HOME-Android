"""Make Host-18 live-release health rollback independent from WebView callback lifetime."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('sync-overlay/app/src/main/java/com/luis/home/MainActivity.java')
s = path.read_text()
old = '''            webView.postDelayed(()->{\n                if(generation==runtimeGeneration&&!runtimeHealthy&&liveRuntime.rollback())loadLiveDocument();\n            },15000);'''
new = '''            // Do not bind the safety watchdog to WebView's callback queue. A document\n            // navigation can invalidate/delay View callbacks; the Activity main looper\n            // must still recover a release that never acknowledges healthy startup.\n            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->{\n                if(generation==runtimeGeneration&&!runtimeHealthy&&liveRuntime.rollback())loadLiveDocument();\n            },15000);'''
if old not in s:
    raise SystemExit('Host rollback watchdog pattern not found; source contract changed')
s = s.replace(old, new, 1)
path.write_text(s)
print(f'Patched {path}: main-looper live-runtime rollback watchdog')
