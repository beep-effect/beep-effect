"""Transcribe auditor run-2 evidence into ProseObservation records.

Run 2 re-adjudicates only rows whose exact status is ``parked-run-2``.  The
``evidence`` quotes from the pinned ``CANDIDATES.yaml`` and ``LEDGER.yaml`` are
copied verbatim into ``po-<sha12>.yaml`` records; wording is never repaired by
paraphrase.  Evidence with `` ... `` or `` … `` elision markers is split into
independently located verbatim fragments.  A quote shorter than ten stripped
characters is replaced by the raw declared span and that span is extended by
at most three following lines until it is substantive.  If declared
coordinates no longer contain a quote, the smallest containing window of up
to forty lines is recovered across the pinned file and the correction is
reported.  Anything still absent at the pin is reported for manual recapture
and is not emitted.

``PROSE_SOURCES`` supplies the additional whole-document corpus.  Its
deterministic section rule is: find every ATX heading outside fenced code; its
section ends at the next heading of equal or higher rank; select the first
following nonblank, non-heading block in that section (a list, table, quote,
or prose run is one block); and transcribe the raw contiguous line range from
the heading through the end of that block.  A nested heading may therefore be
inside a parent section's span.  This operational definition gives every
section one reproducible heading-plus-first-paragraph observation while
preserving the source bytes modulo the schema's whitespace normalization.

All selected inputs and source bytes come from ``HEAD`` via ``git show`` so
the record commit, span, and quote share one run pin.  Candidate rows are
ordered by their ``candidate`` identifier (then deterministic tie-breakers),
ledger rows by ``id``, and prose sources in ``PROSE_SOURCES`` order.

Run from the repository root:

  uv run --offline --with pyyaml python \
    explorations/beep-ci-operational-ontology/ontology/extraction/s4/\
beep-ci-ops/corpus/po_transcriber_run2.py \
    --repo . --out <prose-observations-dir> [--dry-run]

``--dry-run`` performs the complete pinned transcription census but never
creates the output directory or writes a file.  Python 3.12 and PyYAML are the
only runtime requirements.
"""

from __future__ import annotations

import argparse
import collections
import dataclasses
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any, NoReturn

import yaml


PARKED_RUN2_STATUS = "parked-run-2"
PACKET_ROOT = "explorations/beep-ci-operational-ontology"
CANDIDATES_PATH = f"{PACKET_ROOT}/ontology/extraction/s4/CANDIDATES.yaml"
LEDGER_PATH = f"{PACKET_ROOT}/ontology/extraction/s4/LEDGER.yaml"

# Registry order is part of the deterministic output contract.
PROSE_SOURCES: tuple[str, ...] = (
    f"{PACKET_ROOT}/ontology/docs/s7-projection-contract.md",
    f"{PACKET_ROOT}/ontology/extraction/s7/work-s7/impl-report.md",
    f"{PACKET_ROOT}/research/s7-replay-evidence.md",
)

BUCKET_ORDER = ("candidates", "ledger", "prose_sources")
MAX_RECOVERY_WINDOW_LINES = 40
MAX_SHORT_QUOTE_EXTENSION_LINES = 3

EVIDENCE_RE = re.compile(
    r"^(?P<path>[^\s:]+?)"
    r"(?::(?P<coords>\d+(?:[-–]\d+)?(?:\s*,\s*\d+(?:[-–]\d+)?)*))?"
    r"\s+[—–-]+\s+(?P<quote>.+)$",
    re.S,
)
COORDINATE_RE = re.compile(r"^(?P<start>\d+)(?:[-–](?P<end>\d+))?$")
ELISION_RE = re.compile(r"\s(?:\.\.\.|\u2026)\s")
ATX_HEADING_RE = re.compile(r"^[ ]{0,3}(?P<marks>#{1,6})[ \t]+\S")
FENCE_RE = re.compile(r"^[ ]{0,3}(?P<marker>`{3,}|~{3,})")

