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


class ToolDeliveryTests(unittest.TestCase):
    def proof(self):
        report = {"input": {"sourceKey": "version-1", "records": [{"sourceOrdinal": 1}]},
                  "records": [{"status": "complete", "decomposition": {"qualification": {
                      "status": "context-ready", "record": {"sourceOrdinal": 1}, "claim": {"claimNumber": 7}}},
                               "findings": []}]}
        delivery = {"complete": True, "sourceKey": "version-1", "totalRecords": 1,
                    "deliveredRecords": 1, "pageCount": 1,
                    "pages": [{"startSourceOrdinal": 1, "endSourceOrdinal": 1, "bytes": 321}]}
        claim = {"claimNumber": 7, "sourceOrdinal": 1, "parsed": True,
                 "abstained": False, "inspectionStatus": "complete"}
        return report, delivery, claim

    def test_complete_tool_proof_preserves_coverage(self):
        report, delivery, claim = self.proof()
        self.assertEqual(adapter.observed_coverage("claim-input-tool-evaluation/v1", claim, report, delivery),
                         {"parsed": True, "abstained": False})

    def test_missing_proof_refuses(self):
        report, _, claim = self.proof()
        with self.assertRaises(ValueError):
            adapter.observed_coverage("claim-input-tool-evaluation/v1", claim, report)

    def test_oversized_page_refuses(self):
        report, delivery, _ = self.proof()
        delivery["pages"][0]["bytes"] = 1024 * 1024 + 1
        with self.assertRaises(ValueError):
            adapter.validate_tool_delivery(report, delivery)

    def test_range_gap_refuses(self):
        report, delivery, _ = self.proof()
        delivery["pages"][0]["startSourceOrdinal"] = 2
        with self.assertRaises(ValueError):
            adapter.validate_tool_delivery(report, delivery)

    def test_foreign_source_refuses(self):
        report, delivery, _ = self.proof()
        delivery["sourceKey"] = "other-version"
        with self.assertRaises(ValueError):
            adapter.validate_tool_delivery(report, delivery)

    def test_missing_product_stays_conservative(self):
        claim = {"claimNumber": 7, "sourceOrdinal": None, "parsed": False, "abstained": True}
        self.assertEqual(adapter.observed_coverage("claim-input-tool-evaluation/v1", claim, {}),
                         {"parsed": False, "abstained": True})


if __name__ == "__main__":
    unittest.main()
