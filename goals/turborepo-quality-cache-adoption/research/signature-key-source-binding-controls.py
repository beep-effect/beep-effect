"""Check signature observation source joins using metadata-only fixture prefixes.

The actual current and historical driver prefixes run against disposable files.
Version probes are stubbed, every real subprocess is refused, and no native
client, task body, cache transport or qualification experiment is executed.
"""

import argparse
import ast
import datetime
import hashlib
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

if not __debug__:
    raise SystemExit("Source-binding controls require assertions.")
control = Path(__file__).resolve()
control_bytes = control.read_bytes()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--legacy", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
assert not args.output.exists(), "Existing reports are refused."
driver = Path(__file__).resolve().with_name("native-signature-key-controls.py")
historical = driver.with_suffix(".json")
historical_bytes = historical.read_bytes()
sources = {"legacy": args.legacy.read_bytes(), "current": driver.read_bytes()}
digests = {name: hashlib.sha256(data).hexdigest() for name, data in sources.items()}
assert digests["legacy"] == "ed62bcf2883d45f44301181e5cd2d13c2807ff0ba51dcede52c12b08dfa3c3fb"
assert digests["current"] != digests["legacy"], "A repaired driver is required."
start = time.monotonic()
cache = Path.home() / ".cache/beep/signature-source-binding-controls"
cache.mkdir(mode=0o700, parents=True, exist_ok=True)
original_read_bytes = Path.read_bytes
original_read_text = Path.read_text
rows = []

for version, source in sources.items():
    tree = ast.parse(source)
    stop = next(i for i, node in enumerate(tree.body) if isinstance(node, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == "tools" for t in node.targets))
    prefix = ast.Module(body=tree.body[:stop], type_ignores=[])
    targets = (None, "pins", "harness") if version == "legacy" else (None, "pins", "harness", "bun-pin", "external-pins")
    for target in targets:
        for suffix in ([b""] if target in (None, "external-pins") else [b"\n", b" \n"]):
            with tempfile.TemporaryDirectory(dir=cache) as temporary:
                root = Path(temporary)
                research = root / "goals/signature-fixture/research"
                research.mkdir(parents=True)
                subject = research / driver.name
                subject.write_bytes(source)
                binary_bytes = b"synthetic executable: never invoked\n"
                binary_digest = hashlib.sha256(binary_bytes).hexdigest()
                stable = root / "node_modules/@turbo/linux-64/bin/turbo"
                canary = root / "home/.cache/beep/turbo-goals-clients/synthetic/turbo"
                bun = root / "bun"
                for binary in (stable, canary, bun):
                    binary.parent.mkdir(parents=True, exist_ok=True)
                    binary.write_bytes(binary_bytes)
                bun_pin = root / ".bun-version"
                bun_pin.write_bytes(b"1.4.4\n")
                pins = research / "errors-only-client-pins.json"
                pins.write_text(json.dumps({
                    "stable": {"sha256": binary_digest},
                    "canary": {"packageVersion": "synthetic", "sha256": binary_digest},
                }) + "\n")
                harness = research / "native-future-flag-availability.py"
                harness.write_text("def run_bounded(binary, cwd, environment):\n"
                                   "    raise AssertionError('Native execution is forbidden')\n")
                observed = {"pins": pins, "harness": harness, "bun-pin": bun_pin}.get(target, pins)
                original_digest = hashlib.sha256(observed.read_bytes()).hexdigest()
                mutated = []
                probe_calls = []
                context = {"__file__": str(subject), "__name__": "__main__"}

                def mutate_after_read(path):
                    if target in ("pins", "harness", "bun-pin") and path == observed and not mutated:
                        path.write_bytes(original_read_bytes(path) + suffix)
                        mutated.append(True)

                def read_bytes(path, *argv, **kwargs):
                    data = original_read_bytes(path, *argv, **kwargs)
                    mutate_after_read(path)
                    return data

                def read_text(path, *argv, **kwargs):
                    data = original_read_text(path, *argv, **kwargs)
                    mutate_after_read(path)
                    return data

                def version_probe(command, **kwargs):
                    probe_calls.append(command)
                    if command == ["bun", "--no-env-file", "-p", "process.execPath"]:
                        return str(bun) + "\n"
                    assert command == [str(bun), "--version"], "Unexpected metadata probe."
                    return "1.4.4\n"

                argv = [str(subject), "--output", str(root / "report.json")]
                if target == "external-pins":
                    argv += ["--pins", str(root.parent / (root.name + "-outside.json"))]
                with patch.object(sys, "argv", argv), \
                     patch.object(Path, "read_bytes", read_bytes), \
                     patch.object(Path, "read_text", read_text), \
                     patch.object(Path, "home", return_value=root / "home"), \
                     patch.object(subprocess, "check_output", version_probe), \
                     patch.object(subprocess, "Popen", side_effect=AssertionError("Real subprocess forbidden")):
                    refusal = None
                    try:
                        exec(compile(prefix, str(subject), "exec"), context)
                    except (AssertionError, SystemExit) as error:
                        refusal = str(error)
                assert not (root / "report.json").exists()
                if target is None:
                    assert refusal is None and len(probe_calls) == 2
                    bound = context["before_sources"][str(pins.relative_to(root))]
                    assert bound == hashlib.sha256(pins.read_bytes()).hexdigest()
                    result = "unchanged-inputs-bound"
                elif target == "external-pins":
                    assert refusal == "Pin manifest must be within the checkout." and not probe_calls
                    result = "external-pin-manifest-refused-before-read"
                elif version == "current":
                    assert mutated and refusal == "Signature-key sources changed before controls."
                    assert not probe_calls, "Source movement must be refused before version probes."
                    result = "source-movement-refused-before-probes"
                else:
                    assert mutated and refusal is None and len(probe_calls) == 2
                    bound = context["before_sources"][str(observed.relative_to(root))]
                    assert bound == hashlib.sha256(observed.read_bytes()).hexdigest() != original_digest
                    result = "legacy-parsed-old-bytes-but-bound-new-bytes"
                rows.append({"driver": version, "target": target or "unchanged", "suffixBytes": len(suffix),
                             "result": result, "stubbedVersionProbes": len(probe_calls),
                             "nativeInvocations": 0, "taskExecutions": 0, "outputReportAbsent": True})

assert time.monotonic() - start < 10, "Metadata controls exceeded ten seconds."
assert len(rows) == 13
assert driver.read_bytes() == sources["current"] and args.legacy.read_bytes() == sources["legacy"]
assert control.read_bytes() == control_bytes and historical.read_bytes() == historical_bytes
report = {
    "schemaVersion": "signature-key-source-binding-controls/v1",
    "recordedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "authority": "Metadata prefix regression only; no native semantic replay or qualification.",
    "sourceBindings": [{"role": name, "sha256": value} for name, value in digests.items()]
    + [{"role": "control", "sha256": hashlib.sha256(control_bytes).hexdigest()},
       {"role": "historical-native-report", "sha256": hashlib.sha256(historical_bytes).hexdigest()}],
    "cases": len(rows), "rows": rows, "nativeInvocations": 0, "taskExecutions": 0,
    "historical168CaseObservationUnchanged": True,
    "limits": ["Bun version queries are stubs; no native binary is executed.",
               "Real signed transport, current driver replay and feature acceptance remain pending."],
}
with args.output.open("x") as output:
    json.dump(report, output, indent=2)
    output.write("\n")
print(json.dumps({"cases": len(rows), "nativeInvocations": 0, "taskExecutions": 0}))
