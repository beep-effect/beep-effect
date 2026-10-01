"""Per-step evidence export: ``<out_root>/steps.jsonl``.

Derived from what the vendored trainer already writes (``history.json``,
``skills/skill_vNNNN.md``, ``steps/step_NNNN/candidate_skill.md``, and each
step's ``selection_eval/results.jsonl``) plus this package's
``screen-log.jsonl``. Safe to run during a run (it re-reads the files) or
after it. Rows carry numbers, verdicts, digests, and task ids only: no skill
text, task text, prompts, or paths.

Scores
------
``previous_best`` is the score the loop gate compared the candidate against:
the incumbent (current) score before the step, which is the loop baseline for
the first step and then the running ``current_score`` from ``history.json``.
It is full precision (the baseline is recomputed unrounded from
``selection_eval_baseline/results.jsonl``, exactly as the trainer's
``compute_score`` does), as are ``selection_soft`` and ``candidate_gate_score``.
``gate_delta`` is candidate minus incumbent and ``within_baseline_noise`` is
``|gate_delta| <= spread + NOISE_TOLERANCE``, where ``spread`` is max minus min
of the gate metric over the ``baseline-noise.json`` runs (recomputed unrounded
from each run's per-task scores): an analysis flag only, the gate itself is
unchanged.

Not-evaluated steps
-------------------
A step is ``gate_verdict = "not-evaluated"`` with null scores and a
``not_evaluated_reason`` when its candidate was never rolled out:

* ``screen-rejected``: the screen rejected it (``screen-log.jsonl``).
* ``screen-cache-hit``: the candidate's hash equals an earlier screened-out
  candidate. The trainer's ``sel_cache`` holds ``(0.0, 0.0)`` for that hash
  (also re-seeded from ``history.json`` on resume), so it records a
  ``reject`` at 0.0 without any rollout and without a screen decision. That
  0.0 is not a measurement; ``repeats_step`` names the screened step.
* ``skipped``: the trainer produced no candidate.

Usage::

    uv run --project tools/skillopt python -m beep_skillopt.export --out-root <out_root>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from beep_skillopt.controls import BASELINE_NOISE, SCREEN_LOG, measured_rows, summarize_results
from beep_skillopt.screen import diff_digest

STEPS_FILE = "steps.jsonl"
SCHEMA = "beep-skillopt-steps/v2"
# The scorer rounds each item's soft score to six decimals, so two means that
# differ by less than this are the same measurement (the 2026-09-29 rerun's
# step-2 accept won by 2.5e-7 on exactly such a rounding gap).
NOISE_TOLERANCE = 1e-6
_ACCEPT = {"accept", "accept_new_best", "force_accept"}


def _read_json(path: Path, default: Any) -> Any:
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _read_jsonl(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            rows.append(row)
    return rows


def _gate_score(hard: float, soft: float, metric: str, weight: float) -> float:
    if metric == "hard":
        return hard
    if metric == "mixed":
        return (1.0 - weight) * hard + weight * soft
    return soft


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _baseline_score(out_root: Path, metric: str, weight: float) -> float | None:
    """The loop baseline at full precision, as the trainer's ``compute_score`` has it."""
    rows = measured_rows(_read_jsonl(out_root / "selection_eval_baseline" / "results.jsonl"))
    if not rows:
        return None
    hard = _mean([float(r.get("hard", 0) or 0) for r in rows])
    soft = _mean([float(r.get("soft", 0.0) or 0.0) for r in rows])
    return _gate_score(hard, soft, metric, weight)


def _noise_spread(out_root: Path, metric: str, weight: float) -> float | None:
    """Spread (max - min) of the gate metric over the baseline noise runs."""
    report = _read_json(out_root / BASELINE_NOISE, None)
    if not isinstance(report, dict):
        return None
    runs = [r for r in report.get("runs") or [] if isinstance(r, dict)]
    if not runs:
        return None
    scores: list[float] = []
    for run in runs:
        items = [t for t in run.get("per_task") or [] if isinstance(t, dict)]
        if items:  # unrounded, like the trainer's compute_score
            hard = _mean([float(t.get("hard", 0.0) or 0.0) for t in items])
            soft = _mean([float(t.get("soft", 0.0) or 0.0) for t in items])
        else:
            hard, soft = float(run.get("hard", 0.0)), float(run.get("soft", 0.0))
        scores.append(_gate_score(hard, soft, metric, weight))
    return max(scores) - min(scores)


def skill_hash(text: str) -> str:
    """The trainer's candidate hash (``skillopt.utils.scoring.skill_hash``), for rows that lack one."""
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _read_text(path: Path) -> str | None:
    return path.read_text(encoding="utf-8") if path.is_file() else None


