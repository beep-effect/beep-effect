"""Pre-evaluation diff screen for SkillOpt candidate skills.

The screen inspects a candidate skill against the current skill BEFORE any
evaluation spend and returns a verdict with machine-readable reasons. It is
deterministic, dependency-free, and makes no model calls.

Only text the candidate ADDS is screened. Text that is unchanged from the
current skill can never be the reason for a rejection, and an edit that only
deletes text always passes.

Checks
------
* ``evaluation-environment-fitting``: added text names the scorer, its lanes or
  checks, the fixture layout, or the sandbox's tool configuration. The rules are
  regexes (``DEFAULT_ENV_RULES``), tuned against the stopped 2026-09-25 run:
  the step-1 diff (``skill_v0000 -> skill_v0001``) fires ``fixture``,
  ``tsconfig``, ``tool-config``, ``ts-error-code``, ``scorer-lane`` and
  ``scorer``; general guidance that mentions Biome or TypeScript does not.
* ``task-leakage``: added text shares a ``shingle_k``-word shingle with any
  corpus task prompt (train, validation, and test splits), or names a
  task-specific identifier from a task's completion criteria (a required export
  or a mixed-case, non-library name from its patterns) that the current skill
  does not already contain. Library vocabulary such as ``S.Class`` or
  ``@beep/utils`` never fires; the baseline skill as a whole yields zero hits.
  ``shingle_k = 5`` was measured: it catches the step-2 quote (4 shingles)
  while k = 4 already fires on the common phrase "and keep the fixture" in the
  step-1 diff, and k = 5 has zero hits against the baseline skill and every
  repo skill document plus ``AGENTS.md`` and ``standards/*.md``.
* Size growth is recorded in the verdict and never rejects (cost-aware
  acceptance is a SPEC non-goal as a gate).

The verdict carries rule ids, counts, and task ids only: never skill text or
task text, so it is safe to append to a run log.
"""

from __future__ import annotations

import difflib
import hashlib
import json
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ENV_FITTING = "evaluation-environment-fitting"
TASK_LEAKAGE = "task-leakage"
VERDICT_PASS = "pass"
VERDICT_REJECT = "reject"

DEFAULT_SHINGLE_K = 5
DIFF_LABEL_BEFORE = "a/SKILL.md"
DIFF_LABEL_AFTER = "b/SKILL.md"


@dataclass(frozen=True)
class EnvRule:
    """One evaluation-environment term: a stable id plus a case-insensitive regex."""

    rule_id: str
    pattern: str

    def compiled(self) -> re.Pattern[str]:
        return re.compile(self.pattern, re.IGNORECASE)


# Defaults are drawn from the real step-1 diff of the 2026-09-25 run. Bare
# "Biome", "TypeScript", and `extends` (as in `class X extends S.Class`) are
# deliberately NOT terms: legitimate schema-first guidance uses them.
DEFAULT_ENV_RULES: tuple[EnvRule, ...] = (
    EnvRule("scorer", r"\bscor(?:er|ers|ing)\b|\bgrader\b|\bgrading\b"),
    EnvRule("score-gate", r"\bselection (?:set|score)\b|\b(?:acceptance|selection|loop) gate\b"),
    EnvRule("sandbox", r"\bsandbox(?:ed|es)?\b"),
    EnvRule("fixture", r"\bfixtures?\b"),
    EnvRule("tsconfig", r"\btsconfig(?:\.[a-z]+)*(?:\.json)?\b"),
    EnvRule("config-extends", r"`extends`|\bextends\s+(?:a|the)\s+(?:relative|base|parent)\b"),
    EnvRule(
        "tool-config",
        r"\bbiome\s+(?:check|lint|format|ci|config(?:uration)?)\b|\bbiome\.jsonc?\b"
        r"|\b[\w-]+-local\s+(?:\w+\s+)?config\b",
    ),
    EnvRule("ts-error-code", r"\bTS\d{4}\b"),
    EnvRule("scorer-lane", r"\btsgo\b|\btsc\s+-p\b"),
    EnvRule("tool-output", r"no files were processed|\bpaths? (?:were|are|was) ignored\b"),
    EnvRule("parent-repo", r"\bparent (?:repo|repository|vcs)\b|\bcopied (?:location|fixture|directory)\b"),
    EnvRule("rollout-harness", r"\btask\.md\b|\.agents/skills\b|\.claude/skills\b|\bskillopt\b|\brollouts?\b"),
)

_WORD = re.compile(r"[a-z0-9]+")
_TOKEN = re.compile(r"\S+")
_REGEX_ESCAPES = re.compile(r"\\[sbdwSBDW][*+?]?")
_IDENT = re.compile(r"@?[A-Za-z_][A-Za-z0-9_]*(?:[./-][A-Za-z_@][A-Za-z0-9_]*)*")
_KEYWORDS = frozenset(
    {
        "export", "class", "const", "let", "var", "extends", "function", "return", "type",
        "interface", "import", "from", "readonly", "null", "undefined", "string", "number",
        "boolean", "async", "await", "new", "true", "false", "void", "any", "unknown",
    }
)
_MIN_IDENT_LEN = 3
_GENERIC_METHODS = frozenset(
    {"toLowerCase", "toUpperCase", "toString", "toFixed", "startsWith", "endsWith", "indexOf", "forEach"}
)
_LIBRARY_NAMESPACES = frozenset(
    {
        "Schema", "SchemaTransformation", "SchemaGetter", "SchemaIssue", "Effect", "Option",
        "Record", "Array", "Match", "Predicate", "Function", "Layer", "Context", "Struct",
        "String", "Number", "HashMap", "HashSet", "LiteralKit",
    }
)


