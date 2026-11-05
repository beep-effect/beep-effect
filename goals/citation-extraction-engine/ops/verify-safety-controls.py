#!/usr/bin/env python3
"""Reject corrupted policy ceilings and incomplete isolation-mechanism proof."""
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
    folder = root / "goals/citation-extraction-engine/history/evidence"
    names = ["citation-policy-contract.json", "regex-process-isolation-probe.json"]
    original = [json.loads((folder / name).read_text()) for name in names]
    validator = root / "goals/citation-extraction-engine/ops/check-safety-contract.ts"
    def invoke(path): return subprocess.run(["bun", "run", str(validator), str(path)], cwd=root, capture_output=True, text=True, timeout=180)
    baseline = invoke(folder)
    if baseline.returncode or "Citation safety contract valid:" not in baseline.stdout: raise SystemExit("safety baseline must pass")
    def catastrophic_as_success(records):
        next(row for row in records[1]["results"] if row["control"] == "catastrophic-backtracking")["outcome"] = "result"
    def missing_heartbeat(records):
        next(row for row in records[1]["results"] if row["control"] == "catastrophic-backtracking")["heartbeats"] = 0
    def wrong_kill(records):
        next(row for row in records[1]["results"] if row["control"] == "catastrophic-backtracking")["exitSignal"] = "SIGTERM"
    controls = {
      "stale-schema-source": lambda r: r[0].update(schemaSourceSha256="a" * 64),
      "stale-child-source": lambda r: r[1].update(childSourceSha256="a" * 64),
      "inflated-hard-ceiling": lambda r: r[0]["absoluteCeilings"].update(sourceUtf16=1_000_001),
      "understated-hard-ceiling": lambda r: r[0]["absoluteCeilings"].update(sourceUtf16=999_999),
      "forged-default-policy": lambda r: r[0]["defaultPolicy"]["limits"].update(sourceUtf16=1),
      "fractional-deadline": lambda r: r[0]["defaultPolicy"]["limits"].update(cleanDeadline=1.5),
      "unknown-execution-mode": lambda r: r[0]["defaultPolicy"].update(execution="inline-regex"),
      "missing-control-run": lambda r: r[1]["results"].pop(),
      "duplicate-control-run": lambda r: r[1]["results"].append(r[1]["results"][0]),
      "unconfirmed-exit": lambda r: r[1]["results"][0].update(exitConfirmed=False),
      "absent-exit-proof": lambda r: r[1]["results"][0].pop("exitConfirmed"),
      "catastrophic-accepted-as-success": catastrophic_as_success,
      "parent-unresponsive": missing_heartbeat,
      "wrong-force-stop-signal": wrong_kill,
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="safety-controls-", dir=args.scratch_root) as scratch:
        output = Path(scratch)
        for name, mutate in controls.items():
            records = copy.deepcopy(original)
            mutate(records)
            for path, value in zip(names, records): (output / path).write_text(json.dumps(value))
            result = invoke(output)
            if result.returncode != 1 or "Citation safety contract validation failed." not in result.stderr: raise SystemExit(f"negative control did not fail: {name}")
            print(f"PASS {name}")
    print(f"baseline passed; {len(controls)} safety-contract corruption controls passed")


if __name__ == "__main__": main()
