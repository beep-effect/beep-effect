#!/usr/bin/env python3
"""Reproduce the time-to-certainty verification-economics snapshot.

The default mode reads the two committed compact gzip inputs under ../inputs/
after verifying their committed Git blobs and independent byte receipts, then
rewrites economics.json and economics.md with stable ordering and nearest-rank
percentiles. Pass --corpus to validate every replayed corpus file and its
compact facts against the committed ratified baseline before use. Drift fails
closed unless the matching explicit override is supplied.

`--run close` is the P4 close re-run of the same recipe (ruling 8): inputs under
../inputs/close/, outputs economics-close.json and economics-close.md, plus the
inner-lane population, the post-A5 M4 and M5 facts, and the row-by-row
comparison with the ratified baseline. The default run never changes shape.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import datetime as dt
import gzip
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable


SCRIPT = Path(__file__).resolve()
OUTPUT_ROOT = SCRIPT.parent.parent
INPUT_ROOT = OUTPUT_ROOT / "inputs"
REPO_ROOT = SCRIPT.parents[4]


def derive_projects_root(repo_root: Path) -> Path:
    """Return the directory that holds every clone and lane of the fleet (ruling 73).

    A clone sits directly under the projects root; a lane sits one level deeper,
    under `<clone>-worktrees/<lane>`, or three levels deeper, under
    `<clone>/.claude/worktrees/<lane>`.
    """
    parent = repo_root.parent
    if parent.name.endswith("-worktrees"):
        return parent.parent
    if parent.name == "worktrees" and parent.parent.name == ".claude":
        return parent.parent.parent.parent
    return parent


PROJECTS_ROOT = derive_projects_root(REPO_ROOT)
DEFAULT_CORPUS_RELATIVE = (
    Path("explorations")
    / "beep-ci-operational-ontology"
    / "ontology"
    / "extraction"
    / "s4"
    / "beep-ci-ops"
    / "corpus"
    / "run2-fleet"
)
DEFAULT_CORPUS = REPO_ROOT / DEFAULT_CORPUS_RELATIVE
LIVE_SNAPSHOT = INPUT_ROOT / "live-journals.json.gz"
HOSTED_SNAPSHOT = INPUT_ROOT / "hosted-runs.json.gz"
INPUT_RECEIPTS = INPUT_ROOT / "RECEIPTS.json"
ECONOMICS_JSON = OUTPUT_ROOT / "economics.json"
ECONOMICS_MD = OUTPUT_ROOT / "economics.md"

# `--run baseline` (the default) is the ratified P0 snapshot and never changes
# shape; `--run close` is the P4 close re-run of the same recipe (ruling 8), with
# its own inputs under inputs/close/ and its own outputs beside the baseline.
BASELINE_RUN = "baseline"
CLOSE_RUN = "close"
RUN_NAMES = (BASELINE_RUN, CLOSE_RUN)
RUN = BASELINE_RUN
CLOSE_INPUT_DIRECTORY = "close"
CLOSE_JSON_NAME = "economics-close.json"
CLOSE_MD_NAME = "economics-close.md"
CLOSE_TOP_INNER_ROWS = 15

ATTEMPT_SCHEMA = "yeet-attempt-journal/v1"
VERDICT_SCHEMA_V2 = "yeet-verdict/v2"
LIVE_SCHEMA = "verification-economics-live-input/v2"
HOSTED_SCHEMA = "verification-economics-hosted-input/v2"
REPORT_SCHEMA = "verification-economics/v1"
INPUT_RECEIPTS_SCHEMA = "verification-economics-input-receipts/v1"
FROZEN_CAPTURE_AT = "2026-09-03T02:27:19.384Z"
LOCK_SENTENCE = "Another Yeet full proof"
COMPARABLE_MODES = {"verify", "repair", "publish"}
COMPARABLE_EPISODE_CUT_MS = 24 * 60 * 60 * 1000
ARTICLE_P50_MS = 41.3 * 60 * 1000
ARTICLE_P95_MS = 3.1 * 60 * 60 * 1000

# Live ruleset 10240248 at capture time. The hosted snapshot also retains the
# exact fetched set; this constant only supplies stable display ordering.
REQUIRED_CONTEXT_ORDER = [
    "Lint",
    "Heavy / Lint Policy",
    "Heavy / Check",
    "Test Unit",
    "Heavy / Test Integration",
    "Heavy / Docgen",
    "Codegen Drift",
    "Repo Sanity",
    "Heavy / Coverage Regression",
    "Knip",
    "Commitlint",
    "Secret Scanning",
    "Security",
    "SAST",
    "Nix Shell",
    "Professional Desktop IPC Stdio",
    "Heavy / Doctest",
]

HOSTED_CONTEXT_ALIASES = {
    "Lint Policy": "Heavy / Lint Policy",
    "Check": "Heavy / Check",
    "Test Integration": "Heavy / Test Integration",
    "Docgen": "Heavy / Docgen",
    "Coverage Regression": "Heavy / Coverage Regression",
    "Doctest": "Heavy / Doctest",
}

INNER_CONTEXT = {
    "quality:lint": "Lint",
    "quality:lint-policy": "Heavy / Lint Policy",
    "quality:check": "Heavy / Check",
    "quality:test": "Test Unit",  # legacy pre-B1 collector id
    "quality:test-unit": "Test Unit",
    "quality:test-integration": "Heavy / Test Integration",
    "quality:docgen": "Heavy / Docgen",
    "quality:codegen": "Codegen Drift",
    "quality:coverage": "Heavy / Coverage Regression",
    "quality:knip": "Knip",
    "cheap-gates:knip": "Knip",
    "quality:commitlint": "Commitlint",
    "pre-push:secrets": "Secret Scanning",
    "pre-push:security": "Security",
    "pre-push:sast": "SAST",
    "pre-push:nix": "Nix Shell",
    "quality:desktop-ipc": "Professional Desktop IPC Stdio",
    "quality:doctest": "Heavy / Doctest",
}
HOSTED_LIST_CAP = 1000
REPO_SANITY_PREFIX = "repo-sanity:"
EXECUTED_STATUSES = {"passed", "failed"}
REUSED_STATUSES = {"reused"}

ATTEMPT_FACT_FIELDS = ("diffFingerprint", "envProfile", "proofTier", "resolvedHeadSha", "stage")
ATTEMPT_START_FIELDS = (
    "_tag",
    "attemptId",
    "base",
    "branch",
    "head",
    "mode",
    "schemaVersion",
    "startedAt",
    *ATTEMPT_FACT_FIELDS,
)
ATTEMPT_FINISH_FIELDS = ("_tag", "attemptId", "recordedAt", "schemaVersion", *ATTEMPT_FACT_FIELDS)
ATTEMPT_TERMINATION_FIELDS = (
    "_tag",
    "attemptId",
    "reason",
    "recordedAt",
    "schemaVersion",
    *ATTEMPT_FACT_FIELDS,
)
ATTEMPT_TERMINATION_REASONS = frozenset(
    {
        "failure",
        "interrupted",
        "lease-eviction",
        "legacy-unowned-start",
        "owner-dead",
        "queued-submitter-death",
        "signal",
        "stale-unverifiable-owner",
        "success",
        "terminal-row-missing",
        "unrecorded-failure",
        "oom-killed",
        "timeout",
        "job-start-failed",
        "cancelled",
        "finalizer-missing",
    }
)
# Ruling 75: the journal reconciler stamps these reasons at sweep time, so the
# row's `recordedAt` is the sweep, not the attempt's end. Such a row keeps its
# order and stays red, but ends no duration (elapsed and endedAt are unknown).
RECONCILER_TERMINATION_REASONS = frozenset({"legacy-unowned-start", "owner-dead", "stale-unverifiable-owner"})
ATTEMPT_COMPACTION_FIELDS = (
    "_tag",
    "evictedAttemptIds",
    "evictedCount",
    "oldestEvictedRecordedAt",
    "recordedAt",
    "schemaVersion",
    "terminalEvictionCutoffRecordedAt",
)
ATTEMPT_FIELDS_BY_TAG = {
    "attempt-finished": ATTEMPT_FINISH_FIELDS,
    "attempt-started": ATTEMPT_START_FIELDS,
    "attempt-terminated": ATTEMPT_TERMINATION_FIELDS,
    "journal-compacted": ATTEMPT_COMPACTION_FIELDS,
}
VERDICT_FIELDS = (
    "attemptId",
    "base",
    "branch",
    "committed",
    "createdAt",
    "elapsedMs",
    "endedAt",
    "failedStepId",
    "failureKind",
    "head",
    "message",
    "mode",
    "outcome",
    "pushed",
    "schemaVersion",
    "startedAt",
)
LANE_FIELDS = (
    "commandHash",
    "diffFingerprint",
    "durationMs",
    "id",
    "label",
    "parentLaneId",
    "phase",
    "repairCommand",
    "status",
)
# Ruling 74: a lane is inner when it carries `parentLaneId`. A verdict in which
# no lane carries one predates the field; its lanes split by these wrapper
# phase prefixes, and every other lane is inner.
WRAPPER_LANE_PREFIXES = (
    "full:",
    "feedback:",
    "prepare:",
    "publish:",
    "monitor:",
    "closeout:",
    "advisory:",
    "commit:",
)
# The first-failure walk's actionable-lane rule is what the baseline measured
# and stays as it was (brief: "the first-failure walk is unchanged").
ACTIONABLE_WRAPPER_PREFIXES = ("full:", "feedback:", "prepare:", "publish:", "monitor:", "closeout:")
ADMISSION_FIELDS = (
    "_tag",
    "admittedAtMillis",
    "enqueuedAtMillis",
    "kind",
    "nonce",
    "releasedAtMillis",
)
HOSTED_RUN_FIELDS = (
    "attempt",
    "conclusion",
    "createdAt",
    "databaseId",
    "event",
    "headBranch",
    "headSha",
    "status",
    "updatedAt",
)
HOSTED_JOB_FIELDS = ("completedAt", "conclusion", "name", "startedAt")


def portable_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        relative = resolved.relative_to(REPO_ROOT)
    except ValueError:
        return f"<external>/{resolved.name}"
    return relative.as_posix()


def absolute_home_path_pattern() -> re.Pattern[str]:
    home = re.escape(str(Path.home().resolve()))
    return re.compile(
        r"(?<![A-Za-z0-9_./-])(?P<file_url>(?i:file://)[^/\s\"'<>]*)?"
        + home
        + r"(?=$|[/\\\"'\s:),;\]}?#])"
    )


def redact(value: Any) -> Any:
    if isinstance(value, str):
        value = absolute_home_path_pattern().sub(r"\g<file_url>~", value)
        value = re.sub(r"(https?://)[^/@\s]+:[^/@\s]+@", r"\1", value)
        return re.sub(
            r"(?i)([?&](?:access_?token|api_?key|auth|key|secret|signature|token)=)[^&\s]+",
            r"\1<redacted>",
            value,
        )
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, dict):
        return {str(key): redact(item) for key, item in value.items()}
    return value


def canonical_json(value: Any, *, indent: int | None = 2) -> str:
    separators = (",", ":") if indent is None else None
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        indent=indent,
        separators=separators,
        sort_keys=True,
    ) + "\n"


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = canonical_json(redact(value)).encode("utf-8")
    if path.suffix == ".gz":
        with path.open("wb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
                compressed.write(data)
        return
    path.write_bytes(data)


def sha256_12_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


def file_receipt(path: Path, kind: str) -> dict[str, Any]:
    data = path.read_bytes()
    return {
        "bytes": len(data),
        "kind": kind,
        "path": portable_path(path),
        "sha256_12": sha256_12_bytes(data),
    }


def corpus_source_files(corpus_root: Path) -> list[tuple[str, Path]]:
    sources = [
        *(("frozen-attempts", path) for path in corpus_root.glob("attempts/*/*/attempts.ndjson")),
        *(("frozen-verdict", path) for path in corpus_root.glob("verdicts/*/*/verdict.json")),
        *(("frozen-admission", path) for path in corpus_root.glob("admission/*/journal.ndjson")),
    ]
    manifest = corpus_root / "MANIFEST.yaml"
    if manifest.is_file():
        sources.append(("frozen-manifest", manifest))
    return sorted(sources, key=lambda entry: (entry[1].relative_to(corpus_root).as_posix(), entry[0]))


def corpus_file_receipts(corpus_root: Path) -> list[dict[str, Any]]:
    receipts: list[dict[str, Any]] = []
    for kind, path in corpus_source_files(corpus_root):
        data = path.read_bytes()
        receipts.append(
            {
                "bytes": len(data),
                "kind": kind,
                "path": path.relative_to(corpus_root).as_posix(),
                "sha256_12": sha256_12_bytes(data),
            }
        )
    return receipts


def parse_json_file(path: Path) -> Any:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as compressed:
            return json.load(compressed)
    return json.loads(path.read_text(encoding="utf-8"))


def select_fields(value: dict[str, Any], fields: Iterable[str]) -> dict[str, Any]:
    return {field: value[field] for field in fields if field in value}


def compact_lane(lane: dict[str, Any]) -> dict[str, Any]:
    return select_fields(lane, LANE_FIELDS)


def compact_verdict(verdict: dict[str, Any]) -> dict[str, Any]:
    compact = select_fields(verdict, VERDICT_FIELDS)
    if isinstance(verdict.get("lanes"), list):
        compact["lanes"] = [compact_lane(lane) for lane in verdict["lanes"] if isinstance(lane, dict)]
    return compact


def compact_attempt_record(record: dict[str, Any]) -> dict[str, Any]:
    fields = ATTEMPT_FIELDS_BY_TAG.get(record.get("_tag"), ("_tag", "schemaVersion"))
    compact = select_fields(record, fields)
    if record.get("_tag") == "attempt-finished" and isinstance(record.get("verdict"), dict):
        compact["verdict"] = compact_verdict(record["verdict"])
    return compact


def compact_frozen_inputs(corpus_root: Path) -> dict[str, Any]:
    attempts, verdicts, admissions = frozen_payloads(corpus_root)
    return compact_frozen_inputs_from_payloads(attempts, verdicts, admissions)


def compact_frozen_inputs_from_payloads(
    attempts: list[dict[str, Any]],
    verdicts: list[dict[str, Any]],
    admissions: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "admissions": [
            {
                "journal": envelope["journal"],
                "record": select_fields(envelope["record"], ADMISSION_FIELDS),
            }
            for envelope in admissions
        ],
        "attemptSources": [
            {
                "checkout": source["checkout"],
                "records": [compact_attempt_record(record) for record in source["records"]],
                "runId": source["runId"],
                "source": "frozen",
            }
            for source in attempts
        ],
        "verdictSources": [
            {
                "checkout": source["checkout"],
                "document": compact_verdict(source["document"]),
                "runId": source["runId"],
                "source": "frozen",
            }
            for source in verdicts
        ],
    }


def compact_live_snapshot(snapshot: dict[str, Any], corpus_root: Path) -> dict[str, Any]:
    files: list[dict[str, Any]] = []
    for entry in snapshot.get("files", []):
        compact = select_fields(entry, ("checkout", "kind", "runId"))
        if entry.get("kind") == "attempts" and isinstance(entry.get("payload"), list):
            compact["payload"] = [
                compact_attempt_record(record) for record in entry["payload"] if isinstance(record, dict)
            ]
        elif entry.get("kind") == "verdict" and isinstance(entry.get("payload"), dict):
            compact["payload"] = compact_verdict(entry["payload"])
        elif entry.get("kind") == "state" and isinstance(entry.get("payload"), dict):
            state = entry["payload"]
            compact["payload"] = select_fields(state, ("diffFingerprint", "schemaVersion"))
            if isinstance(state.get("laneProofs"), list):
                compact["payload"]["laneProofs"] = [{} for _ in state["laneProofs"]]
        elif entry.get("kind") == "rss":
            compact["peakRssKb"] = entry.get("peakRssKb")
        files.append(compact)
    return {
        "capturedAt": snapshot.get("capturedAt"),
        "files": files,
        "frozen": compact_frozen_inputs(corpus_root),
        "frozenCaptureAt": FROZEN_CAPTURE_AT,
        "schemaVersion": LIVE_SCHEMA,
    }


def compact_hosted_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    runs: list[dict[str, Any]] = []
    for run in snapshot.get("runs", []):
        compact = select_fields(run, HOSTED_RUN_FIELDS)
        compact["jobs"] = [
            select_fields(job, HOSTED_JOB_FIELDS) for job in run.get("jobs", []) if isinstance(job, dict)
        ]
        runs.append(compact)
    return {
        "capturedAt": snapshot.get("capturedAt"),
        "cutoffDateUtc": snapshot.get("cutoffDateUtc"),
        "requiredContexts": snapshot.get("requiredContexts"),
        "runs": runs,
        "schemaVersion": HOSTED_SCHEMA,
    }


def parse_ndjson_bytes(data: bytes, label: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, raw in enumerate(data.splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            row = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"invalid NDJSON in {label} line {line_number}: {exc}") from exc
        if not isinstance(row, dict):
            raise SystemExit(f"non-object NDJSON row in {label} line {line_number}")
        rows.append(row)
    return rows


def parse_ts(value: Any) -> dt.datetime | None:
    if not isinstance(value, str) or not value:
        return None
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = dt.datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(dt.timezone.utc)


def format_ts(value: dt.datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def nearest_rank(values: Iterable[float], percentile: float) -> float | None:
    ordered = sorted(float(value) for value in values)
    if not ordered:
        return None
    index = max(0, min(len(ordered) - 1, math.ceil(percentile / 100 * len(ordered)) - 1))
    return ordered[index]


def rounded_ms(value: float | None) -> int | None:
    return None if value is None else int(round(value))


def ratio(numerator: float, denominator: float) -> float | None:
    return None if denominator == 0 else round(numerator / denominator, 6)


def pct_value(numerator: float, denominator: float) -> float | None:
    value = ratio(numerator, denominator)
    return None if value is None else round(value * 100, 2)


def fmt_ms(value: float | int | None) -> str:
    if value is None:
        return "n/a"
    number = float(value)
    if number >= 3_600_000:
        return f"{number / 3_600_000:.2f}h"
    if number >= 60_000:
        return f"{number / 60_000:.1f}m"
    if number >= 1_000:
        return f"{number / 1_000:.1f}s"
    return f"{number:.0f}ms"


def markdown_escape(value: Any) -> str:
    if value is None:
        return "n/a"
    return str(value).replace("|", "\\|").replace("\n", " ")


# Rendered into both reports, so the wording is frozen: changing it would move a
# baseline value, not only the script receipt. The last line's origin check
# applies to every candidate, the repository root included (read from each
# checkout's Git common dir); `discover_live_roots` documents the behaviour.
LIVE_DISCOVERY_RULE = (
    "repository root",
    "projects-root directories named beep-effect* with .beep/yeet/runs",
    "lanes under beep-effect*-worktrees/* with .beep/yeet/runs",
    "lanes under beep-effect*/.claude/worktrees/* with .beep/yeet/runs",
    "symlinked candidates skipped",
    "candidates whose owning clone's origin is not beep-effect/beep-effect skipped",
)
FLEET_REPOSITORY = "beep-effect/beep-effect"


def git_common_dir(root: Path) -> Path | None:
    """Resolve a checkout's Git common dir, as `git rev-parse --git-common-dir` would.

    A `.git` directory is its own common dir (a primary clone), returned as
    `<checkout>/.git` even when `.git` is a symlink to a directory with another
    name: like Git, it names the checkout itself, never the symlink target, so
    `owning_clone` still answers the checkout.

    A `.git` file names the checkout's gitdir; the gitdir's `commondir` file (a
    linked lane) points at the common dir, and without one the gitdir is the
    common dir (a `--separate-git-dir` checkout or a bare repository's worktree).
    The common dir may sit anywhere and carry any name, such as
    `/x/beep-effect.git`.
    A lane whose `.git` file is already gone (a half-removed worktree that still
    holds journals) falls back to the fleet layout: `<clone>-worktrees/<lane>`
    and `<clone>/.claude/worktrees/<lane>` name their clone, whose `.git`
    directory (symlinked or not) is the common dir, as `<clone>/.git`. Returns None when neither Git metadata nor the
    layout names one, or when a `.git` file cannot be read or has no `gitdir:`.
    """
    marker = root / ".git"
    if marker.is_dir():
        return root.resolve() / ".git"
    if not marker.is_file():
        parent = root.parent
        if parent.name.endswith("-worktrees"):
            clone = parent.parent / parent.name[: -len("-worktrees")]
        elif parent.name == "worktrees" and parent.parent.name == ".claude":
            clone = parent.parent.parent
        else:
            return None
        return clone.resolve() / ".git" if (clone / ".git").is_dir() else None
    try:
        text = marker.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeDecodeError):
        return None
    if not text.startswith("gitdir:"):
        return None
    gitdir = (root / text[len("gitdir:"):].strip()).resolve()
    commondir_file = gitdir / "commondir"
    if not commondir_file.is_file():
        return gitdir
    try:
        return (gitdir / commondir_file.read_text(encoding="utf-8").strip()).resolve()
    except (OSError, UnicodeDecodeError):
        return None


def owning_clone(root: Path) -> Path | None:
    """Return the clone that owns a checkout, by the TypeScript resolver's rule (ruling 71).

    The clone is the common dir's parent when the common dir is named `.git`
    (`<clone>/.git`, for a primary clone and its linked lanes), and the common
    dir itself otherwise (a bare or separated common dir such as
    `/x/beep-effect.git`). Returns None when `git_common_dir` finds none.
    """
    common = git_common_dir(root)
    if common is None:
        return None
    return common.parent if common.name == ".git" else common


def origin_repository(root: Path) -> str | None:
    """Return `owner/repo` for the `remote "origin"` url in `<commonDir>/config`, else None.

    The config is read from the common dir itself, never `<clone>/.git/config`,
    so a checkout whose common dir is bare or separated is judged by its own
    repository's origin instead of being dropped for a missing file. A `.git`
    symlink is followed to its real path for the read.
    """
    common = git_common_dir(root)
    if common is None:
        return None
    try:
        lines = (common.resolve() / "config").read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return None
    in_origin = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("["):
            in_origin = re.fullmatch(r'\[remote\s+"origin"\]', stripped) is not None
            continue
        key, _, value = stripped.partition("=")
        if in_origin and key.strip() == "url":
            match = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?/?$", value.strip())
            return None if match is None else f"{match.group(1)}/{match.group(2)}"
    return None


def discover_live_roots(projects_root: Path | None = None) -> list[Path]:
    """Return every fleet checkout with a Yeet run journal (ruling 73).

    The fleet is the directories named `beep-effect*` under the projects root,
    the lanes under `beep-effect-worktrees/*` and every numbered
    `beep-effect<N>-worktrees/*`, and the lanes under each clone's
    `.claude/worktrees/*`. The repository root is always a candidate, so a run
    from a lane still reads its own journals. Every candidate, the repository
    root included, is kept only when its origin (read from its Git common dir)
    is `beep-effect/beep-effect`: a private duplicate such as
    `beep-effect-private` matches the name glob but is another repository, and
    its journals never enter this public repository's inputs, even when the
    capture runs from a checkout of that duplicate. A repository root that holds
    journals but fails the check is skipped like any other candidate, with one
    stderr line naming the skip so the capture never drops its own journals
    silently. The recorded discovery rule's first line, "repository root",
    names the root as a candidate; its last line's origin check covers it too.
    """
    root = PROJECTS_ROOT if projects_root is None else projects_root

    def by_name(paths: Iterable[Path]) -> list[Path]:
        """Existing directories among `paths`, sorted by POSIX path."""
        return sorted((path for path in paths if path.is_dir()), key=lambda path: path.as_posix())

    candidates = [REPO_ROOT]
    candidates.extend(by_name(root.glob("beep-effect*")))
    candidates.extend(by_name(root.glob("beep-effect*-worktrees/*")))
    candidates.extend(by_name(root.glob("beep-effect*/.claude/worktrees/*")))
    roots: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        is_repo_root = candidate == REPO_ROOT
        if not is_repo_root and candidate.is_symlink():
            continue
        resolved = candidate.resolve()
        if resolved in seen or not (resolved / ".beep" / "yeet" / "runs").is_dir():
            continue
        # Judged once: the repository root also matches a glob, and its verdict never changes.
        seen.add(resolved)
        origin = origin_repository(resolved)
        if origin != FLEET_REPOSITORY:
            if is_repo_root:
                print(
                    f"live discovery: skipped the repository root {checkout_label(resolved)}: "
                    f"its origin is {origin or 'unknown'}, not {FLEET_REPOSITORY}",
                    file=sys.stderr,
                )
            continue
        roots.append(resolved)
    return sorted(roots, key=checkout_label)


def checkout_label(root: Path) -> str:
    try:
        return root.resolve().relative_to(PROJECTS_ROOT.resolve()).as_posix()
    except ValueError:
        return root.name


def capture_live(corpus_root: Path) -> None:
    """Capture every discovered fleet checkout's Yeet journals as the compact live input.

    For each root `discover_live_roots` returns (ruling 73), reads every run's
    `attempts.ndjson`, `verdict.json` and `state.json` plus the peak-RSS files,
    redacts them, records the discovery rule, and writes `LIVE_SNAPSHOT` compacted
    against the run2 fleet corpus. Fails when the corpus directory is missing.
    """
    roots = discover_live_roots()
    files: list[dict[str, Any]] = []
    captured_at = dt.datetime.now(dt.timezone.utc)
    for root in roots:
        checkout = checkout_label(root)
        runs_root = root / ".beep" / "yeet" / "runs"
        for run_dir in sorted((path for path in runs_root.iterdir() if path.is_dir()), key=lambda path: path.name):
            run_id = run_dir.name
            for name, kind in (
                ("attempts.ndjson", "attempts"),
                ("verdict.json", "verdict"),
                ("state.json", "state"),
            ):
                source = run_dir / name
                if not source.is_file():
                    continue
                data = source.read_bytes()
                entry: dict[str, Any] = {
                    "bytes": len(data),
                    "checkout": checkout,
                    "kind": kind,
                    "path": portable_path(source),
                    "runId": run_id,
                    "sha256_12": sha256_12_bytes(data),
                }
                try:
                    entry["payload"] = (
                        parse_ndjson_bytes(data, portable_path(source))
                        if kind == "attempts"
                        else json.loads(data)
                    )
                except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                    entry["decodeError"] = type(exc).__name__
                files.append(redact(entry))

        rss_root = root / ".beep" / "yeet" / "rss"
        if rss_root.is_dir():
            for source in sorted((path for path in rss_root.iterdir() if path.is_file()), key=lambda path: path.name):
                data = source.read_bytes()
                text = data.decode("utf-8", errors="replace").strip()
                match = re.search(r"(?:^|\n)([0-9]+)\s*$", text)
                files.append(
                    {
                        "bytes": len(data),
                        "checkout": checkout,
                        "kind": "rss",
                        "path": portable_path(source),
                        "peakRssKb": int(match.group(1)) if match else None,
                        "sha256_12": sha256_12_bytes(data),
                    }
                )

    snapshot = {
        "capturedAt": format_ts(captured_at),
        "discoveryRule": list(LIVE_DISCOVERY_RULE),
        "files": sorted(files, key=lambda entry: (entry["path"], entry["kind"])),
        "roots": [portable_path(root) for root in roots],
        "schemaVersion": LIVE_SCHEMA,
    }
    if not corpus_root.is_dir():
        raise SystemExit("cannot capture live input without a run2 fleet corpus; pass --corpus <dir>")
    write_json(LIVE_SNAPSHOT, compact_live_snapshot(snapshot, corpus_root))
    print(f"captured {len(files)} live files from {len(roots)} roots -> {portable_path(LIVE_SNAPSHOT)}")


def run_command(args: list[str], *, attempts: int = 1) -> str:
    last_error = ""
    for index in range(attempts):
        completed = subprocess.run(args, cwd=REPO_ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if completed.returncode == 0:
            return completed.stdout
        last_error = completed.stderr.strip() or f"exit {completed.returncode}"
        if index + 1 < attempts:
            time.sleep(1 + index)
    raise RuntimeError(f"command failed: {' '.join(args[:4])}: {last_error}")


def capture_hosted() -> None:
    """Capture the last 14 UTC dates of hosted `Check` runs as the compact hosted input.

    Lists runs one UTC date at a time and fails closed when a date reaches the
    API cap, keeps pull-request runs and pushes to `main`, fetches each kept run
    with its jobs, and records the required contexts of ruleset 10240248.
    """
    captured_at = dt.datetime.now(dt.timezone.utc)
    cutoff_date = (captured_at - dt.timedelta(days=14)).date().isoformat()
    list_fields = (
        "databaseId,workflowName,displayTitle,event,status,conclusion,createdAt,updatedAt,"
        "headBranch,headSha,url,attempt"
    )
    # GitHub answers a `created` query with at most 1,000 runs, silently, so a
    # single `>=cutoff` query drops the oldest days of a busy window. List one
    # UTC date at a time and fail closed if any single date reaches the cap.
    summaries_by_id: dict[Any, dict[str, Any]] = {}
    day = dt.date.fromisoformat(cutoff_date)
    while day <= captured_at.date():
        list_command = [
            "gh",
            "run",
            "list",
            "--workflow",
            "Check",
            "--created",
            day.isoformat(),
            "--limit",
            str(HOSTED_LIST_CAP),
            "--json",
            list_fields,
        ]
        page = json.loads(run_command(list_command, attempts=3))
        if not isinstance(page, list):
            raise SystemExit("gh run list returned a non-array payload")
        if len(page) >= HOSTED_LIST_CAP:
            raise SystemExit(f"hosted run capture reached the {HOSTED_LIST_CAP}-run API cap on {day.isoformat()}")
        for row in page:
            if isinstance(row, dict):
                summaries_by_id[row.get("databaseId")] = row
        day += dt.timedelta(days=1)
    summaries = list(summaries_by_id.values())
    selected = [
        row
        for row in summaries
        if isinstance(row, dict)
        and (row.get("event") == "pull_request" or (row.get("event") == "push" and row.get("headBranch") == "main"))
    ]

    view_fields = (
        "databaseId,workflowName,displayTitle,event,status,conclusion,createdAt,updatedAt,"
        "headBranch,headSha,url,attempt,jobs"
    )

    def fetch(summary: dict[str, Any]) -> dict[str, Any]:
        run_id = str(summary["databaseId"])
        command = ["gh", "run", "view", run_id, "--json", view_fields]
        return json.loads(run_command(command, attempts=3))

    runs: list[dict[str, Any]] = []
    workers = min(12, max(1, len(selected)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        future_by_id = {executor.submit(fetch, summary): summary["databaseId"] for summary in selected}
        for index, future in enumerate(concurrent.futures.as_completed(future_by_id), start=1):
            runs.append(redact(future.result()))
            if index % 50 == 0 or index == len(selected):
                print(f"hosted capture: {index}/{len(selected)} runs", file=sys.stderr, flush=True)

    ruleset = json.loads(run_command(["gh", "api", "repos/beep-effect/beep-effect/rulesets/10240248"], attempts=3))
    required: list[str] = []
    for rule in ruleset.get("rules", []):
        if rule.get("type") != "required_status_checks":
            continue
        required.extend(
            check.get("context")
            for check in rule.get("parameters", {}).get("required_status_checks", [])
            if isinstance(check, dict) and isinstance(check.get("context"), str)
        )
    snapshot = {
        "captureCommands": [
            "gh run list --workflow Check --created YYYY-MM-DD --limit 1000 --json <run fields> (one query per UTC date)",
            "gh run view <run-id> --json <run fields>,jobs",
            "gh api repos/beep-effect/beep-effect/rulesets/10240248",
        ],
        "capturedAt": format_ts(captured_at),
        "cutoffDateUtc": cutoff_date,
        "repository": "beep-effect/beep-effect",
        "requiredContexts": required,
        "ruleset": {
            "enforcement": ruleset.get("enforcement"),
            "id": ruleset.get("id"),
            "name": ruleset.get("name"),
        },
        "runs": sorted(runs, key=lambda row: (row.get("createdAt") or "", row.get("databaseId") or 0)),
        "schemaVersion": HOSTED_SCHEMA,
        "workflow": "Check",
    }
    write_json(HOSTED_SNAPSHOT, compact_hosted_snapshot(snapshot))
    print(f"captured {len(runs)} hosted Check runs -> {portable_path(HOSTED_SNAPSHOT)}")


def frozen_payloads(corpus_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    attempt_sources: list[dict[str, Any]] = []
    verdict_sources: list[dict[str, Any]] = []
    admissions: list[dict[str, Any]] = []
    for kind, source in corpus_source_files(corpus_root):
        relative = source.relative_to(corpus_root).parts
        if kind == "frozen-attempts":
            attempt_sources.append(
                {
                    "checkout": relative[1],
                    "path": f"frozen/attempts/{relative[1]}/{relative[2]}",
                    "records": parse_ndjson_bytes(source.read_bytes(), portable_path(source)),
                    "runId": relative[2],
                    "source": "frozen",
                }
            )
        elif kind == "frozen-verdict":
            verdict_sources.append(
                {
                    "checkout": relative[1],
                    "document": parse_json_file(source),
                    "path": f"frozen/verdicts/{relative[1]}/{relative[2]}",
                    "runId": relative[2],
                    "source": "frozen",
                }
            )
        elif kind == "frozen-admission":
            label = source.parent.name
            for record in parse_ndjson_bytes(source.read_bytes(), portable_path(source)):
                admissions.append({"journal": label, "record": record})
    return attempt_sources, verdict_sources, admissions


def live_payloads(
    snapshot: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    attempts: list[dict[str, Any]] = []
    verdicts: list[dict[str, Any]] = []
    states: list[dict[str, Any]] = []
    rss: list[dict[str, Any]] = []
    for index, entry in enumerate(snapshot.get("files", [])):
        base = {
            "checkout": entry.get("checkout"),
            "path": f"captured/{entry.get('checkout')}/{entry.get('runId')}/{entry.get('kind')}/{index}",
            "runId": entry.get("runId"),
            "source": "live",
        }
        if entry.get("kind") == "attempts" and isinstance(entry.get("payload"), list):
            attempts.append({**base, "records": entry["payload"]})
        elif entry.get("kind") == "verdict" and isinstance(entry.get("payload"), dict):
            verdicts.append({**base, "document": entry["payload"]})
        elif entry.get("kind") == "state" and isinstance(entry.get("payload"), dict):
            states.append({**base, "document": entry["payload"]})
        elif entry.get("kind") == "rss":
            rss.append({**base, "peakRssKb": entry.get("peakRssKb")})
    return attempts, verdicts, states, rss


def attempt_key(checkout: str, run_id: str, attempt_id: str) -> tuple[str, str, str]:
    return checkout, run_id, attempt_id


def load_attempts(
    sources: list[dict[str, Any]], verdict_sources: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Join journaled starts, terminal rows and verdict files into one row per finished attempt.

    A duplicate row keeps the live copy; a verdict file without a journaled
    terminal row is added as an orphan finish; a compaction receipt sets its
    journal's left-censor cutoff. A reconciler-stamped termination keeps its start
    but has no end and no elapsed time; a termination the attempt wrote itself
    falls back to `endedAt - startedAt`. Returns the attempts in start order and
    the loader diagnostics.
    """
    starts: dict[tuple[str, str, str], dict[str, Any]] = {}
    finishes: dict[tuple[str, str, str], dict[str, Any]] = {}
    duplicate_starts = 0
    duplicate_finishes = 0
    invalid_rows = 0
    compaction_receipts = 0
    journal_cutoffs: dict[tuple[str, str], dt.datetime] = {}
    for source in sources:
        checkout = str(source["checkout"])
        run_id = str(source["runId"])
        for record in source["records"]:
            if record.get("schemaVersion") != ATTEMPT_SCHEMA:
                invalid_rows += 1
                continue
            if record.get("_tag") == "journal-compacted":
                compaction_receipts += 1
                cutoff = parse_ts(
                    record.get("terminalEvictionCutoffRecordedAt") or record.get("oldestEvictedRecordedAt")
                )
                journal_key = (checkout, run_id)
                if cutoff is not None and (journal_key not in journal_cutoffs or cutoff > journal_cutoffs[journal_key]):
                    journal_cutoffs[journal_key] = cutoff
                continue
            if not isinstance(record.get("attemptId"), str):
                invalid_rows += 1
                continue
            key = attempt_key(checkout, run_id, record["attemptId"])
            envelope = {"record": record, "source": source["source"], "sourcePath": source["path"]}
            if record.get("_tag") == "attempt-started":
                duplicate_starts += int(key in starts)
                if key not in starts or source["source"] == "live":
                    starts[key] = envelope
            elif record.get("_tag") == "attempt-finished" and isinstance(record.get("verdict"), dict):
                duplicate_finishes += int(key in finishes)
                if key not in finishes or source["source"] == "live":
                    finishes[key] = envelope
            elif (
                record.get("_tag") == "attempt-terminated"
                and isinstance(record.get("reason"), str)
                and record.get("reason") in ATTEMPT_TERMINATION_REASONS
            ):
                duplicate_finishes += int(key in finishes)
                if key not in finishes or source["source"] == "live":
                    finishes[key] = envelope
            else:
                invalid_rows += 1

    orphan_verdicts_added = 0
    unkeyed_verdict_files = 0
    for source in verdict_sources:
        verdict = source["document"]
        attempt_id = verdict.get("attemptId")
        if not isinstance(attempt_id, str):
            unkeyed_verdict_files += 1
            continue
        key = attempt_key(str(source["checkout"]), str(source["runId"]), attempt_id)
        if key in finishes:
            continue
        finishes[key] = {
            "record": {
                "_tag": "attempt-finished",
                "attemptId": attempt_id,
                "recordedAt": verdict.get("endedAt") or verdict.get("createdAt"),
                "schemaVersion": ATTEMPT_SCHEMA,
                "verdict": verdict,
            },
            "source": source["source"] + "-orphan-verdict",
            "sourcePath": source["path"],
        }
        orphan_verdicts_added += 1

    attempts: list[dict[str, Any]] = []
    for key, envelope in finishes.items():
        record = envelope["record"]
        verdict = record.get("verdict") if isinstance(record.get("verdict"), dict) else {}
        start_record = starts.get(key, {}).get("record", {})
        started_at = parse_ts(verdict.get("startedAt") or start_record.get("startedAt"))
        swept = record.get("_tag") == "attempt-terminated" and record.get("reason") in RECONCILER_TERMINATION_REASONS
        ended_at = (
            None
            if swept
            else parse_ts(verdict.get("endedAt") or verdict.get("createdAt") or record.get("recordedAt"))
        )
        elapsed = verdict.get("elapsedMs")
        if not isinstance(elapsed, (int, float)) and started_at is not None and ended_at is not None:
            elapsed = (ended_at - started_at).total_seconds() * 1000
        attempts.append(
            {
                "attemptId": key[2],
                "base": verdict.get("base") or start_record.get("base"),
                "branch": verdict.get("branch") or start_record.get("branch") or key[1],
                "checkout": key[0],
                "committed": verdict.get("committed"),
                "diffFingerprint": record.get("diffFingerprint") or start_record.get("diffFingerprint"),
                "elapsedMs": float(elapsed) if isinstance(elapsed, (int, float)) else None,
                "endedAt": ended_at,
                "envProfile": record.get("envProfile") or start_record.get("envProfile"),
                "failedStepId": verdict.get("failedStepId"),
                "failureKind": verdict.get("failureKind"),
                "head": verdict.get("head") or start_record.get("head"),
                "key": key,
                "leftCensorCutoff": journal_cutoffs.get((key[0], key[1])),
                "lanes": verdict.get("lanes") if isinstance(verdict.get("lanes"), list) else [],
                "message": verdict.get("message") or "",
                "mode": verdict.get("mode") or start_record.get("mode"),
                "outcome": verdict.get("outcome"),
                "proofTier": record.get("proofTier") or start_record.get("proofTier"),
                "pushed": verdict.get("pushed"),
                "resolvedHeadSha": record.get("resolvedHeadSha") or start_record.get("resolvedHeadSha"),
                "runId": key[1],
                "schemaVersion": verdict.get("schemaVersion"),
                "source": envelope["source"],
                "startedAt": started_at,
                "stage": record.get("stage") or start_record.get("stage"),
                "terminationReason": record.get("reason"),
            }
        )
    attempts.sort(
        key=lambda row: (
            row["startedAt"] or row["endedAt"] or dt.datetime.min.replace(tzinfo=dt.timezone.utc),
            row["checkout"],
            row["runId"],
            row["attemptId"],
        )
    )
    diagnostics = {
        "compactionReceipts": compaction_receipts,
        "duplicateFinishedRowsDeduplicated": duplicate_finishes,
        "duplicateStartedRowsDeduplicated": duplicate_starts,
        "finishedAttempts": len(attempts),
        "invalidRows": invalid_rows,
        "leftCensoredJournals": len(journal_cutoffs),
        "orphanVerdictFilesAdded": orphan_verdicts_added,
        "starts": len(starts),
        "startsWithoutFinish": len(set(starts) - set(finishes)),
        "unkeyedVerdictFiles": unkeyed_verdict_files,
        "verdictsWithoutStart": len(set(finishes) - set(starts)),
    }
    return attempts, diagnostics


def ring_buffer_quality(
    frozen_sources: list[dict[str, Any]], live_sources: list[dict[str, Any]]
) -> dict[str, Any]:
    def ids_by_journal(sources: list[dict[str, Any]]) -> dict[tuple[str, str], set[str]]:
        result: dict[tuple[str, str], set[str]] = collections.defaultdict(set)
        for source in sources:
            journal = (str(source["checkout"]), str(source["runId"]))
            for record in source["records"]:
                if record.get("_tag") == "attempt-started" and isinstance(record.get("attemptId"), str):
                    result[journal].add(record["attemptId"])
        return result

    frozen = ids_by_journal(frozen_sources)
    live = ids_by_journal(live_sources)
    current = dict(frozen)
    current.update(live)
    capped = sum(1 for ids in current.values() if len(ids) >= 50)
    observed_evicted = 0
    comparable_journals = 0
    for journal in sorted(set(frozen) & set(live)):
        comparable_journals += 1
        observed_evicted += len(frozen[journal] - live[journal])
    return {
        "capAttemptsPerBranchJournal": 50,
        "exactLifetimeEvictionsMeasurable": False,
        "journalsAtCap": capped,
        "journalsComparedAcrossFrozenAndLive": comparable_journals,
        "journalsObserved": len(current),
        "observedEvictedAttemptIdsSinceFrozenCapture": observed_evicted,
        "unknownHistoricalEvictionsLowerBound": observed_evicted,
    }


def split_lanes(lanes: list[Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split one verdict's lanes into (wrapper, inner) populations (ruling 74).

    A verdict in which any lane carries `parentLaneId` marks its inner lanes
    explicitly; a lane without one is a wrapper. A verdict written before that
    field splits by `WRAPPER_LANE_PREFIXES`.
    """
    rows = [lane for lane in lanes if isinstance(lane, dict)]
    marks_parents = any(isinstance(lane.get("parentLaneId"), str) for lane in rows)
    wrappers: list[dict[str, Any]] = []
    inner: list[dict[str, Any]] = []
    for lane in rows:
        is_inner = (
            isinstance(lane.get("parentLaneId"), str)
            if marks_parents
            else not str(lane.get("id") or "").startswith(WRAPPER_LANE_PREFIXES)
        )
        (inner if is_inner else wrappers).append(lane)
    return wrappers, inner


def wrapper_lanes(attempt: dict[str, Any]) -> list[dict[str, Any]]:
    """The attempt's wrapper lanes: the population the baseline lane rows count (ruling 74)."""
    return split_lanes(attempt["lanes"])[0]


def inner_lanes(attempt: dict[str, Any]) -> list[dict[str, Any]]:
    """The attempt's inner lanes: a separate population, never added to its wrappers (ruling 74)."""
    return split_lanes(attempt["lanes"])[1]


def timed_lane_duration(lane: dict[str, Any]) -> float | None:
    """A lane's `durationMs` as a float, or None when it is absent, non-numeric or negative."""
    duration = lane.get("durationMs")
    if not isinstance(duration, (int, float)) or duration < 0:
        return None
    return float(duration)


def lane_metrics(attempts: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Wrapper-lane rows and totals: the baseline's row shape and semantics.

    Only wrapper lanes are counted (ruling 74), so a post-A5 verdict's inner
    lanes are no longer summed a second time inside their wrapper; the accounted
    percentage keeps the baseline denominator, every attempt's elapsed time.
    """
    return population_lane_metrics(attempts, wrapper_lanes, denominator="all-attempts")


def inner_lane_metrics(attempts: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Inner-lane rows and totals: a separate population with its own denominator.

    Shares are within the inner population; the accounted percentage divides by
    the elapsed time of the attempts that contributed at least one timed inner lane.
    """
    return population_lane_metrics(attempts, inner_lanes, denominator="contributing-attempts")


def population_lane_metrics(
    attempts: list[dict[str, Any]],
    population: Any,
    *,
    denominator: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Per-lane rows and totals for one lane population (ruling 74).

    `population` picks an attempt's lanes (`wrapper_lanes` or `inner_lanes`).
    Each row carries nearest-rank P50/P95 durations, the status mix, and its share
    of the population's timed total. `denominator` picks the accounted
    percentage's divisor: "all-attempts" divides by every attempt's elapsed time
    (the baseline shape); any other value divides by the elapsed time of the
    attempts that contributed at least one timed lane.
    """
    by_lane: dict[tuple[str, str, str], list[tuple[dict[str, Any], float]]] = collections.defaultdict(list)
    all_durations: list[float] = []
    lanes_by_attempt: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    contributing: dict[tuple[str, str, str], dict[str, Any]] = {}
    for attempt in attempts:
        lanes = population(attempt)
        lanes_by_attempt[attempt["key"]] = lanes
        for lane in lanes:
            duration = timed_lane_duration(lane)
            if duration is None:
                continue
            key = (str(lane.get("id")), str(lane.get("label")), str(lane.get("phase")))
            by_lane[key].append((attempt, duration))
            all_durations.append(duration)
            contributing[attempt["key"]] = attempt
    total = sum(all_durations)
    rows: list[dict[str, Any]] = []
    for (lane_id, label, phase), observations in by_lane.items():
        durations = [duration for _, duration in observations]
        status_counts = collections.Counter(
            str(lane.get("status"))
            for attempt, _ in observations
            for lane in lanes_by_attempt[attempt["key"]]
            if lane.get("id") == lane_id and lane.get("durationMs") is not None
        )
        rows.append(
            {
                "attempts": len({attempt["key"] for attempt, _ in observations}),
                "executions": len(durations),
                "id": lane_id,
                "label": label,
                "p50DurationMs": rounded_ms(nearest_rank(durations, 50)),
                "p95DurationMs": rounded_ms(nearest_rank(durations, 95)),
                "phase": phase,
                "shareOfMeasuredLocalLaneTimePct": pct_value(sum(durations), total),
                "statusMix": dict(sorted(status_counts.items())),
                "totalDurationMs": rounded_ms(sum(durations)),
            }
        )
    rows.sort(key=lambda row: (-row["totalDurationMs"], row["id"], row["label"]))
    if denominator == "all-attempts":
        total_attempt_elapsed = sum(attempt["elapsedMs"] or 0 for attempt in attempts)
        return rows, {
            "accountedLaneTimeAsPctOfAttemptElapsed": pct_value(total, total_attempt_elapsed),
            "measuredLaneExecutions": len(all_durations),
            "totalAttemptElapsedMs": rounded_ms(total_attempt_elapsed),
            "totalMeasuredLaneDurationMs": rounded_ms(total),
        }
    contributing_elapsed = sum(attempt["elapsedMs"] or 0 for attempt in contributing.values())
    return rows, {
        "accountedLaneTimeAsPctOfAttemptElapsed": pct_value(total, contributing_elapsed),
        "contributingAttempts": len(contributing),
        "denominator": "elapsed time of the attempts with at least one timed inner lane",
        "measuredLaneExecutions": len(all_durations),
        "totalAttemptElapsedMs": rounded_ms(contributing_elapsed),
        "totalMeasuredLaneDurationMs": rounded_ms(total),
    }


def classify_receipt_proxy(attempt: dict[str, Any]) -> str:
    repairs = " ".join(
        str(lane.get("repairCommand") or "") for lane in attempt["lanes"] if isinstance(lane, dict)
    )
    text = f"{attempt['message']} {repairs} {attempt.get('failedStepId') or ''}".lower()
    if LOCK_SENTENCE.lower() in text:
        return "scheduler-lock-bounce"
    if re.search(r"ts2589|excessively deep", text):
        return "native-compiler-flake"
    if re.search(r"ts2307|ts6305|node_modules|generated projection|goals[/ ]index|determinism", text):
        return "stale-workspace-or-projection"
    if re.search(r"origin/main.*advanced|stale[- ]base|behind.*base|base freshness", text):
        return "base-churn"
    if re.search(r"admission|scheduler|coordinator|proof.*active|queued", text):
        return "scheduler-or-submitter"
    if re.search(r"broken-tracked-path|semantic[- ]delta", text):
        return "semantic-delta-path"
    return "unclassified"


def actionable_lane(attempt: dict[str, Any]) -> str:
    """The baseline's actionable lane: the first failed lane outside the legacy
    wrapper prefixes, else `failedStepId`, else the first failed lane, else
    `unlocated`."""
    failed = [lane for lane in attempt["lanes"] if lane.get("status") == "failed"]
    granular = next(
        (lane for lane in failed if not str(lane.get("id", "")).startswith(ACTIONABLE_WRAPPER_PREFIXES)),
        None,
    )
    if granular is not None:
        return str(granular.get("id"))
    return str(attempt.get("failedStepId") or (failed[0].get("id") if failed else "unlocated"))


def first_failure_metrics(attempts: list[dict[str, Any]]) -> dict[str, Any]:
    """M2: how far into a red attempt its first failure becomes known.

    Walks each red attempt's lanes in verdict order, summing prior
    duration-bearing lanes, and stops at the first failed lane with a duration.
    Post-A5 verdicts list inner lanes after their wrapper, so the walk still stops
    at the failed wrapper. Reports nearest-rank P50/P95 start and completion
    offsets, plus the actionable-lane and receipt-proxy mixes over every red
    attempt.
    """
    observations: list[dict[str, Any]] = []
    actionable_counts: collections.Counter[str] = collections.Counter()
    proxy_counts: collections.Counter[str] = collections.Counter()
    red_attempts = [attempt for attempt in attempts if attempt.get("outcome") != "success"]
    for attempt in red_attempts:
        proxy_counts[classify_receipt_proxy(attempt)] += 1
        actionable = actionable_lane(attempt)
        actionable_counts[actionable] += 1
        first_outer: dict[str, Any] | None = None
        offset = 0.0
        for lane in attempt["lanes"]:
            duration = lane.get("durationMs")
            if lane.get("status") == "failed" and isinstance(duration, (int, float)):
                first_outer = lane
                break
            if isinstance(duration, (int, float)) and duration >= 0:
                offset += float(duration)
        if first_outer is not None:
            duration = float(first_outer["durationMs"])
            observations.append(
                {
                    "actionableLane": actionable,
                    "attemptKey": attempt["key"],
                    "completionOffsetMs": offset + duration,
                    "outerLane": first_outer.get("id"),
                    "startOffsetMs": offset,
                }
            )
    starts = [row["startOffsetMs"] for row in observations]
    completions = [row["completionOffsetMs"] for row in observations]
    return {
        "actionableLaneMix": [
            {"attempts": count, "lane": lane}
            for lane, count in sorted(actionable_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
        "attemptsWithReconstructableOuterFailure": len(observations),
        "attemptsWithoutReconstructableOuterFailure": len(red_attempts) - len(observations),
        "completionOffsetP50Ms": rounded_ms(nearest_rank(completions, 50)),
        "completionOffsetP95Ms": rounded_ms(nearest_rank(completions, 95)),
        "offsetMethod": "sum prior duration-bearing outer verdict lanes; inter-lane overhead is absent",
        "receiptProxyMix": [
            {"attempts": count, "class": label}
            for label, count in sorted(proxy_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
        "redAttempts": len(red_attempts),
        "startOffsetP50Ms": rounded_ms(nearest_rank(starts, 50)),
        "startOffsetP95Ms": rounded_ms(nearest_rank(starts, 95)),
    }


def attempt_outcomes(attempts: list[dict[str, Any]]) -> dict[str, Any]:
    outcomes = collections.Counter(str(attempt.get("outcome") or "unknown") for attempt in attempts)
    modes = collections.Counter(str(attempt.get("mode") or "unknown") for attempt in attempts)
    failure_kinds = collections.Counter(
        str(attempt.get("failureKind") or "unknown")
        for attempt in attempts
        if attempt.get("outcome") != "success"
    )
    return {
        "failureKindMix": dict(sorted(failure_kinds.items())),
        "modeMix": dict(sorted(modes.items())),
        "outcomeMix": dict(sorted(outcomes.items())),
    }


def is_lock_bounce(attempt: dict[str, Any]) -> bool:
    return attempt.get("failureKind") == "handler-error" and LOCK_SENTENCE in attempt.get("message", "")


def comparable_attempts(attempts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        attempt
        for attempt in attempts
        if attempt.get("mode") in COMPARABLE_MODES and not is_lock_bounce(attempt)
    ]


def build_episodes(
    attempts: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Group attempts into M1 red-to-green episodes per (checkout, branch).

    An episode is a streak of non-success attempts closed by the next success;
    its span runs from the streak's first start to the success's end. Episodes
    that start at or before their journal's left-censor cutoff are set aside, and
    a streak with no closing success is right-censored. Lane minutes are summed
    separately for wrapper and inner lanes (ruling 74). Attempts without a start
    are skipped. Returns (closed, right-censored, left-censored).
    """
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = collections.defaultdict(list)
    for attempt in attempts:
        if attempt["startedAt"] is None:
            continue
        grouped[(attempt["checkout"], str(attempt["branch"]))].append(attempt)
    closed: list[dict[str, Any]] = []
    censored: list[dict[str, Any]] = []
    left_censored: list[dict[str, Any]] = []
    for (checkout, branch), rows in grouped.items():
        rows.sort(key=lambda row: (row["startedAt"], row["attemptId"]))
        cutoffs = [row["leftCensorCutoff"] for row in rows if row.get("leftCensorCutoff") is not None]
        cutoff = max(cutoffs) if cutoffs else None
        streak: list[dict[str, Any]] = []
        for attempt in rows:
            if attempt.get("outcome") != "success":
                streak.append(attempt)
                continue
            if not streak:
                continue
            start = streak[0]["startedAt"]
            end = attempt["endedAt"] or attempt["startedAt"]
            members = [*streak, attempt]
            span_ms = max(0.0, (end - start).total_seconds() * 1000)
            episode = {
                "attemptKeys": [member["key"] for member in members],
                "attempts": len(members),
                "branch": branch,
                "checkout": checkout,
                # Wrapper lanes only (ruling 74): an inner lane's time is
                # already inside its wrapper, so it is its own population.
                "innerLaneDurationMs": sum(
                    duration
                    for member in members
                    for lane in inner_lanes(member)
                    if (duration := timed_lane_duration(lane)) is not None
                ),
                "laneDurationMs": sum(
                    duration
                    for member in members
                    for lane in wrapper_lanes(member)
                    if (duration := timed_lane_duration(lane)) is not None
                ),
                "measuredAttemptMachineMs": sum(member["elapsedMs"] or 0 for member in members),
                "spanMs": span_ms,
            }
            (left_censored if cutoff is not None and start <= cutoff else closed).append(episode)
            streak = []
        if streak:
            start = streak[0]["startedAt"]
            last = streak[-1]["endedAt"] or streak[-1]["startedAt"]
            censored.append(
                {
                    "attempts": len(streak),
                    "branch": branch,
                    "checkout": checkout,
                    "observedSpanLowerBoundMs": max(0.0, (last - start).total_seconds() * 1000),
                }
            )
    closed.sort(key=lambda row: (row["spanMs"], row["checkout"], row["branch"]))
    censored.sort(key=lambda row: (row["checkout"], row["branch"]))
    left_censored.sort(key=lambda row: (row["spanMs"], row["checkout"], row["branch"]))
    return closed, censored, left_censored


def episode_summary(
    rows: list[dict[str, Any]],
    censored: list[dict[str, Any]],
    left_censored: list[dict[str, Any]],
    label: str,
    *,
    include_inner: bool = False,
) -> dict[str, Any]:
    """Summarize closed episodes: count, nearest-rank P50/P95 span, machine minutes and censoring counts.

    `include_inner` adds the inner-lane machine minutes that only the close run
    reports, so the baseline summary keeps its shape.
    """
    spans = [row["spanMs"] for row in rows]
    summary = {
        "closedEpisodes": len(rows),
        "label": label,
        "leftCensoredEpisodesExcluded": len(left_censored),
        "leftCensoredObservedAttempts": sum(row["attempts"] for row in left_censored),
        "measuredAttemptMachineMinutes": round(sum(row["measuredAttemptMachineMs"] for row in rows) / 60_000, 2),
        "measuredLaneMachineMinutes": round(sum(row["laneDurationMs"] for row in rows) / 60_000, 2),
        "p50Ms": rounded_ms(nearest_rank(spans, 50)),
        "p95Ms": rounded_ms(nearest_rank(spans, 95)),
        "rightCensoredStreaks": len(censored),
        "rightCensoredRedAttempts": sum(row["attempts"] for row in censored),
        "totalEpisodeSpanMinutes": round(sum(spans) / 60_000, 2),
    }
    if include_inner:
        summary["measuredInnerLaneMachineMinutes"] = round(
            sum(row["innerLaneDurationMs"] for row in rows) / 60_000, 2
        )
    return summary


def red_to_green(attempts: list[dict[str, Any]], *, include_inner: bool = False) -> dict[str, Any]:
    """M1 red-to-green time over the comparable attempts, compared with the article's figures.

    Returns the 24-hour-cut summary (the article-comparable population), the uncut
    tail, and the P50/P95 deltas against the article. `include_inner` is passed
    through to `episode_summary`.
    """
    comparable = comparable_attempts(attempts)
    uncut, censored, left_censored = build_episodes(comparable)
    cut = [row for row in uncut if row["spanMs"] <= COMPARABLE_EPISODE_CUT_MS]
    cut_summary = episode_summary(
        cut,
        censored,
        left_censored,
        "article-comparable: modes verify/repair/publish; lock bounces and left-censored episodes excluded; <=24h",
        include_inner=include_inner,
    )
    uncut_summary = episode_summary(
        uncut,
        censored,
        left_censored,
        "uncut tail: same modes/bounce/censor rule; no duration ceiling",
        include_inner=include_inner,
    )
    cut_summary["closedEpisodesOver24hExcluded"] = len(uncut) - len(cut)
    current_p50 = cut_summary["p50Ms"]
    current_p95 = cut_summary["p95Ms"]
    comparison = {
        "articleAttempts": 2433,
        "articleP50Ms": rounded_ms(ARTICLE_P50_MS),
        "articleP95Ms": rounded_ms(ARTICLE_P95_MS),
        "currentComparableAttempts": len(comparable),
        "currentRawAttempts": len(attempts),
        "p50DeltaMs": None if current_p50 is None else rounded_ms(current_p50 - ARTICLE_P50_MS),
        "p50Moved": "unmeasurable" if current_p50 is None else ("up" if current_p50 > ARTICLE_P50_MS else "down" if current_p50 < ARTICLE_P50_MS else "unchanged"),
        "p95DeltaMs": None if current_p95 is None else rounded_ms(current_p95 - ARTICLE_P95_MS),
        "p95Moved": "unmeasurable" if current_p95 is None else ("up" if current_p95 > ARTICLE_P95_MS else "down" if current_p95 < ARTICLE_P95_MS else "unchanged"),
    }
    return {"articleComparison": comparison, "comparable24h": cut_summary, "uncut": uncut_summary}


def admission_metrics(admissions: list[dict[str, Any]]) -> dict[str, Any]:
    admitted: dict[tuple[str, str], dict[str, Any]] = {}
    released: dict[tuple[str, str], dict[str, Any]] = {}
    for envelope in admissions:
        record = envelope["record"]
        nonce = record.get("nonce")
        if not isinstance(nonce, str):
            continue
        key = (envelope["journal"], nonce)
        if record.get("_tag") == "admission-admitted":
            admitted[key] = record
        elif record.get("_tag") == "admission-released":
            released[key] = record
    waits_all: list[float] = []
    waits_closed: list[float] = []
    services: list[float] = []
    by_kind: dict[str, list[tuple[float, float | None]]] = collections.defaultdict(list)
    for key, row in admitted.items():
        enqueued = row.get("enqueuedAtMillis")
        admitted_at = row.get("admittedAtMillis")
        if not isinstance(enqueued, (int, float)) or not isinstance(admitted_at, (int, float)):
            continue
        wait = max(0.0, float(admitted_at) - float(enqueued))
        waits_all.append(wait)
        release = released.get(key, {}).get("releasedAtMillis")
        service = None
        if isinstance(release, (int, float)):
            service = max(0.0, float(release) - float(admitted_at))
            waits_closed.append(wait)
            services.append(service)
        by_kind[str(row.get("kind") or "unknown")].append((wait, service))
    closed_wait = sum(waits_closed)
    closed_service = sum(services)
    return {
        "admittedEvents": len(admitted),
        "closedAdmissions": len(waits_closed),
        "measurementWindow": "frozen admission journals only",
        "p50WaitMs": rounded_ms(nearest_rank(waits_all, 50)),
        "p95WaitMs": rounded_ms(nearest_rank(waits_all, 95)),
        "queueShareOfClosedWaitPlusServicePct": pct_value(closed_wait, closed_wait + closed_service),
        "releasedEvents": len(released),
        "sumClosedServiceMs": rounded_ms(closed_service),
        "sumClosedWaitMs": rounded_ms(closed_wait),
        "sumWaitAllAdmittedMs": rounded_ms(sum(waits_all)),
        "unreleasedAdmissions": len(set(admitted) - set(released)),
        "byKind": [
            {
                "admissions": len(values),
                "closed": sum(1 for _, service in values if service is not None),
                "kind": kind,
                "p50WaitMs": rounded_ms(nearest_rank((wait for wait, _ in values), 50)),
                "p95WaitMs": rounded_ms(nearest_rank((wait for wait, _ in values), 95)),
            }
            for kind, values in sorted(by_kind.items())
        ],
    }


def hosted_metrics(snapshot: dict[str, Any]) -> dict[str, Any]:
    required = snapshot.get("requiredContexts") or REQUIRED_CONTEXT_ORDER
    required_set = set(required)
    by_context: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    workflow_rows: list[dict[str, Any]] = []
    completed_runs: list[dict[str, Any]] = []
    for run in snapshot.get("runs", []):
        if run.get("event") not in {"pull_request", "push"}:
            continue
        if run.get("event") == "push" and run.get("headBranch") != "main":
            continue
        created = parse_ts(run.get("createdAt"))
        updated = parse_ts(run.get("updatedAt"))
        workflow_ms = None
        if created is not None and updated is not None and updated >= created:
            workflow_ms = (updated - created).total_seconds() * 1000
        workflow_rows.append(
            {
                "conclusion": run.get("conclusion"),
                "durationMs": workflow_ms,
                "event": run.get("event"),
            }
        )
        if run.get("status") == "completed":
            completed_runs.append(run)
        for job in run.get("jobs", []):
            name = HOSTED_CONTEXT_ALIASES.get(str(job.get("name")), str(job.get("name")))
            if name not in required_set:
                continue
            started = parse_ts(job.get("startedAt"))
            completed = parse_ts(job.get("completedAt"))
            duration = None
            if started is not None and completed is not None and completed >= started:
                duration = (completed - started).total_seconds() * 1000
            if duration is None or job.get("conclusion") == "skipped":
                continue
            by_context[name].append(
                {
                    "conclusion": job.get("conclusion"),
                    "durationMs": duration,
                    "event": run.get("event"),
                    "runId": run.get("databaseId"),
                }
            )
    total_job_ms = sum(row["durationMs"] for rows in by_context.values() for row in rows)
    lane_rows: list[dict[str, Any]] = []
    ordered_contexts = [context for context in REQUIRED_CONTEXT_ORDER if context in required_set]
    ordered_contexts.extend(sorted(required_set - set(ordered_contexts)))
    for context in ordered_contexts:
        rows = by_context.get(context, [])
        durations = [row["durationMs"] for row in rows]
        conclusions = collections.Counter(str(row["conclusion"] or "unknown") for row in rows)
        lane_rows.append(
            {
                "attempts": len(rows),
                "conclusionMix": dict(sorted(conclusions.items())),
                "context": context,
                "p50DurationMs": rounded_ms(nearest_rank(durations, 50)),
                "p95DurationMs": rounded_ms(nearest_rank(durations, 95)),
                "shareOfHostedRequiredLaneTimePct": pct_value(sum(durations), total_job_ms),
                "totalDurationMs": rounded_ms(sum(durations)),
            }
        )

    workflow_summary: list[dict[str, Any]] = []
    for event in ("pull_request", "push"):
        rows = [row for row in workflow_rows if row["event"] == event and row["durationMs"] is not None]
        durations = [row["durationMs"] for row in rows]
        outcomes = collections.Counter(str(row["conclusion"] or "unknown") for row in rows)
        workflow_summary.append(
            {
                "event": "main-push" if event == "push" else event,
                "outcomeMix": dict(sorted(outcomes.items())),
                "p50DurationMs": rounded_ms(nearest_rank(durations, 50)),
                "p95DurationMs": rounded_ms(nearest_rank(durations, 95)),
                "runs": len(rows),
            }
        )
    return {
        "completedRuns": len(completed_runs),
        "cutoffDateUtc": snapshot.get("cutoffDateUtc"),
        "laneRows": lane_rows,
        "requiredContexts": required,
        "runsCaptured": len(snapshot.get("runs", [])),
        "totalHostedRequiredLaneDurationMs": rounded_ms(total_job_ms),
        "workflowRows": workflow_summary,
    }


def match_hosted_runs_to_attempts(
    attempts: list[dict[str, Any]], hosted_snapshot: dict[str, Any]
) -> dict[int, tuple[str, str, str]]:
    publish_by_branch: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for attempt in attempts:
        if (
            attempt.get("mode") == "publish"
            and attempt.get("pushed") is True
            and attempt["startedAt"] is not None
            and attempt["endedAt"] is not None
        ):
            publish_by_branch[str(attempt["branch"])].append(attempt)
    for rows in publish_by_branch.values():
        rows.sort(key=lambda row: row["startedAt"])
    hosted_runs = sorted(
        (
            run
            for run in hosted_snapshot.get("runs", [])
            if run.get("event") == "pull_request" and parse_ts(run.get("createdAt")) is not None
        ),
        key=lambda run: (
            run.get("headSha") or "",
            run.get("attempt") or 0,
            run.get("createdAt"),
            run.get("databaseId"),
        ),
    )
    runs_by_change: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for run in hosted_runs:
        run_id = run.get("databaseId")
        change = run.get("headSha") if isinstance(run.get("headSha"), str) else f"run:{run_id}"
        runs_by_change[change].append(run)

    matches: dict[int, tuple[str, str, str]] = {}
    used_attempts: set[tuple[str, str, str]] = set()
    for change in sorted(runs_by_change):
        change_runs = runs_by_change[change]
        candidates: list[tuple[float, dt.datetime, str, dict[str, Any]]] = []
        for run in change_runs:
            created = parse_ts(run.get("createdAt"))
            assert created is not None
            for attempt in publish_by_branch.get(str(run.get("headBranch")), []):
                if attempt["key"] in used_attempts:
                    continue
                lower = attempt["startedAt"] - dt.timedelta(minutes=10)
                upper = attempt["endedAt"] + dt.timedelta(minutes=60)
                if not (lower <= created <= upper):
                    continue
                if attempt["startedAt"] <= created <= attempt["endedAt"]:
                    distance = 0.0
                else:
                    distance = min(
                        abs((created - attempt["startedAt"]).total_seconds()),
                        abs((created - attempt["endedAt"]).total_seconds()),
                    )
                candidates.append((distance, attempt["startedAt"], attempt["attemptId"], attempt))
        if not candidates:
            continue
        candidates.sort(key=lambda item: item[:3])
        winner = candidates[0][3]
        used_attempts.add(winner["key"])
        for run in change_runs:
            if isinstance(run.get("databaseId"), int):
                matches[run["databaseId"]] = winner["key"]
    return matches


def execution_amplification(
    attempts: list[dict[str, Any]], hosted_snapshot: dict[str, Any], hosted: dict[str, Any]
) -> dict[str, Any]:
    counts: dict[tuple[str, str, str], collections.Counter[str]] = collections.defaultdict(collections.Counter)
    reused: collections.Counter[str] = collections.Counter()
    prepush_runs: collections.Counter[str] = collections.Counter()
    parity_inferred: collections.Counter[str] = collections.Counter()
    hosted_matched: collections.Counter[str] = collections.Counter()
    parity_failures_unallocated = 0

    for attempt in attempts:
        repo_sanity_executed = False
        repo_sanity_reused = False
        for lane in attempt["lanes"]:
            lane_id = str(lane.get("id") or "")
            status = lane.get("status")
            if lane_id.startswith(REPO_SANITY_PREFIX):
                repo_sanity_executed = repo_sanity_executed or status in EXECUTED_STATUSES
                repo_sanity_reused = repo_sanity_reused or status in REUSED_STATUSES
                continue
            context = INNER_CONTEXT.get(lane_id)
            if context is None:
                continue
            if status in EXECUTED_STATUSES:
                counts[attempt["key"]][context] += 1
                prepush_runs[context] += 1
            elif status in REUSED_STATUSES:
                reused[context] += 1
        if repo_sanity_executed:
            counts[attempt["key"]]["Repo Sanity"] += 1
            prepush_runs["Repo Sanity"] += 1
        if repo_sanity_reused:
            reused["Repo Sanity"] += 1

        parity = next((lane for lane in attempt["lanes"] if lane.get("id") == "full:02-ci-parity"), None)
        if parity is not None and parity.get("status") == "passed":
            for context in hosted["requiredContexts"]:
                counts[attempt["key"]][context] += 1
                parity_inferred[context] += 1
        elif parity is not None and parity.get("status") == "failed":
            parity_failures_unallocated += 1

    matches = match_hosted_runs_to_attempts(attempts, hosted_snapshot)
    required_set = set(hosted["requiredContexts"])
    executed_hosted_jobs = 0
    for run in hosted_snapshot.get("runs", []):
        run_id = run.get("databaseId")
        if not isinstance(run_id, int) or run_id not in matches:
            continue
        key = matches[run_id]
        for job in run.get("jobs", []):
            context = HOSTED_CONTEXT_ALIASES.get(str(job.get("name")), str(job.get("name")))
            if context not in required_set or job.get("conclusion") == "skipped":
                continue
            started = parse_ts(job.get("startedAt"))
            completed = parse_ts(job.get("completedAt"))
            if started is None or completed is None or completed < started:
                continue
            counts[key][context] += 1
            hosted_matched[context] += 1
            executed_hosted_jobs += 1

    rows: list[dict[str, Any]] = []
    for context in hosted["requiredContexts"]:
        per_attempt = [counter[context] for counter in counts.values() if counter[context] > 0]
        rows.append(
            {
                "ciParityRunsInferredFromSuccessfulWrapper": parity_inferred[context],
                "context": context,
                "executions": sum(per_attempt),
                "hostedRunsMatchedToPublishAttempt": hosted_matched[context],
                "logicalAttempts": len(per_attempt),
                "localInnerRunsObserved": prepush_runs[context],
                "maxRunsInOneAttempt": max(per_attempt, default=0),
                "reusedLocalProofs": reused[context],
                "runsPerAttempt": None if not per_attempt else round(sum(per_attempt) / len(per_attempt), 3),
            }
        )
    rows.sort(key=lambda row: REQUIRED_CONTEXT_ORDER.index(row["context"]) if row["context"] in REQUIRED_CONTEXT_ORDER else 999)
    return {
        "hostedJobsMatched": executed_hosted_jobs,
        "hostedPrRunsMatchedToPublishAttempts": len(matches),
        "hostedPrRunsUnmatched": sum(1 for run in hosted_snapshot.get("runs", []) if run.get("event") == "pull_request") - len(matches),
        "matchRule": (
            "same headSha change and branch; any (headSha, workflow attempt, run id) within the publish "
            "window anchors every hosted rerun for that change to the nearest local publish interval"
        ),
        "mergedPreviewFailedWrappersWithUnallocatedInnerRuns": parity_failures_unallocated,
        "rows": rows,
    }


def fingerprint_quality(attempts: list[dict[str, Any]], states: list[dict[str, Any]]) -> dict[str, Any]:
    per_attempt = sum(
        1
        for attempt in attempts
        if any(isinstance(attempt.get(key), str) for key in ("diffFingerprint", "commandHash"))
        or any(
            isinstance(lane, dict)
            and any(isinstance(lane.get(key), str) for key in ("diffFingerprint", "commandHash"))
            for lane in attempt["lanes"]
        )
    )
    valid_states = [
        state
        for state in states
        if state["document"].get("schemaVersion") == "yeet-run-state/v1"
        and isinstance(state["document"].get("diffFingerprint"), str)
    ]
    lane_proofs = sum(
        len(state["document"].get("laneProofs", []))
        for state in valid_states
        if isinstance(state["document"].get("laneProofs"), list)
    )
    return {
        "attemptsWithPerAttemptFingerprint": per_attempt,
        "classification": "unmeasurable",
        "failedUnchangedFingerprintThenGreen": None,
        "latestStateFilesWithFingerprint": len(valid_states),
        "latestStateLaneProofs": lane_proofs,
        "reason": "attempt rows carry head=HEAD and no diffFingerprint; state.json is one overwritten latest-green snapshot per run directory",
        "receiptAnchors": [
            "staging arrangement invalidated a byte-identical proof (2026-08-16 B5)",
            "TS2589 native compiler flake",
            "stale node_modules/dist and ignored projection drift",
            "native install or runner communication loss",
            "queued/submitted attempts with no terminal row",
        ],
    }


def mix_rows(counter: collections.Counter[str], key: str) -> list[dict[str, Any]]:
    """Counter entries as rows keyed by `key`, largest count first and ties by label."""
    return [
        {"attempts": count, key: label}
        for label, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def fingerprint_repeat_metrics(attempts: list[dict[str, Any]]) -> dict[str, Any]:
    """M4 fingerprint-repeat proxy (ruling 75), computed where A5 journals carry it.

    Within one (checkout, branch) sequence of comparable attempts, ordered as the
    M1 walk orders them, count each pair of consecutive attempts whose red side
    carries a verdict (a terminated row has no outcome and never counts) and
    whose next attempt is green on the same `diffFingerprint`.
    """
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = collections.defaultdict(list)
    for attempt in comparable_attempts(attempts):
        if attempt["startedAt"] is None:
            continue
        grouped[(attempt["checkout"], str(attempt["branch"]))].append(attempt)
    repeats: list[dict[str, Any]] = []
    for rows in grouped.values():
        rows.sort(key=lambda row: (row["startedAt"], row["attemptId"]))
        for current, following in zip(rows, rows[1:]):
            fingerprint = current.get("diffFingerprint")
            if (
                current.get("outcome") is not None
                and current.get("outcome") != "success"
                and following.get("outcome") == "success"
                and isinstance(fingerprint, str)
                and fingerprint == following.get("diffFingerprint")
            ):
                repeats.append(current)
    with_fingerprint = sum(1 for attempt in attempts if isinstance(attempt.get("diffFingerprint"), str))
    return {
        "attemptsWithFingerprint": with_fingerprint,
        "byActionableLane": mix_rows(collections.Counter(actionable_lane(row) for row in repeats), "lane"),
        "byReceiptProxy": mix_rows(collections.Counter(classify_receipt_proxy(row) for row in repeats), "class"),
        "classification": "measured" if with_fingerprint > 0 else "unmeasurable",
        "failedUnchangedFingerprintThenGreen": len(repeats),
        "method": (
            "ruling 75 fingerprint-repeat proxy over the M1 comparable sequence per (checkout, branch): "
            "verdict-bearing red followed by green on the same diffFingerprint; the ack-resolution join is absent"
        ),
    }


def close_fingerprint_quality(attempts: list[dict[str, Any]], states: list[dict[str, Any]]) -> dict[str, Any]:
    """The baseline's M4 block with the post-A5 fingerprint-repeat proxy filled in."""
    quality = fingerprint_quality(attempts, states)
    repeats = fingerprint_repeat_metrics(attempts)
    quality.update(repeats)
    quality["failedUnchangedFingerprintThenGreen"] = repeats["failedUnchangedFingerprintThenGreen"]
    quality["reason"] = (
        "measured only over attempts whose journal rows carry diffFingerprint (A5 and later); "
        "pre-A5 rows carry head=HEAD and stay outside the proxy"
        if repeats["classification"] == "measured"
        else "no attempt row carries diffFingerprint"
    )
    return quality


def start_rows(sources: list[dict[str, Any]]) -> dict[tuple[str, str, str], dt.datetime | None]:
    """Every journaled start with its time, deduplicated as `load_attempts` does."""
    starts: dict[tuple[str, str, str], dict[str, Any]] = {}
    for source in sources:
        for record in source["records"]:
            if (
                record.get("schemaVersion") != ATTEMPT_SCHEMA
                or record.get("_tag") != "attempt-started"
                or not isinstance(record.get("attemptId"), str)
            ):
                continue
            key = attempt_key(str(source["checkout"]), str(source["runId"]), record["attemptId"])
            if key not in starts or source["source"] == "live":
                starts[key] = record
    return {key: parse_ts(record.get("startedAt")) for key, record in starts.items()}


def termination_metrics(
    attempts: list[dict[str, Any]],
    starts: dict[tuple[str, str, str], dt.datetime | None],
) -> dict[str, Any]:
    """M5: starts that never recorded a terminal row, and the journaled terminations."""
    finished = {attempt["key"] for attempt in attempts}
    unfinished = sum(1 for key in starts if key not in finished)
    reasons = collections.Counter(
        str(attempt["terminationReason"])
        for attempt in attempts
        if isinstance(attempt.get("terminationReason"), str)
    )
    swept = sum(count for reason, count in reasons.items() if reason in RECONCILER_TERMINATION_REASONS)
    return {
        "journaledTerminations": sum(reasons.values()),
        "reasonMix": mix_rows(reasons, "reason"),
        # The P0 proxy counted every start with no terminal row. Since A5 the
        # reconciler sweeps many of those into sweep-stamped terminal rows, so
        # the P0-comparable count adds them back.
        "startsWithoutAttemptWrittenTerminal": unfinished + swept,
        "sweepStampedTerminations": swept,
        "starts": len(starts),
        "startsWithoutFinish": unfinished,
        "startsWithoutFinishPct": pct_value(unfinished, len(starts)),
    }


def attempt_instant(attempt: dict[str, Any]) -> dt.datetime | None:
    """The instant an attempt is placed at: its start, else its end."""
    return attempt["startedAt"] or attempt["endedAt"]


def post_baseline_metrics(
    attempts: list[dict[str, Any]],
    starts: dict[tuple[str, str, str], dt.datetime | None],
    hosted_snapshot: dict[str, Any],
    hosted: dict[str, Any],
    cut: dt.datetime,
) -> dict[str, Any]:
    """The same recipe over the attempts that started after the P0 live capture."""
    subset = [attempt for attempt in attempts if (instant := attempt_instant(attempt)) is not None and instant > cut]
    later_starts = {key: value for key, value in starts.items() if value is not None and value > cut}
    amplification = execution_amplification(subset, hosted_snapshot, hosted)
    return {
        "attempts": attempt_outcomes(subset),
        "cutUtc": format_ts(cut),
        "executionAmplification": amplification,
        "finishedAttempts": len(subset),
        "firstFailure": first_failure_metrics(subset),
        "population": "attempts whose startedAt (else endedAt) is after the P0 live capture; starts filtered the same way",
        "redToGreen": red_to_green(subset, include_inner=True),
        "terminations": termination_metrics(subset, later_starts),
        "unchangedFingerprint": fingerprint_repeat_metrics(subset),
    }


def context_row(report_rows: list[dict[str, Any]], context: str) -> dict[str, Any]:
    """The required-context row named `context`, or an empty row when it is absent."""
    return next((row for row in report_rows if row.get("context") == context), {})


def comparison_values(section: dict[str, Any], *, full_report: bool) -> dict[str, Any]:
    """Project the ruling-8 rows (M1-M5) out of a report or a sub-population."""
    red_green = section["redToGreen"]
    first_failure = section["firstFailure"]
    rows = section["requiredContextRows"] if full_report else section["executionAmplification"]["rows"]
    integration = context_row(rows, "Heavy / Test Integration")
    docgen = context_row(rows, "Heavy / Docgen")
    fingerprint = section["unchangedFingerprint"]
    if full_report:
        diagnostics = section["dataQuality"]["diagnostics"]
        terminations = section.get("terminations")
        starts = diagnostics.get("starts")
        unfinished = diagnostics.get("startsWithoutFinish")
    else:
        terminations = section["terminations"]
        starts = terminations["starts"]
        unfinished = terminations["startsWithoutFinish"]
    return {
        "M1 P50 comparable <=24h": red_green["comparable24h"]["p50Ms"],
        "M1 P95 comparable <=24h": red_green["comparable24h"]["p95Ms"],
        "M1 closed episodes (<=24h)": red_green["comparable24h"]["closedEpisodes"],
        "M1 right-censored streaks (<=24h)": red_green["comparable24h"]["rightCensoredStreaks"],
        "M1 right-censored red attempts (<=24h)": red_green["comparable24h"]["rightCensoredRedAttempts"],
        "M1 P50 uncut": red_green["uncut"]["p50Ms"],
        "M1 P95 uncut": red_green["uncut"]["p95Ms"],
        "M2 start offset P50": first_failure["startOffsetP50Ms"],
        "M2 start offset P95": first_failure["startOffsetP95Ms"],
        "M2 completion P50": first_failure["completionOffsetP50Ms"],
        "M2 completion P95": first_failure["completionOffsetP95Ms"],
        "M2 reconstructable failures": first_failure["attemptsWithReconstructableOuterFailure"],
        "M3 Test Integration runs per attempt": integration.get("runsPerAttempt"),
        "M3 Test Integration max runs in one attempt": integration.get("maxRunsInOneAttempt"),
        "M3 Docgen runs per attempt": docgen.get("runsPerAttempt"),
        "M3 Docgen max runs in one attempt": docgen.get("maxRunsInOneAttempt"),
        "M4 classification": fingerprint.get("classification"),
        "M4 failed unchanged fingerprint then green": fingerprint.get("failedUnchangedFingerprintThenGreen"),
        "M4 attempts with diff fingerprint": fingerprint.get(
            "attemptsWithFingerprint", fingerprint.get("attemptsWithPerAttemptFingerprint")
        ),
        "M5 starts without finish": unfinished,
        "M5 starts": starts,
        "M5 starts without finish pct": pct_value(unfinished, starts) if isinstance(starts, int) else None,
        "M5 journaled terminations": None if terminations is None else terminations["journaledTerminations"],
        "M5 sweep-stamped terminations": None if terminations is None else terminations["sweepStampedTerminations"],
        # P0-comparable: the baseline's unfinished starts had no reconciler.
        "M5 starts without an attempt-written terminal row": (
            unfinished if terminations is None else terminations["startsWithoutAttemptWrittenTerminal"]
        ),
    }


COMPARISON_UNITS = {
    "M1 P50 comparable <=24h": "ms",
    "M1 P95 comparable <=24h": "ms",
    "M1 P50 uncut": "ms",
    "M1 P95 uncut": "ms",
    "M2 start offset P50": "ms",
    "M2 start offset P95": "ms",
    "M2 completion P50": "ms",
    "M2 completion P95": "ms",
    "M4 classification": "label",
    "M5 starts without finish pct": "pct",
}


def baseline_comparison(
    baseline: dict[str, Any], close: dict[str, Any], post_baseline: dict[str, Any]
) -> list[dict[str, Any]]:
    """Ruling-8 comparison rows for the close report.

    Each M1-M5 measure `comparison_values` projects appears once, with its value
    in the P0 baseline, the close union and the post-P0 attempts, and its display
    unit.
    """
    before = comparison_values(baseline, full_report=True)
    after = comparison_values(close, full_report=True)
    later = comparison_values(post_baseline, full_report=False)
    return [
        {
            "baseline": before[measure],
            "close": after[measure],
            "closePostBaseline": later[measure],
            "id": measure.split(" ", 1)[0],
            "measure": measure,
            "unit": COMPARISON_UNITS.get(measure, "count"),
        }
        for measure in before
    ]


def output_quality(
    attempts: list[dict[str, Any]],
    diagnostics: dict[str, Any],
    ring: dict[str, Any],
    live_snapshot: dict[str, Any],
    hosted_snapshot: dict[str, Any],
    states: list[dict[str, Any]],
    rss: list[dict[str, Any]],
) -> dict[str, Any]:
    timestamps = [
        value
        for attempt in attempts
        for value in (attempt["startedAt"], attempt["endedAt"])
        if value is not None
    ]
    v2 = sum(1 for attempt in attempts if attempt["schemaVersion"] == VERDICT_SCHEMA_V2)
    return {
        "attemptWindowEndUtc": format_ts(max(timestamps)) if timestamps else None,
        "attemptWindowStartUtc": format_ts(min(timestamps)) if timestamps else None,
        "clockAssumption": "all ISO timestamps normalized to UTC; admission epoch milliseconds interpreted as UTC instants",
        "diagnostics": diagnostics,
        "fingerprintStateFiles": len(states),
        "hostedCapturedAt": hosted_snapshot.get("capturedAt"),
        "innerLaneDurationLimitation": "pre-push inner states have no durationMs; merged-preview ci:local inner states are absent entirely",
        "liveCapturedAt": live_snapshot.get("capturedAt"),
        "percentileEstimator": "true nearest-rank: sorted index ceil(p*n)-1",
        "ringBuffer": ring,
        "rssFiles": len(rss),
        "rssFilesWithNumericPeak": sum(1 for row in rss if isinstance(row.get("peakRssKb"), (int, float))),
        "verdictV2Attempts": v2,
        "verdictV1OrOtherAttempts": len(attempts) - v2,
        "wholeProofCacheHitRatio": {
            "measurable": False,
            "reason": "forbidden by ship-velocity C5; inputs contain no first-cold-lane task accounting",
        },
    }


def merge_context_tables(hosted: dict[str, Any], amplification: dict[str, Any]) -> list[dict[str, Any]]:
    amplification_by_context = {row["context"]: row for row in amplification["rows"]}
    rows: list[dict[str, Any]] = []
    for hosted_row in hosted["laneRows"]:
        amp = amplification_by_context.get(hosted_row["context"], {})
        rows.append(
            {
                **hosted_row,
                **{key: value for key, value in amp.items() if key != "context"},
                "localP50DurationMs": None,
                "localP95DurationMs": None,
                "measuredDurationPopulation": "hosted jobs only",
            }
        )
    return rows


def markdown_table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    rendered = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    rendered.extend("| " + " | ".join(markdown_escape(cell) for cell in row) + " |" for row in rows)
    return rendered


def render_economics(report: dict[str, Any]) -> str:
    """Render a report as the markdown snapshot.

    A close-run report also gets section B2 and the comparison with the P0
    baseline (ruling 8). Fails when the text would exceed 300 lines.
    """
    close = report.get("run") == CLOSE_RUN
    run_flag = " --run close" if close else ""
    lines: list[str] = [
        "# Verification economics — P4 close snapshot" if close else "# Verification economics — fleet snapshot",
        "",
        "Reproduce from a clean repository clone with the committed compact inputs:",
        "",
        "```sh",
        f"python3 goals/time-to-certainty/research/scripts/economics.py{run_flag} --from-inputs",
        "```",
        "",
        (
            "Embedded replay verifies both compact inputs, `economics-close.json` and the baseline "
            "`economics.json` against HEAD, then checks the input bytes against `inputs/close/RECEIPTS.json`; "
            "use `--allow-input-drift` only for non-ratified output."
            if close
            else "Embedded replay verifies both compact inputs and `economics.json` against HEAD, then checks the "
            "input bytes against `inputs/RECEIPTS.json`; use `--allow-input-drift` only for non-ratified output."
        ),
        "",
        "Validate an available frozen corpus before replaying it:",
        "",
        "```sh",
        f"python3 goals/time-to-certainty/research/scripts/economics.py{run_flag} --from-inputs --corpus <dir>",
        "```",
        "",
        "Corpus path, digest, manifest, or compact-fact drift fails closed before either output is written.",
        "Use `--allow-corpus-drift` only for exploratory output: JSON gets",
        "`corpusValidation: \"drifted\"`, and Markdown gets a visible non-ratified banner.",
        "",
    ]
    if report.get("corpusValidation") == "drifted":
        lines[2:2] = [
            "> **NON-RATIFIED CORPUS DRIFT:** generated with `--allow-corpus-drift`; do not use as the baseline.",
            "",
        ]
    elif report.get("corpusValidation") == "embedded-drifted":
        lines[2:2] = [
            (
                "> **NON-RATIFIED EMBEDDED INPUT DRIFT:** generated with `--allow-input-drift`; "
                "do not use as the baseline."
            ),
            "",
        ]
    lines += markdown_table(
        ["Method", "Value"],
        [
            ["Schema", report["schemaVersion"]],
            ["As of", report["measurementAsOf"]],
            ["Percentiles", report["dataQuality"]["percentileEstimator"]],
            ["Episode identity", "(checkout, branch); prevents cross-checkout closure"],
            ["Article comparison", "verify/repair/publish; lock bounces excluded; <=24h"],
            ["Cache metric", "not computed; first-cold-lane records absent (C5)"],
        ],
    )
    lines += ["", "## A. Required-context lane economics", ""]
    lines += markdown_table(
        [
            "Context",
            "logical attempts",
            "runs",
            "runs/attempt",
            "local inner",
            "preview inferred",
            "hosted matched",
            "hosted n",
            "p50 ms",
            "p95 ms",
            "hosted time share",
            "local p50",
        ],
        [
            [
                row["context"],
                row.get("logicalAttempts"),
                row.get("executions"),
                row.get("runsPerAttempt"),
                row.get("localInnerRunsObserved"),
                row.get("ciParityRunsInferredFromSuccessfulWrapper"),
                row.get("hostedRunsMatchedToPublishAttempt"),
                row["attempts"],
                row["p50DurationMs"],
                row["p95DurationMs"],
                f"{row['shareOfHostedRequiredLaneTimePct']}%" if row["shareOfHostedRequiredLaneTimePct"] is not None else "n/a",
                "unmeasured",
            ]
            for row in report["requiredContextRows"]
        ],
    )
    lines += [
        "",
        "## B. Directly measured local wrapper lanes",
        "",
    ]
    lines += markdown_table(
        ["Lane", "phase", "attempts", "p50 ms", "p95 ms", "total", "local time share"],
        [
            [
                row["id"] if row["id"] == row["label"] else f"{row['id']} / {row['label']}",
                row["phase"],
                row["attempts"],
                row["p50DurationMs"],
                row["p95DurationMs"],
                fmt_ms(row["totalDurationMs"]),
                f"{row['shareOfMeasuredLocalLaneTimePct']}%",
            ]
            for row in report["localWrapperLanes"]
        ],
    )
    if close:
        lines += render_close_inner_lanes(report)
    lines += ["", "## C. Attempts and first actionable failure", ""]
    outcome = report["attempts"]
    lines += markdown_table(
        ["Population", "attempts", "success", "failure", "starts without finish"],
        [
            [
                "union: frozen + live overlay",
                report["dataQuality"]["diagnostics"]["finishedAttempts"],
                outcome["all"]["outcomeMix"].get("success", 0),
                outcome["all"]["outcomeMix"].get("failure", 0),
                report["dataQuality"]["diagnostics"]["startsWithoutFinish"],
            ],
            [
                "article-comparable modes/bounce filter",
                report["redToGreen"]["articleComparison"]["currentComparableAttempts"],
                outcome["comparable"]["outcomeMix"].get("success", 0),
                outcome["comparable"]["outcomeMix"].get("failure", 0),
                "n/a",
            ],
        ],
    )
    ff = report["firstFailure"]
    lines += [""]
    lines += markdown_table(
        ["First-failure measure", "n", "p50", "p95", "law"],
        [
            ["failing outer-lane start offset", ff["attemptsWithReconstructableOuterFailure"], fmt_ms(ff["startOffsetP50Ms"]), fmt_ms(ff["startOffsetP95Ms"]), "cumulative recorded prior wrappers"],
            ["first actionable failure completion", ff["attemptsWithReconstructableOuterFailure"], fmt_ms(ff["completionOffsetP50Ms"]), fmt_ms(ff["completionOffsetP95Ms"]), "offset + failing wrapper duration"],
            ["red attempts not reconstructable", ff["attemptsWithoutReconstructableOuterFailure"], "n/a", "n/a", "handler/no duration"],
        ],
    )
    lines += [""]
    lines += markdown_table(
        ["Actionable lane", "failed attempts"],
        [[row["lane"], row["attempts"]] for row in ff["actionableLaneMix"][:15]],
    )
    lines += ["", "## D. Receipt-matched failure proxies", ""]
    lines += markdown_table(
        ["Proxy class", "failed attempts", "Unchanged-fingerprint claim"],
        [[row["class"], row["attempts"], "not joinable"] for row in ff["receiptProxyMix"]],
    )
    fp = report["unchangedFingerprint"]
    lines += [""]
    lines += markdown_table(
        ["M4 field", "Value"],
        [
            ["failed unchanged fingerprint -> next green", fp["classification"]],
            ["per-attempt fingerprints", fp["attemptsWithPerAttemptFingerprint"]],
            ["latest state files with fingerprint", fp["latestStateFilesWithFingerprint"]],
            ["reason", fp["reason"]],
        ],
    )
    lines += ["", "## E. Red-to-green episodes", ""]
    lines += markdown_table(
        ["Population", "n", "p50", "p95", "span min", "attempt-machine min", "lane-machine min", "right-censored"],
        [
            [
                summary["label"],
                summary["closedEpisodes"],
                fmt_ms(summary["p50Ms"]),
                fmt_ms(summary["p95Ms"]),
                summary["totalEpisodeSpanMinutes"],
                summary["measuredAttemptMachineMinutes"],
                summary["measuredLaneMachineMinutes"],
                summary["rightCensoredStreaks"],
            ]
            for summary in (report["redToGreen"]["comparable24h"], report["redToGreen"]["uncut"])
        ],
    )
    comparison = report["redToGreen"]["articleComparison"]
    lines += [""]
    lines += markdown_table(
        ["Baseline comparison", "article", "current", "delta", "moved"],
        [
            ["P50", fmt_ms(comparison["articleP50Ms"]), fmt_ms(report["redToGreen"]["comparable24h"]["p50Ms"]), fmt_ms(comparison["p50DeltaMs"]), comparison["p50Moved"]],
            ["P95", fmt_ms(comparison["articleP95Ms"]), fmt_ms(report["redToGreen"]["comparable24h"]["p95Ms"]), fmt_ms(comparison["p95DeltaMs"]), comparison["p95Moved"]],
            ["Raw finished attempts", comparison["articleAttempts"], comparison["currentRawAttempts"], comparison["currentRawAttempts"] - comparison["articleAttempts"], "retained sample delta"],
        ],
    )
    lines += ["", "## F. Admission and hosted envelopes", ""]
    admission = report["admission"]
    lines += markdown_table(
        ["Admission measure", "Value"],
        [
            ["admitted / released / open", f"{admission['admittedEvents']} / {admission['releasedEvents']} / {admission['unreleasedAdmissions']}"],
            ["wait p50 / p95", f"{fmt_ms(admission['p50WaitMs'])} / {fmt_ms(admission['p95WaitMs'])}"],
            ["closed wait / service", f"{fmt_ms(admission['sumClosedWaitMs'])} / {fmt_ms(admission['sumClosedServiceMs'])}"],
            ["queue share", f"{admission['queueShareOfClosedWaitPlusServicePct']}%"],
            ["scope", admission["measurementWindow"]],
        ],
    )
    lines += [""]
    lines += markdown_table(
        ["Hosted Check event", "runs", "p50", "p95", "outcome mix"],
        [
            [row["event"], row["runs"], fmt_ms(row["p50DurationMs"]), fmt_ms(row["p95DurationMs"]), json.dumps(row["outcomeMix"], sort_keys=True, separators=(",", ":"))]
            for row in report["hosted"]["workflowRows"]
        ],
    )
    prepush = next((row for row in report["localWrapperLanes"] if row["id"] == "full:01-pre-push"), {})
    preview = next((row for row in report["localWrapperLanes"] if row["id"] == "full:02-ci-parity"), {})
    hosted_pr = next((row for row in report["hosted"]["workflowRows"] if row["event"] == "pull_request"), {})
    lines += [""]
    lines += markdown_table(
        ["Verification envelope", "n", "p50", "p95", "Comparability"],
        [
            ["local pre-push wrapper", prepush.get("attempts"), fmt_ms(prepush.get("p50DurationMs")), fmt_ms(prepush.get("p95DurationMs")), "local sequential/waved collector"],
            ["local merged-preview wrapper", preview.get("attempts"), fmt_ms(preview.get("p50DurationMs")), fmt_ms(preview.get("p95DurationMs")), "merged tree; child timings absent"],
            ["hosted PR Check workflow", hosted_pr.get("runs"), fmt_ms(hosted_pr.get("p50DurationMs")), fmt_ms(hosted_pr.get("p95DurationMs")), "parallel jobs; createdAt -> updatedAt"],
        ],
    )
    lines += ["", "## G. Data quality", ""]
    dq = report["dataQuality"]
    ring = dq["ringBuffer"]
    lines += markdown_table(
        ["Constraint", "Measured fact / consequence"],
        [
            ["Window", f"{dq['attemptWindowStartUtc']} -> {dq['attemptWindowEndUtc']}"],
            ["Frozen / live / hosted capture", f"{report['sources']['frozenCaptureAt']} / {dq['liveCapturedAt']} / {dq['hostedCapturedAt']}"],
            ["Ring cap", f"50 starts per branch journal; {ring['journalsAtCap']}/{ring['journalsObserved']} journals at cap"],
            ["Observed truncation lower bound", f"{ring['observedEvictedAttemptIdsSinceFrozenCapture']} attempt IDs evicted across {ring['journalsComparedAcrossFrozenAndLive']} comparable journals"],
            ["Unknown lifetime truncation", "exact count unavailable; pre-capture history is absent"],
            ["Unmatched starts", dq["diagnostics"]["startsWithoutFinish"]],
            ["Cap pressure", f"unmatched starts consume retention slots; exact displaced terminal rows are unknowable"],
            ["Verdict versions", f"v2={dq['verdictV2Attempts']}; v1/other={dq['verdictV1OrOtherAttempts']}"],
            ["Inner timings", dq["innerLaneDurationLimitation"]],
            ["Fingerprint join", report["unchangedFingerprint"]["reason"]],
            ["Clock", dq["clockAssumption"]],
            ["Hosted duration", "job startedAt -> completedAt; includes job setup, excludes skipped and missing/negative intervals"],
            ["Tier join", f"{report['executionAmplification']['hostedPrRunsMatchedToPublishAttempts']}/{report['hosted']['workflowRows'][0]['runs']} PR workflows time-matched to publish attempts; {report['executionAmplification']['hostedPrRunsUnmatched']} unmatched"],
            ["Failed preview allocation", f"{report['executionAmplification']['mergedPreviewFailedWrappersWithUnallocatedInnerRuns']} failed merged-preview wrappers have unknown child execution sets"],
            ["Episode tail", f"{report['redToGreen']['comparable24h']['closedEpisodesOver24hExcluded']} >24h closed episodes censored only for article comparison"],
            ["Cache", dq["wholeProofCacheHitRatio"]["reason"]],
            ["Inputs", f"{len(report['inputs']['sourceFiles'])} replay files and {len(report['inputs']['corpusFiles'])} frozen corpus receipts; every path and sha256_12 in {ECONOMICS_JSON.name}"],
        ],
    )
    if close:
        lines += render_close_comparison(report)
    text = "\n".join(lines) + "\n"
    if len(text.splitlines()) > 300:
        raise SystemExit(f"{ECONOMICS_MD.name} would exceed 300 lines ({len(text.splitlines())})")
    return text


def render_close_inner_lanes(report: dict[str, Any]) -> list[str]:
    """Close-run section B2: the top inner-lane rows, a population kept apart from section B (ruling 74)."""
    totals = report["localInnerTotals"]
    rows = report["localInnerLanes"]
    lines = [
        "",
        "## B2. Directly measured local inner lanes (separate population)",
        "",
        (
            f"{totals['measuredLaneExecutions']} timed inner executions across {totals['contributingAttempts']} "
            f"attempts, {fmt_ms(totals['totalMeasuredLaneDurationMs'])} in total, "
            f"{totals['accountedLaneTimeAsPctOfAttemptElapsed']}% of those attempts' elapsed time. Shares are within "
            f"this population and are never added to section B. Top {CLOSE_TOP_INNER_ROWS} of {len(rows)} rows; "
            f"`{ECONOMICS_JSON.name}` has all of them."
        ),
        "",
    ]
    lines += markdown_table(
        ["Inner lane", "phase", "attempts", "p50 ms", "p95 ms", "total", "inner time share"],
        [
            [
                row["id"] if row["id"] == row["label"] else f"{row['id']} / {row['label']}",
                row["phase"],
                row["attempts"],
                row["p50DurationMs"],
                row["p95DurationMs"],
                fmt_ms(row["totalDurationMs"]),
                f"{row['shareOfMeasuredLocalLaneTimePct']}%",
            ]
            for row in rows[:CLOSE_TOP_INNER_ROWS]
        ],
    )
    return lines


def render_comparison_cell(value: Any, unit: str) -> str:
    """Format one comparison value by unit: a duration for ms, a percent sign for pct, `n/a` when missing."""
    if value is None:
        return "n/a"
    if unit == "ms":
        return fmt_ms(value)
    if unit == "pct":
        return f"{value}%"
    return str(value)


def render_close_comparison(report: dict[str, Any]) -> list[str]:
    """Close-run section comparing the ruling-8 rows with the P0 baseline.

    Renders the comparison table, one M1 censoring sentence per population, the
    M4 method note and the M5 termination-reason table.
    """
    comparison = report["baselineComparison"]
    post = report["postBaseline"]
    terminations = report["terminations"]
    fingerprint = report["unchangedFingerprint"]
    lines = [
        "",
        "## Close versus P0 baseline",
        "",
        (
            f"Ruling 8 rows, same script and recipe. P0 baseline: `{comparison['baseline']}` "
            f"(live capture {comparison['baselineLiveCapturedAt']}). Close: the union population of this "
            f"report. Post-P0: the same recipe over the {post['finishedAttempts']} finished attempts that "
            f"started after {post['cutUtc']}. `n/a` in the baseline column means the P0 report does not carry the row."
        ),
        "",
    ]
    lines += markdown_table(
        ["Id", "Measure", "P0 baseline", "Close (union)", "Close (post-P0 attempts)"],
        [
            [
                row["id"],
                row["measure"],
                render_comparison_cell(row["baseline"], row["unit"]),
                render_comparison_cell(row["close"], row["unit"]),
                render_comparison_cell(row["closePostBaseline"], row["unit"]),
            ]
            for row in comparison["rows"]
        ],
    )
    censoring = [
        (label, section["redToGreen"]["comparable24h"])
        for label, section in (("union", report), ("post-P0", post))
    ]
    lines += [
        "",
        " ".join(
            f"M1 {label}: {episodes['closedEpisodes']} closed episodes against {episodes['rightCensoredStreaks']} "
            f"right-censored streaks ({episodes['rightCensoredRedAttempts']} red attempts)"
            + (
                ", so its closed-episode percentiles are a lower-bound sample (long streaks are still open)."
                if episodes["rightCensoredStreaks"] > episodes["closedEpisodes"]
                else "."
            )
            for label, episodes in censoring
        ),
        "",
        (
            f"M4 method: {fingerprint['method']}. "
            "M3 local runs come from verdict inner lanes and hosted runs from the Check runs created on or after "
            f"{report['hosted']['cutoffDateUtc']}, so the union and post-P0 columns share one hosted join."
        ),
        "",
    ]
    lines += markdown_table(
        ["M5 journaled termination reason", "attempts (union)"],
        [[row["reason"], row["attempts"]] for row in terminations["reasonMix"]] or [["none journaled", 0]],
    )
    return lines


def render_report(report: dict[str, Any]) -> str:
    local_top = report["localWrapperLanes"][0] if report["localWrapperLanes"] else {}
    hosted_top = max(report["requiredContextRows"], key=lambda row: row["totalDurationMs"] or 0)
    amp_top = max(
        report["requiredContextRows"],
        key=lambda row: (row.get("runsPerAttempt") or 0, row.get("executions") or 0),
    )
    episode = report["redToGreen"]["comparable24h"]
    comparison = report["redToGreen"]["articleComparison"]
    ff = report["firstFailure"]
    fp = report["unchangedFingerprint"]
    lines = [
        "# Successor-SPEC findings",
        "",
        "| # | Finding | Supporting economics row | SPEC consequence |",
        "| --- | --- | --- | --- |",
        f"| 1 | `{local_top.get('id')}` owns the largest directly measured local wrapper pool. | Economics B: {local_top.get('attempts')} attempts, {fmt_ms(local_top.get('totalDurationMs'))}, {local_top.get('shareOfMeasuredLocalLaneTimePct')}%. | Prioritize proof reuse and lane-level instrumentation inside this wrapper before optimizing small setup steps. |",
        f"| 2 | `{hosted_top['context']}` owns the largest hosted required-lane pool. | Economics A: n={hosted_top['attempts']}, p50={fmt_ms(hosted_top['p50DurationMs'])}, p95={fmt_ms(hosted_top['p95DurationMs'])}, share={hosted_top['shareOfHostedRequiredLaneTimePct']}%. | Put this context first in ProofFact declared-input and shadow-reuse rollout. |",
        f"| 3 | `{amp_top['context']}` has the highest observable tier amplification. | Economics A: {amp_top.get('executions')} runs / {amp_top.get('logicalAttempts')} attempts = {amp_top.get('runsPerAttempt')}; max {amp_top.get('maxRunsInOneAttempt')}. | Acceptance must cap executions across pre-push, merged preview, and hosted, with tier identity journaled. |",
        f"| 4 | Current comparable red-to-green is {fmt_ms(episode['p50Ms'])} P50 / {fmt_ms(episode['p95Ms'])} P95. | Economics E: n={episode['closedEpisodes']}; P50 moved {comparison['p50Moved']} by {fmt_ms(comparison['p50DeltaMs'])}; P95 moved {comparison['p95Moved']} by {fmt_ms(comparison['p95DeltaMs'])}. | Freeze this exact recipe as M1 and retain a second uncut-tail row so the 24h comparison censor cannot become the target. |",
        f"| 5 | M2 and M4 need stronger journal facts: actionable failure arrives at {fmt_ms(ff['completionOffsetP50Ms'])} P50, while unchanged-tree failures are {fp['classification']}. | Economics C/D: {ff['attemptsWithReconstructableOuterFailure']} reconstructable failures; {fp['attemptsWithPerAttemptFingerprint']} attempts carry a fingerprint; {fp['latestStateFilesWithFingerprint']} latest-only states exist. | Add per-inner-lane start/end/duration, tier, input digest, diff fingerprint, and terminal-death rows before enforcing precision or reuse ratios. |",
        "",
        "## Could not measure",
        "",
        "| Missing fact | Why | Required repair |",
        "| --- | --- | --- |",
        "| Local per-context p50/p95 | Pre-push reports retain state only; merged-preview retains only an aggregate wrapper. | Persist each `quality:*` / `ci:local:*` execution with timestamps and tier. |",
        "| Exact 2–3 tier executions for failed previews | Failed `full:02-ci-parity` wrappers do not say which child lanes ran. | Emit the same structured child report as pre-push. |",
        "| Failed unchanged fingerprint -> next green | Attempt rows say `head=HEAD`; `state.json` is overwritten after latest green. | Put `diffFingerprint` and per-lane input digest on every attempt/ProofFact. |",
        "| Lifetime ring-buffer loss | Only the retained 50 starts exist; frozen-to-live overlap gives a lower bound. | Journal append-only archival or compaction receipts with evicted count/time bound. |",
        "| First-cold-lane cache effect | No task-touch ordering in these inputs; whole-proof rate is forbidden by C5. | Journal first cold task touch and source exactly once per epoch. |",
        "| Exact queue share for the fleet window | Frozen admission journal has a short 26-event window and no attempt join. | Add attempt/run identity to admission rows and archive the journal with the attempt corpus. |",
        "",
        "## Measurement boundary",
        "",
        "| Item | Value |",
        "| --- | --- |",
        f"| Attempt window | {report['dataQuality']['attemptWindowStartUtc']} -> {report['dataQuality']['attemptWindowEndUtc']} |",
        f"| Hosted window | UTC date >= {report['hosted']['cutoffDateUtc']}; {report['hosted']['runsCaptured']} main-push/PR Check runs |",
        f"| Ring truncation | {report['dataQuality']['ringBuffer']['journalsAtCap']} capped journals; observed eviction lower bound {report['dataQuality']['ringBuffer']['observedEvictedAttemptIdsSinceFrozenCapture']} |",
        f"| Input integrity | {len(report['inputs']['sourceFiles'])} exact source paths and sha256_12 receipts in economics.json |",
    ]
    text = "\n".join(lines) + "\n"
    if len(text.splitlines()) > 80:
        raise SystemExit(f"report.md would exceed 80 lines ({len(text.splitlines())})")
    return text


def embedded_frozen_payloads(
    live_snapshot: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    frozen = live_snapshot.get("frozen")
    if not isinstance(frozen, dict):
        raise SystemExit("compact live input has no embedded frozen facts; provide --corpus <dir>")
    attempts = frozen.get("attemptSources")
    verdicts = frozen.get("verdictSources")
    admissions = frozen.get("admissions")
    if not isinstance(attempts, list) or not isinstance(verdicts, list) or not isinstance(admissions, list):
        raise SystemExit("compact live input has malformed embedded frozen facts")
    for index, source in enumerate(attempts):
        source.setdefault("path", f"embedded/frozen/attempts/{index}")
    for index, source in enumerate(verdicts):
        source.setdefault("path", f"embedded/frozen/verdicts/{index}")
    return attempts, verdicts, admissions


def corpus_receipts_from_report(report: dict[str, Any], label: str) -> list[dict[str, Any]]:
    inputs = report.get("inputs")
    receipts = inputs.get("corpusFiles") if isinstance(inputs, dict) else None
    if not isinstance(receipts, list) or not receipts:
        raise SystemExit(f"corpus validation failed; {label} has no frozen corpus receipts")
    normalized: list[dict[str, Any]] = []
    for index, receipt in enumerate(receipts):
        if not isinstance(receipt, dict):
            raise SystemExit(f"corpus validation failed; {label} corpus receipt {index} is malformed")
        path = receipt.get("path")
        digest = receipt.get("sha256_12")
        if not isinstance(path, str) or not path or not isinstance(digest, str) or not digest:
            raise SystemExit(f"corpus validation failed; {label} corpus receipt {index} is malformed")
        normalized.append(
            {
                "bytes": receipt.get("bytes"),
                "kind": receipt.get("kind"),
                "path": path,
                "sha256_12": digest,
            }
        )
    return sorted(normalized, key=lambda row: (row["path"], str(row.get("kind"))))


def baseline_json_path() -> Path:
    """The ratified P0 report, which carries the frozen corpus receipts for every run."""
    return ECONOMICS_JSON if RUN == BASELINE_RUN else OUTPUT_ROOT / "economics.json"


def load_worktree_corpus_receipts() -> list[dict[str, Any]]:
    """Frozen corpus receipts from the ratified baseline report in the working tree."""
    baseline = baseline_json_path()
    if not baseline.is_file():
        raise SystemExit(f"missing {portable_path(baseline)} with frozen corpus receipts")
    report = parse_json_file(baseline)
    if not isinstance(report, dict):
        raise SystemExit(f"malformed {portable_path(baseline)}")
    return corpus_receipts_from_report(report, portable_path(baseline))


def load_committed_corpus_receipts() -> list[dict[str, Any]]:
    """Frozen corpus receipts from the baseline report as committed at HEAD.

    Fails closed when the committed report cannot be read or parsed.
    """
    relative = baseline_json_path().relative_to(REPO_ROOT).as_posix()
    completed = subprocess.run(
        ["git", "show", f"HEAD:{relative}"],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise SystemExit("corpus validation failed; cannot read committed economics.json")
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit("corpus validation failed; committed economics.json is malformed") from error
    if not isinstance(report, dict):
        raise SystemExit("corpus validation failed; committed economics.json is malformed")
    return corpus_receipts_from_report(report, "committed economics.json")


def differing_receipt_paths(
    actual_receipts: list[dict[str, Any]], expected_receipts: list[dict[str, Any]]
) -> list[str]:
    def indexed(receipts: list[dict[str, Any]]) -> dict[str, tuple[Any, Any, Any]]:
        return {
            str(receipt.get("path")): (
                receipt.get("sha256_12"),
                receipt.get("bytes"),
                receipt.get("kind"),
            )
            for receipt in receipts
        }

    actual = indexed(actual_receipts)
    expected = indexed(expected_receipts)
    return sorted(path for path in actual.keys() | expected.keys() if actual.get(path) != expected.get(path))


def frozen_fact_index(frozen: dict[str, Any]) -> dict[str, list[Any]]:
    indexed: dict[str, list[Any]] = collections.defaultdict(list)
    for index, source in enumerate(frozen.get("attemptSources", [])):
        if not isinstance(source, dict):
            indexed[f"attempts/<malformed-{index}>/attempts.ndjson"].append(source)
            continue
        path = f"attempts/{source.get('checkout')}/{source.get('runId')}/attempts.ndjson"
        indexed[path].append(source)
    for index, source in enumerate(frozen.get("verdictSources", [])):
        if not isinstance(source, dict):
            indexed[f"verdicts/<malformed-{index}>/verdict.json"].append(source)
            continue
        path = f"verdicts/{source.get('checkout')}/{source.get('runId')}/verdict.json"
        indexed[path].append(source)
    for index, envelope in enumerate(frozen.get("admissions", [])):
        if not isinstance(envelope, dict):
            indexed[f"admission/<malformed-{index}>/journal.ndjson"].append(envelope)
            continue
        path = f"admission/{envelope.get('journal')}/journal.ndjson"
        indexed[path].append(envelope)
    return dict(indexed)


def differing_frozen_fact_paths(actual: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    actual_index = frozen_fact_index(actual)
    expected_index = frozen_fact_index(expected)
    return sorted(
        path
        for path in actual_index.keys() | expected_index.keys()
        if actual_index.get(path) != expected_index.get(path)
    )


def corpus_validation_error(paths: list[str]) -> str:
    rendered = "\n".join(f"  - {path}" for path in sorted(set(paths)))
    return f"corpus validation failed; differing paths:\n{rendered}"


def git_blob_drift_paths(paths: Iterable[Path]) -> list[str]:
    differing: list[str] = []
    for path in paths:
        relative = path.relative_to(REPO_ROOT).as_posix()
        worktree = subprocess.run(
            ["git", "hash-object", relative],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        committed = subprocess.run(
            ["git", "rev-parse", f"HEAD:{relative}"],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if (
            worktree.returncode != 0
            or committed.returncode != 0
            or worktree.stdout.strip() != committed.stdout.strip()
        ):
            differing.append(relative)
    return differing


def embedded_input_receipts() -> list[dict[str, Any]]:
    receipts: list[dict[str, Any]] = []
    for path in (HOSTED_SNAPSHOT, LIVE_SNAPSHOT):
        if not path.is_file():
            continue
        data = path.read_bytes()
        receipts.append(
            {
                "bytes": len(data),
                "path": portable_path(path),
                "sha256_12": sha256_12_bytes(data),
            }
        )
    return receipts


def expected_embedded_input_receipts() -> list[dict[str, Any]] | None:
    try:
        document = parse_json_file(INPUT_RECEIPTS)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(document, dict) or document.get("schemaVersion") != INPUT_RECEIPTS_SCHEMA:
        return None
    receipts = document.get("files")
    if not isinstance(receipts, list):
        return None
    normalized: list[dict[str, Any]] = []
    for receipt in receipts:
        if not isinstance(receipt, dict):
            return None
        path = receipt.get("path")
        byte_count = receipt.get("bytes")
        digest = receipt.get("sha256_12")
        if (
            not isinstance(path, str)
            or not path
            or type(byte_count) is not int
            or byte_count < 0
            or not isinstance(digest, str)
            or re.fullmatch(r"[0-9a-f]{12}", digest) is None
        ):
            return None
        normalized.append({"bytes": byte_count, "path": path, "sha256_12": digest})
    expected_paths = {portable_path(HOSTED_SNAPSHOT), portable_path(LIVE_SNAPSHOT)}
    if len(normalized) != len(expected_paths) or {receipt["path"] for receipt in normalized} != expected_paths:
        return None
    return normalized


def write_input_receipts() -> None:
    """Record the byte receipts of the two compact inputs beside them.

    A capture writes this once; replay checks the committed inputs against it.
    """
    receipts = embedded_input_receipts()
    if len(receipts) != 2:
        raise SystemExit("cannot write input receipts until both compact inputs exist")
    write_json(
        INPUT_RECEIPTS,
        {
            "files": sorted(receipts, key=lambda row: row["path"]),
            "schemaVersion": INPUT_RECEIPTS_SCHEMA,
        },
    )
    print(f"wrote {portable_path(INPUT_RECEIPTS)}")


def embedded_input_validation_error(paths: list[str]) -> str:
    rendered = "\n".join(f"  - {path}" for path in sorted(set(paths)))
    return f"embedded input validation failed; differing paths:\n{rendered}"


def validate_embedded_inputs(allow_input_drift: bool) -> str:
    """Check the compact inputs, the report and the input receipts against committed evidence.

    Compares their Git blobs with HEAD (the close run adds the ratified baseline it
    quotes) and the input bytes with the committed receipts. Drift fails closed
    unless `allow_input_drift` is set, which names the paths on stderr and returns
    "embedded-drifted"; a clean check returns "embedded".
    """
    evidence_paths: tuple[Path, ...] = (HOSTED_SNAPSHOT, LIVE_SNAPSHOT, ECONOMICS_JSON, INPUT_RECEIPTS)
    if RUN == CLOSE_RUN:
        # The close report quotes the ratified baseline row by row, so the
        # baseline it reads must be the committed one too.
        evidence_paths = (*evidence_paths, baseline_json_path())
    differing_paths = git_blob_drift_paths(evidence_paths)
    expected_receipts = expected_embedded_input_receipts()
    if expected_receipts is None:
        differing_paths.append(portable_path(INPUT_RECEIPTS))
    else:
        differing_paths.extend(differing_receipt_paths(embedded_input_receipts(), expected_receipts))
    differing_paths = sorted(set(differing_paths))
    if differing_paths and not allow_input_drift:
        raise SystemExit(embedded_input_validation_error(differing_paths))
    if differing_paths:
        print(embedded_input_validation_error(differing_paths), file=sys.stderr)
        print(
            "continuing with non-ratified output because --allow-input-drift was supplied",
            file=sys.stderr,
        )
        return "embedded-drifted"
    return "embedded"


def validate_corpus(
    corpus_root: Path,
    expected_receipts: list[dict[str, Any]],
    embedded_frozen: dict[str, Any],
    allow_corpus_drift: bool,
) -> tuple[str, tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]]:
    actual_receipts = corpus_file_receipts(corpus_root)
    differing_paths = differing_receipt_paths(actual_receipts, expected_receipts)
    if differing_paths and not allow_corpus_drift:
        raise SystemExit(corpus_validation_error(differing_paths))

    payloads = frozen_payloads(corpus_root)
    actual_frozen = compact_frozen_inputs_from_payloads(*payloads)
    fact_paths = differing_frozen_fact_paths(actual_frozen, embedded_frozen)
    differing_paths = sorted(set(differing_paths) | set(fact_paths))
    if differing_paths and not allow_corpus_drift:
        raise SystemExit(corpus_validation_error(differing_paths))
    if differing_paths:
        print(corpus_validation_error(differing_paths), file=sys.stderr)
        print("continuing with non-ratified output because --allow-corpus-drift was supplied", file=sys.stderr)
        return "drifted", payloads
    return "validated", payloads


def build_report(
    corpus_root: Path,
    *,
    corpus_requested: bool,
    allow_corpus_drift: bool,
    allow_input_drift: bool = False,
) -> dict[str, Any]:
    # The compact snapshots and receipts are consumed on every path, so they are
    # verified against committed evidence on every path; corpus validation is an
    # additional check, never a substitute for it.
    """Replay the committed inputs into one economics report for the configured run.

    Embedded inputs are validated on every path; a corpus is validated only when
    `--corpus` names it. The baseline sections are computed for every run, and the
    close run adds its own (ruling 8). A drifted corpus or input stamps the
    report as non-ratified.
    """
    embedded_validation = validate_embedded_inputs(allow_input_drift)
    if not LIVE_SNAPSHOT.is_file():
        raise SystemExit(f"missing {portable_path(LIVE_SNAPSHOT)}; run --capture-live")
    if not HOSTED_SNAPSHOT.is_file():
        raise SystemExit(f"missing {portable_path(HOSTED_SNAPSHOT)}; run --capture-hosted")
    live_snapshot = parse_json_file(LIVE_SNAPSHOT)
    hosted_snapshot = parse_json_file(HOSTED_SNAPSHOT)
    if live_snapshot.get("schemaVersion") != LIVE_SCHEMA:
        raise SystemExit("unsupported live snapshot schema")
    if hosted_snapshot.get("schemaVersion") != HOSTED_SCHEMA:
        raise SystemExit("unsupported hosted snapshot schema")

    embedded_frozen = live_snapshot.get("frozen")
    if not isinstance(embedded_frozen, dict):
        raise SystemExit("compact live input has no embedded frozen facts")
    expected_corpus_receipts = load_worktree_corpus_receipts()
    corpus_validation = "embedded"
    # A corpus is validated only when `--corpus` names it. The repository copy
    # was redacted after ratification (#1032, #1037, #1041: message text only),
    # so its digests no longer match the ratified receipts and an implicit
    # validation would fail every default replay closed.
    if corpus_requested and corpus_root.is_dir():
        committed_receipts = load_committed_corpus_receipts()
        corpus_validation, payloads = validate_corpus(
            corpus_root,
            committed_receipts,
            embedded_frozen,
            allow_corpus_drift,
        )
        frozen_attempts, frozen_verdicts, admissions = payloads
        expected_corpus_receipts = committed_receipts
        print(
            f"using {corpus_validation} run2 fleet corpus from {portable_path(corpus_root)}",
            file=sys.stderr,
        )
    elif corpus_requested:
        raise SystemExit(f"corpus validation failed; corpus directory is missing: {portable_path(corpus_root)}")
    else:
        frozen_attempts, frozen_verdicts, admissions = embedded_frozen_payloads(live_snapshot)
        print(
            f"no --corpus given; using frozen facts embedded in {portable_path(LIVE_SNAPSHOT)}",
            file=sys.stderr,
        )
    live_attempts, live_verdicts, states, rss = live_payloads(live_snapshot)
    source_receipts = [
        file_receipt(LIVE_SNAPSHOT, "replay-live-snapshot"),
        file_receipt(HOSTED_SNAPSHOT, "replay-hosted-snapshot"),
        file_receipt(SCRIPT, "reproduction-script"),
    ]
    all_attempt_sources = [*frozen_attempts, *live_attempts]
    all_verdict_sources = [*frozen_verdicts, *live_verdicts]
    attempts, diagnostics = load_attempts(all_attempt_sources, all_verdict_sources)
    ring = ring_buffer_quality(frozen_attempts, live_attempts)
    wrappers, wrapper_totals = lane_metrics(attempts)
    hosted = hosted_metrics(hosted_snapshot)
    amplification = execution_amplification(attempts, hosted_snapshot, hosted)
    comparable = comparable_attempts(attempts)
    red_green = red_to_green(attempts)
    first_failure = first_failure_metrics(attempts)
    fingerprint = fingerprint_quality(attempts, states)
    data_quality = output_quality(
        attempts,
        diagnostics,
        ring,
        live_snapshot,
        hosted_snapshot,
        states,
        rss,
    )
    measurement_times = [
        parse_ts(data_quality["attemptWindowEndUtc"]),
        parse_ts(live_snapshot.get("capturedAt")),
        parse_ts(hosted_snapshot.get("capturedAt")),
    ]
    measurement_as_of = format_ts(max(value for value in measurement_times if value is not None))
    report = {
        "admission": admission_metrics(admissions),
        "attempts": {
            "all": attempt_outcomes(attempts),
            "comparable": attempt_outcomes(comparable),
        },
        "dataQuality": data_quality,
        "executionAmplification": amplification,
        "firstFailure": first_failure,
        "hosted": hosted,
        "inputs": {
            "corpusFiles": expected_corpus_receipts,
            "digestAlgorithm": "sha256 truncated to 12 lowercase hex characters",
            "sourceFiles": sorted(source_receipts, key=lambda row: (str(row.get("path")), str(row.get("kind")))),
        },
        "localWrapperLanes": wrappers,
        "localWrapperTotals": wrapper_totals,
        "measurementAsOf": measurement_as_of,
        "redToGreen": red_green,
        "requiredContextRows": merge_context_tables(hosted, amplification),
        "schemaVersion": REPORT_SCHEMA,
        "sources": {
            "frozenCaptureAt": live_snapshot.get("frozenCaptureAt"),
            "frozenCorpus": DEFAULT_CORPUS_RELATIVE.as_posix(),
            "hostedSnapshot": portable_path(HOSTED_SNAPSHOT),
            "liveSnapshot": portable_path(LIVE_SNAPSHOT),
        },
        "unchangedFingerprint": fingerprint,
    }
    if RUN == CLOSE_RUN:
        add_close_sections(
            report,
            attempts=attempts,
            starts=start_rows(all_attempt_sources),
            states=states,
            hosted_snapshot=hosted_snapshot,
            hosted=hosted,
        )
    if corpus_validation == "drifted":
        report["corpusValidation"] = "drifted"
    elif embedded_validation == "embedded-drifted":
        report["corpusValidation"] = "embedded-drifted"
    return redact(report)


def add_close_sections(
    report: dict[str, Any],
    *,
    attempts: list[dict[str, Any]],
    starts: dict[tuple[str, str, str], dt.datetime | None],
    states: list[dict[str, Any]],
    hosted_snapshot: dict[str, Any],
    hosted: dict[str, Any],
) -> None:
    """The close run's additive sections; the baseline document never carries them."""
    baseline_path = baseline_json_path()
    baseline = parse_json_file(baseline_path)
    if not isinstance(baseline, dict) or baseline.get("schemaVersion") != REPORT_SCHEMA:
        raise SystemExit(f"malformed baseline report {portable_path(baseline_path)}")
    cut = parse_ts(baseline.get("dataQuality", {}).get("liveCapturedAt"))
    if cut is None:
        raise SystemExit(f"baseline report {portable_path(baseline_path)} has no liveCapturedAt")
    inner_rows, inner_totals = inner_lane_metrics(attempts)
    report["run"] = CLOSE_RUN
    report["localInnerLanes"] = inner_rows
    report["localInnerTotals"] = inner_totals
    report["redToGreen"] = red_to_green(attempts, include_inner=True)
    report["unchangedFingerprint"] = close_fingerprint_quality(attempts, states)
    report["terminations"] = termination_metrics(attempts, starts)
    report["dataQuality"]["innerLaneDurationLimitation"] = (
        "post-A5 verdicts list inner lanes with durationMs and parentLaneId after their wrappers; "
        "wrapper and inner lanes are separate populations (ruling 74) and are never summed; "
        "pre-A5 verdicts carry wrappers only"
    )
    post_baseline = post_baseline_metrics(attempts, starts, hosted_snapshot, hosted, cut)
    report["postBaseline"] = post_baseline
    report["baselineComparison"] = {
        "baseline": portable_path(baseline_path),
        "baselineLiveCapturedAt": format_ts(cut),
        "rows": baseline_comparison(baseline, report, post_baseline),
    }


def validate_public_hygiene(paths: list[Path]) -> None:
    forbidden = absolute_home_path_pattern()
    for path in paths:
        data = gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            raise SystemExit(f"invalid UTF-8 evidence in {portable_path(path)}") from None
        if forbidden.search(text):
            raise SystemExit(f"absolute home path leaked into {portable_path(path)}")
        if path != SCRIPT and re.search(
            rb"(?i)(?:authorization:\s*bearer|github_pat_|gh[pousr]_[A-Za-z0-9])", data
        ):
            raise SystemExit(f"credential-shaped text leaked into {portable_path(path)}")


def configure_run(run: str) -> None:
    """Point the module's input and output paths at one run's files."""
    global RUN, INPUT_ROOT, LIVE_SNAPSHOT, HOSTED_SNAPSHOT, INPUT_RECEIPTS, ECONOMICS_JSON, ECONOMICS_MD
    if run not in RUN_NAMES:
        raise SystemExit(f"unknown run {run!r}; expected one of {', '.join(RUN_NAMES)}")
    RUN = run
    close = run == CLOSE_RUN
    INPUT_ROOT = OUTPUT_ROOT / "inputs" / CLOSE_INPUT_DIRECTORY if close else OUTPUT_ROOT / "inputs"
    LIVE_SNAPSHOT = INPUT_ROOT / "live-journals.json.gz"
    HOSTED_SNAPSHOT = INPUT_ROOT / "hosted-runs.json.gz"
    INPUT_RECEIPTS = INPUT_ROOT / "RECEIPTS.json"
    ECONOMICS_JSON = OUTPUT_ROOT / (CLOSE_JSON_NAME if close else "economics.json")
    ECONOMICS_MD = OUTPUT_ROOT / (CLOSE_MD_NAME if close else "economics.md")


def main() -> None:
    """Command-line entry: capture fresh inputs, or replay the committed inputs into the run's JSON and markdown reports."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run",
        choices=RUN_NAMES,
        default=BASELINE_RUN,
        help=(
            "baseline (default): the ratified P0 inputs and economics.json/.md; close: the P4 close re-run, "
            "inputs under inputs/close/ and economics-close.json/.md beside the baseline"
        ),
    )
    parser.add_argument(
        "--projects-root",
        type=Path,
        help="directory holding every clone and lane (default: derived from the repository root)",
    )
    parser.add_argument("--capture-live", action="store_true", help="capture current mutable fleet journal inputs")
    parser.add_argument("--capture-hosted", action="store_true", help="capture the last 14 UTC dates of Check runs")
    parser.add_argument(
        "--corpus",
        type=Path,
        help=f"run2 fleet corpus directory to validate (repository fallback: {DEFAULT_CORPUS_RELATIVE.as_posix()})",
    )
    parser.add_argument(
        "--allow-corpus-drift",
        action="store_true",
        help="allow a differing corpus and stamp both outputs as non-ratified",
    )
    parser.add_argument(
        "--allow-input-drift",
        action="store_true",
        help="allow differing embedded replay evidence and stamp both outputs as non-ratified",
    )
    parser.add_argument(
        "--from-inputs",
        action="store_true",
        help="replay the committed compact gzip inputs (automatic when both inputs exist)",
    )
    args = parser.parse_args()
    if args.allow_corpus_drift and args.corpus is None:
        parser.error("--allow-corpus-drift requires --corpus <dir>")
    if args.allow_input_drift and args.corpus is not None:
        parser.error("--allow-input-drift cannot be combined with --corpus")
    global PROJECTS_ROOT
    if args.projects_root is not None:
        if not args.projects_root.is_dir():
            parser.error(f"--projects-root is not a directory: {args.projects_root}")
        PROJECTS_ROOT = args.projects_root.resolve()
    if args.run != BASELINE_RUN:
        configure_run(args.run)
    corpus_root = args.corpus if args.corpus is not None else DEFAULT_CORPUS
    if args.capture_live:
        capture_live(corpus_root)
    if args.capture_hosted:
        capture_hosted()
    if args.capture_live or args.capture_hosted:
        if RUN == CLOSE_RUN and LIVE_SNAPSHOT.is_file() and HOSTED_SNAPSHOT.is_file():
            write_input_receipts()
        return

    from_inputs = args.from_inputs or (LIVE_SNAPSHOT.is_file() and HOSTED_SNAPSHOT.is_file())
    if not from_inputs:
        raise SystemExit("committed compact inputs are absent; run --capture-live and --capture-hosted")

    report = build_report(
        corpus_root,
        corpus_requested=args.corpus is not None,
        allow_corpus_drift=args.allow_corpus_drift,
        allow_input_drift=args.allow_input_drift,
    )
    write_json(ECONOMICS_JSON, report)
    ECONOMICS_MD.write_text(render_economics(report), encoding="utf-8")
    validate_public_hygiene([SCRIPT, LIVE_SNAPSHOT, HOSTED_SNAPSHOT, ECONOMICS_JSON, ECONOMICS_MD])
    print(f"wrote {portable_path(ECONOMICS_JSON)}")
    print(f"wrote {portable_path(ECONOMICS_MD)} ({len(ECONOMICS_MD.read_text(encoding='utf-8').splitlines())} lines)")


if __name__ == "__main__":
    main()
