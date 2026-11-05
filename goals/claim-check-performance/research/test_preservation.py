"""Adversarial checks for the independently pinned runner-location addendum."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest


HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
SPEC = importlib.util.spec_from_file_location("preservation", HERE / "verify-preservation.py")
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)
ADDENDUM_PATH = pathlib.Path("goals/claim-check-performance/research/preservation-location-addendum.json")


class PreservationTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = pathlib.Path(self.scratch.name)
        self.addendum_bytes = (REPO / ADDENDUM_PATH).read_bytes()
        self.addendum = json.loads(self.addendum_bytes)
        self.write(ADDENDUM_PATH, self.addendum_bytes)
        files = []
        for row in self.addendum["mappings"]:
            for key in ("originalPath", "archivePath"):
                self.write(row[key], (REPO / row[key]).read_bytes())
            files.append({"path": row["originalPath"], "sha256": row["historicalSha256"]})
        self.write("goals/claim-check-performance/research/usefulness-gates.json", b"{}")
        self.freeze = {"files": files, "passingClaims": [],
                       "usefulnessGatesCanonicalSha256": hashlib.sha256(b"{}").hexdigest()}

    def write(self, path, data):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def test_original_addendum_and_both_runner_versions_pass(self):
        report = verifier.verify(self.root, self.freeze)
        self.assertTrue(report["preserved"])
        self.assertEqual(report["historicalRunnerArtifactsChecked"], 3)
        self.assertEqual(len(report["activeRunners"]), 3)

    def test_active_runner_tamper_is_detected(self):
        row = self.addendum["mappings"][0]
        self.write(row["originalPath"], b"changed active runner")
        report = verifier.verify(self.root, self.freeze)
        self.assertFalse(report["preserved"])
        self.assertIn(f"active-runner:{row['originalPath']}", report["changed"])

    def test_coordinated_runner_and_addendum_tamper_is_rejected(self):
        changed = copy.deepcopy(self.addendum)
        row = changed["mappings"][0]
        replacement = b"changed active runner with a self-updated digest"
        self.write(row["originalPath"], replacement)
        row["activeSha256"] = hashlib.sha256(replacement).hexdigest()
        self.write(ADDENDUM_PATH, json.dumps(changed).encode())
        with self.assertRaisesRegex(ValueError, "addendum.*digest"):
            verifier.verify(self.root, self.freeze)

    def test_historical_archive_tamper_remains_detected(self):
        row = self.addendum["mappings"][0]
        self.write(row["archivePath"], b"changed historical runner")
        report = verifier.verify(self.root, self.freeze)
        self.assertFalse(report["preserved"])
        self.assertIn(row["originalPath"], report["changed"])


if __name__ == "__main__":
    unittest.main()
