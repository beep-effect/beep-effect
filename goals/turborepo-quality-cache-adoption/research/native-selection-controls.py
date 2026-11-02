"""Assert pinned native selection semantics in disposable local-only workspaces.

Run with python3 from any directory. Raw native output remains in the ignored
.beep directory; the compact report contains no absolute paths or environment
values. This is feature evidence, not repository-task qualification or rollout.
"""

import datetime
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

if sys.flags.optimize:
    print(
        "Native selection verification requires assertions; optimized execution is refused."
    )
    raise SystemExit(64)

repo = Path(__file__).resolve().parents[3]
base = repo / ".beep/native-selection-controls"
base.mkdir(mode=0o700, parents=True, exist_ok=True)
base.chmod(0o700)
cache = Path.home() / ".cache/beep/turbo-selection-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
deadline = time.monotonic() + 180


def invoke(command, cwd, environment):
    """Capture one owned process group within the remaining experiment budget."""
    remaining = deadline - time.monotonic()
    assert remaining > 0, "Selection controls exceeded their three-minute budget"
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(timeout=min(10, remaining))
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise AssertionError(
            "Owned selection process group exceeded its deadline"
        ) from None
    assert len(stdout) <= 1024 * 1024 and len(stderr) <= 1024 * 1024, (
        "Native output exceeded one MiB"
    )
    return process.returncode, stdout, stderr


