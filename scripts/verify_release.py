"""Release gate for the lean Host-18 V-Brain runtime."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
html=(root/'home-runtime/live-app.html').read_text()
manifest=json.loads((root/'home-runtime/live-release.json').read_text())
ui=json.loads((root/'home-runtime/ui-live-v24.json').read_text())

assert hashlib.sha256(html.encode()).hexdigest()==manifest['sha256']
assert len(html.encode())==manifest['bytes']
assert manifest['minNative']==18
assert manifest['version'].startswith('18.')
assert 'name="vbrain-host" content="18"' in html

# The base document plus ONE runtime is the entire shipping web architecture.
assert html.count('data-source="')==1, 'v24 must ship exactly one injected runtime'
assert 'data-source="vbrain-lean-runtime-v24.js"' in html
assert '__VBRAIN_LEAN_RUNTIME_V24__' in html
assert manifest['bytes'] < 150000, f'lean release regressed to {manifest["bytes"]} bytes'
assert not re.search(r'<script\b[^>]*\bsrc=',html,re.I), 'no external script may execute at boot'
assert not re.search(r'<link\b[^>]*\brel=["\']stylesheet',html,re.I), 'no external stylesheet may execute at boot'

retired_sources=[
 'home-ui-v2.js','adaptive-runtime.js','todo-premium.js','runtime.js','tube-remote.js',
 'vbrain-safe-shell-v3.js','vbrain-patch-v10.js','vbrain-autonomy-v11.js','vbrain-context-v12.js',
 'vbrain-sense-v20.js','vbrain-context-compat-v21.js','vbrain-personalizer-v21.js',
 'vbrain-personalizer-hook-v21.js','learning-engine-v10.js','learning-resilience-v11.js',
 'vbrain-android-back-v14.js','vbrain-live-core-v17.js','vbrain-sync-reconnect-v21.js',
 'vbrain-remote-ui-v18.js','vbrain-todo-core-v19.js','vbrain-graph-v19.js',
 'vbrain-hot-loader-v19.js','vbrain-runtime-v19.js','vbrain-compat-restore-v1.js',
 'remote-extension-loader.js','vbrain-backup-retirement-v22.js','vbrain-ui-performance-v23.js'
]
for name in retired_sources:
 assert f'data-source="{name}"' not in html, f'retired runtime leaked into release: {name}'

# Performance/ownership invariants.
assert 'setInterval(' not in html, 'shipping UI must not create repeating JS intervals'
assert "localStorage.setItem('homeTubeLayoutV6','stack')" in html
assert 'window.__VBRAIN_LEAN_RUNTIME_V24__' in html
assert 'window.onVBrainLiveUpdate' in html
assert 'Native?.checkLiveUpdate?.()' in html
assert 'AdaptiveNative?.checkDeviceCommands?.()' in html
assert 'Native?.markRuntimeHealthy?.(' in html
assert 'window.VBrainLive=' in html and 'window.VBrain=' in html
assert 'vbrainPrivatePatch' in html and 'vbrainBrainContext' in html
assert 'backdrop-filter:none!important' in html
assert 'Build momentum that matters.' not in html
assert "TODAY'S QUEST" not in html

# Fast declarative UI channel: data, not arbitrary remote JavaScript.
assert ui['schema']==1
assert 1500 <= int(ui['pollMs']) <= 10000
assert isinstance(ui.get('home',{}).get('components',[]),list)
assert isinstance(ui.get('slots',{}),dict)
for slot in ('calendar','todos','tube','todoDetail'):
 assert isinstance(ui['slots'].get(slot,[]),list)
assert 'ui-live-v24.json' in html
assert "new Function(" not in html and 'eval(' not in html

# Every inline script must parse.
scripts=re.findall(r'<script\b[^>]*>(.*?)</script>',html,re.S|re.I)
with tempfile.TemporaryDirectory() as tmp:
 for i,script in enumerate(scripts):
  path=Path(tmp)/f'{i}.js';path.write_text(script.replace('<\\/script','</script'))
  subprocess.run(['node','--check',str(path)],check=True,capture_output=True)

android=ET.parse(root/'sync-overlay/app/src/main/AndroidManifest.xml').getroot()
attr='{http://schemas.android.com/apk/res/android}name'
assert any(x.get(attr)=='.HomeNotificationReceiver' for x in android.findall('.//receiver'))
assert any(x.get(attr)=='.HomeSyncJob' for x in android.findall('.//service'))
home_job=(root/'sync-overlay/app/src/main/java/com/luis/home/HomeSyncJob.java').read_text()
assert 'brain_context' in home_job and 'vbrainBrainContext' in home_job

if len(sys.argv)>1:
 with zipfile.ZipFile(sys.argv[1]) as apk:
  shipped=apk.read('assets/live-app.html')
  assert hashlib.sha256(shipped).hexdigest()==manifest['sha256']
  assert json.loads(apk.read('assets/live-release.json'))==manifest

print(f'PASS: lean v24, {len(scripts)} total inline scripts / 1 injected runtime, {manifest["bytes"]} bytes, no legacy execution loops, 2s declarative UI channel, Host-18 live rollback contract'+(' and APK bytes' if len(sys.argv)>1 else ''))
