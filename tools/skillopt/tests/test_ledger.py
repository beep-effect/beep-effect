"""The ledger recorder, against a fake CLI. No real ledger row is ever written."""

from __future__ import annotations

import contextlib
import io
import json
import shlex
import stat
import sys
import tempfile
import unittest
from pathlib import Path

from beep_skillopt import ledger

DIGEST = {n: f"{n:064x}" for n in range(1, 5)}
FAKE_CLI = """#!{python}
import json, sys, pathlib
log = pathlib.Path({log!r})
calls = log.read_text().splitlines() if log.exists() else []
calls.append(json.dumps(sys.argv[1:]))
log.write_text("\\n".join(calls) + "\\n")
print("$ bun run fake harness-ledger", file=sys.stderr)
print(json.dumps({{"rowId": "hl-20260929-%08x" % len(calls), "disposition": "proposed"}}, indent=2))
"""


def _steps() -> list[dict]:
    base = {"epoch": 1, "edit_budget": 4, "edits_applied": 2, "gate_metric": "soft", "skill_chars_before": 6229}
    return [
        {**base, "step": 1, "screen_verdict": "reject", "screen_codes": ["evaluation-environment-fitting"],
         "screen_rules": ["fixture", "tsconfig"], "gate_verdict": "not-evaluated", "prev_current": 0.5,
         "prev_best": 0.5, "skill_chars_after": 7613, "diff_digest": DIGEST[1]},
        {**base, "step": 2, "screen_verdict": "pass", "screen_codes": [], "screen_rules": [], "gate_verdict": "reject",
         "candidate_gate_score": 0.42, "selection_soft": 0.42, "prev_current": 0.5, "prev_best": 0.5,
         "skill_chars_after": 6400, "diff_digest": DIGEST[2]},
        {**base, "step": 3, "screen_verdict": "pass", "screen_codes": [], "screen_rules": [], "gate_verdict": "accept",
         "candidate_gate_score": 0.61, "selection_soft": 0.61, "prev_current": 0.5, "prev_best": 0.5,
         "skill_chars_after": 6500, "diff_digest": DIGEST[3]},
        {**base, "step": 4, "action": "skip_no_patches", "screen_verdict": "not-screened", "gate_verdict": "not-evaluated",
         "diff_digest": None},
    ]


class RecorderTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.out_root = self.root / "out"
        self.out_root.mkdir()
        with (self.out_root / "steps.jsonl").open("w") as handle:
            for row in _steps():
                handle.write(json.dumps(row) + "\n")
        (self.out_root / "config.json").write_text(json.dumps({
            "target_model": "claude-opus-5-5",
            "target_backend": "claude_code_exec",
            "claude_code_exec_effort": "medium",
            "skill_init": ".claude/skills/schema-first-development/SKILL.md",
        }))
        self.log = self.root / "calls.log"
        self.cli = self.root / "fake-ledger"
        self.cli.write_text(FAKE_CLI.format(python=sys.executable, log=str(self.log)))
        self.cli.chmod(self.cli.stat().st_mode | stat.S_IXUSR)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self, *args: str) -> tuple[int, str]:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = ledger.main(["--out-root", str(self.out_root), "--cli", str(self.cli), *args])
        return code, buf.getvalue()

    def _calls(self) -> list[list[str]]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines() if line]

    def test_dry_run_is_default_and_runs_nothing(self) -> None:
        code, out = self._run()
        self.assertEqual(code, 0)
        self.assertEqual(self._calls(), [])
        self.assertFalse((self.out_root / ledger.MARKER_FILE).exists())
        commands = [shlex.split(line) for line in out.splitlines() if not line.startswith("#")]
        self.assertEqual([c[1] for c in commands], ["propose", "disposition", "propose", "disposition", "propose"])
        self.assertIn("<rowId of step 1 propose>", commands[1])

    def test_write_records_proposals_and_rejections_only(self) -> None:
        code, _out = self._run("--write")
        self.assertEqual(code, 0)
        calls = self._calls()
        self.assertEqual([c[0] for c in calls], ["propose", "disposition", "propose", "disposition", "propose"])

        propose = calls[0]
        self.assertEqual(propose[propose.index("--mechanism") + 1], "skill")
        self.assertEqual(propose[propose.index("--edit") + 1], f"diff:{DIGEST[1]}")
        self.assertEqual(propose[propose.index("--model") + 1], "claude-opus-5-5")
        self.assertEqual(propose[propose.index("--reasoning-effort") + 1], "medium")
        self.assertEqual(propose[propose.index("--expected-surface") + 1], "skill")

        screen_reject = calls[1]
        self.assertEqual(screen_reject[screen_reject.index("--row") + 1], "hl-20260929-00000001")
        self.assertEqual(screen_reject[screen_reject.index("--to") + 1], "rejected")
        self.assertTrue(screen_reject[screen_reject.index("--evidence") + 1].startswith(
            "pre-evaluation screen: evaluation-environment-fitting"))
        self.assertNotIn("--score", screen_reject)

        gate_reject = calls[3]
        evidence = gate_reject[gate_reject.index("--evidence") + 1]
        self.assertTrue(evidence.startswith("loop gate: soft 0.4200 <= current 0.5000"), evidence)
        self.assertEqual(gate_reject[gate_reject.index("--score") + 1], "-0.0800")
        self.assertEqual(gate_reject[gate_reject.index("--cost") + 1], "171")

        for call in calls:
            if "--to" in call:
                self.assertNotEqual(call[call.index("--to") + 1], "accepted")
            joined = " ".join(call)
            self.assertNotIn(str(self.root), joined)
            self.assertNotIn(".claude/skills", joined)

        marker = json.loads((self.out_root / ledger.MARKER_FILE).read_text())
        self.assertEqual(sorted(marker), ["1", "2", "3"])
        self.assertIsNone(marker["3"]["disposition"])  # gate-accepted stays proposed

    def test_write_is_idempotent(self) -> None:
        self.assertEqual(self._run("--write")[0], 0)
        first = len(self._calls())
        code, out = self._run("--write")
        self.assertEqual(code, 0)
        self.assertEqual(len(self._calls()), first)
        self.assertEqual(out.count("already recorded"), 3)

    def test_resumes_a_half_recorded_step(self) -> None:
        marker = {"1": {"digest": DIGEST[1], "propose": "hl-20260929-aaaaaaaa", "disposition": None}}
        (self.out_root / ledger.MARKER_FILE).write_text(json.dumps(marker))
        self.assertEqual(self._run("--write")[0], 0)
        calls = self._calls()
        self.assertEqual(calls[0][0], "disposition")
        self.assertEqual(calls[0][calls[0].index("--row") + 1], "hl-20260929-aaaaaaaa")

    def test_injectable_runner_and_failure_stops(self) -> None:
        seen: list[list[str]] = []

        def runner(argv, _cwd):
            seen.append(list(argv))
            return ledger.RunResult(1, "", "HarnessLedgerBusyError")

        code = ledger.record(self.out_root, write=True, cli=["fake"], runner=runner, echo=lambda _line: None)
        self.assertEqual(code, 1)
        self.assertEqual(len(seen), 1)
        self.assertFalse((self.out_root / ledger.MARKER_FILE).exists())

    def test_parse_row_id_tolerates_noise(self) -> None:
        self.assertEqual(ledger.parse_row_id('$ bun run x\n{\n  "rowId": "hl-20260929-0000beef"\n}\n'), "hl-20260929-0000beef")


if __name__ == "__main__":
    unittest.main()
