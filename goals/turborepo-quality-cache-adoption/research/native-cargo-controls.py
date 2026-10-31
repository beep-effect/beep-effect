"""Bounded pinned Cargo discovery and runtime controls; isolated fixtures only."""

import ast
import datetime
import hashlib
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

if __debug__ is False:
    raise SystemExit(64)
import argparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path)
arguments = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
out = (arguments.output or repo / ".beep/cargo-feature-review/synthetic").resolve()
out.mkdir(mode=0o700, parents=True, exist_ok=True)
cache = Path.home() / ".cache/beep/turbo-cargo-feature-probe"
cache.mkdir(mode=0o700, exist_ok=True)
shared = (
    repo
    / "goals/turborepo-quality-cache-adoption/research/native-selection-controls.py"
)
source = shared.read_text()
node = next(
    n
    for n in ast.parse(source).body
    if isinstance(n, ast.FunctionDef) and n.name == "invoke"
)
namespace = {
    "time": time,
    "subprocess": subprocess,
    "os": os,
    "signal": signal,
    "deadline": time.monotonic() + 180,
}
exec(compile(ast.Module(body=[node], type_ignores=[]), str(shared), "exec"), namespace)
invoke = namespace["invoke"]
pins = json.loads(
    (
        repo
        / "goals/turborepo-quality-cache-adoption/research/current-client-pins.json"
    ).read_text()
)
clients = {
    "stable": (repo / "node_modules/@turbo/linux-64/bin/turbo").resolve(),
    "canary": (
        Path.home() / ".cache/beep/turbo-goals-clients/2.11.9-canary.1/turbo"
    ).resolve(),
}
bun = Path(
    subprocess.check_output(
        ["bun", "--no-env-file", "-p", "process.execPath"], text=True, timeout=5
    ).strip()
)
cargo = Path.home() / ".rustup/toolchains/1.99.1-x86_64-unknown-linux-gnu/bin/cargo"
rustc = cargo.parent / "rustc"
tools = {"bun": bun, "cargo": cargo, "rustc": rustc}
digests = {n: hashlib.sha256(p.read_bytes()).hexdigest() for n, p in tools.items()}
versions = {
    n: subprocess.check_output([str(p), "--version"], text=True, timeout=5).strip()
    for n, p in tools.items()
}
assert versions["bun"] == (repo / ".bun-version").read_text().strip()
assert versions["cargo"].startswith("cargo 1.99.1 ") and versions["rustc"].startswith(
    "rustc 1.99.1 "
)
for parent in [cache, *cache.parents]:
    for suffix in [".cargo/config", ".cargo/config.toml"]:
        assert not (parent / suffix).exists(), (
            "Ancestor Cargo configuration would contaminate the probe"
        )
