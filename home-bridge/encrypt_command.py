#!/usr/bin/env python3
"""Encrypt one HOME bridge command using the public X25519 key.

Usage:
  python home-bridge/encrypt_command.py command.json

The output is a single encrypted envelope safe to store in the public queue.json.
This helper never needs HOME_TOKEN or any private key.
"""
import base64
import json
import os
import sys
import time
import uuid
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

ROOT = Path(__file__).resolve().parent
PUBLIC_KEY = ROOT / "public_key.json"
AAD = b"HOME-BRIDGE-V2"
COMMAND_INFO = b"HOME-Bridge-v2-command"


def b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64d(text: str) -> bytes:
    clean = str(text or "").strip()
    return base64.urlsafe_b64decode(clean + "=" * ((4 - len(clean) % 4) % 4))


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: encrypt_command.py command.json")
    if not PUBLIC_KEY.exists():
        raise SystemExit("home-bridge/public_key.json is not ready yet. Run HOME Command Bridge once first.")

    public_meta = json.loads(PUBLIC_KEY.read_text(encoding="utf-8"))
    recipient = X25519PublicKey.from_public_bytes(b64d(public_meta["publicKey"]))
    command = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not isinstance(command, dict):
        raise SystemExit("Command must be a JSON object")

    command_id = str(command.get("commandId") or ("cmd-" + uuid.uuid4().hex))
    command["commandId"] = command_id
    command["version"] = 2
    command.setdefault("issuedAtMs", int(time.time() * 1000))

    ephemeral = X25519PrivateKey.generate()
    epk = ephemeral.public_key().public_bytes_raw()
    salt = os.urandom(16)
    nonce = os.urandom(12)
    shared = ephemeral.exchange(recipient)
    aes_key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=COMMAND_INFO,
    ).derive(shared)
    plaintext = json.dumps(command, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ciphertext = AESGCM(aes_key).encrypt(nonce, plaintext, AAD)

    envelope = {
        "id": command_id,
        "v": 2,
        "alg": "X25519-HKDF-SHA256+A256GCM",
        "ephemeralPublicKey": b64e(epk),
        "salt": b64e(salt),
        "nonce": b64e(nonce),
        "ciphertext": b64e(ciphertext),
    }
    print(json.dumps(envelope, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
