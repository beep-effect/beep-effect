"""Loop-side controls wrapped around the Beeplaw adapter's ``rollout``.

SkillOpt 0.2.0's trainer (``skillopt.engine.trainer``) has exactly one call
that spends evaluation quota on a candidate: ``adapter.rollout(sel_env,
candidate_skill, <step_dir>/selection_eval)``. Wrapping the adapter's
``rollout`` is therefore the narrowest seam that sees a candidate BEFORE it is
evaluated, without touching installed vendor code. The rollout directory tells
the controls which call they are looking at:

* ``<out_root>/selection_eval_baseline`` - the loop's baseline.
* ``<out_root>/steps/step_NNNN[/batch_K]/rollout`` - the step's train rollout,
  whose skill argument is the trainer's ``current_skill`` for step N.
* ``<out_root>/steps/step_NNNN/selection_eval`` - the candidate evaluation.

Controls
--------
* Pre-evaluation screen (``screen_candidates``): a screened-out candidate is
  never rolled out. ``rollout`` returns no results, the trainer's
  ``compute_score([])`` is ``(0.0, 0.0)``, and the strict-greater gate rejects
  it, so the loop continues with its current skill. Each decision is appended
  to ``<out_root>/screen-log.jsonl`` (no skill text, task text, or paths).
* Baseline noise band (``baseline_repeats``): before the loop's own baseline,
  the baseline is measured N more times on identical inputs in fresh
  directories (never the cached ``selection_eval_baseline``) and summarized in
  ``<out_root>/baseline-noise.json``. This is rerun analysis only; the loop's
  gate still uses its own baseline.
"""

from __future__ import annotations

import datetime as _dt
import json
import re
import shutil
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from beep_skillopt.screen import CorpusTask, ScreenConfig, load_corpus_tasks, screen_candidate

RunBatch = Callable[[list[dict], str, str], list[dict]]

SCREEN_LOG = "screen-log.jsonl"
BASELINE_NOISE = "baseline-noise.json"
BASELINE_NOISE_DIR = "baseline-noise"

_TRAIN_DIR = re.compile(r"^steps/step_(\d+)/(?:batch_\d+/)?rollout$")
_SELECTION_DIR = re.compile(r"^steps/step_(\d+)/selection_eval$")
_TRUE = {"1", "true", "yes", "on"}


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in _TRUE


