"""Small stdlib checks for Cargo review ledgers and replay startup safeguards."""

import ast
from collections import Counter
import hashlib
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

    def test_cache_startup_creates_missing_parents(self):
        for driver in DRIVERS:
            tree = ast.parse((RESEARCH / driver).read_text())
            assignment = next(
                node for node in tree.body
                if isinstance(node, ast.Assign)
                and ast.unparse(node.targets[0]) == "cache"
            )
            mkdir = next(
                node for node in tree.body
                if isinstance(node, ast.Expr)
                and isinstance(node.value, ast.Call)
                and ast.unparse(node.value.func) == "cache.mkdir"
            )
            startup = ast.Module(body=[assignment, mkdir], type_ignores=[])
            with (
                self.subTest(driver=driver),
                tempfile.TemporaryDirectory() as directory,
            ):
                home = Path(directory) / "missing-home"
                with patch.object(Path, "home", return_value=home):
                    namespace = {"Path": Path}
                    exec(compile(startup, driver, "exec"), namespace)
                cache = home / ".cache/beep/turbo-cargo-feature-probe"
                self.assertTrue(cache.is_dir())
                self.assertEqual(cache.stat().st_mode & 0o777, 0o700)

    def test_every_retained_discovery_row_rejects_failure_and_package_drift(self):
        driver = RESEARCH / "native-cargo-controls.py"
        function = next(
            node for node in ast.parse(driver.read_text()).body
            if isinstance(node, ast.FunctionDef)
            and node.name == "assert_discovery_row"
        )
        namespace = {}
        module = ast.Module(body=[function], type_ignores=[])
        exec(compile(module, str(driver), "exec"), namespace)
        check = namespace["assert_discovery_row"]
        report = json.loads((RESEARCH / "native-cargo-controls.json").read_text())
        rows = report["observations"]
        self.assertEqual(len(rows), 8)
        for row in rows:
            with self.subTest(
                channel=row["channel"], shape=row["shape"], enabled=row["enabled"]
            ):
                check(row)
                check({**row, "packages": list(reversed(row["packages"]))})
                for mutation in (
                    {"exit": 1},
                    {"packages": row["packages"][:-1]},
                    {"packages": row["packages"] + ["unexpected-native"]},
                    {"packages": row["packages"] + row["packages"][:1]},
                ):
                    with self.assertRaises(AssertionError):
                        check({**row, **mutation})

    def test_current_audit_hash_bindings_match_reviewed_files(self):
        audit = json.loads((RESEARCH / "current-completion-audit.json").read_text())
        self.assertEqual(
            audit["specSha256"],
            hashlib.sha256((RESEARCH.parent / "SPEC.md").read_bytes()).hexdigest(),
        )
        decision = audit["cargoWorkspaceFeatureReview"]
        self.assertEqual(
            decision["sha256"],
            hashlib.sha256(
                (RESEARCH.parent / decision["path"]).read_bytes()
            ).hexdigest(),
        )

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
