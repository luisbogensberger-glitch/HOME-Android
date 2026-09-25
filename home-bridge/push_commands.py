#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from curl_cffi import requests

ROOT = Path(__file__).resolve().parent
QUEUE = ROOT / "queue.json"
PUBLIC_KEY = ROOT / "public_key.json"
API = os.environ.get("HOME_API", "https://luis-home-sync.luisbogensberger.workers.dev").rstrip("/")
TOKEN = os.environ.get("HOME_TOKEN", "").strip()
AAD = b"HOME-BRIDGE-V2"
KEY_SALT = b"HOME-Bridge-v2-key-derivation"
KEY_INFO = b"x25519-private-key"
COMMAND_INFO = b"HOME-Bridge-v2-command"
MAX_COMMAND_AGE_MS = 7 * 24 * 60 * 60 * 1000

if not TOKEN:
    print("HOME_TOKEN repository secret is missing.", file=sys.stderr)
    sys.exit(2)


def b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64d(text: str) -> bytes:
    clean = str(text or "").strip()
    return base64.urlsafe_b64decode(clean + "=" * ((4 - len(clean) % 4) % 4))


def derive_private_key() -> X25519PrivateKey:
    seed = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=KEY_SALT,
        info=KEY_INFO,
    ).derive(TOKEN.encode("utf-8"))
    return X25519PrivateKey.from_private_bytes(seed)


def ensure_public_key(private_key: X25519PrivateKey) -> bool:
    raw = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    payload = {
        "version": 2,
        "algorithm": "X25519-HKDF-SHA256+A256GCM",
        "publicKey": b64e(raw),
        "fingerprint": hashlib.sha256(raw).hexdigest(),
        "note": "Public encryption key only. The private key is deterministically derived inside GitHub Actions from the existing HOME_TOKEN secret and is never stored in GitHub.",
    }
    rendered = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    current = PUBLIC_KEY.read_text(encoding="utf-8") if PUBLIC_KEY.exists() else ""
    if current == rendered:
        return False
    PUBLIC_KEY.write_text(rendered, encoding="utf-8")
    print("HOME bridge public key refreshed.")
    return True


def request(method: str, path: str, body=None):
    headers = {
        "Authorization": "Bearer " + TOKEN,
        "Accept": "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
    }
    # curl_cffi impersonates a real Chrome TLS/browser signature. The previous urllib
    # bridge was rejected by Cloudflare Error 1010 even with a browser-like User-Agent.
    response = requests.request(
        method,
        API + path,
        headers=headers,
        json=body if body is not None else None,
        timeout=25,
        impersonate="chrome",
    )
    if response.status_code < 200 or response.status_code >= 300:
        raise RuntimeError(f"HOME Sync HTTP {response.status_code}: {response.text[:400]}")
    if not response.text.strip():
        return None
    try:
        return response.json()
    except Exception:
        return response.text


def decrypt_envelope(private_key: X25519PrivateKey, envelope: dict) -> dict:
    if not isinstance(envelope, dict) or envelope.get("v") != 2:
        raise ValueError("Only encrypted v2 HOME bridge envelopes are accepted")
    if envelope.get("alg") != "X25519-HKDF-SHA256+A256GCM":
        raise ValueError("Unsupported bridge encryption algorithm")

    epk = X25519PublicKey.from_public_bytes(b64d(envelope.get("ephemeralPublicKey")))
    salt = b64d(envelope.get("salt"))
    nonce = b64d(envelope.get("nonce"))
    ciphertext = b64d(envelope.get("ciphertext"))
    if len(salt) != 16 or len(nonce) != 12:
        raise ValueError("Invalid bridge envelope parameters")

    shared = private_key.exchange(epk)
    aes_key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=COMMAND_INFO,
    ).derive(shared)
    plaintext = AESGCM(aes_key).decrypt(nonce, ciphertext, AAD)
    command = json.loads(plaintext.decode("utf-8"))
    if not isinstance(command, dict) or command.get("version") != 2:
        raise ValueError("Invalid decrypted command")

    envelope_id = str(envelope.get("id", "")).strip()
    if not envelope_id or command.get("commandId") != envelope_id:
        raise ValueError("Command id mismatch")
    issued = int(command.get("issuedAtMs") or 0)
    now = int(time.time() * 1000)
    if issued <= 0 or issued > now + 5 * 60 * 1000 or now - issued > MAX_COMMAND_AGE_MS:
        raise ValueError("Bridge command is expired or has an invalid timestamp")
    return command


