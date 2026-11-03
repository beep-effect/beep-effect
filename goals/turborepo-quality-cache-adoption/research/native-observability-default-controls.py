"""Check pinned Turbo observability defaults in bounded offline fixtures.

No repository task, collector, credential or remote cache is used. The existing
streaming collector owns deadlines, byte bounds and child-group cleanup. These
controls do not certify an enabled exporter's payload or production safety.
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
import sys
import tempfile
import time
from pathlib import Path

if sys.flags.optimize:
    raise SystemExit("Observability controls require assertions; optimized execution is refused.")
assert sys.platform == "linux", "Native controls require Linux"
os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--stable", type=Path)
args = parser.parse_args()
assert not args.output.exists(), "Existing reports are refused"
repo = Path(__file__).resolve().parents[3]
research = Path(__file__).resolve().parent
source_reader = research / "native-future-flag-availability.py"
source_reader_bytes = source_reader.read_bytes()
source_reader_node = next(n for n in ast.parse(source_reader_bytes).body
                          if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
source_reader_namespace = {"os": os}
exec(compile(ast.Module(body=[source_reader_node], type_ignores=[]), str(source_reader), "exec"), source_reader_namespace)
read_contained_source = source_reader_namespace["read_contained_source"]
shared = research / "native-future-flag-availability.py"
pin_file = research / "errors-only-client-pins.json"
sources = [
    Path(__file__).resolve(), shared, pin_file, repo / ".bun-version",
    repo / "turbo.json", repo / "node_modules/turbo/docs/reference/configuration.mdx",
]
snapshots = {path: (source_reader_bytes if path == source_reader else read_contained_source(path, repo) if path == pin_file else path.read_bytes()) for path in sources}
pins = json.loads(snapshots[pin_file])
helper = next(n for n in ast.parse(snapshots[shared]).body if isinstance(n, ast.FunctionDef) and n.name == "run_bounded")
ns = dict(time=time, os=os, selectors=selectors, signal=signal, subprocess=subprocess, start=time.monotonic())
exec(compile(ast.Module(body=[helper], type_ignores=[]), str(shared), "exec"), ns)


def invoke(argv, root, env):
    ns["command"] = argv[1:]
    return ns["run_bounded"](argv[0], root, env)


assert all((read_contained_source(path, repo) if path == pin_file else path.read_bytes()) == data for path, data in snapshots.items()), "Observation sources changed before probes."
bun = Path(subprocess.check_output(["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5).strip())
bun_version = subprocess.check_output([str(bun), "--version"], text=True, timeout=5).strip()
assert bun_version == snapshots[repo / ".bun-version"].decode().strip(), "Bun pin changed"
tools = {"bun": bun, "bwrap": Path("/usr/bin/bwrap")}
tool_hashes = {k: hashlib.sha256(p.read_bytes()).hexdigest() for k, p in tools.items()}
clients = {
    "stable": args.stable or repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo",
}
cache = Path.home() / ".cache/beep/turbo-observability-default-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
cases = [
    ("omitted-default", None, "none", None, True),
    ("explicit-disabled-default", False, "none", None, True),
    ("enabled-flag-without-exporter", True, "none", None, True),
    ("explicit-disabled-file-exporter", True, "file", False, True),
    ("omitted-flag-ignores-file-exporter", None, "file", True, True),
    ("disabled-flag-ignores-file-exporter", False, "file", True, True),
    ("omitted-flag-refuses-env-exporter", None, "environment", True, False),
    ("disabled-flag-refuses-env-exporter", False, "environment", True, False),
    ("omitted-flag-refuses-cli-exporter", None, "cli", True, False),
    ("disabled-flag-refuses-cli-exporter", False, "cli", True, False),
    ("explicit-disabled-env-exporter", True, "environment", False, True),
    ("explicit-disabled-cli-exporter", True, "cli", False, True),
]
rows = []
observed_versions = {}
synthetic_header = "SYNTHETIC_OTEL_HEADER_NOT_A_CREDENTIAL"
synthetic_bearer = "SYNTHETIC_CACHE_BEARER_NOT_A_CREDENTIAL"
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native client pin changed"
    with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as name:
        root = Path(name)
        (root / "home").mkdir()
        (root / "task.mjs").write_text('import fs from "node:fs"; fs.appendFileSync("execution.marker", "ran\\n"); console.log("TASK_OK");\n')
        (root / "package.json").write_text(json.dumps({
            "name": "observability-default-controls", "version": "0.0.0",
            "packageManager": "bun@" + bun_version,
            "scripts": {"probe": "bun --no-env-file ./task.mjs"},
        }))
        env = {"PATH": "/usr/bin:/bin", "HOME": str(root / "home"), "TURBO_TELEMETRY_DISABLED": "1", "NO_COLOR": "1"}
        launch = [
            "/usr/bin/bwrap", "--unshare-all", "--die-with-parent", "--new-session",
            "--ro-bind", "/usr/lib", "/usr/lib", "--symlink", "usr/lib", "/lib",
            "--symlink", "usr/lib", "/lib64", "--dir", "/bin", "--ro-bind", "/usr/bin/bash", "/bin/sh",
            "--dir", "/tools", "--ro-bind", str(binary.resolve()), "/tools/turbo",
            "--ro-bind", str(bun), "/tools/bun", "--bind", str(root), "/work",
            "--tmpfs", "/tmp", "--dir", "/etc", "--dir", "/home", "--dir", "/home/probe",
            "--dev", "/dev", "--proc", "/proc", "--chdir", "/work", "--clearenv",
            "--setenv", "PATH", "/tools", "--setenv", "HOME", "/home/probe",
            "--setenv", "CI", "1", "--setenv", "NO_COLOR", "1",
            "--setenv", "TURBO_TELEMETRY_DISABLED", "1", "--setenv", "TOKIO_WORKER_THREADS", "2",
        ]
        code, out, err = invoke([*launch, "/tools/turbo", "--skip-infer", "--version"], root, env)
        assert code == 0 and out.decode().strip() == pins[channel]["reportedVersion"], "Native version changed"
        observed_versions[channel] = out.decode().strip()
        for case, flag, location, enabled, expect_task in cases:
            flags = {"globalConfiguration": True}
            if flag is not None:
                flags["experimentalObservability"] = flag
            global_config = {"remoteCache": {"enabled": False}}
            if location == "file":
                global_config["experimentalObservability"] = {"otel": {
                    "enabled": enabled, "protocol": "http/protobuf",
                    "endpoint": "https://telemetry.invalid:4318",
                    "headers": {"X-Offline-Probe": synthetic_header},
                    "useRemoteCacheToken": True,
                }}
            (root / "turbo.json").write_text(json.dumps({
                "futureFlags": flags, "global": global_config,
                "tasks": {"probe": {"cache": False, "outputs": []}},
            }))
            marker = root / "execution.marker"
            before = marker.read_text().count("ran\n") if marker.exists() else 0
            extra_environment = []
            extra_arguments = []
            if location == "environment":
                for key, value in {
                    "TURBO_EXPERIMENTAL_OTEL_ENABLED": str(enabled).lower(),
                    "TURBO_EXPERIMENTAL_OTEL_ENDPOINT": "https://telemetry.invalid:4318",
                }.items():
                    extra_environment.extend(["--setenv", key, value])
            if location == "cli":
                extra_arguments = ["--experimental-otel-enabled=" + str(enabled).lower(),
                                   "--experimental-otel-endpoint=https://telemetry.invalid:4318",
                                   "--experimental-otel-header=X-Offline-Probe=" + synthetic_header]
            argv = [*launch, "--setenv", "TURBO_TOKEN", synthetic_bearer, *extra_environment,
                    "/tools/turbo", "--skip-infer", "--single-package", "--no-update-notifier",
                    "run", "probe", *extra_arguments, "--ui=stream", "--cache=local:r", "--concurrency=1", "--env-mode=strict"]
            code, out, err = invoke(argv, root, env)
            after = marker.read_text().count("ran\n") if marker.exists() else 0
            text = (out + err).decode(errors="replace")
            assert (code == 0) == expect_task, (channel, case, code, err[-500:])
            assert after - before == int(expect_task), "Task execution disagrees with the expected admission"
            assert ("TASK_OK" in text) == expect_task, "Task stdout disagrees with admission"
            if not expect_task:
                assert "experimentalObservability" in text and "futureFlags" in text, "Wrong refusal reason"
            assert synthetic_header not in text and synthetic_bearer not in text, "Synthetic credential appeared in diagnostics"
            rows.append({
                "channel": channel, "case": case, "flag": flag, "configurationSource": location, "exporterEnabled": enabled,
                "exit": code, "taskExecuted": expect_task,
                "refusedBeforeTask": not expect_task, "syntheticCredentialInDiagnostics": False,
                "stdoutBytes": len(out), "stderrBytes": len(err),
                "stdoutSha256": hashlib.sha256(out).hexdigest(), "stderrSha256": hashlib.sha256(err).hexdigest(),
                "assertionsPassed": True,
            })
assert len(rows) == 24
assert all((read_contained_source(p, repo) if p == pin_file else p.read_bytes()) == b for p, b in snapshots.items()), "Observation source changed"
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == tool_hashes[k] for k, p in tools.items()), "Tool changed"
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == pins[k]["sha256"] for k, p in clients.items()), "Client changed"
report = {
    "schemaVersion": "cache-native-observability-default-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "authority": "Synthetic default/flag admission only. No enabled exporter payload, actual repository task, remote artifact, production safety, performance or qualification proof.",
    "sourceRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5).strip(),
    "sourceState": "working-tree-bound",
    "sourceBindings": [{"path": p.relative_to(repo).as_posix(), "sha256": hashlib.sha256(b).hexdigest()} for p, b in snapshots.items()],
    "clients": {k: {"reportedVersion": observed_versions[k], "sha256": pins[k]["sha256"]} for k in clients},
    "toolSha256": tool_hashes, "bunVersion": bun_version,
    "captureBounds": {"wholeSeconds": 600, "perProcessSeconds": 20, "stdoutBytes": 1048576, "stderrBytes": 65536},
    "networkIsolated": True, "realRepositoryNotMounted": True, "syntheticInputsOnly": True,
    "cases": len(rows), "rows": rows, "sourceAndToolsUnchanged": True,
}
args.output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
with args.output.open("x") as out:
    out.write(json.dumps(report, indent=2) + "\n")
print(json.dumps({"cases": len(rows), "allAssertionsPassed": True, "sourceAndToolsUnchanged": True}))
