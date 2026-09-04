#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).with_name("economics.py")
SPEC = importlib.util.spec_from_file_location("economics", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
economics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(economics)


class EmbeddedInputValidationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name) / "repo"
        self.output_root = self.repo / "goals" / "time-to-certainty" / "research"
        self.input_root = self.output_root / "inputs"
        self.script = self.output_root / "scripts" / "economics.py"
        self.live_snapshot = self.input_root / "live-journals.json.gz"
        self.hosted_snapshot = self.input_root / "hosted-runs.json.gz"
        self.input_receipts = self.input_root / "RECEIPTS.json"
        self.economics_json = self.output_root / "economics.json"
        self.economics_md = self.output_root / "economics.md"
        sources = (
            (economics.SCRIPT, self.script),
            (economics.LIVE_SNAPSHOT, self.live_snapshot),
            (economics.HOSTED_SNAPSHOT, self.hosted_snapshot),
            (economics.INPUT_RECEIPTS, self.input_receipts),
            (economics.ECONOMICS_JSON, self.economics_json),
            (economics.ECONOMICS_MD, self.economics_md),
        )
        for source, destination in sources:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)

        self.patches = contextlib.ExitStack()
        replacements = {
            "SCRIPT": self.script,
            "OUTPUT_ROOT": self.output_root,
            "INPUT_ROOT": self.input_root,
            "REPO_ROOT": self.repo,
            "DEFAULT_CORPUS": self.repo / "missing-corpus",
            "LIVE_SNAPSHOT": self.live_snapshot,
            "HOSTED_SNAPSHOT": self.hosted_snapshot,
            "INPUT_RECEIPTS": self.input_receipts,
            "ECONOMICS_JSON": self.economics_json,
            "ECONOMICS_MD": self.economics_md,
        }
        for name, value in replacements.items():
            self.patches.enter_context(mock.patch.object(economics, name, value))

        self.git("init", "-q")
        self.git("add", ".")
        self.git(
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.com",
            "commit",
            "-qm",
            "fixture",
        )

    def tearDown(self) -> None:
        self.patches.close()
        self.temporary.cleanup()

    def git(self, *args: str) -> None:
        subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True, text=True)

    def replay(self, *args: str) -> tuple[str, str]:
        stdout = io.StringIO()
        stderr = io.StringIO()
        with mock.patch.object(sys, "argv", [str(self.script), "--from-inputs", *args]):
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                economics.main()
        return stdout.getvalue(), stderr.getvalue()

    def drift_live_snapshot(self) -> None:
        data = bytearray(self.live_snapshot.read_bytes())
        data[9] = (data[9] + 1) % 256
        self.live_snapshot.write_bytes(data)

    def outputs(self) -> tuple[bytes, bytes]:
        return self.economics_json.read_bytes(), self.economics_md.read_bytes()

    def test_pristine_inputs_pass(self) -> None:
        outputs_before = self.outputs()
        self.replay()
        self.assertEqual(self.outputs(), outputs_before)

    def test_modified_input_fails_closed_and_names_path(self) -> None:
        self.drift_live_snapshot()
        outputs_before = self.outputs()
        with self.assertRaises(SystemExit) as raised:
            self.replay()
        self.assertIn(
            "goals/time-to-certainty/research/inputs/live-journals.json.gz",
            str(raised.exception),
        )
        self.assertEqual(self.outputs(), outputs_before)

    def test_modified_economics_fails_closed_and_names_path(self) -> None:
        report = json.loads(self.economics_json.read_text(encoding="utf-8"))
        report["unratifiedMutation"] = True
        economics.write_json(self.economics_json, report)
        outputs_before = self.outputs()
        with self.assertRaises(SystemExit) as raised:
            self.replay()
        self.assertIn("goals/time-to-certainty/research/economics.json", str(raised.exception))
        self.assertEqual(self.outputs(), outputs_before)

    def test_allow_input_drift_stamps_outputs(self) -> None:
        self.drift_live_snapshot()
        _, stderr = self.replay("--allow-input-drift")
        report = json.loads(self.economics_json.read_text(encoding="utf-8"))
        markdown = self.economics_md.read_text(encoding="utf-8")
        self.assertEqual(report["corpusValidation"], "embedded-drifted")
        self.assertIn("NON-RATIFIED EMBEDDED INPUT DRIFT", markdown)
        self.assertIn("--allow-input-drift", stderr)

    def test_receipts_mismatch_fails_closed(self) -> None:
        document = json.loads(self.input_receipts.read_text(encoding="utf-8"))
        document["files"][0]["sha256_12"] = "000000000000"
        economics.write_json(self.input_receipts, document)
        self.git("add", self.input_receipts.relative_to(self.repo).as_posix())
        self.git(
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.com",
            "commit",
            "-qm",
            "mismatched receipt",
        )
        outputs_before = self.outputs()
        with self.assertRaises(SystemExit) as raised:
            self.replay()
        self.assertIn(
            "goals/time-to-certainty/research/inputs/hosted-runs.json.gz",
            str(raised.exception),
        )
        self.assertEqual(self.outputs(), outputs_before)


