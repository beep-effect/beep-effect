"""Observe local cache sharing and output portability in disposable Git worktrees.

Reuse the source-bound availability collector and pin reader. Run only tiny
fixture bodies, offline, under the caller's existing admission. No Beep task,
real checkout cache, credentials or remote transport is used.
"""

import argparse
import ast
import datetime
import hashlib
import json
import os
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path

assert __debug__ and sys.platform == "linux", "Linux and assertions are required."
os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--raw-dir", type=Path, required=True)
args = parser.parse_args()
assert not args.output.exists() and not args.raw_dir.exists(), "Existing evidence is refused."
args.raw_dir.mkdir(mode=0o700, parents=True)
repo = Path(__file__).resolve().parents[3]
research = Path(__file__).parent
harness = research / "native-future-flag-availability.py"
harness_bytes = harness.read_bytes()
parsed = ast.parse(harness_bytes)
reader = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
reader_namespace = {"os": os}
exec(compile(ast.Module(body=[reader], type_ignores=[]), str(harness), "exec"), reader_namespace)
read_contained_source = reader_namespace["read_contained_source"]
pins_file = research / "current-client-pins.json"
sources = {
    Path(__file__).resolve(): Path(__file__).read_bytes(),
    harness: harness_bytes,
    pins_file: read_contained_source(pins_file, repo),
    repo / ".bun-version": (repo / ".bun-version").read_bytes(),
    repo / "node_modules/turbo/docs/crafting-your-repository/caching.mdx": (repo / "node_modules/turbo/docs/crafting-your-repository/caching.mdx").read_bytes(),
}
pins = json.loads(sources[pins_file])


def guard_sources():
    for path, data in sources.items():
        current = read_contained_source(path, repo) if path == pins_file else path.read_bytes()
        assert current == data, "Observation source changed."


