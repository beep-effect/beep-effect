from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from _support import BENIGN_ADDITION, CORPUS_SPLITS, history_skill, repo_root

from beep_skillopt.screen import (
    ENV_FITTING,
    TASK_LEAKAGE,
    ScreenConfig,
    completion_identifiers,
    diff_digest,
    load_corpus_tasks,
    screen_candidate,
    unified_diff,
)


def leak_window(tasks: list, v0: str) -> list[str]:
    """Nine prompt words of the step-2 task, read at runtime (no corpus text in this file)."""
    from beep_skillopt.screen import _words

    task = next(t for t in tasks if t.task_id == "sfv4-getsomes-struct-002")
    words = _words(task.prompt)
    for start in range(len(words) - 9):
        window = words[start : start + 9]
        line = "\n- " + " ".join(window) + "\n"
        if not any(r.code == ENV_FITTING for r in screen_candidate(v0, v0 + line, tasks).reasons):
            return window
    raise AssertionError("no environment-neutral prompt window")


class ScreenTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        root = repo_root()
        cls.tasks = load_corpus_tasks(root / CORPUS_SPLITS, root)
        cls.v0 = history_skill(0)
        cls.v1 = history_skill(1)
        cls.v2 = history_skill(2)

    def test_corpus_covers_every_split(self) -> None:
        self.assertEqual(len(self.tasks), 12)
        self.assertEqual({task.split for task in self.tasks}, {"train", "val"})  # the test split is empty

    def test_step1_sandbox_repair_is_environment_fitting(self) -> None:
        verdict = screen_candidate(self.v0, self.v1, self.tasks)
        self.assertTrue(verdict.rejected)
        self.assertIn(ENV_FITTING, verdict.codes)
        rules = {reason.rule_id for reason in verdict.reasons}
        self.assertTrue({"tsconfig", "tool-config", "fixture", "scorer"} <= rules, rules)

    def test_step2_task_quote_is_task_leakage(self) -> None:
        verdict = screen_candidate(self.v1, self.v2, self.tasks)
        self.assertTrue(verdict.rejected)
        self.assertIn(TASK_LEAKAGE, verdict.codes)
        leak = [reason for reason in verdict.reasons if reason.code == TASK_LEAKAGE]
        self.assertTrue(any(reason.rule_id == "prompt-shingle-5" for reason in leak))

    def test_benign_schema_first_edit_passes(self) -> None:
        verdict = screen_candidate(self.v0, self.v0 + BENIGN_ADDITION, self.tasks)
        self.assertEqual(verdict.verdict, "pass", verdict.to_json())

    def test_unchanged_baseline_text_is_never_a_reason(self) -> None:
        # v1 is full of environment terms, but none of them are added here.
        verdict = screen_candidate(self.v1, self.v1 + BENIGN_ADDITION, self.tasks)
        self.assertEqual(verdict.verdict, "pass", verdict.to_json())

    def test_delete_only_edit_passes(self) -> None:
        self.assertEqual(screen_candidate(self.v1, self.v0, self.tasks).verdict, "pass")  # step-1 reverted
        paragraphs = self.v1.split("\n\n")
        trimmed = "\n\n".join(paragraphs[:-2])
        self.assertEqual(screen_candidate(self.v1, trimmed, self.tasks).verdict, "pass")

    def test_size_growth_is_reported_not_rejected(self) -> None:
        after = self.v0 + BENIGN_ADDITION * 5
        verdict = screen_candidate(self.v0, after, self.tasks)
        self.assertEqual(verdict.verdict, "pass")
        self.assertEqual(verdict.before_chars, len(self.v0))
        self.assertEqual(verdict.after_chars, len(after))
        self.assertGreater(verdict.growth_pct, 0)

    def test_completion_identifier_names_leak(self) -> None:
        # Inject a task's own export name at runtime; no corpus text lives in this file.
        task = next(t for t in self.tasks if t.identifiers)
        name = sorted(task.identifiers)[0]
        verdict = screen_candidate(self.v0, self.v0 + f"\n- Model `{name}` with a schema.\n", self.tasks)
        self.assertTrue(verdict.rejected)
        self.assertTrue(
            any(r.rule_id == "completion-identifier" and r.task_id == task.task_id for r in verdict.reasons)
        )

    def test_library_vocabulary_is_not_a_task_identifier(self) -> None:
        ids = completion_identifiers(
            {"requiredExports": ["Widget"], "requiredPatterns": ["S\\.Class\\b", "import\\s+\\{\\s*O\\s*\\}\\s+from\\s+\"@beep/utils\"", "O\\.getSomesStruct\\s*\\("]}
        )
        self.assertEqual(ids, frozenset({"Widget"}))

    def test_baseline_skill_has_no_leak_hits(self) -> None:
        self.assertEqual(screen_candidate("", self.v0, self.tasks).codes, [])

    def test_verdict_carries_no_text(self) -> None:
        from beep_skillopt.screen import added_segments

        payload = str(screen_candidate(self.v1, self.v2, self.tasks).to_json())
        for segment in added_segments(self.v1, self.v2):
            self.assertNotIn(segment[:40], payload)
        for task in self.tasks:
            self.assertNotIn(task.prompt[:40], payload)

    def test_digest_is_sha256_of_unified_diff(self) -> None:
        expected = hashlib.sha256(unified_diff(self.v0, self.v1).encode("utf-8")).hexdigest()
        self.assertEqual(diff_digest(self.v0, self.v1), expected)
        self.assertEqual(screen_candidate(self.v0, self.v1, self.tasks).diff_digest, expected)

    def test_reworded_line_quoting_a_task_is_leakage(self) -> None:
        # Review F7: the old line shares every other word with the quote, so
        # per-segment shingles saw only one-word pieces and the quote passed.
        window = leak_window(self.tasks, self.v0)
        old_line = " ".join(word if index % 2 == 0 else f"qq{index}" for index, word in enumerate(window))
        before = self.v0 + "\n- " + old_line + "\n"
        after = self.v0 + "\n- " + " ".join(window) + "\n"
        verdict = screen_candidate(before, after, self.tasks)
        self.assertTrue(verdict.rejected, verdict.to_json())
        self.assertTrue(
            any(r.rule_id == "prompt-shingle-5" and r.task_id == "sfv4-getsomes-struct-002" for r in verdict.reasons)
        )

    def test_reworded_line_adding_an_environment_term_is_fitting(self) -> None:
        # A multi-word rule whose other words were already on the line.
        cases = [
            ("- Run biome on the files you touch.", "- Run biome check on the files you touch.", "tool-config"),
            ("- Keep the gate strict.", "- Keep the loop gate strict.", "score-gate"),
        ]
        for old_line, new_line, rule in cases:
            verdict = screen_candidate(self.v0 + "\n" + old_line + "\n", self.v0 + "\n" + new_line + "\n", self.tasks)
            self.assertEqual([r.rule_id for r in verdict.reasons], [rule], (old_line, verdict.to_json()))

    def test_unchanged_environment_term_next_to_an_edit_is_not_a_reason(self) -> None:
        before = self.v0 + "\n- Run biome check on the files you touch.\n"
        after = self.v0 + "\n- Run biome check on every file you touch.\n"
        self.assertEqual(screen_candidate(before, after, self.tasks).verdict, "pass")

    def test_config_extends_and_disables_rules(self) -> None:
        cfg = ScreenConfig.from_cfg({"screen_extra_env_patterns": ["\\bwidget\\b"], "screen_disabled_rules": ["fixture"]})
        self.assertIn("extra-0", {rule.rule_id for rule in cfg.env_rules})
        self.assertNotIn("fixture", {rule.rule_id for rule in cfg.env_rules})
        verdict = screen_candidate(self.v0, self.v0 + "\n- a widget note\n", self.tasks, cfg)
        self.assertEqual([r.rule_id for r in verdict.reasons], ["extra-0"])


