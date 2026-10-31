"""Bounded, network-isolated native GitHub base-ref selection controls."""

from pathlib import Path
import argparse
import ast
import hashlib
import json
import os
import signal
import subprocess
import sys
import tempfile
import time

if not __debug__:
    raise SystemExit("Assertion checks are required.")

repo = Path(__file__).resolve().parents[3]
research = repo / "goals/turborepo-quality-cache-adoption/research"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--stable", type=Path, help="Pinned stable executable; defaults to this checkout installation")
parser.add_argument("--pins", type=Path, help="Frozen native observation; defaults to errors-only-client-pins.json")
parser.add_argument("--output", type=Path, help="Fresh private report path; existing reports are refused")
args = parser.parse_args()
private = repo / ".beep/base-ref-controls"
private.mkdir(mode=0o700, parents=True, exist_ok=True)
private.chmod(0o700)
output = args.output or private / "native.json"
assert not output.exists(), "Existing reports are refused."

shared = research / "native-selection-controls.py"
pins_file = args.pins or research / "errors-only-client-pins.json"
source_paths = [Path(__file__).resolve(), shared, pins_file.resolve()]
source_hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in source_paths}
source_revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5).strip()
node = next(n for n in ast.parse(shared.read_text()).body if isinstance(n, ast.FunctionDef) and n.name == "invoke")
namespace = dict(time=time, subprocess=subprocess, os=os, signal=signal, deadline=time.monotonic() + 90)
exec(compile(ast.Module(body=[node], type_ignores=[]), str(shared), "exec"), namespace)
invoke = namespace["invoke"]
pins = json.loads(pins_file.read_text())
bun = Path(subprocess.check_output(["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5).strip())
bun_version = subprocess.check_output([str(bun), "--version"], text=True, timeout=5).strip()
assert bun_version == (repo / ".bun-version").read_text().strip(), "Bun pin changed."
clients = {
    "stable": args.stable.resolve() if args.stable else repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo",
}
tool_paths = [bun, Path("/usr/bin/git"), Path("/usr/bin/bwrap"), *clients.values()]
tool_hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in tool_paths}
for channel, binary in clients.items():
    assert tool_hashes[str(binary)] == pins[channel]["sha256"], channel + " native pin changed."
cache = Path.home() / ".cache/beep/turbo-base-ref-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
cache.chmod(0o700)
rows = []
observed_versions = {}
for channel, binary in clients.items():
    for flag in [False, True]:
        with tempfile.TemporaryDirectory(dir=cache, prefix=channel + "-") as name:
            root = Path(name)
            (root / "home").mkdir(mode=0o700)
            environment = {
                "PATH": str(bun.parent) + ":/usr/bin:/bin",
                "HOME": str(root / "home"),
                "CI": "1",
                "TURBO_TELEMETRY_DISABLED": "1",
                "GIT_CONFIG_NOSYSTEM": "1",
            }

            def checked(command):
                code, stdout, stderr = invoke(command, root, environment)
                assert code == 0, (command[:3], code, stderr[:800])
                return stdout.decode().strip()

            version = checked([str(binary), "--skip-infer", "--version"])
            assert version == pins[channel]["reportedVersion"], channel + " reported version changed."
            observed_versions[channel] = version
            (root / "package.json").write_text(json.dumps({
                "name": "base-ref-controls", "private": True,
                "packageManager": "bun@" + bun_version, "workspaces": ["packages/*"],
            }))
            (root / "turbo.json").write_text(json.dumps({
                "futureFlags": {"githubActionsRemoteBaseRefFallback": flag},
                "remoteCache": {"enabled": False},
                "tasks": {"probe": {"cache": False, "inputs": ["input.txt"], "outputs": []}},
            }))
            for package in ["a", "b"]:
                directory = root / "packages" / package
                directory.mkdir(parents=True)
                (directory / "input.txt").write_text("before")
                (directory / "package.json").write_text(json.dumps({
                    "name": package, "version": "0.0.0",
                    "scripts": {"probe": "echo UNEXPECTED_EXECUTION > execution.marker"},
                }))
            checked([str(bun), "--no-env-file", "install", "--offline", "--lockfile-only", "--ignore-scripts"])
            checked(["/usr/bin/git", "init", "--template=", "-b", "main"])
            checked(["/usr/bin/git", "config", "user.name", "Native Fixture"])
            checked(["/usr/bin/git", "config", "user.email", "fixture@example.invalid"])
            checked(["/usr/bin/git", "add", "--", "package.json", "turbo.json", "bun.lock", "packages"])
            checked(["/usr/bin/git", "commit", "-m", "base"])
            base = checked(["/usr/bin/git", "rev-parse", "HEAD"])
            checked(["/usr/bin/git", "update-ref", "refs/remotes/origin/main", base])
            checked(["/usr/bin/git", "checkout", "--detach"])
            checked(["/usr/bin/git", "update-ref", "-d", "refs/heads/main", base])
            (root / "packages/a/input.txt").write_text("after")
            checked(["/usr/bin/git", "add", "--", "packages/a/input.txt"])
            checked(["/usr/bin/git", "commit", "-m", "change a"])
            head = checked(["/usr/bin/git", "rev-parse", "HEAD"])
            launch = [
                "/usr/bin/bwrap", "--unshare-all", "--die-with-parent", "--new-session",
                "--ro-bind", "/usr/lib", "/usr/lib", "--symlink", "usr/lib", "/lib",
                "--symlink", "usr/lib", "/lib64", "--dir", "/bin",
                "--ro-bind", "/usr/bin/bash", "/bin/sh", "--dir", "/tools",
                "--ro-bind", str(binary.resolve()), "/tools/turbo",
                "--ro-bind", str(bun), "/tools/bun", "--ro-bind", "/usr/bin/git", "/tools/git",
                "--bind", str(root), "/work", "--tmpfs", "/tmp", "--dir", "/etc",
                "--dir", "/home", "--dir", "/home/probe", "--dev", "/dev", "--proc", "/proc",
                "--chdir", "/work", "--clearenv", "--setenv", "PATH", "/tools",
                "--setenv", "HOME", "/home/probe", "--setenv", "CI", "1",
                "--setenv", "NO_COLOR", "1", "--setenv", "TURBO_TELEMETRY_DISABLED", "1",
                "--setenv", "TOKIO_WORKER_THREADS", "2", "--setenv", "GIT_CONFIG_NOSYSTEM", "1",
                "--setenv", "GITHUB_ACTIONS", "true", "--setenv", "GITHUB_EVENT_NAME", "pull_request",
                "--setenv", "GITHUB_HEAD_REF", "feature", "--setenv", "GITHUB_SHA", head,
            ]
            for case in ["implicit-remote-only", "explicit-remote", "explicit-sha", "local-main", "explicit-missing", "missing-both"]:
                if case == "local-main":
                    checked(["/usr/bin/git", "update-ref", "refs/heads/main", base])
                if case == "missing-both":
                    checked(["/usr/bin/git", "update-ref", "-d", "refs/heads/main", base])
                    checked(["/usr/bin/git", "update-ref", "-d", "refs/remotes/origin/main", base])
                event_base = "unavailable-event-ref" if case.startswith("explicit-") else "main"
                explicit = {"explicit-remote": "origin/main", "explicit-sha": base, "explicit-missing": "unavailable-explicit-ref"}
                command = [*launch, "--setenv", "GITHUB_BASE_REF", event_base]
                if case in explicit:
                    command += ["--setenv", "TURBO_SCM_BASE", explicit[case]]
                command += ["/tools/turbo", "--skip-infer", "--no-update-notifier", "run", "probe", "--affected", "--dry=json"]
                started = time.monotonic()
                code, stdout, stderr = invoke(command, root, environment)
                refused = case == "explicit-missing"
                if refused:
                    assert code == 1 and b"Unable to query SCM" in stderr and b"unavailable-explicit-ref" in stderr, (channel, flag, case, code, stderr[:800])
                    plan = {"tasks": []}
                else:
                    assert code == 0, (channel, flag, case, code, stderr[:800])
                    plan = json.loads(stdout)
                tasks = sorted(task["taskId"] for task in plan["tasks"])
                conservative = case == "missing-both" or (case == "implicit-remote-only" and not flag)
                expected = [] if refused else (["a#probe", "b#probe"] if conservative else ["a#probe"])
                assert tasks == expected, (channel, flag, case, tasks, expected)
                assert (b"unable to detect git range" in stderr) == conservative, (channel, flag, case, stderr[:800])
                assert not list(root.glob("packages/*/execution.marker")), "Dry selection unexpectedly executed a task."
                rows.append({
                    "channel": channel, "flag": flag, "case": case, "exitCode": code,
                    "selectedTasks": tasks, "conservativeAllTasks": conservative,
                    "explicitBaseRefused": refused,
                    "elapsedSeconds": round(time.monotonic() - started, 6),
                    "stdoutSha256": hashlib.sha256(stdout).hexdigest(),
                    "stderrSha256": hashlib.sha256(stderr).hexdigest(),
                    "taskHashes": {task["taskId"]: task["hash"] for task in plan["tasks"]},
                })

assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == digest for p, digest in source_hashes.items()), "Driver, helper or pins changed."
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == digest for p, digest in tool_hashes.items()), "Runtime executable changed."
revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5).strip()
assert revision == source_revision, "Source revision changed during execution."
for channel in clients:
    for flag in [False, True]:
        assert len({row["taskHashes"]["a#probe"] for row in rows if row["channel"] == channel and row["flag"] == flag and not row["explicitBaseRefused"]}) == 1, "Base selection changed an unchanged task hash."
report = {
    "schemaVersion": "cache-native-base-ref-controls/v1",
    "scope": "Synthetic native dry selection only; no task execution, hosted run, qualification or production timing claim.",
    "sourceRevisionAtExecution": revision,
    "driverSha256": source_hashes[str(Path(__file__).resolve())],
    "sharedInvokeSourceSha256": source_hashes[str(shared)],
    "pinsSha256": source_hashes[str(pins_file.resolve())],
    "bunVersion": bun_version, "bunSha256": tool_hashes[str(bun)],
    "pythonVersion": sys.version.split()[0],
    "gitSha256": tool_hashes["/usr/bin/git"], "bwrapSha256": tool_hashes["/usr/bin/bwrap"],
    "clients": {channel: {"reportedVersion": observed_versions[channel], "sha256": tool_hashes[str(binary)]} for channel, binary in clients.items()},
    "networkIsolated": True, "ambientEnvironmentCleared": True,
    "processBudgetSeconds": 90, "childMaxSeconds": 10, "channelMaxBytes": 1024 * 1024,
    "cases": rows,
}
with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as file:
    file.write(json.dumps(report, indent=2) + "\n")
print(json.dumps({"cases": len(rows), "clients": observed_versions, "taskExecution": False}))
