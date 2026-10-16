#!/usr/bin/env python3
"""Bound worker proxy startup until its remote catalog and required routes exist.

No inference, authentication refresh, or secret output. Installed with the
adjacent user-service drop-in. A failed check lets systemd retry startup.
"""
import json
import pathlib
import sys
import time
import urllib.request

CATALOGS = (
    "https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json",
    "https://models.router-for.me/models.json",
)
REQUIRED = {"gpt-6.1-sol", "grok-4.7", "claude-fable-5-1", "muse-wonder-1.0"}


def check(mode):
    if mode == "network":
        for url in CATALOGS:
            try:
                with urllib.request.urlopen(url, timeout=5) as response:
                    data = json.load(response)
                if any(x.get("id") == "muse-wonder-1.0" for x in data.get("meta", [])):
                    return True
            except (OSError, ValueError):
                pass
        return False
    token = (pathlib.Path.home() / ".cli-proxy-api/client-token").read_text().strip()
    request = urllib.request.Request(
        "http://127.0.0.1:8317/v1/models",
        headers={"Authorization": "Bearer " + token},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        data = json.load(response)
    return REQUIRED <= {x.get("id") for x in data.get("data", [])}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"network", "registered"}:
        return 2
    mode = sys.argv[1]
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            if check(mode):
                print("CLIProxyAPI startup check passed: " + mode, flush=True)
                return 0
        except (OSError, ValueError):
            pass
        time.sleep(2)
    print("CLIProxyAPI startup check timed out: " + mode, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
