"""Release gate for the single-owner Host-18 V-Brain One UI runtime."""
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
ui=json.loads((root/'home-runtime/ui-live-v25.json').read_text())

assert hashlib.sha256(html.encode()).hexdigest()==manifest['sha256']
assert len(html.encode())==manifest['bytes']
assert manifest['minNative']==18
assert manifest['version'].startswith('18.')
assert 'name="vbrain-host" content="18"' in html

# One runtime owns all visible UI. Historical UI layers may stay in git only.
assert html.count('data-source="')==1, 'v25 must ship exactly one injected runtime'
assert 'data-source="vbrain-one-ui-v25.js"' in html
assert '__VBRAIN_ONE_UI_V25__' in html
assert manifest['bytes'] < 150000, f'one-ui release regressed to {manifest["bytes"]} bytes'
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
 'remote-extension-loader.js','vbrain-backup-retirement-v22.js','vbrain-ui-performance-v23.js',
 'vbrain-lean-runtime-v24.js'
]
for name in retired_sources:
 assert f'data-source="{name}"' not in html, f'retired runtime leaked into release: {name}'

# Ownership/performance invariants.
assert 'setInterval(' not in html, 'shipping UI must not create repeating JS intervals'
assert "localStorage.setItem('homeTubeLayoutV6','stack')" in html
assert 'window.onVBrainLiveUpdate' in html
assert 'Native?.checkLiveUpdate?.()' in html
assert 'AdaptiveNative?.checkDeviceCommands?.()' in html
assert 'Native?.markRuntimeHealthy?.(' in html
assert 'window.VBrainLive=' in html and 'window.VBrain=' in html
assert 'vbrainPrivatePatch' in html and 'vbrainBrainContext' in html
assert 'Your signal today' in html and 'Behaviour intelligence' in html
assert 'Tube Learning' in html and 'Easy · 15 min' in html
assert 'v25BrainCanvas' in html
assert 'queuePrivateActivity' in html and "kind:'learning_attempt'" in html
assert 'detailPersonalNote' in html
assert 'todoLimit=18' in html, 'large task lists must be windowed'
assert '.syncBar{display:none!important}' in html
assert "if(name==='todos'){renderTodos();refreshNotion()}" not in html
assert "window.onAppResume=()=>{if(notionConnected())refreshNotion()};" not in html
assert "renderTodos();updateHome();updateSyncUI();if(notionConnected())refreshNotion();" not in html
assert 'Build momentum that matters.' not in html
assert "TODAY'S QUEST" not in html

# Fast declarative UI channel: data only, never executable remote JavaScript.
assert ui['schema']==1
assert 1500 <= int(ui['pollMs']) <= 10000
assert isinstance(ui.get('home',{}).get('components',[]),list)
assert isinstance(ui.get('slots',{}),dict)
for slot in ('gym','todos','tube','todoDetail'):
 assert isinstance(ui['slots'].get(slot,[]),list)
assert 'ui-live-v25.json' in html
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

print(f'PASS: One UI v25, {len(scripts)} total inline scripts / 1 injected runtime, {manifest["bytes"]} bytes, screenshot-2 Home + living Brain + bounded To-Dos + private notes/Tube + 2s declarative UI + Host-18 rollback'+(' and APK bytes' if len(sys.argv)>1 else ''))
