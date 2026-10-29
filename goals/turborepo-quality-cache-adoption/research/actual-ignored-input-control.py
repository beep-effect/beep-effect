"""Dry-plan only: a scoped ignored non-workspace manifest, then exact cleanup."""

import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile

r = pathlib.Path.cwd()
base = pathlib.Path.home() / ".cache/beep/turbo-cache-lab/clients"
env = {k: os.environ[k] for k in ("HOME", "PATH")}
env.update(
    {"CI": "1", "NO_COLOR": "1", "DO_NOT_TRACK": "1", "TURBO_TELEMETRY_DISABLED": "1"}
)
rows = []
pins = [
    (
        "stable",
        "2.11.10",
        "67a5ccd624ecc38bd84ba70cc23a23a4ba215700361cf22d2907c761457e6ab6",
    ),
    (
        "canary",
        "2.11.9-canary.1",
        "f0686d3818ff00361d89919ec5e09d151aa6d9641cb5ddfda8fa734bf906cbbb",
    ),
]


def plan(exe):
    p = subprocess.run(
        [
            str(exe),
            "--skip-infer",
            "run",
            "lint",
            "--filter=@beep/identity",
            "--cache=local:",
            "--dry=json",
            "--env-mode=strict",
            "--no-daemon",
        ],
        check=False,
        cwd=r,
        env=env,
        capture_output=True,
        text=True,
        timeout=40,
    )
    assert p.returncode == 0, "Native dry plan failed; raw output suppressed"
    d = json.loads(p.stdout)
    tasks = [t for t in d["tasks"] if t["taskId"] == "@beep/identity#lint"]
    assert len(tasks) == 1 and all(
        "execution" not in t or t["execution"] is None for t in d["tasks"]
    )
    return tasks[0]


parent = r / "tmp"
assert not parent.is_symlink()
made_parent = not parent.exists()
parent.mkdir(exist_ok=True)
try:
    for channel, version, digest in pins:
        exe = base / version / "turbo"
        assert hashlib.sha256(exe.read_bytes()).hexdigest() == digest
        before = plan(exe)
        with tempfile.TemporaryDirectory(
            prefix="cache-input-ignored-", dir=parent
        ) as temp:
            manifest = pathlib.Path(temp) / "package.json"
            relative = str(manifest.relative_to(r))
            assert (
                subprocess.run(
                    ["git", "check-ignore", "-q", "--", relative],
                    check=False,
                    cwd=r,
                    capture_output=True,
                ).returncode
                == 0
            )
            manifest.write_text(
                '{"name":"synthetic-ignored-non-workspace-probe","private":true}\n'
            )
            during = plan(exe)
            matched = [name for name in during.get("inputs", {}) if relative in name]
        assert not pathlib.Path(temp).exists()
        after = plan(exe)
        assert after["hash"] == before["hash"], (
            "Native baseline did not restore after owned fixture cleanup"
        )
        rows.append(
            {
                "channel": channel,
                "version": version,
                "executableSha256": digest,
                "computation": "@beep/identity#lint",
                "beforeHash": before["hash"],
                "duringHash": during["hash"],
                "afterHash": after["hash"],
                "beforeInputs": len(before.get("inputs", {})),
                "duringInputs": len(during.get("inputs", {})),
                "ignoredFixtureIncluded": bool(matched),
                "hashChanged": during["hash"] != before["hash"],
                "fixtureRemoved": True,
                "baselineRestored": True,
                "taskExecuted": False,
            }
        )
finally:
    if made_parent:
        try:
            parent.rmdir()
        except OSError:
            pass
out = r / ".beep/producer-upload/actual-ignored-input-observation.json"
out.write_text(
    json.dumps(
        {
            "schemaVersion": "cache-actual-ignored-input-dry-observation/v1",
            "recordedAt": datetime.datetime.now(datetime.UTC).isoformat(),
            "authority": "native-dry-input-observation-only",
            "observations": rows,
            "remoteUse": False,
            "taskExecution": False,
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps({"observations": rows}))