rows = []
roots = []
runtime_rows = []
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"]
    for shape in ["standalone-nested", "virtual-root-workspace"]:
        with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as name:
            root = Path(name)
            roots.append(root)
            for folder in [
                "home",
                "cargo-home",
                "bun-cache",
                "libs/shared/src",
                "shared",
            ]:
                (root / folder).mkdir(mode=0o700, parents=True, exist_ok=True)
            env = {
                "PATH": str(cargo.parent) + ":" + str(bun.parent) + ":/usr/bin:/bin",
                "HOME": str(root / "home"),
                "CARGO_HOME": str(root / "cargo-home"),
                "CARGO_NET_OFFLINE": "true",
                "CARGO_BUILD_JOBS": "1",
                "RUSTC": str(rustc),
                "BUN_INSTALL_CACHE_DIR": str(root / "bun-cache"),
                "CI": "1",
                "TURBO_TELEMETRY_DISABLED": "1",
                "NO_COLOR": "1",
                "TOKIO_WORKER_THREADS": "2",
            }
            code, stdout, stderr = invoke(
                [str(binary), "--skip-infer", "--version"], root, env
            )
            assert (
                code == 0
                and stdout.decode().strip() == pins[channel]["reportedVersion"]
            )
            (root / "package.json").write_text(
                json.dumps(
                    {
                        "name": "cargo-discovery-probe",
                        "private": True,
                        "packageManager": "bun@" + versions["bun"],
                        "workspaces": ["apps/*"],
                    }
                )
                + "\n"
            )
            (root / ".gitignore").write_text(
                "target/\n.turbo/\nhome/\ncargo-home/\nbun-cache/\n"
            )
            (root / "shared/config.txt").write_text("external-A\n")
            (root / "libs/shared/Cargo.toml").write_text(
                '[package]\nname="shared-native"\nversion="0.1.0"\nedition="2021"\n'
            )
            (root / "libs/shared/src/lib.rs").write_text(
                'pub fn value() -> &\'static str { "library-A" }\n'
            )
            for label in ["a", "b"]:
                p = root / "apps" / label
                (p / "src-tauri/src").mkdir(parents=True)
                (p / "package.json").write_text(
                    json.dumps(
                        {
                            "name": "web-" + label,
                            "version": "0.0.0",
                            "scripts": {
                                "build": str(bun) + " --no-env-file run probe.mjs",
                                "check": str(bun) + " --no-env-file run probe.mjs",
                            },
                        }
                    )
                    + "\n"
                )
                (p / "probe.mjs").write_text('await Bun.write("done.txt", "web");\n')
                (p / "src-tauri/Cargo.toml").write_text(
                    '[package]\nname="app-'
                    + label
                    + '-native"\nversion="0.1.0"\nedition="2021"\n[dependencies]\nshared-native={path="../../../libs/shared"}\n'
                )
                (p / "src-tauri/src/main.rs").write_text(
                    'fn main() { println!("{}:{}", shared_native::value(), include_str!("../../../../shared/config.txt").trim()); }\n'
                )
            if shape == "virtual-root-workspace":
                (root / "Cargo.toml").write_text(
                    '[workspace]\nmembers=["apps/a/src-tauri","apps/b/src-tauri","libs/shared"]\nresolver="2"\n[workspace.metadata]\nname="native-workspace"\n'
                )
                code, stdout, stderr = invoke(
                    [str(cargo), "generate-lockfile", "--offline"], root, env
                )
                assert code == 0, (shape, stderr.decode()[:400])
            else:
                for label in ["a", "b"]:
                    code, stdout, stderr = invoke(
                        [
                            str(cargo),
                            "generate-lockfile",
                            "--offline",
                            "--manifest-path",
                            str(root / "apps" / label / "src-tauri/Cargo.toml"),
                        ],
                        root,
                        env,
                    )
                    assert code == 0, (shape, stderr.decode()[:400])
            code, stdout, stderr = invoke(
                [
                    str(bun),
                    "--no-env-file",
                    "install",
                    "--offline",
                    "--lockfile-only",
                    "--ignore-scripts",
                ],
                root,
                env,
            )
            assert code == 0, stderr.decode()[:400]
            code, _, _ = invoke(
                ["/usr/bin/git", "init", "--quiet", "--initial-branch=main"], root, env
            )
            assert code == 0
            for enabled in [False, True]:
                config = {
                    "futureFlags": {
                        "globalConfiguration": True,
                        "affectedUsingTaskInputs": True,
                        "filterUsingTasks": True,
                        "experimentalCargoWorkspaces": enabled,
                    },
                    "global": {
                        "env": [
                            "CARGO_BUILD_JOBS",
                            "CARGO_NET_OFFLINE",
                            "CARGO_HOME",
                            "RUSTC",
                        ]
                    },
                    "tasks": {"build": {}, "check": {}, "format": {}},
                }
                (root / "turbo.json").write_text(json.dumps(config) + "\n")
                label = channel + "-" + shape + "-" + str(enabled).lower()
                code, stdout, stderr = invoke(
                    [
                        str(binary),
                        "--skip-infer",
                        "run",
                        "build",
                        "--dry=json",
                        "--cache=local:rw",
                    ],
                    root,
                    env,
                )
                for suffix, data in [("stdout", stdout), ("stderr", stderr)]:
                    p = out / (label + "." + suffix)
                    p.write_bytes(data)
                    p.chmod(0o600)
                data = json.loads(stdout) if code == 0 else {}
                rows.append(
                    {
                        "channel": channel,
                        "shape": shape,
                        "enabled": enabled,
                        "exit": code,
                        "packages": data.get("packages", []),
                        "tasks": [
                            {
                                "id": t["taskId"],
                                "command": t.get("command"),
                                "dependencies": t.get("dependencies"),
                                "cache": t.get("cache"),
                                "outputs": t.get("outputs"),
                            }
                            for t in data.get("tasks", [])
                        ],
                        "stderrExcerpt": stderr.decode()[:500].replace(
                            str(root), "<fixture>"
                        ),
                    }
                )
                if shape == "virtual-root-workspace" and enabled:
                    assert code == 0
                    config["tasks"]["app-a-native#build"] = {
                        "cache": True,
                        "outputs": ["../../../target/debug/app-a-native"],
                    }
                    (root / "turbo.json").write_text(json.dumps(config) + "\n")

                    def execution(case):
                        before = set((root / ".turbo/runs").glob("*.json"))
                        key = channel + "-" + case
                        result, so, se = invoke(
                            [
                                str(binary),
                                "--skip-infer",
                                "run",
                                "build",
                                "--filter=app-a-native",
                                "--cache=local:rw",
                                "--output-logs=none",
                                "--summarize",
                                "--concurrency=1",
                            ],
                            root,
                            env,
                        )
                        for suffix, contents in [("stdout", so), ("stderr", se)]:
                            file = out / (key + "." + suffix)
                            file.write_bytes(contents)
                            file.chmod(0o600)
                        assert result == 0, (
                            key,
                            "Cargo task did not succeed",
                            se.decode()[:600],
                        )
                        summaries = set((root / ".turbo/runs").glob("*.json")) - before
                        assert len(summaries) == 1, (key, "summary ambiguity")
                        summary = next(iter(summaries)).read_bytes()
                        assert len(summary) <= 1024 * 1024
                        file = out / (key + "-summary.json")
                        file.write_bytes(summary)
                        file.chmod(0o600)
                        tasks = json.loads(summary)["tasks"]
                        selected = [
                            t for t in tasks if t["taskId"] == "app-a-native#build"
                        ]
                        assert len(selected) == 1
                        task = selected[0]
                        artifact = root / "target/debug/app-a-native"
                        assert artifact.is_file(), (key, "exact deliverable absent")
                        assert artifact.stat().st_mode & 0o111, (
                            key,
                            "restored mode is not executable",
                        )
                        rc, answer, _ = invoke([str(artifact)], root, env)
                        assert rc == 0
                        row = {
                            "channel": channel,
                            "case": case,
                            "nativeExit": result,
                            "taskId": task["taskId"],
                            "hash": task["hash"],
                            "cache": task["cache"]["status"],
                            "artifactSha256": hashlib.sha256(
                                artifact.read_bytes()
                            ).hexdigest(),
                            "programOutput": answer.decode().strip(),
                            "summarySha256": hashlib.sha256(summary).hexdigest(),
                        }
                        runtime_rows.append(row)
                        return row

                    cold = execution("cold")
                    assert (
                        cold["cache"] == "MISS"
                        and cold["programOutput"] == "library-A:external-A"
                    ), cold
                    (root / "target/debug/app-a-native").unlink()
                    replay = execution("removed-deliverable-replay")
                    assert (
                        replay["cache"] == "HIT"
                        and replay["hash"] == cold["hash"]
                        and replay["artifactSha256"] == cold["artifactSha256"]
                    ), replay
                    (root / "libs/shared/src/lib.rs").write_text(
                        'pub fn value() -> &\'static str { "library-B" }\n'
                    )
                    changed = execution("transitive-library-mutation")
                    assert (
                        changed["cache"] == "MISS"
                        and changed["hash"] != cold["hash"]
                        and changed["programOutput"] == "library-B:external-A"
                    ), changed
                    (root / "shared/config.txt").write_text("external-B\n")
                    unsafe = execution("undeclared-external-input-stale")
                    assert (
                        unsafe["cache"] == "HIT"
                        and unsafe["hash"] == changed["hash"]
                        and unsafe["programOutput"] == "library-B:external-A"
                    ), unsafe
                    config["tasks"]["app-a-native#build"]["inputs"] = [
                        "$TURBO_DEFAULT$",
                        "$TURBO_ROOT$/shared/config.txt",
                    ]
                    (root / "turbo.json").write_text(json.dumps(config) + "\n")
                    declared = execution("declared-external-input")
                    assert (
                        declared["cache"] == "MISS"
                        and declared["programOutput"] == "library-B:external-B"
                    ), declared
                    (root / "shared/config.txt").write_text("external-C\n")
                    external = execution("declared-external-mutation")
                    assert (
                        external["cache"] == "MISS"
                        and external["hash"] != declared["hash"]
                        and external["programOutput"] == "library-B:external-C"
                    ), external
                    (root / "libs/shared/src/lib.rs").write_text(
                        'pub fn value() -> &\'static str { "library-C" }\n'
                    )
                    library = execution("preserved-transitive-input")
                    assert (
                        library["cache"] == "MISS"
                        and library["hash"] != external["hash"]
                        and library["programOutput"] == "library-C:external-C"
                    ), library
                    (root / "libs/shared/src/lib.rs").write_text(
                        'pub fn value() -> &\'static str { "library-B" }\n'
                    )
                    (root / "shared/config.txt").write_text("external-B\n")
                    (root / "target/debug/app-a-native").unlink()
                    restored = execution("restored-declared-state")
                    assert (
                        restored["cache"] == "HIT"
                        and restored["hash"] == declared["hash"]
                        and restored["artifactSha256"] == declared["artifactSha256"]
                        and restored["programOutput"] == "library-B:external-B"
                    ), restored

        assert not root.exists()
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"]
for n, p in tools.items():
    assert hashlib.sha256(p.read_bytes()).hexdigest() == digests[n]
