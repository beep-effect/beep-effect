"""Observe canary-only permission-hash configuration without executing tasks.

Run with Python 3 and --output pointing to a new compact report. Reuses the
existing bounded native collector. This proves parsing only; file-mode hashing,
cross-platform semantics and repository adoption remain separate obligations.
"""

import argparse
import ast
import datetime
import hashlib
import json
import os
import re
import selectors
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

if not __debug__:
    raise SystemExit("Assertion checks are required before native execution.")
assert sys.platform == "linux", "This observation requires Linux native clients."
os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
assert not args.output.exists() and not args.output.is_symlink(), "Existing reports are refused."
repo = Path(__file__).resolve().parents[3]
research = Path(__file__).resolve().parent
pins_path = research / "current-client-pins.json"
pins_bytes = pins_path.read_bytes()
pins = json.loads(pins_bytes)
harness = research / "native-future-flag-availability.py"
harness_bytes = harness.read_bytes()
function = next(
    node for node in ast.parse(harness_bytes).body
    if isinstance(node, ast.FunctionDef) and node.name == "run_bounded"
)
capture = {
    "time": time, "os": os, "selectors": selectors,
    "signal": signal, "subprocess": subprocess, "start": time.monotonic(),
    "command": ["--skip-infer", "run", "probe", "--single-package",
                "--dry-run=json", "--cache=local:r", "--concurrency=1", "--env-mode=strict"],
}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(harness), "exec"), capture)
driver = Path(__file__).resolve()
captured = {driver: driver.read_bytes(), pins_path: pins_bytes, harness: harness_bytes}
bindings = [
    {"path": path.relative_to(repo).as_posix(), "sha256": hashlib.sha256(data).hexdigest()}
    for path, data in captured.items()
]
for binding in bindings:
    assert hashlib.sha256((repo / binding["path"]).read_bytes()).hexdigest() == binding["sha256"], "Source changed before observation."
clients = {
    "stable": repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo",
}
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native client pin changed."
cache = Path.home() / ".cache/beep/turbo-permission-availability"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
marker = "printf executed > executed.txt; exit 37"
rows = []
for channel, binary in clients.items():
    with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as temporary:
        root = Path(temporary)
        (root / "home").mkdir(mode=0o700)
        (root / "cache").mkdir(mode=0o700)
        (root / "package.json").write_text(json.dumps({
            "name": "beep-permission-availability", "version": "0.0.0",
            "packageManager": "bun@1.4.4", "scripts": {"probe": marker},
        }) + "\n")
        environment = {
            "PATH": "/usr/bin:/bin", "HOME": str(root / "home"),
            "XDG_CACHE_HOME": str(root / "cache"), "CI": "1",
            "TURBO_TELEMETRY_DISABLED": "1", "TURBO_DAEMON": "false",
        }
        for enabled in (False, True):
            (root / "turbo.json").write_text(json.dumps({
                "futureFlags": {"hashFilePermissions": enabled},
                "tasks": {"probe": {"cache": False, "outputs": []}},
            }) + "\n")
            code, stdout, stderr = capture["run_bounded"](binary, root, environment)
            assert not (root / "executed.txt").exists(), "Dry run executed its sentinel."
            if channel == "stable":
                text = (stdout + b"\n" + stderr).decode("utf-8", errors="replace")
                assert code != 0 and "hashFilePermissions" in text
                assert re.search(r"(?i)unknown key|unrecognized key|unknown field", text)
                classification = "configuration-key-rejected"
                task_count = 0
            else:
                assert code == 0
                tasks = json.loads(stdout)["tasks"]
                assert len(tasks) == 1 and tasks[0]["command"] == marker
                classification = "dry-run-accepted"
                task_count = 1
            rows.append({
                "channel": channel, "enabled": enabled, "exit": code,
                "classification": classification, "dryRunTaskCount": task_count,
                "sentinelExecuted": False,
                "stdoutSha256": hashlib.sha256(stdout).hexdigest(),
                "stderrSha256": hashlib.sha256(stderr).hexdigest(),
            })
assert len(rows) == 4
for source in bindings:
    assert hashlib.sha256((repo / source["path"]).read_bytes()).hexdigest() == source["sha256"], "Source changed during observation."
report = {
    "schemaVersion": "cache-permission-flag-native-availability/v1",
    "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "authority": "Native configuration parsing only; no mode-hash semantics, task qualification, activation or performance claim.",
    "sourceState": "working-tree-bound", "sourceBindings": bindings,
    "clients": {channel: {key: pins[channel][key] for key in ("reportedVersion", "sha256")} for channel in clients},
    "rows": rows, "tasksExecuted": 0, "ownedFixturesRemoved": True,
    "bounds": {"perProcessSeconds": 20, "maximumProcesses": 4, "stdoutBytes": 1048576, "stderrBytes": 65536, "sequential": True},
    "productionChanged": False,
}
with args.output.open("x") as handle:
    handle.write(json.dumps(report, indent=2) + "\n")
print("Four bounded dry-run cases passed; stable refused the flag and canary accepted it. No task executed.")
