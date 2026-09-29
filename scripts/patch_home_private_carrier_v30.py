"""Add a private HOME snapshot carrier for V-Brain personal state.

The HOME Worker is already an authenticated private channel. A reserved card named
`vbrain-private-state-v1` may carry a bounded `patch` object. Android stores only that
object in SharedPreferences under `vbrainPrivatePatch`; the card is never rendered as a
To-Do or public UI element.
"""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "src/luis-home-app/app/src/main/java/com/luis/home/MainActivity.java")
s = path.read_text()

anchor = '''    private JSONObject snapshotForUi(JSONObject snapshot) throws Exception {\n        JSONArray open = new JSONArray();\n'''
replacement = '''    private void syncPrivatePatchCarrier(JSONObject snapshot) {\n        try {\n            JSONArray cards = snapshot.optJSONArray("cards");\n            if (cards == null) return;\n            for (int i = 0; i < cards.length(); i++) {\n                JSONObject card = cards.optJSONObject(i);\n                if (card == null || !"vbrain-private-state-v1".equals(card.optString("id"))) continue;\n                JSONObject patch = card.optJSONObject("patch");\n                if (patch == null) return;\n                String raw = patch.toString();\n                if (raw.length() > 120000) return;\n                JSONObject brain = patch.optJSONObject("brainContext");\n                if (brain != null) {\n                    JSONArray items = brain.optJSONArray("items");\n                    if (items != null && items.length() > 200) return;\n                }\n                String prior = prefs.getString("vbrainPrivatePatch", "");\n                if (!raw.equals(prior)) prefs.edit().putString("vbrainPrivatePatch", raw).commit();\n                return;\n            }\n        } catch (Exception ignored) { }\n    }\n\n    private JSONObject snapshotForUi(JSONObject snapshot) throws Exception {\n        syncPrivatePatchCarrier(snapshot);\n        JSONArray open = new JSONArray();\n'''
if anchor not in s:
    raise SystemExit("MainActivity snapshot carrier anchor not found")
s = s.replace(anchor, replacement, 1)
path.write_text(s)
print(f"Patched {path}: authenticated HOME private patch carrier")
