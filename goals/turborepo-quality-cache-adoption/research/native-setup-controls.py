"""Exercise pinned native setup modes without network access or task execution.

The bounded stream collector is reused from the existing availability driver
without importing that file's executable top-level experiment. Explicit skip
policies are positive controls; default managed-policy failures are prerequisites,
not evidence that setup is unimplemented. This grants no task qualification.
"""

import ast, datetime, hashlib, json, os, re, selectors, signal, subprocess, tempfile, time
from pathlib import Path
import argparse

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
source_reader = research / "native-future-flag-availability.py"
source_reader_bytes = source_reader.read_bytes()
source_reader_node = next(n for n in ast.parse(source_reader_bytes).body
                          if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
source_reader_namespace = {"os": os}
exec(compile(ast.Module(body=[source_reader_node], type_ignores=[]), str(source_reader), "exec"), source_reader_namespace)
read_contained_source = source_reader_namespace["read_contained_source"]
base = repo / ".beep/setup-native-controls"
base.mkdir(parents=True, mode=0o700, exist_ok=True)
raw = Path(tempfile.mkdtemp(prefix="raw-", dir=base))
cache = Path.home() / ".cache/beep/turbo-setup-locked-controls"
cache.mkdir(parents=True, mode=0o700, exist_ok=True)
harness = (
    repo
    / "goals/turborepo-quality-cache-adoption/research/native-future-flag-availability.py"
)
pins_file = (args.pins or research / "errors-only-client-pins.json").resolve()
pins_file.relative_to(repo)
source_paths = [Path(__file__).resolve(), harness, pins_file, repo / ".bun-version"]
captured_sources = {path: (source_reader_bytes if path == source_reader else read_contained_source(path, repo)) for path in source_paths}
source_hashes = {str(path): hashlib.sha256(data).hexdigest() for path, data in captured_sources.items()}
parsed = ast.parse(captured_sources[harness])
fn = next(
    n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == "run_bounded"
)
capture_namespace = {
    "time": time,
    "os": os,
    "selectors": selectors,
    "signal": signal,
    "subprocess": subprocess,
}
exec(
    compile(ast.Module(body=[fn], type_ignores=[]), str(harness), "exec"),
    capture_namespace,
)
run_bounded = capture_namespace["run_bounded"]
pins = json.loads(captured_sources[pins_file])
assert all(read_contained_source(path, repo) == data for path, data in captured_sources.items()), "Observation sources changed before probes."
clients = {
    "stable": (
        args.stable or repo / "node_modules/@turbo/linux-64/bin/turbo",
        pins["stable"]["sha256"],
    ),
    "canary": (
        Path.home()
        / ".cache/beep/turbo-goals-clients"
        / pins["canary"]["packageVersion"]
        / "turbo",
        pins["canary"]["sha256"],
    ),
}
bun = Path(
    subprocess.check_output(
        ["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5
    ).strip()
)
bun_version = subprocess.check_output(
    [str(bun), "--version"], text=True, timeout=5
).strip()
assert bun_version == captured_sources[repo / ".bun-version"].decode().strip(), "Bun pin changed."
source_revision = subprocess.check_output(
    ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=5
).strip()
tool_paths = {
    "bun": bun,
    "git": Path("/usr/bin/git"),
    "bwrap": Path("/usr/bin/bwrap"),
    **{k: v[0] for k, v in clients.items()},
}
tool_hashes = {
    k: hashlib.sha256(p.read_bytes()).hexdigest() for k, p in tool_paths.items()
}
start = time.monotonic()
capture_namespace["start"] = start
rows = []
fixture_pins = []
for channel, (binary, digest) in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == digest
    with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as tmp:
        root = Path(tmp)
        (root / "packages/a").mkdir(parents=True)
        (root / "package.json").write_text(
            json.dumps(
                {
                    "name": "beep-setup-probe",
                    "version": "0.0.0",
                    "private": True,
                    "packageManager": "bun@" + bun_version,
                    "workspaces": ["packages/*"],
                    "scripts": {"probe": "printf executed > sentinel; exit 37"},
                }
            )
            + "\n"
        )
        (root / "packages/a/package.json").write_text(
            json.dumps(
                {
                    "name": "setup-fixture-a",
                    "version": "0.0.0",
                    "scripts": {"probe": "printf executed > sentinel; exit 37"},
                }
            )
            + "\n"
        )
        env = {
            "PATH": "/tools:/usr/bin",
            "HOME": "/nonexistent",
            "CI": "1",
            "TURBO_TELEMETRY_DISABLED": "1",
            "TURBO_DAEMON": "false",
            "BUN_INSTALL_CACHE_DIR": "/tmp/bun-cache",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null",
        }
        mount = [
            "--unshare-all",
            "--die-with-parent",
            "--new-session",
            "--ro-bind",
            "/usr",
            "/usr",
            "--symlink",
            "usr/lib",
            "/lib",
            "--symlink",
            "usr/lib",
            "/lib64",
            "--symlink",
            "usr/bin",
            "/bin",
            "--proc",
            "/proc",
            "--dev",
            "/dev",
            "--tmpfs",
            "/tmp",
            "--dir",
            "/tools",
            "--ro-bind",
            str(binary),
            "/tools/turbo",
            "--ro-bind",
            str(bun),
            "/tools/bun",
            "--bind",
            str(root),
            "/fixture",
            "--chdir",
            "/fixture",
            "--",
        ]
        capture_namespace["command"] = mount + [
            "/tools/turbo",
            "--skip-infer",
            "--version",
        ]
        native_code, native_out, native_err = run_bounded("/usr/bin/bwrap", root, env)
        assert (
            native_code == 0
            and native_out.decode().strip() == pins[channel]["reportedVersion"]
            and not native_err
        ), "Native client version mismatch"
        capture_namespace["command"] = mount + ["/tools/bun", "--version"]
        version_code, version_out, version_err = run_bounded(
            "/usr/bin/bwrap", root, env
        )
        assert version_code == 0 and version_out.decode().strip() == bun_version, (
            "Sandboxed Bun pin mismatch"
        )
        capture_namespace["command"] = mount + [
            "/tools/bun",
            "--no-env-file",
            "install",
            "--lockfile-only",
            "--ignore-scripts",
        ]
        code, out, err = run_bounded("/usr/bin/bwrap", root, env)
        (raw / (channel + "-lock.stdout")).write_bytes(out)
        (raw / (channel + "-lock.stderr")).write_bytes(err)
        assert code == 0, (channel, "lock-generation-failed")
        assert (root / "bun.lock").is_file()
        git_env = {
            "PATH": "/usr/bin",
            "HOME": "/nonexistent",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null",
        }
        subprocess.run(
            ["git", "init", "--quiet", str(root)],
            env=git_env,
            check=True,
            timeout=5,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "add",
                "package.json",
                "bun.lock",
                "packages/a/package.json",
            ],
            env=git_env,
            check=True,
            timeout=5,
            stdout=subprocess.DEVNULL,
        )
        subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "-c",
                "user.name=Beep Synthetic Fixture",
                "-c",
                "user.email=fixture@example.invalid",
                "-c",
                "commit.gpgsign=false",
                "-c",
                "core.hooksPath=/dev/null",
                "commit",
                "--quiet",
                "-m",
                "test: frozen setup fixture",
            ],
            env=git_env,
            check=True,
            timeout=5,
            stdout=subprocess.DEVNULL,
        )
        (root / ".gitignore").write_text("/.turbo/\n")
        lock = (root / "bun.lock").read_bytes()
        fixture_pins.append(
            {
                "channel": channel,
                "bunLockSha256": hashlib.sha256(lock).hexdigest(),
                "committedBunLock": True,
            }
        )
        for policy in ["default", "skip"]:
            for state in ["absent", "false", "true"]:
                for mode in ["provision", "plan", "check"]:
                    config = {"tasks": {"probe": {"cache": False, "outputs": []}}}
                    if policy == "skip":
                        config["setup"] = {"tools": "skip", "dependencies": "skip"}
                    if state != "absent":
                        config["futureFlags"] = {"experimentalSetup": state == "true"}
                    (root / "turbo.json").write_text(json.dumps(config) + "\n")
                    before = {
                        p.relative_to(root).as_posix(): hashlib.sha256(
                            p.read_bytes()
                        ).hexdigest()
                        for p in root.rglob("*")
                        if p.is_file() and ".git" not in p.relative_to(root).parts
                    }
                    capture_namespace["command"] = (
                        mount
                        + [
                            "/tools/turbo",
                            "--skip-infer",
                            "--no-update-notifier",
                            "setup",
                            "--offline",
                            "--no-frozen",
                        ]
                        + ([] if mode == "provision" else ["--" + mode])
                    )
                    code, out, err = run_bounded("/usr/bin/bwrap", root, env)
                    name = channel + "-" + policy + "-" + state + "-" + mode
                    (raw / (name + ".stdout")).write_bytes(out)
                    (raw / (name + ".stderr")).write_bytes(err)
                    text = (out + b"\n" + err).decode("utf-8", errors="replace")
                    normalized = re.sub(r"\s+", " ", text.replace("|", ""))
                    if state != "true":
                        assert code == 1 and (
                            "turbo::setup::disabled" in text
                            or 'requires "futureFlags.experimentalSetup"' in normalized
                        ), (channel, policy, state, mode, "flag-refusal")
                        classification = "flag-required"
                    elif policy == "skip":
                        assert code == 0 and not err, (
                            channel,
                            policy,
                            state,
                            mode,
                            "skip-positive",
                        )
                        classification = "skip-policy-success"
                    else:
                        assert code == 1 and (
                            "turbo.lock" in normalized
                            or ("offline" in normalized and "resolution" in normalized)
                        ), (channel, policy, state, mode, "managed-precondition")
                        classification = "managed-policy-prerequisite"
                    after = {
                        p.relative_to(root).as_posix(): hashlib.sha256(
                            p.read_bytes()
                        ).hexdigest()
                        for p in root.rglob("*")
                        if p.is_file() and ".git" not in p.relative_to(root).parts
                    }
                    assert (
                        not (root / "sentinel").exists()
                        and not (root / "packages/a/sentinel").exists()
                    )
                    rows.append(
                        {
                            "channel": channel,
                            "policy": policy,
                            "flag": state,
                            "mode": mode,
                            "exit": code,
                            "classification": classification,
                            "fileBytesUnchanged": before == after,
                            "changedFiles": sorted(
                                k
                                for k in before.keys() | after.keys()
                                if before.get(k) != after.get(k)
                            ),
                            "sentinelExecuted": False,
                            "stdoutSha256": hashlib.sha256(out).hexdigest(),
                            "stderrSha256": hashlib.sha256(err).hexdigest(),
                        }
                    )
