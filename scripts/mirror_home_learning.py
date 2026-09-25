import json
import os
import sys
import urllib.error
import urllib.request

HOME_API = os.environ.get("HOME_API", "https://luis-home-sync.luisbogensberger.workers.dev").rstrip("/")
SUPABASE_INGEST = os.environ.get(
    "SUPABASE_INGEST",
    "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-learning-ingest",
)
HOME_TOKEN = os.environ.get("HOME_TOKEN", "").strip()
GITHUB_OIDC_TOKEN = os.environ.get("GITHUB_OIDC_TOKEN", "").strip()

if len(HOME_TOKEN) < 16:
    raise SystemExit("HOME_TOKEN is missing or too short")
if GITHUB_OIDC_TOKEN.count(".") != 2:
    raise SystemExit("GitHub OIDC token is missing or invalid")


def request_json(url, *, method="GET", body=None, bearer=""):
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {bearer}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "HOME-Learning-Mirror/1.1",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw.decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"HTTP {exc.code} from {url}: {detail}") from exc


status, snapshot = request_json(f"{HOME_API}/api/snapshot", bearer=HOME_TOKEN)
if status != 200 or not isinstance(snapshot, dict):
    raise RuntimeError("HOME snapshot response was invalid")

attempts = snapshot.get("attempts") or []
if not isinstance(attempts, list):
    raise RuntimeError("HOME attempts payload was invalid")

eligible = []
for attempt in attempts:
    if not isinstance(attempt, dict):
        continue
    reflection = str(attempt.get("reflection") or attempt.get("sentence") or "").strip()
    if not reflection:
        continue
    item = dict(attempt)
    item.setdefault("reflection", reflection)
    item.setdefault("source", "home-sync-mirror")
    eligible.append(item)

if not eligible:
    print("HOME learning mirror: 0 written attempts to mirror")
    sys.exit(0)

mirrored = 0
for start in range(0, len(eligible), 200):
    batch = eligible[start : start + 200]
    ingest_status, result = request_json(
        SUPABASE_INGEST,
        method="POST",
        body={"attempts": batch},
        bearer=GITHUB_OIDC_TOKEN,
    )
    if ingest_status != 200 or not isinstance(result, dict) or result.get("ok") is not True:
        raise RuntimeError("Supabase learning ingest returned an invalid response")
    mirrored += int(result.get("upserted") or 0)

# Never print raw attempts: GitHub Actions logs are not a private learning store.
print(f"HOME learning mirror: {mirrored} written attempt(s) upserted")
