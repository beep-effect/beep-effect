"""Observe pinned Turbo input/hash behavior in isolated local-only fixtures.

Run with python3 from any directory. No credentials or network are used. The
bounded report and native output logs stay under the checkout's ignored .beep.
Every owned disposable fixture is removed before the report is written.
"""

import datetime
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if sys.flags.optimize:
    print(
        "Native input verification requires Python assertions; optimized execution is refused."
    )
    raise SystemExit(64)

repo = Path(__file__).resolve().parents[3]
base = repo / ".beep/native-feature-controls"
base.mkdir(mode=0o700, parents=True, exist_ok=True)
cache = Path.home() / ".cache/beep/turbo-feature-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
bun_name = shutil.which("bun")
assert bun_name, "Bun is required"
bun = Path(
    subprocess.check_output(
        [bun_name, "-p", "process.execPath"], timeout=5, text=True
    ).strip()
)
assert (
    subprocess.check_output([str(bun), "--version"], timeout=5, text=True).strip()
    == (repo / ".bun-version").read_text().strip()
), "Bun pin changed"
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
rows = []
roots = {}
current = None
try:
    for channel, binary in clients.items():
        assert (
            hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"]
        ), f"{channel} native pin changed"
        directory = Path(tempfile.mkdtemp(prefix=channel + "-", dir=cache))
        roots[channel] = directory
        (directory / "home").mkdir(mode=0o700)
        (directory / "cache").mkdir(mode=0o700)
        (directory / "package.json").write_text(
            json.dumps(
                {
                    "name": "synthetic-input-controls",
                    "version": "0.0.0",
                    "packageManager": "bun@1.4.4",
                    "scripts": {"probe": str(bun) + " run probe.mjs"},
                }
            )
            + "\n"
        )
        config = {
            "futureFlags": {"globalConfiguration": True},
            "global": {
                "inputs": ["global.txt"],
                "env": ["SEMANTIC"],
                "passThroughEnv": ["BENIGN"],
            },
            "tasks": {
                "probe": {
                    "inputs": ["input.txt", "probe.mjs", "package.json"],
                    "outputs": ["out.txt"],
                    "cache": True,
                }
            },
        }
        (directory / "turbo.json").write_text(json.dumps(config) + "\n")
        (directory / "input.txt").write_text("A")
        (directory / "global.txt").write_text("global-A")
        script = "await Bun.write('out.txt', (await Bun.file('input.txt').text()) + ':' + process.env.SEMANTIC);\n"
        (directory / "probe.mjs").write_text(script)
        env = {
            "PATH": str(bun.parent) + ":/usr/bin:/bin",
            "HOME": str(directory / "home"),
            "XDG_CACHE_HOME": str(directory / "cache"),
            "CI": "1",
            "TURBO_TELEMETRY_DISABLED": "1",
            "TURBO_DAEMON": "false",
            "SEMANTIC": "A",
            "BENIGN": "A",
        }
        prior = None
        controls = [
            ("cold", False, False),
            ("exact-restore", True, True),
            ("input-change", False, False),
            ("semantic-env-change", False, False),
            ("passthrough-env-change", True, True),
            ("global-input-change", False, False),
            ("unrelated-file-change", True, True),
            ("implementation-byte-change", False, False),
            ("description-only-change", None, None),
        ]
        for name, expected_hit, same_hash in controls:
            current = f"{channel}:{name}"
            if name == "input-change":
                (directory / "input.txt").write_text("B")
            elif name == "semantic-env-change":
                env["SEMANTIC"] = "B"
            elif name == "passthrough-env-change":
                env["BENIGN"] = "B"
            elif name == "global-input-change":
                (directory / "global.txt").write_text("global-B")
            elif name == "unrelated-file-change":
                (directory / "unrelated.txt").write_text("unrelated")
            elif name == "implementation-byte-change":
                (directory / "probe.mjs").write_text(
                    script + "// reviewed synthetic byte change\n"
                )
            elif name == "description-only-change":
                config["tasks"]["probe"]["description"] = (
                    "A synthetic nonsemantic description"
                )
                (directory / "turbo.json").write_text(json.dumps(config) + "\n")
            (directory / "out.txt").unlink(missing_ok=True)
            before = set((directory / ".turbo/runs").glob("*.json"))
            log = base / f"{channel}-{name}.log"
            with log.open("wb") as output:
                result = subprocess.run(
                    [
                        str(binary),
                        "--skip-infer",
                        "run",
                        "probe",
                        "--single-package",
                        "--cache=local:rw",
                        "--summarize",
                        "--output-logs=none",
                        "--concurrency=1",
                        "--env-mode=strict",
                    ],
                    check=False,
                    cwd=directory,
                    env=env,
                    stdout=output,
                    stderr=subprocess.STDOUT,
                    timeout=30,
                )
            assert result.returncode == 0, f"{current} native exit {result.returncode}"
            after = set((directory / ".turbo/runs").glob("*.json"))
            created = after - before
            assert len(created) == 1, (current, "summary count", len(created))
            summary = json.loads(created.pop().read_text())
            tasks = summary["tasks"]
            assert len(tasks) == 1, (current, "nonexecution or unexpected task count")
            task = tasks[0]
            observed_hit = task["cache"]["status"] == "HIT"
            task_hash = task["hash"]
            assert expected_hit is None or observed_hit == expected_hit, (
                current,
                "cache result",
                task["cache"]["status"],
            )
            assert (
                prior is None or same_hash is None or (task_hash == prior) == same_hash
            ), (current, "hash equality", task_hash, prior)
            expected = (directory / "input.txt").read_text() + ":" + env["SEMANTIC"]
            assert (directory / "out.txt").read_text() == expected, (
                current,
                "restored output differs",
            )
            rows.append(
                {
                    "channel": channel,
                    "control": name,
                    "kind": "descriptive-config-observation"
                    if expected_hit is None
                    else "asserted-invariant",
                    "cacheStatus": task["cache"]["status"],
                    "taskHash": task_hash,
                    "sameHashAsPrior": prior is not None and task_hash == prior,
                    "outputMatches": True,
                    "exit": result.returncode,
                }
            )
            prior = task_hash
