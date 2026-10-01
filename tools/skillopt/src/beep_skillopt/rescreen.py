"""Post-hoc re-screen of a finished run: ``<out_root>/rescreen.jsonl``.

Runs the CURRENT :func:`beep_skillopt.screen.screen_candidate` over every
step's candidate in a finished (or stopped) run, to find candidates an earlier
version of the screen let through. For step N the "before" text is the skill
the step started from, ``skills/skill_v{N-1}.md``, and the candidate is
``steps/step_NNNN/candidate_skill.md``. Screen settings come from the run's
``config.json`` (``screen_shingle_k``, ``screen_disabled_rules``,
``screen_extra_env_patterns``) on top of the current defaults; the corpus is
the run's ``split_dir`` (train, val, and test).

Each row carries the same fields as ``screen-log.jsonl`` (verdict, codes, rule
ids, counts, task ids, sizes, diff digest) plus the run's own decision for the
step, and nothing else: no skill text, task text, prompts, or paths. Analysis
only; it never changes the run's files except writing ``rescreen.jsonl``
(or ``--output``).

Usage::

    uv run --project tools/skillopt python -m beep_skillopt.rescreen --out-root <out_root>
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any

from beep_skillopt.controls import SCREEN_LOG
from beep_skillopt.export import _read_json, _read_jsonl, _read_text
from beep_skillopt.screen import CorpusTask, ScreenConfig, load_corpus_tasks, screen_candidate

RESCREEN_FILE = "rescreen.jsonl"
SCHEMA = "beep-skillopt-rescreen/v1"


def _now() -> str:
    return _dt.datetime.now(_dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _resolve(base: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base / path


def load_tasks_for(config: dict[str, Any], repo_root: Path) -> list[CorpusTask]:
    split_dir = _resolve(repo_root, str(config.get("split_dir") or ""))
    if not split_dir.is_dir():
        raise FileNotFoundError("the run's split_dir is not a directory under --repo-root")
    return load_corpus_tasks(split_dir, repo_root)


def rescreen(out_root: str | Path, repo_root: str | Path, tasks: list[CorpusTask] | None = None) -> list[dict[str, Any]]:
    root = Path(out_root)
    config = _read_json(root / "config.json", {})
    history = _read_json(root / "history.json", [])
    screen_config = ScreenConfig.from_cfg(config)
    corpus = tasks if tasks is not None else load_tasks_for(config, Path(repo_root))
    original: dict[int, str] = {}
    for entry in _read_jsonl(root / SCREEN_LOG):
        if "step" in entry:
            original[int(entry["step"])] = str(entry.get("verdict"))

    rows: list[dict[str, Any]] = []
    for rec in history:
        step = int(rec.get("step", 0))
        before = _read_text(root / "skills" / f"skill_v{step - 1:04d}.md")
        after = _read_text(root / "steps" / f"step_{step:04d}" / "candidate_skill.md")
        row: dict[str, Any] = {
            "schema": SCHEMA,
            "step": step,
            "ts": _now(),
            "action": str(rec.get("action", "")),
            "original_verdict": original.get(step, "not-screened"),
            "shingle_k": screen_config.shingle_k,
        }
        if before is None or after is None:
            row.update({"verdict": "no-candidate", "codes": [], "reasons": [], "changed": False})
            rows.append(row)
            continue
        verdict = screen_candidate(before, after, corpus, screen_config)
        row.update(verdict.to_json())
        row["changed"] = row["original_verdict"] in ("pass", "reject") and row["original_verdict"] != verdict.verdict
        rows.append(row)
    return rows


def write_rescreen(rows: list[dict[str, Any]], target: Path) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True) + "\n")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-run the current screen over a finished SkillOpt run")
    parser.add_argument("--out-root", required=True, help="The run's env.out_root directory")
    parser.add_argument("--repo-root", default=None,
                        help="Checkout the run's split_dir resolves against (default: the run's repo_root from cwd)")
    parser.add_argument("--output", default=None, help=f"Write here instead of <out_root>/{RESCREEN_FILE}")
    args = parser.parse_args(argv)
    root = Path(args.out_root)
    if not (root / "history.json").is_file():
        print("no history.json under --out-root; nothing to re-screen", file=sys.stderr)
        return 1
    config = _read_json(root / "config.json", {})
    repo_root = Path(args.repo_root) if args.repo_root else _resolve(Path.cwd(), str(config.get("repo_root") or "."))
    try:
        rows = rescreen(root, repo_root)
    except FileNotFoundError as error:
        print(f"rescreen: {error}", file=sys.stderr)
        return 1
    target = write_rescreen(rows, Path(args.output) if args.output else root / RESCREEN_FILE)
    for row in rows:
        mark = "  CHANGED" if row["changed"] else ""
        print(f"step {row['step']}: run={row['original_verdict']} now={row['verdict']} {row['codes']}{mark}")
    print(f"wrote {len(rows)} rows to {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
