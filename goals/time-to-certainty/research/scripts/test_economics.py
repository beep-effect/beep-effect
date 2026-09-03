#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).with_name("economics.py")
SPEC = importlib.util.spec_from_file_location("economics", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
economics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(economics)


class CorpusValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.corpus = Path(self.temporary.name)
        self.attempt = self.corpus / "attempts" / "checkout" / "run" / "attempts.ndjson"
        self.verdict = self.corpus / "verdicts" / "checkout" / "run" / "verdict.json"
        self.admission = self.corpus / "admission" / "session" / "journal.ndjson"
        for path in (self.attempt, self.verdict, self.admission):
            path.parent.mkdir(parents=True, exist_ok=True)
        self.attempt.write_text('{"_tag":"attempt-started","attemptId":"a"}\n', encoding="utf-8")
        self.verdict.write_text('{"outcome":"success"}\n', encoding="utf-8")
        self.admission.write_text('{"_tag":"admission-admitted","nonce":"n"}\n', encoding="utf-8")
        (self.corpus / "MANIFEST.yaml").write_text("schema_version: fixture/v1\n", encoding="utf-8")
        self.receipts = economics.corpus_file_receipts(self.corpus)
        self.embedded = economics.compact_frozen_inputs(self.corpus)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def validate(self, *, allow_drift: bool = False) -> str:
        with contextlib.redirect_stderr(io.StringIO()):
            status, _ = economics.validate_corpus(
                self.corpus,
                self.receipts,
                self.embedded,
                allow_drift,
            )
        return status

    def change_attempt(self) -> None:
        self.attempt.write_text('{"_tag":"attempt-started","attemptId":"changed"}\n', encoding="utf-8")

    def test_matching_corpus_passes(self) -> None:
        self.assertEqual(self.validate(), "validated")

    def test_changed_file_fails_closed_and_names_path(self) -> None:
        self.change_attempt()
        outputs_before = (economics.ECONOMICS_JSON.read_bytes(), economics.ECONOMICS_MD.read_bytes())
        with mock.patch.object(economics, "load_committed_corpus_receipts", return_value=self.receipts):
            with self.assertRaises(SystemExit) as raised:
                economics.build_report(self.corpus, corpus_requested=True, allow_corpus_drift=False)
        self.assertIn("attempts/checkout/run/attempts.ndjson", str(raised.exception))
        self.assertEqual(
            (economics.ECONOMICS_JSON.read_bytes(), economics.ECONOMICS_MD.read_bytes()),
            outputs_before,
        )

    def test_allow_corpus_drift_stamps_json_and_markdown(self) -> None:
        self.change_attempt()
        with contextlib.redirect_stderr(io.StringIO()):
            with mock.patch.object(economics, "load_committed_corpus_receipts", return_value=self.receipts):
                report = economics.build_report(
                    self.corpus,
                    corpus_requested=True,
                    allow_corpus_drift=True,
                )
        markdown = economics.render_economics(report)
        self.assertEqual(report["corpusValidation"], "drifted")
        self.assertIn("NON-RATIFIED CORPUS DRIFT", markdown)


if __name__ == "__main__":
    unittest.main()
