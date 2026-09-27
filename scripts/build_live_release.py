"""Build one self-contained, deterministic UI release for both APK and live updates."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'sync-overlay/app/src/main/assets'
CSS = ['home-ui-v2.css', 'todo-premium.css', 'runtime.css']

# Only these four scripts may run on the critical first-paint path.
CRITICAL_JS = [
    'home-ui-v2.js',
    'vbrain-core-v24.js',
    'vbrain-shell-v24.js',
    'vbrain-gym-v24.js',
]

# Everything else is optional capability and is hydrated in tiny idle slices.
# Legacy UI owners (adaptive-runtime/runtime quest UI/v10 patch/v11 autonomy/v21
# personalizer/v23 repair layer) are deliberately not shipped anymore.
IDLE_JS = [
    'todo-premium.js', 'tube-remote.js', 'vbrain-safe-shell-v3.js',
    'vbrain-context-v12.js', 'vbrain-sense-v20.js', 'vbrain-context-compat-v21.js',
    'learning-engine-v10.js', 'learning-resilience-v11.js',
    'vbrain-android-back-v14.js', 'vbrain-live-core-v17.js', 'vbrain-sync-reconnect-v21.js',
    'vbrain-remote-ui-v18.js', 'vbrain-todo-core-v19.js',
    'vbrain-graph-v19.js', 'vbrain-hot-loader-v19.js', 'vbrain-runtime-v19.js',
    'vbrain-compat-restore-v1.js', 'remote-extension-loader.js', 'vbrain-backup-retirement-v22.js',
]

def source(name):
    path = ASSETS / name
    if not path.exists():
        path = ROOT / 'home-runtime' / name
    return path.read_text()

def script_tag(name, idle=False):
    code = source(name).replace('</script', '<\\/script')
    if idle:
        code = "(window.__vbrainIdleQueue=window.__vbrainIdleQueue||[]).push(function(){\n" + code + "\n});"
    return '<script data-source="'+name+'">\n'+code+'\n</script>'

def idle_bootstrap():
    return '''<script data-source="vbrain-idle-bootstrap-v24">
(function(){
  'use strict';
  const q=window.__vbrainIdleQueue||[];
  let running=false;
  function schedule(){
    if(running||!q.length)return;running=true;
    const cb=deadline=>{
      running=false;let count=0;
      while(q.length&&count<2&&(!deadline||deadline.didTimeout||deadline.timeRemaining()>3)){
        const fn=q.shift();try{fn()}catch(e){try{console.warn('V-Brain idle capability failed',e)}catch(_){}}count++;
      }
      if(q.length)schedule();else{document.documentElement.dataset.vbrainHydrated='24';try{window.dispatchEvent(new CustomEvent('vbrain:hydrated'))}catch(_){}}
    };
    if(typeof requestIdleCallback==='function')requestIdleCallback(cb,{timeout:280});else setTimeout(()=>cb(null),0);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
</script>'''

def build():
    html = (ASSETS / 'index.html').read_text()
    html = re.sub(r'<script\b[^>]*\bsrc=["\'][^"\']+["\'][^>]*>\s*</script>', '', html, flags=re.I)
    html = re.sub(r'<link\b[^>]*\brel=["\']stylesheet["\'][^>]*>', '', html, flags=re.I)
    html = html.replace('\\n</body>', '\n</body>').replace('<title>HOME</title>', '<title>V-Brain</title>')
    styles = '\n'.join('<style data-source="'+name+'">\n'+source(name)+'\n</style>' for name in CSS)
    critical = '\n'.join(script_tag(name) for name in CRITICAL_JS)
    idle = '\n'.join(script_tag(name, True) for name in IDLE_JS)
    scripts = critical+'\n'+idle+'\n'+idle_bootstrap()
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