report = {
    "schemaVersion": "private-cargo-discovery-probe/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "authority": "Exploratory synthetic Cargo graph and explicit per-crate cache/output configuration; no current-repository qualification, activation or final feature decision.",
    "sourceRevision": subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=5
    ).strip(),
    "driverSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "orchestrator": {
        "pythonVersion": sys.version.split()[0],
        "executableSha256": hashlib.sha256(
            Path(sys.executable).resolve().read_bytes()
        ).hexdigest(),
    },
    "sharedBoundedInvokeSource": {
        "path": str(shared.relative_to(repo)),
        "driverSha256": hashlib.sha256(shared.read_bytes()).hexdigest(),
        "functionSha256": hashlib.sha256(
            ast.get_source_segment(source, node).encode()
        ).hexdigest(),
    },
    "tools": {n: {"version": versions[n], "sha256": digests[n]} for n in tools},
    "clients": pins,
    "fixtureCount": len(roots),
    "fixturesRemoved": all(not p.exists() for p in roots),
    "observations": rows,
    "runtimeControls": runtime_rows,
    "assertedRuntimeCases": len(runtime_rows),
}
p = out / "probe.json"
p.write_text(json.dumps(report, indent=2) + "\n")
p.chmod(0o600)
print(
    json.dumps(
        {
            "fixturesRemoved": report["fixturesRemoved"],
            "nativeGraphCalls": len(rows),
            "assertedRuntimeCases": len(runtime_rows),
        }
    )
)
