"""Fail the Android build if the private HOME patch carrier is not wired safely."""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "src/luis-home-app/app/src/main/java/com/luis/home/MainActivity.java")
s = path.read_text()
assert 'syncPrivatePatchCarrier(JSONObject snapshot)' in s
assert '"vbrain-private-state-v1".equals(card.optString("id"))' in s
assert 'snapshot.optJSONArray("cards")' in s
assert 'card.optJSONObject("patch")' in s
assert 'putString("vbrainPrivatePatch", raw)' in s
assert 'raw.length() > 120000' in s
assert 'items.length() > 200' in s
assert 'syncPrivatePatchCarrier(snapshot);' in s
print('PASS: HOME snapshot carries only the reserved bounded private V-Brain patch')
