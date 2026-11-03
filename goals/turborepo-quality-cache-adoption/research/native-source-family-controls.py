"""Compare native driver bootstrap source guards without running a native client.

Actual legacy/current AST prefixes run against owned disposable metadata files.
Version queries are stubs, every real child is refused, and no task executes.
"""

import argparse
import ast
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

if not __debug__:
    raise SystemExit("Source controls require assertions.")
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--legacy-root", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
assert not args.output.exists(), "Existing reports are refused."
control = Path(__file__).resolve()
control_bytes = control.read_bytes()
research = control.parent
legacy_manifest = json.loads((args.legacy_root / "manifest.json").read_bytes())
legacy_stops = {
    "native-filter-composition-controls.py": "bun",
    "native-observability-default-controls.py": "bun",
    "native-selection-controls.py": "timeout_digest",
    "native-base-ref-controls.py": "clients",
    "native-prune-global-controls.py": "tools",
    "native-global-configuration-controls.py": "tools",
    "native-setup-controls.py": "tool_paths",
    "native-log-presentation-controls.py": None,
    "native-log-cache-controls.py": None,
    "native-signature-key-controls.py": "tools",
}
sources = {}
for item in legacy_manifest["files"]:
    name = item["path"]
    data = (args.legacy_root / name).read_bytes()
    assert hashlib.sha256(data).hexdigest() == item["sha256"]
    assert name in legacy_stops
    sources[name] = {"legacy": data, "current": (research / name).read_bytes()}
signature_legacy = (args.legacy_root / "native-signature-key-controls.py").read_bytes()
assert hashlib.sha256(signature_legacy).hexdigest() == "2afde39e782ed441b181ce400ac14280a4ce8a1a2c8281a0e86a9fbb80e05b78"
sources["native-signature-key-controls.py"] = {
    "legacy": signature_legacy,
    "current": (research / "native-signature-key-controls.py").read_bytes(),
}
assert sources.keys() == legacy_stops.keys()
reader_bytes = (research / "native-future-flag-availability.py").read_bytes()
reader_tree = ast.parse(reader_bytes)
reader_node = next(n for n in reader_tree.body if isinstance(n, ast.FunctionDef) and n.name == "read_contained_source")
reader_source = ast.get_source_segment(reader_bytes.decode(), reader_node)
historical = {
    p.name: p.read_bytes()
    for p in research.glob("*.json")
    if p.name != args.output.name
}
guard_message = "Observation sources changed before probes."
cache = Path.home() / ".cache/beep/native-source-family-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
read_bytes_original = Path.read_bytes
read_text_original = Path.read_text
open_original = os.open
fdopen_original = os.fdopen
rows = []
started = time.monotonic()


def prefix_for(name, version, source):
    tree = ast.parse(source)
    if version == "current":
        stop = next(i + 1 for i, n in enumerate(tree.body)
                    if isinstance(n, ast.Assert) and isinstance(n.msg, ast.Constant)
                    and n.msg.value in [guard_message, "Signature-key sources changed before controls."])
    elif legacy_stops[name]:
        stop = next(i for i, n in enumerate(tree.body)
                    if isinstance(n, ast.Assign)
                    and any(isinstance(t, ast.Name) and t.id == legacy_stops[name]
                            for t in n.targets))
    else:
        stop = next(i for i, n in enumerate(tree.body)
                    if isinstance(n, ast.For) and isinstance(n.target, ast.Tuple)
                    and any(isinstance(t, ast.Name) and t.id == "channel" for t in n.target.elts))
    return ast.Module(body=tree.body[:stop], type_ignores=[])


