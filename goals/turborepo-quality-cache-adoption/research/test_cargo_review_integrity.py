"""Small stdlib checks for Cargo review ledgers and replay startup safeguards."""

import ast
from collections import Counter
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

RESEARCH = Path(__file__).resolve().parent
DRIVERS = ("native-cargo-controls.py", "native-cargo-applicability.py")


class CargoReviewIntegrityTests(unittest.TestCase):
    def test_output_startup_creates_missing_parents(self):
        # Execute the real startup through output creation, before any native
        # tools, source reads, cache creation or fixtures can run.
        for driver in DRIVERS:
            tree = ast.parse((RESEARCH / driver).read_text())
            end = next(
                i
                for i, node in enumerate(tree.body)
                if isinstance(node, ast.Expr)
                and isinstance(node.value, ast.Call)
                and ast.unparse(node.value.func) == "out.mkdir"
            )
            startup = ast.Module(body=tree.body[: end + 1], type_ignores=[])
            for explicit in (False, True):
                with self.subTest(driver=driver, explicit=explicit):
                    with tempfile.TemporaryDirectory() as directory:
                        repo = Path(directory) / "checkout"
                        script = repo / "goals/review/research" / driver
                        output = (
                            Path(directory) / "missing/nested/output"
                            if explicit
                            else repo / ".beep/cargo-feature-review"
                            / ("synthetic" if "controls" in driver else "current")
                        )
                        self.assertFalse(output.parent.exists())
                        argv = [str(script)]
                        if explicit:
                            argv += ["--output", str(output)]
                        namespace = {"__file__": str(script)}
                        with patch.object(sys, "argv", argv):
                            exec(compile(startup, str(script), "exec"), namespace)
                        self.assertEqual(namespace["out"], output.resolve())
                        self.assertTrue(output.is_dir())
                        self.assertEqual(output.stat().st_mode & 0o777, 0o700)

    def test_git_discovery_and_revision_calls_have_five_second_timeout(self):
        for driver, expected_calls in zip(DRIVERS, (1, 3)):
            tree = ast.parse((RESEARCH / driver).read_text())
            calls = [
                node
                for node in ast.walk(tree)
                if isinstance(node, ast.Call)
                and ast.unparse(node.func) == "subprocess.check_output"
                and node.args
                and isinstance(node.args[0], ast.List)
                and isinstance(node.args[0].elts[0], ast.Constant)
                and node.args[0].elts[0].value == "git"
            ]
            with self.subTest(driver=driver):
                self.assertEqual(len(calls), expected_calls)
                for call in calls:
                    timeout = next(
                        (kw.value for kw in call.keywords if kw.arg == "timeout"),
                        None,
                    )
                    self.assertIsNotNone(timeout)
                    self.assertEqual(ast.literal_eval(timeout), 5)

    def test_review_counts_match_all_row_statuses(self):
        matrix = json.loads((RESEARCH / "current-feature-matrix.json").read_text())
        names = {
            "accepted-not-applicable": "acceptedNotApplicable",
            "accepted-retain-current-absence": "acceptedRetainCurrentAbsence",
            "pending": "pending",
        }
        statuses = Counter(row["acceptanceStatus"] for row in matrix["rows"])
        self.assertEqual(set(statuses), set(names))
        self.assertEqual(
            matrix["reviewCounts"],
            {names[status]: count for status, count in statuses.items()},
        )
        self.assertEqual(sum(matrix["reviewCounts"].values()), len(matrix["rows"]))

    def test_observed_bytes_match_retained_applicability_capture(self):
        decision = json.loads(
            (RESEARCH / "cargo-workspace-feature-review.json").read_text()
        )
        capture = json.loads((RESEARCH / "native-cargo-applicability.json").read_text())
        evidence = decision["currentGraphEvidence"]
        self.assertEqual(evidence["calls"], len(capture["observations"]))
        self.assertEqual(
            evidence["observedBytes"],
            sorted({row["nativeSummaryBytes"] for row in capture["observations"]}),
        )
        # This ledger binds the historical capture, not the amended replay driver.
        self.assertEqual(evidence["driverSha256"], capture["driverSha256"])
        self.assertEqual(evidence["captureBoundBytes"], capture["captureBoundBytes"])


if __name__ == "__main__":
    unittest.main()
