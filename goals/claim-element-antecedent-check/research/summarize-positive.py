#!/usr/bin/env python3
"""Summarize the fixed positive evaluation; no correctness inference for findings."""
import collections
import json
import pathlib
import sys


def summarize(rows):
    count = len(rows)
    matched = sum(row["strict"] for row in rows)
    gold = sum(row["goldEdges"] for row in rows)
    predicted = sum(row["predictedEdges"] for row in rows)
    edges = sum(row["matchedEdges"] for row in rows)
    return {
        "selectedClaims": count,
        "strictMatches": matched,
        "strictRate": matched / count if count else None,
        "stages": dict(sorted(collections.Counter(row["stage"] for row in rows).items())),
        "goldEdges": gold,
        "predictedEdges": predicted,
        "matchedEdges": edges,
        "edgePrecision": edges / predicted if predicted else None,
        "edgeRecall": edges / gold if gold else None,
        "edgeF1": 2 * edges / (gold + predicted) if gold + predicted else None,
    }


FIXTURES = pathlib.Path("packages/law-practice/domain/test/fixtures/claim-element/positive")


def gold_nested(family_id):
    """Claims whose gold tree nests an element below a top-level limitation (not merely under the root)."""
    trees = json.loads((FIXTURES / family_id / "expected.json").read_text())
    return {tree["claimNumber"] for tree in trees
            if any(edge["kind"] == "part-of" and edge["parent"] != str(tree["claimNumber"]) for edge in tree["edges"])}


def main(filename):
    result = json.loads(pathlib.Path(filename).read_text())
    families = result["families"]
    # Recompute nesting from the frozen gold fixtures: retained results recorded any part-of edge as nested.
    for family in families:
        nested = gold_nested(family["familyId"])
        for claim in family["claims"]:
            claim["nested"] = claim["claimNumber"] in nested
    rows = [claim for family in families for claim in family["claims"]]
    assert len(families) == 60 and len(rows) == 538
    assert len({family["familyId"] for family in families}) == 60
    assert all(len({c["claimNumber"] for c in f["claims"]}) == len(f["claims"]) for f in families)
    rules = ["unsupported-determiner", "definite-without-introduction", "multiple-introductions",
             "determiner-number-mismatch", "ordinal-variants", "outside-chain", "tree-without-claim",
             "chain-through-undecomposed", "chain-unresolvable", "chain-work-limit"]
    determiner = ["a", "an", "the", "said", "at-least-one", "plurality-of", "bare"]
    output = {
        "schemaVersion": "claim-antecedent-positive-summary/v2",
        "provisional": True,
        "actualAttorneyAgreementRecorded": False,
        "familyCount": len(families),
        "inputFailedFamilies": sum(f["inputFailure"] is not None for f in families),
        "overall": summarize(rows),
        "cpc": {section: summarize([c for f in families if f["cpcSection"] == section for c in f["claims"]]) for section in "ABEFGH"},
        "goldDeterminer": {group: summarize([c for c in rows if group in c["determinerGroups"]]) for group in determiner},
        "goldFeature": {group: summarize([c for c in rows if c[group]]) for group in ["nested", "functional"]},
        "ruleActivation": {group: summarize([c for c in rows if group in c["rules"]]) for group in rules},
        "noFinding": summarize([c for c in rows if c["stage"] != "input-failed" and c["findings"] == 0]),
        "currentConventionAcceptedDiagnostic": summarize([c for f in families if f["currentConventionAccepted"] for c in f["claims"]]),
        "attorneyHeld": summarize([c for f in families if f["attorneyDecisionPending"] for c in f["claims"]]),
    }
    print(json.dumps(output, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