for name, versions in sources.items():
    for version, source in versions.items():
        prefix = prefix_for(name, version, source)
        targets = ["unchanged", "pins", "helper", "bun-pin", "pin-leaf-swap", "pin-parent-swap"]
        if version == "current":
            targets += ["driver"]
            if name not in ["native-filter-composition-controls.py", "native-observability-default-controls.py"]:
                targets += ["external-pins"]
        for target in targets:
            for suffix in ([b""] if target in ["unchanged", "external-pins", "pin-leaf-swap", "pin-parent-swap"] else [b"\n", b" \n"]):
                with tempfile.TemporaryDirectory(dir=cache) as temporary:
                    sandbox = Path(temporary)
                    root = sandbox / "checkout"
                    rr = root / "goals/turborepo-quality-cache-adoption/research"
                    rr.mkdir(parents=True)
                    subject = rr / name
                    helper = rr / ("native-selection-controls.py" if name in [
                        "native-base-ref-controls.py", "native-log-presentation-controls.py",
                        "native-log-cache-controls.py", "native-prune-global-controls.py",
                    ] else "native-future-flag-availability.py")
                    helper.write_text(
                        "def run_bounded(binary, cwd, environment):\n"
                        "    raise AssertionError('Native execution forbidden')\n"
                        "def invoke(command, cwd, environment):\n"
                        "    raise AssertionError('Native execution forbidden')\n"
                        "def invoke_bounded(command, cwd, environment):\n"
                        "    raise AssertionError('Native execution forbidden')\n"
                    )
                    availability = rr / "native-future-flag-availability.py"
                    if not availability.exists():
                        availability.write_bytes(helper.read_bytes())
                    availability.write_text(reader_source + "\n" + availability.read_text())
                    selection = rr / "native-selection-controls.py"
                    if not selection.exists():
                        selection.write_bytes(helper.read_bytes())
                    subject.write_bytes(source)
                    bun = root / "bun"
                    stable = root / "node_modules/@turbo/linux-64/bin/turbo"
                    canary = root / "home/.cache/beep/turbo-goals-clients/synthetic/turbo"
                    binary_bytes = b"synthetic metadata executable; never executed\n"
                    digest = hashlib.sha256(binary_bytes).hexdigest()
                    for binary in [bun, stable, canary]:
                        binary.parent.mkdir(parents=True, exist_ok=True)
                        binary.write_bytes(binary_bytes)
                    pin_data = json.dumps({
                        "stable": {"sha256": digest, "reportedVersion": "synthetic"},
                        "canary": {"sha256": digest, "packageVersion": "synthetic", "reportedVersion": "synthetic"},
                    }).encode()
                    for pin_name in ["current-client-pins.json", "errors-only-client-pins.json"]:
                        (rr / pin_name).write_bytes(pin_data)
                    bun_pin = root / ".bun-version"
                    bun_pin.write_bytes(b"1.4.4\n")
                    (root / "turbo.json").write_text("{}\n")
                    for relative in [
                        "packages/tooling/tool/cli/src/commands/Ci/CiLane.ts",
                        "node_modules/turbo/docs/reference/configuration.mdx",
                    ]:
                        file = root / relative
                        file.parent.mkdir(parents=True, exist_ok=True)
                        file.write_text("synthetic source metadata\n")
                    pin = rr / ("current-client-pins.json" if name == "native-selection-controls.py"
                                else "errors-only-client-pins.json")
                    observed = {"pins": pin, "helper": helper, "bun-pin": bun_pin, "driver": subject}.get(target)
                    mutated = []
                    probes = []
                    outside = sandbox / "outside.json"
                    outside.write_bytes(pin_data + b"\n")
                    outside_dir = sandbox / "outside-directory"
                    outside_dir.mkdir()
                    (outside_dir / pin.name).write_bytes(pin_data + b"\n")
                    outside_reads = []
                    swapped = []

                    def before_read(path):
                        if path == pin and target in ["pin-leaf-swap", "pin-parent-swap"] and not swapped:
                            if target == "pin-leaf-swap":
                                pin.unlink()
                                pin.symlink_to(outside)
                            else:
                                rr.rename(rr.with_name("research-original"))
                                rr.symlink_to(outside_dir, target_is_directory=True)
                            swapped.append(True)

                    def record_read(path):
                        resolved = path.resolve()
                        if resolved == outside or resolved.is_relative_to(outside_dir):
                            outside_reads.append(True)

                    def after_read(path):
                        if path == outside:
                            outside_reads.append(True)
                        if observed is not None and path == observed and not mutated:
                            path.write_bytes(read_bytes_original(path) + suffix)
                            mutated.append(True)

                    def read_bytes(path, *a, **kw):
                        before_read(path)
                        data = read_bytes_original(path, *a, **kw)
                        record_read(path)
                        after_read(path)
                        return data

                    def read_text(path, *a, **kw):
                        before_read(path)
                        data = read_text_original(path, *a, **kw)
                        record_read(path)
                        after_read(path)
                        return data

                    def open_source(path, *a, **kw):
                        before_read(Path(path))
                        return open_original(path, *a, **kw)

                    class SourceHandle:
                        def __init__(self, handle):
                            self.handle = handle

                        def __enter__(self):
                            self.handle.__enter__()
                            return self

                        def __exit__(self, *a):
                            return self.handle.__exit__(*a)

                        def fileno(self):
                            return self.handle.fileno()

                        def read(self, *a):
                            path = Path(os.readlink(f"/proc/self/fd/{self.fileno()}"))
                            data = self.handle.read(*a)
                            record_read(path)
                            after_read(path)
                            return data

                    def source_handle(fd, *a, **kw):
                        return SourceHandle(fdopen_original(fd, *a, **kw))

                    def version_probe(command, **kw):
                        probes.append(command)
                        if command[-1] == "process.execPath":
                            return str(bun) + "\n"
                        if command == [str(bun), "--version"]:
                            return "1.4.4\n"
                        assert "rev-parse" in command, "Unexpected metadata probe."
                        return "0" * 40 + "\n"

                    argv = [str(subject), "--output", str(root / "report.json")]
                    if name == "native-prune-global-controls.py":
                        argv += ["--stable", str(stable)]
                    if target == "external-pins":
                        argv += ["--pins", str(outside)]
                    context = {"__name__": "__main__", "__file__": str(subject)}
                    with patch.object(sys, "argv", argv), \
                         patch.object(Path, "read_bytes", read_bytes), \
                         patch.object(Path, "read_text", read_text), \
                         patch.object(Path, "home", return_value=root / "home"), \
                         patch.object(shutil, "which", return_value=str(bun)), \
                         patch.object(os, "open", open_source), \
                         patch.object(os, "fdopen", source_handle), \
                         patch.object(subprocess, "check_output", version_probe), \
                         patch.object(subprocess, "Popen", side_effect=AssertionError("Real subprocess forbidden")):
                        refusal = None
                        try:
                            exec(compile(prefix, str(subject), "exec"), context)
                        except (AssertionError, SystemExit, ValueError, OSError) as error:
                            refusal = str(error)
                    assert not (root / "report.json").exists()
                    if target in ["pin-leaf-swap", "pin-parent-swap"]:
                        assert swapped
                        if version == "current":
                            assert refusal and not probes and not outside_reads, (name, target, refusal, probes, outside_reads)
                            result = "pin-replacement-refused-before-external-read"
                        else:
                            assert outside_reads, (name, target, refusal)
                            result = "legacy-external-pin-bytes-read"
                    elif target == "external-pins":
                        assert refusal and not probes and not outside_reads
                        result = "external-pins-refused-before-read"
                    elif version == "current" and target != "unchanged":
                        assert mutated and refusal in [guard_message, "Signature-key sources changed before controls."] and not probes, (name, target, refusal, probes)
                        result = "source-movement-refused-before-probes"
                    elif target == "unchanged":
                        assert refusal is None, (name, version, refusal)
                        if version == "current":
                            assert not probes
                        result = "unchanged-prefix-completed"
                    else:
                        assert mutated, (name, target, "Source was not read by legacy prefix")
                        assert refusal is None or name in ["native-selection-controls.py", "native-signature-key-controls.py"], (name, target, refusal)
                        result = ("legacy-refusal-after-probes" if probes else "legacy-refusal-before-probes") if refusal else "legacy-no-pre-probe-refusal"
                    rows.append({"driver": name, "version": version, "target": target,
                                 "suffixBytes": len(suffix), "result": result,
                                 "stubbedMetadataProbes": len(probes), "nativeInvocations": 0,
                                 "taskExecutions": 0, "outputReportAbsent": True})

