#!/usr/bin/env python3
"""Evaluate numerical usefulness gates, leaving absent independent evidence failed."""
import argparse
import json
import pathlib
import sys
from usefulness import evaluate


def observed_coverage(schema, claim, report):
    """Derive coverage from observed product output, never review annotations."""
    if schema == "claim-antecedent-positive-evaluation/v1":
        warnings = {int(finding["referring"]["path"].split(".")[0])
                    for finding in report.get("findings", []) if finding["kind"] == "pattern-not-covered"}
        return {"parsed": claim["stage"] != "input-failed",
                "abstained": claim["stage"] == "input-failed" or claim["predictionMissing"]
                or claim["claimNumber"] in warnings}
    if schema != "claim-input-inspection-evaluation/v1":
        raise ValueError(f"Unknown evaluation schema: {schema}")
    ordinal = claim.get("sourceOrdinal")
    matches = [row for row in report.get("records", [])
               if ordinal is not None and row["decomposition"]["qualification"]["record"]["sourceOrdinal"] == ordinal]
    if len(matches) > 1:
        raise ValueError("Duplicate source ordinal in inspection report")
    observed = {"parsed": False, "abstained": True}
    if matches:
        row = matches[0]
        qualification = row["decomposition"]["qualification"]
        if "claim" in qualification and qualification["claim"]["claimNumber"] != claim["claimNumber"]:
            raise ValueError("Inspection source ordinal names a different normalized claim")
        observed = {
            "parsed": qualification["status"] in ("context-ready", "context-unavailable"),
            "abstained": row["status"] != "complete" or any(
                finding["kind"] == "pattern-not-covered" for finding in row.get("findings", [])),
        }
        if claim.get("inspectionStatus") != row["status"]:
            raise ValueError("Runner inspection status disagrees with product record")
    if any(claim.get(key) is not value for key, value in observed.items()):
        raise ValueError("Runner coverage flags disagree with observed inspection record")
    return observed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evaluation", type=pathlib.Path)
    parser.add_argument("--review-evidence", type=pathlib.Path)
    args = parser.parse_args()
    here = pathlib.Path(__file__).resolve().parent
    result = json.loads((args.evaluation / "results.json").read_text())
    if result.get("schemaVersion") not in ("claim-antecedent-positive-evaluation/v1", "claim-input-inspection-evaluation/v1"):
        raise ValueError("Unknown evaluation schema")
    evidence = json.loads(args.review_evidence.read_text()) if args.review_evidence else {}
    legacy = []
    for family in result["families"]:
        prediction = args.evaluation / f"{family['familyId']}.prediction.json"
        report = json.loads(prediction.read_text())["report"] if prediction.exists() else {}
        for claim in family["claims"]:
            coverage = observed_coverage(result["schemaVersion"], claim, report)
            legacy.append({"familyId": family["familyId"], "claimNumber": claim["claimNumber"],
                           "strict": claim["strict"], **coverage})
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
