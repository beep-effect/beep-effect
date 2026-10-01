"""Shared helpers for the beep_skillopt unit tests (stdlib unittest only)."""

from __future__ import annotations

from pathlib import Path

HISTORY_SKILLS = Path("goals/harness-evidence-ledger/history/p2-rerun/skills")
CORPUS_SPLITS = Path("goals/skillopt-training-pilot/corpus/splits")
FIXTURE_SPLITS = Path("tools/skillopt/tests/fixtures/splits")
TEMPLATE_CONFIG = Path("tools/skillopt/configs/beeplaw.template.yaml")

# A benign schema-first guidance edit written for these tests. It mentions
# Biome and TypeScript in general terms on purpose: the screen must not treat
# general tool names as evaluation-environment fitting.
BENIGN_ADDITION = (
    "\n- Prefer `S.TaggedClass` for each variant of a tagged union so every member "
    "carries its own `_tag` literal and annotations. Keep Biome and TypeScript "
    "diagnostics clean in the code you touch, and prefer `Match.tagsExhaustive` "
    "over a `switch` on `_tag`.\n"
)


def repo_root() -> Path:
    path = Path(__file__).resolve()
    for candidate in (path, *path.parents):
        if (candidate / "tools" / "skillopt").is_dir() and (candidate / "goals").is_dir():
            return candidate
    raise RuntimeError("repo root not found")


def history_skill(version: int) -> str:
    return (repo_root() / HISTORY_SKILLS / f"skill_v{version:04d}.md").read_text(encoding="utf-8")
