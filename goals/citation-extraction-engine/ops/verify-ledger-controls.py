#!/usr/bin/env python3
"""Exercise compatible source/case/regex projections against corrupt ledgers."""
import argparse
import copy
import json
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixtures = root / "packages/law-practice/use-cases/test/fixtures/eyecite"
    names = ["source-inventory.json", "canonical-cases.json", "regex-inventory.json"]
    original = [json.loads((fixtures / name).read_text()) for name in names]
    validator = root / "goals/citation-extraction-engine/ops/check-ledgers.ts"

    def invoke(folder, complete=False):
        return subprocess.run(["bun", "run", str(validator), str(folder), *(["--complete"] if complete else [])],
                              cwd=root, capture_output=True, text=True, timeout=180)
    baseline = invoke(fixtures)
    if baseline.returncode or "Ledger projections valid:" not in baseline.stdout:
        raise SystemExit("ledger baseline must pass")
    strict = invoke(fixtures, True)
    if strict.returncode != 1 or "Citation ledger validation failed;" not in strict.stderr:
        raise SystemExit("unfinished proof must fail completion mode")
    controls = {
        "missing-source-row": lambda r: r[0]["rows"].pop(),
        "duplicate-source-row": lambda r: r[0]["rows"].append(r[0]["rows"][0]),
        "unknown-source-kind": lambda r: r[0]["rows"][0].update(kind="unknown"),
        "missing-case": lambda r: r[1]["cases"].pop(),
        "duplicate-case": lambda r: r[1]["cases"].append(r[1]["cases"][0]),
        "wrong-observation-hash": lambda r: r[1]["cases"][0]["observation"].update(normalizedSha256="a" * 64),
        "missing-capability": lambda r: r[1]["capabilities"].pop(),
        "wrong-capability-owner": lambda r: r[1]["capabilities"][0].update(sourceRowId="absent"),
        "missing-expansion": lambda r: r[0]["declarationExpansions"][0]["eventIds"].pop(),
        "composite-state": lambda r: r[1]["cases"][0].update(workflowState="ready/complete"),
        "canonical-rejection": lambda r: r[1]["cases"][0].update(disposition="rejected"),
        "missing-fixture-license": lambda r: r[1]["fixtures"][0].pop("license"),
        "wrong-fixture-hash": lambda r: r[1]["fixtures"][0].update(sourceSha256="a" * 64),
        "missing-regex-family": lambda r: r[2]["families"].pop(),
        "missing-regex-instance": lambda r: r[2]["extractorInstances"].pop(),
        "duplicate-regex-instance": lambda r: r[2]["extractorInstances"].append(r[2]["extractorInstances"][0]),
        "wrong-expanded-pattern": lambda r: r[2]["extractorInstances"][0].update(patternSha256="a" * 64),
        "wrong-input-evidence-hash": lambda r: r[0]["evidence"]["assertions"].update(sha256="a" * 64),
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ledger-controls-", dir=args.scratch_root) as scratch:
        folder = Path(scratch)
        for name, mutate in controls.items():
            records = copy.deepcopy(original)
            mutate(records)
            for path, value in zip(names, records): (folder / path).write_text(json.dumps(value, ensure_ascii=False))
            result = invoke(folder)
            if result.returncode != 1 or "Citation ledger validation failed;" not in result.stderr:
                raise SystemExit(f"negative control did not fail: {name}")
            print(f"PASS {name}")
    print(f"audit baseline passed; unfinished completion rejected; {len(controls)} corruption controls passed")


if __name__ == "__main__":
    main()
