"""The adapter keeps scorer environment failures apart from candidate failures."""

from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _support import FIXTURE_SPLITS, repo_root

from beep_skillopt.adapter import (
    BeepLawAdapter,
    _is_scorer_environment_failure,
    _raise_on_systemic_failure,
    _run_batch,
    _score_failure_reason,
    _scorer_environment_failure,
)

ENVIRONMENT_REPORT = {
    "status": "environment-failure",
    "score": 0.4,
    "lanes": [
        {"lane": "schema-first", "status": "measured"},
        {"lane": "biome", "status": "environment-failure"},
        {"lane": "tsgo", "status": "environment-failure"},
    ],
    "violations": [],
}


class ScorerEnvironmentFailureTest(unittest.TestCase):
    def test_environment_report_is_kept_and_scored_zero(self) -> None:
        report = _scorer_environment_failure(json.dumps(ENVIRONMENT_REPORT))
        self.assertIsNotNone(report)
        assert report is not None
        self.assertEqual(report["score"], 0.0)
        self.assertEqual(report["status"], "environment-failure")
        self.assertEqual(
            _score_failure_reason(report),
            "scorer environment failure: biome, tsgo",
        )

    def test_other_failures_are_not_environment_reports(self) -> None:
        self.assertIsNone(_scorer_environment_failure(""))
        self.assertIsNone(_scorer_environment_failure("not json"))
        self.assertIsNone(_scorer_environment_failure("[1, 2]"))
        self.assertIsNone(_scorer_environment_failure(json.dumps({"status": "scored", "score": 1})))

    def test_reason_without_a_named_lane(self) -> None:
        self.assertEqual(
            _score_failure_reason({"status": "environment-failure", "score": 0.0}),
            "scorer environment failure: unknown lane",
        )

    def test_a_batch_of_environment_failures_stops_the_run(self) -> None:
        row = {"id": "a", "agent_ok": True, "scorer": ENVIRONMENT_REPORT}
        self.assertTrue(_is_scorer_environment_failure(row))
        with self.assertRaisesRegex(RuntimeError, "could not measure 2 of 2 items"):
            _raise_on_systemic_failure([row, {**row, "id": "b"}])

    def test_one_environment_failure_stops_the_run(self) -> None:
        # Greptile P1: a partial measurement must never reach the gate as a 0.
        measured = {"id": "measured", "agent_ok": True, "scorer": {"status": "scored", "score": 0.5}}
        environment = {"id": "broken-tool", "agent_ok": True, "scorer": ENVIRONMENT_REPORT}
        self.assertFalse(_is_scorer_environment_failure(measured))
        self.assertFalse(_is_scorer_environment_failure({"agent_ok": True}))
        with self.assertRaisesRegex(RuntimeError, r"could not measure 1 of 2 items \(broken-tool\)"):
            _raise_on_systemic_failure([measured, environment])

    def test_agent_failures_without_environment_failures_still_score(self) -> None:
        violations = {"status": "scored", "score": 0.2, "violations": [{"message": "law"}]}
        rows = [
            {"id": "a", "agent_ok": True, "soft": 0.2, "scorer": violations},
            {"id": "b", "agent_ok": False, "fail_reason": "target execution error"},
        ]
        _raise_on_systemic_failure(rows)


def _stub_adapter() -> BeepLawAdapter:
    root = repo_root()
    split_dir = root / FIXTURE_SPLITS
    adapter = BeepLawAdapter(
        split_dir=str(split_dir),
        split_mode="split_dir",
        repo_root=str(root),
        stub_scorer=True,
        skip_exec=True,
        workers=1,
    )
    with contextlib.redirect_stdout(io.StringIO()):
        adapter.setup({"split_mode": "split_dir", "split_dir": str(split_dir), "repo_root": str(root)})
    return adapter


class RunBatchEnvironmentFailureTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.out = Path(self._tmp.name) / "selection_eval"
        self.adapter = _stub_adapter()
        with contextlib.redirect_stdout(io.StringIO()):
            item = self.adapter.build_train_env(batch_size=1, seed=7)[0]
        self.items = [{**item, "id": "task-a"}, {**item, "id": "task-b"}]

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self) -> list[dict]:
        with contextlib.redirect_stdout(io.StringIO()):
            return _run_batch(
                adapter=self.adapter,
                items=self.items,
                out_root=str(self.out),
                skill_content="Prefer deterministic code edits.",
                workers=1,
                task_timeout=60,
                skip_exec=True,
            )

    def test_partial_environment_failure_stops_the_batch_and_is_remeasured_on_resume(self) -> None:
        real = self.adapter.score_stub

        def broken_for_b(scratch_dir, manifest):
            if Path(scratch_dir).parent.name == "task-b":
                return dict(ENVIRONMENT_REPORT, score=0.0)
            return real(scratch_dir, manifest)

        with mock.patch.object(self.adapter, "score_stub", broken_for_b):
            with self.assertRaisesRegex(RuntimeError, r"could not measure 1 of 2 items \(task-b\)"):
                self._run()

        # The environment-failed row is not a measurement: a resume after the
        # tool is fixed re-measures it and keeps the measured row.
        results = self._run()
        self.assertEqual(sorted(row["id"] for row in results), ["task-a", "task-b"])
        self.assertFalse(any(_is_scorer_environment_failure(row) for row in results))
        self.assertTrue(all(row["soft"] == 1.0 for row in results))

    def test_resume_with_a_cached_environment_failure_and_nothing_pending_remeasures(self) -> None:
        self.out.mkdir(parents=True)
        cached = {"id": "task-b", "agent_ok": True, "soft": 0.0, "scorer": ENVIRONMENT_REPORT}
        measured = {"id": "task-a", "agent_ok": True, "soft": 1.0, "hard": 1.0, "scorer": {"score": 1.0}}
        with (self.out / "results.jsonl").open("w", encoding="utf-8") as handle:
            for row in (measured, cached):
                handle.write(json.dumps(row) + "\n")
            handle.write("not json\n[1]\n{}\n")
        results = self._run()
        self.assertEqual(sorted(row["id"] for row in results), ["task-a", "task-b"])
        self.assertFalse(any(_is_scorer_environment_failure(row) for row in results))


if __name__ == "__main__":
    unittest.main()
