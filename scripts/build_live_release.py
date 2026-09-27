"""Build one self-contained, deterministic UI release for both APK and live updates."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'sync-overlay/app/src/main/assets'
CSS = ['home-ui-v2.css', 'adaptive-runtime.css', 'todo-premium.css', 'runtime.css']
JS = ['home-ui-v2.js', 'adaptive-runtime.js', 'todo-premium.js', 'runtime.js',
      'tube-remote.js', 'vbrain-safe-shell-v3.js', 'vbrain-patch-v10.js',
      'vbrain-autonomy-v11.js', 'vbrain-context-v12.js',
      'learning-engine-v10.js', 'learning-resilience-v11.js',
      'vbrain-android-back-v14.js', 'vbrain-live-core-v17.js',
      'vbrain-remote-ui-v18.js', 'vbrain-todo-core-v19.js',
      'vbrain-graph-v19.js', 'vbrain-hot-loader-v19.js', 'vbrain-runtime-v19.js',
      'remote-extension-loader.js']

def source(name):
    path = ASSETS / name
    if not path.exists():
        path = ROOT / 'home-runtime' / name
    return path.read_text()

def build():
    html = (ASSETS / 'index.html').read_text()
    html = re.sub(r'<script\b[^>]*\bsrc=["\'][^"\']+["\'][^>]*>\s*</script>', '', html, flags=re.I)
    html = re.sub(r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*>', '', html, flags=re.I)
    html = html.replace('\\n</body>', '\n</body>').replace('<title>HOME</title>', '<title>V-Brain</title>')
    styles = '\n'.join('<style data-source="'+name+'">\n'+source(name)+'\n</style>' for name in CSS)
    scripts = '\n'.join('<script data-source="'+name+'">\n'+source(name).replace('</script', '<\\/script')+'\n</script>' for name in JS)
    # Pin the API of the native host. This marker is also verified before a downloaded UI is activated.
    html = html.replace('</head>', styles+'\n<meta name="vbrain-host" content="18">\n</head>')
    html = html.replace('</body>', scripts+'\n</body>')
    payload = html.encode()
    digest = hashlib.sha256(payload).hexdigest()
    manifest = {'schema': 1, 'version': '18.'+digest[:12], 'minNative': 18,
                'file': 'live-app.html', 'sha256': digest, 'bytes': len(payload)}
    out = ROOT / 'home-runtime'
    expected = [(out/'live-app.html', payload),
                (out/'live-release.json', (json.dumps(manifest, indent=2)+'\n').encode())]
    if '--check' in sys.argv:
        for path, data in expected:
            if not path.exists() or path.read_bytes() != data:
                raise SystemExit(f'Stale release: run python3 scripts/build_live_release.py ({path.name})')
    else:
        for path, data in expected:
            path.write_bytes(data)
    print(json.dumps(manifest))

if __name__ == '__main__':
    build()
