"""Capture and verify the auditor run-2 Yeet fleet corpus.

The first successful run pins a redacted public corpus under ``run2-fleet``.
Ordinary reruns verify those pinned bytes and never consult the live fleet;
``--refresh`` deliberately replaces the pin with one new read of every source.

The auditor accepts ``config_key_value`` facts only on config-file extensions:
``.properties`` is accepted, but ``.ndjson`` is not. Its unquoted pairing
grammar also ends values only at end-of-line, so numeric leaves in compact JSON
cannot pair. Derived ``.properties`` files are therefore the grounding channel
for journal measurement vocabulary; the redacted raw files remain the fidelity
record.

Run from the repository root:

  UV_CACHE_DIR="${UV_CACHE_DIR:-${TMPDIR:-/tmp}/beep-ci-ops-uv-cache}" \
    uv run --offline --with pyyaml python \
    explorations/beep-ci-operational-ontology/ontology/extraction/s4/\
beep-ci-ops/corpus/etl_fleet_corpus.py

Only Python's standard library and PyYAML are used.
"""

from __future__ import annotations

import argparse
import collections
import dataclasses
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, NoReturn, TypeAlias

import yaml


SCRIPT = Path(__file__).resolve()
CORPUS_ROOT = SCRIPT.parent
OUTPUT_ROOT = CORPUS_ROOT / "run2-fleet"
MANIFEST_NAME = "MANIFEST.yaml"

def _repo_root() -> Path:
    for parent in (SCRIPT, *SCRIPT.parents):
        if (parent / ".git").exists():
            return parent
    raise SystemExit("refusing: generator is not inside a git checkout")


# Host-specific locations are DERIVED, never literal: the committed generator
# must carry no absolute host paths (repo lint gate), and deriving the fleet
# root from the checkout's own parent keeps the sweep portable across clones.
REPO_ROOT = _repo_root()
FLEET_ROOT = REPO_ROOT.parent


def admission_sources() -> list[tuple[str, Path]]:
    """Every admission-journal root on this machine, labeled portably.

    The deployed scheduler resolves its journal directory through the process
    temp root, so a machine whose agent sessions override TMPDIR grows TWO
    genuine journals (the split-brain admission root): one under the system
    temp root and one under the session temp root. Both are deployed history,
    so the capture takes every root that exists, each under its own label.
    """

    system_root = Path(os.sep) / "tmp"
    session_root = Path(tempfile.gettempdir())
    labeled = [("system-tmp", system_root)]
    if session_root != system_root:
        labeled.append(("session-tmp", session_root))
    return [
        (label, root / f"beep-admit-uid-{os.getuid()}" / "journal.ndjson")
        for label, root in labeled
    ]
FLEET_PATH_PREFIX = f"{FLEET_ROOT}/"
HOME_PATH_PREFIX = str(Path.home())
SYSTEM_TEMP_PATH_PREFIX = f"{Path(os.sep) / 'tmp'}/"

ADMISSION_SCHEMA = "yeet-admission-journal/v1"
ATTEMPT_SCHEMA = "yeet-attempt-journal/v1"
MANIFEST_SCHEMA = "beep-ci-ops-fleet-corpus/v1"
DROP_ADMISSION_FIELDS = ("pid", "procStart")
PROJECTION_KIND = "properties_projection"

PID_IN_TEXT = re.compile(r"\b(pid)[ =:]?[0-9]+")
TIMESTAMP_KEY = re.compile(r"(?:^ts$|AtMillis$|At$|TimestampMillis$|Timestamp$)")
PROPERTY_KEY = re.compile(r"[A-Za-z0-9_]+")
PROPERTY_RECORD_COMMENT = re.compile(r"# record (0|[1-9][0-9]*)")
JSON_VALUE_BYTES = (
    rb'(?:"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?'
    rb'(?:[eE][+-]?\d+)?|true|false|null)'
)

# An unresolved 1Password reference is public-safe. Reject a credential-like
# token appended to it, either by an assignment delimiter or as a long mixed
# alphanumeric token. Token-provider prefixes receive their own byte scans.
OP_REFERENCE_BYTES = (
    rb'op://[^/\s"\'\\]+/[^/\s"\'\\]+/'
    rb'[^\s"\'\\=,:;\]\}\)]+(?:/[^\s"\'\\=,:;\]\}\)]+)?'
)
OP_REFERENCE_WITH_MATERIAL = re.compile(
    OP_REFERENCE_BYTES
    + rb'(?:\s*(?:=|:|->)\s*[^\s,"\'\\\}\]]{4,}'
    + rb'|\s+(?=[A-Za-z0-9+/=_-]{12,}(?:[\s,"\'\\\}\]]|$))'
    + rb'(?=[A-Za-z0-9+/=_-]*[0-9])[A-Za-z0-9+/=_-]{12,})'
)

JsonValue: TypeAlias = (
    type(None) | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)


@dataclasses.dataclass(frozen=True)
class EmittedFile:
    """One fully transformed payload held in memory before staged emission."""

    path: str
    data: bytes
    kind: str
    event_count: int
    timestamps: tuple[dt.datetime, ...]
    source: str
    source_file: str
    checkout: str | None = None
    run_id: str | None = None
    derived_from: str | None = None


@dataclasses.dataclass(frozen=True)
class VerificationSummary:
    """Terminal totals from a complete persisted-corpus verification."""

    files: int
    events: int
    bytes: int


def fail(message: str) -> NoReturn:
    """Terminate with one actionable corpus-contract violation."""

    raise SystemExit(message)


def sha256(data: bytes) -> str:
    """Return the full lowercase SHA-256 digest for exact bytes."""

    return hashlib.sha256(data).hexdigest()


