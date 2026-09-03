#!/usr/bin/env python3
"""Reproduce the time-to-certainty verification-economics snapshot.

The default mode reads the two committed compact gzip inputs under ../inputs/
after verifying their committed Git blobs and independent byte receipts, then
rewrites economics.json and economics.md with stable ordering and nearest-rank
percentiles. Pass --corpus to validate every replayed corpus file and its
compact facts against the committed ratified baseline before use. Drift fails
closed unless the matching explicit override is supplied.
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
PROJECTS_ROOT = REPO_ROOT.parent
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
    "phase",
    "repairCommand",
    "status",
)
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


def redact(value: Any) -> Any:
    if isinstance(value, str):
        value = value.replace(str(Path.home().resolve()), "~")
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


def discover_live_roots() -> list[Path]:
    candidates = [REPO_ROOT]
    candidates.extend(sorted(PROJECTS_ROOT.glob("beep-effect[0-9]*"), key=lambda path: path.name))
    worktrees = PROJECTS_ROOT / "beep-effect-worktrees"
    if worktrees.is_dir():
        candidates.extend(sorted((path for path in worktrees.iterdir() if path.is_dir()), key=lambda path: path.name))
    roots: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen or not (resolved / ".beep" / "yeet" / "runs").is_dir():
            continue
        seen.add(resolved)
        roots.append(resolved)
    return sorted(roots, key=portable_path)


def checkout_label(root: Path) -> str:
    try:
        return root.resolve().relative_to(PROJECTS_ROOT.resolve()).as_posix()
    except ValueError:
        return root.name


def capture_live(corpus_root: Path) -> None:
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
        "discoveryRule": [
            "repository root",
            "numbered sibling checkouts with .beep/yeet/runs",
            "sibling beep-effect-worktrees children with .beep/yeet/runs",
        ],
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
    captured_at = dt.datetime.now(dt.timezone.utc)
    cutoff_date = (captured_at - dt.timedelta(days=14)).date().isoformat()
    list_fields = (
        "databaseId,workflowName,displayTitle,event,status,conclusion,createdAt,updatedAt,"
        "headBranch,headSha,url,attempt"
    )
    list_command = [
        "gh",
        "run",
        "list",
        "--workflow",
        "Check",
        "--created",
        f">={cutoff_date}",
        "--limit",
        "2000",
        "--json",
        list_fields,
    ]
    summaries = json.loads(run_command(list_command, attempts=3))
    if not isinstance(summaries, list):
        raise SystemExit("gh run list returned a non-array payload")
    if len(summaries) >= 2000:
        raise SystemExit("hosted run capture reached its 2000-run safety limit")
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
            "gh run list --workflow Check --created >=YYYY-MM-DD --limit 2000 --json <run fields>",
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
            elif record.get("_tag") == "attempt-terminated" and isinstance(record.get("reason"), str):
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
        ended_at = parse_ts(verdict.get("endedAt") or verdict.get("createdAt") or record.get("recordedAt"))
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


def lane_metrics(attempts: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_lane: dict[tuple[str, str, str], list[tuple[dict[str, Any], float]]] = collections.defaultdict(list)
    all_durations: list[float] = []
    for attempt in attempts:
        for lane in attempt["lanes"]:
            duration = lane.get("durationMs")
            if not isinstance(duration, (int, float)) or duration < 0:
                continue
            key = (str(lane.get("id")), str(lane.get("label")), str(lane.get("phase")))
            by_lane[key].append((attempt, float(duration)))
            all_durations.append(float(duration))
    total = sum(all_durations)
    rows: list[dict[str, Any]] = []
    for (lane_id, label, phase), observations in by_lane.items():
        durations = [duration for _, duration in observations]
        status_counts = collections.Counter(
            str(lane.get("status"))
            for attempt, _ in observations
            for lane in attempt["lanes"]
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
    total_attempt_elapsed = sum(attempt["elapsedMs"] or 0 for attempt in attempts)
    return rows, {
        "accountedLaneTimeAsPctOfAttemptElapsed": pct_value(total, total_attempt_elapsed),
        "measuredLaneExecutions": len(all_durations),
        "totalAttemptElapsedMs": rounded_ms(total_attempt_elapsed),
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


def first_failure_metrics(attempts: list[dict[str, Any]]) -> dict[str, Any]:
    observations: list[dict[str, Any]] = []
    actionable_counts: collections.Counter[str] = collections.Counter()
    proxy_counts: collections.Counter[str] = collections.Counter()
    red_attempts = [attempt for attempt in attempts if attempt.get("outcome") != "success"]
    for attempt in red_attempts:
        proxy_counts[classify_receipt_proxy(attempt)] += 1
        failed = [lane for lane in attempt["lanes"] if lane.get("status") == "failed"]
        granular = next(
            (
                lane
                for lane in failed
                if not str(lane.get("id", "")).startswith(
                    ("full:", "feedback:", "prepare:", "publish:", "monitor:", "closeout:")
                )
            ),
            None,
        )
        actionable = (
            str(granular.get("id"))
            if granular is not None
            else str(attempt.get("failedStepId") or (failed[0].get("id") if failed else "unlocated"))
        )
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
                "laneDurationMs": sum(
                    float(lane["durationMs"])
                    for member in members
                    for lane in member["lanes"]
                    if isinstance(lane.get("durationMs"), (int, float)) and lane["durationMs"] >= 0
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
    rows: list[dict[str, Any]], censored: list[dict[str, Any]], left_censored: list[dict[str, Any]], label: str
) -> dict[str, Any]:
    spans = [row["spanMs"] for row in rows]
    return {
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


def red_to_green(attempts: list[dict[str, Any]]) -> dict[str, Any]:
    comparable = comparable_attempts(attempts)
    uncut, censored, left_censored = build_episodes(comparable)
    cut = [row for row in uncut if row["spanMs"] <= COMPARABLE_EPISODE_CUT_MS]
    cut_summary = episode_summary(
        cut,
        censored,
        left_censored,
        "article-comparable: modes verify/repair/publish; lock bounces and left-censored episodes excluded; <=24h",
    )
    uncut_summary = episode_summary(
        uncut,
        censored,
        left_censored,
        "uncut tail: same modes/bounce/censor rule; no duration ceiling",
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
    lines: list[str] = [
        "# Verification economics — fleet snapshot",
        "",
        "Reproduce from a clean repository clone with the committed compact inputs:",
        "",
        "```sh",
        "python3 goals/time-to-certainty/research/scripts/economics.py --from-inputs",
        "```",
        "",
        (
            "Embedded replay verifies both compact inputs and `economics.json` against HEAD, then checks the "
            "input bytes against `inputs/RECEIPTS.json`; use `--allow-input-drift` only for non-ratified output."
        ),
        "",
        "Validate an available frozen corpus before replaying it:",
        "",
        "```sh",
        "python3 goals/time-to-certainty/research/scripts/economics.py --from-inputs --corpus <dir>",
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
            ["Inputs", f"{len(report['inputs']['sourceFiles'])} replay files and {len(report['inputs']['corpusFiles'])} frozen corpus receipts; every path and sha256_12 in economics.json"],
        ],
    )
    text = "\n".join(lines) + "\n"
    if len(text.splitlines()) > 300:
        raise SystemExit(f"economics.md would exceed 300 lines ({len(text.splitlines())})")
    return text


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


def load_worktree_corpus_receipts() -> list[dict[str, Any]]:
    if not ECONOMICS_JSON.is_file():
        raise SystemExit(f"missing {portable_path(ECONOMICS_JSON)} with frozen corpus receipts")
    report = parse_json_file(ECONOMICS_JSON)
    if not isinstance(report, dict):
        raise SystemExit(f"malformed {portable_path(ECONOMICS_JSON)}")
    return corpus_receipts_from_report(report, portable_path(ECONOMICS_JSON))


def load_committed_corpus_receipts() -> list[dict[str, Any]]:
    relative = ECONOMICS_JSON.relative_to(REPO_ROOT).as_posix()
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


def embedded_input_validation_error(paths: list[str]) -> str:
    rendered = "\n".join(f"  - {path}" for path in sorted(set(paths)))
    return f"embedded input validation failed; differing paths:\n{rendered}"


def validate_embedded_inputs(allow_input_drift: bool) -> str:
    evidence_paths = (HOSTED_SNAPSHOT, LIVE_SNAPSHOT, ECONOMICS_JSON, INPUT_RECEIPTS)
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
    if corpus_root.is_dir():
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
            f"repository corpus absent at {DEFAULT_CORPUS_RELATIVE.as_posix()}; "
            "using frozen facts embedded in live-journals.json.gz",
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
    if corpus_validation == "drifted":
        report["corpusValidation"] = "drifted"
    elif embedded_validation == "embedded-drifted":
        report["corpusValidation"] = "embedded-drifted"
    return redact(report)


def validate_public_hygiene(paths: list[Path]) -> None:
    forbidden = str(Path.home().resolve()).encode("utf-8")
    for path in paths:
        data = gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
        if forbidden in data:
            raise SystemExit(f"absolute home path leaked into {portable_path(path)}")
        if path != SCRIPT and re.search(
            rb"(?i)(?:authorization:\s*bearer|github_pat_|gh[pousr]_[A-Za-z0-9])", data
        ):
            raise SystemExit(f"credential-shaped text leaked into {portable_path(path)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
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
    corpus_root = args.corpus if args.corpus is not None else DEFAULT_CORPUS
    if args.capture_live:
        capture_live(corpus_root)
    if args.capture_hosted:
        capture_hosted()
    if args.capture_live or args.capture_hosted:
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
