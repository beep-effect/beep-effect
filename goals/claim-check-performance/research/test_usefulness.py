"""Guard against silence, omitted inputs, optimistic unknowns and reused families."""
import copy
import json
import pathlib
import unittest
from usefulness import evaluate, wilson


GATES = json.loads(pathlib.Path(__file__).with_name("usefulness-gates.json").read_text())


def synthetic_evidence():
    legacy = [{"familyId": "old", "claimNumber": i, "strict": True, "parsed": True, "abstained": False}
              for i in range(1, 539)]
    heldout = [{"familyId": f"new-{i // 10}", "claimNumber": i, "cpcSection": "ABEFGH"[(i // 10) % 6],
                "strict": True, "parsed": True, "abstained": False,
                "features": ["nested", "functional", "dependent", "multiple-dependent"]} for i in range(240)]
    kinds = ["missing-antecedent", "ambiguous-antecedent", "antecedent-outside-chain", "number-mismatch"]
    return {"legacyClaims": legacy, "heldoutClaims": heldout,
            "alerts": [{"id": str(i), "kind": kinds[i % 4], "verdict": "right"} for i in range(100)],
            "defects": [{"id": str(i), "kind": kinds[i % 4], "truth": "supported", "detected": True}
                        for i in range(100)],
            "controls": [{"familyId": f"control-{i // 10}", "claimNumber": i,
                          "verdict": "no-erroneous-alert"} for i in range(200)]}


class UsefulnessTests(unittest.TestCase):
    def setUp(self):
        self.evidence = synthetic_evidence()
        self.protected = self.evidence["legacyClaims"][:37]

    def run_gate(self, evidence=None):
        return evaluate(self.evidence if evidence is None else evidence, GATES, self.protected)

    def test_synthetic_complete_example_only_passes_numerical_checks(self):
        report = self.run_gate()
        self.assertTrue(report["numericalGatesPassed"])
        self.assertFalse(report["provenanceValidatedByThisTool"])
        self.assertFalse(report["goalCompletionClaimed"])

    def test_empty_or_silent_checker_cannot_pass(self):
        self.assertFalse(self.run_gate({})["numericalGatesPassed"])
        self.evidence["alerts"] = []
        for row in self.evidence["defects"]:
            row["detected"] = False
        report = self.run_gate()
        self.assertFalse(report["checks"]["alert-precision"]["passed"])
        self.assertFalse(report["checks"]["defect-recall"]["passed"])

    def test_good_point_precision_with_weak_interval_fails(self):
        for row in self.evidence["alerts"][:5]:
            row["verdict"] = "wrong"
        self.assertFalse(self.run_gate()["checks"]["alert-precision"]["passed"])

    def test_unknowns_count_against_all_three_advisory_metrics(self):
        for row in self.evidence["alerts"][:20]:
            row["verdict"] = "unknown"
        for row in self.evidence["defects"][:30]:
            row["truth"] = "unknown"
        for row in self.evidence["controls"][:30]:
            row["verdict"] = "unknown"
        report = self.run_gate()
        for name in ["alert-precision", "defect-recall", "erroneous-alert-claims"]:
            self.assertFalse(report["checks"][name]["passed"])

    def test_unknown_truth_cannot_fill_supported_defect_sample_minimum(self):
        for row in self.evidence["defects"][:20]:
            row["truth"] = "unknown"
            row["detected"] = False
        report = self.run_gate()
        self.assertFalse(report["numericalGatesPassed"])
        self.assertFalse(report["checks"]["defect-recall"]["passed"])
        self.assertEqual(report["checks"]["defect-recall"]["observed"]["supported"], 80)

    def test_unknown_truth_stays_in_denominator_after_supported_minimum_met(self):
        self.evidence["defects"].extend({"id": f"unknown-{i}", "truth": "unknown", "detected": True}
                                        for i in range(20))
        observed = self.run_gate()["checks"]["defect-recall"]["observed"]
        self.assertEqual(observed["supported"], 100)
        self.assertEqual(observed["detected"], 100)
        self.assertEqual(observed["selected"], 120)

    def test_dropping_inputs_or_losing_one_original_pass_fails(self):
        self.evidence["legacyClaims"].pop()
        self.evidence["legacyClaims"][0]["strict"] = False
        report = self.run_gate()
        self.assertFalse(report["checks"]["legacy-strict"]["passed"])
        self.assertFalse(report["checks"]["all-37-retained"]["passed"])

    def test_easy_subgroup_cannot_hide_nested_failure(self):
        for row in self.evidence["heldoutClaims"][:150]:
            row["strict"] = False
        self.assertFalse(self.run_gate()["checks"]["complex:nested"]["passed"])

    def test_duplicate_records_and_exposed_families_refuse(self):
        self.evidence["heldoutClaims"][0]["familyId"] = "old"
        self.assertFalse(self.run_gate()["checks"]["family-disjoint"]["passed"])
        self.evidence["controls"].append(copy.deepcopy(self.evidence["controls"][0]))
        with self.assertRaises(ValueError):
            self.run_gate()

    def test_coverage_warnings_are_not_correct_defect_alerts(self):
        for row in self.evidence["alerts"]:
            row["kind"] = "pattern-not-covered"
        self.assertFalse(self.run_gate()["checks"]["alert-precision"]["passed"])

    def test_missing_coverage_flags_are_unknown(self):
        for row in self.evidence["heldoutClaims"]:
            del row["parsed"]
            del row["abstained"]
        self.assertFalse(self.run_gate()["checks"]["coverage:heldout"]["passed"])

    def test_wilson_known_boundary(self):
        lower, upper = wilson(0, 200)
        self.assertAlmostEqual(lower, 0)
        self.assertLess(upper, 0.02)


if __name__ == "__main__":
    unittest.main()
