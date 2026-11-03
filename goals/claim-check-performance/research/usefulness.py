"""Conservative numerical gates over claim/alert/defect records, never aggregate claims.

This is a numerical verifier, not a provenance or legal-truth oracle. Independent
source qualification and blinding receipts remain separate mandatory acceptance.
"""
import collections
import math


def wilson(successes, total):
    if total == 0:
        return (0.0, 1.0)
    z = 1.959963984540054
    rate = successes / total
    denominator = 1 + z * z / total
    center = (rate + z * z / (2 * total)) / denominator
    radius = z * math.sqrt(rate * (1 - rate) / total + z * z / (4 * total * total)) / denominator
    return (max(0, center - radius), min(1, center + radius))


def unique(rows, keys):
    identities = [tuple(row[key] for key in keys) for row in rows]
    if len(identities) != len(set(identities)):
        raise ValueError(f"Duplicate records for {keys}")


def evaluate(evidence, gates, protected):
    checks = {}

    def check(name, passed, observed):
        checks[name] = {"passed": bool(passed), "observed": observed}

    legacy = evidence.get("legacyClaims", [])
    heldout = evidence.get("heldoutClaims", [])
    alerts = evidence.get("alerts", [])
    defects = evidence.get("defects", [])
    controls = evidence.get("controls", [])
    for rows in [legacy, heldout, controls]:
        unique(rows, ["familyId", "claimNumber"])
    for rows in [alerts, defects]:
        unique(rows, ["id"])
    legacy_ids = {(row["familyId"], row["claimNumber"]) for row in legacy}
    passed_ids = {(row["familyId"], row["claimNumber"]) for row in legacy if row.get("strict") is True}
    expected = {(row["familyId"], row["claimNumber"]) for row in protected}
    strict = len(passed_ids)
    check("legacy-strict", len(legacy) == gates["legacy"]["selectedClaims"]
          and strict >= gates["legacy"]["minimumStrictMatches"], {"strict": strict, "selected": len(legacy)})
    lost = sorted(expected - passed_ids)
    check("all-37-retained", len(expected) == 37 and not lost, {"lost": lost, "protected": len(expected)})
    # Overlapping family identifiers always refuse; source identity audit also
    # covers differently named aliases and priority/continuation family members.
    families = {row["familyId"] for row in heldout}
    legacy_families = {family for family, _ in legacy_ids}
    check("family-disjoint", bool(families) and not families & legacy_families,
          {"overlap": sorted(families & legacy_families), "families": len(families)})
    h = gates["heldout"]
    count = len(heldout)
    matched = sum(row.get("strict") is True for row in heldout)
    check("heldout-strict", count >= h["minimumClaims"] and len(families) >= h["minimumFamilies"]
          and matched >= h["minimumStrictRate"] * count,
          {"strict": matched, "selected": count, "families": len(families)})
    sections = {}
    for section in h["cpcSections"]:
        rows = [row for row in heldout if row.get("cpcSection") == section]
        sections[section] = {"claims": len(rows), "families": len({row["familyId"] for row in rows})}
    check("cpc-stratification", all(row["claims"] >= h["minimumClaimsPerSection"]
          and row["families"] >= h["minimumFamiliesPerSection"] for row in sections.values()), sections)
    for feature, minimum in [("nested", h["minimumNestedClaims"]), ("functional", h["minimumFunctionalClaims"]),
                             ("dependent", h["minimumDependentClaims"]),
                             ("multiple-dependent", h["minimumMultipleDependentClaims"])]:
        rows = [row for row in heldout if feature in row.get("features", [])]
        strict_count = sum(row.get("strict") is True for row in rows)
        check(f"complex:{feature}", len(rows) >= minimum
              and strict_count >= h["minimumComplexSubgroupStrictRate"] * len(rows),
              {"strict": strict_count, "selected": len(rows)})
    for name, rows in [("legacy", legacy), ("heldout", heldout)]:
        parsed = sum(row.get("parsed") is True for row in rows)
        # Missing flags are unknown and therefore abstentions, never successes.
        abstained = sum(row.get("abstained") is not False for row in rows)
        check(f"coverage:{name}", bool(rows)
              and parsed >= gates["coverage"]["minimumInputCoverage"] * len(rows)
              and abstained <= gates["coverage"]["maximumAbstentionRate"] * len(rows),
              {"parsed": parsed, "abstainedOrUnknown": abstained, "selected": len(rows)})
    substantive = [row for row in alerts if row.get("kind") != "pattern-not-covered"]
    true_alerts = sum(row.get("verdict") == "right" for row in substantive)
    lower, upper = wilson(true_alerts, len(substantive))
    a = gates["alerts"]
    check("alert-precision", len(substantive) >= a["minimumEvaluatedAlerts"]
          and true_alerts >= a["minimumPrecision"] * len(substantive) and lower >= a["minimumWilson95Lower"],
          {"right": true_alerts, "emitted": len(substantive), "wilson95": [lower, upper]})
    # Unknown truth/detection never contributes a true positive.
    detected = sum(row.get("truth") == "supported" and row.get("detected") is True for row in defects)
    lower, upper = wilson(detected, len(defects))
    d = gates["defects"]
    check("defect-recall", len(defects) >= d["minimumIndependentlySupportedDefects"]
          and detected >= d["minimumRecall"] * len(defects) and lower >= d["minimumWilson95Lower"],
          {"detected": detected, "selected": len(defects), "wilson95": [lower, upper]})
    kinds = collections.Counter(row.get("kind") for row in defects if row.get("truth") == "supported")
    check("defect-kind-coverage", all(kinds[kind] >= d["minimumEachFindingKind"] for kind in
          ["missing-antecedent", "ambiguous-antecedent", "antecedent-outside-chain", "number-mismatch"]), dict(kinds))
    erroneous = sum(row.get("verdict") != "no-erroneous-alert" for row in controls)
    lower, upper = wilson(erroneous, len(controls))
    c = gates["controls"]
    check("erroneous-alert-claims", len(controls) >= c["minimumClaims"]
          and erroneous <= c["maximumErroneousAlertRate"] * len(controls) and upper <= c["maximumWilson95Upper"],
          {"erroneousOrUnknown": erroneous, "selected": len(controls), "wilson95": [lower, upper]})
    return {"schemaVersion": "claim-performance-numerical-gates/v1", "numericalGatesPassed": all(
        value["passed"] for value in checks.values()), "provenanceValidatedByThisTool": False,
        "goalCompletionClaimed": False, "checks": checks}