@dataclass(frozen=True)
class ScreenConfig:
    """Tunable screen parameters. ``extra_env_patterns`` extends the defaults."""

    env_rules: tuple[EnvRule, ...] = DEFAULT_ENV_RULES
    shingle_k: int = DEFAULT_SHINGLE_K
    check_identifiers: bool = True

    @classmethod
    def from_cfg(cls, cfg: dict[str, Any]) -> ScreenConfig:
        rules = list(DEFAULT_ENV_RULES)
        disabled = {str(r) for r in (cfg.get("screen_disabled_rules") or [])}
        rules = [rule for rule in rules if rule.rule_id not in disabled]
        for index, pattern in enumerate(cfg.get("screen_extra_env_patterns") or []):
            rules.append(EnvRule(f"extra-{index}", str(pattern)))
        k = int(cfg.get("screen_shingle_k") or DEFAULT_SHINGLE_K)
        return cls(env_rules=tuple(rules), shingle_k=max(2, k))


@dataclass(frozen=True)
class CorpusTask:
    """A corpus task reduced to what the screen needs. Held in memory only."""

    task_id: str
    split: str
    prompt: str
    identifiers: frozenset[str]


@dataclass
class ScreenReason:
    code: str
    rule_id: str
    hits: int
    task_id: str = ""

    def to_json(self) -> dict[str, Any]:
        row: dict[str, Any] = {"code": self.code, "rule": self.rule_id, "hits": self.hits}
        if self.task_id:
            row["task_id"] = self.task_id
        return row


@dataclass
class ScreenVerdict:
    verdict: str
    reasons: list[ScreenReason] = field(default_factory=list)
    before_chars: int = 0
    after_chars: int = 0
    growth_pct: float = 0.0
    added_words: int = 0
    diff_digest: str = ""

    @property
    def rejected(self) -> bool:
        return self.verdict == VERDICT_REJECT

    @property
    def codes(self) -> list[str]:
        seen: list[str] = []
        for reason in self.reasons:
            if reason.code not in seen:
                seen.append(reason.code)
        return seen

    def to_json(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "codes": self.codes,
            "reasons": [reason.to_json() for reason in self.reasons],
            "size": {
                "before_chars": self.before_chars,
                "after_chars": self.after_chars,
                "growth_pct": self.growth_pct,
            },
            "added_words": self.added_words,
            "diff_digest": self.diff_digest,
        }


# ---------------------------------------------------------------------------
# Diff helpers
# ---------------------------------------------------------------------------


def unified_diff(before: str, after: str) -> str:
    """Unified diff with fixed labels, so the digest never depends on a path."""
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=DIFF_LABEL_BEFORE,
            tofile=DIFF_LABEL_AFTER,
        )
    )


def diff_digest(before: str, after: str) -> str:
    """SHA-256 hex of :func:`unified_diff`. Stable across machines and paths."""
    return hashlib.sha256(unified_diff(before, after).encode("utf-8")).hexdigest()


def added_segments(before: str, after: str) -> list[str]:
    """Whitespace-token spans present in ``after`` but not aligned to ``before``.

    A word-level alignment means a line that was extended ("concepts." ->
    "concepts. The schema-first ...") contributes only its new words, so
    unchanged baseline text never reaches a rule.
    """
    before_tokens = _TOKEN.findall(before)
    after_tokens = _TOKEN.findall(after)
    matcher = difflib.SequenceMatcher(None, before_tokens, after_tokens, autojunk=False)
    segments: list[str] = []
    for op, _i1, _i2, j1, j2 in matcher.get_opcodes():
        if op in ("insert", "replace") and j2 > j1:
            segments.append(" ".join(after_tokens[j1:j2]))
    return segments


def _words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def _shingles(words: Sequence[str], k: int) -> set[tuple[str, ...]]:
    return {tuple(words[i : i + k]) for i in range(len(words) - k + 1)}


# ---------------------------------------------------------------------------
# Corpus
# ---------------------------------------------------------------------------


def _is_library_vocabulary(token: str) -> bool:
    """True for library API names that legitimate law guidance names anyway.

    ``S.Class``, ``O.getSomesStruct``, ``SchemaTransformation.trim``, and module
    specifiers such as ``@beep/utils`` are the vocabulary the skill teaches; a
    candidate naming them is not task-specific by itself (the step-2 quote is
    caught by the shingle check instead).
    """
    if token.startswith("@") or "/" in token:
        return True
    head = token.split(".", 1)[0]
    if len(head) <= 3 and head[:1].isupper():
        return True
    return head in _LIBRARY_NAMESPACES