def _now() -> str:
    return _dt.datetime.now(_dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def classify_rollout_dir(out_root: str | Path, out_dir: str | Path) -> tuple[str, int]:
    """Return ``(role, step)`` for a rollout directory (step 0 when not a step)."""
    try:
        rel = Path(out_dir).resolve().relative_to(Path(out_root).resolve()).as_posix()
    except ValueError:
        return "other", 0
    if rel == "selection_eval_baseline":
        return "baseline", 0
    match = _TRAIN_DIR.match(rel)
    if match:
        return "train", int(match.group(1))
    match = _SELECTION_DIR.match(rel)
    if match:
        return "selection", int(match.group(1))
    return "other", 0


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def summarize_results(results: list[dict]) -> dict[str, Any]:
    """Aggregate soft/hard plus per-task timings; ids only, no task text."""
    return {
        "n_items": len(results),
        "soft": round(_mean([float(r.get("soft", 0.0) or 0.0) for r in results]), 6),
        "hard": round(_mean([float(r.get("hard", 0.0) or 0.0) for r in results]), 6),
        "per_task": [
            {
                "task_id": str(r.get("id", "")),
                "soft": float(r.get("soft", 0.0) or 0.0),
                "hard": float(r.get("hard", 0.0) or 0.0),
                "exec_seconds": r.get("exec_seconds"),
                "score_seconds": r.get("score_seconds"),
            }
            for r in sorted(results, key=lambda row: str(row.get("id", "")))
        ],
    }


def _band(values: list[float]) -> dict[str, float]:
    if not values:
        return {"min": 0.0, "max": 0.0, "spread": 0.0, "mean": 0.0}
    lo, hi = min(values), max(values)
    return {
        "min": round(lo, 6),
        "max": round(hi, 6),
        "spread": round(hi - lo, 6),
        "mean": round(_mean(values), 6),
    }


class LoopControls:
    """Screen + baseline-noise controls for one training run."""

    def __init__(self, cfg: dict[str, Any], repo_root: Path) -> None:
        self.out_root = Path(str(cfg.get("out_root") or ".")).resolve()
        self.repo_root = Path(repo_root)
        self.screen_enabled = _truthy(cfg.get("screen_candidates"))
        self.baseline_repeats = max(0, int(cfg.get("baseline_repeats") or 0))
        self.screen_config = ScreenConfig.from_cfg(cfg)
        self.split_dir = str(cfg.get("split_dir") or "")
        self.skill_init = str(cfg.get("skill_init") or "")
        self._tasks: list[CorpusTask] | None = None
        self._step_skill: dict[int, str] = {}
        self.evaluated_selection_steps: list[int] = []
        self.screened_out_steps: list[int] = []

    # -- screen ------------------------------------------------------------

    def tasks(self) -> list[CorpusTask]:
        if self._tasks is None:
            split_dir = Path(self.split_dir)
            if not split_dir.is_absolute():
                split_dir = self.repo_root / split_dir
            self._tasks = load_corpus_tasks(split_dir, self.repo_root) if split_dir.is_dir() else []
        return self._tasks

    def _current_skill_for(self, step: int) -> str | None:
        if step in self._step_skill:
            return self._step_skill[step]
        saved = self.out_root / "skills" / f"skill_v{step - 1:04d}.md"
        if saved.is_file():
            return saved.read_text(encoding="utf-8")
        return None

    def _append_screen_log(self, entry: dict[str, Any]) -> None:
        self.out_root.mkdir(parents=True, exist_ok=True)
        with (self.out_root / SCREEN_LOG).open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, sort_keys=True) + "\n")

    def screen_step(self, step: int, candidate: str) -> bool:
        """Screen step ``step``'s candidate; return True when it must not be evaluated."""
        before = self._current_skill_for(step)
        if before is None:
            self._append_screen_log(
                {"step": step, "ts": _now(), "verdict": "unscreened", "codes": ["no-current-skill"]}
            )
            print(f"    [screen] step {step}: no current skill on record; evaluating unscreened", flush=True)
            return False
        verdict = screen_candidate(before, candidate, self.tasks(), self.screen_config)
        payload = verdict.to_json()
        self._append_screen_log({"step": step, "ts": _now(), **payload})
        if verdict.rejected:
            self.screened_out_steps.append(step)
            rules = sorted({reason.rule_id for reason in verdict.reasons})
            print(
                f"    [screen] REJECT step {step} before evaluation: "
                f"{', '.join(verdict.codes)} (rules: {', '.join(rules)}); "
                f"size {verdict.before_chars} -> {verdict.after_chars} chars "
                f"({verdict.growth_pct:+.2f}%)",
                flush=True,
            )
            return True
        print(
            f"    [screen] pass step {step}: size {verdict.before_chars} -> "
            f"{verdict.after_chars} chars ({verdict.growth_pct:+.2f}%)",
            flush=True,
        )
        return False

    # -- baseline noise ------------------------------------------------------

    def _noise_path(self) -> Path:
        return self.out_root / BASELINE_NOISE

    def measure_baseline_noise(self, items: list[dict], skill: str, run: RunBatch) -> None:
        if self.baseline_repeats <= 0 or self._noise_path().exists():
            return
        print(
            f"\n  [baseline noise] measuring the baseline {self.baseline_repeats}x on identical "
            "inputs (fresh directories, no cache)",
            flush=True,
        )
        runs: list[dict[str, Any]] = []
        for index in range(1, self.baseline_repeats + 1):
            run_dir = self.out_root / BASELINE_NOISE_DIR / f"run_{index:02d}"
            if run_dir.exists():
                shutil.rmtree(run_dir)
            started = time.time()
            results = run(list(items), skill, str(run_dir))
            summary = summarize_results(results)
            summary["run"] = index
            summary["wall_seconds"] = round(time.time() - started, 1)
            runs.append(summary)
            print(
                f"  [baseline noise] run {index}/{self.baseline_repeats} "
                f"soft={summary['soft']:.4f} hard={summary['hard']:.4f} "
                f"dt={summary['wall_seconds']}s",
                flush=True,
            )
        report = {
            "schema": "beep-skillopt-baseline-noise/v1",
            "ts": _now(),
            "repeats": self.baseline_repeats,
            "note": "rerun analysis only; the loop gate uses its own baseline, not this band",
            "runs": runs,
            "soft": _band([r["soft"] for r in runs]),
            "hard": _band([r["hard"] for r in runs]),
            "loop_baseline": None,
        }
        self._noise_path().write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(
            f"  [baseline noise] soft min={report['soft']['min']:.4f} max={report['soft']['max']:.4f} "
            f"spread={report['soft']['spread']:.4f}",
            flush=True,
        )

    def record_loop_baseline(self, results: list[dict], wall_seconds: float, reused: bool) -> None:
        path = self._noise_path()
        if not path.is_file():
            return
        report = json.loads(path.read_text(encoding="utf-8"))
        loop = summarize_results(results)
        loop["wall_seconds"] = round(wall_seconds, 1)
        loop["reused_cached_results"] = reused
        report["loop_baseline"] = loop
        path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    # -- dispatch ------------------------------------------------------------

    def rollout(self, items: list[dict], skill: str, out_dir: str, run: RunBatch) -> list[dict]:
        role, step = classify_rollout_dir(self.out_root, out_dir)
        if role == "train":
            self._step_skill[step] = skill
        elif role == "selection" and self.screen_enabled:
            if self.screen_step(step, skill):
                return []
        elif role == "baseline":
            self.measure_baseline_noise(items, skill, run)
            reused = (Path(out_dir) / "results.jsonl").exists()
            started = time.time()
            results = run(items, skill, out_dir)
            self.record_loop_baseline(results, time.time() - started, reused)
            return results
        if role == "selection":
            self.evaluated_selection_steps.append(step)
        return run(items, skill, out_dir)