# Run-1 manual re-captures are pinned, verbatim fragments.  They are used only
# when the harvested wording itself cannot be found, and every replacement is
# independently located in the run-2 HEAD blob before it can be emitted.
RECAPTURES: dict[tuple[str, str], str] = {
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
        "Gate coordinating one origin-scoped resource (the per-origin full-proof lock)",
    ): "Gate coordinating one origin-scoped resource (the per-origin full-proof",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
        "the per-origin full-proof lock",
    ): "lock) underneath machine-wide admission.",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts",
        "runs use while heartbeating the lease",
    ): "then runs `use` while heartbeating the",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts",
        "pid plus procStart",
    ): "`pid` plus `procStart` (the `/proc/<pid>/stat` start time) identify the",
    (
        "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts",
        "identify the owner across pid reuse",
    ): "owner across pid reuse; leases are reaped only when the pid is dead or the",
    (
        "goals/ship-velocity/research/d1-admission-scheduler.md",
        "The publish kind (1 token) remains in the schema",
    ): "remains in the schema for the",
}


@dataclasses.dataclass(frozen=True)
class Span:
    """One inclusive, one-based source line range."""

    start: int
    end: int


@dataclasses.dataclass(frozen=True)
class Location:
    """A located quote and whether it remained inside declared coordinates."""

    span: Span
    matched_declared_span: bool


@dataclasses.dataclass
class BucketStats:
    """Census values for one deterministic source bucket."""

    selected: int = 0
    inputs: int = 0
    attempts: int = 0
    locatable: int = 0
    drifted: int = 0
    unlocatable: int = 0
    unique_records: int = 0
    duplicates: int = 0


