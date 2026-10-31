"""Bounded current-source Cargo applicability: dry graphs, no task execution."""

import argparse
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

if not __debug__:
    raise SystemExit("Assertion checks are required; run without Python -O.")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path)
arguments = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
out = (arguments.output or repo / ".beep/cargo-feature-review/current").resolve()
out.mkdir(mode=0o700, parents=True, exist_ok=True)
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
originalInvoke = ast.get_source_segment(source, node)
assert isinstance(originalInvoke, str)
assert originalInvoke.count("len(stdout) <= 1024 * 1024") == 1
adaptedInvoke = originalInvoke.replace(
    "len(stdout) <= 1024 * 1024", "len(stdout) <= 8 * 1024 * 1024"
)
node = ast.parse(adaptedInvoke).body[0]
ns = {
    "time": time,
    "subprocess": subprocess,
    "os": os,
    "signal": signal,
    "deadline": time.monotonic() + 180,
}
exec(compile(ast.Module(body=[node], type_ignores=[]), str(shared), "exec"), ns)
invoke = ns["invoke"]
pins = json.loads(
    (
        repo
        / "goals/turborepo-quality-cache-adoption/research/current-client-pins.json"
    ).read_text()
)
clients = {
    "stable": repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home() / ".cache/beep/turbo-goals-clients/2.11.9-canary.1/turbo",
}
tracked = (
    subprocess.check_output(["git", "ls-files", "-z"], cwd=repo, timeout=5)
    .decode()
    .split("\0")
)
tracked = [p for p in tracked if p]
sources = [
    "package.json",
    "bun.lock",
    "turbo.json",
    ".bun-version",
    ".nvmrc",
    ".github/workflows/check.yml",
    ".github/workflows/release-desktop.yml",
    "scripts/ci-change-profile.sh",
    "apps/professional-desktop/scripts/build-sidecar.ts",
    "apps/professional-desktop/test/integration/sidecar-ipc-stdio.test.ts",
]
sources += sorted(
    p
    for p in tracked
    if (
        p.endswith("/Cargo.toml")
        or p.endswith("/Cargo.lock")
        or p.endswith(".rs")
        or p.endswith(".c")
        or p.endswith("/package.json")
        or p.endswith("/turbo.json")
        or p
        in [
            "apps/professional-desktop/package.json",
            "apps/labs/semantica/package.json",
            "apps/professional-desktop/src-tauri/tauri.conf.json",
            "apps/labs/semantica/src-tauri/tauri.conf.json",
        ]
    )
)
digests = {p: hashlib.sha256((repo / p).read_bytes()).hexdigest() for p in sources}
config = json.loads((repo / "turbo.json").read_text())
head = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5
).strip()
rows = []
cache = Path.home() / ".cache/beep/turbo-cargo-feature-probe"
cache.mkdir(mode=0o700, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="current-source-", dir=cache) as tmp:
    private = Path(tmp)
    (private / "home").mkdir()
    (private / "cargo-home").mkdir()
    env = {
        "HOME": str(private / "home"),
        "PATH": str(
            Path.home() / ".rustup/toolchains/1.99.1-x86_64-unknown-linux-gnu/bin"
        )
        + ":/usr/bin:/bin",
        "CARGO_HOME": str(private / "cargo-home"),
        "CARGO_NET_OFFLINE": "true",
        "TURBO_TELEMETRY_DISABLED": "1",
        "TOKIO_WORKER_THREADS": "2",
        "CI": "1",
        "NO_COLOR": "1",
    }
    for channel, binpath in clients.items():
        assert (
            hashlib.sha256(binpath.read_bytes()).hexdigest() == pins[channel]["sha256"]
        )
        prior = None
        for enabled in [False, True]:
            c = json.loads(json.dumps(config))
            c["futureFlags"]["experimentalCargoWorkspaces"] = enabled
            p = private / ("cargo-" + str(enabled).lower() + ".json")
            p.write_text(json.dumps(c) + "\n")
            p.chmod(0o600)
            label = channel + "-" + str(enabled).lower()
            argv = [
                str(binpath),
                "--skip-infer",
                "--root-turbo-json",
                str(p),
                "run",
                "build",
                "--filter=@beep/professional-desktop",
                "--filter=@beep/semantica",
                "--only",
                "--dry=json",
                "--cache=local:r",
            ]
            rc, stdout, stderr = invoke(argv, repo, env)
            for suffix, raw in [("stdout", stdout), ("stderr", stderr)]:
                q = out / (label + "." + suffix)
                q.write_bytes(raw)
                q.chmod(0o600)
            assert rc == 0, (label, stderr.decode()[:800])
            d = json.loads(stdout)
            tasks = d["tasks"]
            assert {"@beep/professional-desktop#build", "@beep/semantica#build"} <= {
                t["taskId"] for t in tasks
            }
            assert d["packages"] == ["@beep/professional-desktop", "@beep/semantica"]
            assert all(
                t["taskId"].startswith("@beep/")
                and not t["directory"].endswith("src-tauri")
                for t in tasks
            )
            observed = [
                {
                    k: t.get(k)
                    for k in [
                        "taskId",
                        "command",
                        "directory",
                        "dependencies",
                        "inputs",
                        "outputs",
                        "resolvedTaskDefinition",
                    ]
                }
                for t in tasks
            ]
            assert all(x["command"] == "bun run beep:build" for x in observed)
            if enabled:
                assert observed == prior, (
                    "Cargo discovery unexpectedly changed selected Bun task semantics"
                )
            else:
                prior = observed
            rows.append(
                {
                    "channel": channel,
                    "enabled": enabled,
                    "exit": rc,
                    "configSha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                    "tasks": [
                        {
                            k: t.get(k)
                            for k in [
                                "taskId",
                                "command",
                                "directory",
                                "dependencies",
                                "hash",
                                "outputs",
                            ]
                        }
                        for t in tasks
                        if t["taskId"]
                        in {"@beep/professional-desktop#build", "@beep/semantica#build"}
                    ],
                    "taskIdsIncludingDependencies": [t["taskId"] for t in tasks],
                    "semanticGraphSha256": hashlib.sha256(
                        json.dumps(
                            observed, sort_keys=True, separators=(",", ":")
                        ).encode()
                    ).hexdigest(),
                    "nativeSummarySha256": hashlib.sha256(stdout).hexdigest(),
                    "nativeSummaryBytes": len(stdout),
                    "taskCountIncludingDependencies": len(tasks),
                    "sameSelectedTaskSemanticsAsDisabled": enabled,
                }
            )
        assert (
            hashlib.sha256(binpath.read_bytes()).hexdigest() == pins[channel]["sha256"]
        )