assert len(rows) == 36 and time.monotonic() - start < 600
assert all(r["fileBytesUnchanged"] and not r["sentinelExecuted"] for r in rows)
assert all(
    hashlib.sha256(read_contained_source(Path(p), repo)).hexdigest() == h
    for p, h in source_hashes.items()
), "Driver/helper/pins changed."
assert all(
    hashlib.sha256(p.read_bytes()).hexdigest() == tool_hashes[k]
    for k, p in tool_paths.items()
), "Executable changed."
assert (
    subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=5
    ).strip()
    == source_revision
), "Source revision changed."
report = {
    "schemaVersion": "turbo-setup-native-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceRevisionAtExecution": source_revision,
    "scope": "Exact native synthetic setup only. No Beep task qualification, protected execution, online provisioning, production flag or performance claim.",
    "driverSha256": source_hashes[str(Path(__file__).resolve())],
    "sharedCaptureSourceSha256": source_hashes[str(harness)],
    "pinsSha256": source_hashes[str(pins_file.resolve())],
    "bunVersion": bun_version,
    "toolSha256": tool_hashes,
    "clients": {
        k: {"reportedVersion": pins[k]["reportedVersion"], "sha256": v[1]}
        for k, v in clients.items()
    },
    "fixtures": fixture_pins,
    "rows": rows,
    "networkIsolated": True,
    "ambientEnvironmentCleared": True,
    "maxSeconds": 600,
    "perProcessMaxSeconds": 20,
    "stdoutMaxBytes": 1048576,
    "stderrMaxBytes": 65536,
    "elapsedSeconds": round(time.monotonic() - start, 3),
}
args.output.parent.mkdir(parents=True, exist_ok=True)
with os.fdopen(
    os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w"
) as f:
    f.write(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {
            "cases": len(rows),
            "classifications": sorted(set(r["classification"] for r in rows)),
            "taskExecutions": 0,
            "fileBytesChanged": False,
        }
    )
)
