#!/usr/bin/env python3
"""Evaluate numerical usefulness gates, leaving absent independent evidence failed."""
import argparse
import json
import pathlib
import sys
from usefulness import evaluate


def validate_tool_delivery(report, delivery):
    if not report:
        if delivery is not None:
            raise ValueError("Delivery proof has no product report")
        return
    records = report.get("records", [])
    source = report.get("input", {})
    if not records or not isinstance(delivery, dict) or delivery.get("complete") is not True:
        raise ValueError("Missing complete tool-page delivery proof")
    total = len(records)
    pages = delivery.get("pages", [])
    if (len(source.get("records", [])) != total or delivery.get("sourceKey") != source.get("sourceKey")
            or delivery.get("totalRecords") != total or delivery.get("deliveredRecords") != total
            or delivery.get("pageCount") != len(pages) or not pages):
        raise ValueError("Tool delivery source or record counts disagree")
    following = 1
    for page in pages:
        start, end, size = (page.get(key) for key in ("startSourceOrdinal", "endSourceOrdinal", "bytes"))
        if (any(type(value) is not int for value in (start, end, size)) or start != following
                or end < start or end > total or size < 1 or size > 1024 * 1024):
            raise ValueError("Tool pages violate contiguous bounded delivery")
        following = end + 1
    if following != total + 1:
        raise ValueError("Tool pages do not deliver the complete ledger")


def observed_coverage(schema, claim, report, tool_delivery=None):
    """Derive coverage from observed product output, never review annotations."""
    if schema == "claim-antecedent-positive-evaluation/v1":
        warnings = {int(finding["referring"]["path"].split(".")[0])
                    for finding in report.get("findings", []) if finding["kind"] == "pattern-not-covered"}
        return {"parsed": claim["stage"] != "input-failed",
                "abstained": claim["stage"] == "input-failed" or claim["predictionMissing"]
                or claim["claimNumber"] in warnings}
    if schema not in ("claim-input-inspection-evaluation/v1", "claim-input-tool-evaluation/v1"):
        raise ValueError(f"Unknown evaluation schema: {schema}")
    if schema == "claim-input-tool-evaluation/v1":
        validate_tool_delivery(report, tool_delivery)
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
    if result.get("schemaVersion") not in ("claim-antecedent-positive-evaluation/v1", "claim-input-inspection-evaluation/v1", "claim-input-tool-evaluation/v1"):
        raise ValueError("Unknown evaluation schema")
    evidence = json.loads(args.review_evidence.read_text()) if args.review_evidence else {}
    legacy = []
    for family in result["families"]:
        prediction = args.evaluation / f"{family['familyId']}.prediction.json"
        payload = json.loads(prediction.read_text()) if prediction.exists() else {}
        report = payload.get("report", {})
        for claim in family["claims"]:
            coverage = observed_coverage(result["schemaVersion"], claim, report, payload.get("toolDelivery"))
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
