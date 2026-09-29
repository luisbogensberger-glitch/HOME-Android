"""Patch One UI so legacy id-less tasks get a deterministic local identity.

Older HOME generations could contain tasks without an id. Native sync protects itself by
adding an id before upload, but historically that id was random on every upload. Persisting
a deterministic id in the live JS before any task sync prevents duplicate backend rows
without requiring a new APK.
"""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "sync-overlay/app/src/main/assets/vbrain-one-ui-v25.js")
text = path.read_text()
marker = "function stableLegacyTaskHash(value)"
if marker in text:
    print("legacy task identity patch already present")
    raise SystemExit(0)

needle = "  function installTaskCore(){\n"
if needle not in text:
    raise SystemExit("Could not locate installTaskCore in One UI v25")

patch = r'''  function stableLegacyTaskHash(value){
    let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)
  }
  function normalizeLegacyTaskIds(){
    const state=(typeof todoState!=='undefined'&&todoState&&typeof todoState==='object')?todoState:null;if(!state)return false;
    let changed=false,repaired=0;for(const list of [state.active||[],state.archive||[]])for(const t of list){if(taskId(t)||!taskKey(t))continue;t.id=`legacy-${stableLegacyTaskHash(taskKey(t))}`;changed=true;repaired++}
    if(changed){saveStore('todoState',state);log('todo_identity_repaired',{count:repaired,active:(state.active||[]).length,archived:(state.archive||[]).length})}return changed
  }
  function installTaskCore(){
    normalizeLegacyTaskIds();
'''

path.write_text(text.replace(needle, patch, 1))
print(f"patched {path}")
