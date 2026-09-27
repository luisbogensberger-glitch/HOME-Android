"""Release gate: verify the actual UI, manifest and packaged bytes, not just source filenames."""
from pathlib import Path
import hashlib,json,re,subprocess,sys,tempfile,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
html=(root/'home-runtime/live-app.html').read_text()
manifest=json.loads((root/'home-runtime/live-release.json').read_text())
assert hashlib.sha256(html.encode()).hexdigest()==manifest['sha256']
assert len(html.encode())==manifest['bytes']
assert manifest['minNative']==18
assert manifest['version'].startswith('18.')
assert 'name="vbrain-host" content="18"' in html

# V24 architecture: one visible UI owner, headless config/data plane and idle capabilities.
assert 'data-source="vbrain-core-v24.js"' in html and '__VBRAIN_CORE_V24__' in html
assert 'data-source="vbrain-shell-v24.js"' in html and '__VBRAIN_SHELL_V24__' in html
assert 'data-source="vbrain-gym-v24.js"' in html and '__VBRAIN_GYM_V24__' in html
assert 'data-source="vbrain-idle-bootstrap-v24"' in html
assert '__VBRAIN_SINGLE_UI_OWNER_V24__' in html
assert "setInterval(poll,2500)" in html
assert "setInterval(tick,4000)" in html
assert 'Native?.markRuntimeHealthy?.' in html
assert 'MutationObserver' in html
assert "localStorage.setItem('homeTubeLayoutV6','stack')" in html
assert "window.__vbrainIdleQueue=window.__vbrainIdleQueue||[]" in html
assert "dataset.vbrainHydrated='24'" in html
assert html.index('data-source="vbrain-core-v24.js"') < html.index('data-source="vbrain-shell-v24.js"')
assert html.index('data-source="vbrain-shell-v24.js"') < html.index('data-source="vbrain-safe-shell-v3.js"')

# These old layout owners / repair loops caused resume churn and must never ship again.
for retired in [
 'adaptive-runtime.js','runtime.js','vbrain-patch-v10.js','vbrain-autonomy-v11.js',
 'vbrain-personalizer-v21.js','vbrain-personalizer-hook-v21.js','vbrain-ui-performance-v23.js',
 'vbrain-hot-loader-v19.js','vbrain-runtime-v19.js','vbrain-context-v12.js',
 'vbrain-compat-restore-v1.js','vbrain-backup-retirement-v22.js'
]:
 assert f'data-source="{retired}"' not in html, retired
assert 'Build momentum that matters.' not in html
assert "TODAY'S QUEST" not in html
assert '__HOME_QUEST_LEARN_V7__' not in html
assert '__VBRAIN_HOT_LOADER_V19__' not in html
assert 'vbrainCompatReminderV1' not in html

# Required capabilities remain, but hydrate outside first paint.
assert 'data-source="vbrain-safe-shell-v3.js"' in html
assert 'data-source="vbrain-remote-ui-v18.js"' in html
assert '__VBRAIN_REMOTE_UI_V18__' in html
assert 'data-source="vbrain-sense-v20.js"' in html
assert 'data-source="vbrain-context-compat-v21.js"' in html
assert 'vbrainPrivatePatch' in html and 'brainContext' in html and 'brain_context_compat_synced' in html
assert 'data-source="vbrain-sync-reconnect-v21.js"' in html
assert 'Native.configureVeqrya' in html and 'Native.configureNotion' in html and 'AdaptiveNative?.checkDeviceCommands?.()' in html
assert "document.getElementById('vBrainV19')" in html
assert "closest('#vBrainV8')" in html
assert 'data-source="remote-extension-loader.js"' in html
assert '__HOME_REMOTE_LOADER_V4__' in html
assert "CACHE_SCHEMA='host18-v5'" in html
assert "mode:'bundled-live-release'" in html
assert 'homeRemoteJsV2' in html and 'homeBehaviorJsV3' in html and 'purgeLegacy' in html
assert "new Function(js+'\\n//# sourceURL='+name)" not in html
assert "{name:'behavior-v3.js'" not in html
assert 'data-source="behavior-v3.js"' not in html
assert 'data-source="vbrain-sense-v13.js"' not in html
assert 'backdrop-filter:none!important' in html

assert 'brain_context' in (root/'sync-overlay/app/src/main/java/com/luis/home/HomeSyncJob.java').read_text()
assert 'vbrainBrainContext' in (root/'sync-overlay/app/src/main/java/com/luis/home/HomeSyncJob.java').read_text()
assert (root/'sync-overlay/app/src/main/java/com/luis/home/VeqryaSession.java').exists()
scripts=re.findall(r'<script\b[^>]*>(.*?)</script>',html,re.S|re.I)
with tempfile.TemporaryDirectory() as tmp:
 for i,script in enumerate(scripts):
  path=Path(tmp)/f'{i}.js';path.write_text(script.replace('<\\/script','</script'))
  subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
android=ET.parse(root/'sync-overlay/app/src/main/AndroidManifest.xml').getroot()
attr='{http://schemas.android.com/apk/res/android}name'
assert any(x.get(attr)=='.HomeNotificationReceiver' for x in android.findall('.//receiver'))
assert any(x.get(attr)=='.HomeSyncJob' for x in android.findall('.//service'))
if len(sys.argv)>1:
 with zipfile.ZipFile(sys.argv[1]) as apk:
  shipped=apk.read('assets/live-app.html')
  assert hashlib.sha256(shipped).hexdigest()==manifest['sha256']
  assert json.loads(apk.read('assets/live-release.json'))==manifest
print(f'PASS: {len(scripts)} scripts, single-owner v24 + 2.5s declarative config + idle capability hydration + remote full-UI renderer + Sense v20 + context compat + event-driven Veqrya/HOME reconnect + V19 brain/graph + lean HOME loader + complete release hash'+(' and APK bytes' if len(sys.argv)>1 else ''))
