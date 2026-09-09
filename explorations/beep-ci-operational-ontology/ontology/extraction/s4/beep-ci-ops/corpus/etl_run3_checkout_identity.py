"""Capture and verify a public run-3 Stage A corpus.

Run with ``uv run --offline --with pyyaml python <this-script>``.
First success pins; ordinary reruns verify ONLY pinned bytes and this generator.
``--refresh`` deliberately captures again. Do not hand-edit generated payloads.
Stdlib + PyYAML only. Run-2 mechanics are copied, never imported or modified;
each run-3 generator is standalone so its self-pin covers its full implementation.
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
import socket
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, NoReturn, TypeAlias

import yaml

SCRIPT = Path(__file__).resolve()
CORPUS_ROOT = SCRIPT.parent
MANIFEST_NAME = "MANIFEST.yaml"
PROJECTION_KIND = "properties_projection"
ATTEMPT_SCHEMA = "yeet-attempt-journal/v1"
ADMISSION_SCHEMAS = {f"yeet-admission-journal/v{version}" for version in (1, 2, 3)}
CLI = "packages/tooling/tool/cli/src/"
REPO_RUN = CLI + "internal/repo-run/"
YEET = CLI + "commands/Yeet/internal/"
def _repo_root() -> Path:
    for parent in (SCRIPT, *SCRIPT.parents):
        if (parent / ".git").exists():
            return parent
    raise SystemExit("refusing: generator is not inside a git checkout")


REPO_ROOT = _repo_root()
FLEET_ROOT = REPO_ROOT.parent
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


def host_prefixes() -> list[tuple[str, str]]:
    """Longest prefixes first also cover a session temp root nested under home."""
    roots = {str(Path(os.sep) / "tmp"): "<tmp>", str(Path.home()): "<home>"}
    session = str(Path(tempfile.gettempdir()))
    if session != str(Path(os.sep) / "tmp"):
        roots[session] = "<session-tmp>"
    roots[str(FLEET_ROOT)] = "<fleet>"
    return sorted(roots.items(), key=lambda item: -len(item[0]))


def redact_string(value: str) -> str:
    for prefix, replacement in host_prefixes():
        value = value.replace(prefix + "/", replacement + "/")
        # Also replace a bare root, including roots embedded in command arguments.
        value = re.sub(re.escape(prefix) + r"(?=$|[\s\"'=:,;)\]])", replacement, value)
    hostname = socket.gethostname()
    value = value.replace(sha256(hostname.encode())[:12], "<host>")
    value = value.replace(hostname, "<host>")
    value = re.sub(r"beep-admit-uid-\d+", "beep-admit-uid-<uid>", value)
    value = re.sub(r"merged-preview-\d+", "merged-preview-<process>", value)
    return PID_IN_TEXT.sub("pid <redacted>", value)


def process_member(key: str) -> bool:
    return key.replace("_", "").replace("-", "").lower() in {
        "pid", "ppid", "ownerpid", "parentpid", "processid", "procstart",
        "procstarttime", "processstart", "processstarttime", "processstartticks",
    }


def guard_origin(value: str) -> None:
    if re.search(r"://[^/@]+@", value):
        fail("origin credential guard: URL userinfo is forbidden")
    # SCP-form git@host:path is retained. Any other userinfo is refused.
    if "@" in value and not re.match(r"git@[^/:]+:[^\s]+$", value):
        fail("origin credential guard: unexpected or token-looking userinfo")
    scan_output_bytes([("origin", value.encode())])


def redact(value: JsonValue, salt: bytes | None, counts: collections.Counter,
           preserve_origins: bool = False) -> JsonValue:
    """Mint custody before dropping process members; transform string leaves only."""
    if isinstance(value, str):
        return redact_string(value)
    if isinstance(value, list):
        return [redact(child, salt, counts, preserve_origins) for child in value]
    if not isinstance(value, dict):
        return value
    result: dict[str, JsonValue] = {}
    if "pid" in value and salt is not None:
        if "ownerRef" in value:
            fail("source ownerRef collides with capture custody surrogate")
        if type(value["pid"]) is not int:
            fail("custody pid is not an integer")
        start = value.get("procStart", "<absent>")
        if start is not None and not isinstance(start, (str, int)):
            fail("custody procStart is not a scalar")
        # captureSalt is the hexadecimal representation of 32 random bytes.
        result["ownerRef"] = sha256(f"{value['pid']}:{start}:{salt.hex()}".encode())[:12]
        counts["owner_refs"] += 1
        if "procStart" not in value:
            counts["owner_refs_without_proc_start"] += 1
    for key, child in value.items():
        if process_member(key):
            counts["dropped_" + key] += 1
            continue
        if preserve_origins and key in {"originUrl", "origin_url"}:
            if child is None and key == "origin_url":
                result[key] = None
                continue
            if not isinstance(child, str):
                fail("origin URL is not a string")
            guard_origin(child)
            result[key] = child
        else:
            result[key] = redact(child, salt, counts, preserve_origins)
    return result


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
    return PurePosixPath(raw_path).with_suffix(".properties").as_posix()


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


def scan_output_bytes(files: list[tuple[str, bytes]]) -> None:
    """Fail closed without printing matched private bytes (including path names)."""
    hostname = socket.gethostname().encode()
    forbidden = [(prefix + "/").encode() for prefix, _ in host_prefixes()]
    forbidden += [b"/home/", b"/tmp/", hostname, sha256(hostname)[:12].encode()]
    for _label, data in files:
        combined = _label.encode() + b"\n" + data
        bare_root = any(re.search(re.escape(prefix.encode()) + rb"(?=$|[\s\"'=:,;)\]])", combined)
                        for prefix, _ in host_prefixes())
        if bare_root or any(prefix and prefix in combined for prefix in forbidden):
            fail("residue scan failed: host path, hostname, or hostname digest")
        if re.search(rb"merged-preview-\d+", combined):
            fail("residue scan failed: process identity in preview directory name")
        if PID_IN_TEXT.search(combined.decode("utf-8")):
            fail("residue scan failed: free-text process identifier")
        if b"ghp_" in combined or b"github_pat_" in combined:
            fail("residue scan failed: GitHub credential prefix")
        if OP_REFERENCE_WITH_MATERIAL.search(combined):
            fail("residue scan failed: 1Password reference with credential material")
        if re.search(rb"://[^/@\s\"]+@", combined):
            fail("residue scan failed: credential-bearing URL")
        if re.search(rb"(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)", combined):
            fail("residue scan failed: provider credential or private key")
        if re.search(rb"(?i)(?:authorization[\" ]*[:=]\s*[\"]?bearer\s+\S+|(?:password|api[_-]?key|access[_-]?token|secret)[\" ]*[:=]\s*[\"]?[A-Za-z0-9+/=_-]{16,})", combined):
            fail("residue scan failed: credential assignment")


def strict_object(data: bytes) -> dict[str, JsonValue]:
    """Classified parse failure, with no source bytes in diagnostics."""
    try:
        value = decode_json(data, "source")
    except (SystemExit, ValueError, UnicodeError):
        raise ValueError("invalid-json") from None
    if not isinstance(value, dict):
        raise ValueError("non-object")
    return value


def git(path: Path, *args: str) -> str:
    completed = subprocess.run(["git", "--no-optional-locks", "-C", str(path), *args],
                               capture_output=True, timeout=45)
    if completed.returncode:
        fail("git probe failed: " + " ".join(args) + " (stderr withheld)")
    return completed.stdout.decode("utf-8").strip()


def source_cite(file: str, needle: str) -> dict[str, Any]:
    """Resolve source lines at capture; refuse dirty citations at corpus_commit."""
    content = (REPO_ROOT / file).read_bytes()
    committed = subprocess.run(["git", "show", f"HEAD:{file}"], cwd=REPO_ROOT,
                               capture_output=True, timeout=45)
    if committed.returncode or committed.stdout != content:
        fail("source citation is not identical to corpus_commit: " + file)
    matches = [i for i, line in enumerate(content.decode().splitlines(), 1) if needle in line]
    if not matches:
        fail("source citation anchor missing: " + file)
    return {"file": file, "line": matches[0], "sha256": sha256(content)}


def fact(value: Any, file: str, needle: str) -> dict[str, Any]:
    return {"value": value, "source": source_cite(file, needle)}


def instant() -> str:
    return format_timestamp(dt.datetime.now(dt.timezone.utc))


def complete(source: str, observed_at: str, status: str = "present") -> dict[str, Any]:
    return {"source": source, "world": "closed", "status": status,
            "complete_within": "one read of the named source during this capture; retained window only",
            "observed_at": observed_at, "history_outside_window": "unknown"}


def safe_relative_path(value: Any) -> PurePosixPath:
    if not isinstance(value, str):
        fail("manifest file path is not a string")
    path = PurePosixPath(value)
    if (path.is_absolute() or not path.parts or path.as_posix() != value
            or any(part in {"", ".", ".."} for part in path.parts) or "\\" in value):
        fail("unsafe emitted path")
    if any(ord(c) < 32 for c in value):
        fail("control character in emitted path")
    return path


@dataclasses.dataclass(frozen=True)
class Payload:
    path: str
    data: bytes
    receipt: dict[str, Any]


def payload_pair(path: str, records: list[JsonValue], kind: str, source: str,
                 observed_at: str, **metadata: Any) -> list[Payload]:
    safe_relative_path(path)
    data = encode_ndjson(records) if path.endswith(".ndjson") else encode_json(records[0])
    decoded = decode_ndjson(data, "redacted") if path.endswith(".ndjson") else [decode_json(data, "redacted")]
    if not same_json(decoded, records):
        fail("redaction round-trip changed decoded data")
    times = [t for row in records for t in collect_timestamps(row, "record")]
    bounds = timestamp_bounds(times)
    receipt = {"path": path, "kind": kind, "source": {"file": source, "line": 1},
               "event_count": len(records), "min_timestamp_observed": bounds[0],
               "max_timestamp_observed": bounds[1], **complete(source, observed_at), **metadata}
    # Keep per-file source cites separate from the closed-world descriptor.
    receipt["source"] = {"file": source, "line": 1}
    projection = projection_path(path)
    projection_receipt = {**receipt, "path": projection, "kind": PROJECTION_KIND, "derived_from": path}
    return [Payload(path, data, receipt),
            Payload(projection, encode_properties_projection(records), projection_receipt)]


def finish_manifest(metadata: dict[str, Any], emitted: list[Payload]) -> bytes:
    emitted.sort(key=lambda entry: entry.path)
    if len({entry.path for entry in emitted}) != len(emitted):
        fail("duplicate emitted paths")
    manifest = {"schema_version": MANIFEST_SCHEMA, "generated_by": SCRIPT.name,
                "generator_sha256": sha256(SCRIPT.read_bytes()),
                "corpus_commit": git(REPO_ROOT, "rev-parse", "HEAD"), **metadata,
                "projection_rules": [
                    "config_key_value channel: one .properties sibling for every raw payload",
                    "# record <zero-based-index>; eligible leaf_key=value in source traversal order",
                    "ASCII alphanumeric/underscore keys; nonempty single-line strings, JSON numbers and booleans",
                    "null, empty strings and CR/LF values omitted; duplicate pairs and scalar array leaves retained",
                    "events count raw JSON records once; projections do not double-count events"],
                "redaction_rules": [
                    "All families: longest matching fleet, home, session-tmp, system-tmp prefixes rewritten",
                    "fleet root is <fleet>; home is <home>; temp roots are <session-tmp> and <tmp>",
                    "Process identity members dropped recursively; free-text pid numbers replaced",
                    "Structural keys and non-process numbers, booleans, nulls retain their decoded values",
                    "Lock files and proof-locks are excluded; hostname and sha12(hostname) in string values become <host>; residue fails capture"],
                "files": [{**entry.receipt, "bytes": len(entry.data), "sha256": sha256(entry.data)} for entry in emitted],
                "integrity": {"algorithm": "sha256", "digest_scope": "all payload files; manifest excluded from its own digest"},
                "verification": {"redaction_compare": "PASS", "projection_compare": "PASS", "residue_scan": "PASS"},
                "totals": {"payload_files": len(emitted), "files_emitted": len(emitted) + 1,
                           "events": sum(e.receipt["event_count"] for e in emitted if e.receipt["kind"] != PROJECTION_KIND),
                           "payload_bytes": sum(len(e.data) for e in emitted), "bytes_emitted": 0}}
    for _ in range(12):
        data = (f"# GENERATED by {SCRIPT.name}; do not hand-edit.\n"
                "# Public run-3 Stage A capture; source descriptors are portable.\n"
                + yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True, width=100)).encode()
        total = manifest["totals"]["payload_bytes"] + len(data)
        if manifest["totals"]["bytes_emitted"] == total:
            return data
        manifest["totals"]["bytes_emitted"] = total
    fail("manifest byte total did not reach a fixed point")


def verify_output_tree(root: Path) -> dict[str, Any]:
    """Verify pinned bytes only: no git, fleet scan, source reads, or salt creation."""
    if root.is_symlink() or not root.is_dir():
        fail("pin is not a real directory")
    if any(path.is_symlink() for path in root.rglob("*")):
        fail("symlink in pinned corpus")
    manifest_bytes = (root / MANIFEST_NAME).read_bytes()
    scan_output_bytes([(MANIFEST_NAME, manifest_bytes)])
    if re.search(rb"(?:^|[ \t:'\"])/(?!/)", manifest_bytes, flags=re.MULTILINE):
        fail("manifest contains an absolute host path")
    manifest = yaml.safe_load(manifest_bytes)
    if not isinstance(manifest, dict) or manifest.get("schema_version") != MANIFEST_SCHEMA:
        fail("unsupported manifest schema")
    if manifest.get("generator_sha256") != sha256(SCRIPT.read_bytes()):
        fail("generator digest differs from pin; use --refresh deliberately")
    receipts = manifest["files"]
    paths = [safe_relative_path(r["path"]).as_posix() for r in receipts]
    if paths != sorted(set(paths)):
        fail("manifest paths duplicated or unordered")
    actual = sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and p.name != MANIFEST_NAME)
    if paths != actual:
        fail("payload inventory differs from manifest")
    raw, projections, payload_bytes, events = {}, {}, 0, 0
    for receipt in receipts:
        path = receipt["path"]
        data = (root / path).read_bytes()
        scan_output_bytes([(path, data)])
        if receipt["sha256"] != sha256(data) or receipt["bytes"] != len(data):
            fail("SHA-256 or byte-count mismatch: " + path)
        payload_bytes += len(data)
        if receipt["kind"] == PROJECTION_KIND:
            projections[path] = (receipt, data)
            continue
        rows = decode_ndjson(data, path) if path.endswith(".ndjson") else [decode_json(data, path)]
        if not all(isinstance(row, dict) for row in rows):
            fail("raw payload contains a non-object")
        for row in rows:
            if not same_json(row, redact(row, None, collections.Counter(), True)):
                fail("persisted raw payload is not redaction-idempotent")
            if receipt["kind"] == "admission" and row.get("schemaVersion") not in ADMISSION_SCHEMAS:
                fail("unsupported pinned admission schema")
        if len(rows) != receipt["event_count"]:
            fail("raw event count differs")
        raw[path] = rows
        events += len(rows)
    if len(projections) != len(raw):
        fail("one projection per raw payload is required")
    for path, rows in raw.items():
        projection = projections.get(projection_path(path))
        if projection is None or projection[0].get("derived_from") != path:
            fail("projection linkage differs")
        if projection[1] != encode_properties_projection(rows) or projection[0]["event_count"] != len(rows):
            fail("projection completeness, order or values differ")
    expected = {"payload_files": len(paths), "files_emitted": len(paths) + 1, "events": events,
                "payload_bytes": payload_bytes, "bytes_emitted": payload_bytes + len(manifest_bytes)}
    if manifest["totals"] != expected:
        fail("manifest totals differ from pinned payloads")
    verify_census(manifest, raw)
    return expected


def write_staged_capture(emitted: list[Payload], manifest_bytes: bytes) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix=f".{OUTPUT_ROOT.name}-stage-", dir=CORPUS_ROOT) as name:
        stage = Path(name)
        for entry in emitted:
            destination = stage / entry.path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(entry.data)
        (stage / MANIFEST_NAME).write_bytes(manifest_bytes)
        summary = verify_output_tree(stage)
        if OUTPUT_ROOT.is_symlink():
            fail("refusing to replace symlinked pin")
        backup = CORPUS_ROOT / ("." + OUTPUT_ROOT.name + "-previous")
        if backup.exists() or backup.is_symlink():
            fail("stale backup blocks refresh")
        if OUTPUT_ROOT.exists():
            os.replace(OUTPUT_ROOT, backup)
        try:
            os.replace(stage, OUTPUT_ROOT)
        except BaseException:
            if backup.exists():
                os.replace(backup, OUTPUT_ROOT)
            raise
        if backup.exists():
            shutil.rmtree(backup)
        return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="deliberately replace the pin with one live capture")
    args = parser.parse_args()
    if OUTPUT_ROOT.exists() and not args.refresh:
        summary = verify_output_tree(OUTPUT_ROOT)
    else:
        emitted, metadata = capture()
        manifest = finish_manifest(metadata, emitted)
        scan_output_bytes([(entry.path, entry.data) for entry in emitted] + [(MANIFEST_NAME, manifest)])
        summary = write_staged_capture(emitted, manifest)
    print(json.dumps({"verification": "PASS", **summary}, sort_keys=True))


MANIFEST_SCHEMA = "beep-ci-ops-checkout-identity/v1"
OUTPUT_ROOT = CORPUS_ROOT / "run3-checkout-identity"
WORKTREE_SCHEMA = CLI + "commands/Worktree/Worktree.schemas.ts"


PREVIEW_PROCESS_NAME = re.compile(r"merged-preview-\d+")


def preview_aliases(value: JsonValue) -> dict[str, str]:
    names = set()
    def visit(child: JsonValue) -> None:
        if isinstance(child, str):
            names.update(PREVIEW_PROCESS_NAME.findall(child))
        elif isinstance(child, dict):
            for leaf in child.values():
                visit(leaf)
        elif isinstance(child, list):
            for leaf in child:
                visit(leaf)
    visit(value)
    return {name: f"merged-preview-owner-{index:04d}" for index, name in enumerate(sorted(names))}


def rewrite_preview_paths(value: JsonValue, aliases: dict[str, str]) -> JsonValue:
    """Keep preview roots distinct without persisting their process-number names."""
    if isinstance(value, str):
        return PREVIEW_PROCESS_NAME.sub(lambda match: aliases.get(match[0], "merged-preview-<process>"), value)
    if isinstance(value, list):
        return [rewrite_preview_paths(child, aliases) for child in value]
    if isinstance(value, dict):
        return {key: child if key in {"origin_url", "originUrl"} else rewrite_preview_paths(child, aliases)
                for key, child in value.items()}
    return value


def checkout_label(path: Path) -> str:
    try:
        label = path.relative_to(FLEET_ROOT).as_posix()
    except ValueError:
        portable = redact_string(str(path))
        match = re.fullmatch(r"<(home|tmp|session-tmp)>/(.+)", portable)
        if match is None:
            fail("external fleet checkout has no portable path root")
        root_label = {"home": "operator-home", "tmp": "system-temp", "session-tmp": "session-temp"}[match.group(1)]
        label = f"external/{root_label}/{match.group(2)}"
    safe_relative_path(label)
    return label


def cache_mount(checkout: Path, label: str, env_presence: dict[str, bool]) -> dict[str, Any]:
    config_file = checkout / "turbo.json"
    config_bytes = config_file.read_bytes() if config_file.is_file() else None
    config = strict_object(config_bytes) if config_bytes is not None else {}
    config_at = instant()
    # New globalConfiguration moves cacheDir/remoteCache under global.
    global_config = config.get("global", {}) if config.get("futureFlags", {}).get("globalConfiguration") else config
    if not isinstance(global_config, dict):
        fail("Turbo global configuration is not an object")
    cache_dir = global_config.get("cacheDir") or ".turbo/cache"
    if not isinstance(cache_dir, str):
        fail("Turbo cacheDir is not a string")
    local = checkout / cache_dir
    remote = global_config.get("remoteCache")
    if remote is not None and not isinstance(remote, (dict, bool)):
        fail("Turbo remoteCache has an unsupported shape")
    configured = remote is True or (isinstance(remote, dict) and remote.get("enabled") is not False)
    signature = isinstance(remote, dict) and remote.get("signature") is True
    count = sum(1 for _ in local.iterdir()) if local.is_dir() else 0
    return {"turbo_local_cache_path": str(local), "turbo_local_cache_present": local.is_dir(),
            "turbo_local_cache_entries": count,
            "turbo_local_cache_entries_basis": "immediate directory entries; not deduplicated task hashes",
            "turbo_remote_cache_configured": configured,
            "turbo_remote_cache_env_present": env_presence,
            "turbo_remote_cache_env_scope": "generator process; repeated per binding, not per-checkout configuration",
            "turbo_remote_cache_signature_configured": signature,
            "turbo_configuration_status": "present" if config_file.is_file() else "absent",
            "turbo_configuration_sha256": sha256(config_bytes) if config_bytes is not None else None,
            "turbo_configuration_source": {"file": f"<fleet>/{label}/turbo.json", "line": 1},
            "turbo_configuration_observed_at": config_at,
            "turbo_local_cache_complete_within": "one immediate directory listing during the binding probe",
            "proof_cache_caveat": "necessary, not sufficient for CQ-015 evidence transfer: task-hash granularity still required"}


def capture() -> tuple[list[Payload], dict[str, Any]]:
    if shutil.which("bun") is None:
        fail("bun is not on PATH; cannot capture FleetSnapshot")
    began = instant()
    result = subprocess.run(["bun", "run", "beep", "worktree", "fleet", "--json"],
                            cwd=REPO_ROOT, capture_output=True, timeout=600)
    if result.returncode:
        fail(f"bun run beep worktree fleet --json failed (exit {result.returncode}; stderr withheld)")
    try:
        snapshot = strict_object(result.stdout)
    except ValueError:
        fail("fleet command did not emit one JSON object (output withheld)")
    if snapshot.get("fleetRoot") != str(FLEET_ROOT):
        fail("fleet command root differs from the generator's derived fleet root")
    scanned = snapshot.get("scannedAt")
    if not isinstance(scanned, str):
        fail("FleetSnapshot.scannedAt missing or not a string")
    parse_timestamp_scalar("scannedAt", scanned, "FleetSnapshot")
    checkouts = snapshot.get("checkouts")
    if not isinstance(checkouts, list):
        fail("FleetSnapshot.checkouts is not an array")
    counts = collections.Counter()
    aliases = preview_aliases(snapshot)
    redacted_snapshot = redact(rewrite_preview_paths(snapshot, aliases), None, counts, True)
    emitted = payload_pair("fleet-snapshot.json", [redacted_snapshot], "fleet-snapshot",
                           "bun run beep worktree fleet --json", scanned)
    env_presence = {key: key in os.environ for key in ("TURBO_TOKEN", "TURBO_TEAM", "TURBO_API")}
    bindings, labels = [], set()
    for row in checkouts:
        if not isinstance(row, dict) or row.get("kind") not in {"clone", "linked-worktree"}:
            fail("FleetCheckout has unsupported shape or kind")
        if not isinstance(row.get("path"), str):
            fail("FleetCheckout.path is not a string")
        checkout = Path(row["path"])
        label = checkout_label(Path(rewrite_preview_paths(str(checkout), aliases)))
        if label in labels:
            fail("duplicate checkout identity token")
        labels.add(label)
        probes = {}
        def probe(name: str, *args: str) -> str | None:
            result = subprocess.run(["git", "--no-optional-locks", "-C", str(checkout), *args],
                                    capture_output=True, timeout=45)
            probes[name] = {"command": "git " + " ".join(args),
                            "status": "present" if result.returncode == 0 else "unavailable",
                            "exit_code": result.returncode}
            return result.stdout.decode("utf-8").strip() if result.returncode == 0 else None
        origin = probe("origin", "remote", "get-url", "origin")
        if origin is not None:
            guard_origin(origin)
        branch = row.get("branch")
        if branch is not None and not isinstance(branch, str):
            fail("FleetCheckout.branch is not a string or null")
        git_dir = probe("git_dir", "rev-parse", "--absolute-git-dir")
        common_dir = probe("git_common_dir", "rev-parse", "--path-format=absolute", "--git-common-dir")
        probe_head = probe("head", "rev-parse", "HEAD")
        probe_branch = probe("branch", "branch", "--show-current") or None
        runs = checkout / ".beep/yeet/runs"
        listing = sorted(p.name for p in runs.iterdir() if p.is_dir()) if runs.is_dir() else []
        for name in listing:
            validate_component(name, "run id")
        observed_at = instant()
        binding = {
            "identity_key": f"<fleet>/{label}", "scannedAt": scanned,
            "snapshot_path": row["path"],
            "within_fleet_root": checkout.is_relative_to(FLEET_ROOT),
            "origin_url": origin, "kind": row["kind"], "branch": branch,
            "branch_sha12": sha256(branch.encode())[:12] if branch is not None else None,
            "head": row.get("head"), "git_dir": git_dir, "git_common_dir": common_dir,
            "git_common_dir_role": "checkout-binding fact; not a proof cache",
            "runs_dir_listing": listing,
            "runs_directory_status": "present" if runs.is_dir() else "absent",
            "binding_probe_at": observed_at,
            "git_probes": probes,
            "binding_probe_status": "present" if all(p["status"] == "present" for p in probes.values()) else "degraded",
            "binding_probe_matches_snapshot": (probe_head == row.get("head") and probe_branch == branch)
                if probes["head"]["status"] == probes["branch"]["status"] == "present" else None,
            "probe_head": probe_head, "probe_branch": probe_branch,
            "binding_temporality": "snapshot branch/head at scannedAt; supplementary git/cache probes during capture interval",
            **cache_mount(checkout, label, env_presence),
        }
        binding = redact(rewrite_preview_paths(binding, aliases), None, counts, True)
        path = f"bindings/{label}.json"
        emitted.extend(payload_pair(path, [binding], "checkout-binding", f"<fleet>/{label}", observed_at, checkout=label))
        bindings.append({"checkout": label, "identity_key": binding["identity_key"], "kind": row["kind"],
                         "path": path, **complete(f"<fleet>/{label}", observed_at),
                         "binding_probe_matches_snapshot": binding["binding_probe_matches_snapshot"],
                         "binding_probe_status": binding["binding_probe_status"]})
    source_facts = {
        "checkout_shape": fact("FleetCheckout", WORKTREE_SCHEMA, "export class FleetCheckout extends"),
        "branch_sha12": fact("sha256 UTF-8 branch, lowercase hex first 12", REPO_RUN + "RepoRunArtifacts.ts", "const artifactNameHash ="),
        "runId": fact("<safe-branch>-<sha12(branch)>", REPO_RUN + "RepoRunArtifacts.ts", "pipe(branch, repoRunSafeArtifactName"),
        "turbo_local_cache_default": fact(".turbo/cache", REPO_RUN + "ResidueReap.ts", 'const cacheRoot = path.join(repoRoot, ".turbo", "cache");'),
        "turbo_configuration": fact("no cacheDir or remoteCache override in capture checkout; inspect each checkout separately", "turbo.json", '"$schema":'),
        "turbo_environment_names": fact("presence of TURBO_TOKEN, TURBO_TEAM, TURBO_API is process-scoped", CLI + "internal/cli/TurboCache.ts", "export const TurboCacheEnvName ="),
        "identity_binding_ruling": fact("corpus-local fleet-name token; no rigidity-across-rename claim", "explorations/beep-ci-operational-ontology/DECISIONS.md", "**Ruling 5"),
        "cache_topology_ruling": fact("Turbo proof-cache topology primary; git-common-dir linkage secondary", "explorations/beep-ci-operational-ontology/DECISIONS.md", "**Ruling 12"),
    }
    return emitted, {"capture_instant": scanned, "capture_instant_basis": "FleetSnapshot.scannedAt",
        "capture_started_at": began, "capture_finished_at": instant(), "stage": "A",
        "snapshot_shape": fact("FleetSnapshot", WORKTREE_SCHEMA, "export class FleetSnapshot extends"),
        "snapshot_source": {**complete("bun run beep worktree fleet --json", scanned),
                            "coverage": redacted_snapshot["coverage"],
                            "snapshot_sha256": sha256(emitted[0].data)},
        "checkout_counts": dict(collections.Counter(row["kind"] for row in checkouts)),
        "bindings": sorted(bindings, key=lambda row: row["checkout"]),
        "external_checkout_labels": "external/<portable-root>/<relative-path> aliases the registered worktrees outside fleetRoot; corpus-local labels only, never stable IDs",
        "redaction_counts": dict(sorted(counts.items())), "source_facts": source_facts,
        "merged_preview_path_redaction": {
            "renamed_process_directory_tokens": len(aliases),
            "rule": "merged-preview process-number names become distinct capture-local owner ordinals; no raw mapping recorded",
            "source": source_cite(YEET + "MergedPreview.ts", "export const YEET_MERGED_PREVIEW_DIR_NAME =")},
        "cache_mounts": {
            "primary": "Turbo proof-cache topology",
            "secondary": "git-common-dir is a checkout-binding fact, not a proof cache",
            "necessary_not_sufficient": "CQ-015 evidence transfer still requires task-hash granularity and one epoch",
            "remote_config_semantics": "true only for an explicit enabled remoteCache object/true in turbo.json (global when enabled); omission is false, not proof of runtime disablement",
            "signature_semantics": "true only for remoteCache.signature true; signature key and environment values never read",
            "env_presence_scope": "generator process; not per-checkout; presence does not prove validity or activation",
            "turbo_remote_cache_env_present": env_presence,
            "runtime_override_caveat": "invocation-specific flags and TURBO_CACHE_DIR can override the config topology; no execution result is inferred",
            "install_roots": "skipped by Ruling 12"},
        "temporal_limit": "one logical inventory capture; git/cache probes are interval observations bound to scannedAt, not an atomic machine freeze",
        "n_instant_change_evidence": "deferred; no change-across-time or stable-rename inference",
        "cross_corpus_join": "identity_key <fleet>/<checkout> and runs_dir_listing join run3-fleet checkout/run paths",
        "stage_b": "loss-population and issuance capture gated on v3 journal PR, organic traffic and proof-ledger materialization"}


def verify_census(manifest: dict[str, Any], raw: dict[str, list[JsonValue]]) -> None:
    snapshot = raw["fleet-snapshot.json"][0]
    if manifest["capture_instant"] != snapshot["scannedAt"]:
        fail("capture instant differs from snapshot scannedAt")
    if manifest["snapshot_source"]["snapshot_sha256"] != sha256(encode_json(snapshot)):
        fail("snapshot receipt digest differs")
    expected = {row["path"]: row for row in snapshot["checkouts"]}
    bindings = manifest["bindings"]
    if len(bindings) != len(expected) or len(raw) != len(bindings) + 1:
        fail("binding census differs from snapshot")
    if manifest["checkout_counts"] != dict(collections.Counter(row["kind"] for row in expected.values())):
        fail("checkout kind census differs")
    for receipt in bindings:
        binding = raw[receipt["path"]][0]
        key = receipt["identity_key"]
        snapshot_path = binding["snapshot_path"]
        if snapshot_path not in expected or binding["identity_key"] != key or binding["scannedAt"] != snapshot["scannedAt"]:
            fail("binding identity or instant differs")
        for field in ("kind", "branch", "head"):
            if binding[field] != expected[snapshot_path][field]:
                fail("binding differs from snapshot")
        branch = binding["branch"]
        if binding["branch_sha12"] != (sha256(branch.encode())[:12] if branch is not None else None):
            fail("branch digest differs")
        if binding["turbo_remote_cache_env_present"] != manifest["cache_mounts"]["turbo_remote_cache_env_present"]:
            fail("process environment presence differs across bindings")


if __name__ == "__main__":
    main()