class RescreenTest(unittest.TestCase):
    """``python -m beep_skillopt.rescreen`` on a synthetic finished run."""

    def setUp(self) -> None:
        import tempfile

        self._tmp = tempfile.TemporaryDirectory()
        self.out_root = Path(self._tmp.name) / "out"
        root = repo_root()
        self.tasks = load_corpus_tasks(root / CORPUS_SPLITS, root)
        v0 = history_skill(0)
        window = leak_window(self.tasks, v0)
        old_line = " ".join(word if index % 2 == 0 else f"qq{index}" for index, word in enumerate(window))
        self.start2 = v0 + "\n- " + old_line + "\n"
        # step 1: the known sandbox repair; step 2: a reworded line that the
        # old per-segment screen let through; step 3: benign; step 4: skipped.
        candidates = {1: history_skill(1), 2: v0 + "\n- " + " ".join(window) + "\n", 3: v0 + BENIGN_ADDITION}
        starts = {1: v0, 2: self.start2, 3: v0, 4: v0}
        (self.out_root / "skills").mkdir(parents=True)
        for step, text in starts.items():
            (self.out_root / "skills" / f"skill_v{step - 1:04d}.md").write_text(text)
        for step, text in candidates.items():
            step_dir = self.out_root / "steps" / f"step_{step:04d}"
            step_dir.mkdir(parents=True)
            (step_dir / "candidate_skill.md").write_text(text)
        history = [{"step": 1, "action": "reject"}, {"step": 2, "action": "reject"},
                   {"step": 3, "action": "accept_new_best"}, {"step": 4, "action": "skip_no_patches"}]
        (self.out_root / "history.json").write_text(json.dumps(history))
        (self.out_root / "config.json").write_text(json.dumps({"split_dir": str(CORPUS_SPLITS), "screen_shingle_k": 5}))
        log = [{"step": 1, "verdict": "reject"}, {"step": 2, "verdict": "pass"}, {"step": 3, "verdict": "pass"}]
        (self.out_root / "screen-log.jsonl").write_text("".join(json.dumps(r) + "\n" for r in log))

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_rescreen_flags_what_the_run_let_through(self) -> None:
        import contextlib
        import io

        from beep_skillopt import rescreen

        with contextlib.redirect_stdout(io.StringIO()):
            code = rescreen.main(["--out-root", str(self.out_root), "--repo-root", str(repo_root())])
        self.assertEqual(code, 0)
        raw = (self.out_root / rescreen.RESCREEN_FILE).read_text()
        rows = {row["step"]: row for row in map(json.loads, raw.splitlines())}
        self.assertEqual((rows[1]["original_verdict"], rows[1]["verdict"], rows[1]["changed"]), ("reject", "reject", False))
        self.assertIn(ENV_FITTING, rows[1]["codes"])
        self.assertEqual((rows[2]["original_verdict"], rows[2]["verdict"], rows[2]["changed"]), ("pass", "reject", True))
        self.assertIn(TASK_LEAKAGE, rows[2]["codes"])
        self.assertEqual((rows[3]["verdict"], rows[3]["changed"]), ("pass", False))
        self.assertEqual(rows[4]["verdict"], "no-candidate")
        self.assertEqual(rows[1]["diff_digest"], diff_digest(history_skill(0), history_skill(1)))
        # Same privacy rules as screen-log.jsonl: no skill text, task text, or paths.
        self.assertNotIn(str(repo_root()), raw)
        self.assertNotIn(str(self.out_root), raw)
        self.assertNotIn("qq1", raw)
        for task in self.tasks:
            self.assertNotIn(task.prompt[:40], raw)
        self.assertNotIn(history_skill(1)[:40], raw)

    def test_rescreen_refuses_a_missing_corpus(self) -> None:
        import contextlib
        import io

        from beep_skillopt import rescreen

        with contextlib.redirect_stderr(io.StringIO()):
            code = rescreen.main(["--out-root", str(self.out_root), "--repo-root", str(self.out_root)])
        self.assertEqual(code, 1)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(rescreen.main(["--out-root", str(self.out_root / "absent")]), 1)


if __name__ == "__main__":
    unittest.main()
