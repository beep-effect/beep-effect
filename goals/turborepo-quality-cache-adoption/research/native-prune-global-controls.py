"""Bounded offline prune/global-file observations; no repository task execution."""

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
    raise SystemExit("Assertion checks are required; run without Python -O.")
os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--stable", type=Path, required=True)
parser.add_argument("--pins", type=Path)
args = parser.parse_args()
assert not args.output.exists(), "Existing reports are refused."
repo = Path(__file__).resolve().parents[3]
research = Path(__file__).resolve().parent
source_reader = research / "native-future-flag-availability.py"
source_reader_bytes = source_reader.read_bytes()
source_reader_node = next(n for n in ast.parse(source_reader_bytes).body
                          if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
source_reader_namespace = {"os": os}
exec(compile(ast.Module(body=[source_reader_node], type_ignores=[]), str(source_reader), "exec"), source_reader_namespace)
read_contained_source = source_reader_namespace["read_contained_source"]
pins_path = (args.pins or research / "errors-only-client-pins.json").resolve()
pins_path.relative_to(repo)
harness = research / "native-future-flag-availability.py"
selection = research / "native-selection-controls.py"
sources = [Path(__file__).resolve(), pins_path, harness, selection, repo / ".bun-version"]
sha = lambda path: hashlib.sha256(read_contained_source(path, repo) if path == pins_path else path.read_bytes()).hexdigest()
captured_sources = {path: (source_reader_bytes if path == source_reader else read_contained_source(path, repo) if path == pins_path else path.read_bytes()) for path in sources}
before = {path.relative_to(repo).as_posix(): hashlib.sha256(data).hexdigest() for path, data in captured_sources.items()}
pins = json.loads(captured_sources[pins_path])
node = next(n for n in ast.parse(captured_sources[harness]).body
            if isinstance(n, ast.FunctionDef) and n.name == "run_bounded")
capture = {"time": time, "os": os, "selectors": selectors,
           "signal": signal, "subprocess": subprocess, "start": time.monotonic()}
exec(compile(ast.Module(body=[node], type_ignores=[]), str(harness), "exec"), capture)
node = next(n for n in ast.parse(captured_sources[selection]).body
            if isinstance(n, ast.FunctionDef) and n.name == "invoke_bounded")
deadline = time.monotonic() + 180
ns = {"time": time, "signal": signal, "capture": capture,
      "timeout": Path("/usr/bin/timeout"), "deadline": deadline}
exec(compile(ast.Module(body=[node], type_ignores=[]), str(selection), "exec"), ns)
invoke = ns["invoke_bounded"]
assert all((read_contained_source(path, repo) if path == pins_path else path.read_bytes()) == data for path, data in captured_sources.items()), "Observation sources changed before probes."
clients = {"stable": args.stable.resolve(), "canary": Path.home()
           / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo"}
for channel, binary in clients.items():
    assert sha(binary) == pins[channel]["sha256"], "Native client pin changed."
bun = Path(subprocess.check_output(
    ["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5,
).strip())
bun_version = subprocess.check_output([str(bun), "--version"], text=True, timeout=5).strip()
assert bun_version == captured_sources[repo / ".bun-version"].decode().strip(), "Bun pin changed."
tools = {"bun": sha(bun), "bwrap": sha(Path("/usr/bin/bwrap")),
         "timeout": sha(Path("/usr/bin/timeout"))}
base = repo / ".beep/prune-global-native-controls"
base.mkdir(mode=0o700, parents=True, exist_ok=True)
raw = Path(tempfile.mkdtemp(prefix="raw-", dir=base))
cache = Path.home() / ".cache/beep/turbo-prune-global-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
rows = []
counter = 0
marker = "beep-synthetic-global-input"
for channel, binary in clients.items():
    for layout in ["legacy", "global"]:
        with tempfile.TemporaryDirectory(prefix=channel + "-" + layout + "-", dir=cache) as tmp:
            root = Path(tmp)
            (root / "package.json").write_text(json.dumps({
                "name": "beep-prune-fixture", "private": True,
                "packageManager": "bun@" + bun_version, "workspaces": ["packages/*"],
                "scripts": {"postinstall": "printf forbidden > executed.txt"},
            }) + "\n")
            for name in ["a", "b", "unrelated"]:
                directory = root / "packages" / name
                directory.mkdir(parents=True)
                manifest = {"name": name, "version": "0.0.0"}
                if name == "a":
                    manifest["dependencies"] = {"b": "workspace:*"}
                (directory / "package.json").write_text(json.dumps(manifest) + "\n")
                (directory / "source.txt").write_text(name + "-source\n")
            (root / "global.txt").write_text(marker)
            mount = [
                "/usr/bin/bwrap", "--unshare-all", "--die-with-parent", "--new-session",
                "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib",
                "--symlink", "usr/lib", "/lib64", "--symlink", "usr/bin", "/bin",
                "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--dir", "/tools",
                "--ro-bind", str(binary), "/tools/turbo", "--ro-bind", str(bun), "/tools/bun",
                "--bind", str(root), "/fixture", "--chdir", "/fixture", "--",
            ]
            env = {"PATH": "/tools:/usr/bin", "HOME": "/tmp", "CI": "1",
                   "NO_COLOR": "1", "TURBO_TELEMETRY_DISABLED": "1",
                   "TOKIO_WORKER_THREADS": "2", "RAYON_NUM_THREADS": "2"}

            def run(label, argv):
                global counter
                counter += 1
                code, out, err = invoke(mount + argv, root, env)
                stem = raw / (f"{counter:03}-" + channel + "-" + layout + "-" + label)
                stem.with_suffix(".stdout").write_bytes(out)
                stem.with_suffix(".stderr").write_bytes(err)
                stem.with_suffix(".status.json").write_text(json.dumps({"exit": code,
                    "stdoutSha256": hashlib.sha256(out).hexdigest(),
                    "stderrSha256": hashlib.sha256(err).hexdigest()}) + "\n")
                return code, out, err

            code, out, _ = run("version", ["/tools/turbo", "--skip-infer", "--version"])
            assert code == 0 and out.decode().strip() == pins[channel]["reportedVersion"]
            code, _, _ = run("lock", ["/tools/bun", "--no-env-file", "install", "--offline",
                                      "--lockfile-only", "--ignore-scripts"])
            assert code == 0 and (root / "bun.lock").is_file(), "Offline fixture lock failed."
            assert not (root / "executed.txt").exists(), "Lifecycle script executed."
            for enabled in [False, True]:
                config = {"tasks": {"probe": {}}, "futureFlags": {"pruneIncludesGlobalFiles": enabled}}
                if layout == "global":
                    config["futureFlags"]["globalConfiguration"] = True
                    config["global"] = {"inputs": ["global.txt"]}
                else:
                    config["globalDependencies"] = ["global.txt"]
                (root / "turbo.json").write_text(json.dumps(config) + "\n")
                for docker in [False, True]:
                    label = "flag-" + str(enabled).lower() + "-docker-" + str(docker).lower()
                    output = "out-" + label
                    argv = ["/tools/turbo", "--skip-infer", "prune", "a", "--out-dir", output]
                    if docker:
                        argv.append("--docker")
                    code, _, _ = run(label, argv)
                    assert code == 0, "Prune refused the reviewed fixture."
                    pruned = root / output
                    full = pruned / "full" if docker else pruned
                    install = pruned / "json" if docker else pruned
                    assert (full / "packages/a/source.txt").is_file()
                    assert (full / "packages/b/source.txt").is_file()
                    assert not (full / "packages/unrelated").exists()
                    copied = (full / "global.txt").is_file()
                    assert copied == enabled, "Prune global-file behavior differs from the documented flag."
                    if docker:
                        assert (install / "global.txt").is_file() == enabled
                    code, _, _ = run(label + "-install", ["/tools/bun", "--no-env-file", "install",
                        "--cwd", "/fixture/" + install.relative_to(root).as_posix(), "--offline",
                        "--frozen-lockfile", "--ignore-scripts"])
                    assert code == 0, "Pruned output does not install with its frozen offline lockfile."
                    assert not (install / "executed.txt").exists(), "Pruned lifecycle script executed."
                    target = "/fixture/" + full.relative_to(root).as_posix() + "/global.txt"
                    read = ["/tools/bun", "--no-env-file", "-e",
                            "process.stdout.write(await Bun.file(" + json.dumps(target) + ").text())"]
                    code, out, err = run(label + "-consumer", read)
                    if enabled:
                        assert code == 0 and out.decode() == marker
                        (full / "global.txt").unlink()
                        code, _, err = run(label + "-missing-input", read)
                    assert code != 0 and b"ENOENT" in err, "A missing global input was not refused."
                    assert not (root / "executed.txt").exists(), "Source lifecycle script executed."
                    rows.append({"channel": channel, "layout": layout, "flag": enabled, "docker": docker,
                        "dependencySourceRetained": True, "unrelatedWorkspaceExcluded": True,
                        "globalFileCopied": copied, "frozenOfflineInstallPassed": True,
                        "missingGlobalConsumerRefused": True, "lifecycleAndTaskExecution": False})
expected = {(c, l, f, d) for c in clients for l in ["legacy", "global"]
            for f in [False, True] for d in [False, True]}
observed = {(r["channel"], r["layout"], r["flag"], r["docker"]) for r in rows}
assert len(rows) == 16 and observed == expected, "Prune observation matrix is incomplete."
assert all(sha(repo / name) == digest for name, digest in before.items()), "Observation source changed."
assert all(sha(binary) == pins[channel]["sha256"] for channel, binary in clients.items())
assert sha(bun) == tools["bun"] and sha(Path("/usr/bin/bwrap")) == tools["bwrap"]
report = {"schemaVersion": "cache-prune-global-native-controls/v1",
    "authority": "Synthetic offline prune and input-presence observations only; no computation qualification.",
    "observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceState": "working-tree-bound", "sourceBindings": [{"path": p, "sha256": d} for p, d in before.items()],
    "clients": {c: {k: pins[c][k] for k in ["reportedVersion", "sha256"]} for c in clients},
    "toolSha256": tools, "bunVersion": bun_version, "networkIsolated": True, "repositoryNotMounted": True,
    "captureLimits": {"wholeSeconds": 180, "perProcessSeconds": 10, "stdoutBytes": 1048576, "stderrBytes": 65536},
    "cases": len(rows), "subprocesses": counter, "rows": rows,
    "limits": ["Only synthetic Linux fixtures are exercised.", "No production prune caller or build output is qualified.",
               "Ignored/sensitive file policy, deployment portability and real task qualification remain separate gates."]}
with args.output.open("x") as out:
    json.dump(report, out, indent=2)
    out.write("\n")
print(json.dumps({"cases": len(rows), "subprocesses": counter, "complete": True}))