class AttemptLoaderTest(unittest.TestCase):
    def test_finished_and_abnormal_terminal_rows_both_close_started_attempts(self) -> None:
        source = {
            "checkout": "fixture",
            "runId": "run",
            "source": "live",
            "path": "attempts.ndjson",
            "records": [
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "attempt-started",
                    "attemptId": "normal",
                    "startedAt": "2026-09-03T00:00:00Z",
                    "diffFingerprint": "fingerprint-normal",
                },
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "attempt-finished",
                    "attemptId": "normal",
                    "recordedAt": "2026-09-03T00:00:01Z",
                    "verdict": {"outcome": "success", "createdAt": "2026-09-03T00:00:01Z"},
                },
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "attempt-started",
                    "attemptId": "abnormal",
                    "startedAt": "2026-09-03T00:00:02Z",
                },
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "attempt-terminated",
                    "attemptId": "abnormal",
                    "recordedAt": "2026-09-03T00:00:03Z",
                    "reason": "queued-submitter-death",
                },
            ],
        }

        attempts, diagnostics = economics.load_attempts([source], [])

        self.assertEqual(diagnostics["finishedAttempts"], 2)
        self.assertEqual(diagnostics["startsWithoutFinish"], 0)
        by_id = {attempt["attemptId"]: attempt for attempt in attempts}
        self.assertEqual(by_id["normal"]["diffFingerprint"], "fingerprint-normal")
        self.assertEqual(by_id["abnormal"]["terminationReason"], "queued-submitter-death")

    def test_compact_live_snapshot_preserves_abnormal_terminal_facts(self) -> None:
        snapshot = {
            "capturedAt": "2026-09-03T00:00:04Z",
            "files": [
                {
                    "checkout": "fixture",
                    "kind": "attempts",
                    "runId": "run",
                    "payload": [
                        {
                            "schemaVersion": economics.ATTEMPT_SCHEMA,
                            "_tag": "attempt-started",
                            "attemptId": "abnormal",
                            "startedAt": "2026-09-03T00:00:02Z",
                            "branch": "feat/compact",
                            "mode": "verify",
                        },
                        {
                            "schemaVersion": economics.ATTEMPT_SCHEMA,
                            "_tag": "attempt-terminated",
                            "attemptId": "abnormal",
                            "recordedAt": "2026-09-03T00:00:03Z",
                            "reason": "stale-unverifiable-owner",
                            "resolvedHeadSha": "0123456789abcdef0123456789abcdef01234567",
                            "diffFingerprint": "fingerprint-abnormal",
                            "proofTier": "full",
                            "envProfile": "local",
                            "stage": "repair-loop",
                        },
                    ],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as corpus:
            compact = economics.compact_live_snapshot(snapshot, Path(corpus))
        sources, verdicts, _, _ = economics.live_payloads(compact)
        attempts, diagnostics = economics.load_attempts(sources, verdicts)

        self.assertEqual(diagnostics["invalidRows"], 0)
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0]["terminationReason"], "stale-unverifiable-owner")
        self.assertEqual(attempts[0]["resolvedHeadSha"], "0123456789abcdef0123456789abcdef01234567")
        self.assertEqual(attempts[0]["diffFingerprint"], "fingerprint-abnormal")
        self.assertEqual(attempts[0]["proofTier"], "full")
        self.assertEqual(attempts[0]["envProfile"], "local")
        self.assertEqual(attempts[0]["stage"], "repair-loop")

    def test_compacted_fixture_excludes_and_counts_left_censored_episode(self) -> None:
        def started(attempt_id: str, started_at: str) -> dict[str, object]:
            return {
                "schemaVersion": economics.ATTEMPT_SCHEMA,
                "_tag": "attempt-started",
                "attemptId": attempt_id,
                "startedAt": started_at,
                "branch": "feat/censored",
                "mode": "verify",
            }

        def terminated(attempt_id: str, recorded_at: str) -> dict[str, object]:
            return {
                "schemaVersion": economics.ATTEMPT_SCHEMA,
                "_tag": "attempt-terminated",
                "attemptId": attempt_id,
                "recordedAt": recorded_at,
                "reason": "failure",
            }

        def finished(attempt_id: str, recorded_at: str) -> dict[str, object]:
            return {
                "schemaVersion": economics.ATTEMPT_SCHEMA,
                "_tag": "attempt-finished",
                "attemptId": attempt_id,
                "recordedAt": recorded_at,
                "verdict": {"outcome": "success", "createdAt": recorded_at},
            }

        source = {
            "checkout": "fixture",
            "runId": "run",
            "source": "live",
            "path": "attempts.ndjson",
            "records": [
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "journal-compacted",
                    "recordedAt": "2026-09-03T00:00:03Z",
                    "evictedCount": 4,
                    "evictedAttemptIds": ["evicted-a", "evicted-b"],
                    "oldestEvictedRecordedAt": "2026-09-03T00:00:00Z",
                    "terminalEvictionCutoffRecordedAt": "2026-09-03T00:00:02Z",
                },
                started("left-red", "2026-09-03T00:00:01Z"),
                terminated("left-red", "2026-09-03T00:00:02Z"),
                started("left-green", "2026-09-03T00:00:03Z"),
                finished("left-green", "2026-09-03T00:00:04Z"),
                started("exact-red", "2026-09-03T00:00:05Z"),
                terminated("exact-red", "2026-09-03T00:00:06Z"),
                started("exact-green", "2026-09-03T00:00:07Z"),
                finished("exact-green", "2026-09-03T00:00:08Z"),
            ],
        }

        compact_records = [economics.compact_attempt_record(record) for record in source["records"]]
        attempts, diagnostics = economics.load_attempts([{**source, "records": compact_records}], [])
        summary = economics.red_to_green(attempts)["uncut"]

        self.assertEqual(diagnostics["compactionReceipts"], 1)
        self.assertEqual(diagnostics["leftCensoredJournals"], 1)
        self.assertEqual(summary["closedEpisodes"], 1)
        self.assertEqual(summary["leftCensoredEpisodesExcluded"], 1)
        self.assertEqual(summary["leftCensoredObservedAttempts"], 2)

    def test_fingerprint_quality_counts_only_recorded_string_facts(self) -> None:
        attempts = [
            {"diffFingerprint": None, "lanes": [{"commandHash": None}]},
            {"diffFingerprint": "fingerprint", "lanes": []},
        ]

        result = economics.fingerprint_quality(attempts, [])

        self.assertEqual(result["attemptsWithPerAttemptFingerprint"], 1)


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
            with mock.patch.object(economics, "validate_embedded_inputs", return_value="embedded"):
                with self.assertRaises(SystemExit) as raised:
                    economics.build_report(self.corpus, corpus_requested=True, allow_corpus_drift=False)
        self.assertIn("attempts/checkout/run/attempts.ndjson", str(raised.exception))
        self.assertEqual(
            (economics.ECONOMICS_JSON.read_bytes(), economics.ECONOMICS_MD.read_bytes()),
            outputs_before,
        )

    def test_corpus_mode_still_validates_embedded_inputs(self) -> None:
        payloads = economics.frozen_payloads(self.corpus)
        with contextlib.redirect_stderr(io.StringIO()):
            with mock.patch.object(economics, "load_committed_corpus_receipts", return_value=self.receipts):
                with mock.patch.object(economics, "validate_corpus", return_value=("validated", payloads)):
                    with mock.patch.object(
                        economics, "validate_embedded_inputs", return_value="embedded"
                    ) as validated:
                        economics.build_report(self.corpus, corpus_requested=True, allow_corpus_drift=False)
        validated.assert_called_once_with(False)

    def test_allow_corpus_drift_stamps_json_and_markdown(self) -> None:
        self.change_attempt()
        with contextlib.redirect_stderr(io.StringIO()):
            with mock.patch.object(economics, "load_committed_corpus_receipts", return_value=self.receipts):
                with mock.patch.object(economics, "validate_embedded_inputs", return_value="embedded"):
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
