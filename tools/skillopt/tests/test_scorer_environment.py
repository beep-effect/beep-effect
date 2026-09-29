"""The adapter keeps scorer environment failures apart from candidate failures."""

from __future__ import annotations

import json
import unittest

from beep_skillopt.adapter import (
    _is_scorer_environment_failure,
    _raise_on_systemic_failure,
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
        row = {"agent_ok": True, "scorer": ENVIRONMENT_REPORT}
        self.assertTrue(_is_scorer_environment_failure(row))
        with self.assertRaisesRegex(RuntimeError, "could not measure any of 2 items"):
            _raise_on_systemic_failure([row, dict(row)])

    def test_one_environment_failure_does_not_stop_the_run(self) -> None:
        measured = {"agent_ok": True, "scorer": {"status": "scored", "score": 0.5}}
        environment = {"agent_ok": True, "scorer": ENVIRONMENT_REPORT}
        self.assertFalse(_is_scorer_environment_failure(measured))
        self.assertFalse(_is_scorer_environment_failure({"agent_ok": True}))
        _raise_on_systemic_failure([measured, environment])


if __name__ == "__main__":
    unittest.main()
