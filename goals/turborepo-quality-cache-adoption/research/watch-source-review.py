"""Inspect tracked watch callers without running repository or native tasks."""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import urllib.request


if not __debug__:
    raise SystemExit("Optimized Python is refused before source or network reads.")

os.umask(0o077)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[3]
output = args.output.resolve()
assert root not in output.parents and output != root
assert not output.exists()
assert output.parent.is_dir()
assert stat.S_IMODE(output.parent.stat().st_mode) == 0o700


def git(*arguments):
    result = subprocess.run(
        ["git", *arguments], cwd=root, capture_output=True, timeout=20
    )
    assert result.returncode == 0 or (
        arguments[0] == "grep" and result.returncode == 1
    ), "Tracked source inspection failed."
    assert len(result.stdout) <= 16 * 1024 * 1024
    return result


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_public(url, limit):
    request = urllib.request.Request(url, headers={"User-Agent": "beep-watch-review"})
    with urllib.request.urlopen(request, timeout=15) as response:
        assert response.status == 200
        data = response.read(limit + 1)
    assert len(data) <= limit, "Public reference exceeded its read bound."
    return data


roots = [".github", "scripts", "infra", "apps", "packages", "package.json", "turbo.json"]
assert not git("diff", "HEAD", "--name-only", "--", *roots).stdout
revision = git("rev-parse", "HEAD").stdout.decode().strip()
assert re.fullmatch(r"[a-f0-9]{40,64}", revision)
tracked_output = git("ls-files", "-z").stdout
assert tracked_output.endswith(b"\0"), "Tracked source inventory is incomplete."
tracked = tracked_output.decode().rstrip("\0").split("\0")
assert len(tracked) <= 60000
eligible = [
    name for name in tracked
    if name in ("package.json", "turbo.json")
    or name.split("/", 1)[0] in roots
]
manifests = [name for name in eligible if Path(name).name == "package.json"]
configs = [name for name in eligible if Path(name).name in ("turbo.json", "turbo.jsonc")]
assert len(manifests) <= 512 and len(configs) <= 128
scripts = []
configurations = []
for name in manifests:
    data = (root / name).read_bytes()
    assert len(data) <= 1024 * 1024
    manifest = json.loads(data)
    for task, command in manifest.get("scripts", {}).items():
        if isinstance(command, str) and re.search(r"\bwatch\b", command, re.I):
            scripts.append({"path": name, "task": task, "command": command})
for name in configs:
    data = (root / name).read_bytes()
    assert len(data) <= 1024 * 1024
    configurations.append({
        "path": name,
        "sha256": sha(data),
        "watchFlagTextPresent": b"watchUsingTaskInputs" in data,
    })

pattern = r"turbo.{0,80}watch|watchUsingTaskInputs"
matches = git("grep", "-n", "-i", "-E", pattern, "--", *roots).stdout.decode()
assert len(matches.encode()) <= 64 * 1024
registry_url = "https://registry.npmjs.org/-/package/turbo/dist-tags"
registry = read_public(registry_url, 16384)
tags = json.loads(registry)
assert tags["latest"] == "2.11.10" and tags["canary"] == "2.11.11-canary.1", {
    "observedLatest": tags["latest"], "observedCanary": tags["canary"]
}
upstream = []
for channel, commit in [
    ("stable", "e521641a142a24abe4554a77fdd6551e47e96fb3"),
    ("canary", "a4ab545cd10a4db4e8e8c58cd2792d82c630a2f0"),
]:
    url = f"https://raw.githubusercontent.com/vercel/turborepo/{commit}/crates/turborepo-turbo-json/src/future_flags.rs"
    data = read_public(url, 256 * 1024)
    upstream.append({
        "channel": channel, "commit": commit, "url": url, "sha256": sha(data),
        "declaresWatchFlag": b"watch_using_task_inputs" in data,
    })

bindings = []
for name in [
    "package.json", "turbo.json",
    "packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts",
    "node_modules/turbo/docs/reference/watch.mdx",
    "node_modules/turbo/docs/reference/configuration.mdx",
]:
    bindings.append({"path": name, "sha256": sha((root / name).read_bytes())})
assert git("rev-parse", "HEAD").stdout.decode().strip() == revision
assert not git("diff", "HEAD", "--name-only", "--", *roots).stdout
report = {
    "schemaVersion": "cache-watch-source-review/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceRevision": revision,
    "authority": "Tracked source applicability only; no task, watcher, native matrix or qualification execution.",
    "roots": roots, "trackedFiles": len(tracked),
    "manifestCount": len(manifests), "configurations": configurations,
    "watchNamedScripts": scripts,
    "runtimeSearch": {"pattern": pattern, "matchingLines": matches.splitlines()},
    "registry": {"url": registry_url, "sha256": sha(registry), "latest": tags["latest"], "canary": tags["canary"]},
    "upstreamDeclarations": upstream, "sourceBindings": bindings,
    "driverSha256": sha(Path(__file__).read_bytes()),
    "tasksExecuted": 0, "configurationChanged": False, "qualificationGranted": False,
    "limitations": ["No arbitrary shell or ignored host configuration census.", "Source declarations do not prove native watch semantics or event timing."],
}
with output.open("x") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")
print(json.dumps({"state": "source-inspected", "manifestCount": len(manifests), "configurationCount": len(configs), "watchNamedScripts": len(scripts), "runtimeSearchMatches": len(matches.splitlines()), "tasksExecuted": 0}))
