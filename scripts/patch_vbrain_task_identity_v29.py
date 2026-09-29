"""Patch One UI so legacy task identity stays stable and clear remote duplicates collapse.

Older HOME generations could contain tasks without an id. Native sync protects itself by
adding an id before upload, but historically that id was random on every upload. Persisting
a deterministic id in the live JS before any task sync prevents new duplicate backend rows
without requiring a new APK.

Historical sync data may still contain many byte-for-byte-equivalent task snapshots under
random UUIDs. The live UI therefore also collapses only groups of at least three equivalent
remote tasks before merging them. Pairs and tasks with different note/detail content are
left untouched so legitimate repeated tasks are not silently removed.
"""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "sync-overlay/app/src/main/assets/vbrain-one-ui-v25.js")
text = path.read_text()
changed = False

identity_marker = "function stableLegacyTaskHash(value)"
remote_marker = "function collapseClearRemoteDuplicates(items)"
install_needle = "  function installTaskCore(){\n"

if identity_marker not in text:
    if install_needle not in text:
        raise SystemExit("Could not locate installTaskCore in One UI v25")
    identity_patch = r'''  function stableLegacyTaskHash(value){
    let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)
  }
  function normalizeLegacyTaskIds(){
    const state=(typeof todoState!=='undefined'&&todoState&&typeof todoState==='object')?todoState:null;if(!state)return false;
    let changed=false,repaired=0;for(const list of [state.active||[],state.archive||[]])for(const t of list){if(taskId(t)||!taskKey(t))continue;t.id=`legacy-${stableLegacyTaskHash(taskKey(t))}`;changed=true;repaired++}
    if(changed){saveStore('todoState',state);log('todo_identity_repaired',{count:repaired,active:(state.active||[]).length,archived:(state.archive||[]).length})}return changed
  }
'''
    text = text.replace(install_needle, identity_patch + install_needle, 1)
    changed = True

if remote_marker not in text:
    if install_needle not in text:
        raise SystemExit("Could not locate installTaskCore for remote dedupe patch")
    remote_helpers = r'''  function remoteTaskFingerprint(t){
    let details='';try{details=JSON.stringify(t?.details||{})}catch(_){details=''}return `${taskKey(t)}|${clean(t?.note||'',1800)}|${details}`
  }
  function collapseClearRemoteDuplicates(items){
    const list=Array.isArray(items)?items:[],groups=new Map(),order=[];for(const t of list){const key=remoteTaskFingerprint(t);if(!groups.has(key)){groups.set(key,[]);order.push(key)}groups.get(key).push(t)}
    const out=[];let removed=0;const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for(const key of order){const group=groups.get(key)||[];if(group.length>=3){const stable=group.find(t=>taskId(t)&&!uuid.test(taskId(t)));out.push(stable||group[0]);removed+=group.length-1}else out.push(...group)}
    if(removed)log('todo_remote_duplicates_collapsed',{removed,kept:out.length,total:list.length});return out
  }
'''
    text = text.replace(install_needle, remote_helpers + install_needle, 1)
    changed = True

snapshot_needle = "const allRemoteActive=Array.isArray(data?.open)?data.open:[],allRemoteArchive=Array.isArray(data?.completed)?data.completed:[];"
if snapshot_needle in text:
    snapshot_patch = "const rawRemoteActive=Array.isArray(data?.open)?data.open:[],rawRemoteArchive=Array.isArray(data?.completed)?data.completed:[],allRemoteActive=collapseClearRemoteDuplicates(rawRemoteActive),allRemoteArchive=collapseClearRemoteDuplicates(rawRemoteArchive);"
    text = text.replace(snapshot_needle, snapshot_patch, 1)
    changed = True
elif "rawRemoteActive=Array.isArray(data?.open)" not in text:
    raise SystemExit("Could not locate remote task snapshot merge in One UI v25")

if changed:
    path.write_text(text)
    print(f"patched {path}")
else:
    print("legacy task identity + remote dedupe patch already present")
