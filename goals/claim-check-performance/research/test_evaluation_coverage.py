"""Coverage adapters must preserve disclosed product uncertainty."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("gate_adapter", pathlib.Path(__file__).with_name("evaluate-gates.py"))
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class CoverageTests(unittest.TestCase):
    def inspection(self, qualification, status, parsed, abstained, warnings=()):
        claim = {"claimNumber": 7, "sourceOrdinal": 2, "parsed": parsed, "abstained": abstained,
                 "inspectionStatus": status, "stage": "undecomposed", "predictionMissing": False}
        report = {"records": [{"status": status,
                             "decomposition": {"qualification": {"status": qualification,
                                               "record": {"sourceOrdinal": 2}}},
                             "findings": [{"kind": kind} for kind in warnings]}]}
        return claim, report

    def test_normalization_failure_is_not_parsed(self):
        claim, report = self.inspection("normalization-failed", "unchecked", False, True)
        self.assertEqual(adapter.observed_coverage("claim-input-inspection-evaluation/v1", claim, report),
                         {"parsed": False, "abstained": True})

    def test_partial_and_ancestor_unchecked_trees_abstain(self):
        for status in ("partial", "unchecked"):
            claim, report = self.inspection("context-ready", status, True, True)
            self.assertTrue(adapter.observed_coverage("claim-input-inspection-evaluation/v1", claim, report)["abstained"])

    def test_flags_must_agree_with_product(self):
        claim, report = self.inspection("context-ready", "partial", True, False)
        with self.assertRaises(ValueError):
            adapter.observed_coverage("claim-input-inspection-evaluation/v1", claim, report)

    def test_uncovered_finding_cannot_pass_as_complete(self):
        claim, report = self.inspection("context-ready", "complete", True, False, ["pattern-not-covered"])
        with self.assertRaises(ValueError):
            adapter.observed_coverage("claim-input-inspection-evaluation/v1", claim, report)

    def test_missing_record_remains_unknown(self):
        self.assertEqual(adapter.observed_coverage("claim-input-inspection-evaluation/v1",
                         {"claimNumber": 7, "sourceOrdinal": None, "parsed": False, "abstained": True}, {}),
                         {"parsed": False, "abstained": True})

    def test_unknown_schema_refuses(self):
        with self.assertRaises(ValueError):
            adapter.observed_coverage("unknown", {}, {})

    def test_strict_coverage_is_unchanged(self):
        claim = {"claimNumber": 7, "stage": "structural-mismatch", "predictionMissing": False}
        self.assertEqual(adapter.observed_coverage("claim-antecedent-positive-evaluation/v1", claim, {}),
                         {"parsed": True, "abstained": False})
        warning = {"findings": [{"kind": "pattern-not-covered", "referring": {"path": "7.a"}}]}
        self.assertTrue(adapter.observed_coverage("claim-antecedent-positive-evaluation/v1", claim, warning)["abstained"])
        claim["stage"] = "input-failed"
        self.assertEqual(adapter.observed_coverage("claim-antecedent-positive-evaluation/v1", claim, {}),
                         {"parsed": False, "abstained": True})


if __name__ == "__main__":
    unittest.main()
