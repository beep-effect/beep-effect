#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import gzip
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock


SCRIPT = Path(__file__).with_name("economics.py")
SPEC = importlib.util.spec_from_file_location("economics", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
economics = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(economics)

# Variables that point git at another repository, work tree, index or object
# store. A git hook exports some of them, so a fixture that inherits them would
# commit into the hook's repository and the script's blob-drift checks would
# read it instead of the fixture repository.
GIT_REDIRECT_VARIABLES = (
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES",
)
FLEET_ORIGIN = "git@github.com:beep-effect/beep-effect.git"


def clean_git_environment() -> contextlib.AbstractContextManager[Any]:
    """Patch `os.environ` without the git redirect variables for one test."""
    cleaned = {key: value for key, value in os.environ.items() if key not in GIT_REDIRECT_VARIABLES}
    return mock.patch.dict(os.environ, cleaned, clear=True)


class EmbeddedInputValidationTest(unittest.TestCase):
    """Default-run replay checks its embedded evidence against HEAD and fails closed on drift."""

    def setUp(self) -> None:
        """Copy the script, inputs and reports into a committed fixture repository and point the module at it."""
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
        self.patches.enter_context(clean_git_environment())
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
        self.git("remote", "add", "origin", FLEET_ORIGIN)
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


class CloseInputValidationTest(unittest.TestCase):
    """The committed close report replays byte for byte from its committed inputs.

    A later economics.py edit moves the reproduction-script receipt the close report
    embeds, so this replay goes red until the close report is re-rendered in the same
    change: the stale-pin class that left the baseline receipt behind on main.
    """

    def setUp(self) -> None:
        """Copy the script, close inputs, close reports and ratified baseline into a committed fixture repository."""
        self.temporary = tempfile.TemporaryDirectory()
        self.repo = Path(self.temporary.name) / "repo"
        self.output_root = self.repo / "goals" / "time-to-certainty" / "research"
        self.close_inputs = self.output_root / "inputs" / economics.CLOSE_INPUT_DIRECTORY
        self.script = self.output_root / "scripts" / "economics.py"
        self.close_json = self.output_root / economics.CLOSE_JSON_NAME
        self.close_md = self.output_root / economics.CLOSE_MD_NAME
        self.baseline_json = self.output_root / "economics.json"
        source_root = economics.SCRIPT.parent.parent
        sources = (
            (economics.SCRIPT, self.script),
            (source_root / "economics.json", self.baseline_json),
            (source_root / economics.CLOSE_JSON_NAME, self.close_json),
            (source_root / economics.CLOSE_MD_NAME, self.close_md),
            *(
                (source_root / "inputs" / economics.CLOSE_INPUT_DIRECTORY / name, self.close_inputs / name)
                for name in ("live-journals.json.gz", "hosted-runs.json.gz", "RECEIPTS.json")
            ),
        )
        for source, destination in sources:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)

        self.patches = contextlib.ExitStack()
        self.patches.enter_context(clean_git_environment())
        replacements = {
            "SCRIPT": self.script,
            "OUTPUT_ROOT": self.output_root,
            "REPO_ROOT": self.repo,
            "DEFAULT_CORPUS": self.repo / "missing-corpus",
            "RUN": economics.RUN,
            "INPUT_ROOT": economics.INPUT_ROOT,
            "LIVE_SNAPSHOT": economics.LIVE_SNAPSHOT,
            "HOSTED_SNAPSHOT": economics.HOSTED_SNAPSHOT,
            "INPUT_RECEIPTS": economics.INPUT_RECEIPTS,
            "ECONOMICS_JSON": economics.ECONOMICS_JSON,
            "ECONOMICS_MD": economics.ECONOMICS_MD,
        }
        for name, value in replacements.items():
            self.patches.enter_context(mock.patch.object(economics, name, value))

        self.git("init", "-q")
        self.git("remote", "add", "origin", FLEET_ORIGIN)
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
        """Undo the module patches and remove the fixture repository."""
        self.patches.close()
        self.temporary.cleanup()

    def git(self, *args: str) -> None:
        """Run one git command in the fixture repository."""
        subprocess.run(["git", *args], cwd=self.repo, check=True, capture_output=True, text=True)

    def replay(self, *args: str) -> tuple[str, str]:
        """Run `main` as a close-run `--from-inputs` replay; return its stdout and stderr."""
        stdout = io.StringIO()
        stderr = io.StringIO()
        argv = [str(self.script), "--run", economics.CLOSE_RUN, "--from-inputs", *args]
        with mock.patch.object(sys, "argv", argv):
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                economics.main()
        return stdout.getvalue(), stderr.getvalue()

    def outputs(self) -> tuple[bytes, bytes]:
        """The close report's JSON and markdown bytes."""
        return self.close_json.read_bytes(), self.close_md.read_bytes()

    def test_pristine_close_inputs_pass(self) -> None:
        """An untouched fixture replays to byte-identical close outputs."""
        outputs_before = self.outputs()
        self.replay()
        self.assertEqual(self.outputs(), outputs_before)

    def test_modified_baseline_fails_closed_and_names_path(self) -> None:
        """A changed ratified baseline fails the close replay closed, names its path and writes nothing."""
        report = json.loads(self.baseline_json.read_text(encoding="utf-8"))
        report["unratifiedMutation"] = True
        economics.write_json(self.baseline_json, report)
        outputs_before = self.outputs()
        with self.assertRaises(SystemExit) as raised:
            self.replay()
        self.assertIn("goals/time-to-certainty/research/economics.json", str(raised.exception))
        self.assertEqual(self.outputs(), outputs_before)

    def test_modified_close_input_fails_closed_and_names_path(self) -> None:
        """A changed close input fails the replay closed, names its path and writes nothing."""
        live = self.close_inputs / "live-journals.json.gz"
        data = bytearray(live.read_bytes())
        data[9] = (data[9] + 1) % 256
        live.write_bytes(data)
        outputs_before = self.outputs()
        with self.assertRaises(SystemExit) as raised:
            self.replay()
        self.assertIn(
            f"goals/time-to-certainty/research/inputs/{economics.CLOSE_INPUT_DIRECTORY}/live-journals.json.gz",
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


def lane(lane_id: str, duration: float | None, *, status: str = "passed", parent: str | None = None) -> dict[str, object]:
    """Build one verdict lane row; a None `duration` omits `durationMs` and `parent` sets `parentLaneId`."""
    row: dict[str, object] = {"id": lane_id, "label": lane_id, "phase": "full", "status": status}
    if duration is not None:
        row["durationMs"] = duration
    if parent is not None:
        row["parentLaneId"] = parent
    return row


def attempt(
    attempt_id: str,
    lanes: list[dict[str, object]],
    *,
    outcome: str = "success",
    started: str = "2026-09-20T00:00:00+00:00",
    elapsed: float = 100.0,
    fingerprint: str | None = None,
) -> dict[str, object]:
    """Build one loaded attempt row on the fixture checkout and branch, ended at its start."""
    started_at = economics.parse_ts(started)
    return {
        "attemptId": attempt_id,
        "branch": "feat/split",
        "checkout": "fixture",
        "diffFingerprint": fingerprint,
        "elapsedMs": elapsed,
        "endedAt": started_at,
        "failedStepId": None,
        "failureKind": None if outcome == "success" else "verification-failed",
        "key": ("fixture", "run", attempt_id),
        "lanes": lanes,
        "leftCensorCutoff": None,
        "message": "",
        "mode": "verify",
        "outcome": outcome,
        "startedAt": started_at,
        "terminationReason": None,
    }


class LanePopulationSplitTest(unittest.TestCase):
    """Wrapper and inner lanes are separate populations (ruling 74)."""

    def test_legacy_verdict_splits_by_wrapper_prefix(self) -> None:
        """A verdict without `parentLaneId` splits by the wrapper id prefixes."""
        lanes = [
            lane("full:01-pre-push", 50),
            lane("advisory:01-fallow-feedback", 5),
            lane("commit:01-git-commit", 5),
            lane("quality:lint", 20),
            lane("repo-sanity:versions", 1),
        ]
        wrappers, inner = economics.split_lanes(lanes)
        self.assertEqual(
            [row["id"] for row in wrappers],
            ["full:01-pre-push", "advisory:01-fallow-feedback", "commit:01-git-commit"],
        )
        self.assertEqual([row["id"] for row in inner], ["quality:lint", "repo-sanity:versions"])

    def test_parent_marked_verdict_splits_by_parent_lane_id(self) -> None:
        """A verdict that marks parents splits by `parentLaneId` alone, whatever the ids say."""
        lanes = [
            lane("full:01-pre-push", 50),
            lane("quality:lint", 20, parent="full:01-pre-push"),
            # In a verdict that marks parents, an unmarked lane is a wrapper
            # whatever its id says.
            lane("fallow:audit", 3),
        ]
        wrappers, inner = economics.split_lanes(lanes)
        self.assertEqual([row["id"] for row in wrappers], ["full:01-pre-push", "fallow:audit"])
        self.assertEqual([row["id"] for row in inner], ["quality:lint"])

    def test_wrapper_metrics_no_longer_count_inner_time_twice(self) -> None:
        """Wrapper totals exclude inner time; inner totals divide by the contributing attempts only."""
        attempts = [
            attempt(
                "a",
                [
                    lane("full:01-pre-push", 60),
                    lane("quality:lint", 40, parent="full:01-pre-push"),
                    lane("quality:check", 20, parent="full:01-pre-push"),
                ],
                elapsed=100,
            ),
            attempt("b", [lane("full:00-cheap-gates", 30)], elapsed=50),
        ]
        wrapper_rows, wrapper_totals = economics.lane_metrics(attempts)
        inner_rows, inner_totals = economics.inner_lane_metrics(attempts)

        self.assertEqual([row["id"] for row in wrapper_rows], ["full:01-pre-push", "full:00-cheap-gates"])
        self.assertEqual(wrapper_totals["totalMeasuredLaneDurationMs"], 90)
        self.assertEqual(wrapper_totals["totalAttemptElapsedMs"], 150)
        self.assertEqual(wrapper_totals["accountedLaneTimeAsPctOfAttemptElapsed"], 60.0)
        self.assertEqual([row["id"] for row in inner_rows], ["quality:lint", "quality:check"])
        self.assertEqual(inner_totals["totalMeasuredLaneDurationMs"], 60)
        # The inner denominator is only the attempts that contributed an inner lane.
        self.assertEqual(inner_totals["contributingAttempts"], 1)
        self.assertEqual(inner_totals["totalAttemptElapsedMs"], 100)
        self.assertEqual(inner_totals["accountedLaneTimeAsPctOfAttemptElapsed"], 60.0)
        self.assertEqual(inner_rows[0]["shareOfMeasuredLocalLaneTimePct"], 66.67)

    def test_episode_lane_minutes_split_wrapper_and_inner(self) -> None:
        """Episode lane minutes are summed per population, and inner minutes appear only on request."""
        red = attempt(
            "red",
            [
                lane("full:01-pre-push", 60_000, status="failed"),
                lane("quality:lint", 60_000, status="failed", parent="full:01-pre-push"),
            ],
            outcome="failure",
            started="2026-09-20T00:00:00+00:00",
        )
        green = attempt(
            "green",
            [lane("full:01-pre-push", 120_000), lane("quality:lint", 60_000, parent="full:01-pre-push")],
            started="2026-09-20T00:10:00+00:00",
        )
        closed, _, _ = economics.build_episodes([red, green])
        self.assertEqual(len(closed), 1)
        self.assertEqual(closed[0]["laneDurationMs"], 180_000)
        self.assertEqual(closed[0]["innerLaneDurationMs"], 120_000)
        summary = economics.red_to_green([red, green], include_inner=True)["uncut"]
        self.assertEqual(summary["measuredLaneMachineMinutes"], 3.0)
        self.assertEqual(summary["measuredInnerLaneMachineMinutes"], 2.0)
        self.assertNotIn("measuredInnerLaneMachineMinutes", economics.red_to_green([red, green])["uncut"])

    def test_first_failure_walk_still_stops_at_the_failed_wrapper(self) -> None:
        """The M2 offset walk stops at the failed wrapper; the actionable lane is the failed inner lane."""
        red = attempt(
            "red",
            [
                lane("full:00-cheap-gates", 10_000),
                lane("full:01-pre-push", 60_000, status="failed"),
                lane("quality:lint", 5_000, parent="full:01-pre-push"),
                lane("quality:check", 7_000, status="failed", parent="full:01-pre-push"),
            ],
            outcome="failure",
        )
        result = economics.first_failure_metrics([red])
        self.assertEqual(result["startOffsetP50Ms"], 10_000)
        self.assertEqual(result["completionOffsetP50Ms"], 70_000)
        self.assertEqual(result["actionableLaneMix"], [{"attempts": 1, "lane": "quality:check"}])

    def test_compaction_keeps_parent_lane_id(self) -> None:
        """Verdict compaction keeps `parentLaneId`."""
        compact = economics.compact_verdict({"lanes": [lane("quality:lint", 1, parent="full:01-pre-push")]})
        self.assertEqual(compact["lanes"][0]["parentLaneId"], "full:01-pre-push")


class LiveDiscoveryTest(unittest.TestCase):
    """Live journal discovery over a fixture projects root (rulings 71 and 73)."""

    def setUp(self) -> None:
        """Create an empty projects root."""
        self.temporary = tempfile.TemporaryDirectory()
        self.projects = Path(self.temporary.name).resolve()

    def tearDown(self) -> None:
        """Remove the projects root."""
        self.temporary.cleanup()

    def checkout(
        self,
        relative: str,
        *,
        runs: bool = True,
        clone: str | None = None,
        origin: str = FLEET_ORIGIN,
    ) -> Path:
        """Create a checkout; `clone` names the owning clone of a linked lane."""
        path = self.projects / relative
        path.mkdir(parents=True, exist_ok=True)
        if runs:
            (path / ".beep" / "yeet" / "runs").mkdir(parents=True)
        if clone is None:
            (path / ".git").mkdir(exist_ok=True)
            self.write_config(path / ".git", origin=origin)
        else:
            gitdir = self.projects / clone / ".git" / "worktrees" / path.name
            gitdir.mkdir(parents=True, exist_ok=True)
            (gitdir / "commondir").write_text("../..\n", encoding="utf-8")
            (path / ".git").write_text(f"gitdir: {gitdir}\n", encoding="utf-8")
        return path

    @staticmethod
    def write_config(common: Path, *, origin: str, bare: bool = False) -> None:
        """Write a Git config into `common` whose origin url is `origin`."""
        common.mkdir(parents=True, exist_ok=True)
        (common / "config").write_text(
            f'[core]\n\tbare = {"true" if bare else "false"}\n[remote "origin"]\n\turl = {origin}\n'
            '\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
            encoding="utf-8",
        )

    def separated_checkout(self, relative: str, common: Path, *, origin: str, lane: bool = False) -> Path:
        """Create a checkout whose `.git` file points outside it at a common dir not named `.git`.

        With `lane`, the `.git` file names `<common>/worktrees/<name>`, whose
        `commondir` points back at the common dir; without it, the `.git` file
        names the common dir directly (a `--separate-git-dir` checkout).
        """
        path = self.projects / relative
        (path / ".beep" / "yeet" / "runs").mkdir(parents=True)
        self.write_config(common, origin=origin, bare=True)
        gitdir = common
        if lane:
            gitdir = common / "worktrees" / path.name
            gitdir.mkdir(parents=True)
            (gitdir / "commondir").write_text("../..\n", encoding="utf-8")
        (path / ".git").write_text(f"gitdir: {gitdir}\n", encoding="utf-8")
        return path

    def test_projects_root_is_derived_from_a_clone_or_a_lane(self) -> None:
        """The projects root is derived from a clone and from each lane layout."""
        clone = self.projects / "beep-effect3"
        self.assertEqual(economics.derive_projects_root(clone), self.projects)
        self.assertEqual(
            economics.derive_projects_root(self.projects / "beep-effect3-worktrees" / "ttc-close"),
            self.projects,
        )
        self.assertEqual(
            economics.derive_projects_root(self.projects / "beep-effect-worktrees" / "lane"),
            self.projects,
        )
        self.assertEqual(
            economics.derive_projects_root(clone / ".claude" / "worktrees" / "lane"),
            self.projects,
        )

    def test_discovers_numbered_worktree_lanes_and_skips_symlinks(self) -> None:
        """Discovery finds clones and every lane layout that holds journals, and skips symlinked candidates."""
        self.checkout("beep-effect")
        self.checkout("beep-effect3")
        self.checkout("beep-effect12")
        lane_root = self.checkout("beep-effect3-worktrees/ttc-close", runs=False, clone="beep-effect3")
        self.checkout("beep-effect3-worktrees/numbered-lane", clone="beep-effect3")
        self.checkout("beep-effect12-worktrees/other-lane", clone="beep-effect12")
        self.checkout("beep-effect-worktrees/legacy-lane", clone="beep-effect")
        self.checkout("beep-effect3/.claude/worktrees/app-lane", clone="beep-effect3")
        self.checkout("beep-effect5-worktrees/no-journal", runs=False, clone="beep-effect3")
        self.checkout("unrelated-clone")
        (self.projects / "beep-effect3-worktrees" / "linked").symlink_to(self.projects / "beep-effect12")

        with mock.patch.object(economics, "REPO_ROOT", lane_root), mock.patch.object(
            economics, "PROJECTS_ROOT", economics.derive_projects_root(lane_root)
        ):
            labels = [economics.checkout_label(root) for root in economics.discover_live_roots()]

        self.assertEqual(
            labels,
            sorted(
                [
                    "beep-effect",
                    "beep-effect-worktrees/legacy-lane",
                    "beep-effect12",
                    "beep-effect12-worktrees/other-lane",
                    "beep-effect3",
                    "beep-effect3-worktrees/numbered-lane",
                    "beep-effect3/.claude/worktrees/app-lane",
                ]
            ),
        )

    def test_other_repositories_matching_the_name_glob_are_excluded(self) -> None:
        """Checkouts whose origin is another repository are excluded even when their names match the glob."""
        private_origin = "git@github.com:beep-effect/beep-effect-private.git"
        self.checkout("beep-effect3")
        self.checkout("beep-effect-private", origin=private_origin)
        self.checkout("beep-effect-private/.claude/worktrees/private-lane", clone="beep-effect-private")
        self.checkout("beep-effect-private-worktrees/private-lane", clone="beep-effect-private")
        self.checkout("beep-effect9", origin="https://github.com/someone/beep-effect-fork")
        self.checkout("beep-effect4-no-git")
        shutil.rmtree(self.projects / "beep-effect4-no-git" / ".git")
        lane_root = self.checkout("beep-effect3-worktrees/ttc-close", clone="beep-effect3")
        # A half-removed lane (journals left, `.git` file gone) is owned by its layout's clone.
        self.checkout("beep-effect3-worktrees/half-removed", clone="beep-effect3")
        (self.projects / "beep-effect3-worktrees" / "half-removed" / ".git").unlink()
        self.checkout("beep-effect-private-worktrees/half-removed", clone="beep-effect-private")
        (self.projects / "beep-effect-private-worktrees" / "half-removed" / ".git").unlink()

        with mock.patch.object(economics, "REPO_ROOT", lane_root), mock.patch.object(
            economics, "PROJECTS_ROOT", self.projects
        ):
            labels = [economics.checkout_label(root) for root in economics.discover_live_roots()]

        self.assertEqual(
            labels,
            ["beep-effect3", "beep-effect3-worktrees/half-removed", "beep-effect3-worktrees/ttc-close"],
        )
        self.assertEqual(economics.origin_repository(lane_root), "beep-effect/beep-effect")
        self.assertEqual(
            economics.origin_repository(self.projects / "beep-effect-private-worktrees" / "private-lane"),
            "beep-effect/beep-effect-private",
        )
        self.assertEqual(
            economics.origin_repository(self.projects / "beep-effect9"), "someone/beep-effect-fork"
        )
        self.assertIsNone(economics.origin_repository(self.projects / "beep-effect4-no-git"))

    def test_bare_or_separated_common_dirs_are_judged_by_their_own_config(self) -> None:
        """A bare or separated common dir is the owning clone and supplies the origin config (ruling 71)."""
        elsewhere = self.projects / "elsewhere"
        fleet_common = elsewhere / "beep-effect.git"
        separated = self.separated_checkout("beep-effect11", fleet_common, origin=FLEET_ORIGIN)
        lane = self.separated_checkout(
            "beep-effect11-worktrees/bare-lane", fleet_common, origin=FLEET_ORIGIN, lane=True
        )
        other = self.separated_checkout(
            "beep-effect12",
            elsewhere / "beep-effect-private.git",
            origin="git@github.com:beep-effect/beep-effect-private.git",
        )
        lane_root = self.checkout("beep-effect3-worktrees/ttc-close", runs=False, clone="beep-effect3")
        self.checkout("beep-effect3", runs=False)

        # Ruling 71: a common dir not named `.git` is itself the owning clone.
        self.assertEqual(economics.owning_clone(separated), fleet_common)
        self.assertEqual(economics.owning_clone(lane), fleet_common)
        self.assertEqual(economics.owning_clone(lane_root), self.projects / "beep-effect3")
        self.assertEqual(economics.origin_repository(lane), "beep-effect/beep-effect")
        self.assertEqual(economics.origin_repository(other), "beep-effect/beep-effect-private")

        with mock.patch.object(economics, "REPO_ROOT", lane_root), mock.patch.object(
            economics, "PROJECTS_ROOT", self.projects
        ):
            labels = [economics.checkout_label(root) for root in economics.discover_live_roots()]

        self.assertEqual(labels, ["beep-effect11", "beep-effect11-worktrees/bare-lane"])

    def test_symlinked_git_directory_names_the_checkout_as_its_clone(self) -> None:
        """A `.git` symlink to a directory with another name still names the checkout as its clone.

        The common dir is `<checkout>/.git`, never the symlink target, and the
        origin config is read through the symlink from the target's real path.
        """
        elsewhere = self.projects / "elsewhere"
        clone = self.projects / "beep-effect8"
        (clone / ".beep" / "yeet" / "runs").mkdir(parents=True)
        self.write_config(elsewhere / "beep-effect8-gitdir", origin=FLEET_ORIGIN)
        (clone / ".git").symlink_to(elsewhere / "beep-effect8-gitdir", target_is_directory=True)
        other = self.projects / "beep-effect9"
        (other / ".beep" / "yeet" / "runs").mkdir(parents=True)
        self.write_config(elsewhere / "private-gitdir", origin="git@github.com:beep-effect/beep-effect-private.git")
        (other / ".git").symlink_to(elsewhere / "private-gitdir", target_is_directory=True)
        # A half-removed lane falls back to its layout's clone through the same symlink.
        half_removed = self.projects / "beep-effect8-worktrees" / "half-removed"
        (half_removed / ".beep" / "yeet" / "runs").mkdir(parents=True)
        lane_root = self.checkout("beep-effect3-worktrees/ttc-close", runs=False, clone="beep-effect3")
        self.checkout("beep-effect3", runs=False)

        self.assertEqual(economics.git_common_dir(clone), clone / ".git")
        self.assertEqual(economics.owning_clone(clone), clone)
        self.assertEqual(economics.owning_clone(half_removed), clone)
        self.assertEqual(economics.owning_clone(other), other)
        self.assertEqual(economics.origin_repository(clone), "beep-effect/beep-effect")
        self.assertEqual(economics.origin_repository(half_removed), "beep-effect/beep-effect")
        self.assertEqual(economics.origin_repository(other), "beep-effect/beep-effect-private")

        with mock.patch.object(economics, "REPO_ROOT", lane_root), mock.patch.object(
            economics, "PROJECTS_ROOT", self.projects
        ):
            labels = [economics.checkout_label(root) for root in economics.discover_live_roots()]

        self.assertEqual(labels, ["beep-effect8", "beep-effect8-worktrees/half-removed"])

    def test_repository_root_of_another_repository_is_skipped_with_a_notice(self) -> None:
        """A repository root from another repository is skipped with exactly one stderr notice."""
        private_origin = "git@github.com:beep-effect/beep-effect-private.git"
        self.checkout("beep-effect3")
        self.checkout("beep-effect-private", runs=False, origin=private_origin)
        lane_root = self.checkout("beep-effect-private-worktrees/capture-lane", clone="beep-effect-private")

        stderr = io.StringIO()
        with mock.patch.object(economics, "REPO_ROOT", lane_root), mock.patch.object(
            economics, "PROJECTS_ROOT", self.projects
        ), contextlib.redirect_stderr(stderr):
            labels = [economics.checkout_label(root) for root in economics.discover_live_roots()]

        self.assertEqual(labels, ["beep-effect3"])
        notices = stderr.getvalue().splitlines()
        self.assertEqual(len(notices), 1)
        self.assertIn("skipped the repository root beep-effect-private-worktrees/capture-lane", notices[0])
        self.assertIn("beep-effect/beep-effect-private", notices[0])

    def test_repository_root_of_the_fleet_is_kept_without_a_notice(self) -> None:
        """A fleet repository root is kept and prints nothing."""
        lane_root = self.checkout("beep-effect3-worktrees/ttc-close", clone="beep-effect3")
        self.checkout("beep-effect3", runs=False)
        stderr = io.StringIO()
        with mock.patch.object(economics, "REPO_ROOT", lane_root), mock.patch.object(
            economics, "PROJECTS_ROOT", self.projects
        ), contextlib.redirect_stderr(stderr):
            labels = [economics.checkout_label(root) for root in economics.discover_live_roots()]
        self.assertEqual(labels, ["beep-effect3-worktrees/ttc-close"])
        self.assertEqual(stderr.getvalue(), "")

    def test_projects_root_flag_overrides_the_derived_root(self) -> None:
        """An explicit projects root replaces the derived one."""
        self.checkout("beep-effect7")
        with mock.patch.object(economics, "REPO_ROOT", self.projects / "elsewhere" / "repo"):
            roots = economics.discover_live_roots(self.projects)
        self.assertEqual([root.name for root in roots], ["beep-effect7"])


class ReconcilerTerminationTest(unittest.TestCase):
    """Terminations the reconciler stamps versus terminations an attempt writes itself."""

    def test_sweep_stamped_termination_ends_no_duration(self) -> None:
        """A sweep-stamped termination has no end or elapsed time; an attempt-written one keeps its fallback."""
        def rows(attempt_id: str, reason: str) -> list[dict[str, object]]:
            """A started row and a terminated row for one attempt."""
            return [
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "attempt-started",
                    "attemptId": attempt_id,
                    "startedAt": "2026-09-03T00:00:00Z",
                },
                {
                    "schemaVersion": economics.ATTEMPT_SCHEMA,
                    "_tag": "attempt-terminated",
                    "attemptId": attempt_id,
                    "recordedAt": "2026-09-20T00:00:00Z",
                    "reason": reason,
                },
            ]

        source = {
            "checkout": "fixture",
            "runId": "run",
            "source": "live",
            "path": "attempts.ndjson",
            "records": [*rows("swept", "legacy-unowned-start"), *rows("died", "interrupted")],
        }
        attempts, _ = economics.load_attempts([source], [])
        by_id = {row["attemptId"]: row for row in attempts}
        self.assertIsNone(by_id["swept"]["elapsedMs"])
        self.assertIsNone(by_id["swept"]["endedAt"])
        self.assertIsNotNone(by_id["swept"]["startedAt"])
        # A row written when the attempt dies keeps the endedAt - startedAt fallback.
        self.assertEqual(by_id["died"]["elapsedMs"], 17 * 24 * 60 * 60 * 1000)


