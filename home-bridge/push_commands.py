#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

QUEUE = Path(__file__).with_name("queue.json")
API = os.environ.get("HOME_API", "https://luis-home-sync.luisbogensberger.workers.dev").rstrip("/")
TOKEN = os.environ.get("HOME_TOKEN", "").strip()

if not TOKEN:
    print("HOME_TOKEN repository secret is missing.", file=sys.stderr)
    sys.exit(2)


def request(method, path, body=None):
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HOME Sync HTTP {exc.code}: {payload[:300]}") from exc


def validate_task(task):
    if not isinstance(task, dict):
        raise ValueError("task must be an object")
    title = str(task.get("title", "")).strip()
    if not title or len(title) > 160:
        raise ValueError("task title must be 1-160 characters")
    task["title"] = title
    task.setdefault("done", False)
    task.setdefault("source", "chatgpt-bridge")
    return task


def run_command(command):
    op = command.get("op")
    if op == "upsert_task":
        task = validate_task(dict(command.get("task") or {}))
        task_id = str(task.get("id", "")).strip()
        if task_id:
            path = "/api/tasks/" + urllib.parse.quote(task_id, safe="")
            request("PATCH", path, task)
        else:
            request("POST", "/api/tasks", task)
        return
    if op == "delete_task":
        task_id = str(command.get("id", "")).strip()
        if not task_id:
            raise ValueError("delete_task requires id")
        request("DELETE", "/api/tasks/" + urllib.parse.quote(task_id, safe=""))
        return
    raise ValueError(f"Unsupported bridge op: {op}")


data = json.loads(QUEUE.read_text(encoding="utf-8"))
commands = data.get("commands") or []
if not isinstance(commands, list):
    raise ValueError("commands must be an array")

remaining = []
completed = 0
for command in commands:
    try:
        run_command(command)
        completed += 1
    except Exception as exc:
        remaining.append(command)
        print(f"Command failed: {exc}", file=sys.stderr)

if completed:
    data["commands"] = remaining
    data["lastProcessedCount"] = completed
    QUEUE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Processed {completed} HOME command(s).")
else:
    print("No HOME commands processed.")

if remaining:
    sys.exit(1)
