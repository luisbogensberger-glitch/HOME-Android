"""Build one self-contained, deterministic UI release for both APK and live updates."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'sync-overlay/app/src/main/assets'

# V25 remains the one visible/runtime owner. V29 is a non-visual private-ingest helper:
# it consumes only device-private patch data and never places private content in this repository.
CSS = []
JS = ['vbrain-one-ui-v25.js', 'vbrain-private-ingest-v29.js']

def source(name):
    path = ASSETS / name
    if not path.exists():
        path = ROOT / 'home-runtime' / name
    return path.read_text()

def build():
    html = (ASSETS / 'index.html').read_text()
    html = re.sub(r'<script\b[^>]*\bsrc=["\'][^"\']+["\'][^>]*>\s*</script>', '', html, flags=re.I)
    html = re.sub(r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*>', '', html, flags=re.I)

    # The old base used to render every task and start HOME/Notion sync before the
    # single UI owner had even booted. Keep action-based task sync, but remove all
    # automatic refreshes and the heavyweight pre-render from the shipping document.
    html = html.replace("window.onAppResume=()=>{if(notionConnected())refreshNotion()};", "window.onAppResume=()=>{};")
    html = html.replace("if(name==='todos'){renderTodos();refreshNotion()}", "if(name==='todos'){renderTodos()}")
    html = html.replace("renderTodos();updateHome();updateSyncUI();if(notionConnected())refreshNotion();", "")

    html = html.replace('\\n</body>', '\n</body>').replace('<title>HOME</title>', '<title>V-Brain</title>')
    styles = '\n'.join('<style data-source="'+name+'">\n'+source(name)+'\n</style>' for name in CSS)
    feed = json.loads((ROOT / 'tube-feed.json').read_text())
    if not isinstance(feed.get('cards'), list) or len(feed['cards']) < 5:
        raise ValueError('Tube release needs at least five bundled learning cards')
    bundled_feed = json.dumps(feed, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    scripts = '\n'.join('<script data-source="'+name+'">\nwindow.__vbrainBundledTubeFeed='+bundled_feed+';\n'+source(name).replace('</script', '<\\/script')+'\n</script>' for name in JS)
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
