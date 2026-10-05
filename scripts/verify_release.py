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
feed=json.loads((root/'tube-feed.json').read_text())

assert hashlib.sha256(html.encode()).hexdigest()==manifest['sha256']
assert len(html.encode())==manifest['bytes']
assert manifest['minNative']==18
assert manifest['version'].startswith('18.')
assert 'name="vbrain-host" content="18"' in html

# Exactly one runtime owns visible UI. V29 is a non-visual private data helper.
assert html.count('data-source="')==1, 'v25 must remain the only injected runtime owner'
assert html.count('data-source="vbrain-one-ui-v25.js"')==1
assert html.count('data-helper="')==1, 'release may ship only one private helper'
assert html.count('data-helper="vbrain-private-ingest-v29.js"')==1
assert '__VBRAIN_ONE_UI_V25__' in html
assert '__VBRAIN_PRIVATE_INGEST_V29__' in html
assert manifest['bytes'] < 240000, f'one-ui release regressed to {manifest["bytes"]} bytes'
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
 assert f'data-helper="{name}"' not in html, f'retired helper leaked into release: {name}'

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
assert 'window.__vbrainBundledTubeFeed=' in html and 'ICARUS' in html
assert html.count('window.__vbrainBundledTubeFeed=')==1, 'bundled feed must not be duplicated across helpers'
assert 'GoogleNative' in html and 'onGoogleSnapshot' in html and 'vbrainLocalAdaptV31' in html
assert 'nextLearningCard' in html and 'knowledgeModel' in html
assert 'vbrainDailyScoreV28' in html and 'daily_score_finalized' in html
assert 'vbrainHomeCardOrderV28' in html and 'v28DragGhost' in html
assert 'M15 2 L52 46 L89 2' in html
assert len(feed['cards']) >= 12 and len(feed['featuredIds']) == 5
assert all(any(c['id']==id for c in feed['cards']) for id in feed['featuredIds'])
assert any('The Culture Map' in c['topic'] for c in feed['cards'])
assert 'vbrainOlderTasksV27' in html and 'vbrainTodoBackupV27' in html
assert 'photo-1513635269975-59663e0ac1ad' in html
assert 'v25BrainCanvas' in html and 'Established signal' in html
assert 'vbrainGraphV26' in html and 'vbrainBranchesV26' in html
assert 'vbrainGraphV19' in html and 'homeLivingGraphV8' in html
assert 'GRAPH_VIEW_LIMIT=90' in html and 'v25BrainSearch' in html
assert 'items.slice(0,100)' not in html and 'items||[]).slice(0,10)' not in html
assert 'queuePrivateActivity' in html and "kind:'learning_attempt'" in html
assert 'detailPersonalNote' in html
assert 'todoLimit=18' in html, 'large task lists must be windowed'
assert 'Connect HOME Sync' in html and 'function refreshTasks' in html
assert 'window.onNotionSnapshot=data=>' in html and 'window.completeTodo=id=>' in html
assert 'window.onHomeSentenceReview=result=>' in html and 'reviewSentence?.(' in html
assert 'data-route="calendar"' in html
assert "if(name==='todos'){renderTodos();refreshNotion()}" not in html
assert "window.onAppResume=()=>{if(notionConnected())refreshNotion()};" not in html
assert "renderTodos();updateHome();updateSyncUI();if(notionConnected())refreshNotion();" not in html
assert 'Build momentum that matters.' not in html
assert "TODAY'S QUEST" not in html

# Private task ingestion is generic code only: task text arrives only via the private device patch.
assert 'taskUpserts' in html
assert 'vbrainPrivateTaskAppliedV29' in html
assert 'vbrainCompletedHistoryV29' in html
assert 'private_task_ingested' in html
assert 'VBrainPrivateIngest' in html

# Fast declarative UI channel: data only, never executable remote JavaScript.
assert ui['schema']==1
assert 1500 <= int(ui['pollMs']) <= 10000
assert isinstance(ui.get('home',{}).get('components',[]),list)
assert isinstance(ui.get('slots',{}),dict)
for slot in ('gym','calendar','todos','tube','todoDetail'):
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

print(f'PASS: One UI v25 + private ingest v29, {len(scripts)} total inline scripts / 1 visual owner + 1 private helper, {manifest["bytes"]} bytes, persistent Brain + local-first To-Dos + semantic Tube review + calendar + live UI + Host-18 rollback'+(' and APK bytes' if len(sys.argv)>1 else ''))