guard_sources()
collector = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == "run_bounded")
capture = {"time": time, "os": os, "selectors": selectors, "signal": signal, "subprocess": subprocess}
exec(compile(ast.Module(body=[collector], type_ignores=[]), str(harness), "exec"), capture)
run_bounded = capture["run_bounded"]
bun = Path(subprocess.check_output(["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5).strip())
bun_version = subprocess.check_output([str(bun), "--version"], text=True, timeout=5).strip()
assert bun_version == sources[repo / ".bun-version"].decode().strip(), "Bun pin changed."
clients = {"stable": repo / "node_modules/@turbo/linux-64/bin/turbo", "canary": Path.home() / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo"}
tools = {"bun": bun, "bwrap": Path("/usr/bin/bwrap"), "git": Path("/usr/bin/git")}
tool_hashes = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in tools.items()}
git_env = {"PATH": "/usr/bin", "HOME": "/nonexistent", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"}
cache = Path.home() / ".cache/beep/turbo-worktree-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
capture["start"] = time.monotonic()
rows = []
raw_bytes = 0
git_commands = 0
owned_roots = []


def retain(filename, data):
    global raw_bytes
    raw_bytes += len(data)
    assert raw_bytes <= 4 * 1024 * 1024, "Raw evidence exceeds four MiB."
    with (args.raw_dir / filename).open("xb") as f:
        f.write(data)
    return {"file": filename, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def git(root, *argv):
    global git_commands
    result = subprocess.run(["/usr/bin/git", "-c", "core.hooksPath=/dev/null", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", *argv], cwd=root, env=git_env, capture_output=True, timeout=5)
    git_commands += 1
    assert len(result.stdout) + len(result.stderr) < 65536 and result.returncode == 0, "Fixture Git prerequisite failed."


def observed(label, channel, parent, root_name, command, binary):
    guard_sources()
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native client moved."
    for name, path in tools.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == tool_hashes[name], "Fixture tool moved."
    mount = ["--unshare-all", "--die-with-parent", "--new-session", "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib", "/lib64", "--symlink", "usr/bin", "/bin", "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--dir", "/tools", "--ro-bind", str(binary), "/tools/turbo", "--ro-bind", str(bun), "/tools/bun", "--bind", str(parent), "/fixture", "--chdir", "/fixture/" + root_name, "--"]
    capture["command"] = mount + command
    env = {"PATH": "/tools:/usr/bin", "HOME": "/nonexistent", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "CI": "1", "TURBO_TELEMETRY_DISABLED": "1", "TURBO_DAEMON": "false", "BUN_INSTALL_CACHE_DIR": "/tmp/bun-cache", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"}
    code, out, err = run_bounded("/usr/bin/bwrap", parent, env)
    assert len(out) + len(err) <= 256 * 1024, "Per-command evidence exceeds 256 KiB."
    streams = {}
    for name, data in [("stdout", out), ("stderr", err)]:
        streams[name] = retain(f"{channel}-{label}.{name}", data)
    assert code == 0, (channel, label, "Native fixture command failed; raw output retained.")
    return streams


def output_tree(root):
    return {p.relative_to(root / "out").as_posix(): {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "mode": stat.S_IMODE(p.stat().st_mode)} for p in (root / "out").rglob("*") if p.is_file()}


def run_case(channel, mode, case, parent, root_name, value, expected_hit, binary, force=False):
    root = parent / root_name
    (root / "input.txt").write_text(value)
    shutil.rmtree(root / "out", ignore_errors=True)
    logs = list((root / ".turbo").glob("*.log"))
    for path in logs:
        path.unlink()
    assert not (root / "out").exists() and not list((root / ".turbo").glob("*.log")), "Receiver output/log cleanup failed."
    before_summaries = set((root / ".turbo/runs").glob("*.json"))
    marker = root / "task-runs"
    before_count = marker.stat().st_size if marker.exists() else 0
    inputs_before = {name: (root / name).read_bytes() for name in ["input.txt", "probe.mjs", "package.json", "bun.lock", "turbo.json", ".gitignore"]}
    command = ["/tools/turbo", "--skip-infer", "--no-color", "run", "probe", "--single-package", "--force" if force else "--cache=local:rw", "--summarize", "--output-logs=full", "--concurrency=1", "--env-mode=strict"]
    streams = observed(mode + "-" + case, channel, parent, root_name, command, binary)
    assert all((root / name).read_bytes() == data for name, data in inputs_before.items()), "Native execution changed fixture inputs."
    new_summaries = set((root / ".turbo/runs").glob("*.json")) - before_summaries
    assert len(new_summaries) == 1, "Exactly one actual summary is required."
    summary_bytes = new_summaries.pop().read_bytes()
    tasks = json.loads(summary_bytes)["tasks"]
    assert len(tasks) == 1, "Exactly one fixture task must be observed."
    task = tasks[0]
    hit = task["cache"]["status"] == "HIT"
    after_count = marker.stat().st_size if marker.exists() else 0
    assert hit == expected_hit and after_count - before_count == (0 if hit else 1), (channel, mode, case, "Cache result/body execution mismatch.")
    task_logs = list((root / ".turbo").glob("*.log"))
    assert len(task_logs) == 1, "Exactly one actual restored task log is required."
    tree = output_tree(root)
    prefix = f"{channel}-{mode}-{case}"
    summary_capture = retain(prefix + ".summary.json", summary_bytes)
    log_capture = retain(prefix + ".task.log", task_logs[0].read_bytes())
    outputs = {name: retain(prefix + ".output-" + name.replace("/", "-"), (root / "out" / name).read_bytes()) for name in tree}
    row = {"case": mode + ":" + case, "channel": channel, "root": root_name, "version": pins[channel]["reportedVersion"], "taskHash": task["hash"], "cacheStatus": task["cache"]["status"], "bodyExecutions": after_count - before_count, "receiverOutputsAndLogsInitiallyAbsent": True, "fixtureInputsUnchanged": True, "outputTree": tree, "taskLogSha256": log_capture["sha256"], "summarySha256": summary_capture["sha256"], "retainedSummary": summary_capture, "retainedTaskLog": log_capture, "retainedOutputs": outputs, "streams": streams}
    rows.append(row)
    with (args.raw_dir / "partial-rows.json").open("w") as f:
        json.dump(rows, f, indent=2)
        f.write("\n")
    expected_mode = 0o700 if mode != "permission" or expected_hit else 0o755
    assert len(tree) == 3 and tree.get("run.sh", {}).get("mode") == expected_mode, (channel, mode, case, "Complete output tree/mode mismatch", tree)
    if mode != "absolute":
        assert (root / "out/data.txt").read_text() == "portable:" + value
    return row


for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native pin changed."
    for mode in ["implicit", "explicit", "absolute", "permission"]:
        with tempfile.TemporaryDirectory(prefix=channel + "-" + mode + "-", dir=cache) as temporary:
            parent = Path(temporary)
            owned_roots.append(parent)
            main = parent / "main"
            main.mkdir()
            manifest = {"name": "worktree-fixture", "version": "0.0.0", "private": True, "packageManager": "bun@" + bun_version, "workspaces": ["packages/*"], "scripts": {"probe": "bun --no-env-file run probe.mjs", "postinstall": "exit 37"}}
            (main / "package.json").write_text(json.dumps(manifest) + "\n")
            workspace = main / "packages/marker"
            workspace.mkdir(parents=True)
            (workspace / "package.json").write_text(json.dumps({"name": "@worktree-fixture/marker", "version": "0.0.0", "private": True}) + "\n")
            config = {"tasks": {"probe": {"inputs": ["input.txt", "probe.mjs", "package.json"], "outputs": ["out/**"]}}}
            if mode == "explicit":
                config["cacheDir"] = ".turbo/cache"
            (main / "turbo.json").write_text(json.dumps(config) + "\n")
            (main / ".gitignore").write_text(".turbo/\nout/\ntask-runs\n")
            (main / "input.txt").write_text("A")
            script = "import {mkdirSync,writeFileSync,appendFileSync,chmodSync} from 'node:fs'; const input=await Bun.file('input.txt').text(); mkdirSync('out/nested',{recursive:true}); writeFileSync('out/data.txt',VALUE); writeFileSync('out/nested/metadata.json',JSON.stringify({input})); writeFileSync('out/run.sh','#!/bin/sh\\nexit 0\\n'); chmodSync('out/run.sh',MODE); appendFileSync('task-runs','x'); console.log('fixture:'+input);\n"
            (main / "probe.mjs").write_text(script.replace("VALUE", "process.cwd()" if mode == "absolute" else "'portable:'+input").replace("MODE", "0o755" if mode == "permission" else "0o700"))
            observed(mode + "-lock", channel, parent, "main", ["/tools/bun", "--no-env-file", "install", "--lockfile-only", "--ignore-scripts"], binary)
            assert (main / "bun.lock").is_file(), "Offline fixture lock was not generated."
            git(main, "init", "--quiet", "--initial-branch=fixture")
            git(main, "add", ".")
            git(main, "commit", "--quiet", "-m", "fixture")
            git(main, "worktree", "add", "--quiet", "--detach", "--relative-paths", str(parent / "linked"), "HEAD")
            version = observed(mode + "-version", channel, parent, "main", ["/tools/turbo", "--skip-infer", "--version"], binary)
            assert (args.raw_dir / version["stdout"]["file"]).read_text().strip() == pins[channel]["reportedVersion"], "Native version mismatch."
            a = run_case(channel, mode, "main-cold", parent, "main", "A", False, binary)
            b = run_case(channel, mode, "linked-from-main", parent, "linked", "A", mode != "explicit", binary)
            assert a["taskHash"] == b["taskHash"] and a["taskLogSha256"] == b["taskLogSha256"], "Cross-worktree identity/log mismatch."
            if mode == "permission":
                assert {name: row["sha256"] for name, row in a["outputTree"].items()} == {name: row["sha256"] for name, row in b["outputTree"].items()}, "Permission counterexample changed output bytes."
                assert [name for name in a["outputTree"] if a["outputTree"][name] != b["outputTree"][name]] == ["run.sh"], "Expected only executable mode to differ."
                c = run_case(channel, mode, "linked-fresh-control", parent, "linked", "A", False, binary, True)
                assert c["outputTree"] == a["outputTree"] and c["outputTree"] != b["outputTree"], "Fresh permission control did not restore chmodded mode."
                b["restoredModeDiffersFromProducer"] = True
                c["freshConsumerModeDiffersFromRestored"] = True
                continue
            assert a["outputTree"] == b["outputTree"], "Cross-worktree output mismatch."
            if mode == "absolute":
                assert (parent / "linked/out/data.txt").read_text() == "/fixture/main", "Absolute-path counterexample did not restore producer path."
                c = run_case(channel, mode, "linked-fresh-control", parent, "linked", "A", False, binary, True)
                assert (parent / "linked/out/data.txt").read_text() == "/fixture/linked" and c["outputTree"] != b["outputTree"], "Fresh consumer counterexample did not diverge."
                b["restoredProducerAbsolutePath"] = True
                c["freshConsumerOutputDiffersFromRestored"] = True
            else:
                if mode == "explicit":
                    run_case(channel, mode, "linked-own-replay", parent, "linked", "A", True, binary)
                c = run_case(channel, mode, "linked-new-input", parent, "linked", "B", False, binary)
                d = run_case(channel, mode, "main-from-linked", parent, "main", "B", mode == "implicit", binary)
                assert c["taskHash"] != a["taskHash"] and c["taskHash"] == d["taskHash"] and c["outputTree"] == d["outputTree"] and c["taskLogSha256"] == d["taskLogSha256"], "Reverse sharing or invalidation mismatch."
                if mode == "implicit":
                    run_case(channel, mode, "main-negative-input", parent, "main", "C", False, binary)
                    run_case(channel, mode, "main-own-replay", parent, "main", "C", True, binary)
                else:
                    run_case(channel, mode, "main-own-replay", parent, "main", "B", True, binary)
guard_sources()
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native client moved."
for name, path in tools.items():
    assert hashlib.sha256(path.read_bytes()).hexdigest() == tool_hashes[name], "Fixture tool moved."
assert not any(root.exists() for root in owned_roots), "Owned fixture cleanup failed."
report = {"schemaVersion": "native-worktree-controls/v1", "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sourceRevision": subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=5).strip(), "sourceBindings": [{"path": path.relative_to(repo).as_posix(), "sha256": hashlib.sha256(data).hexdigest()} for path, data in sources.items()], "clients": {channel: {"version": pins[channel]["reportedVersion"], "sha256": pins[channel]["sha256"]} for channel in clients}, "toolHashes": tool_hashes, "rows": rows, "counts": {"taskInvocations": len(rows), "hits": sum(r["cacheStatus"] == "HIT" for r in rows), "fixtureTaskExecutions": sum(r["bodyExecutions"] for r in rows), "gitPrerequisites": git_commands, "rawBytes": raw_bytes}, "sourceAndToolsUnchanged": True, "networkIsolated": True, "ownedFixturesRemoved": True, "scope": "Actual local-only disposable Git worktrees. No Beep computation/profile qualification, independent-clone or remote-box proof, remote cache, rollout, setting change or measured production benefit."}
encoded = (json.dumps(report, indent=2) + "\n").encode()
assert len(encoded) <= 2 * 1024 * 1024, "Report exceeds two MiB."
with args.output.open("xb") as f:
    f.write(encoded)
print(json.dumps(report["counts"]))
