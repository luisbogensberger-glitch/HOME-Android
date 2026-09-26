import json
import os
import urllib.error
import urllib.request

HOME_API = os.environ.get("HOME_API", "https://luis-home-sync.luisbogensberger.workers.dev").rstrip("/")
SUPABASE_INGEST = os.environ.get(
    "SUPABASE_INGEST",
    "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-learning-ingest",
)
SUPABASE_TASK_INGEST = os.environ.get(
    "SUPABASE_TASK_INGEST",
    "https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-task-ingest",
)
HOME_TOKEN = os.environ.get("HOME_TOKEN", "").strip()
GITHUB_OIDC_TOKEN = os.environ.get("GITHUB_OIDC_TOKEN", "").strip()
GITHUB_TASK_OIDC_TOKEN = os.environ.get("GITHUB_TASK_OIDC_TOKEN", "").strip()

if len(HOME_TOKEN) < 16:
    raise SystemExit("HOME_TOKEN is missing or too short")
if GITHUB_OIDC_TOKEN.count(".") != 2:
    raise SystemExit("GitHub learning OIDC token is missing or invalid")
if GITHUB_TASK_OIDC_TOKEN.count(".") != 2:
    raise SystemExit("GitHub task OIDC token is missing or invalid")


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
            "User-Agent": "V-Brain-Private-Mirror/1.6",
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
    raise RuntimeError("V-Brain snapshot response was invalid")

attempts = snapshot.get("attempts") or []
activity = snapshot.get("activity") or []
tasks = snapshot.get("tasks") or []
if not isinstance(attempts, list):
    raise RuntimeError("V-Brain attempts payload was invalid")
if not isinstance(activity, list):
    raise RuntimeError("V-Brain activity payload was invalid")
if not isinstance(tasks, list):
    raise RuntimeError("V-Brain tasks payload was invalid")

eligible_attempts = []
for attempt in attempts:
    if not isinstance(attempt, dict):
        continue
    reflection = str(attempt.get("reflection") or attempt.get("sentence") or "").strip()
    if not reflection:
        continue
    item = dict(attempt)
    item.setdefault("reflection", reflection)
    item.setdefault("source", "vbrain-sync-mirror")
    eligible_attempts.append(item)

allowed_exact = {
    "behavior_summary", "screen_dwell", "screen_open", "ui_usage_summary",
    "insights_open", "insights_node_open", "todo_open", "todo_complete", "todo_add",
    "tube_card_open", "tube_complete", "gym_open", "gym_start", "gym_complete",
    "gym_plan_select", "gym_exercise_toggle", "behavior_ui_decision", "adaptive_profile_updated",
    "habit_intervention", "todo_pressure_show", "todo_pressure_dismiss", "notification_plan",
    "feedback_prompt_shown", "feedback_prompt_dismissed", "feedback_response",
    "learning_method_selected", "semantic_learning_updated", "sentence_review_error",
    "learning_engine_loaded", "ui_press", "screen_enter_detail", "screen_exit_detail",
    "session_heartbeat", "session_background", "session_foreground", "home_impression",
    "dynamic_module_open", "interface_manifest", "private_text_field",
    "private_context_synced", "tube_text_sync", "vbrain_runtime_ready", "todo_link_open",
    "ui_press_v13", "field_activity_v13", "screen_enter_v13", "screen_exit_v13",
    "session_heartbeat_v13", "session_background_v13", "session_foreground_v13",
    "session_start_v13", "inbox_access_status_v13", "permission_open_v13",
    "notification_shown_v13", "whatsapp_message_private", "gmail_notification_private",
}
private_kinds = {"private_text_field", "whatsapp_message_private", "gmail_notification_private"}

eligible_activity = []
for row in activity:
    if not isinstance(row, dict):
        continue
    kind = str(row.get("kind") or row.get("type") or "").strip()
    if not kind:
        continue
    if kind not in allowed_exact and not kind.startswith("behaviour_") and not kind.startswith("behavior_"):
        continue
    if kind in private_kinds:
        item = dict(row)
        item["kind"] = kind
        item["type"] = kind
        item.setdefault("source", "vbrain-private-context-mirror")
    else:
        item = {
            "id": row.get("id"),
            "kind": kind,
            "type": kind,
            "at": row.get("at"),
            "createdAt": row.get("createdAt"),
            "screen": row.get("screen"),
            "data": row.get("data") if isinstance(row.get("data"), dict) else {},
            "source": "vbrain-behaviour-mirror",
        }
    eligible_activity.append(item)

eligible_tasks = []
for task in tasks:
    if not isinstance(task, dict):
        continue
    task_id = str(task.get("id") or "").strip()
    if not task_id:
        continue
    item = dict(task)
    item.setdefault("source", "vbrain-sync-task-mirror")
    eligible_tasks.append(item)

mirrored = 0
activity_mirrored = 0
max_batches = max(
    (len(eligible_attempts) + 199) // 200,
    (len(eligible_activity) + 499) // 500,
    1,
)
for batch_index in range(max_batches):
    attempt_batch = eligible_attempts[batch_index * 200 : (batch_index + 1) * 200]
    activity_batch = eligible_activity[batch_index * 500 : (batch_index + 1) * 500]
    if not attempt_batch and not activity_batch:
        continue
    ingest_status, result = request_json(
        SUPABASE_INGEST,
        method="POST",
        body={"attempts": attempt_batch, "activity": activity_batch},
        bearer=GITHUB_OIDC_TOKEN,
    )
    if ingest_status != 200 or not isinstance(result, dict) or result.get("ok") is not True:
        raise RuntimeError("Supabase private learning ingest returned an invalid response")
    mirrored += int(result.get("upserted") or 0)
    activity_mirrored += int(result.get("activityUpserted") or 0)

task_mirrored = 0
for start in range(0, len(eligible_tasks), 300):
    task_batch = eligible_tasks[start : start + 300]
    task_status, task_result = request_json(
        SUPABASE_TASK_INGEST,
        method="POST",
        body={"tasks": task_batch},
        bearer=GITHUB_TASK_OIDC_TOKEN,
    )
    if task_status != 200 or not isinstance(task_result, dict) or task_result.get("ok") is not True:
        raise RuntimeError("Supabase private task ingest returned an invalid response")
    task_mirrored += int(task_result.get("upserted") or 0)

print(
    f"V-Brain private mirror: {mirrored} written attempt(s), "
    f"{activity_mirrored} behaviour/context event(s), {task_mirrored} task snapshot(s) upserted"
)