bun_name = shutil.which("bun")
assert bun_name, "Bun is required"
bun = Path(
    subprocess.check_output(
        [bun_name, "--no-env-file", "-p", "process.execPath"], timeout=5, text=True
    ).strip()
)
bun_digest = hashlib.sha256(bun.read_bytes()).hexdigest()
bun_version = subprocess.check_output(
    [str(bun), "--version"], timeout=5, text=True
).strip()
assert bun_version == (repo / ".bun-version").read_text().strip(), "Bun pin changed"
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
fixed_flags = {
    "globalConfiguration": True,
    "affectedUsingTaskInputs": True,
    "filterUsingTasks": True,
}
cases = [
    ("real", ["probe", "--filter=app"]),
    ("missing-command", ["probe", "--filter=empty"]),
    ("explicit-missing-command", ["empty#probe"]),
    ("graph-only", ["collect", "--filter=empty"]),
    ("only", ["probe", "--filter=app", "--only"]),
    ("missing-task", ["nonexistent"]),
    ("missing-package", ["probe", "--filter=missing"]),
    ("empty-glob", ["probe", "--filter=./nonexistent/*"]),
    (
        "empty-selection",
        [
            "probe",
            "--filter=!app",
            "--filter=!base",
            "--filter=!empty",
            "--filter=!phantom",
        ],
    ),
    ("unknown-selector", ["probe", "--filter=["]),
    ("invalid-selector", ["probe", "--filter={./packages/*"]),
]
errors = {
    "missing-task": "Could not find task `nonexistent`",
    "missing-package": "No package found with name 'missing'",
    "empty-glob": "specified in filter does not exist",
    "unknown-selector": "No package found with name '['",
    "invalid-selector": "Invalid regex pattern",
}
rows = []
fixture_roots = []
observed_versions = {}
for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], (
        "Native client pin changed"
    )
    with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as name:
        root = Path(name)
        fixture_roots.append(root)
        (root / "home").mkdir(mode=0o700)
        environment = {
            "PATH": str(bun.parent) + ":/usr/bin:/bin",
            "HOME": str(root / "home"),
            "CI": "1",
            "TURBO_TELEMETRY_DISABLED": "1",
            "NO_COLOR": "1",
            "BUN_INSTALL_CACHE_DIR": str(root / "bun-cache"),
        }
        code, stdout, _ = invoke(
            [str(binary), "--skip-infer", "--version"], root, environment
        )
        observed_versions[channel] = stdout.decode().strip()
        assert (
            code == 0 and observed_versions[channel] == pins[channel]["reportedVersion"]
        ), "Reported pin changed"
        (root / "package.json").write_text(
            json.dumps(
                {
                    "name": "selection-controls",
                    "private": True,
                    "packageManager": "bun@" + bun_version,
                    "workspaces": ["packages/*"],
                }
            )
            + "\n"
        )
        for package, dependency, runnable in [
            ("base", None, True),
            ("app", "base", True),
            ("phantom", None, True),
            ("empty", "phantom", False),
        ]:
            directory = root / "packages" / package
            directory.mkdir(parents=True)
            manifest = {"name": package, "version": "0.0.0"}
            if runnable:
                manifest["scripts"] = {
                    "probe": str(bun) + " --no-env-file run probe.mjs",
                    "prepare": str(bun) + " --no-env-file run prepare.mjs",
                }
                (directory / "probe.mjs").write_text(
                    "await Bun.write('done.txt', " + json.dumps(package) + ");\n"
                )
                (directory / "prepare.mjs").write_text(
                    "await Bun.write('prep.txt', " + json.dumps(package) + ");\n"
                )
            if dependency:
                manifest["dependencies"] = {dependency: "workspace:*"}
            if package == "app":
                manifest["dependencies"]["empty"] = "workspace:*"
            (directory / "package.json").write_text(json.dumps(manifest) + "\n")
        code, _, _ = invoke(
            [
                str(bun),
                "--no-env-file",
                "install",
                "--offline",
                "--lockfile-only",
                "--ignore-scripts",
            ],
            root,
            environment,
        )
        assert code == 0, "Offline workspace lockfile generation failed"
        assert (root / "bun.lock").is_file(), "Workspace lockfile is absent"
        for strict in [False, True]:
            (root / "turbo.json").write_text(
                json.dumps(
                    {
                        "futureFlags": {
                            **fixed_flags,
                            "strictTaskEntrypointSelection": strict,
                        },
                        "tasks": {
                            "probe": {
                                "dependsOn": ["^probe", "prepare"],
                                "cache": False,
                                "outputs": ["done.txt"],
                            },
                            "prepare": {"cache": False, "outputs": ["prep.txt"]},
                            "collect": {"dependsOn": ["^probe"], "cache": False},
                        },
                    }
                )
                + "\n"
            )
            for label, arguments in cases:
                key = channel + "-" + str(strict).lower() + "-" + label
                dry_code, dry_stdout, dry_stderr = invoke(
                    [str(binary), "--skip-infer", "run", *arguments, "--dry=json"],
                    root,
                    environment,
                )
                tasks = json.loads(dry_stdout)["tasks"] if dry_code == 0 else []
                for marker in [
                    *root.glob("packages/*/done.txt"),
                    *root.glob("packages/*/prep.txt"),
                ]:
                    marker.unlink()
                summaries_before = set((root / ".turbo/runs").glob("*.json"))
                run_code, run_stdout, run_stderr = invoke(
                    [
                        str(binary),
                        "--skip-infer",
                        "run",
                        *arguments,
                        "--cache=local:rw",
                        "--output-logs=none",
                        "--summarize",
                    ],
                    root,
                    environment,
                )
                logs = {}
                for suffix, contents in [
                    ("dry.stdout", dry_stdout),
                    ("dry.stderr", dry_stderr),
                    ("run.stdout", run_stdout),
                    ("run.stderr", run_stderr),
                ]:
                    filename = key + "-" + suffix
                    (base / filename).write_bytes(contents)
                    logs[suffix] = {
                        "file": filename,
                        "sha256": hashlib.sha256(contents).hexdigest(),
                        "bytes": len(contents),
                    }
                summaries = (
                    set((root / ".turbo/runs").glob("*.json")) - summaries_before
                )
                assert len(summaries) <= 1, (
                    key,
                    "ambiguous native execution summaries",
                )
                native_tasks = []
                if summaries:
                    contents = next(iter(summaries)).read_bytes()
                    assert len(contents) <= 1024 * 1024, (
                        key,
                        "native summary exceeds one MiB",
                    )
                    native_tasks = json.loads(contents)["tasks"]
                    filename = key + "-summary.json"
                    (base / filename).write_bytes(contents)
                    logs["summary"] = {
                        "file": filename,
                        "sha256": hashlib.sha256(contents).hexdigest(),
                        "bytes": len(contents),
                    }
                ids = sorted(task["taskId"] for task in tasks)
                markers = sorted(
                    path.parent.name for path in root.glob("packages/*/done.txt")
                )
                prepared = sorted(
                    path.parent.name for path in root.glob("packages/*/prep.txt")
                )
                for marker in [
                    *root.glob("packages/*/done.txt"),
                    *root.glob("packages/*/prep.txt"),
                ]:
                    assert marker.read_text() == marker.parent.name, (
                        key,
                        "output content differs",
                    )
                expected_ids = []
                expected_markers = []
                expected_prepared = []
                if label in ["real", "only"]:
                    kinds = ["probe"] if label == "only" else ["prepare", "probe"]
                    expected_ids = sorted(
                        package + "#" + kind
                        for package in ["app", "base", "empty", "phantom"]
                        for kind in kinds
                    )
                    expected_markers = ["app", "base", "phantom"]
                    expected_prepared = [] if label == "only" else expected_markers
                elif label == "explicit-missing-command" or (
                    label == "missing-command" and not strict
                ):
                    expected_ids = [
                        "empty#prepare",
                        "empty#probe",
                        "phantom#prepare",
                        "phantom#probe",
                    ]
                    expected_markers = ["phantom"]
                    expected_prepared = ["phantom"]
                elif label == "graph-only":
                    expected_ids = sorted(
                        [
                            "empty#collect",
                            "phantom#prepare",
                            "phantom#probe",
                            *([] if strict else ["empty#prepare", "empty#probe"]),
                        ]
                    )
                    expected_markers = ["phantom"]
                    expected_prepared = ["phantom"]
                expected_exit = 1 if label in errors else 0
                assert dry_code == run_code == expected_exit, (
                    key,
                    "native exit differs",
                    dry_code,
                    run_code,
                )
                if label in errors:
                    assert (
                        errors[label] in dry_stderr.decode()
                        and errors[label] in run_stderr.decode()
                    ), (key, "wrong refusal")
                assert ids == expected_ids and len(ids) == len(set(ids)), (
                    key,
                    "task graph differs",
                    ids,
                    expected_ids,
                )
                assert markers == expected_markers and prepared == expected_prepared, (
                    key,
                    "actual execution differs",
                )
                for task in tasks:
                    expected_dependencies = []
                    if task["taskId"] == "app#probe":
                        expected_dependencies = ["base#probe", "empty#probe"]
                    elif task["taskId"] in ["empty#probe", "empty#collect"]:
                        expected_dependencies = ["phantom#probe"]
                    if task["task"] == "probe" and label != "only":
                        expected_dependencies = sorted(
                            [*expected_dependencies, task["package"] + "#prepare"]
                        )
                    assert sorted(task["dependencies"]) == expected_dependencies, (
                        key,
                        "dependency edge differs",
                    )
                    has_command = task["command"].strip() not in ["", "<NONEXISTENT>"]
                    assert has_command == (task["package"] != "empty"), (
                        key,
                        "commandless node misclassified",
                    )
                selected = (
                    "app#probe"
                    if label in ["real", "only"]
                    else "empty#collect"
                    if label == "graph-only"
                    else "empty#probe"
                )
                selected_command = any(
                    task["taskId"] == selected and task["command"] != "<NONEXISTENT>"
                    for task in tasks
                )
                assert selected_command == (label in ["real", "only"]), (
                    key,
                    "selected execution misclassified",
                )
                selected_execution = any(
                    task["taskId"] == selected
                    and task["command"].strip() not in ["", "<NONEXISTENT>"]
                    and isinstance(task.get("execution"), dict)
                    for task in native_tasks
                )
                assert selected_execution == selected_command, (
                    key,
                    "actual selected execution record differs",
                )
                rows.append(
                    {
                        "channel": channel,
                        "strictTaskEntrypointSelection": strict,
                        "case": label,
                        "dryExit": dry_code,
                        "executionExit": run_code,
                        "assertionsPassed": True,
                        "tasks": [
                            {
                                "id": task["taskId"],
                                "hasCommand": task["command"] != "<NONEXISTENT>",
                                "dependencies": task["dependencies"],
                            }
                            for task in tasks
                        ],
                        "executedProbePackages": markers,
                        "executedPreparePackages": prepared,
                        "selectedCommandPresent": selected_command,
                        "selectedNativeExecutionRecord": selected_execution,
                        "nativeExecutionSummaries": len(summaries),
                        "logs": logs,
                    }
                )
    assert not root.exists(), "Owned fixture was not removed"
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], (
        "Native client changed during controls"
    )

