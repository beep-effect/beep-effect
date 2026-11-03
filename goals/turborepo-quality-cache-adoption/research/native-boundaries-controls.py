"""Observe pinned boundary checks in disposable, network-isolated workspaces.

No Beep task or quality suite runs. Reuse the captured availability driver's
bounded collector and descriptor reader; refuse moved sources before probes.
The report grants synthetic semantics only, not repository or profile adoption.
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
reader_node = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
reader_namespace = {"os": os}
exec(compile(ast.Module(body=[reader_node], type_ignores=[]), str(harness), "exec"), reader_namespace)
read_contained_source = reader_namespace["read_contained_source"]
pins_file = research / "current-client-pins.json"
docs = repo / "node_modules/turbo/docs/reference/boundaries.mdx"
sources = {
    Path(__file__).resolve(): Path(__file__).read_bytes(),
    harness: harness_bytes,
    pins_file: read_contained_source(pins_file, repo),
    repo / ".bun-version": (repo / ".bun-version").read_bytes(),
    docs: docs.read_bytes(),
}
pins = json.loads(sources[pins_file])


def guard_sources():
    for path, data in sources.items():
        current = read_contained_source(path, repo) if path == pins_file else path.read_bytes()
        assert current == data, "Observation source changed."


guard_sources()
collector_node = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == "run_bounded")
capture = {"time": time, "os": os, "selectors": selectors, "signal": signal, "subprocess": subprocess}
exec(compile(ast.Module(body=[collector_node], type_ignores=[]), str(harness), "exec"), capture)
run_bounded = capture["run_bounded"]
bun = Path(subprocess.check_output(["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5).strip())
bun_version = subprocess.check_output([str(bun), "--version"], text=True, timeout=5).strip()
assert bun_version == sources[repo / ".bun-version"].decode().strip(), "Bun version changed."
clients = {
    "stable": repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients" / pins["canary"]["packageVersion"] / "turbo",
}
tool_hashes = {"bun": hashlib.sha256(bun.read_bytes()).hexdigest(), "bwrap": hashlib.sha256(Path("/usr/bin/bwrap").read_bytes()).hexdigest()}
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native client changed."

cases = [
    ("declared-import", "private", {"private": "workspace:*"}, {}, {}, 0, []),
    ("undeclared-import", "unused", {}, {}, {}, 1, ["@beep-boundary/unused", "src/index.ts", "cannot import package"]),
    ("relative-package-escape", "relative", {"private": "workspace:*"}, {}, {}, 1, ["src/index.ts", "leaves the package"]),
    ("relative-in-package", "local", {}, {}, {}, 0, []),
    ("dependency-tag-deny", "private", {"private": "workspace:*"}, {}, {"public": {"dependencies": {"deny": ["private"]}}}, 1, ["public", "private", "denylist"]),
    ("dependency-tag-allow", "private", {"private": "workspace:*"}, {}, {"public": {"dependencies": {"allow": ["private"]}}}, 0, []),
    ("dependency-tag-allow-mismatch", "private", {"private": "workspace:*"}, {}, {"public": {"dependencies": {"allow": ["public"]}}}, 1, ["public", "private", "allowlist"]),
    ("dependent-tag-deny", "private", {"private": "workspace:*"}, {}, {"private": {"dependents": {"deny": ["public"]}}}, 1, ["public", "private", "denylist"]),
    ("dependent-tag-allow", "private", {"private": "workspace:*"}, {}, {"private": {"dependents": {"allow": ["public"]}}}, 0, []),
    ("dependency-name-deny", "private", {"private": "workspace:*"}, {}, {"public": {"dependencies": {"deny": ["@beep-boundary/private"]}}}, 1, ["public", "private", "denylist"]),
    ("transitive-dependency-deny", "middle", {"middle": "workspace:*"}, {"private": "workspace:*"}, {"public": {"dependencies": {"deny": ["private"]}}}, 1, ["public", "private", "denylist"]),
    ("unrelated-denial", "private", {"private": "workspace:*"}, {}, {"public": {"dependencies": {"deny": ["unused"]}}}, 0, []),
]
cache = Path.home() / ".cache/beep/turbo-boundaries-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
start = time.monotonic()
capture["start"] = start
rows = []
raw_bytes = 0
owned_roots = []


def observed(label, channel, root, command, binary):
    global raw_bytes
    guard_sources()
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"]
    assert hashlib.sha256(bun.read_bytes()).hexdigest() == tool_hashes["bun"]
    mount = [
        "--unshare-all", "--die-with-parent", "--new-session",
        "--ro-bind", "/usr", "/usr", "--symlink", "usr/lib", "/lib",
        "--symlink", "usr/lib", "/lib64", "--symlink", "usr/bin", "/bin",
        "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--dir", "/tools",
        "--ro-bind", str(binary), "/tools/turbo", "--ro-bind", str(bun), "/tools/bun",
        "--bind", str(root), "/fixture", "--chdir", "/fixture", "--",
    ]
    capture["command"] = mount + command
    env = {"PATH": "/tools:/usr/bin", "HOME": "/nonexistent", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "CI": "1", "TURBO_TELEMETRY_DISABLED": "1", "TURBO_DAEMON": "false", "BUN_INSTALL_CACHE_DIR": "/tmp/bun-cache", "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null"}
    code, out, err = run_bounded("/usr/bin/bwrap", root, env)
    assert len(out) + len(err) <= 256 * 1024, "Per-command evidence exceeds 256 KiB."
    raw_bytes += len(out) + len(err)
    assert raw_bytes <= 4 * 1024 * 1024, "Aggregate evidence exceeds four MiB."
    streams = {}
    for name, data in [("stdout", out), ("stderr", err)]:
        filename = f"{channel}-{label}.{name}"
        with (args.raw_dir / filename).open("xb") as stream:
            stream.write(data)
        streams[name] = {"file": filename, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return code, out.decode(), err.decode(), streams


def snapshot(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob("*") if p.is_file() and ".turbo" not in p.relative_to(root).parts}


for case_id, imported, public_deps, middle_deps, rules, expected_exit, witnesses in cases:
    with tempfile.TemporaryDirectory(prefix=case_id + "-", dir=cache) as temporary:
        root = Path(temporary)
        owned_roots.append(root)
        manifest = {"name": "boundary-fixture", "private": True, "packageManager": "bun@" + bun_version, "workspaces": ["packages/*"], "scripts": {"probe": "printf executed > executed.txt; exit 37", "postinstall": "printf executed > executed.txt; exit 37"}}
        (root / "package.json").write_text(json.dumps(manifest) + "\n")
        config = {"tasks": {"probe": {"outputs": []}}}
        if rules:
            config["boundaries"] = {"tags": rules}
        (root / "turbo.json").write_text(json.dumps(config) + "\n")
        for name in ["public", "private", "middle", "unused"]:
            directory = root / "packages" / name
            (directory / "src").mkdir(parents=True)
            deps = public_deps if name == "public" else middle_deps if name == "middle" else {}
            package = {"name": "@beep-boundary/" + name, "version": "0.0.0", "exports": "./src/index.ts", "dependencies": {"@beep-boundary/" + k: v for k, v in deps.items()}, "scripts": {"probe": "printf executed > executed.txt; exit 37"}}
            (directory / "package.json").write_text(json.dumps(package) + "\n")
            (directory / "turbo.json").write_text(json.dumps({"extends": ["//"], "tags": [name]}) + "\n")
            source = 'export const value = "fixture";\n'
            if name == "public":
                target = "../../private/src/index.ts" if imported == "relative" else "./local.ts" if imported == "local" else "@beep-boundary/" + imported
                source = 'import { value } from "' + target + '"; export const result = value;\n'
            elif name == "middle" and middle_deps:
                source = 'export { value } from "@beep-boundary/private";\n'
            (directory / "src/index.ts").write_text(source)
            (directory / "src/local.ts").write_text('export const value = "local";\n')
        for channel, binary in clients.items():
            if channel == "stable":
                code, out, err, streams = observed(case_id + "-lock", channel, root, ["/tools/bun", "--no-env-file", "install", "--lockfile-only", "--ignore-scripts"], binary)
                assert code == 0 and (root / "bun.lock").is_file(), (case_id, "offline lock prerequisite failed")
            code, out, err, version_streams = observed(case_id + "-version", channel, root, ["/tools/turbo", "--skip-infer", "--version"], binary)
            assert code == 0 and out.strip() == pins[channel]["reportedVersion"], "Native version mismatch."
            before = snapshot(root)
            code, out, err, streams = observed(case_id, channel, root, ["/tools/turbo", "--skip-infer", "--no-color", "boundaries"], binary)
            unchanged = snapshot(root) == before
            assert unchanged and not list(root.rglob("executed.txt")), "A checker changed fixture input or executed a task."
            combined = out + err
            row = {"case": case_id, "channel": channel, "version": pins[channel]["reportedVersion"], "exitCode": code, "expectedExitCode": expected_exit, "diagnosticWitnesses": {w: w in combined for w in witnesses}, "fixtureSourcesUnchanged": unchanged, "fixtureTaskExecutions": 0, "streams": streams, "versionStreams": version_streams}
            rows.append(row)
            with (args.raw_dir / "partial-rows.json").open("w") as stream:
                json.dump(rows, stream, indent=2)
                stream.write("\n")
            assert code == expected_exit and all(row["diagnosticWitnesses"].values()), (case_id, channel, code, expected_exit, row["diagnosticWitnesses"])
guard_sources()
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], "Native client moved."
for name, path in [("bun", bun), ("bwrap", Path("/usr/bin/bwrap"))]:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == tool_hashes[name], "Fixture tool moved."
assert not any(root.exists() for root in owned_roots), "Owned fixture cleanup failed."
report = {"schemaVersion": "native-boundaries-controls/v1", "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sourceRevision": subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=5).strip(), "sourceBindings": [{"path": p.relative_to(repo).as_posix(), "sha256": hashlib.sha256(data).hexdigest()} for p, data in sources.items()], "clients": {channel: {"version": pins[channel]["reportedVersion"], "sha256": pins[channel]["sha256"]} for channel in clients}, "toolHashes": tool_hashes, "rows": rows, "counts": {"cases": len(rows), "positive": sum(r["exitCode"] == 0 for r in rows), "negative": sum(r["exitCode"] != 0 for r in rows), "fixtureTaskExecutions": 0, "rawBytes": raw_bytes}, "sourceAndToolsUnchanged": True, "networkIsolated": True, "ownedFixturesRemoved": True, "scope": "Actual offline synthetic boundary checks only; no Beep scan, quality suite, task execution, feature activation or tuple qualification."}
encoded = (json.dumps(report, indent=2) + "\n").encode()
assert len(encoded) <= 2 * 1024 * 1024, "Compact report exceeds two MiB."
with args.output.open("xb") as stream:
    stream.write(encoded)
print(json.dumps(report["counts"]))
