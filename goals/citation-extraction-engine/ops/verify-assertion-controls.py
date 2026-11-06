#!/usr/bin/env python3
"""Corrupt actual assertion evidence and require the portable validator to fail."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixture = root / "packages/law-practice/use-cases/test/fixtures/eyecite/assertion-cases.json"
    original = json.loads(fixture.read_text())
    validator = root / "goals/citation-extraction-engine/ops/check-assertions.ts"

    def invoke(path):
        return subprocess.run(["bun", "run", str(validator), str(path)], cwd=root,
                              capture_output=True, text=True, timeout=180)

    baseline = invoke(fixture)
    if baseline.returncode != 0 or "Validated 1583 assertions" not in baseline.stdout:
        raise SystemExit("baseline validator must pass before negative controls")

    def payload_change(report, predicate, change):
        row = next(row for row in report["events"] if predicate(row, json.loads(row["payload"])))
        value = json.loads(row["payload"])
        change(value)
        row["payload"] = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        row["normalizedSha256"] = hashlib.sha256(row["payload"].encode()).hexdigest()

    def relation(report):
        payload_change(report, lambda row, value: row["assertion"] == "assertEqual",
                       lambda value: value["relation"].update(equal=False))

    def identity(report):
        payload_change(report, lambda row, value: row["assertion"] == "assertNotEqual" and
                       all(operand["kind"] == "identity-hash" for operand in value["operands"]),
                       lambda value: value["operands"][1].update(identitySlot=value["operands"][0]["identitySlot"]))

    def frame(report):
        payload_change(report, lambda row, value: bool(value["context"]["frames"]),
                       lambda value: value["context"]["frames"][0].update(iterationIds=["absent"]))

    def literal(report):
        next(row for row in report["iterations"] if "literalParameterId" in row)["indexWithinParent"] += 1

    def parent(report):
        row = report["iterations"][0]
        row["parentIterationIds"] = [row["id"]]

    controls = {
        "absent-event": lambda r: r["events"].pop(),
        "duplicate-event": lambda r: r["events"].append(r["events"][0]),
        "absent-declaration": lambda r: r["source"]["declarations"].pop(),
        "absent-iteration": lambda r: r["iterations"].pop(0),
        "duplicate-iteration": lambda r: r["iterations"].append(r["iterations"][0]),
        "stale-payload-hash": lambda r: r["events"][0].update(payload=r["events"][0]["payload"] + " "),
        "wrong-exporter-hash": lambda r: r.update(exporterSha256="a" * 64),
        "wrong-source-hash": lambda r: r["source"]["functions"][0].update(sourceSha256="a" * 64),
        "absent-artifact": lambda r: r["artifacts"].pop(next(iter(r["artifacts"]))),
        "literal-loop-gap": literal,
        "self-parent-iteration": parent,
        "relation-with-valid-hash": relation,
        "identity-with-valid-hash": identity,
        "producer-with-valid-hash": frame,
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="assertion-controls-", dir=args.scratch_root) as scratch:
        path = Path(scratch) / "corrupted.json"
        for name, mutate in controls.items():
            report = copy.deepcopy(original)
            mutate(report)
            path.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
            result = invoke(path)
            if result.returncode != 1 or "Assertion oracle validation failed;" not in result.stderr:
                raise SystemExit(f"negative control did not fail through the validator: {name}")
            print(f"PASS {name}")
    print(f"baseline passed; {len(controls)} actual-validator negative controls passed")


if __name__ == "__main__":
    main()