finally:
    for fixture in roots.values():
        shutil.rmtree(fixture)
    report = {
        "schemaVersion": "cache-native-feature-input-controls/v1",
        "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
        "authority": "synthetic-native-feature-observation-only",
        "bunVersion": (repo / ".bun-version").read_text().strip(),
        "bunSha256": hashlib.sha256(bun.read_bytes()).hexdigest(),
        "clients": {
            c: {
                "reportedVersion": pins[c]["reportedVersion"],
                "sha256": pins[c]["sha256"],
            }
            for c in clients
        },
        "results": rows,
        "completed": len(rows) == 18,
        "lastControl": current,
        "assertedInvariants": 16,
        "descriptionObservations": 2,
        "initialDescriptionReuseHypothesis": "Stable returned MISS; the first interrupted hypothesis run remains separately retained. Description cases record observed behavior without assuming hash reuse.",
        "representativeTraffic": False,
        "qualificationOrDeployment": False,
        "limits": [
            "Local Linux synthetic single-package profile only.",
            "Each process has a thirty-second deadline and runs sequentially with strict environment and local-only cache.",
            "These controls do not establish complete semantic inputs for any real Beep computation.",
            "No production cache, key, namespace, credential or task setting changed.",
        ],
    }
    report["driverSha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    report["driver"] = {
        "path": Path(__file__).resolve().relative_to(repo).as_posix(),
        "sha256": report["driverSha256"],
    }
    report["allOwnedFixturesRemoved"] = True
    (base / "native-input-controls.json").write_text(
        json.dumps(report, indent=2) + "\n"
    )
print(
    f"{len(rows)} native stable/canary executions completed (16 invariant controls and 2 description observations); no production changes."
)