def build_steps(out_root: str | Path) -> list[dict[str, Any]]:
    root = Path(out_root)
    history = _read_json(root / "history.json", [])
    config = _read_json(root / "config.json", {})
    metric = str(config.get("gate_metric") or "soft").lower()
    weight = float(config.get("gate_mixed_weight", 0.5) or 0.5)

    screens: dict[int, dict] = {}
    for entry in _read_jsonl(root / SCREEN_LOG):
        if "step" in entry:
            screens[int(entry["step"])] = entry  # last decision for a step wins (resume)

    baseline = _baseline_score(root, metric, weight)
    spread = _noise_spread(root, metric, weight)
    prev_current = baseline
    prev_best = baseline
    screened_hashes: dict[str, int] = {}  # candidate hash -> first screened-out step
    rows: list[dict[str, Any]] = []
    for rec in history:
        step = int(rec.get("step", 0))
        action = str(rec.get("action", ""))
        candidate_text = _read_text(root / "steps" / f"step_{step:04d}" / "candidate_skill.md")
        cand_hash = str(rec.get("candidate_hash") or "") or (
            skill_hash(candidate_text) if candidate_text is not None and not action.startswith("skip") else ""
        )
        screen = screens.get(step)
        screen_verdict = str(screen.get("verdict")) if screen else "not-screened"
        repeats_step: int | None = None

        if screen_verdict == "reject":
            reason: str | None = "screen-rejected"
            if cand_hash:
                screened_hashes.setdefault(cand_hash, step)
        elif screen is None and cand_hash in screened_hashes:
            # The trainer's sel_cache returned the screened candidate's (0, 0):
            # no rollout, no screen decision, no measurement.
            reason = "screen-cache-hit"
            repeats_step = screened_hashes[cand_hash]
            screen_verdict = "cached-reject"
        elif action.startswith("skip"):
            reason = "skipped"
        elif action in _ACCEPT or action == "reject":
            reason = None
        else:
            reason = "no-gate-decision"

        if reason is not None:
            gate = "not-evaluated"
        else:
            gate = "accept" if action in _ACCEPT else "reject"
        evaluated = reason is None

        before_text = _read_text(root / "skills" / f"skill_v{step - 1:04d}.md")
        digest = (
            diff_digest(before_text, candidate_text)
            if before_text is not None and candidate_text is not None
            else None
        )
        before_chars = len(before_text) if before_text is not None else None
        candidate_chars = rec.get("candidate_skill_len")
        if candidate_chars is None and candidate_text is not None:
            candidate_chars = len(candidate_text)

        per_task: list[dict[str, Any]] = []
        if evaluated:
            sel_rows = measured_rows(
                _read_jsonl(root / "steps" / f"step_{step:04d}" / "selection_eval" / "results.jsonl")
            )
            per_task = summarize_results(sel_rows)["per_task"] if sel_rows else []

        cand_score = None
        if evaluated:
            cand_score = rec.get("candidate_gate_score")
            if cand_score is None and rec.get("selection_hard") is not None:
                cand_score = _gate_score(
                    float(rec["selection_hard"]), float(rec.get("selection_soft") or 0.0), metric, weight
                )
        delta = float(cand_score) - float(prev_current) if cand_score is not None and prev_current is not None else None
        within = abs(delta) <= spread + NOISE_TOLERANCE if delta is not None and spread is not None else None

        apply_summary = rec.get("edit_apply_summary") or {}
        row: dict[str, Any] = {
            "schema": SCHEMA,
            "step": step,
            "epoch": rec.get("epoch"),
            "action": action,
            "edit_budget": rec.get("edit_budget"),
            "edits_merged": rec.get("n_edits_merged"),
            "edits_ranked": rec.get("n_edits_ranked"),
            "edits_applied": apply_summary.get("applied"),
            "screen_verdict": screen_verdict,
            "screen_codes": list(screen.get("codes", [])) if screen else [],
            "screen_rules": sorted({str(r.get("rule")) for r in screen.get("reasons", [])}) if screen else [],
            "gate_verdict": gate,
            "not_evaluated_reason": reason,
            "repeats_step": repeats_step,
            "candidate_hash": cand_hash or None,
            "gate_metric": rec.get("gate_metric", metric),
            "selection_soft": rec.get("selection_soft") if evaluated else None,
            "selection_hard": rec.get("selection_hard") if evaluated else None,
            "candidate_gate_score": cand_score,
            "previous_best": prev_current,
            "gate_delta": delta,
            "baseline_noise_spread": spread,
            "within_baseline_noise": within,
            "prev_current": prev_current,
            "prev_best": prev_best,
            "current_after": rec.get("current_score"),
            "best_after": rec.get("best_score"),
            "wall_seconds": rec.get("wall_time_s"),
            "timing": rec.get("timing", {}),
            "per_task": per_task,
            "skill_chars_before": before_chars,
            "skill_chars_after": candidate_chars,
            "current_chars_after": rec.get("skill_len"),
            "diff_digest": digest,
        }
        rows.append(row)
        prev_current = rec.get("current_score", prev_current)
        prev_best = rec.get("best_score", prev_best)
    return rows


def export_steps(out_root: str | Path) -> Path:
    root = Path(out_root)
    rows = build_steps(root)
    target = root / STEPS_FILE
    with target.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True) + "\n")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export per-step SkillOpt evidence to steps.jsonl")
    parser.add_argument("--out-root", required=True, help="The run's env.out_root directory")
    args = parser.parse_args(argv)
    root = Path(args.out_root)
    if not (root / "history.json").is_file():
        print(f"no history.json under {root}; nothing to export yet", file=sys.stderr)
        return 1
    target = export_steps(root)
    count = sum(1 for _ in target.open(encoding="utf-8"))
    print(f"wrote {count} step rows to {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
