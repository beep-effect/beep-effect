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


class GeneratedMetadataTests(PreservationTests):
    def setUp(self):
        super().setUp()
        self.metadata_path = pathlib.Path("goals/claim-check-performance/research/preservation-generated-metadata-addendum.json")
        self.metadata_bytes = (REPO / self.metadata_path).read_bytes()
        self.metadata = json.loads(self.metadata_bytes)
        self.write(self.metadata_path, self.metadata_bytes)
        row = self.metadata["mappings"][0]
        for key in ("originalPath", "archivePath"):
            self.write(row[key], (REPO / row[key]).read_bytes())
        self.freeze["files"].append({"path": row["originalPath"], "sha256": row["historicalSha256"]})
        active = json.loads((REPO / row["originalPath"]).read_text())
        for report in active["researchReports"]:
            self.write(pathlib.Path("goals/claim-element-antecedent-check") / report, b"")

    def test_exact_generated_metadata_and_historical_archive_pass(self):
        report = verifier.verify(self.root, self.freeze)
        self.assertTrue(report["preserved"])
        self.assertEqual(report["historicalGeneratedMetadataArtifactsChecked"], 1)

    def test_active_generated_metadata_tamper_fails(self):
        row = self.metadata["mappings"][0]
        self.write(row["originalPath"], b"changed active manifest")
        with self.assertRaisesRegex(ValueError, "metadata digest"):
            verifier.verify(self.root, self.freeze)

    def test_original_metadata_archive_tamper_fails(self):
        self.write(self.metadata["mappings"][0]["archivePath"], b"changed original")
        with self.assertRaisesRegex(ValueError, "metadata digest"):
            verifier.verify(self.root, self.freeze)

    def test_self_updated_active_digest_cannot_change_a_status_field(self):
        row = self.metadata["mappings"][0]
        active = json.loads((self.root / row["originalPath"]).read_text())
        active["status"] = "completed-retained"
        raw = json.dumps(active).encode()
        self.write(row["originalPath"], raw)
        row["activeSha256"] = hashlib.sha256(raw).hexdigest()
        self.write(self.metadata_path, json.dumps(self.metadata).encode())
        with self.assertRaisesRegex(ValueError, "addendum.*digest"):
            verifier.verify(self.root, self.freeze)

    def test_extra_mapping_or_archive_traversal_cannot_self_authorize(self):
        for change in ("duplicate", "traversal"):
            with self.subTest(change=change):
                altered = json.loads(self.metadata_bytes)
                if change == "duplicate":
                    altered["mappings"].append(copy.deepcopy(altered["mappings"][0]))
                else:
                    altered["mappings"][0]["archivePath"] = "../outside"
                self.write(self.metadata_path, json.dumps(altered).encode())
                with self.assertRaisesRegex(ValueError, "addendum.*digest"):
                    verifier.verify(self.root, self.freeze)

    def test_new_directory_entry_requires_new_reviewed_projection(self):
        self.write("goals/claim-element-antecedent-check/research/new-unreviewed.json", b"{}")
        with self.assertRaisesRegex(ValueError, "directory projection"):
            verifier.verify(self.root, self.freeze)


if __name__ == "__main__":
    unittest.main()
