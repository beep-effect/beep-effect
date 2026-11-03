#!/usr/bin/env python3
"""Evaluate numerical usefulness gates, leaving absent independent evidence failed."""
import argparse
import json
import pathlib
import sys
from usefulness import evaluate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evaluation", type=pathlib.Path)
    parser.add_argument("--review-evidence", type=pathlib.Path)
    args = parser.parse_args()
    here = pathlib.Path(__file__).resolve().parent
    result = json.loads((args.evaluation / "results.json").read_text())
    evidence = json.loads(args.review_evidence.read_text()) if args.review_evidence else {}
    legacy = []
    for family in result["families"]:
        prediction = args.evaluation / f"{family['familyId']}.prediction.json"
        report = json.loads(prediction.read_text())["report"] if prediction.exists() else {}
        warnings = {int(finding["referring"]["path"].split(".")[0])
                    for finding in report.get("findings", []) if finding["kind"] == "pattern-not-covered"}
        for claim in family["claims"]:
            failed = claim["stage"] == "input-failed" or claim["predictionMissing"]
            legacy.append({"familyId": family["familyId"], "claimNumber": claim["claimNumber"],
                           "strict": claim["strict"], "parsed": claim["stage"] != "input-failed",
                           "abstained": failed or claim["claimNumber"] in warnings})
    # Caller cannot replace observed legacy outcomes with review data.
    evidence["legacyClaims"] = legacy
    gates = json.loads((here / "usefulness-gates.json").read_text())
    freeze = json.loads((here / "preservation-freeze.json").read_text())
    report = evaluate(evidence, gates, freeze["passingClaims"])
    report["implementationDigest"] = result["implementationDigest"]
    print(json.dumps(report, indent=2))
    return 0 if report["numericalGatesPassed"] else 1


if __name__ == "__main__":
    sys.exit(main())
