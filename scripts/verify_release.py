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
assert 'data-source="vbrain-personalizer-v21.js"' in html
assert 'data-source="vbrain-personalizer-hook-v21.js"' in html
assert "document.getElementById('vBrainV19')" in html
assert "closest('#vBrainV8')" in html
assert 'data-source="remote-extension-loader.js"' in html
assert '__HOME_REMOTE_LOADER_V4__' in html
assert "CACHE_SCHEMA='host18-v4'" in html
assert 'homeRemoteJsV2' in html and 'homeBehaviorJsV3' in html and 'purgeLegacy' in html
assert "new Function(js+'\\n//# sourceURL='+name)" in html
assert 'data-source="behavior-v3.js"' not in html
assert 'data-source="vbrain-sense-v13.js"' not in html
assert 'brain_context' in (root/'sync-overlay/app/src/main/java/com/luis/home/HomeSyncJob.java').read_text()
assert 'vbrainBrainContext' in (root/'sync-overlay/app/src/main/java/com/luis/home/HomeSyncJob.java').read_text()
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
print(f'PASS: {len(scripts)} scripts, host 18 renderer + Sense v20 + Personalizer v21 + V19 private brain context + HOME v4 direct loader, legacy-cache quarantine, complete release hash, notification receiver, background job'+(' and APK bytes' if len(sys.argv)>1 else ''))
