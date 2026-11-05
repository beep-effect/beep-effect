#!/usr/bin/env python3
"""Read-only mismatch taxonomy; the unchanged TypeScript scorer remains authoritative."""
import argparse
import collections
import json
import pathlib


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def anchor(value):
    return [value["startChar"], value["endChar"], value["quote"]]


def nodes(trees):
    return {element["path"]: [tree["claimNumber"], element["kind"], anchor(element["anchor"])]
            for tree in trees for element in tree["elements"]}


def edges(tree, index, side):
    def node(path):
        return index.get(path, [side, "unmapped", path])

    def term(value):
        return [node(value["path"]), anchor(value["anchor"])]

    output = []
    for edge in tree["edges"]:
        kind = edge["kind"]
        if kind == "part-of":
            value = [node(edge["child"]), node(edge["parent"])]
        elif kind == "depends-on-element":
            value = [node(edge["dependent"]), node(edge["ancestor"])]
        elif kind == "antecedent":
            value = [term(edge["referring"]), term(edge["introducing"])]
        else:
            value = [node(edge["element"]), [[part["kind"], term(part["term"]) if part["kind"] == "term"
                                            else anchor(part["anchor"])] for part in edge["parts"]]]
        output.append(encoded([kind, *value]))
    return collections.Counter(output)


def diagnose(root, directory):
    results = json.loads((directory / "results.json").read_text())
    rows = []
    counts = collections.Counter()
    for family in results["families"]:
        if family["inputFailure"]:
            counts["input-failed"] += len(family["claims"])
            continue
        fixture = root / "packages/law-practice/domain/test/fixtures/claim-element/positive" / family["familyId"]
        references = json.loads((fixture / "expected.json").read_text())
        report = json.loads((directory / f"{family['familyId']}.prediction.json").read_text())
        inspection = results["schemaVersion"] in ("claim-input-inspection-evaluation/v1", "claim-input-tool-evaluation/v1")
        predictions = ([row["decomposition"]["tree"] for row in report["report"]["records"]
                        if row["decomposition"]["status"] == "decomposed"]
                       if inspection else report["report"]["trees"])
        reference_index, prediction_index = nodes(references), nodes(predictions)
        canonical_source = (json.loads((fixture / "claims.json").read_text())["claims"]
                            if inspection else report["claimSet"]["claims"])
        canonical = {claim["claimNumber"]: claim["claimText"] for claim in canonical_source}
        for score in family["claims"]:
            if score["strict"]:
                counts["strict-match"] += 1
                continue
            number = score["claimNumber"]
            gold = next(tree for tree in references if tree["claimNumber"] == number)
            predicted = next((tree for tree in predictions if tree["claimNumber"] == number), None)
            if predicted is None:
                counts["prediction-missing"] += 1
                continue
            gold_nodes = {encoded(reference_index[e["path"]]): e for e in gold["elements"]}
            actual_nodes = {encoded(prediction_index[e["path"]]): e for e in predicted["elements"]}
            missing_nodes, extra_nodes = gold_nodes.keys() - actual_nodes.keys(), actual_nodes.keys() - gold_nodes.keys()
            terms = [key for key in gold_nodes.keys() & actual_nodes.keys()
                     if gold_nodes[key]["terms"] != actual_nodes[key]["terms"]]
            # Term path names are absent from term payloads; exact anchors/order are retained.
            expected_edges = edges(gold, reference_index, "reference")
            actual_edges = edges(predicted, prediction_index, "prediction")
            missing_edges, extra_edges = expected_edges - actual_edges, actual_edges - expected_edges
            features = []
            if missing_nodes or extra_nodes:
                features.append("node-kind-or-boundary")
            if terms:
                features.append("term-anchor-head-or-order")
            for edge in list(missing_edges) + list(extra_edges):
                features.append(f"edge:{json.loads(edge)[0]}")
            for feature in set(features):
                counts[feature] += 1
            rows.append({"familyId": family["familyId"], "claimNumber": number,
                         "differenceCount": len(missing_nodes) + len(extra_nodes) + len(terms)
                         + sum(missing_edges.values()) + sum(extra_edges.values()),
                         "features": sorted(set(features)), "claimText": canonical[number],
                         "missingNodes": [json.loads(key) for key in sorted(missing_nodes)],
                         "extraNodes": [json.loads(key) for key in sorted(extra_nodes)],
                         "termMismatches": [{"node": json.loads(key), "expected": gold_nodes[key]["terms"],
                                             "predicted": actual_nodes[key]["terms"]} for key in sorted(terms)],
                         "missingEdges": [json.loads(key) for key in sorted(missing_edges)],
                         "extraEdges": [json.loads(key) for key in sorted(extra_edges)]})
    return {"schemaVersion": "claim-performance-diagnostics/v1", "authoritativeScorerChanged": False,
            "diagnosticOnly": True, "implementationDigest": results["implementationDigest"],
            "overlappingFailureCounts": dict(counts),
            "closest": sorted(rows, key=lambda row: (row["differenceCount"], row["familyId"], row["claimNumber"]))[:30],
            # Global nearest matches can hide entire recurring error classes.
            # These are development diagnostics only, never a scorer or cohort filter.
            "closestByFeature": {
                feature: sorted((row for row in rows if feature in row["features"]),
                                key=lambda row: (row["differenceCount"], row["familyId"], row["claimNumber"]))[:10]
                for feature in sorted({feature for row in rows for feature in row["features"]})
            }}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evaluation", type=pathlib.Path)
    args = parser.parse_args()
    print(json.dumps(diagnose(pathlib.Path(__file__).resolve().parents[3], args.evaluation), indent=2))
