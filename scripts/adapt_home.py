#!/usr/bin/env python3
"""Private daily adaptation of adaptive-ui.json.

The script reads HOME activity through the authenticated Worker API, derives only UI
settings, and writes no raw usage data or personal metrics to GitHub.
"""
import json
import os
import statistics
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "adaptive-ui.json"
API = os.environ.get("HOME_API", "https://luis-home-sync.luisbogensberger.workers.dev").rstrip("/")
TOKEN = os.environ.get("HOME_TOKEN", "").strip()


def get_json(path):
    req = urllib.request.Request(API + path, method="GET")
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "HOME-Adaptive/1.0")
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ts_ms(row):
    for key in ("at", "timestamp", "createdAt", "updatedAt"):
        value = row.get(key)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value:
            try:
                return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
            except Exception:
                pass
    return 0


def event_type(row):
    return str(row.get("type") or row.get("event") or "")


def event_data(row):
    data = row.get("data")
    return data if isinstance(data, dict) else row


def collect(snapshot):
    activity = snapshot.get("activity") or snapshot.get("activities") or []
    attempts = snapshot.get("attempts") or []
    tasks = snapshot.get("tasks") or []
    if not isinstance(activity, list):
        activity = []
    if not isinstance(attempts, list):
        attempts = []
    if not isinstance(tasks, list):
        tasks = []
    return activity, attempts, tasks


def adapt(config, activity, attempts, tasks):
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    since = now_ms - 7 * 86400000
    recent = [r for r in activity if isinstance(r, dict) and ts_ms(r) >= since]
    recent_attempts = [r for r in attempts if isinstance(r, dict) and ts_ms(r) >= since]

    # Require enough behavioral evidence before changing anything.
    if len(recent) < 12 and len(recent_attempts) < 4:
        return False

    opens = [r for r in recent if event_type(r) == "tube_card_open"]
    completes = [r for r in recent if event_type(r) == "tube_complete"]
    dwell = []
    for r in recent:
        if event_type(r) == "tube_reader_dwell":
            try:
                ms = float(event_data(r).get("ms", 0))
                if 1000 <= ms <= 3600000:
                    dwell.append(ms)
            except Exception:
                pass
    scores = []
    for r in completes + recent_attempts:
        data = event_data(r)
        for key in ("score", "total"):
            try:
                n = float(data.get(key))
                if 0 <= n <= 100:
                    scores.append(n)
                    break
            except Exception:
                pass

    completion_rate = len(completes) / max(1, len(opens))
    avg_score = statistics.mean(scores) if scores else 0
    avg_dwell = statistics.mean(dwell) if dwell else 0
    todo_open = sum(1 for r in recent if event_type(r) == "todo_open")
    todo_done = sum(1 for r in recent if event_type(r) == "todo_complete")
    open_tasks = sum(1 for t in tasks if isinstance(t, dict) and not t.get("done"))

    tube = config.setdefault("tube", {})
    todos = config.setdefault("todos", {})
    theme = config.setdefault("theme", {})

    # Friction response: if cards are opened but rarely finished, shorten and simplify.
    if len(opens) >= 5 and completion_rate < 0.38:
        tube.update({"visibleCount": 3, "readerDepth": "compact", "sectionLimit": 2, "quizMode": "mcq_sentence"})
        theme["density"] = "compact"
    elif len(completes) >= 4 and completion_rate > 0.72 and avg_score >= 78:
        tube.update({"visibleCount": 5, "readerDepth": "deep", "sectionLimit": 5, "quizMode": "mixed"})
        theme["density"] = "comfortable"
    else:
        tube.update({"readerDepth": "balanced", "sectionLimit": 3})

    # Format response: short reader sessions benefit from a swipe/story entry format.
    if len(opens) >= 7 and avg_dwell:
        if avg_dwell < 75000 and completion_rate < 0.60:
            tube["layout"] = "swipe"
        elif completion_rate > 0.68:
            tube["layout"] = "stack"

    # Task interface response: backlog + low completion => narrow focus surface.
    if open_tasks >= 7 or (todo_open >= 4 and todo_done / max(1, todo_open) < 0.35):
        todos.update({"layout": "focus", "focusCount": 3, "maxVisible": max(5, min(open_tasks, 8)), "showNotes": False})
    elif todo_done >= 3:
        todos.update({"layout": "cards", "maxVisible": 8})

    config["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    config["generatedBy"] = "private-home-behavior-engine"
    return True


def main():
    if not TOKEN:
        raise SystemExit("HOME_TOKEN is required")
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    before = json.dumps(config, sort_keys=True)
    snapshot = get_json("/api/snapshot")
    activity, attempts, tasks = collect(snapshot)
    changed = adapt(config, activity, attempts, tasks)
    after = json.dumps(config, sort_keys=True)
    if changed and before != after:
        CONFIG.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Adaptive HOME config updated from private behavior data.")
    else:
        print("No adaptive UI change needed today.")


if __name__ == "__main__":
    main()
