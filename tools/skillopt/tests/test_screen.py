from __future__ import annotations

import hashlib
import unittest

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

    def test_config_extends_and_disables_rules(self) -> None:
        cfg = ScreenConfig.from_cfg({"screen_extra_env_patterns": ["\\bwidget\\b"], "screen_disabled_rules": ["fixture"]})
        self.assertIn("extra-0", {rule.rule_id for rule in cfg.env_rules})
        self.assertNotIn("fixture", {rule.rule_id for rule in cfg.env_rules})
        verdict = screen_candidate(self.v0, self.v0 + "\n- a widget note\n", self.tasks, cfg)
        self.assertEqual([r.rule_id for r in verdict.reasons], ["extra-0"])


if __name__ == "__main__":
    unittest.main()
