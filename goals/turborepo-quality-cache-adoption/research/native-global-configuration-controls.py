"""Observe global inputs and child inheritance with isolated pinned Turbo clients.

Only disposable synthetic workspaces and pinned tools enter the child. This
compares native configuration behavior, not real-task qualification or remote
reuse. The existing bounded collector owns process and output limits.
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
    node for node in ast.parse(harness.read_text()).body
    if isinstance(node, ast.FunctionDef) and node.name == "run_bounded"
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
assert bun_version == (repo / ".bun-version").read_text().strip(), "Bun pin changed."
sources = [Path(__file__).resolve(), pins_path.resolve(), harness, repo / ".bun-version"]
before = {str(path.relative_to(repo)): sha(path) for path in sources}
tools = {"bun": sha(bun), "bwrap": sha(Path("/usr/bin/bwrap")),
         **{channel: sha(binary) for channel, binary in clients.items()}}
base = repo / ".beep/global-configuration-native-controls"
base.mkdir(parents=True, exist_ok=True, mode=0o700)
raw = Path(tempfile.mkdtemp(prefix="raw-", dir=base))
cache = Path.home() / ".cache/beep/turbo-global-configuration-controls"
cache.mkdir(parents=True, exist_ok=True, mode=0o700)
rows = []
refusals = []
for channel, binary in clients.items():
    for layout in ["legacy", "global"]:
        with tempfile.TemporaryDirectory(prefix=channel + "-" + layout + "-", dir=cache) as tmp:
            root = Path(tmp)
            (root / "package.json").write_text(json.dumps({
                "name": "beep-global-input-fixture", "private": True,
                "packageManager": "bun@" + bun_version, "workspaces": ["packages/*"],
            }) + "\n")
            for package in ["a", "b"]:
                directory = root / "packages" / package
                directory.mkdir(parents=True)
                (directory / "package.json").write_text(json.dumps({
                    "name": package, "version": "0.0.0",
                    "scripts": {"probe": "bun --no-env-file run probe.mjs"},
                }) + "\n")
                (directory / "source.txt").write_text(package + "-source-A")
                (directory / "extra.txt").write_text("extra-A")
                shared = " + ':' + await Bun.file('../../shared.txt').text()" if package == "a" else ""
                (directory / "probe.mjs").write_text(
                    "await Bun.write('out.txt', (await Bun.file('source.txt').text())"
                    " + ':' + process.env.SEMANTIC" + shared + ");\n"
                )
            config = {"tasks": {"probe": {
                "inputs": ["source.txt", "probe.mjs", "package.json"], "outputs": ["out.txt"],
            }}}
            global_values = {"inputs": ["shared.txt"], "env": ["SEMANTIC"], "passThroughEnv": ["BENIGN"]}
            if layout == "global":
                config.update({"futureFlags": {"globalConfiguration": True}, "global": global_values})
            else:
                config.update({"globalDependencies": global_values["inputs"],
                               "globalEnv": global_values["env"], "globalPassThroughEnv": global_values["passThroughEnv"]})
            config_path = root / "turbo.json"
            config_path.write_text(json.dumps(config) + "\n")
            child = {"extends": ["//"], "tasks": {"probe": {
                "inputs": ["$TURBO_EXTENDS$", "!$TURBO_ROOT$/shared.txt"],
            }}}
            child_path = root / "packages/b/turbo.json"
            child_path.write_text(json.dumps(child) + "\n")
            (root / "shared.txt").write_text("shared-A")
            mount = [
                "--unshare-all", "--die-with-parent", "--new-session",
                "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib",
                "--symlink", "usr/lib", "/lib64", "--symlink", "usr/bin", "/bin",
                "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--dir", "/tools",
                "--ro-bind", str(binary), "/tools/turbo", "--ro-bind", str(bun), "/tools/bun",
                "--bind", str(root), "/fixture", "--chdir", "/fixture", "--",
            ]
            environment = {"PATH": "/tools:/usr/bin", "HOME": "/tmp", "CI": "1",
                           "TURBO_TELEMETRY_DISABLED": "1", "SEMANTIC": "A", "BENIGN": "A"}
            capture["command"] = mount + ["/tools/turbo", "--skip-infer", "--version"]
            code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
            assert code == 0 and out.decode().strip() == pins[channel]["reportedVersion"] and not err
            capture["command"] = mount + ["/tools/bun", "--version"]
            code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
            assert code == 0 and out.decode().strip() == bun_version and not err
            capture["command"] = mount + ["/tools/bun", "--no-env-file", "install",
                                          "--offline", "--lockfile-only", "--ignore-scripts"]
            code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
            assert code == 0 and (root / "bun.lock").is_file(), "Offline fixture lockfile failed."
            prior = {}
            for label in ["cold", "restore", "shared-change", "semantic-env-change", "passthrough-change",
                          "unrelated-change", "child-input-policy-change", "child-source-change", "shared-change-again"]:
                if label == "shared-change":
                    (root / "shared.txt").write_text("shared-B")
                elif label == "semantic-env-change":
                    environment["SEMANTIC"] = "B"
                elif label == "passthrough-change":
                    environment["BENIGN"] = "B"
                elif label == "unrelated-change":
                    (root / "unrelated.txt").write_text("unrelated")
                elif label == "child-input-policy-change":
                    child["tasks"]["probe"]["inputs"].append("extra.txt")
                    child_path.write_text(json.dumps(child) + "\n")
                elif label == "child-source-change":
                    (root / "packages/b/source.txt").write_text("b-source-B")
                elif label == "shared-change-again":
                    (root / "shared.txt").write_text("shared-C")
                source_files = [path for path in root.rglob("*") if path.is_file()
                                and (path.name in ["package.json", "turbo.json", "bun.lock", "probe.mjs", "source.txt", "extra.txt"]
                                     or path == root / "shared.txt") and ".turbo" not in path.parts]
                source_hashes = {str(path.relative_to(root)): sha(path) for path in source_files}
                for package in ["a", "b"]:
                    (root / "packages" / package / "out.txt").unlink(missing_ok=True)
                summaries_before = set((root / ".turbo/runs").glob("*.json"))
                capture["command"] = mount + ["/tools/turbo", "--skip-infer", "--no-update-notifier", "run",
                    "probe", "--cache=local:rw", "--summarize", "--output-logs=none",
                    "--env-mode=strict", "--concurrency=1"]
                code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
                stem = channel + "-" + layout + "-" + label
                (raw / (stem + ".stdout")).write_bytes(out)
                (raw / (stem + ".stderr")).write_bytes(err)
                assert code == 0, (stem, "Unexpected native exit", code)
                created = set((root / ".turbo/runs").glob("*.json")) - summaries_before
                assert len(created) == 1, (stem, "Expected one actual run summary.")
                summary = json.loads(created.pop().read_text())
                (raw / (stem + ".summary.json")).write_text(json.dumps(summary, indent=2) + "\n")
                tasks = {task["taskId"]: task for task in summary["tasks"]}
                assert set(tasks) == {"a#probe", "b#probe"}, (stem, "Actual task set changed.")
                for package in ["a", "b"]:
                    task = tasks[package + "#probe"]
                    expected_hit = label in ["restore", "passthrough-change", "unrelated-change"]
                    if label in ["shared-change", "shared-change-again"]:
                        expected_hit = False
                    elif label in ["child-input-policy-change", "child-source-change"]:
                        expected_hit = package == "a"
                    assert (task["cache"]["status"] == "HIT") == expected_hit, (stem, package, "Cache result")
                    if package in prior:
                        assert (task["hash"] == prior[package]) == expected_hit, (stem, package, "Hash equality")
                    output = (root / "packages" / package / "source.txt").read_text() + ":" + environment["SEMANTIC"]
                    if package == "a":
                        output += ":" + (root / "shared.txt").read_text()
                    assert (root / "packages" / package / "out.txt").read_text() == output, (stem, package, "Restoration")
                    shared_in_task = "../../shared.txt" in task["inputs"] or "shared.txt" in task["inputs"]
                    shared_in_global = "shared.txt" in summary["globalCacheInputs"]["files"]
                    assert shared_in_task == (layout == "global"), (stem, package, "Global file task projection")
                    assert shared_in_global == (layout == "legacy"), (stem, package, "Global file global projection")
                    exclusion_resolved = "!../../shared.txt" in task["resolvedTaskDefinition"]["inputs"]
                    assert exclusion_resolved == (package == "b"), (stem, package, "Child exclusion declaration")
                    rows.append({"channel": channel, "layout": layout, "control": label,
                        "task": package + "#probe", "cacheStatus": task["cache"]["status"],
                        "taskHash": task["hash"], "outputMatches": True,
                        "sharedFileInTaskInputs": shared_in_task, "sharedFileInGlobalInputs": shared_in_global,
                        "childExclusionResolved": exclusion_resolved,
                        "exit": code, "stdoutSha256": hashlib.sha256(out).hexdigest(),
                        "stderrSha256": hashlib.sha256(err).hexdigest()})
                    prior[package] = task["hash"]
                assert source_hashes == {str(path.relative_to(root)): sha(path) for path in source_files}, "Fixture source changed."
            if layout == "global":
                for label in ["legacy-key-with-global-flag", "global-block-without-flag", "global-configuration-in-child"]:
                    invalid = json.loads(json.dumps(config))
                    invalid_child = json.loads(json.dumps(child))
                    if label == "legacy-key-with-global-flag":
                        invalid["globalEnv"] = ["SEMANTIC"]
                    elif label == "global-block-without-flag":
                        invalid["futureFlags"]["globalConfiguration"] = False
                    else:
                        invalid_child["global"] = {"env": ["SEMANTIC"]}
                    config_path.write_text(json.dumps(invalid) + "\n")
                    child_path.write_text(json.dumps(invalid_child) + "\n")
                    for package in ["a", "b"]:
                        (root / "packages" / package / "out.txt").unlink(missing_ok=True)
                    capture["command"] = mount + ["/tools/turbo", "--skip-infer", "run", "probe", "--cache=local:rw", "--concurrency=1"]
                    code, out, err = capture["run_bounded"]("/usr/bin/bwrap", root, environment)
                    (raw / (channel + "-" + label + ".stdout")).write_bytes(out)
                    (raw / (channel + "-" + label + ".stderr")).write_bytes(err)
                    assert code == 1 and b"global" in err, (channel, label, "Configuration refusal")
                    assert all(not (root / "packages" / package / "out.txt").exists() for package in ["a", "b"]), "Invalid config restored outputs."
                    refusals.append({"channel": channel, "control": label, "exit": code,
                        "noOutputMaterialized": True, "diagnosticSha256": hashlib.sha256(err).hexdigest()})
assert before == {str(path.relative_to(repo)): sha(path) for path in sources}, "Control source changed."
assert tools == {"bun": sha(bun), "bwrap": sha(Path("/usr/bin/bwrap")),
                 **{channel: sha(binary) for channel, binary in clients.items()}}, "Tools changed."
assert len(rows) == 72 and len(refusals) == 6
report = {"schemaVersion": "cache-global-configuration-native-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "authority": "Synthetic global and child configuration semantics only; no computation qualification or rollout.",
    "sourceRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5).strip(),
    "sourceState": "working-tree-bound",
    "sourceBindings": [{"path": path, "sha256": digest} for path, digest in before.items()],
    "toolSha256": tools, "bunVersion": bun_version,
    "clients": {channel: {key: pins[channel][key] for key in ["reportedVersion", "sha256"]} for channel in clients},
    "captureLimits": {"wholeSeconds": 600, "perCaseSeconds": 20, "stdoutBytes": 1048576, "stderrBytes": 65536},
    "networkIsolated": True, "repositoryNotMounted": True, "sourceAndToolsUnchanged": True,
    "taskObservations": len(rows), "configurationRefusals": len(refusals), "rows": rows, "refusals": refusals,
    "limits": ["Only synthetic Linux workspaces are exercised.",
               "The declared child negation remains resolved but does not exclude this global input on these pinned clients; shared changes recompute both tasks.",
               "A synthetic benign input exclusion does not authorize excluding any real semantic input.",
               "Real-task contracts, cross-host portability and production trust remain separate requirements."]}
with args.output.open("x") as output:
    json.dump(report, output, indent=2)
    output.write("\n")
print(json.dumps({"taskObservations": len(rows), "configurationRefusals": len(refusals), "complete": True}))