assert time.monotonic() - started < 20, "Metadata controls exceeded twenty seconds."
assert control.read_bytes() == control_bytes
for name, versions in sources.items():
    assert (research / name).read_bytes() == versions["current"]
    assert (args.legacy_root / name).read_bytes() == versions["legacy"]
assert all((research / name).read_bytes() == data for name, data in historical.items())
report = {
    "schemaVersion": "native-source-family-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "authority": "Actual metadata prefix contrasts only; version queries are stubs and all real subprocesses are refused. No native semantic replay or qualification.",
    "controlSha256": hashlib.sha256(control_bytes).hexdigest(),
    "sharedReaderSha256": hashlib.sha256(reader_bytes).hexdigest(),
    "sourceBindings": [{"path": name, "legacySha256": hashlib.sha256(v["legacy"]).hexdigest(),
                        "currentSha256": hashlib.sha256(v["current"]).hexdigest()}
                       for name, v in sources.items()],
    "cases": len(rows), "drivers": len(sources), "rows": rows,
    "nativeInvocations": 0, "taskExecutions": 0,
    "historicalJsonReportsUnchanged": True,
    "limits": ["Only source bootstrap prefixes execute; no experiment body executes.",
               "Earlier native observations retain their original source/client bindings.",
               "Current-driver semantic replays, feature qualification and full goal acceptance remain separate."],
}
with args.output.open("x") as output:
    json.dump(report, output, indent=2)
    output.write("\n")
print(json.dumps({"drivers": len(sources), "cases": len(rows), "nativeInvocations": 0, "taskExecutions": 0}))