class PinnedRepository:
    """Read and cache files from one immutable Git commit."""

    def __init__(self, repo: Path) -> None:
        self.repo = repo
        self.commit = git_stdout(repo, "rev-parse", "--verify", "HEAD^{commit}")
        self._text_cache: dict[str, str | None] = {}
        self._line_cache: dict[str, list[str] | None] = {}

    def text(self, path: str) -> str | None:
        """Return a UTF-8-decoded pinned blob, or ``None`` when it is absent."""

        if path not in self._text_cache:
            result = subprocess.run(
                ["git", "-C", str(self.repo), "show", f"{self.commit}:{path}"],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            self._text_cache[path] = result.stdout if result.returncode == 0 else None
        return self._text_cache[path]

    def required_text(self, path: str) -> str:
        """Return a pinned control input or stop with a source-specific error."""

        text = self.text(path)
        if text is None:
            fail(f"required pinned input is absent at HEAD: {path}")
        return text

    def lines(self, path: str) -> list[str] | None:
        """Return pinned lines with their original line endings."""

        if path not in self._line_cache:
            text = self.text(path)
            self._line_cache[path] = (
                text.splitlines(keepends=True) if text is not None else None
            )
        return self._line_cache[path]


class Census:
    """Collect records, outcome counts, and stable operator-facing findings."""

    def __init__(self) -> None:
        self.stats = {name: BucketStats() for name in BUCKET_ORDER}
        self.records: dict[str, dict[str, Any]] = {}
        self.drift_findings: list[str] = []
        self.manual_findings: list[str] = []
        self.rule_counts: collections.Counter[str] = collections.Counter()

    def record_success(
        self,
        bucket: str,
        record: dict[str, Any],
        drift_findings: list[str],
    ) -> None:
        """Count one locatable attempt and de-duplicate its canonical record."""

        stats = self.stats[bucket]
        stats.attempts += 1
        if drift_findings:
            stats.drifted += 1
            self.drift_findings.extend(drift_findings)
        else:
            stats.locatable += 1

        record_id = str(record["id"])
        if record_id in self.records:
            stats.duplicates += 1
        else:
            self.records[record_id] = record
            stats.unique_records += 1

    def record_unlocatable(self, bucket: str, finding: str) -> None:
        """Count one failed attempt and retain its manual-recapture report."""

        stats = self.stats[bucket]
        stats.attempts += 1
        stats.unlocatable += 1
        self.manual_findings.append(finding)


def fail(message: str) -> NoReturn:
    """Stop on a control-input or invocation error without a traceback."""

    raise SystemExit(f"po_transcriber_run2: {message}")


def git_stdout(repo: Path, *args: str) -> str:
    """Run one read-only Git query and return stripped stdout."""

    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()
        suffix = f": {detail[-1]}" if detail else ""
        fail(f"git {' '.join(args)} failed{suffix}")
    return result.stdout.strip()


def normalize_whitespace(value: str) -> str:
    """Apply exactly the ProseObservation validator's quote normalization."""

    return re.sub(r"\s+", " ", value).strip()


def canonical_po_id(commit: str, path: str, span: Span, quote: str) -> str:
    """Compute the schema-defined canonical ProseObservation identifier."""

    payload = [commit, path, span.start, span.end, quote]
    digest = hashlib.sha256(
        json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    ).hexdigest()
    return f"po:sha256:{digest}"


def make_record(commit: str, path: str, span: Span, quote: str) -> dict[str, Any]:
    """Build one closed-schema ProseObservation record."""

    record_id = canonical_po_id(commit, path, span, quote)
    return {
        "id": record_id,
        "schema_version": 1,
        "repository": {"commit": commit, "path": path},
        "source_span": {"start_line": span.start, "end_line": span.end},
        "quote": quote,
        "epistemic_status": "quoted_prose",
    }


def unquote(value: str) -> str:
    """Remove one matching evidence-notation quote pair."""

    value = value.strip()
    for opening, closing in (("'", "'"), ('"', '"'), ("‘", "’"), ("“", "”")):
        if len(value) >= 2 and value.startswith(opening) and value.endswith(closing):
            return value[1:-1]
    return value


def parse_declared_spans(coordinates: str | None) -> tuple[Span, ...]:
    """Parse one or more comma-separated evidence coordinate ranges."""

    if coordinates is None:
        return ()
    spans: list[Span] = []
    for raw_coordinate in coordinates.split(","):
        coordinate = raw_coordinate.strip()
        match = COORDINATE_RE.fullmatch(coordinate)
        if match is None:
            fail(f"invalid evidence coordinate {coordinate!r}")
        start = int(match.group("start"))
        end = int(match.group("end") or start)
        if start < 1 or end < start:
            fail(f"invalid evidence span {coordinate!r}")
        spans.append(Span(start, end))
    return tuple(spans)


def span_text(lines: list[str], span: Span) -> str | None:
    """Return a valid inclusive span, rejecting stale out-of-bounds ranges."""

    if span.start < 1 or span.end < span.start or span.end > len(lines):
        return None
    return "".join(lines[span.start - 1 : span.end])


def locate(
    lines: list[str], quote: str, declared_spans: tuple[Span, ...]
) -> Location | None:
    """Locate a quote in declared coordinates or the smallest global window."""

    normalized_quote = normalize_whitespace(quote)
    if not normalized_quote:
        return None

    for declared_span in declared_spans:
        text = span_text(lines, declared_span)
        if text is not None and normalized_quote in normalize_whitespace(text):
            return Location(declared_span, matched_declared_span=True)

    # Avoid enumerating every <=40-line window when the normalized quote is
    # absent from the whole pinned blob.  This is only a fast negative proof;
    # successful recovery still uses the run-1 smallest-window search below.
    if normalized_quote not in normalize_whitespace("".join(lines)):
        return None

    line_count = len(lines)
    for width in range(1, MAX_RECOVERY_WINDOW_LINES + 1):
        for start in range(1, line_count - width + 2):
            recovered = Span(start, start + width - 1)
            text = "".join(lines[start - 1 : start - 1 + width])
            if normalized_quote in normalize_whitespace(text):
                return Location(recovered, matched_declared_span=False)
    return None


def format_declared_spans(spans: tuple[Span, ...]) -> str:
    """Render evidence coordinates compactly for census findings."""

    if not spans:
        return "<none>"
    return ",".join(
        str(span.start) if span.start == span.end else f"{span.start}-{span.end}"
        for span in spans
    )


def summarize_quote(quote: str, limit: int = 140) -> str:
    """Render a whitespace-normalized quote without flooding the census."""

    normalized = normalize_whitespace(quote)
    if len(normalized) <= limit:
        return repr(normalized)
    return repr(normalized[: limit - 1] + "…")


def candidate_sort_key(row: dict[str, Any]) -> tuple[str, ...]:
    """Order candidate identifiers deterministically despite repeated spellings."""

    source_lanes = row.get("source_lanes")
    lanes = source_lanes if isinstance(source_lanes, list) else []
    canonical_row = json.dumps(
        row,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )
    return (
        str(row.get("candidate", "")),
        str(row.get("kind", "")),
        str(row.get("source_domain", "")),
        "\x1f".join(str(lane) for lane in lanes),
        canonical_row,
    )


def candidate_origin(row: dict[str, Any]) -> str:
    """Give repeated candidate spellings an intelligible report identity."""

    candidate = str(row.get("candidate", "<missing>"))
    qualifier = row.get("source_domain")
    if qualifier is None:
        source_lanes = row.get("source_lanes")
        lanes = source_lanes if isinstance(source_lanes, list) else []
        qualifier = ",".join(str(lane) for lane in lanes) or row.get("kind")
    return f"candidate:{candidate}[{qualifier}]"


def load_rows(pinned: PinnedRepository, path: str) -> list[dict[str, Any]]:
    """Decode a pinned YAML sequence and reject malformed row shapes."""

    try:
        decoded = yaml.safe_load(pinned.required_text(path))
    except yaml.YAMLError as exc:
        fail(f"cannot decode {path}: {exc}")
    if not isinstance(decoded, list):
        fail(f"{path} must contain a YAML sequence")
    rows: list[dict[str, Any]] = []
    for index, row in enumerate(decoded, start=1):
        if not isinstance(row, dict):
            fail(f"{path} row {index} is not a mapping")
        rows.append(row)
    return rows


def selected_evidence(
    pinned: PinnedRepository, census: Census
) -> list[tuple[str, str, str]]:
    """Select and order parked run-2 evidence from candidates and ledger."""

    work: list[tuple[str, str, str]] = []

    candidates = [
        row
        for row in load_rows(pinned, CANDIDATES_PATH)
        if row.get("status") == PARKED_RUN2_STATUS
    ]
    candidates.sort(key=candidate_sort_key)
    census.stats["candidates"].selected = len(candidates)
    for row in candidates:
        evidence = row.get("evidence")
        if not isinstance(evidence, list):
            fail(f"{candidate_origin(row)} evidence must be a list")
        for index, entry in enumerate(evidence, start=1):
            if not isinstance(entry, str):
                fail(f"{candidate_origin(row)} evidence {index} must be a string")
            work.append(("candidates", candidate_origin(row), entry))

    ledger = [
        row
        for row in load_rows(pinned, LEDGER_PATH)
        if row.get("status") == PARKED_RUN2_STATUS
    ]
    ledger.sort(
        key=lambda row: (
            str(row.get("id", "")),
            json.dumps(
                row,
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
                default=str,
            ),
        )
    )
    census.stats["ledger"].selected = len(ledger)
    for row in ledger:
        evidence = row.get("evidence")
        if not isinstance(evidence, str):
            fail(f"ledger:{row.get('id', '<missing>')} evidence must be a string")
        work.append(("ledger", f"ledger:{row.get('id', '<missing>')}", evidence))

    return work


def extend_short_quote(
    lines: list[str], declared_spans: tuple[Span, ...]
) -> tuple[str, Span] | None:
    """Apply the run-1 raw-span extension rule to a short evidence quote."""

    if not declared_spans:
        return None
    base = declared_spans[0]
    if span_text(lines, base) is None:
        return None

    end = base.end
    grown = "".join(lines[base.start - 1 : end]).strip()
    extra = 0
    while (
        len(normalize_whitespace(grown)) < 10
        and extra < MAX_SHORT_QUOTE_EXTENSION_LINES
        and end < len(lines)
    ):
        end += 1
        extra += 1
        grown = "".join(lines[base.start - 1 : end]).strip()
    if len(normalize_whitespace(grown)) < 10:
        return None
    return grown, Span(base.start, end)


def resolve_fragment(
    *,
    bucket: str,
    origin: str,
    path: str,
    lines: list[str],
    declared_spans: tuple[Span, ...],
    quote: str,
    pinned: PinnedRepository,
    census: Census,
    prelocated: Location | None = None,
    initial_drift_findings: tuple[str, ...] = (),
) -> None:
    """Locate and record one substantive evidence fragment."""

    location = prelocated if prelocated is not None else locate(lines, quote, declared_spans)
    drift_findings = list(initial_drift_findings)

    if location is None:
        recapture = RECAPTURES.get((path, normalize_whitespace(quote)))
        if recapture is not None:
            recaptured_location = locate(lines, recapture, declared_spans)
            if recaptured_location is not None:
                drift_findings.append(
                    f"{origin}: {path}:{format_declared_spans(declared_spans)} "
                    f"used pinned verbatim recapture {summarize_quote(recapture)} "
                    f"for harvest wording {summarize_quote(quote)}"
                )
                quote = recapture
                location = recaptured_location
                census.rule_counts["pinned verbatim recaptures"] += 1

    if location is None:
        census.record_unlocatable(
            bucket,
            f"{origin}: {path}:{format_declared_spans(declared_spans)} "
            f"quote not found at HEAD; manually recapture {summarize_quote(quote)}",
        )
        return

    if declared_spans and not location.matched_declared_span:
        drift_findings.append(
            f"{origin}: {path}:{format_declared_spans(declared_spans)} "
            f"recovered at {location.span.start}-{location.span.end} for "
            f"{summarize_quote(quote)}"
        )
        census.rule_counts["recovered spans"] += 1

    record = make_record(pinned.commit, path, location.span, quote)
    census.record_success(bucket, record, drift_findings)


def transcribe_evidence(
    bucket: str,
    origin: str,
    evidence: str,
    pinned: PinnedRepository,
    census: Census,
) -> None:
    """Parse one evidence entry and apply the run-1 transcription rules."""

    census.stats[bucket].inputs += 1
    raw_evidence = evidence.strip()
    match = EVIDENCE_RE.fullmatch(raw_evidence)
    if match is None:
        census.record_unlocatable(
            bucket,
            f"{origin}: unparsed evidence entry; manually recapture "
            f"{summarize_quote(raw_evidence)}",
        )
        return

    path = match.group("path")
    declared_spans = parse_declared_spans(match.group("coords"))
    quote = unquote(match.group("quote"))
    lines = pinned.lines(path)
    path_drift_findings: tuple[str, ...] = ()
    if lines is None and not path.startswith(f"{PACKET_ROOT}/"):
        packet_path = f"{PACKET_ROOT}/{path}"
        packet_lines = pinned.lines(packet_path)
        if packet_lines is not None:
            path_drift_findings = (
                f"{origin}: resolved packet-relative evidence path {path} to "
                f"{packet_path}",
            )
            path = packet_path
            lines = packet_lines
    if lines is None:
        census.record_unlocatable(
            bucket,
            f"{origin}: source file absent at HEAD: {path}; evidence "
            f"{summarize_quote(quote)}",
        )
        return

    if len(quote.strip()) < 10:
        extended = extend_short_quote(lines, declared_spans)
        if extended is None:
            census.record_unlocatable(
                bucket,
                f"{origin}: {path}:{format_declared_spans(declared_spans)} short "
                f"quote cannot be extended; manually recapture {summarize_quote(quote)}",
            )
            return
        extended_quote, extended_span = extended
        census.rule_counts["short quote extensions"] += 1
        resolve_fragment(
            bucket=bucket,
            origin=origin,
            path=path,
            lines=lines,
            declared_spans=(extended_span,),
            quote=extended_quote,
            pinned=pinned,
            census=census,
            prelocated=Location(extended_span, matched_declared_span=True),
            initial_drift_findings=path_drift_findings,
        )
        return

    whole_location = locate(lines, quote, declared_spans)
    if ELISION_RE.search(quote) and whole_location is None:
        fragments = [
            fragment.strip()
            for fragment in ELISION_RE.split(quote)
            if fragment.strip()
        ]
        substantive_fragments = [
            fragment for fragment in fragments if len(fragment.strip()) >= 10
        ]
        if not substantive_fragments:
            census.record_unlocatable(
                bucket,
                f"{origin}: {path}:{format_declared_spans(declared_spans)} elided "
                f"quote has no substantive fragments; manually recapture "
                f"{summarize_quote(quote)}",
            )
            return
        census.rule_counts["elided quotes split"] += 1
        for fragment in substantive_fragments:
            resolve_fragment(
                bucket=bucket,
                origin=origin,
                path=path,
                lines=lines,
                declared_spans=declared_spans,
                quote=fragment,
                pinned=pinned,
                census=census,
                initial_drift_findings=path_drift_findings,
            )
        return

    resolve_fragment(
        bucket=bucket,
        origin=origin,
        path=path,
        lines=lines,
        declared_spans=declared_spans,
        quote=quote,
        pinned=pinned,
        census=census,
        prelocated=whole_location,
        initial_drift_findings=path_drift_findings,
    )


def markdown_headings(lines: list[str]) -> list[tuple[int, int]]:
    """Return zero-based ATX heading indexes and ranks outside fenced code."""

    headings: list[tuple[int, int]] = []
    fence_character: str | None = None
    fence_length = 0

    for index, line in enumerate(lines):
        fence_match = FENCE_RE.match(line)
        if fence_match is not None:
            marker = fence_match.group("marker")
            if fence_character is None:
                fence_character = marker[0]
                fence_length = len(marker)
            elif marker[0] == fence_character and len(marker) >= fence_length:
                fence_character = None
                fence_length = 0
            continue
        if fence_character is not None:
            continue
        heading_match = ATX_HEADING_RE.match(line)
        if heading_match is not None:
            headings.append((index, len(heading_match.group("marks"))))
    return headings


def prose_section_spans(lines: list[str]) -> tuple[list[Span], list[int]]:
    """Choose heading-to-first-block spans and headings with no body block."""

    headings = markdown_headings(lines)
    heading_indexes = {index for index, _rank in headings}
    spans: list[Span] = []
    empty_heading_lines: list[int] = []

    for position, (heading_index, rank) in enumerate(headings):
        section_end = len(lines)
        for next_index, next_rank in headings[position + 1 :]:
            if next_rank <= rank:
                section_end = next_index
                break

        cursor = heading_index + 1
        while cursor < section_end and (
            not lines[cursor].strip() or cursor in heading_indexes
        ):
            cursor += 1
        if cursor >= section_end:
            empty_heading_lines.append(heading_index + 1)
            continue

        block_end = cursor + 1
        while (
            block_end < section_end
            and lines[block_end].strip()
            and block_end not in heading_indexes
        ):
            block_end += 1
        spans.append(Span(heading_index + 1, block_end))

    return spans, empty_heading_lines


def transcribe_prose_sources(pinned: PinnedRepository, census: Census) -> None:
    """Transcribe deterministic Markdown section spans from the registry."""

    stats = census.stats["prose_sources"]
    stats.selected = len(PROSE_SOURCES)
    for path in PROSE_SOURCES:
        lines = pinned.lines(path)
        if lines is None:
            stats.inputs += 1
            census.record_unlocatable(
                "prose_sources",
                f"prose source absent at HEAD; manually recapture: {path}",
            )
            continue

        spans, empty_heading_lines = prose_section_spans(lines)
        for line_number in empty_heading_lines:
            stats.inputs += 1
            census.record_unlocatable(
                "prose_sources",
                f"{path}:{line_number} heading has no first paragraph block",
            )

        for span in spans:
            stats.inputs += 1
            text = span_text(lines, span)
            quote = text.strip() if text is not None else ""
            if (
                len(quote) < 10
                or text is None
                or normalize_whitespace(quote) not in normalize_whitespace(text)
            ):
                census.record_unlocatable(
                    "prose_sources",
                    f"{path}:{span.start}-{span.end} deterministic section span "
                    "is not a substantive verbatim quote",
                )
                continue
            record = make_record(pinned.commit, path, span, quote)
            census.record_success("prose_sources", record, [])


def emit_records(output: Path, records: dict[str, dict[str, Any]]) -> None:
    """Write unique records without relying on hash-prefix collisions."""

    output.mkdir(parents=True, exist_ok=True)
    filenames: dict[str, str] = {}
    for record_id, record in records.items():
        digest = record_id.removeprefix("po:sha256:")
        filename = f"po-{digest[:12]}.yaml"
        previous = filenames.get(filename)
        if previous is not None and previous != record_id:
            fail(f"12-hex output filename collision: {previous} and {record_id}")
        filenames[filename] = record_id
        (output / filename).write_text(
            yaml.safe_dump(
                record,
                sort_keys=False,
                allow_unicode=True,
                width=100,
            ),
            encoding="utf-8",
        )


def print_census(
    pinned: PinnedRepository,
    census: Census,
    *,
    dry_run: bool,
    output: Path,
) -> None:
    """Print the required stable run-2 census and quote-drift findings."""

    if dry_run:
        print("po_transcriber_run2: DRY RUN (wrote nothing)")
    else:
        print(f"po_transcriber_run2: wrote {len(census.records)} records to {output}")
    print(f"  repository pin: {pinned.commit}")
    print("  source bucket census (attempts are post-elision fragments):")

    total_inputs = 0
    total_attempts = 0
    total_locatable = 0
    total_drifted = 0
    total_unlocatable = 0
    total_unique = 0
    total_duplicates = 0
    for bucket in BUCKET_ORDER:
        stats = census.stats[bucket]
        total_inputs += stats.inputs
        total_attempts += stats.attempts
        total_locatable += stats.locatable
        total_drifted += stats.drifted
        total_unlocatable += stats.unlocatable
        total_unique += stats.unique_records
        total_duplicates += stats.duplicates
        print(
            f"    {bucket}: selected={stats.selected} inputs={stats.inputs} "
            f"attempts={stats.attempts} locatable={stats.locatable} "
            f"drifted={stats.drifted} unlocatable={stats.unlocatable} "
            f"unique={stats.unique_records} duplicates={stats.duplicates}"
        )

    print(
        f"  total: inputs={total_inputs} attempts={total_attempts} "
        f"locatable={total_locatable} drifted={total_drifted} "
        f"unlocatable={total_unlocatable} unique_records={total_unique} "
        f"duplicates={total_duplicates}"
    )
    if total_unique != len(census.records):
        fail("internal census mismatch for unique records")

    if census.rule_counts:
        print("  deterministic transcription rules applied:")
        for label in (
            "elided quotes split",
            "short quote extensions",
            "pinned verbatim recaptures",
            "recovered spans",
        ):
            count = census.rule_counts.get(label, 0)
            if count:
                print(f"    {label}: {count}")

    print(f"  quote-drift findings: {len(census.drift_findings)}")
    for finding in census.drift_findings:
        print(f"    - {finding}")

    print(f"  unlocatable/manual-recapture findings: {len(census.manual_findings)}")
    for finding in census.manual_findings:
        print(f"    - {finding}")


def parse_args() -> argparse.Namespace:
    """Parse the intentionally narrow transcriber interface."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path, help="repository root")
    parser.add_argument("--out", required=True, type=Path, help="record output directory")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the census without creating or writing the output path",
    )
    return parser.parse_args()


def main() -> None:
    """Transcribe all run-2 grounding channels at the current HEAD pin."""

    args = parse_args()
    repo = args.repo.resolve()
    if not repo.is_dir():
        fail(f"--repo is not a directory: {repo}")
    top_level = Path(git_stdout(repo, "rev-parse", "--show-toplevel")).resolve()
    if top_level != repo:
        fail(f"--repo must name the repository root (expected {top_level})")

    pinned = PinnedRepository(repo)
    census = Census()
    for bucket, origin, evidence in selected_evidence(pinned, census):
        transcribe_evidence(bucket, origin, evidence, pinned, census)
    transcribe_prose_sources(pinned, census)

    output = args.out.resolve()
    if not args.dry_run:
        emit_records(output, census.records)
    print_census(
        pinned,
        census,
        dry_run=bool(args.dry_run),
        output=output,
    )


if __name__ == "__main__":
    main()