def reject_json_constant(value: str) -> NoReturn:
    """Reject non-standard NaN and infinity JSON constants."""

    fail(f"non-standard JSON constant {value!r}")


def unique_object(pairs: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
    """Decode an object while rejecting duplicate structural keys."""

    result: dict[str, JsonValue] = {}
    for key, value in pairs:
        if key in result:
            fail(f"duplicate JSON object key {key!r}")
        result[key] = value
    return result


def decode_json(data: bytes, label: str) -> JsonValue:
    """Decode one strict UTF-8 JSON document."""

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        fail(f"{label} is not UTF-8: {exc}")
    try:
        return json.loads(
            text,
            object_pairs_hook=unique_object,
            parse_constant=reject_json_constant,
        )
    except json.JSONDecodeError as exc:
        fail(f"{label} is invalid JSON: {exc}")


def decode_ndjson(data: bytes, label: str) -> list[JsonValue]:
    """Decode nonblank NDJSON records in their source order."""

    records: list[JsonValue] = []
    for number, line in enumerate(data.splitlines(), start=1):
        if not line.strip():
            continue
        records.append(decode_json(line, f"{label} line {number}"))
    return records


def same_json(left: JsonValue, right: JsonValue) -> bool:
    """Compare JSON values without conflating booleans, integers, or floats."""

    if type(left) is not type(right):
        return False
    if isinstance(left, dict) and isinstance(right, dict):
        if list(left) != list(right):
            return False
        return all(same_json(left[key], right[key]) for key in left)
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(
            same_json(left_item, right_item)
            for left_item, right_item in zip(left, right, strict=True)
        )
    return left == right


def redact_string(value: str) -> str:
    """Apply the ordered fleet path and free-text PID rules to one value."""

    redacted = value.replace(FLEET_PATH_PREFIX, "<fleet>/")
    redacted = redacted.replace(HOME_PATH_PREFIX, "<home>")
    redacted = redacted.replace(SYSTEM_TEMP_PATH_PREFIX, "<tmp>/")
    return PID_IN_TEXT.sub("pid <redacted>", redacted)


def redact_string_values(value: JsonValue) -> JsonValue:
    """Recursively redact string values while retaining all keys and numbers."""

    if isinstance(value, str):
        return redact_string(value)
    if isinstance(value, list):
        return [redact_string_values(item) for item in value]
    if isinstance(value, dict):
        return {key: redact_string_values(item) for key, item in value.items()}
    return value


def encode_ndjson(records: list[JsonValue]) -> bytes:
    """Serialize records deterministically without changing their order."""

    return b"".join(
        (
            json.dumps(
                record,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            )
            + "\n"
        ).encode("utf-8")
        for record in records
    )


def encode_json(record: JsonValue) -> bytes:
    """Serialize one deterministic, human-readable JSON document."""

    return (
        json.dumps(record, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    ).encode("utf-8")


def render_property_scalar(value: JsonValue) -> str | None:
    """Render one eligible scalar value, or return ``None`` when ineligible."""

    if isinstance(value, str):
        rendered = value
    elif isinstance(value, (bool, int, float)):
        rendered = json.dumps(
            value,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        )
    else:
        return None
    if not rendered or "\r" in rendered or "\n" in rendered:
        return None
    return rendered


def eligible_property_pairs(record: JsonValue) -> list[tuple[str, str]]:
    """Collect eligible leaf-key/scalar pairs in source-document order."""

    if not isinstance(record, dict):
        fail("cannot project a non-object JSON record")
    pairs: list[tuple[str, str]] = []

    def append_scalar(key: str, value: JsonValue) -> None:
        if PROPERTY_KEY.fullmatch(key) is None:
            return
        rendered = render_property_scalar(value)
        if rendered is not None:
            pairs.append((key, rendered))

    def visit_object(value: dict[str, JsonValue]) -> None:
        for key, child in value.items():
            if isinstance(child, dict):
                visit_object(child)
            elif isinstance(child, list):
                visit_array(child, key)
            else:
                append_scalar(key, child)

    def visit_array(value: list[JsonValue], field_name: str) -> None:
        for child in value:
            if isinstance(child, dict):
                visit_object(child)
            elif isinstance(child, list):
                visit_array(child, field_name)
            else:
                append_scalar(field_name, child)

    visit_object(record)
    return pairs


def encode_properties_projection(records: list[JsonValue]) -> bytes:
    """Serialize one deterministic leaf projection stanza per JSON record."""

    lines: list[str] = []
    for index, record in enumerate(records):
        lines.append(f"# record {index}")
        lines.extend(
            f"{key}={value}" for key, value in eligible_property_pairs(record)
        )
    if not lines:
        return b""
    return ("\n".join(lines) + "\n").encode("utf-8")


def projection_path(raw_path: str) -> str:
    """Return the required sibling ``.properties`` path for one raw payload."""

    path = PurePosixPath(raw_path)
    parts = path.parts
    if (
        len(parts) == 3
        and parts[0] == "admission"
        and parts[2] == "journal.ndjson"
    ):
        return path.with_name("journal.properties").as_posix()
    if (
        len(parts) == 4
        and parts[0] == "attempts"
        and parts[3] == "attempts.ndjson"
    ):
        return path.with_name("attempts.properties").as_posix()
    if (
        len(parts) == 4
        and parts[0] == "verdicts"
        and parts[3] == "verdict.json"
    ):
        return path.with_name("verdict.properties").as_posix()
    fail(f"raw payload has no defined projection path: {raw_path}")


def with_properties_projection(
    raw: EmittedFile, records: list[JsonValue]
) -> tuple[EmittedFile, EmittedFile]:
    """Pair one raw payload with its deterministic properties projection."""

    if raw.kind == PROJECTION_KIND or raw.derived_from is not None:
        fail(f"cannot derive a projection from projection receipt {raw.path}")
    if raw.event_count != len(records):
        fail(f"projection record count differs from raw event count for {raw.path}")
    projection = dataclasses.replace(
        raw,
        path=projection_path(raw.path),
        data=encode_properties_projection(records),
        kind=PROJECTION_KIND,
        timestamps=(),
        derived_from=raw.path,
    )
    return raw, projection


def decode_properties_projection(
    data: bytes, label: str
) -> list[list[tuple[str, str]]]:
    """Parse strict record stanzas and split every pair on its first equals."""

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        fail(f"{label} is not UTF-8: {exc}")
    if not text:
        return []
    if not text.endswith("\n"):
        fail(f"{label} lacks its deterministic final newline")

    stanzas: list[list[tuple[str, str]]] = []
    for line_number, line in enumerate(text[:-1].split("\n"), start=1):
        comment = PROPERTY_RECORD_COMMENT.fullmatch(line)
        if comment is not None:
            record_index = int(comment.group(1))
            if record_index != len(stanzas):
                fail(
                    f"{label} line {line_number} has record index {record_index}, "
                    f"expected {len(stanzas)}"
                )
            stanzas.append([])
            continue
        if not stanzas:
            fail(f"{label} line {line_number} precedes its first record stanza")
        key, separator, value = line.partition("=")
        if not separator:
            fail(f"{label} line {line_number} is not a key=value pair")
        if PROPERTY_KEY.fullmatch(key) is None:
            fail(f"{label} line {line_number} has an ineligible key")
        if not value or "\r" in value or "\n" in value:
            fail(f"{label} line {line_number} has an ineligible value")
        stanzas[-1].append((key, value))
    return stanzas


def verify_properties_projection(
    data: bytes, source_records: list[JsonValue], label: str
) -> int:
    """Prove projection pairs are complete, exact, counted, and ordered."""

    stanzas = decode_properties_projection(data, label)
    if len(stanzas) != len(source_records):
        fail(
            f"{label} stanza count {len(stanzas)} differs from source record "
            f"count {len(source_records)}"
        )
    for index, (actual, record) in enumerate(
        zip(stanzas, source_records, strict=True)
    ):
        expected = eligible_property_pairs(record)
        actual_counts = collections.Counter(actual)
        expected_counts = collections.Counter(expected)
        if actual_counts - expected_counts:
            fail(f"{label} record {index} contains an ineligible or altered pair")
        if expected_counts - actual_counts:
            fail(f"{label} record {index} omits an eligible pair occurrence")
        if actual != expected:
            fail(f"{label} record {index} does not retain source-document order")
    return len(stanzas)


def remove_json_member(line: bytes, field: str) -> tuple[bytes, int]:
    """Surgically remove one compact-JSON member, as in the S6 precedent."""

    encoded = re.escape(field.encode("utf-8"))
    with_trailing = re.compile(rb'"' + encoded + rb'":' + JSON_VALUE_BYTES + rb',')
    changed, leading_count = with_trailing.subn(b"", line)
    at_end = re.compile(
        rb',"' + encoded + rb'":' + JSON_VALUE_BYTES + rb'(?=\s*(?:\r?\n)?$)'
    )
    changed, end_count = at_end.subn(b"", changed)
    return changed, leading_count + end_count


def redact_admission(source: bytes) -> tuple[bytes, list[JsonValue]]:
    """Remove exactly two fields and decode-compare every admission event."""

    output: list[bytes] = []
    source_events: list[JsonValue] = []
    redacted_events: list[JsonValue] = []
    removed: collections.Counter[str] = collections.Counter()

    for number, line in enumerate(source.splitlines(keepends=True), start=1):
        if not line.strip():
            output.append(line)
            continue
        source_event = decode_json(line, f"admission source line {number}")
        if not isinstance(source_event, dict):
            fail(f"admission source line {number} is not a JSON object")
        if source_event.get("schemaVersion") != ADMISSION_SCHEMA:
            fail(
                f"admission source line {number} has schema "
                f"{source_event.get('schemaVersion')!r}, expected {ADMISSION_SCHEMA!r}"
            )
        changed = line
        for field in DROP_ADMISSION_FIELDS:
            changed, count = remove_json_member(changed, field)
            removed[field] += count

        redacted_event = decode_json(changed, f"redacted admission line {number}")
        expected = {
            key: value
            for key, value in source_event.items()
            if key not in DROP_ADMISSION_FIELDS
        }
        if not same_json(redacted_event, expected):
            fail(f"admission redaction changed non-redacted data on line {number}")
        source_events.append(source_event)
        redacted_events.append(redacted_event)
        output.append(changed)

    if not source_events:
        fail("admission source contains no events")
    expected_removed = {
        field: sum(
            1
            for event in source_events
            if isinstance(event, dict) and field in event
        )
        for field in DROP_ADMISSION_FIELDS
    }
    if dict(removed) != expected_removed:
        fail(f"admission removal counts {dict(removed)} != {expected_removed}")
    return b"".join(output), redacted_events


def parse_timestamp_scalar(key: str, value: JsonValue, label: str) -> dt.datetime | None:
    """Parse one timestamp-shaped field into a timezone-aware UTC instant."""

    if value is None:
        return None
    if isinstance(value, dict) and value.get("_id") == "Option":
        tag = value.get("_tag")
        if tag == "None":
            return None
        if tag == "Some" and "value" in value:
            return parse_timestamp_scalar(key, value["value"], label)
        fail(f"{label} has an invalid encoded Option timestamp")
    if isinstance(value, bool):
        fail(f"{label} is boolean, not a timestamp")
    if isinstance(value, (int, float)):
        if not key.endswith("Millis"):
            fail(f"{label} is numeric but is not named *Millis")
        try:
            return dt.datetime.fromtimestamp(value / 1000, tz=dt.timezone.utc)
        except (OverflowError, OSError, ValueError) as exc:
            fail(f"{label} has an invalid epoch-millisecond value: {exc}")
    if isinstance(value, str):
        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        try:
            parsed = dt.datetime.fromisoformat(normalized)
        except ValueError as exc:
            fail(f"{label} has an invalid ISO-8601 value: {exc}")
        if parsed.tzinfo is None:
            fail(f"{label} lacks an explicit timezone")
        return parsed.astimezone(dt.timezone.utc)
    fail(f"{label} has unsupported timestamp type {type(value).__name__}")


def collect_timestamps(value: JsonValue, label: str) -> tuple[dt.datetime, ...]:
    """Collect timestamp-shaped fields recursively in traversal order."""

    found: list[dt.datetime] = []

    def visit(current: JsonValue, path: str) -> None:
        if isinstance(current, dict):
            for key, child in current.items():
                child_path = f"{path}.{key}" if path else key
                if TIMESTAMP_KEY.search(key):
                    parsed = parse_timestamp_scalar(key, child, f"{label}:{child_path}")
                    if parsed is not None:
                        found.append(parsed)
                visit(child, child_path)
        elif isinstance(current, list):
            for index, child in enumerate(current):
                visit(child, f"{path}[{index}]")

    visit(value, "")
    return tuple(found)


def format_timestamp(value: dt.datetime) -> str:
    """Render a stable millisecond ISO-8601 UTC timestamp."""

    return value.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def timestamp_bounds(values: list[dt.datetime] | tuple[dt.datetime, ...]) -> tuple[str | None, str | None]:
    """Return portable minimum and maximum timestamps for one census scope."""

    if not values:
        return None, None
    return format_timestamp(min(values)), format_timestamp(max(values))


def validate_component(value: str, label: str) -> None:
    """Keep source basenames safe as destination path components."""

    if value in {"", ".", ".."} or "/" in value or "\\" in value:
        fail(f"unsafe {label} path component {value!r}")
    if any(ord(character) < 32 for character in value):
        fail(f"control character in {label} path component")


def validate_fleet_record(record: JsonValue, kind: str, label: str) -> None:
    """Require known Yeet record envelopes without narrowing their payloads."""

    if not isinstance(record, dict):
        fail(f"{label} is not a JSON object")
    schema = record.get("schemaVersion")
    if kind == "attempts" and schema != ATTEMPT_SCHEMA:
        fail(f"{label} has schema {schema!r}, expected {ATTEMPT_SCHEMA!r}")
    if kind == "verdict" and not (
        isinstance(schema, str) and schema.startswith("yeet-verdict/v")
    ):
        fail(f"{label} has unsupported verdict schema {schema!r}")


def transform_attempts(source: bytes, label: str) -> tuple[bytes, list[JsonValue]]:
    """Redact and round-trip one attempt journal while preserving event order."""

    source_records = decode_ndjson(source, label)
    for index, record in enumerate(source_records, start=1):
        validate_fleet_record(record, "attempts", f"{label} line {index}")
    expected = [redact_string_values(record) for record in source_records]
    output = encode_ndjson(expected)
    decoded = decode_ndjson(output, f"redacted {label}")
    if len(decoded) != len(expected) or any(
        not same_json(actual, wanted)
        for actual, wanted in zip(decoded, expected, strict=True)
    ):
        fail(f"redaction decode-compare failed for {label}")
    return output, decoded


def transform_verdict(source: bytes, label: str) -> tuple[bytes, JsonValue]:
    """Redact and round-trip one verdict document."""

    source_record = decode_json(source, label)
    validate_fleet_record(source_record, "verdict", label)
    expected = redact_string_values(source_record)
    output = encode_json(expected)
    decoded = decode_json(output, f"redacted {label}")
    if not same_json(decoded, expected):
        fail(f"redaction decode-compare failed for {label}")
    return output, decoded


def source_descriptor(checkout: str, run_id: str) -> str:
    """Describe one source without recording its host path."""

    return f"fleet checkout {checkout}, .beep/yeet/runs/{run_id}"


def discover_live_capture() -> list[EmittedFile]:
    """Read every live source exactly once and return verified output bytes."""

    live_admission = [
        (label, source) for label, source in admission_sources() if source.is_file()
    ]
    if not live_admission:
        fail("no live admission journal exists under any known temp root")
    emitted: list[EmittedFile] = []
    for label, source in live_admission:
        admission_bytes, admission_events = redact_admission(source.read_bytes())
        admission_timestamps = tuple(
            timestamp
            for index, event in enumerate(admission_events, start=1)
            for timestamp in collect_timestamps(event, f"admission[{label}] event {index}")
        )
        emitted.extend(
            with_properties_projection(
                EmittedFile(
                    path=f"admission/{label}/journal.ndjson",
                    data=admission_bytes,
                    kind="admission",
                    event_count=len(admission_events),
                    timestamps=admission_timestamps,
                    source=f"machine admission journal ({label} root), yeet-admission-journal/v1",
                    source_file="journal.ndjson",
                ),
                admission_events,
            )
        )

    if not FLEET_ROOT.is_dir():
        fail("fleet project root is missing")
    checkouts = sorted(
        (path for path in FLEET_ROOT.glob("beep-effect*") if path.is_dir()),
        key=lambda path: path.name,
    )
    for checkout_path in checkouts:
        checkout = checkout_path.name
        validate_component(checkout, "checkout")
        runs_root = checkout_path / ".beep/yeet/runs"
        if not runs_root.is_dir():
            continue
        run_directories = sorted(
            (path for path in runs_root.iterdir() if path.is_dir()),
            key=lambda path: path.name,
        )
        for run_directory in run_directories:
            run_id = run_directory.name
            validate_component(run_id, "run id")
            descriptor = source_descriptor(checkout, run_id)

            attempts_source = run_directory / "attempts.ndjson"
            if attempts_source.is_file():
                label = f"{descriptor}, attempts.ndjson"
                data, records = transform_attempts(attempts_source.read_bytes(), label)
                timestamps = tuple(
                    timestamp
                    for index, record in enumerate(records, start=1)
                    for timestamp in collect_timestamps(record, f"{label} record {index}")
                )
                emitted.extend(
                    with_properties_projection(
                        EmittedFile(
                            path=f"attempts/{checkout}/{run_id}/attempts.ndjson",
                            data=data,
                            kind="attempts",
                            event_count=len(records),
                            timestamps=timestamps,
                            source=descriptor,
                            source_file="attempts.ndjson",
                            checkout=checkout,
                            run_id=run_id,
                        ),
                        records,
                    )
                )

            verdict_sources = sorted(
                (path for path in run_directory.glob("verdict*.json") if path.is_file()),
                key=lambda path: path.name,
            )
            if len(verdict_sources) > 1:
                names = [path.name for path in verdict_sources]
                fail(f"{descriptor} has ambiguous verdict sources: {names}")
            if verdict_sources:
                verdict_source = verdict_sources[0]
                label = f"{descriptor}, {verdict_source.name}"
                data, record = transform_verdict(verdict_source.read_bytes(), label)
                emitted.extend(
                    with_properties_projection(
                        EmittedFile(
                            path=f"verdicts/{checkout}/{run_id}/verdict.json",
                            data=data,
                            kind="verdict",
                            event_count=1,
                            timestamps=collect_timestamps(record, label),
                            source=descriptor,
                            source_file=verdict_source.name,
                            checkout=checkout,
                            run_id=run_id,
                        ),
                        [record],
                    )
                )

    paths = [entry.path for entry in emitted]
    if len(paths) != len(set(paths)):
        fail("live source discovery produced duplicate output paths")
    return sorted(emitted, key=lambda entry: entry.path)


def scan_output_bytes(files: list[tuple[str, bytes]]) -> None:
    """Hard-fail public-output host-path and secret byte patterns."""

    for path, data in files:
        if b"/home/" in data:
            fail(f"host-path scan failed for {path}: forbidden /home/ bytes")
        if b"/tmp/" in data:
            fail(f"host-path scan failed for {path}: forbidden /tmp/ bytes")
        if b"ghp_" in data:
            fail(f"secret scan failed for {path}: forbidden GitHub token prefix")
        if b"github_pat_" in data:
            fail(f"secret scan failed for {path}: forbidden GitHub PAT prefix")
        if OP_REFERENCE_WITH_MATERIAL.search(data):
            fail(
                f"secret scan failed for {path}: a 1Password reference is followed "
                "by non-reference credential material"
            )


def build_census(emitted: list[EmittedFile]) -> list[dict[str, Any]]:
    """Build a census that counts files twice but source events only once."""

    grouped: dict[str, list[EmittedFile]] = collections.defaultdict(list)
    for entry in emitted:
        if entry.checkout is not None:
            grouped[entry.checkout].append(entry)

    census: list[dict[str, Any]] = []
    for checkout in sorted(grouped):
        entries = grouped[checkout]
        raw_entries = [entry for entry in entries if entry.kind != PROJECTION_KIND]
        timestamps = [
            timestamp for entry in raw_entries for timestamp in entry.timestamps
        ]
        minimum, maximum = timestamp_bounds(timestamps)
        census.append(
            {
                "checkout": checkout,
                "file_count": len(entries),
                "event_count": sum(entry.event_count for entry in raw_entries),
                "min_timestamp_observed": minimum,
                "max_timestamp_observed": maximum,
            }
        )
    return census


def dump_manifest_with_totals(manifest: dict[str, Any], payload_bytes: int) -> bytes:
    """Serialize YAML while solving the exact emitted-byte total to a fixed point."""

    for _ in range(12):
        body = yaml.safe_dump(
            manifest,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
            width=100,
        )
        data = (
            "# GENERATED by etl_fleet_corpus.py; do not hand-edit.\n"
            "# Public run-2 fleet capture; all source descriptors are portable.\n"
            + body
        ).encode("utf-8")
        exact_total = payload_bytes + len(data)
        if manifest["totals"]["bytes_emitted"] == exact_total:
            return data
        manifest["totals"]["bytes_emitted"] = exact_total
    fail("manifest emitted-byte total did not reach a serialization fixed point")


def build_manifest(emitted: list[EmittedFile]) -> bytes:
    """Build a deterministic portable manifest for verified payload bytes."""

    raw_entries = [entry for entry in emitted if entry.kind != PROJECTION_KIND]
    projection_entries = [
        entry for entry in emitted if entry.kind == PROJECTION_KIND
    ]
    if len(raw_entries) != len(projection_entries):
        fail("captured corpus does not have exactly one projection per raw payload")
    timestamps = [timestamp for entry in raw_entries for timestamp in entry.timestamps]
    if not timestamps:
        fail("captured corpus contains no observable timestamp")
    capture_instant = format_timestamp(max(timestamps))
    admission_entries = [entry for entry in raw_entries if entry.kind == "admission"]
    if not admission_entries:
        fail("captured corpus lacks its admission journal")
    payload_bytes = sum(len(entry.data) for entry in emitted)

    manifest: dict[str, Any] = {
        "schema_version": MANIFEST_SCHEMA,
        "generated_by": "etl_fleet_corpus.py",
        "generator_sha256": sha256(SCRIPT.read_bytes()),
        "capture_instant": capture_instant,
        "capture_instant_basis": "maximum timestamp observed in the captured records",
        "ordering": [
            "checkouts are ordered lexicographically",
            "run ids are ordered lexicographically within each checkout",
            "events retain source order within each journal",
            "file receipts are ordered by emitted relative path",
        ],
        "redaction_rules": [
            (
                "For every admission event, remove the top-level JSON members named pid and "
                "procStart; retain every other decoded key and value exactly."
            ),
            (
                "For attempt and verdict records, recursively transform string values only: "
                "replace the fleet-project host prefix with <fleet>/, then any remaining "
                "operator-home prefix with <home>, then the system temporary-directory prefix "
                "with <tmp>/."
            ),
            (
                r"In those string values, replace each case-sensitive match of "
                r"\b(pid)[ =:]?[0-9]+ with pid <redacted>."
            ),
            "Never transform structural keys, booleans, nulls, or numeric values.",
        ],
        "projection_rules": [
            (
                "Each redacted raw payload has one sibling .properties projection derived "
                "from exactly the JSON records persisted in that raw file; the raw file "
                "remains the fidelity record."
            ),
            (
                "For each zero-based source record, emit # record <n> and then each eligible "
                "scalar leaf as leaf_key=value in source-document traversal order; object "
                "members retain insertion order and array members retain index order."
            ),
            (
                "Nested object leaves use only their leaf key. Scalar array items use the "
                "array field name, while object array items recurse. Duplicate keys and pairs "
                "are retained."
            ),
            (
                "A leaf is eligible only when its key contains ASCII letters, digits, or "
                "underscore and its string, number, or boolean rendering is non-empty and "
                "contains no CR or LF. Strings are verbatim; numbers and booleans use JSON "
                "rendering; nulls and empty strings are omitted."
            ),
            (
                "File counts include raw payloads and projections; event counts count each "
                "source JSON record once and do not double-count its derived stanza."
            ),
        ],
        "admission": [
            {
                "path": entry.path,
                "source": entry.source,
                "event_count": entry.event_count,
                "min_timestamp_observed": timestamp_bounds(entry.timestamps)[0],
                "max_timestamp_observed": timestamp_bounds(entry.timestamps)[1],
            }
            for entry in sorted(admission_entries, key=lambda entry: entry.path)
        ],
        "checkouts": build_census(emitted),
        "files": [
            {
                "path": entry.path,
                "kind": entry.kind,
                "source": entry.source,
                "source_file": entry.source_file,
                "event_count": entry.event_count,
                "bytes": len(entry.data),
                "sha256": sha256(entry.data),
                **(
                    {"derived_from": entry.derived_from}
                    if entry.derived_from is not None
                    else {}
                ),
            }
            for entry in emitted
        ],
        "integrity": {
            "algorithm": "sha256",
            "digest_scope": (
                "Every payload file is digested above; MANIFEST.yaml is excluded from its own "
                "digest inventory to avoid a self-referential digest."
            ),
        },
        "verification": {
            "redaction_compare": "PASS",
            "projection_compare": "PASS",
            "host_path_scan": "PASS",
            "secret_scan": "PASS",
        },
        "totals": {
            "payload_files": len(emitted),
            "files_emitted": len(emitted) + 1,
            "events": sum(entry.event_count for entry in raw_entries),
            "payload_bytes": payload_bytes,
            "bytes_emitted": 0,
        },
    }
    return dump_manifest_with_totals(manifest, payload_bytes)


def safe_relative_path(value: Any) -> PurePosixPath:
    """Decode one manifest path and reject absolute or escaping forms."""

    if not isinstance(value, str):
        fail("manifest file path is not a string")
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        fail(f"manifest has unsafe emitted path {value!r}")
    return path


def verify_redaction_for_persisted(
    kind: str, data: bytes, label: str
) -> tuple[list[JsonValue], tuple[dt.datetime, ...]]:
    """Prove persisted data is decoded, schema-valid, and redaction-idempotent."""

    if kind == "admission":
        records = decode_ndjson(data, label)
        for index, record in enumerate(records, start=1):
            if not isinstance(record, dict):
                fail(f"{label} line {index} is not a JSON object")
            if record.get("schemaVersion") != ADMISSION_SCHEMA:
                fail(f"{label} line {index} has an unsupported admission schema")
            residue = [field for field in DROP_ADMISSION_FIELDS if field in record]
            if residue:
                fail(f"{label} line {index} retains admission fields {residue}")
    elif kind == "attempts":
        records = decode_ndjson(data, label)
        for index, record in enumerate(records, start=1):
            validate_fleet_record(record, "attempts", f"{label} line {index}")
            if not same_json(redact_string_values(record), record):
                fail(f"{label} line {index} is not redaction-idempotent")
    elif kind == "verdict":
        record = decode_json(data, label)
        validate_fleet_record(record, "verdict", label)
        if not same_json(redact_string_values(record), record):
            fail(f"{label} is not redaction-idempotent")
        records = [record]
    else:
        fail(f"manifest declares unsupported file kind {kind!r}")

    timestamps = tuple(
        timestamp
        for index, record in enumerate(records, start=1)
        for timestamp in collect_timestamps(record, f"{label} record {index}")
    )
    return records, timestamps


def verify_output_tree(root: Path) -> VerificationSummary:
    """Verify digests, projections, census, redaction, and public scans."""

    manifest_path = root / MANIFEST_NAME
    if not manifest_path.is_file():
        fail(f"pinned corpus is incomplete: missing {MANIFEST_NAME}; use --refresh")
    manifest_bytes = manifest_path.read_bytes()
    try:
        manifest = yaml.safe_load(manifest_bytes)
    except yaml.YAMLError as exc:
        fail(f"{MANIFEST_NAME} is invalid YAML: {exc}")
    if not isinstance(manifest, dict) or manifest.get("schema_version") != MANIFEST_SCHEMA:
        fail(f"{MANIFEST_NAME} has an unsupported schema")
    if manifest.get("generator_sha256") != sha256(SCRIPT.read_bytes()):
        fail("generator digest differs from the pinned manifest; use --refresh deliberately")
    if re.search(rb"/(?:home|tmp)(?:/|\b)", manifest_bytes):
        fail(f"{MANIFEST_NAME} contains a non-portable home or temporary path")
    if re.search(rb"(?:^|[ \t:'\"])/(?!/)", manifest_bytes, flags=re.MULTILINE):
        fail(f"{MANIFEST_NAME} contains an absolute host path")

    receipts = manifest.get("files")
    if not isinstance(receipts, list):
        fail(f"{MANIFEST_NAME} files is not a list")
    receipt_paths = [
        safe_relative_path(receipt.get("path") if isinstance(receipt, dict) else None)
        for receipt in receipts
    ]
    if [path.as_posix() for path in receipt_paths] != sorted(path.as_posix() for path in receipt_paths):
        fail("manifest file receipts are not deterministically ordered")
    if len(receipt_paths) != len(set(receipt_paths)):
        fail("manifest contains duplicate file receipts")

    actual_payload_paths = sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file() and path != manifest_path
    )
    if actual_payload_paths != [path.as_posix() for path in receipt_paths]:
        fail("pinned payload file set differs from the manifest inventory")

    receipt_by_path: dict[str, dict[str, Any]] = {}
    payload_data: dict[str, bytes] = {}
    raw_records: dict[str, list[JsonValue]] = {}
    raw_timestamps: dict[str, tuple[dt.datetime, ...]] = {}
    raw_kinds: dict[str, str] = {}
    projection_sources: dict[str, str] = {}
    scan_files: list[tuple[str, bytes]] = [(MANIFEST_NAME, manifest_bytes)]
    payload_bytes = 0

    for receipt, relative in zip(receipts, receipt_paths, strict=True):
        if not isinstance(receipt, dict):
            fail("manifest file receipt is not an object")
        path = root.joinpath(*relative.parts)
        if path.is_symlink():
            fail(f"emitted payload must not be a symlink: {relative.as_posix()}")
        data = path.read_bytes()
        label = relative.as_posix()
        if receipt.get("sha256") != sha256(data):
            fail(f"SHA-256 mismatch for {label}")
        if receipt.get("bytes") != len(data):
            fail(f"byte-count mismatch for {label}")
        kind = receipt.get("kind")
        if not isinstance(kind, str):
            fail(f"missing file kind for {label}")

        if kind == PROJECTION_KIND:
            derived_from = safe_relative_path(receipt.get("derived_from")).as_posix()
            projection_sources[label] = derived_from
        else:
            if "derived_from" in receipt:
                fail(f"raw payload {label} unexpectedly declares derived_from")
            records, timestamps = verify_redaction_for_persisted(kind, data, label)
            if receipt.get("event_count") != len(records):
                fail(f"event-count mismatch for {label}")
            raw_records[label] = records
            raw_timestamps[label] = timestamps
            raw_kinds[label] = kind

        receipt_by_path[label] = receipt
        payload_data[label] = data
        payload_bytes += len(data)
        scan_files.append((label, data))

    if len(projection_sources) != len(raw_records):
        fail("pinned corpus does not have exactly one projection per raw payload")
    for raw_label, records in raw_records.items():
        expected_projection = projection_path(raw_label)
        if projection_sources.get(expected_projection) != raw_label:
            fail(f"missing or incorrectly linked projection for {raw_label}")
        raw_receipt = receipt_by_path[raw_label]
        projection_receipt = receipt_by_path[expected_projection]
        if projection_receipt.get("source") != raw_receipt.get("source"):
            fail(f"projection source descriptor differs from {raw_label}")
        if projection_receipt.get("source_file") != raw_receipt.get("source_file"):
            fail(f"projection source file differs from {raw_label}")
        projected_events = verify_properties_projection(
            payload_data[expected_projection], records, expected_projection
        )
        if projection_receipt.get("event_count") != projected_events:
            fail(f"event-count mismatch for {expected_projection}")
    for projection_label, raw_label in projection_sources.items():
        if raw_label not in raw_records:
            fail(f"projection {projection_label} names a missing raw payload")

    total_events = 0
    admission_rows: dict[str, dict[str, Any]] = {}
    census_accumulator: dict[str, dict[str, Any]] = collections.defaultdict(
        lambda: {"files": 0, "events": 0, "timestamps": []}
    )
    for label, records in raw_records.items():
        kind = raw_kinds[label]
        timestamps = raw_timestamps[label]
        events = len(records)
        receipt = receipt_by_path[label]
        parts = PurePosixPath(label).parts
        if kind == "admission":
            if len(parts) != 3 or parts[0] != "admission" or parts[2] != "journal.ndjson":
                fail(f"admission payload path has an unexpected shape: {label}")
            if label in admission_rows:
                fail(f"manifest repeats admission payload {label}")
            expected_admission_source = (
                f"machine admission journal ({parts[1]} root), yeet-admission-journal/v1"
            )
            if receipt.get("source") != expected_admission_source:
                fail("admission file receipt has a non-portable or incorrect source descriptor")
            minimum, maximum = timestamp_bounds(timestamps)
            admission_rows[label] = {
                "path": label,
                "source": expected_admission_source,
                "event_count": events,
                "min_timestamp_observed": minimum,
                "max_timestamp_observed": maximum,
            }
        elif kind in {"attempts", "verdict"}:
            expected_root = "attempts" if kind == "attempts" else "verdicts"
            expected_name = "attempts.ndjson" if kind == "attempts" else "verdict.json"
            if (
                len(parts) != 4
                or parts[0] != expected_root
                or parts[3] != expected_name
            ):
                fail(f"fleet payload path has an unexpected shape: {label}")
            checkout = parts[1]
            run_id = parts[2]
            expected_source = source_descriptor(checkout, run_id)
            if receipt.get("source") != expected_source:
                fail(f"non-portable or incorrect source descriptor for {label}")
            accumulator = census_accumulator[checkout]
            accumulator["files"] += 2
            accumulator["events"] += events
            accumulator["timestamps"].extend(timestamps)
        else:
            fail(f"manifest declares unsupported raw file kind {kind!r}")
        total_events += events

    if not admission_rows:
        fail("manifest contains no admission payload")
    expected_admission = [admission_rows[path] for path in sorted(admission_rows)]
    if manifest.get("admission") != expected_admission:
        fail("manifest admission census differs from emitted records")

    expected_census = []
    for checkout in sorted(census_accumulator):
        accumulator = census_accumulator[checkout]
        minimum, maximum = timestamp_bounds(accumulator["timestamps"])
        expected_census.append(
            {
                "checkout": checkout,
                "file_count": accumulator["files"],
                "event_count": accumulator["events"],
                "min_timestamp_observed": minimum,
                "max_timestamp_observed": maximum,
            }
        )
    if manifest.get("checkouts") != expected_census:
        fail("manifest checkout census differs from emitted records")

    all_timestamps = [
        timestamp
        for label in admission_rows
        for timestamp in raw_timestamps[label]
    ]
    for accumulator in census_accumulator.values():
        all_timestamps.extend(accumulator["timestamps"])
    if not all_timestamps:
        fail("pinned corpus contains no observable timestamp")
    if manifest.get("capture_instant") != format_timestamp(max(all_timestamps)):
        fail("manifest capture instant is not the maximum observed timestamp")

    totals = manifest.get("totals")
    expected_totals = {
        "payload_files": len(receipts),
        "files_emitted": len(receipts) + 1,
        "events": total_events,
        "payload_bytes": payload_bytes,
        "bytes_emitted": payload_bytes + len(manifest_bytes),
    }
    if totals != expected_totals:
        fail(f"manifest totals differ from emitted corpus: {totals!r} != {expected_totals!r}")
    if manifest.get("verification") != {
        "redaction_compare": "PASS",
        "projection_compare": "PASS",
        "host_path_scan": "PASS",
        "secret_scan": "PASS",
    }:
        fail("manifest verification receipt is incomplete")

    scan_output_bytes(scan_files)
    return VerificationSummary(
        files=len(receipts) + 1,
        events=total_events,
        bytes=payload_bytes + len(manifest_bytes),
    )


def write_staged_capture(emitted: list[EmittedFile], manifest_bytes: bytes) -> VerificationSummary:
    """Persist a complete tree, verify it, then atomically replace the pin."""

    CORPUS_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".run2-fleet-stage-", dir=CORPUS_ROOT) as name:
        stage = Path(name)
        for entry in emitted:
            relative = safe_relative_path(entry.path)
            destination = stage.joinpath(*relative.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(entry.data)
        (stage / MANIFEST_NAME).write_bytes(manifest_bytes)
        summary = verify_output_tree(stage)

        if OUTPUT_ROOT.is_symlink():
            fail("refusing to replace a symlinked run2-fleet output")
        if not OUTPUT_ROOT.exists():
            os.replace(stage, OUTPUT_ROOT)
            return summary

        backup = CORPUS_ROOT / ".run2-fleet-previous"
        if backup.exists() or backup.is_symlink():
            fail("stale run2-fleet backup blocks atomic refresh")
        os.replace(OUTPUT_ROOT, backup)
        try:
            os.replace(stage, OUTPUT_ROOT)
        except BaseException:
            os.replace(backup, OUTPUT_ROOT)
            raise
        shutil.rmtree(backup)
        return summary


def print_summary(summary: VerificationSummary) -> None:
    """Print the exact requested run totals and verification results."""

    print(f"total files emitted: {summary.files}")
    print(f"total events: {summary.events}")
    print(f"total bytes: {summary.bytes}")
    print("redaction compare: PASS")
    print("projection compare: PASS")
    print("host-path scan: PASS")
    print("secret scan: PASS")


def parse_args() -> argparse.Namespace:
    """Parse the sole explicit recapture switch."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="recapture the live admission journal and all live fleet run files",
    )
    return parser.parse_args()


def main() -> None:
    """Verify the pin by default, or capture once when absent/refreshing."""

    args = parse_args()
    if OUTPUT_ROOT.exists() and not args.refresh:
        if not OUTPUT_ROOT.is_dir() or OUTPUT_ROOT.is_symlink():
            fail("run2-fleet exists but is not a real directory")
        print_summary(verify_output_tree(OUTPUT_ROOT))
        return

    emitted = discover_live_capture()
    scan_output_bytes([(entry.path, entry.data) for entry in emitted])
    manifest_bytes = build_manifest(emitted)
    scan_output_bytes([(entry.path, entry.data) for entry in emitted] + [(MANIFEST_NAME, manifest_bytes)])
    print_summary(write_staged_capture(emitted, manifest_bytes))


if __name__ == "__main__":
    main()
