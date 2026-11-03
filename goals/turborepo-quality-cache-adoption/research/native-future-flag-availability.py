"""Reproduce bounded configuration observations with the already pinned clients.

Run with Python 3 from any directory. The driver uses no credentials, remote
cache or downloads. Reports and bounded native logs stay in ignored .beep;
only owned disposable fixture directories are removed. Configuration parsing
does not qualify feature semantics or a real repository computation.
"""

import datetime
import hashlib
import json
import os
import re
import selectors
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def read_contained_source(path, root):
    """Read bounded regular source bytes from a descriptor verified in the checkout."""
    import stat

    flags = os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK
    with os.fdopen(os.open(path, flags), "rb") as source:
        opened = os.readlink(f"/proc/self/fd/{source.fileno()}")
        assert os.path.commonpath([str(root), opened]) == str(root), "Opened source is outside the checkout."
        assert stat.S_ISREG(os.fstat(source.fileno()).st_mode), "Source must be a regular file."
        data = source.read(1024 * 1024 + 1)
        assert len(data) <= 1024 * 1024, "Source exceeds one MiB."
        return data


if sys.flags.optimize:
    print(
        "Native availability verification requires assertions; optimized execution is refused."
    )
    raise SystemExit(64)

assert sys.platform == "linux", (
    "This retained observation requires Linux native clients."
)
os.umask(0o077)
repo = Path(__file__).resolve().parents[3]
driver = Path(__file__).resolve()
driver_bytes = driver.read_bytes()
relative_driver = driver.relative_to(repo).as_posix()
base = repo / ".beep/native-future-flag-availability"
cache = Path.home() / ".cache/beep/turbo-future-flag-availability"
for directory in (base, cache):
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
pins_path = Path(__file__).parent / "current-client-pins.json"
pins_bytes = read_contained_source(pins_path, repo)
pins = json.loads(pins_bytes)
schema_path = repo / "node_modules/turbo/schema.json"
schema_bytes = schema_path.read_bytes()
schema = json.loads(schema_bytes)
flags = list(schema["definitions"]["FutureFlags"]["properties"])
assert len(flags) == 14, (
    "Review the changed stable schema before changing this observation."
)
captured_sources = {driver: driver_bytes, pins_path: pins_bytes, schema_path: schema_bytes}
for path, data in captured_sources.items():
    assert read_contained_source(path, repo) == data, "Source changed before observation."
clients = {
    "stable": repo / "node_modules/@turbo/linux-64/bin/turbo",
    "canary": Path.home()
    / ".cache/beep/turbo-goals-clients"
    / pins["canary"]["packageVersion"]
    / "turbo",
}
command = [
    "--skip-infer",
    "run",
    "probe",
    "--single-package",
    "--dry-run=json",
    "--cache=local:r",
    "--concurrency=1",
    "--env-mode=strict",
]
marker = "printf executed > executed.txt; exit 37"
start = time.monotonic()
rows = []


def run_bounded(binary, root, environment):
    """Bound both streams during collection and stop only this owned process group."""
    deadline = min(start + 600, time.monotonic() + 20)
    assert deadline > time.monotonic(), (
        "Whole observation exceeded its ten-minute budget."
    )
    streams = {"stdout": bytearray(), "stderr": bytearray()}
    limits = {"stdout": 1024 * 1024, "stderr": 65536}
    with subprocess.Popen(
        [str(binary), *command],
        cwd=root,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    ) as child:
        try:
            with selectors.DefaultSelector() as selected:
                selected.register(child.stdout, selectors.EVENT_READ, "stdout")
                selected.register(child.stderr, selectors.EVENT_READ, "stderr")
                while selected.get_map():
                    remaining = deadline - time.monotonic()
                    assert remaining > 0, "Native dry run exceeded its deadline."
                    for key, _ in selected.select(min(remaining, 0.25)):
                        data = os.read(key.fileobj.fileno(), 65536)
                        if not data:
                            selected.unregister(key.fileobj)
                            continue
                        target = streams[key.data]
                        assert len(target) + len(data) <= limits[key.data], (
                            "Native output exceeded its byte bound."
                        )
                        target.extend(data)
            result = child.wait(timeout=max(0.001, deadline - time.monotonic()))
        except BaseException:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait()
            raise
    return result, bytes(streams["stdout"]), bytes(streams["stderr"])


