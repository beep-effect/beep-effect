#!/usr/bin/env python3
"""Prove portable donor accounting rejects omitted, forged and unproved rows."""
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
    fixture = root / "packages/law-practice/use-cases/test/fixtures/eyecite/typescript-extensions.json"
    original = json.loads(fixture.read_text())
    validator = root / "goals/citation-extraction-engine/ops/check-typescript-donors.ts"
    def invoke(path, complete=False):
        return subprocess.run(["bun", "run", str(validator), str(path), *(["--complete"] if complete else [])],
                              cwd=root, capture_output=True, text=True, timeout=180)
    baseline = invoke(fixture)
    if baseline.returncode or "Donor accounting valid:" not in baseline.stdout: raise SystemExit("donor baseline must pass")
    strict = invoke(fixture, True)
    if strict.returncode != 1 or "TypeScript donor validation failed;" not in strict.stderr: raise SystemExit("unfinished donor completion must fail")
    def rehashed_location(report):
        row = report["donors"][0]["runtimeCases"][0]
        row["line"] += 1
        value = {key: item for key, item in row.items() if key != "normalizedSha256"}
        row["normalizedSha256"] = hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    def false_terminal(report):
        report["dispositions"][0].update(disposition="adopted", workflowState="complete")
    def absent_successor(report):
        report["dispositions"][0].update(disposition="follow-up", workflowState="complete", rationale="Bounded test control.",
            proof={"command": "control", "result": "passed", "evidencePath": "goals/citation-extraction-engine/SPEC.md"}, successorGoal="goals/absent-citation-donor-control")
    def absent_proof(report):
        report["dispositions"][0].update(disposition="rejected", workflowState="complete", rationale="Bounded test control.",
            proof={"command": "control", "result": "passed", "evidencePath": "goals/absent-citation-donor-control.md"})
    controls = {
      "absent-donor": lambda r: r["donors"].pop(),
      "wrong-pin": lambda r: r["donors"][0].update(commit="a" * 40),
      "wrong-license": lambda r: r["donors"][0].update(license="unlicensed"),
      "absent-package-subpath": lambda r: r["donors"][0]["packageExports"].pop("./utils"),
      "absent-export": lambda r: r["donors"][0]["static"]["exports"].pop(),
      "duplicate-export": lambda r: r["donors"][0]["static"]["exports"].append(r["donors"][0]["static"]["exports"][0]),
      "wrong-export-source": lambda r: r["donors"][0]["static"]["exports"][0]["origins"][0].update(sourceSha256="a" * 64),
      "absent-member": lambda r: next(row for row in r["donors"][0]["static"]["exports"] if row["members"])["members"].pop(),
      "absent-declaration": lambda r: r["donors"][0]["static"]["testDeclarations"].pop(),
      "unclassified-source-only-branch": lambda r: r["donors"][0]["unobservedDeclarations"].clear(),
      "absent-runtime-case": lambda r: r["donors"][0]["runtimeCases"].pop(),
      "duplicate-runtime-case": lambda r: r["donors"][0]["runtimeCases"].append(r["donors"][0]["runtimeCases"][0]),
      "stale-case-hash": lambda r: r["donors"][0]["runtimeCases"][0].update(title="changed"),
      "wrong-location-with-valid-hash": rehashed_location,
      "false-suite-summary": lambda r: r["donors"][0]["suite"].update(passed=0),
      "absent-disposition": lambda r: r["dispositions"].pop(),
      "duplicate-disposition": lambda r: r["dispositions"].append(r["dispositions"][0]),
      "unowned-disposition": lambda r: r["dispositions"][0].update(sourceId="absent"),
      "composite-workflow": lambda r: r["dispositions"][0].update(workflowState="audit/complete"),
      "unknown-disposition": lambda r: r["dispositions"][0].update(disposition="ignore"),
      "adopted-without-proof": false_terminal,
      "follow-up-without-existing-successor": absent_successor,
      "terminal-with-absent-evidence": absent_proof,
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="donor-controls-", dir=args.scratch_root) as scratch:
        path = Path(scratch) / "corrupted.json"
        for name, mutate in controls.items():
            value = copy.deepcopy(original)
            mutate(value)
            path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
            result = invoke(path)
            if result.returncode != 1 or "TypeScript donor validation failed;" not in result.stderr: raise SystemExit(f"control failed: {name}")
            print(f"PASS {name}")
    print(f"audit baseline passed; unfinished completion rejected; {len(controls)} donor corruption controls passed")


if __name__ == "__main__": main()
