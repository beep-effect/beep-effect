"""Per-step evidence export: ``<out_root>/steps.jsonl``.

Derived from what the vendored trainer already writes (``history.json``,
``skills/skill_vNNNN.md``, ``steps/step_NNNN/candidate_skill.md``, and each
step's ``selection_eval/results.jsonl``) plus this package's
``screen-log.jsonl``. Safe to run during a run (it re-reads the files) or
after it. Rows carry numbers, verdicts, digests, and task ids only: no skill
text, task text, prompts, or paths.

Usage::

    uv run --project tools/skillopt python -m beep_skillopt.export --out-root <out_root>
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from beep_skillopt.controls import SCREEN_LOG, summarize_results
from beep_skillopt.screen import diff_digest

STEPS_FILE = "steps.jsonl"
SCHEMA = "beep-skillopt-steps/v1"
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


def _baseline_score(out_root: Path, metric: str, weight: float) -> float | None:
    rows = _read_jsonl(out_root / "selection_eval_baseline" / "results.jsonl")
    if not rows:
        return None
    summary = summarize_results(rows)
    return round(_gate_score(summary["hard"], summary["soft"], metric, weight), 6)


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
    prev_current = baseline
    prev_best = baseline
    rows: list[dict[str, Any]] = []
    for rec in history:
        step = int(rec.get("step", 0))
        action = str(rec.get("action", ""))
        screen = screens.get(step)
        screen_verdict = str(screen.get("verdict")) if screen else "not-screened"
        screened_out = screen_verdict == "reject"

        if screened_out or action.startswith("skip"):
            gate = "not-evaluated"
        elif action in _ACCEPT:
            gate = "accept"
        elif action == "reject":
            gate = "reject"
        else:
            gate = "not-evaluated"
        evaluated = gate in ("accept", "reject")

        before_text = _read_text(root / "skills" / f"skill_v{step - 1:04d}.md")
        candidate_text = _read_text(root / "steps" / f"step_{step:04d}" / "candidate_skill.md")
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
            sel_rows = _read_jsonl(root / "steps" / f"step_{step:04d}" / "selection_eval" / "results.jsonl")
            per_task = summarize_results(sel_rows)["per_task"] if sel_rows else []

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
            "gate_metric": rec.get("gate_metric", metric),
            "selection_soft": rec.get("selection_soft") if evaluated else None,
            "selection_hard": rec.get("selection_hard") if evaluated else None,
            "candidate_gate_score": rec.get("candidate_gate_score") if evaluated else None,
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