assert all(
    hashlib.sha256((repo / p).read_bytes()).hexdigest() == h for p, h in digests.items()
)
assert (
    subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=repo, text=True, timeout=5
    ).strip()
    == head
)
report = {
    "schemaVersion": "cargo-current-applicability/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceHead": head,
    "authority": "Current-source selected-task dry graphs and tracked source applicability only; no task execution, qualification or activation.",
    "driverSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "orchestrator": {
        "pythonVersion": sys.version.split()[0],
        "executableSha256": hashlib.sha256(
            Path(sys.executable).resolve().read_bytes()
        ).hexdigest(),
    },
    "captureBoundBytes": 8 * 1024 * 1024,
    "stderrBoundBytes": 1024 * 1024,
    "originalInvokeSha256": hashlib.sha256(originalInvoke.encode()).hexdigest(),
    "adaptedInvokeSha256": hashlib.sha256(adaptedInvoke.encode()).hexdigest(),
    "rootCargoManifestPresent": (repo / "Cargo.toml").exists(),
    "rootCargoManifestTracked": "Cargo.toml" in tracked,
    "sourceSha256": digests,
    "clients": {
        k: {"version": pins[k]["reportedVersion"], "sha256": pins[k]["sha256"]}
        for k in clients
    },
    "observations": rows,
    "sourceUnchanged": True,
    "fixtureRemoved": not private.exists(),
}
p = out / "report.json"
p.write_text(json.dumps(report, indent=2) + "\n")
p.chmod(0o600)
print(
    json.dumps(
        {
            "calls": len(rows),
            "sourceUnchanged": True,
            "selectedTasksUnchanged": True,
            "rootCargoManifestPresent": report["rootCargoManifestPresent"],
            "fixtureRemoved": report["fixtureRemoved"],
        }
    )
)
