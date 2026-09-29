"""End-to-end: the real ReflACT trainer with the stub scorer and skipped execution.

The optimizer's model calls (reflect, merge, rank, apply) are replaced with
deterministic stand-ins that hand the trainer a prepared candidate per step.
Everything else, including the trainer's gate and state files, is the real
vendored code path. No model call and no rollout target runs.
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _support import BENIGN_ADDITION, FIXTURE_SPLITS, TEMPLATE_CONFIG, history_skill, repo_root

import beep_skillopt.adapter as adapter_module
from beep_skillopt.adapter import BeepLawAdapter
from beep_skillopt.export import build_steps, export_steps


def _load_cfg(out_root: Path, skill_init: Path, extra: list[str]) -> dict:
    import scripts.train as train_script

    root = repo_root()
    options = [
        f"env.out_root={out_root}",
        f"env.skill_init={skill_init}",
        f"env.split_dir={root / FIXTURE_SPLITS}",
        f"env.repo_root={root}",
        "env.stub_scorer=true",
        "env.skip_exec=true",
        "train.num_epochs=2",
        "evaluation.gate_metric=soft",
        *extra,
    ]
    return train_script.load_config(argparse.Namespace(config=str(root / TEMPLATE_CONFIG), cfg_options=options))


def run_stub_training(tmp: Path, candidates: dict[int, str], extra: list[str]) -> tuple[dict, list[str]]:
    """Run the vendored trainer; return (summary, rollout dirs relative to out_root)."""
    from skillopt.engine import trainer as trainer_module
    from skillopt.engine.trainer import ReflACTTrainer

    out_root = tmp / "out"
    skill_init = tmp / "SKILL.md"
    skill_init.write_text(history_skill(0), encoding="utf-8")
    cfg = _load_cfg(out_root, skill_init, extra)
    adapter = BeepLawAdapter(
        split_dir=cfg["split_dir"],
        split_mode="split_dir",
        repo_root=cfg["repo_root"],
        stub_scorer=True,
        skip_exec=True,
        workers=1,
    )

    step = {"n": 0}
    edit = {"op": "append", "content": "stand-in", "support_count": 1}

    def fake_reflect(*_args, **_kwargs):
        return [{"patch": {"edits": [dict(edit)]}, "source_type": "failure", "batch_size": 1}]

    def fake_apply(current_skill, _ranked):
        step["n"] += 1
        return candidates[step["n"]], [{"status": "applied"}]

    rollout_dirs: list[str] = []
    real_run_batch = adapter_module._run_batch

    def spy_run_batch(**kwargs):
        rollout_dirs.append(Path(kwargs["out_root"]).resolve().relative_to(out_root.resolve()).as_posix())
        return real_run_batch(**kwargs)

    adapter.reflect = fake_reflect
    with contextlib.ExitStack() as stack:
        stack.enter_context(mock.patch.object(trainer_module, "merge_patches", lambda *a, **k: {"edits": [dict(edit)]}))
        stack.enter_context(mock.patch.object(trainer_module, "rank_and_select", lambda _s, merged, **k: merged))
        stack.enter_context(mock.patch.object(trainer_module, "apply_patch_with_report", fake_apply))
        stack.enter_context(mock.patch.object(adapter_module, "_run_batch", spy_run_batch))
        stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        summary = ReflACTTrainer(cfg, adapter).train()
    return summary, rollout_dirs


class LoopControlsTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_screened_candidate_is_never_evaluated(self) -> None:
        v0 = history_skill(0)
        candidates = {1: history_skill(1), 2: v0 + BENIGN_ADDITION}
        _summary, dirs = run_stub_training(
            self.tmp, candidates, ["env.screen_candidates=true", "env.baseline_repeats=0"]
        )
        out_root = self.tmp / "out"

        # Step 1 (the known sandbox-repair edit) never reached a selection rollout.
        self.assertNotIn("steps/step_0001/selection_eval", dirs)
        self.assertFalse((out_root / "steps/step_0001/selection_eval").exists())
        # Step 2 (benign) was evaluated.
        self.assertIn("steps/step_0002/selection_eval", dirs)

        log = [json.loads(line) for line in (out_root / "screen-log.jsonl").read_text().splitlines()]
        self.assertEqual([(row["step"], row["verdict"]) for row in log], [(1, "reject"), (2, "pass")])
        self.assertIn("evaluation-environment-fitting", log[0]["codes"])
        self.assertEqual(len(log[0]["diff_digest"]), 64)
        raw = (out_root / "screen-log.jsonl").read_text()
        self.assertNotIn(str(out_root), raw)
        self.assertNotIn("tsconfig.json", raw)

        history = json.loads((out_root / "history.json").read_text())
        self.assertEqual(history[0]["action"], "reject")  # loop continued with the current skill
        self.assertEqual((out_root / "skills/skill_v0001.md").read_text(), v0)

        steps = build_steps(out_root)
        self.assertEqual(steps[0]["screen_verdict"], "reject")
        self.assertEqual(steps[0]["gate_verdict"], "not-evaluated")
        self.assertIsNone(steps[0]["selection_soft"])
        self.assertEqual(steps[0]["diff_digest"], log[0]["diff_digest"])
        self.assertEqual(steps[1]["screen_verdict"], "pass")
        self.assertIn(steps[1]["gate_verdict"], ("accept", "reject"))
        self.assertEqual(steps[1]["selection_soft"], 1.0)
        self.assertEqual(steps[1]["per_task"][0]["task_id"], "toy-required-pattern")
        self.assertIsNotNone(steps[1]["per_task"][0]["score_seconds"])
        self.assertEqual(steps[1]["skill_chars_before"], len(v0))
        self.assertEqual(steps[1]["skill_chars_after"], len(v0 + BENIGN_ADDITION))

        target = export_steps(out_root)
        text = target.read_text()
        self.assertEqual(len(text.splitlines()), 2)
        self.assertNotIn(str(repo_root()), text)
        self.assertNotIn("schema-first-development", text)

    def test_repeat_of_a_screened_candidate_is_exported_as_not_evaluated(self) -> None:
        # Review F5, end to end: step 2 proposes the step-1 text again, the
        # trainer's sel_cache answers (0, 0), and no rollout or screen runs.
        from beep_skillopt import ledger

        _summary, dirs = run_stub_training(
            self.tmp, {1: history_skill(1), 2: history_skill(1)}, ["env.screen_candidates=true", "env.baseline_repeats=0"]
        )
        out_root = self.tmp / "out"
        self.assertNotIn("steps/step_0002/selection_eval", dirs)
        log = [json.loads(line)["step"] for line in (out_root / "screen-log.jsonl").read_text().splitlines()]
        self.assertEqual(log, [1])
        history = json.loads((out_root / "history.json").read_text())
        self.assertEqual((history[1]["action"], history[1]["selection_soft"]), ("reject", 0.0))

        steps = build_steps(out_root)
        self.assertEqual(steps[1]["not_evaluated_reason"], "screen-cache-hit")
        self.assertEqual(steps[1]["repeats_step"], 1)
        self.assertIsNone(steps[1]["selection_soft"])
        export_steps(out_root)
        lines: list[str] = []
        self.assertEqual(ledger.record(out_root, cli=["fake"], echo=lines.append), 0)
        step2 = [line for line in lines if "<rowId of step 2 propose>" in line]
        self.assertEqual(len(step2), 1)
        self.assertIn("repeats the candidate screened out at step 1", step2[0])
        self.assertNotIn("--score", step2[0])
        self.assertNotIn("loop gate", step2[0])

    def test_screen_off_evaluates_everything(self) -> None:
        candidates = {1: history_skill(1), 2: history_skill(2)}
        _summary, dirs = run_stub_training(
            self.tmp, candidates, ["env.screen_candidates=false", "env.baseline_repeats=0"]
        )
        self.assertIn("steps/step_0001/selection_eval", dirs)
        self.assertFalse((self.tmp / "out/screen-log.jsonl").exists())

    def test_screen_refuses_a_gate_off_trainer(self) -> None:
        # Review F8: with the gate off the trainer force-accepts a screened candidate.
        from beep_skillopt.controls import ScreenBypassError

        with self.assertRaisesRegex(ScreenBypassError, "use_gate"):
            run_stub_training(
                self.tmp,
                {1: history_skill(1), 2: history_skill(1)},
                ["env.screen_candidates=true", "env.baseline_repeats=0", "evaluation.use_gate=false"],
            )
        # Refused before any rollout or state file.
        self.assertFalse((self.tmp / "out/history.json").exists())
        self.assertFalse((self.tmp / "out/selection_eval_baseline").exists())

    def test_screen_refuses_slow_update(self) -> None:
        from beep_skillopt.controls import LoopControls, ScreenBypassError, screen_bypass_reasons

        base = {"out_root": str(self.tmp / "out"), "screen_candidates": True, "use_gate": True}
        gated = {**base, "use_slow_update": True, "slow_update_gate_with_selection": True}
        ungated = {**base, "use_slow_update": True, "slow_update_gate_with_selection": False}
        self.assertIn("never screened", screen_bypass_reasons(gated)[0])
        self.assertIn("no evaluation", screen_bypass_reasons(ungated)[0])
        self.assertEqual(screen_bypass_reasons({**base, "use_gate": "false"})[0][:25], "evaluation.use_gate is fa")
        for cfg in (gated, ungated):
            with self.assertRaises(ScreenBypassError):
                LoopControls(cfg, repo_root())
        # Screen off, or gate on without slow update: allowed.
        LoopControls({**gated, "screen_candidates": False}, repo_root())
        LoopControls({**base, "use_slow_update": False}, repo_root())

    def test_baseline_noise_band_bypasses_the_cache(self) -> None:
        out_root = self.tmp / "out"
        # A stale noise-run directory with a poisoned result must not be reused.
        stale = out_root / "baseline-noise/run_01"
        stale.mkdir(parents=True)
        (stale / "results.jsonl").write_text(json.dumps({"id": "toy-required-pattern", "soft": 0.0, "hard": 0.0}) + "\n")
        candidates = {1: history_skill(0) + BENIGN_ADDITION, 2: history_skill(0) + BENIGN_ADDITION * 2}
        _summary, dirs = run_stub_training(
            self.tmp, candidates, ["env.screen_candidates=true", "env.baseline_repeats=3"]
        )
        self.assertEqual(
            dirs[:4],
            ["baseline-noise/run_01", "baseline-noise/run_02", "baseline-noise/run_03", "selection_eval_baseline"],
        )
        report = json.loads((out_root / "baseline-noise.json").read_text())
        self.assertEqual(report["repeats"], 3)
        self.assertEqual([run["soft"] for run in report["runs"]], [1.0, 1.0, 1.0])
        self.assertEqual(report["soft"], {"min": 1.0, "max": 1.0, "spread": 0.0, "mean": 1.0})
        self.assertTrue(all(run["wall_seconds"] >= 0 for run in report["runs"]))
        self.assertEqual(report["loop_baseline"]["soft"], 1.0)
        self.assertFalse(report["loop_baseline"]["reused_cached_results"])
        # The gate still used the loop's own baseline: the benign candidate at 1.0 is not > 1.0.
        history = json.loads((out_root / "history.json").read_text())
        self.assertEqual(history[0]["action"], "reject")


if __name__ == "__main__":
    unittest.main()
