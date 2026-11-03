"""Observe Linux permission-sensitive hashes without executing task bodies.

Use --output for a new compact report and --raw-dir for a new private capture
directory. The pinned clients run sequential, offline dry runs in disposable
fixtures. Regular-file invariants are asserted; alias behavior is recorded
without claiming portability, output restoration or repository qualification.
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
import stat
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
parser.add_argument("--raw-dir", type=Path, required=True)
args = parser.parse_args()
for path in (args.output, args.raw_dir):
    assert not path.exists() and not path.is_symlink(), "Existing captures are refused."
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
start = time.monotonic()
capture = {
    "time": time, "os": os, "selectors": selectors,
    "signal": signal, "subprocess": subprocess, "start": start,
}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(harness), "exec"), capture)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


driver = Path(__file__).resolve()
captured = {driver: driver.read_bytes(), pins_path: pins_bytes, harness: harness_bytes}
bindings = [
    {"path": str(path.relative_to(repo)), "sha256": hashlib.sha256(data).hexdigest()}
    for path, data in captured.items()
]
for binding in bindings:
    assert sha(repo / binding["path"]) == binding["sha256"], "Source changed before observation."
clients = {
    "stable": repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo",
}
for channel, binary in clients.items():
    assert sha(binary) == pins[channel]["sha256"], "Native client pin changed."
args.raw_dir.mkdir(mode=0o700)
cache = Path.home() / ".cache/beep/turbo-permission-mode-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
rows = []
groups = []
raw_bytes = 0
marker = "printf executed > executed.txt; exit 37"
cases = [
    ("base", 0o644, b"fixed input\n", None),
    ("owner-only", 0o600, b"fixed input\n", None),
    ("owner-executable", 0o744, b"fixed input\n", None),
    ("group-executable", 0o654, b"fixed input\n", None),
    ("other-executable", 0o645, b"fixed input\n", None),
    ("all-executable", 0o755, b"fixed input\n", None),
    ("content-changed", 0o644, b"changed input\n", None),
    ("symlink", 0o644, None, "target.txt"),
    ("symlink-target-executable", 0o755, None, "target.txt"),
    ("symlink-different-target", 0o644, None, "other-target.txt"),
    ("base-again", 0o644, b"fixed input\n", None),
]
for channel, binary in clients.items():
    for shape in ("non-git", "unstaged-git", "staged-git"):
        # Stable rejects the canary-only key even when explicitly false.
        for enabled in ([None] if channel == "stable" else [None, False, True]):
            with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as temporary:
                root = Path(temporary)
                (root / "home").mkdir(mode=0o700)
                (root / "cache").mkdir(mode=0o700)
                environment = {
                    "PATH": "/usr/bin:/bin", "HOME": str(root / "home"),
                    "XDG_CACHE_HOME": str(root / "cache"), "CI": "1",
                    "TURBO_TELEMETRY_DISABLED": "1", "TURBO_DAEMON": "false",
                    "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
                }
                (root / "package.json").write_text(json.dumps({
                    "name": "beep-permission-mode-fixture", "version": "0.0.0",
                    "packageManager": "bun@1.4.4", "scripts": {"probe": marker},
                }) + "\n")
                config = {"tasks": {"probe": {"cache": False, "inputs": ["input.txt"], "outputs": []}}}
                if enabled is not None:
                    config["futureFlags"] = {"hashFilePermissions": enabled}
                (root / "turbo.json").write_text(json.dumps(config) + "\n")
                for name in ("input.txt", "target.txt", "other-target.txt"):
                    (root / name).write_bytes(b"fixed input\n")
                    (root / name).chmod(0o644)

                def git(*argv):
                    result = subprocess.run(
                        ["git", *argv], cwd=root, env=environment,
                        capture_output=True, timeout=5,
                    )
                    assert result.returncode == 0, "Owned fixture Git operation failed."

                if shape != "non-git":
                    git("-c", "init.defaultBranch=main", "init", "-q")
                    git("config", "core.filemode", "true")
                    git("add", "package.json", "turbo.json", "input.txt", "target.txt", "other-target.txt")
                    git("-c", "user.name=Synthetic Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture baseline")
                hashes = {}
                represented = {}
                for case, mode, content, target in cases:
                    file = root / "input.txt"
                    file.unlink()
                    if target is None:
                        file.write_bytes(content)
                        file.chmod(mode)
                    else:
                        (root / target).chmod(mode)
                        file.symlink_to(target)
                    assert stat.S_IMODE(file.stat().st_mode) == mode, "Fixture mode was not applied."
                    if shape == "staged-git":
                        git("add", "input.txt", "target.txt", "other-target.txt")
                    remaining = 180 - (time.monotonic() - start)
                    assert remaining > 0, "Whole observation exceeded its time bound."
                    capture["command"] = [
                        "--signal=KILL", f"{min(20, remaining):.6f}s", str(binary),
                        "--skip-infer", "run", "probe", "--single-package", "--dry-run=json",
                        "--cache=local:r", "--concurrency=1", "--env-mode=strict",
                    ]
                    code, stdout, stderr = capture["run_bounded"]("/usr/bin/timeout", root, environment)
                    raw_bytes += len(stdout) + len(stderr)
                    assert raw_bytes <= 16 * 1024 * 1024, "Aggregate native capture exceeded its bound."
                    number = len(rows)
                    (args.raw_dir / f"{number:03}.stdout").write_bytes(stdout)
                    (args.raw_dir / f"{number:03}.stderr").write_bytes(stderr)
                    assert code == 0 and not (root / "executed.txt").exists(), "Dry run failed or sentinel executed."
                    tasks = json.loads(stdout)["tasks"]
                    assert len(tasks) == 1 and tasks[0]["command"] == marker
                    represented[case] = "input.txt" in tasks[0]["inputs"]
                    if target is None:
                        assert represented[case], "Required regular-file input was omitted."
                    task_hash = tasks[0]["hash"]
                    assert re.fullmatch(r"[0-9a-f]{16,64}", task_hash)
                    hashes[case] = task_hash
                    rows.append({
                        "channel": channel, "shape": shape, "flag": enabled, "case": case,
                        "inputMode": oct(mode), "inputKind": "symlink" if target else "regular",
                        "taskHash": task_hash, "inputRepresented": represented[case],
                        "inputHash": tasks[0]["inputs"].get("input.txt"),
                        "stdoutSha256": hashlib.sha256(stdout).hexdigest(),
                        "stderrSha256": hashlib.sha256(stderr).hexdigest(), "sentinelExecuted": False,
                    })
                assert hashes["base"] == hashes["owner-only"] == hashes["base-again"]
                executable = {hashes[name] for name in (
                    "owner-executable", "group-executable", "other-executable", "all-executable",
                )}
                assert len(executable) == 1, "Executable-bit classes differed."
                assert (hashes["base"] not in executable) == (enabled is True)
                assert hashes["content-changed"] != hashes["base"]
                # Alias differences remain observations, not required invariants.
                groups.append({
                    "channel": channel, "shape": shape, "flag": enabled,
                    "regularExecutableBitChangesHash": hashes["base"] not in executable,
                    "nonExecutableModeChangesHash": hashes["base"] != hashes["owner-only"],
                    "symlinkIncluded": represented["symlink"],
                    "symlinkTargetModeChangesHash": hashes["symlink"] != hashes["symlink-target-executable"],
                    "symlinkDifferentTargetChangesHash": hashes["symlink"] != hashes["symlink-different-target"],
                })
assert len(rows) == 132 and time.monotonic() - start < 180
for binding in bindings:
    assert sha(repo / binding["path"]) == binding["sha256"], "Source changed during observation."
for channel, binary in clients.items():
    assert sha(binary) == pins[channel]["sha256"], "Native client changed during observation."
report = {
    "schemaVersion": "cache-permission-mode-native-observation/v1",
    "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "authority": "Synthetic Linux regular-file hash invariants only; aliases are observations. No Windows, output restoration, real computation qualification, activation or performance proof.",
    "sourceState": "working-tree-bound", "sourceBindings": bindings,
    "clients": {channel: {key: pins[channel][key] for key in ("reportedVersion", "sha256")} for channel in clients},
    "rows": rows, "groups": groups, "cases": len(rows),
    "durationSeconds": round(time.monotonic() - start, 3), "tasksExecuted": 0,
    "ownedFixturesRemoved": True, "rawBytes": raw_bytes,
    "bounds": {"seconds": 180, "perProcessSeconds": 20, "maximumProcesses": 132, "rawBytes": 16777216, "sequential": True},
    "unrepresentedInputs": [
        {key: row[key] for key in ("channel", "shape", "flag", "case")}
        for row in rows if not row["inputRepresented"]
    ],
    "productionChanged": False, "taskQualificationGranted": False,
}
with args.output.open("x") as handle:
    handle.write(json.dumps(report, indent=2) + "\n")
print(json.dumps({
    "state": "regular-mode-invariants-observed-alias-qualification-open",
    "cases": len(rows), "taskBodiesExecuted": 0, "seconds": report["durationSeconds"],
    "unrepresentedInputs": len(report["unrepresentedInputs"]), "productionChanged": False,
}))
