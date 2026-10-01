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
from unittest import mock

from beep_skillopt import ledger

DIGEST = {n: f"{n:064x}" for n in range(1, 5)}
SKILL = "schema-first-development"
# A stand-in for the ledger CLI that keeps its own rows in a JSON store: propose
# and disposition append (disposition refuses a superseded row, as the real CLI
# does), and `list --json` folds every chain to its latest row.
FAKE_CLI = """#!{python}
import json, sys, pathlib
log = pathlib.Path({log!r})
store = pathlib.Path({store!r})
argv = sys.argv[1:]
calls = log.read_text().splitlines() if log.exists() else []
calls.append(json.dumps(argv))
log.write_text("\\n".join(calls) + "\\n")
rows = json.loads(store.read_text()) if store.exists() else []
print("$ bun run fake harness-ledger", file=sys.stderr)

def flag(name):
    return argv[argv.index(name) + 1]

if argv[0] == "list":
    previous = {{row.get("previousRowId") for row in rows}}
    by_id = {{row["rowId"]: row for row in rows}}
    entries = []
    for row in rows:
        if row["rowId"] in previous:
            continue
        length, cursor = 1, row
        while cursor.get("previousRowId") in by_id:
            length, cursor = length + 1, by_id[cursor["previousRowId"]]
        entries.append({{"row": row, "stale": False, "chainLength": length}})
    print("[INFO] not json")
    print(json.dumps(entries))
    sys.exit(0)
row_id = "hl-20260929-%08x" % (len(rows) + 1)
if argv[0] == "propose":
    row = {{"rowId": row_id, "edit": {{"kind": "diff-digest", "ref": flag("--edit").split(":", 1)[1]}},
           "hypothesis": {{"claim": flag("--hypothesis")}}, "mechanismClass": flag("--mechanism"),
           "disposition": "proposed"}}
else:
    target = flag("--row")
    previous = [row for row in rows if row["rowId"] == target]
    if not previous or any(row.get("previousRowId") == target for row in rows):
        print("HarnessLedgerChainError: " + target + " is not the latest row of its chain", file=sys.stderr)
        sys.exit(1)
    row = {{**previous[0], "rowId": row_id, "disposition": flag("--to"), "previousRowId": target}}
rows.append(row)
store.write_text(json.dumps(rows))
print(json.dumps({{"rowId": row_id, "disposition": row["disposition"]}}, indent=2))
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


def _claim(step: int) -> str:
    return ledger.hypothesis_for(_steps()[step - 1], SKILL)


class Interrupted(Exception):
    """Stands in for a crash between a successful CLI call and the marker save."""


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
            "skill_init": f".claude/skills/{SKILL}/SKILL.md",
        }))
        self.log = self.root / "calls.log"
        self.store = self.root / "ledger-rows.json"
        self.cli = self.root / "fake-ledger"
        self.cli.write_text(FAKE_CLI.format(python=sys.executable, log=str(self.log), store=str(self.store)))
        self.cli.chmod(self.cli.stat().st_mode | stat.S_IXUSR)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _run(self, *args: str) -> tuple[int, str]:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = ledger.main(["--out-root", str(self.out_root), "--cli", str(self.cli), *args])
        return code, buf.getvalue()

    def _calls(self, *, reads: bool = False) -> list[list[str]]:
        if not self.log.exists():
            return []
        calls = [json.loads(line) for line in self.log.read_text().splitlines() if line]
        return calls if reads else [call for call in calls if call[0] != "list"]

    def _rows(self) -> list[dict]:
        return json.loads(self.store.read_text()) if self.store.exists() else []

    def _seed(self, rows: list[dict]) -> None:
        self.store.write_text(json.dumps(rows))

    def _marker(self) -> dict:
        return json.loads((self.out_root / ledger.MARKER_FILE).read_text())

    def _interrupt_on_save(self, nth: int):
        """Patch the marker save so the ``nth`` save dies after its CLI call succeeded."""
        real = ledger.save_marker
        seen = {"n": 0}

        def save(out_root, marker):
            seen["n"] += 1
            if seen["n"] == nth:
                raise Interrupted
            real(out_root, marker)

        return mock.patch.object(ledger, "save_marker", save)

    def test_dry_run_is_default_and_runs_nothing(self) -> None:
        code, out = self._run()
        self.assertEqual(code, 0)
        self.assertEqual(self._calls(reads=True), [])
        self.assertFalse((self.out_root / ledger.MARKER_FILE).exists())
        commands = [shlex.split(line) for line in out.splitlines() if not line.startswith("#")]
        self.assertEqual([c[1] for c in commands], ["propose", "disposition", "propose", "disposition", "propose"])
        self.assertIn("<rowId of step 1 propose>", commands[1])

    def test_write_records_proposals_and_rejections_only(self) -> None:
        code, _out = self._run("--write")
        self.assertEqual(code, 0)
        self.assertEqual(self._calls(reads=True)[0], ["list", "--json"])
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
        self.assertEqual(gate_reject[gate_reject.index("--score") + 1], "-0.080000")
        self.assertEqual(gate_reject[gate_reject.index("--cost") + 1], "171")

        for call in calls:
            if "--to" in call:
                self.assertNotEqual(call[call.index("--to") + 1], "accepted")
            joined = " ".join(call)
            self.assertNotIn(str(self.root), joined)
            self.assertNotIn(".claude/skills", joined)

        marker = self._marker()
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
        self._seed([{"rowId": "hl-20260929-aaaaaaaa", "edit": {"kind": "diff-digest", "ref": DIGEST[1]},
                     "hypothesis": {"claim": _claim(1)}, "mechanismClass": "skill", "disposition": "proposed"}])
        marker = {"1": {"digest": DIGEST[1], "propose": "hl-20260929-aaaaaaaa", "disposition": None}}
        (self.out_root / ledger.MARKER_FILE).write_text(json.dumps(marker))
        self.assertEqual(self._run("--write")[0], 0)
        calls = self._calls()
        self.assertEqual(calls[0][0], "disposition")
        self.assertEqual(calls[0][calls[0].index("--row") + 1], "hl-20260929-aaaaaaaa")

    def test_marker_alone_still_resumes_when_the_ledger_has_no_matching_chain(self) -> None:
        # A row written by an older recorder whose hypothesis text differs: the marker decides.
        self._seed([{"rowId": "hl-20260929-aaaaaaaa", "edit": {"kind": "diff-digest", "ref": DIGEST[1]},
                     "hypothesis": {"claim": "older wording"}, "mechanismClass": "skill", "disposition": "proposed"}])
        marker = {"1": {"digest": DIGEST[1], "propose": "hl-20260929-aaaaaaaa", "disposition": None}}
        (self.out_root / ledger.MARKER_FILE).write_text(json.dumps(marker))
        self.assertEqual(self._run("--write")[0], 0)
        first = self._calls()[0]
        self.assertEqual(first[first.index("--row") + 1], "hl-20260929-aaaaaaaa")

    def test_retry_after_an_unsaved_proposal_does_not_propose_again(self) -> None:
        # Greptile P1: the CLI appended step 1's proposal, then the marker save died.
        with self._interrupt_on_save(1), self.assertRaises(Interrupted):
            self._run("--write")
        self.assertFalse((self.out_root / ledger.MARKER_FILE).exists())
        self.assertEqual(self._run("--write")[0], 0)
        proposals = [row for row in self._rows() if row["disposition"] == "proposed"]
        self.assertEqual(sorted(row["edit"]["ref"] for row in proposals), [DIGEST[1], DIGEST[2], DIGEST[3]])
        first_disposition = self._calls()[1]
        self.assertEqual(first_disposition[0], "disposition")
        self.assertEqual(first_disposition[first_disposition.index("--row") + 1], "hl-20260929-00000001")
        self.assertEqual(self._marker()["1"]["propose"], "hl-20260929-00000001")

    def test_retry_after_an_unsaved_disposition_does_not_disposition_again(self) -> None:
        # Same gap for the disposition: appended, then the marker save died.
        with self._interrupt_on_save(2), self.assertRaises(Interrupted):
            self._run("--write")
        self.assertIsNone(self._marker()["1"]["disposition"])
        code, out = self._run("--write")
        self.assertEqual(code, 0)
        step1 = [row for row in self._rows() if row["edit"]["ref"] == DIGEST[1]]
        self.assertEqual([row["disposition"] for row in step1], ["proposed", "rejected"])
        self.assertEqual(self._marker()["1"]["disposition"], "hl-20260929-00000002")
        self.assertIn("step 1: the ledger already records rejected", out)

    def test_lost_marker_is_rebuilt_from_the_ledger_without_writing(self) -> None:
        self.assertEqual(self._run("--write")[0], 0)
        before = self._marker()
        writes = len(self._calls())
        (self.out_root / ledger.MARKER_FILE).unlink()
        self.assertEqual(self._run("--write")[0], 0)
        self.assertEqual(len(self._calls()), writes)
        self.assertEqual(self._marker(), before)

    def test_a_human_disposition_on_the_chain_is_left_in_place(self) -> None:
        self._seed([
            {"rowId": "hl-20260929-aaaaaaaa", "edit": {"kind": "diff-digest", "ref": DIGEST[2]},
             "hypothesis": {"claim": _claim(2)}, "mechanismClass": "skill", "disposition": "proposed"},
            {"rowId": "hl-20260929-bbbbbbbb", "edit": {"kind": "diff-digest", "ref": DIGEST[2]},
             "hypothesis": {"claim": _claim(2)}, "mechanismClass": "skill", "disposition": "deferred",
             "previousRowId": "hl-20260929-aaaaaaaa"},
        ])
        code, out = self._run("--write")
        self.assertEqual(code, 0)
        self.assertIn("step 2: the chain's latest row hl-20260929-bbbbbbbb is deferred", out)
        step2 = [row for row in self._rows() if row["edit"]["ref"] == DIGEST[2]]
        self.assertEqual([row["disposition"] for row in step2], ["proposed", "deferred"])

    def test_duplicate_chains_are_resolved_by_the_marker_or_refused(self) -> None:
        duplicate = [
            {"rowId": f"hl-20260929-{suffix}", "edit": {"kind": "diff-digest", "ref": DIGEST[2]},
             "hypothesis": {"claim": _claim(2)}, "mechanismClass": "skill", "disposition": "proposed"}
            for suffix in ("aaaaaaaa", "bbbbbbbb")
        ]
        self._seed(duplicate)
        code, out = self._run("--write")
        self.assertEqual(code, 1)
        self.assertIn("step 2: 2 ledger chains already carry this proposal", out)

        marker = self._marker()
        marker["2"] = {"digest": DIGEST[2], "propose": "hl-20260929-cccccccc", "disposition": None}
        (self.out_root / ledger.MARKER_FILE).write_text(json.dumps(marker))
        self.assertEqual(self._run("--write")[0], 1)  # the marker links to neither chain

        marker["2"] = {"digest": DIGEST[2], "propose": "hl-20260929-bbbbbbbb", "disposition": None}
        (self.out_root / ledger.MARKER_FILE).write_text(json.dumps(marker))
        self.assertEqual(self._run("--write")[0], 0)
        dispositions = [call for call in self._calls() if call[0] == "disposition"]
        rows = [call[call.index("--row") + 1] for call in dispositions]
        self.assertIn("hl-20260929-bbbbbbbb", rows)
        self.assertNotIn("hl-20260929-aaaaaaaa", rows)

    def test_unreadable_ledger_stops_before_any_write(self) -> None:
        outputs = [ledger.RunResult(1, "", "HarnessLedgerIoError"), ledger.RunResult(0, "no json here", "")]
        for listing in outputs:
            seen: list[list[str]] = []

            def runner(argv, _cwd, listing=listing):
                seen.append(list(argv))
                return listing

            lines: list[str] = []
            code = ledger.record(self.out_root, write=True, cli=["fake"], runner=runner, echo=lines.append)
            self.assertEqual(code, 1)
            self.assertEqual(seen, [["fake", "list", "--json"]])
            self.assertTrue(any("ledger list" in line for line in lines), lines)

    def test_injectable_runner_and_failure_stops(self) -> None:
        seen: list[list[str]] = []

        def runner(argv, _cwd):
            seen.append(list(argv))
            if argv[1] == "list":
                return ledger.RunResult(0, "[]", "")
            return ledger.RunResult(1, "", "HarnessLedgerBusyError")

        code = ledger.record(self.out_root, write=True, cli=["fake"], runner=runner, echo=lambda _line: None)
        self.assertEqual(code, 1)
        self.assertEqual([argv[1] for argv in seen], ["list", "propose"])
        self.assertFalse((self.out_root / ledger.MARKER_FILE).exists())

    def test_parse_row_id_tolerates_noise(self) -> None:
        self.assertEqual(ledger.parse_row_id('$ bun run x\n{\n  "rowId": "hl-20260929-0000beef"\n}\n'), "hl-20260929-0000beef")

    def test_parse_ledger_list_tolerates_noise_and_skips_other_rows(self) -> None:
        stdout = '$ bun run x\n[INFO] start\n[1, 2]\n' + json.dumps([
            "not an entry",
            {"row": "not a row"},
            {"row": {"rowId": "a", "edit": {"kind": "pending"}, "mechanismClass": "skill"}},
            {"row": {"rowId": "b", "edit": {"kind": "diff-digest", "ref": "x"}, "mechanismClass": "config",
                     "hypothesis": {"claim": "c"}}},
            {"row": {"rowId": "c", "edit": {"kind": "diff-digest", "ref": "x"}, "mechanismClass": "skill",
                     "hypothesis": {"claim": "c"}, "disposition": "proposed"}, "chainLength": 1},
        ])
        chains = ledger.index_chains(ledger.parse_ledger_list(stdout))
        self.assertEqual(list(chains), [("x", "c")])
        self.assertEqual([row["rowId"] for row in chains[("x", "c")]], ["c"])
        with self.assertRaises(ValueError):
            ledger.parse_ledger_list("[INFO] nothing")


def _write_run(out_root: Path, history: list[dict], screens: list[dict], noise_items: list[list[float]]) -> None:
    """A synthetic out_root shaped like the 2026-09-29 rerun (numbers only, no skill text)."""
    out_root.mkdir(parents=True, exist_ok=True)
    (out_root / "config.json").write_text(json.dumps({"gate_metric": "soft", "target_model": "claude-opus-5-5",
                                                      "target_backend": "claude_code_exec",
                                                      "claude_code_exec_effort": "medium"}))
    (out_root / "history.json").write_text(json.dumps(history))
    (out_root / "screen-log.jsonl").write_text("".join(json.dumps(row) + "\n" for row in screens))
    base = out_root / "selection_eval_baseline"
    base.mkdir()
    # Per-item soft scores rounded to six decimals, as the scorer writes them.
    items = [("t-a", 1.0, 1.0), ("t-b", 0.833333, 0.0), ("t-c", 1.0, 1.0), ("t-d", 0.833333, 0.0)]
    (base / "results.jsonl").write_text("".join(json.dumps({"id": i, "soft": s, "hard": h}) + "\n" for i, s, h in items))
    runs = [
        {"run": n + 1, "soft": round(sum(softs) / len(softs), 6), "hard": 0.5,
         "per_task": [{"task_id": f"t-{i}", "soft": value, "hard": 1.0 if value == 1.0 else 0.0}
                      for i, value in enumerate(softs)]}
        for n, softs in enumerate(noise_items)
    ]
    (out_root / "baseline-noise.json").write_text(json.dumps({"runs": runs}))
    skills = out_root / "skills"
    skills.mkdir()
    for rec in history:
        step = rec["step"]
        (skills / f"skill_v{step - 1:04d}.md").write_text(f"skill before step {step}\n")
        step_dir = out_root / "steps" / f"step_{step:04d}"
        step_dir.mkdir(parents=True)
        (step_dir / "candidate_skill.md").write_text(f"candidate {rec['candidate_hash']}\n")


def _rec(step: int, action: str, soft: float, current: float, cand_hash: str) -> dict:
    return {"step": step, "epoch": 1, "action": action, "candidate_hash": cand_hash, "selection_soft": soft,
            "selection_hard": 0.0, "candidate_gate_score": soft, "gate_metric": "soft", "current_score": current,
            "best_score": current, "edit_budget": 4, "edit_apply_summary": {"applied": 2}}


class ExportTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.out_root = Path(self._tmp.name) / "out"
        base = 0.9166665
        history = [
            _rec(1, "reject", 0.0, base, "aaaa"),                    # screened out
            _rec(2, "accept_new_best", 0.91666675, 0.91666675, "bbbb"),  # tie accept by rounding
            _rec(3, "reject", 0.0, 0.91666675, "aaaa"),              # repeats step 1: cache hit
            _rec(4, "reject", 0.875, 0.91666675, "cccc"),            # evaluated, within noise
            _rec(5, "reject", 0.5, 0.91666675, "dddd"),              # evaluated, outside noise
            _rec(6, "accept_new_best", 1.0, 1.0, "eeee"),             # gain equal to the spread
        ]
        screens = [
            {"step": 1, "verdict": "reject", "codes": ["evaluation-environment-fitting"], "reasons": [{"rule": "fixture"}]},
            {"step": 2, "verdict": "pass", "codes": [], "reasons": []},
            {"step": 4, "verdict": "pass", "codes": [], "reasons": []},
            {"step": 5, "verdict": "pass", "codes": [], "reasons": []},
            {"step": 6, "verdict": "pass", "codes": [], "reasons": []},
        ]
        # Per-run item scores like the rerun's noise band: means 0.95833325, 0.95833325, 0.875.
        noise = [[1.0, 0.833333, 1.0, 1.0], [1.0, 1.0, 0.833333, 1.0], [1.0, 0.833333, 0.666667, 1.0]]
        _write_run(self.out_root, history, screens, noise)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_previous_best_is_the_incumbent_at_full_precision(self) -> None:
        from beep_skillopt.export import build_steps

        rows = {row["step"]: row for row in build_steps(self.out_root)}
        self.assertAlmostEqual(rows[1]["previous_best"], 0.9166665, places=12)
        self.assertAlmostEqual(rows[2]["previous_best"], 0.9166665, places=12)  # the loop baseline, unrounded
        self.assertEqual(rows[2]["selection_soft"], 0.91666675)
        self.assertAlmostEqual(rows[2]["gate_delta"], 2.5e-7, places=12)
        self.assertTrue(rows[2]["within_baseline_noise"])
        # Unrounded from per-task scores (the rounded run means would give 0.083333).
        self.assertAlmostEqual(rows[2]["baseline_noise_spread"], 0.08333325, places=12)
        self.assertEqual(rows[4]["previous_best"], 0.91666675)  # the running current score
        self.assertTrue(rows[4]["within_baseline_noise"])
        self.assertFalse(rows[5]["within_baseline_noise"])
        # A gain equal to the spread up to float error counts as within noise.
        self.assertAlmostEqual(rows[6]["gate_delta"], 0.08333325, places=12)
        self.assertTrue(rows[6]["within_baseline_noise"])
        self.assertIsNone(rows[1]["within_baseline_noise"])  # not evaluated

    def test_repeat_of_a_screened_candidate_is_not_a_measurement(self) -> None:
        # Review F5: the trainer's cache hit recorded (0, 0) with no rollout.
        from beep_skillopt.export import build_steps

        rows = {row["step"]: row for row in build_steps(self.out_root)}
        self.assertEqual(rows[1]["not_evaluated_reason"], "screen-rejected")
        row = rows[3]
        self.assertEqual(row["gate_verdict"], "not-evaluated")
        self.assertEqual(row["not_evaluated_reason"], "screen-cache-hit")
        self.assertEqual(row["repeats_step"], 1)
        self.assertEqual(row["screen_verdict"], "cached-reject")
        for key in ("selection_soft", "selection_hard", "candidate_gate_score", "gate_delta", "within_baseline_noise"):
            self.assertIsNone(row[key], key)
        self.assertEqual(rows[4]["gate_verdict"], "reject")
        self.assertIsNone(rows[4]["not_evaluated_reason"])

    def test_cache_hit_is_found_from_candidate_text_when_history_lacks_the_hash(self) -> None:
        from beep_skillopt.export import build_steps

        history = json.loads((self.out_root / "history.json").read_text())
        for rec in history:
            del rec["candidate_hash"]
        (self.out_root / "history.json").write_text(json.dumps(history))
        rows = {row["step"]: row for row in build_steps(self.out_root)}
        self.assertEqual(rows[3]["not_evaluated_reason"], "screen-cache-hit")
        self.assertEqual(rows[4]["gate_verdict"], "reject")

    def test_recorder_text_for_cache_hits_ties_and_noise(self) -> None:
        from beep_skillopt.export import export_steps

        export_steps(self.out_root)
        lines: list[str] = []
        self.assertEqual(ledger.record(self.out_root, cli=["fake"], echo=lines.append), 0)
        commands = [shlex.split(line) for line in lines if not line.startswith("#")]
        by_row = {}
        for argv in commands:
            if argv[1] == "disposition":
                by_row[argv[argv.index("--row") + 1]] = argv
        cached = by_row["<rowId of step 3 propose>"]
        evidence = cached[cached.index("--evidence") + 1]
        self.assertIn("repeats the candidate screened out at step 1", evidence)
        self.assertNotIn("--score", cached)
        self.assertNotIn("--cost", cached)
        within = by_row["<rowId of step 4 propose>"]
        self.assertIn("within the measured baseline noise spread 0.0833333", within[within.index("--evidence") + 1])
        self.assertEqual(within[within.index("--score") + 1], "-0.041667")
        outside = by_row["<rowId of step 5 propose>"]
        self.assertIn("outside the measured baseline noise", outside[outside.index("--evidence") + 1])
        accepted = [argv for argv in commands if argv[1] == "propose" and "step 2 " in argv[argv.index("--hypothesis") + 1]]
        hypothesis = accepted[0][accepted[0].index("--hypothesis") + 1]
        self.assertIn("accepted it at 0.91666675 over incumbent 0.9166665", hypothesis)
        self.assertIn("within the measured baseline noise", hypothesis)
        self.assertEqual(len(by_row), 4)  # steps 1, 3, 4, 5 rejected; steps 2 and 6 stay proposed


if __name__ == "__main__":
    unittest.main()
