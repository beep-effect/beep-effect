"""Observe key-length enforcement on pinned Turbo clients in isolated fixtures.

All keys and bearer values are synthetic. Only a disposable fixture and pinned
executables enter the network-isolated child. This tests native configuration
behavior, not signed artifact transport, production authorization or task reuse.
"""

import argparse
import ast
import datetime
import hashlib
import json
import os
import selectors
import signal
import subprocess
import tempfile
import time
from pathlib import Path

if not __debug__:
    raise SystemExit("Assertion checks are required.")
os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--pins", type=Path)
parser.add_argument("--stable", type=Path)
args = parser.parse_args()
assert not args.output.exists(), "Existing reports are refused."
repo = Path(__file__).resolve().parents[3]
research = Path(__file__).parent
pins_path = args.pins or research / "errors-only-client-pins.json"
pins = json.loads(pins_path.read_text())
harness = research / "native-future-flag-availability.py"
function = next(
    x for x in ast.parse(harness.read_text()).body
    if isinstance(x, ast.FunctionDef) and x.name == "run_bounded"
)
capture = {
    "time": time, "os": os, "selectors": selectors,
    "signal": signal, "subprocess": subprocess, "start": time.monotonic(),
}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(harness), "exec"), capture)
clients = {
    "stable": args.stable or repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients"
    / pins["canary"]["packageVersion"] / "turbo",
}
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
for channel, binary in clients.items():
    assert sha(binary) == pins[channel]["sha256"], "Native client pin changed."
bun = Path(subprocess.check_output(
    ["bun", "--no-env-file", "-p", "process.execPath"], cwd=repo, text=True, timeout=5,
).strip())
bun_version = subprocess.check_output([str(bun), "--version"], text=True, timeout=5).strip()
assert bun_version == (repo / ".bun-version").read_text().strip()
source_paths = [Path(__file__).resolve(), pins_path.resolve(), harness]
before_sources = {str(p.relative_to(repo)): sha(p) for p in source_paths}
tools = {"bun": sha(bun), "bwrap": sha(Path("/usr/bin/bwrap")),
         **{channel: sha(binary) for channel, binary in clients.items()}}