class CloseRunTest(unittest.TestCase):
    """The close run's file routing and its ruling-8 measures."""

    def test_close_run_reads_and_writes_its_own_files(self) -> None:
        """`configure_run` routes the close run to its own files and leaves the baseline path fixed."""
        names = ("RUN", "INPUT_ROOT", "LIVE_SNAPSHOT", "HOSTED_SNAPSHOT", "INPUT_RECEIPTS", "ECONOMICS_JSON", "ECONOMICS_MD")
        with contextlib.ExitStack() as stack:
            for name in names:
                stack.enter_context(mock.patch.object(economics, name, getattr(economics, name)))
            economics.configure_run(economics.CLOSE_RUN)
            root = economics.OUTPUT_ROOT
            self.assertEqual(economics.LIVE_SNAPSHOT, root / "inputs" / "close" / "live-journals.json.gz")
            self.assertEqual(economics.HOSTED_SNAPSHOT, root / "inputs" / "close" / "hosted-runs.json.gz")
            self.assertEqual(economics.INPUT_RECEIPTS, root / "inputs" / "close" / "RECEIPTS.json")
            self.assertEqual(economics.ECONOMICS_JSON, root / "economics-close.json")
            self.assertEqual(economics.ECONOMICS_MD, root / "economics-close.md")
            # Corpus receipts and the comparison always come from the ratified baseline.
            self.assertEqual(economics.baseline_json_path(), root / "economics.json")
        self.assertEqual(economics.RUN, economics.BASELINE_RUN)
        self.assertEqual(economics.baseline_json_path(), economics.ECONOMICS_JSON)

    def test_ratified_baseline_projects_the_ruling_8_rows(self) -> None:
        """The ratified baseline projects to the known ruling-8 values."""
        baseline = json.loads(economics.ECONOMICS_JSON.read_text(encoding="utf-8"))
        values = economics.comparison_values(baseline, full_report=True)
        self.assertEqual(values["M1 closed episodes (<=24h)"], 328)
        self.assertEqual(values["M1 right-censored streaks (<=24h)"], 115)
        self.assertEqual(values["M1 right-censored red attempts (<=24h)"], 313)
        self.assertEqual(economics.fmt_ms(values["M1 P50 comparable <=24h"]), "43.3m")
        self.assertEqual(economics.fmt_ms(values["M1 P95 comparable <=24h"]), "3.95h")
        self.assertEqual(economics.fmt_ms(values["M2 completion P50"]), "8.4m")
        self.assertEqual(values["M2 reconstructable failures"], 832)
        self.assertEqual(values["M3 Test Integration runs per attempt"], 1.264)
        self.assertEqual(values["M3 Docgen max runs in one attempt"], 3)
        self.assertEqual(values["M4 classification"], "unmeasurable")
        self.assertEqual(values["M5 starts without finish"], 327)
        self.assertEqual(values["M5 starts"], 3069)
        self.assertEqual(values["M5 starts without an attempt-written terminal row"], 327)
        self.assertIsNone(values["M5 journaled terminations"])

    def test_fingerprint_repeat_counts_verdict_red_then_green_on_the_same_tree(self) -> None:
        """The M4 proxy counts a verdict-bearing red followed by green on the same fingerprint (ruling 75)."""
        attempts = [
            attempt("r1", [lane("quality:lint", 1, status="failed")], outcome="failure", started="2026-09-20T00:00:00+00:00", fingerprint="t1"),
            attempt("g1", [], started="2026-09-20T00:01:00+00:00", fingerprint="t1"),
            attempt("r2", [], outcome="failure", started="2026-09-20T00:02:00+00:00", fingerprint="t2"),
            attempt("g2", [], started="2026-09-20T00:03:00+00:00", fingerprint="t3"),
            # A terminated row has no outcome and never counts as the red side.
            {**attempt("t", [], started="2026-09-20T00:04:00+00:00", fingerprint="t4"), "outcome": None},
            attempt("g3", [], started="2026-09-20T00:05:00+00:00", fingerprint="t4"),
            attempt("n", [], started="2026-09-20T00:06:00+00:00"),
        ]
        result = economics.fingerprint_repeat_metrics(attempts)
        self.assertEqual(result["classification"], "measured")
        self.assertEqual(result["attemptsWithFingerprint"], 6)
        self.assertEqual(result["failedUnchangedFingerprintThenGreen"], 1)
        self.assertEqual(result["byActionableLane"], [{"attempts": 1, "lane": "quality:lint"}])
        self.assertEqual(
            economics.fingerprint_repeat_metrics([attempt("x", [])])["classification"],
            "unmeasurable",
        )

    def test_termination_metrics_count_unfinished_starts_and_reasons(self) -> None:
        """M5 counts unfinished starts, journaled reasons and the P0-comparable total."""
        finished = attempt("done", [])
        terminated = {**attempt("dead", []), "outcome": None, "terminationReason": "owner-dead"}
        starts = {
            ("fixture", "run", "done"): None,
            ("fixture", "run", "dead"): None,
            ("fixture", "run", "lost"): None,
        }
        result = economics.termination_metrics([finished, terminated], starts)
        self.assertEqual(result["starts"], 3)
        self.assertEqual(result["startsWithoutFinish"], 1)
        self.assertEqual(result["startsWithoutFinishPct"], 33.33)
        self.assertEqual(result["journaledTerminations"], 1)
        self.assertEqual(result["reasonMix"], [{"attempts": 1, "reason": "owner-dead"}])
        self.assertEqual(result["sweepStampedTerminations"], 1)
        self.assertEqual(result["startsWithoutAttemptWrittenTerminal"], 2)


