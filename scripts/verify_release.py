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
assert 'data-source="vbrain-remote-ui-v18.js"' in html
assert 'data-source="vbrain-sense-v20.js"' in html
assert 'data-source="vbrain-context-compat-v21.js"' in html
assert 'vbrainPrivatePatch' in html and 'brainContext' in html and 'brain_context_compat_synced' in html
assert 'data-source="vbrain-personalizer-v21.js"' in html
assert 'data-source="vbrain-personalizer-hook-v21.js"' in html
assert 'data-source="vbrain-sync-reconnect-v21.js"' in html
assert 'Reconnect HOME' in html and 'Native.configureVeqrya' in html and 'Native.configureNotion' in html and 'AdaptiveNative?.checkDeviceCommands?.()' in html
assert "document.getElementById('vBrainV19')" in html
assert "closest('#vBrainV8')" in html
assert 'data-source="remote-extension-loader.js"' in html
assert '__HOME_REMOTE_LOADER_V4__' in html
assert "CACHE_SCHEMA='host18-v5'" in html
assert "mode:'bundled-live-release'" in html
assert 'homeRemoteJsV2' in html and 'homeBehaviorJsV3' in html and 'purgeLegacy' in html
assert "new Function(js+'\\n//# sourceURL='+name)" not in html
assert "{name:'behavior-v3.js'" not in html
assert 'data-source="vbrain-backup-retirement-v22.js"' in html
assert '__VBRAIN_BACKUP_RETIREMENT_V22__' in html
assert "'vbRestoreInline'" in html and "'vBackupCard'" in html and "'homeRecoveryLauncher'" in html
assert html.index('data-source="vbrain-backup-retirement-v22.js"') > html.index('data-source="remote-extension-loader.js"')
assert 'data-source="vbrain-ui-performance-v23.js"' in html
assert '__VBRAIN_UI_PERFORMANCE_V23__' in html
assert "localStorage.setItem('homeTubeLayoutV6','stack')" in html
assert '#homeDayScoreV4' in html and '#homeMomentum' in html and '#vbrainLiveStatus17' in html
assert 'setInterval(tick,5000)' in html and 'VBrainHotLoader?.refresh?.()' in html and 'Native?.checkLiveUpdate?.()' in html
assert 'backdrop-filter:none!important' in html
assert html.index('data-source="vbrain-ui-performance-v23.js"') > html.index('data-source="vbrain-backup-retirement-v22.js"')
assert 'data-source="behavior-v3.js"' not in html
assert 'data-source="vbrain-sense-v13.js"' not in html
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
print(f'PASS: {len(scripts)} scripts, host 18 renderer + Sense v20 + live context compat + Personalizer v21 + Veqrya/HOME reconnect fallback + backup retirement v22 + unified fast UI v23 + V19 private brain context + lean HOME compatibility loader, legacy-cache quarantine, complete release hash, notification receiver, background job'+(' and APK bytes' if len(sys.argv)>1 else ''))