base = repo / ".beep/signature-key-native-controls"
base.mkdir(parents=True, exist_ok=True, mode=0o700)
raw = Path(tempfile.mkdtemp(prefix="raw-", dir=base))
cache = Path.home() / ".cache/beep/turbo-signature-key-controls"
cache.mkdir(parents=True, exist_ok=True, mode=0o700)
keys = {
    "missing": None,
    "empty": "",
    "ascii31": "x" * 31,
    "ascii32": "x" * 32,
    "utf8-31": "é" * 15 + "x",
    "utf8-32": "é" * 16,
    "ascii64": "x" * 64,
}
rows = []
for channel, binary in clients.items():
    with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as temporary:
        root = Path(temporary)
        (root / "package.json").write_text(json.dumps({
            "name": "beep-signature-key-fixture", "version": "0.0.0",
            "packageManager": "bun@" + bun_version,
            "scripts": {"probe": "printf executed > sentinel"},
        }) + "\n")
        package_sha = sha(root / "package.json")
        mount = [
            "--unshare-all", "--die-with-parent", "--new-session",
            "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib",
            "--symlink", "usr/lib", "/lib64", "--symlink", "usr/bin", "/bin",
            "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--dir", "/tools",
            "--ro-bind", str(binary), "/tools/turbo", "--ro-bind", str(bun), "/tools/bun",
            "--bind", str(root), "/fixture", "--chdir", "/fixture", "--",
        ]
        environment = {
            "PATH": "/tools:/usr/bin", "HOME": "/tmp", "CI": "1",
            "TURBO_TELEMETRY_DISABLED": "1",
        }
        capture["command"] = mount + ["/tools/turbo", "--skip-infer", "--version"]
        code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
        assert code == 0 and out.decode().strip() == pins[channel]["reportedVersion"] and not err
        capture["command"] = mount + ["/tools/bun", "--version"]
        code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
        assert code == 0 and out.decode().strip() == bun_version and not err
        for mode in ["local", "remote"]:
            for flag in ["absent", "false", "true"]:
                for signature in [False, True]:
                    for key_name, key in keys.items():
                        config = {
                            "remoteCache": {"signature": signature},
                            "tasks": {"probe": {"outputs": ["sentinel"]}},
                        }
                        if flag != "absent":
                            config["futureFlags"] = {"longerSignatureKey": flag == "true"}
                        config_path = root / "turbo.json"
                        config_path.write_text(json.dumps(config) + "\n")
                        config_sha = sha(config_path)
                        sentinel = root / "sentinel"
                        if sentinel.exists():
                            sentinel.unlink()
                        env = dict(environment)
                        if key is not None:
                            env["TURBO_REMOTE_CACHE_SIGNATURE_KEY"] = key
                        if mode == "remote":
                            env.update({"TURBO_TOKEN": "synthetic-token",
                                        "TURBO_TEAM": "team_synthetic",
                                        "TURBO_API": "http://127.0.0.1:9"})
                        index = len(rows)
                        capture["command"] = mount + [
                            "/tools/turbo", "--skip-infer", "--no-update-notifier", "run",
                            "probe", "--single-package", "--cache=" + mode + ":rw",
                            "--cache-dir=.turbo/case-" + str(index),
                            "--env-mode=strict", "--concurrency=1",
                        ]
                        code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, env)
                        name = channel + "-" + str(index)
                        (raw / (name + ".stdout")).write_bytes(out)
                        (raw / (name + ".stderr")).write_bytes(err)
                        text = out + b"\n" + err
                        key_bytes = None if key is None else len(key.encode())
                        rejected = (mode == "remote" and flag == "true" and signature
                                    and key is not None and key_bytes < 32)
                        if rejected:
                            assert code == 1 and not sentinel.exists() and b"too short" in err, (
                                channel, mode, flag, signature, key_name, "length refusal")
                            assert (str(key_bytes) + " bytes").encode() in err
                            classification = "provided-key-too-short-before-task"
                        else:
                            assert code == 0 and sentinel.read_text() == "executed", (
                                channel, mode, flag, signature, key_name, "expected execution")
                            assert b"cache hit" not in out
                            classification = "task-executed"
                        assert sha(config_path) == config_sha and sha(root / "package.json") == package_sha
                        assert b"synthetic-token" not in text
                        if key is not None and len(key.encode()) >= 31:
                            assert key.encode() not in text, "Synthetic artifact key leaked."
                        rows.append({
                            "channel": channel, "mode": mode, "flag": flag,
                            "signature": signature, "keyCase": key_name, "keyBytes": key_bytes,
                            "keyCharacters": None if key is None else len(key),
                            "exit": code, "classification": classification,
                            "sentinelExecuted": sentinel.exists(), "cacheHit": False,
                            "configurationUnchanged": True, "syntheticValuesNotLogged": True,
                            "signatureWarning": b"artifact signature error" in err,
                            "shortKeyWarning": b"too short" in err,
                            "stdoutSha256": hashlib.sha256(out).hexdigest(),
                            "stderrSha256": hashlib.sha256(err).hexdigest(),
                        })
assert before_sources == {str(p.relative_to(repo)): sha(p) for p in source_paths}
assert tools == {"bun": sha(bun), "bwrap": sha(Path("/usr/bin/bwrap")),
                 **{channel: sha(binary) for channel, binary in clients.items()}}
assert len(rows) == 168
report = {
    "schemaVersion": "cache-signature-key-native-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "authority": "Synthetic native key-length behavior only; no real cache transport or qualification.",
    "sourceRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip(),
    "sourceBindings": [{"path": path, "sha256": digest} for path, digest in before_sources.items()],
    "toolSha256": tools, "bunVersion": bun_version,
    "clients": {c: {k: pins[c][k] for k in ["reportedVersion", "sha256"]} for c in clients},
    "captureLimits": {"wholeSeconds": 600, "perCaseSeconds": 20,
                      "stdoutBytes": 1048576, "stderrBytes": 65536},
    "networkIsolated": True, "onlySyntheticCredentials": True,
    "repositoryNotMounted": True, "sourceAndToolsUnchanged": True,
    "cases": len(rows), "rows": rows,
    "limits": ["Remote endpoint intentionally unavailable inside isolated networking.",
               "Task success with absent key is not successful signed artifact reuse.",
               "The length flag does not replace Beep missing-key role policy."],
}
with args.output.open("x") as output:
    json.dump(report, output, indent=2)
    output.write("\n")
print(json.dumps({"cases": len(rows), "complete": True, "output": str(args.output)}))