class PublicHygieneTest(unittest.TestCase):
    def test_non_utf8_evidence_has_a_clear_hygiene_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            for suffix in (".json", ".json.gz"):
                with self.subTest(suffix=suffix):
                    file = Path(directory) / ("journal" + suffix)
                    payload = b"invalid: \xff"
                    file.write_bytes(gzip.compress(payload) if suffix.endswith(".gz") else payload)
                    with self.assertRaisesRegex(SystemExit, "invalid UTF-8 evidence in .*journal"):
                        economics.validate_public_hygiene([file])

    def test_branch_names_survive_validation_and_redaction(self) -> None:
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(Path, "home", return_value=Path("/root")):
            branch = "fix/root-build-failure-20260724"
            for suffix in (".json", ".json.gz"):
                file = Path(directory) / ("journal" + suffix)
                payload = json.dumps({"branch": branch}).encode()
                file.write_bytes(gzip.compress(payload) if suffix.endswith(".gz") else payload)
                economics.validate_public_hygiene([file])
            self.assertEqual(economics.redact(branch), branch)

    def test_absolute_home_paths_are_still_rejected_and_redacted(self) -> None:
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(Path, "home", return_value=Path("/root")):
            file = Path(directory) / "journal.json"
            for value in ("/root", "/root/private", "stored at /root/private", "(/root/private)"):
                with self.subTest(value=value):
                    file.write_text(json.dumps({"path": value}))
                    with self.assertRaises(SystemExit):
                        economics.validate_public_hygiene([file])
                    self.assertNotIn("/root", economics.redact(value))

    def test_file_urls_are_rejected_and_redacted_without_changing_branch_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(Path, "home", return_value=Path("/root")):
            for value in (
                "file:///root/private.ts",
                "file://localhost/root/private.ts",
                "FILE:///root/private.ts",
                "file:///root?source=local",
                "file:///root#file",
                "file://localhost/root?source=local#file",
                "/root?source=local",
                "/root#file",
            ):
                for suffix in (".json", ".json.gz"):
                    with self.subTest(value=value, suffix=suffix):
                        file = Path(directory) / ("journal" + suffix)
                        payload = json.dumps({"path": value}).encode()
                        file.write_bytes(gzip.compress(payload) if suffix.endswith(".gz") else payload)
                        with self.assertRaises(SystemExit):
                            economics.validate_public_hygiene([file])
                        self.assertNotIn("/root", economics.redact(value))
            self.assertEqual(economics.redact("fix/root-build-failure"), "fix/root-build-failure")


if __name__ == "__main__":
    unittest.main()
