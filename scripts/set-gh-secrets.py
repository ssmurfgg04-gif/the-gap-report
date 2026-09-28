#!/usr/bin/env python3.13
"""Set GitHub Actions repo secrets for the KAMPS weekly pipeline.

Encrypts each secret with the repo public key (libsodium sealed box) and
PUTs it via the GitHub API. Values are read from the local .env file,
never from the command line.
"""
import json
import sys
import urllib.request
from pathlib import Path

from nacl import encoding, public

PAT = Path("/tmp/.pat").read_text().strip()
REPO = "ssmurfgg04-gif/the-gap-report"

ENV = {}
for line in Path("/home/z/my-project/.env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        ENV[k.strip()] = v.strip()

WANT = {
    "ACLED_EMAIL": ENV.get("ACLED_EMAIL", ""),
    "ACLED_PASSWORD": ENV.get("ACLED_PASSWORD", ""),
    "RELIEFWEB_APPNAME": ENV.get("RELIEFWEB_APPNAME", ""),
    # Partner webhook for the weekly digest ping: one URL or several,
    # comma-separated. Slack (hooks.slack.com/...), Discord
    # (discord.com/api/webhooks/...) and generic JSON receivers are
    # auto-detected. Force a format on an unusual URL by appending
    # #slack / #discord / #json to it.
    "DIGEST_WEBHOOK_URL": ENV.get("DIGEST_WEBHOOK_URL", ""),
}

def api(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={
        "Authorization": f"Bearer {PAT}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

# 1. repo public key
status, key = api("GET", f"https://api.github.com/repos/{REPO}/actions/secrets/public-key")
if status != 200:
    print("public-key failed:", status, key)
    sys.exit(1)
print(f"public key: id {key['key_id']}")

pk = public.PublicKey(key["key"], encoding.Base64Encoder())
sealed = public.SealedBox(pk)

# 2. put each secret
for name, value in WANT.items():
    if not value:
        print(f"{name}: empty in .env, skipped")
        continue
    enc = sealed.encrypt(value.encode())
    status, resp = api("PUT", f"https://api.github.com/repos/{REPO}/actions/secrets/{name}", {
        "encrypted_value": encoding.Base64Encoder.encode(enc).decode(),
        "key_id": key["key_id"],
    })
    print(f"{name}: HTTP {status} {'OK' if status in (201, 204) else resp}")
    if status not in (201, 204):
        sys.exit(2)
print("done")