assert len(rows) == 44 and all(not root.exists() for root in fixture_roots)
assert hashlib.sha256(bun.read_bytes()).hexdigest() == bun_digest, (
    "Bun changed during controls"
)
report = {
    "schemaVersion": "cache-native-selection-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "authority": "Asserted native synthetic selection behavior only; no repository-task qualification or production activation.",
    "driver": {
        "path": "goals/turborepo-quality-cache-adoption/research/native-selection-controls.py",
        "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    },
    "clients": {
        channel: {
            "reportedVersion": observed_versions[channel],
            "sha256": pins[channel]["sha256"],
        }
        for channel in clients
    },
    "bun": {"version": bun_version, "sha256": bun_digest},
    "fixedFutureFlags": fixed_flags,
    "changedFlag": "strictTaskEntrypointSelection",
    "assertedCases": len(rows),
    "dryAndExecutionInvocations": 2 * len(rows),
    "completed": True,
    "fixturesRemoved": True,
    "results": rows,
    "limits": [
        "Linux synthetic four-workspace profile; current repository task/entrypoint and cohort review remains necessary.",
        "Only strictTaskEntrypointSelection changes; all tasks disable cache and executions allow local transport only.",
        "Finite environment, private homes, offline lockfile setup with lifecycle scripts disabled; no credentials or remote cache.",
        "One MiB per captured stream, ten seconds per owned process group and three minutes total.",
        "A zero exit with no selected command is not execution evidence. Explicit task and graph-only requests intentionally retain commandless graph nodes.",
        "No repository configuration, qualification, infrastructure or production setting is changed.",
    ],
}
(base / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    "44 native selection cases passed across both pins; 88 dry/execution invocations. All owned fixtures removed."
)
