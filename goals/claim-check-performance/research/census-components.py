#!/usr/bin/env python3
"""Sealed legacy538 component census. Diagnostic only; never a scorer or legal judgment."""
import argparse
import collections
import hashlib
import json
import pathlib
import re


RESULT_SHA256 = "87e45d0bdcaa2f945bb986ec3c28a286144c09c394813427dedeebc9e52ec64d"
REFERENCE_ROOT = pathlib.Path("packages/law-practice/domain/test/fixtures/claim-element/positive")
FAMILY = re.compile(r"[0-9]+-root-[0-9]+\Z")
PATH = re.compile(r"[1-9][0-9]*(?:\.[a-z0-9]+)*\Z")
KINDS = {"part-of", "depends-on-element", "antecedent", "functional"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_pairs(pairs, description):
    output = {}
    for key, value in pairs:
        require(key not in output, f"Duplicate or ambiguous {description}")
        output[key] = value
    return output


def anchor(value):
    start, end, quote = (value[key] for key in ("startChar", "endChar", "quote"))
    require(type(start) is int and type(end) is int and 0 <= start < end and isinstance(quote, str),
            "Invalid source anchor")
    # Source offsets are UTF-16, so Python len(quote) is deliberately not used.
    return start, end, quote


def term_signature(term):
    return anchor(term["anchor"]), term["determiner"], term["head"]


def family_index(trees):
    """One family-wide path mapping; no independent claim/edge-specific remapping."""
    claims = unique_pairs(((tree["claimNumber"], tree) for tree in trees), "claim tree")
    nodes, identities, mentions = {}, set(), {}
    for number, tree in claims.items():
        require(type(number) is int and number > 0, "Invalid claim number")
        for element in tree["elements"]:
            path = element["path"]
            require(isinstance(path, str) and PATH.fullmatch(path) and int(path.split(".")[0]) == number,
                    "Invalid element path")
            key = number, element["kind"], anchor(element["anchor"])
            require(path not in nodes and key not in identities, "Duplicate or ambiguous node identity")
            nodes[path] = (key, element)
            identities.add(key)
            for term in element["terms"]:
                key_term = number, anchor(term["anchor"])
                mentions.setdefault(key_term, []).append((key, term))
        for edge in tree["edges"]:
            require(edge["kind"] in KINDS, "Unknown typed edge")
    return claims, nodes, mentions


def metric(gold, actual, unavailable_gold=0, unavailable_actual=0):
    left, right = collections.Counter(iter(gold)), collections.Counter(iter(actual))
    return {"gold": sum(left.values()), "predicted": sum(right.values()),
            "matched": sum((left & right).values()),
            "unavailableGold": unavailable_gold, "unavailablePredicted": unavailable_actual}


def agreement(pairs, unavailable=0):
    return {"compared": len(pairs), "matched": sum(left == right for left, right in pairs),
            "unavailable": unavailable}


def edge_key(edge, nodes, side, shared_nodes=None, shared_mentions=None, claim_scope=False):
    """None means an endpoint is unavailable for this conditional comparison."""
    def node(path):
        if path not in nodes:
            return (side, "unmapped", path) if shared_nodes is None else None
        key = nodes[path][0]
        return key if shared_nodes is None or key in shared_nodes else None

    def term(ref):
        identity = node(ref["path"])
        if identity is None:
            return None
        key = int(ref["path"].split(".")[0]), anchor(ref["anchor"])
        if shared_mentions is not None and key not in shared_mentions:
            return None
        return key if claim_scope else (identity, key[1])

    kind = edge["kind"]
    if kind == "part-of":
        values = (node(edge["child"]), node(edge["parent"]))
    elif kind == "depends-on-element":
        values = (node(edge["dependent"]), node(edge["ancestor"]))
    elif kind == "antecedent":
        values = (term(edge["referring"]), term(edge["introducing"]))
    else:
        parts = []
        for part in edge["parts"]:
            require(part["kind"] in ("term", "text"), "Unknown functional part")
            value = term(part["term"]) if part["kind"] == "term" else anchor(part["anchor"])
            if value is None:
                return None
            parts.append((part["kind"], value))
        values = (node(edge["element"]), tuple(parts))
    return None if any(value is None for value in values) else (kind, *values)


def components(reference, predicted, selected):
    gold, gn, gm = family_index(reference)
    actual, pn, pm = family_index(predicted)
    shared_nodes = {value[0] for value in gn.values()} & {value[0] for value in pn.values()}
    shared_mentions = {key for key in gm.keys() & pm.keys() if len(gm[key]) == len(pm[key]) == 1}
    # Reference dangling endpoints invalidate the identity mapping. Prediction
    # dangling endpoints retain side-specific identities, matching scorer semantics.
    for tree in reference:
        for edge in tree["edges"]:
            kind = edge["kind"]
            endpoints = ([edge["child"], edge["parent"]] if kind == "part-of" else
                         [edge["dependent"], edge["ancestor"]] if kind == "depends-on-element" else
                         [edge["referring"]["path"], edge["introducing"]["path"]] if kind == "antecedent" else
                         [edge["element"]] + [part["term"]["path"] for part in edge["parts"] if part["kind"] == "term"])
            require(all(path in gn for path in endpoints), "Reference edge endpoint unavailable")
    rows = []
    for score in selected:
        number = score["claimNumber"]
        require(number in gold, "Selected reference claim missing")
        left, right = gold[number], actual.get(number)
        ge, pe = left["elements"], right["elements"] if right else []
        gnodes = {key: element for key, element in gn.values() if key[0] == number}
        pnodes = {key: element for key, element in pn.values() if key[0] == number}
        def span_groups(elements):
            groups = {}
            for element in elements:
                groups.setdefault(anchor(element["anchor"]), []).append(element)
            return groups
        gs, ps = span_groups(ge), span_groups(pe)
        gspans = {key: values[0] for key, values in gs.items() if len(values) == 1}
        pspans = {key: values[0] for key, values in ps.items() if len(values) == 1}
        common_spans = gspans.keys() & pspans.keys()
        gterms = {key: values[0] for key, values in gm.items() if key[0] == number and len(values) == 1}
        pterms = {key: values[0] for key, values in pm.items() if key[0] == number and len(values) == 1}
        common_terms = gterms.keys() & pterms.keys()
        unmatched_terms = len({key for key in gm.keys() | pm.keys() if key[0] == number} - common_terms)
        ambiguous_terms = len({key for key in gm.keys() | pm.keys() if key[0] == number
                               and (len(gm.get(key, [])) > 1 or len(pm.get(key, [])) > 1)})
        measurements = {
            "elementSpan": metric([anchor(e["anchor"]) for e in ge], [anchor(e["anchor"]) for e in pe]),
            "elementIdentity": metric(gnodes, pnodes),
            "elementKindGivenSpan": agreement([(gspans[k]["kind"], pspans[k]["kind"]) for k in common_spans],
                                              len((gs.keys() | ps.keys()) - common_spans)),
            "termAnchor": metric([key for key, values in gm.items() if key[0] == number for _ in values],
                                 [key for key, values in pm.items() if key[0] == number for _ in values]),
            "termHeadGivenAnchor": agreement([(gterms[k][1]["head"], pterms[k][1]["head"]) for k in common_terms],
                                             unmatched_terms),
            "termDeterminerGivenAnchor": agreement([(gterms[k][1]["determiner"], pterms[k][1]["determiner"])
                                                   for k in common_terms], unmatched_terms),
            "termOwnershipGivenAnchor": agreement([(gterms[k][0], pterms[k][0]) for k in common_terms],
                                                  unmatched_terms),
            "termOrderGivenElement": agreement([
                ([anchor(t["anchor"]) for t in gnodes[k]["terms"]],
                 [anchor(t["anchor"]) for t in pnodes[k]["terms"]]) for k in gnodes.keys() & pnodes.keys()],
                len(gnodes.keys() ^ pnodes.keys())),
            "termPayloadGivenElement": agreement([
                ([term_signature(t) for t in gnodes[k]["terms"]],
                 [term_signature(t) for t in pnodes[k]["terms"]]) for k in gnodes.keys() & pnodes.keys()],
                len(gnodes.keys() ^ pnodes.keys())),
        }
        gedges, pedges = left["edges"], right["edges"] if right else []
        for kind in sorted(KINDS):
            gl = [e for e in gedges if e["kind"] == kind]
            pl = [e for e in pedges if e["kind"] == kind]
            measurements[f"edge:{kind}"] = metric([edge_key(e, gn, "reference") for e in gl],
                                                  [edge_key(e, pn, "prediction") for e in pl])
            gc = [edge_key(e, gn, "reference", shared_nodes, shared_mentions) for e in gl]
            pc = [edge_key(e, pn, "prediction", shared_nodes, shared_mentions) for e in pl]
            measurements[f"conditionalEdge:{kind}"] = metric([k for k in gc if k is not None],
                [k for k in pc if k is not None], gc.count(None), pc.count(None))
        # This is the set of claim parents observed in structural edges, not
        # normalized PatentClaim.claimReferences. Several element-level edges
        # to one ancestor claim must not manufacture additional claim parents.
        def claim_parents(edges):
            return {(int(e["dependent"].split(".")[0]), int(e["ancestor"].split(".")[0]))
                    for e in edges if e["kind"] == "depends-on-element"}
        measurements["claimParentFromEdges"] = metric(claim_parents(gedges), claim_parents(pedges))
        # Mention identity here is claim+anchor, independent of element ownership.
        def antecedents(edges, nodes, side):
            return [edge_key(e, nodes, side, None, shared_mentions, True)
                    for e in edges if e["kind"] == "antecedent"]
        ga, pa = antecedents(gedges, gn, "reference"), antecedents(pedges, pn, "prediction")
        measurements["antecedentGivenMention"] = metric([k for k in ga if k is not None],
            [k for k in pa if k is not None], ga.count(None), pa.count(None))
        exact_elements = metric(
            [(key, tuple(term_signature(t) for t in element["terms"])) for key, element in gnodes.items()],
            [(key, tuple(term_signature(t) for t in element["terms"])) for key, element in pnodes.items()])
        all_edges = metric([edge_key(e, gn, "reference") for e in gedges],
                           [edge_key(e, pn, "prediction") for e in pedges])
        exact = right is not None and all(v["gold"] == v["predicted"] == v["matched"]
                                        for v in (exact_elements, all_edges))
        require(type(score["strict"]) is bool and score["strict"] == exact,
                "Diagnostic equality disagrees with authoritative strict result")
        require(score["predictionMissing"] == (right is None), "Prediction missing flag disagrees")
        features = []
        for name, value in measurements.items():
            mismatch = (value["matched"] != value["compared"] if "compared" in value else
                        not value["gold"] == value["predicted"] == value["matched"])
            if mismatch:
                features.append(name)
            if value.get("unavailable", 0) or value.get("unavailableGold", 0) or value.get("unavailablePredicted", 0):
                features.append(f"unavailable:{name}")
        if right is None:
            features.append("prediction-missing")
        if ambiguous_terms:
            features.append("ambiguous-mention-anchor")
        rows.append({"claimNumber": number, "authoritativeStrict": score["strict"],
                     "predictionMissing": right is None, "abstained": score.get("abstained"),
                     "parsed": score.get("parsed"), "ambiguousMentionAnchors": ambiguous_terms,
                     "features": sorted(features), "metrics": measurements})
    return rows


def checked_path(base, relative):
    relative = pathlib.Path(relative)
    require(not relative.is_absolute() and ".." not in relative.parts, "Escaped input path")
    target = base / relative
    require(not any(p.is_symlink() for p in [target, *target.parents]),
            "Symlink input path refused")
    require(target.resolve().is_relative_to(base.resolve()), "Escaped input path")
    return target


def read_json(path, used, expected=None):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if expected is not None:
        require(digest == expected["sha256"] and len(raw) == expected["bytes"], "Sealed input identity mismatch")
    used.append({"path": str(path), "sha256": digest, "bytes": len(raw)})
    return json.loads(raw)


def output_path(root, replay, seal, output):
    require(not output.exists() and not output.is_symlink(), "Output must be a fresh directory")
    target = output.resolve()
    for source in (root.resolve(), replay.resolve(), seal.resolve()):
        require(not target.is_relative_to(source) and not source.is_relative_to(target), "Input/output overlap refused")
    require(not any(p.is_symlink() for p in output.parents), "Symlink output parent refused")
    return target


def run(root, replay, seal, output):
    """CLI admission is fixed to 60 families, 538 claims and 46 retained strict results."""
    root, replay, seal, output = map(lambda p: pathlib.Path(p).absolute(), (root, replay, seal, output))
    destination = output_path(root, replay, seal, output)
    used = []
    seal_data = read_json(checked_path(seal.parent, seal.name), used)
    require(pathlib.Path(seal_data["resultDirectory"]).resolve() == replay.resolve(), "Seal replay directory mismatch")
    entries = unique_pairs(((f["path"], f) for f in seal_data["files"]), "sealed file")
    require(len(entries) == 121 and "results.json" in entries, "Expected exact 121-file replay seal")
    require(entries["results.json"]["sha256"] == RESULT_SHA256, "Pinned results SHA mismatch")
    result = read_json(checked_path(replay, "results.json"), used, entries["results.json"])
    require(result["schemaVersion"] == "claim-input-tool-evaluation/v1", "Unexpected replay schema")
    families = unique_pairs(((f["familyId"], f) for f in result["families"]), "selected family")
    require(len(families) == 60 and all(FAMILY.fullmatch(f) for f in families), "Expected 60 safe family IDs")
    allowed = {"results.json"} | {f"{f}.{kind}.json" for f in families for kind in ("prediction", "service")}
    require(set(entries) == allowed, "Seal file allowlist differs from frozen selected families")
    selected = [(family, claim["claimNumber"]) for family, f in families.items() for claim in f["claims"]]
    require(len(selected) == 538 and len(set(selected)) == 538, "Expected 538 unique selected claims")
    require(sum(c["strict"] is True for f in families.values() for c in f["claims"]) == 46,
            "Expected 46 authoritative strict matches")
    rows = []
    for family, data in families.items():
        reference = read_json(checked_path(root, REFERENCE_ROOT / family / "expected.json"), used)
        prediction_name = f"{family}.prediction.json"
        payload = read_json(checked_path(replay, prediction_name), used, entries[prediction_name])
        records = payload["report"]["records"]
        unique_pairs(((r["decomposition"]["qualification"]["record"]["sourceOrdinal"], r) for r in records),
                     "source ordinal")
        predicted = [r["decomposition"]["tree"] for r in records if r["decomposition"]["status"] == "decomposed"]
        for row in components(reference, predicted, data["claims"]):
            row["familyId"] = family
            row["inputFailed"] = bool(data.get("inputFailure"))
            if row["inputFailed"]:
                row["features"].append("input-failed")
            rows.append(row)
    totals = {}
    patterns, features = collections.Counter(), collections.Counter()
    for row in rows:
        patterns[tuple(row["features"])] += 1
        features.update(row["features"])
        for name, values in row["metrics"].items():
            bucket = totals.setdefault(name, collections.Counter())
            bucket.update(values)
    def count_where(*names):
        return sum(all(n in row["features"] for n in names) for row in rows)
    cross = [{"left": left, "right": right, "claims": count_where(left, right)}
             for i, left in enumerate(sorted(features)) for right in sorted(features)[i:]]
    result_data = {
        "schemaVersion": "claim-component-diagnostics/v1", "diagnosticOnly": True,
        "authoritativeScorerChanged": False, "causalAttribution": False,
        "roleGoldAvailable": False, "policyGoldAvailable": False,
        "selectedFamilies": 60, "selectedClaims": len(rows),
        "authoritativeStrict": sum(row["authoritativeStrict"] for row in rows),
        "retainedStrictClaims": [{"familyId": r["familyId"], "claimNumber": r["claimNumber"]}
                                 for r in rows if r["authoritativeStrict"]],
        "implementationDigest": result["implementationDigest"], "inputsUsed": used,
        "diagnosticCodeSha256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
        "sealSha256": used[0]["sha256"], "metricTotals": totals,
        "overlappingFeatureCounts": features, "featureCrossTabs": cross,
        "patterns": [{"features": list(pattern), "claims": count}
                     for pattern, count in sorted(patterns.items(), key=lambda p: (-p[1], p[0]))],
        "limitations": ["Conditional metrics exclude unavailable endpoints and report their counts separately.",
                        "Role and legal policy correctness are unidentified by structural references.",
                        "Reference byte identities are recorded; original freeze preservation is an external gate.",
                        "Service files are allowlisted by seal but are not read or used by this census."],
        "claims": sorted(rows, key=lambda row: (row["familyId"], row["claimNumber"])),
    }
    # Construct/serialize everything before the exclusive create; errors never
    # overwrite evidence and incomplete reads never create a success artifact.
    encoded = json.dumps(result_data, indent=2, sort_keys=True) + "\n"
    destination.mkdir(parents=False, exist_ok=False)
    with (destination / "census.json").open("x") as stream:
        stream.write(encoded)
    return result_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("root", "replay", "seal", "output"):
        parser.add_argument(f"--{name}", type=pathlib.Path, required=True)
    args = parser.parse_args()
    report = run(args.root, args.replay, args.seal, args.output)
    print(json.dumps({"diagnosticOnly": True, "selectedClaims": report["selectedClaims"],
                      "authoritativeStrict": report["authoritativeStrict"], "output": str(args.output / "census.json")}))