for channel, binary in clients.items():
    assert hashlib.sha256(binary.read_bytes()).hexdigest() == pins[channel]["sha256"], (
        "Native client pin changed."
    )
    with tempfile.TemporaryDirectory(prefix=channel + "-", dir=cache) as temporary:
        root = Path(temporary)
        (root / "home").mkdir(mode=0o700)
        (root / "cache").mkdir(mode=0o700)
        (root / "package.json").write_text(
            json.dumps(
                {
                    "name": "beep-availability-fixture",
                    "version": "0.0.0",
                    "packageManager": "bun@1.4.4",
                    "scripts": {"probe": marker},
                }
            )
            + "\n"
        )
        environment = {
            "PATH": "/usr/bin:/bin",
            "HOME": str(root / "home"),
            "XDG_CACHE_HOME": str(root / "cache"),
            "CI": "1",
            "TURBO_TELEMETRY_DISABLED": "1",
            "TURBO_DAEMON": "false",
        }
        cases = [
            ("baseline", None, None),
            ("unknown-control", "beepUnavailableSentinel", True),
            *[("flag", flag, enabled) for flag in flags for enabled in (False, True)],
        ]
        for index, (kind, flag, enabled) in enumerate(cases):
            config = {"tasks": {"probe": {"cache": False, "outputs": []}}}
            if flag is not None:
                config["futureFlags"] = {flag: enabled}
            (root / "turbo.json").write_text(json.dumps(config) + "\n")
            result, stdout, stderr = run_bounded(binary, root, environment)
            (base / f"{channel}-{index:02}.stdout").write_bytes(stdout)
            (base / f"{channel}-{index:02}.stderr").write_bytes(stderr)
            assert not (root / "executed.txt").exists(), (
                "Dry run executed its sentinel command."
            )
            text = (stdout + b"\n" + stderr).decode("utf-8", errors="replace")
            classification = "configuration-refused"
            task_count = 0
            if result == 0:
                tasks = json.loads(stdout)["tasks"]
                assert len(tasks) == 1 and tasks[0]["command"] == marker
                classification = "dry-run-accepted"
                task_count = 1
            elif (
                flag is not None
                and re.search(r"(?i)unknown key|unrecognized key|unknown field", text)
                and flag in text
            ):
                classification = "configuration-key-rejected"
            expected = (
                "configuration-key-rejected"
                if kind == "unknown-control"
                else "dry-run-accepted"
            )
            assert classification == expected, (channel, kind, flag, enabled)
            rows.append(
                {
                    "channel": channel,
                    "kind": kind,
                    "feature": flag,
                    "enabled": enabled,
                    "exit": result,
                    "classification": classification,
                    "dryRunTaskCount": task_count,
                    "sentinelExecuted": False,
                    "stdoutSha256": hashlib.sha256(stdout).hexdigest(),
                    "stderrSha256": hashlib.sha256(stderr).hexdigest(),
                }
            )

assert time.monotonic() - start < 600
assert len(rows) == 60
for path, data in captured_sources.items():
    assert read_contained_source(path, repo) == data, "Source changed during observation."
raw = {
    "schemaVersion": "cache-future-flag-native-availability/v1",
    "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "authority": "Isolated exact-native dry-run configuration observations only. Accepted syntax does not prove feature semantics, task qualification, production safety or a performance benefit.",
    "sourceRevision": subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True, timeout=5
    ).strip(),
    "sourceState": "working-tree-bound",
    "sourceBindings": [
        {"path": path.relative_to(repo).as_posix(), "sha256": hashlib.sha256(data).hexdigest()}
        for path, data in captured_sources.items()
    ],
    "clients": {
        channel: {key: pins[channel][key] for key in ("reportedVersion", "sha256")}
        for channel in clients
    },
    "stableSchemaSha256": hashlib.sha256(schema_bytes).hexdigest(),
    "pinManifestSha256": hashlib.sha256(pins_bytes).hexdigest(),
    "flags": flags,
    "rows": rows,
    "completed": True,
    "bounds": {
        "totalDeadlineSeconds": 600,
        "perProcessDeadlineSeconds": 20,
        "stdoutMaxBytes": 1048576,
        "stderrMaxBytes": 65536,
        "sequential": True,
    },
    "controls": {
        "baselineAcceptedBoth": True,
        "unknownKeyRefusedBoth": True,
        "allSentinelsUnexecuted": True,
        "oneFlagPerCase": True,
        "explicitLocalReadOnlyCache": True,
        "secretFreeEnvironment": True,
        "ownedFixturesRemoved": True,
    },
    "taskQualificationOrFeatureAcceptanceGranted": False,
    "productionConfigurationChanges": False,
    "isolatedFixtureConfigurationsChanged": True,
}
raw_bytes = (json.dumps(raw, indent=2) + "\n").encode()
(base / "raw-observation.json").write_bytes(raw_bytes)
driver_sha = hashlib.sha256(driver_bytes).hexdigest()
report = {
    **raw,
    "rawObservationSha256": hashlib.sha256(raw_bytes).hexdigest(),
    "executedScriptSha256": driver_sha,
    "driver": {"path": relative_driver, "sha256": driver_sha},
    "command": "<pinned-native> " + " ".join(command),
    "fixture": {
        "packageManager": "bun@1.4.4",
        "task": "probe",
        "command": marker,
        "cache": False,
        "outputs": [],
        "flags": "One explicit flag set false/true per case; no root or child repository configuration is loaded.",
    },
    "summary": {
        "flagCasesAccepted": 56,
        "baselineCasesAccepted": 2,
        "unknownControlsRefused": 2,
        "sentinelsExecuted": 0,
        "featuresSemanticallyQualified": 0,
    },
}
(base / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    "Finished sixty bounded native dry-run cases; owned fixtures removed. No production setting or feature qualification changed."
)