def clean_text(value, limit: int) -> str:
    text = " ".join(str(value or "").split())
    return text[:limit]


def validate_task(raw) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("task must be an object")
    task_id = clean_text(raw.get("id"), 120)
    if not task_id or not re.fullmatch(r"[A-Za-z0-9._:-]{1,120}", task_id):
        raise ValueError("task id must use only letters, numbers, . _ : -")
    title = clean_text(raw.get("title"), 160)
    if not title:
        raise ValueError("task title is required")
    area = clean_text(raw.get("area") or "Personal", 60)
    note = str(raw.get("note") or "").strip()[:1200]
    source_key = clean_text(raw.get("sourceKey"), 180)
    due = clean_text(raw.get("due"), 40)
    try:
        minutes = max(0, min(480, int(raw.get("minutes") or 0)))
    except Exception:
        minutes = 0

    task = {
        "id": task_id,
        "title": title,
        "area": area,
        "minutes": minutes,
        "note": note,
        "done": False,
        "source": "chatgpt-gmail",
    }
    if source_key:
        task["sourceKey"] = source_key
    if due:
        task["due"] = due
    priority = clean_text(raw.get("priority"), 20)
    if priority:
        task["priority"] = priority
    return task


def existing_task_for(task: dict, existing: list):
    task_id = task.get("id")
    source_key = task.get("sourceKey")
    for item in existing:
        if not isinstance(item, dict):
            continue
        if task_id and str(item.get("id", "")) == task_id:
            return item
        if source_key and str(item.get("sourceKey", "")) == source_key:
            return item
    return None


def run_command(command: dict):
    if command.get("op") != "upsert_task":
        raise ValueError("Only upsert_task is allowed through the ChatGPT write bridge")
    task = validate_task(command.get("task") or {})
    current = request("GET", "/api/tasks") or []
    if not isinstance(current, list):
        current = []
    found = existing_task_for(task, current)
    if found:
        existing_id = clean_text(found.get("id"), 120)
        if not existing_id:
            raise ValueError("Existing matching task has no id")
        task["id"] = existing_id
        request("PATCH", "/api/tasks/" + urllib.parse.quote(existing_id, safe=""), task)
        print("Updated HOME task", existing_id)
    else:
        request("POST", "/api/tasks", task)
        print("Created HOME task", task["id"])


def load_queue() -> dict:
    if not QUEUE.exists():
        return {"version": 2, "commands": []}
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    if isinstance(data, list):
        if data:
            raise ValueError("Refusing legacy plaintext commands in public GitHub")
        return {"version": 2, "commands": []}
    if not isinstance(data, dict):
        raise ValueError("queue.json must be an object")
    commands = data.get("commands") or []
    if not isinstance(commands, list):
        raise ValueError("commands must be an array")
    if int(data.get("version") or 0) < 2 and commands:
        raise ValueError("Refusing legacy plaintext commands in public GitHub")
    data["version"] = 2
    data["commands"] = commands
    return data


def main():
    private_key = derive_private_key()
    key_changed = ensure_public_key(private_key)
    data = load_queue()
    commands = data.get("commands", [])
    remaining = []
    completed = 0

    for envelope in commands:
        try:
            command = decrypt_envelope(private_key, envelope)
            run_command(command)
            completed += 1
        except Exception as exc:
            remaining.append(envelope)
            print(f"Command failed: {exc}", file=sys.stderr)

    queue_changed = False
    if int(data.get("version") or 0) != 2 or data.get("commands") != remaining:
        data["version"] = 2
        data["commands"] = remaining
        queue_changed = True
    if completed:
        data["lastProcessedCount"] = completed
        data["lastProcessedAtMs"] = int(time.time() * 1000)
        queue_changed = True

    rendered = json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    current = QUEUE.read_text(encoding="utf-8") if QUEUE.exists() else ""
    if current != rendered:
        QUEUE.write_text(rendered, encoding="utf-8")
        queue_changed = True

    if completed:
        print(f"Processed {completed} encrypted HOME command(s).")
    elif not commands:
        print("No queued HOME commands. Bridge key is ready.")
    else:
        print("No HOME commands processed.")

    # Key/queue mutations are committed by the workflow after this script exits.
    if remaining:
        sys.exit(1)
    if key_changed or queue_changed:
        return


if __name__ == "__main__":
    main()