def _is_task_specific(token: str) -> bool:
    if token in _GENERIC_METHODS:
        return False
    head = token.split(".", 1)[0]
    has_upper = any(ch.isupper() for ch in head)
    has_lower = any(ch.islower() for ch in head)
    return has_upper and has_lower and not _is_library_vocabulary(token)


def completion_identifiers(completion: dict[str, Any]) -> frozenset[str]:
    """Task-specific identifiers named by a task's completion criteria.

    ``requiredExports`` (names the task itself defines) are always included.
    Regexes in ``requiredPatterns`` and ``forbiddenPatterns`` are de-escaped and
    scanned for identifier-like tokens; only mixed-case names that are not
    library vocabulary are kept (``isCurie``, ``rawText.trim``), so plain words
    (``operation``) and law vocabulary (``S.Class``, ``@beep/utils``) never fire.
    """
    found: set[str] = set()
    for name in completion.get("requiredExports") or []:
        name = str(name).strip()
        if len(name) >= _MIN_IDENT_LEN:
            found.add(name)
    for key in ("requiredPatterns", "forbiddenPatterns"):
        for pattern in completion.get(key) or []:
            text = _REGEX_ESCAPES.sub(" ", str(pattern))
            text = text.replace("\\", "")
            for match in _IDENT.finditer(text):
                token = match.group(0).strip("./-")
                if len(token) < _MIN_IDENT_LEN or token.lower() in _KEYWORDS:
                    continue
                if _is_task_specific(token):
                    found.add(token)
    return frozenset(found)


def load_corpus_tasks(split_dir: str | Path, repo_root: str | Path) -> list[CorpusTask]:
    """Load every task in the train, val, and test splits under ``split_dir``."""
    split_root = Path(split_dir)
    root = Path(repo_root)
    tasks: dict[str, CorpusTask] = {}
    for split in ("train", "val", "test"):
        items_path = split_root / split / "items.json"
        if not items_path.is_file():
            continue
        items = json.loads(items_path.read_text(encoding="utf-8"))
        for item in items if isinstance(items, list) else []:
            task_path_raw = str((item or {}).get("task_path") or "").strip()
            if not task_path_raw:
                continue
            task_path = Path(task_path_raw)
            if not task_path.is_absolute():
                task_path = root / task_path
            manifest = json.loads(task_path.read_text(encoding="utf-8"))
            task_id = str(manifest.get("id") or item.get("id") or task_path.stem)
            tasks[task_id] = CorpusTask(
                task_id=task_id,
                split=split,
                prompt=str(manifest.get("prompt") or ""),
                identifiers=completion_identifiers(manifest.get("completion") or {}),
            )
    return list(tasks.values())


# ---------------------------------------------------------------------------
# Screen
# ---------------------------------------------------------------------------


def _identifier_in(text: str, identifier: str) -> bool:
    pattern = r"(?<![A-Za-z0-9_@/.])" + re.escape(identifier) + r"(?![A-Za-z0-9_])"
    return re.search(pattern, text) is not None


def screen_candidate(
    before: str,
    after: str,
    tasks: Iterable[CorpusTask],
    config: ScreenConfig | None = None,
) -> ScreenVerdict:
    """Screen ``after`` (candidate) against ``before`` (current skill)."""
    config = config or ScreenConfig()
    tasks = list(tasks)
    segments = added_segments(before, after)
    before_chars = len(before)
    after_chars = len(after)
    growth = 0.0 if before_chars == 0 else round((after_chars - before_chars) * 100.0 / before_chars, 2)
    verdict = ScreenVerdict(
        verdict=VERDICT_PASS,
        before_chars=before_chars,
        after_chars=after_chars,
        growth_pct=growth,
        added_words=sum(len(_words(segment)) for segment in segments),
        diff_digest=diff_digest(before, after),
    )
    if not segments:
        return verdict

    # Evaluation-environment fitting.
    for rule in config.env_rules:
        regex = rule.compiled()
        hits = sum(len(regex.findall(segment)) for segment in segments)
        if hits:
            verdict.reasons.append(ScreenReason(ENV_FITTING, rule.rule_id, hits))

    # Task leakage: long shingles shared with a task prompt.
    segment_shingles: set[tuple[str, ...]] = set()
    for segment in segments:
        segment_shingles |= _shingles(_words(segment), config.shingle_k)
    for task in tasks:
        shared = segment_shingles & _shingles(_words(task.prompt), config.shingle_k)
        if shared:
            verdict.reasons.append(
                ScreenReason(TASK_LEAKAGE, f"prompt-shingle-{config.shingle_k}", len(shared), task.task_id)
            )

    # Task leakage: completion-criteria identifiers the current skill never named.
    if config.check_identifiers:
        added_text = "\n".join(segments)
        for task in tasks:
            named = [
                ident
                for ident in sorted(task.identifiers)
                if _identifier_in(added_text, ident) and not _identifier_in(before, ident)
            ]
            if named:
                verdict.reasons.append(
                    ScreenReason(TASK_LEAKAGE, "completion-identifier", len(named), task.task_id)
                )

    if verdict.reasons:
        verdict.verdict = VERDICT_REJECT
    return verdict
