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


MANIFEST_SCHEMA = "beep-ci-ops-run3-fleet-corpus/v1"
OUTPUT_ROOT = CORPUS_ROOT / "run3-fleet"


def admission_sources() -> list[tuple[str, Path]]:
    leaf = f"beep-admit-uid-{os.getuid()}"
    roots = [("canonical", Path.home() / ".beep/runtime"),
             ("system-tmp", Path(os.sep) / "tmp")]
    session = Path(tempfile.gettempdir())
    if session != roots[1][1]:
        roots.append(("session-tmp", session))
    return [(label, root / leaf) for label, root in roots]


def discover_checkouts() -> list[tuple[str, Path, str]]:
    found = {}
    for path in sorted(FLEET_ROOT.glob("beep-effect*")):
        if path.is_dir() and (path / ".git").exists():
            found[path] = (path.name, path, "linked-worktree" if (path / ".git").is_file() else "clone")
    for parent in sorted(FLEET_ROOT.glob("*-worktrees")):
        if parent.is_dir():
            for path in sorted(parent.iterdir()):
                if path.is_dir() and (path / ".git").exists():
                    found[path] = (parent.name + "/" + path.name, path, "linked-worktree")
    for label, _, _ in found.values():
        safe_relative_path(label)
    return sorted(found.values())


def event_census(rows: list[JsonValue]) -> list[dict[str, Any]]:
    counter = collections.Counter((r.get("schemaVersion", "<absent>"), r.get("_tag", "<absent>")) for r in rows)
    return [{"schemaVersion": key[0], "_tag": key[1], "rows": value}
            for key, value in sorted(counter.items())]


def transform_source(data: bytes, kind: str, salt: bytes, ndjson: bool = True) -> tuple[list[JsonValue], dict[str, Any]]:
    """Exclude undecodable rows by reason without ever persisting their raw bytes."""
    rows, retained_lines, rejected = [], [], collections.Counter()
    counts = collections.Counter()
    observed = 0
    for number, line in enumerate(data.splitlines() if ndjson else [data], 1):
        if not line.strip():
            continue
        observed += 1
        try:
            record = strict_object(line)
            if kind == "admission" and (not isinstance(record.get("schemaVersion"), str)
                                        or record["schemaVersion"] not in ADMISSION_SCHEMAS):
                raise ValueError("unknown-schema-version")
            if any(key in record and not isinstance(record[key], str) for key in ("schemaVersion", "_tag")):
                raise ValueError("invalid-envelope")
            transformed = redact(record, salt, counts)
        except ValueError as exc:
            rejected[str(exc)] += 1
            continue
        rows.append(transformed)
        retained_lines.append(number)
    return rows, {"observed_rows": observed, "retained_rows": len(rows),
                  "retained_source_lines": retained_lines,
                  "excluded_undecodable": sum(rejected.values()), "excluded_by_reason": dict(sorted(rejected.items())),
                  "redaction_counts": dict(sorted(counts.items())), "events": event_census(rows)}


def rider_evidence(raw: dict[str, list[JsonValue]]) -> dict[str, Any]:
    """Census structured classified occurrences, never infer a resolver decision from prose."""
    failure_hits, cache_hits, key_counts = [], [], collections.Counter()
    def visit(value: JsonValue, location: str, failures: list, caches: list) -> None:
        if isinstance(value, dict):
            if value.get("failureKind") and value.get("failedStepId"):
                failures.append(location + ".failureKind+failedStepId")
            for key, child in value.items():
                if any(token in key.lower() for token in ("signature", "cache", "failure")):
                    key_counts[key] += 1
                if key == "flakeQuarantine" and isinstance(child, list):
                    failures.extend(location + ".flakeQuarantine" for item in child
                                    if isinstance(item, dict) and item.get("policy") and item.get("taskId"))
                if key in {"failureSignature", "failure_signature"} and child:
                    failures.append(location + "." + key)
                if key in {"cachePlanResolution", "cachePlan", "turboCachePlan"} and isinstance(child, dict):
                    caches.append(location + "." + key)
                visit(child, location + "." + key, failures, caches)
        elif isinstance(value, list):
            for i, child in enumerate(value):
                visit(child, f"{location}[{i}]", failures, caches)
    for path, rows in sorted(raw.items()):
        if not path.startswith(("attempts/", "verdicts/")):
            continue
        for i, row in enumerate(rows):
            failures, caches = [], []
            visit(row, f"record[{i}]", failures, caches)
            failure_hits.extend({"file": path, "record": i, "field": field} for field in failures)
            cache_hits.extend({"file": path, "record": i, "field": field} for field in caches)
    return {"pa-failure-signature": {"rider_evidence": "present" if failure_hits else "absent",
                "structured_occurrences": len(failure_hits), "occurrences": failure_hits,
                "searched_fields": ["failureKind + failedStepId", "flakeQuarantine[].policy + taskId", "failureSignature", "failure_signature"],
                "caveat": "occurrences retain failureKind and failedStepId together; optional attemptId supplies the execution join; ratification remains with the steward"},
            "pa-cache-plan-resolution": {"rider_evidence": "present" if cache_hits else "absent",
                "structured_occurrences": len(cache_hits), "occurrences": cache_hits,
                "searched_fields": ["cachePlanResolution", "cachePlan", "turboCachePlan"],
                "caveat": "cacheStatus or a cache flag alone does not serialize a resolver result/execution join"},
            "observed_related_leaf_keys": dict(sorted(key_counts.items()))}


def capture() -> tuple[list[Payload], dict[str, Any]]:
    started = instant()
    salt = os.urandom(32)  # Never store, print, or return this capture-local secret.
    emitted, roots, checkouts, source_receipts, raw = [], [], [], [], {}
    def collect(path: Path, destination: str, kind: str, source: str,
                ndjson: bool = True, **metadata: Any) -> dict[str, Any]:
        observed_at = instant()
        rows, census = transform_source(path.read_bytes(), kind, salt, ndjson)
        if not ndjson and not rows:
            return {**complete(source, observed_at, "excluded"), **census}
        pair = payload_pair(destination, rows, kind, source, observed_at, **metadata)
        emitted.extend(pair)
        raw[destination] = rows
        return {"path": destination, **complete(source, observed_at), **census}

    for label, root in admission_sources():
        source = f"<{label}-admission>/journal.ndjson"
        root_receipt = {"label": label, "status": "present" if root.exists() else "absent",
                        "complete_within": "named admission root at capture", "world": "closed"}
        journal = root / "journal.ndjson"
        if journal.is_file():
            receipt = collect(journal, f"admission/{label}/journal.ndjson", "admission", source)
            admitted = sum(e["rows"] for e in receipt["events"] if e["_tag"] == "admission-admitted")
            receipt["ring_window"] = {"nominal_row_cap_in_brief": 200, "observed_rows": receipt["observed_rows"],
                "writer_cap": 200, "writer_unit": "admitted transitions", "observed_admitted": admitted,
                "at_writer_cap": admitted >= 200, "wrapped": "unknown; below-cap does not prove complete history"}
        else:
            receipt = {**complete(source, instant(), "absent"), "observed_rows": 0,
                       "retained_rows": 0, "excluded_undecodable": 0, "events": [],
                       "ring_window": {"nominal_row_cap_in_brief": 200, "observed_rows": 0,
                                       "writer_cap": 200, "writer_unit": "admitted transitions"}}
        root_receipt["journal"] = receipt
        root_receipt["live"] = []
        for family in ("leases", "queue", "quarantine"):
            directory = root / family
            live_receipt = {**complete(f"<{label}-admission>/{family}", instant(),
                                      "present" if directory.is_dir() else "absent"),
                            "files_observed": 0, "captured_files": 0, "excluded_lock_files": 0,
                            "excluded_symlinks": 0, "sources": []}
            if directory.is_dir():
                for path in sorted(directory.iterdir()):
                    if path.is_symlink():
                        live_receipt["excluded_symlinks"] += 1
                        continue
                    if not path.is_file():
                        continue
                    if "lock" in path.name.lower():
                        live_receipt["excluded_lock_files"] += 1
                        continue
                    index = live_receipt["files_observed"]
                    live_receipt["files_observed"] += 1
                    # Opaque ordinal avoids leaking process identity embedded in state filenames.
                    target = f"live/{label}/{family}/state-{index:04d}.json"
                    source_name = f"<{label}-admission>/{family}/<state-{index:04d}>"
                    try:
                        state = collect(path, target, "live", source_name, False)
                    except FileNotFoundError:
                        state = complete(source_name, instant(), "vanished-before-read")
                    live_receipt["sources"].append(state)
                    if state["status"] == "present":
                        live_receipt["captured_files"] += 1
            root_receipt["live"].append(live_receipt)
        roots.append(root_receipt)

    ledger_count = 0
    for label, checkout, kind in discover_checkouts():
        runs = checkout / ".beep/yeet/runs"
        row = {"checkout": label, "kind": kind, "runs_dir_listing": [],
               "attempt_files": 0, "verdict_files": 0,
               "complete_within": "listed run directories and optional ledger during this capture", "world": "closed"}
        if runs.is_dir():
            for run in sorted(p for p in runs.iterdir() if p.is_dir()):
                validate_component(run.name, "run id")
                row["runs_dir_listing"].append(run.name)
                for family, filename, targetname, filekind in (
                    ("attempts", "attempts.ndjson", "attempts.ndjson", "attempts"),
                    ("verdicts", "verdict*.json", "verdict.json", "verdict"),
                ):
                    candidates = sorted(run.glob(filename))
                    if len(candidates) > 1:
                        fail("ambiguous verdict source; refusing to choose")
                    descriptor = f"<fleet>/{label}/.beep/yeet/runs/{run.name}/{targetname}"
                    if not candidates:
                        source_receipts.append(complete(descriptor, instant(), "absent"))
                        continue
                    dest = f"{family}/{label}/{run.name}/{targetname}"
                    receipt = collect(candidates[0], dest, filekind,
                                      f"<fleet>/{label}/.beep/yeet/runs/{run.name}/{candidates[0].name}",
                                      filekind == "attempts", checkout=label, run_id=run.name)
                    if receipt["status"] == "present":
                        row["attempt_files" if filekind == "attempts" else "verdict_files"] += 1
                    if filekind == "attempts":
                        terminal_ids = {r.get("attemptId") for r in raw.get(dest, [])
                                        if r.get("_tag") in {"attempt-finished", "attempt-terminated"}
                                        and isinstance(r.get("attemptId"), str)}
                        receipt["ring_window"] = {"nominal_row_cap_in_brief": 50,
                            "observed_rows": receipt["observed_rows"], "writer_cap": 50,
                            "writer_unit": "terminal attempts; active/protected/unknown rows may exceed cap",
                            "observed_terminal_attempts": len(terminal_ids),
                            "at_writer_cap": len(terminal_ids) >= 50,
                            "compaction_receipts": sum(e["rows"] for e in receipt["events"] if e["_tag"] == "journal-compacted"),
                            "wrapped": "unknown unless a retained compaction receipt supplies evidence"}
                    source_receipts.append(receipt)
        row["runs_directory_status"] = "present" if runs.is_dir() else "absent"
        ledger = checkout / ".beep/yeet/proof-ledger.ndjson"
        descriptor = f"<fleet>/{label}/.beep/yeet/proof-ledger.ndjson"
        if ledger.is_file():
            ledger_count += 1
            source_receipts.append(collect(ledger, f"ledger/{label}/proof-ledger.ndjson", "ledger", descriptor, checkout=label))
        else:
            source_receipts.append(complete(descriptor, instant(), "absent"))
        checkouts.append(row)

    sources = {
        "canonical_runtime_root": fact("<home>/.beep/runtime", REPO_RUN + "RuntimeRoot.ts", "const CANONICAL_RUNTIME_ROOT ="),
        "canonical_runtime_suffix": fact(".beep/runtime", REPO_RUN + "RuntimeRoot.ts", '}/.beep/runtime`'),
        "admission_leaf": fact("beep-admit-uid-<uid>", REPO_RUN + "RuntimeRoot.ts", 'path.join(choice.root, `beep-admit-uid-'),
        "admission_v1": fact("yeet-admission-journal/v1", REPO_RUN + "AdmissionJournal.ts", 'schemaVersion: S.Literal("yeet-admission-journal/v1")'),
        "admission_v2": fact("yeet-admission-journal/v2", REPO_RUN + "AdmissionJournal.ts", 'schemaVersion: S.Literal("yeet-admission-journal/v2")'),
        "admission_v3": fact("yeet-admission-journal/v3 accepted prospectively; not deployed in corpus_commit", "explorations/beep-ci-operational-ontology/DECISIONS.md", "**Ruling 9"),
        "attempt_schema": fact(ATTEMPT_SCHEMA, YEET + "AttemptJournal.ts", 'schemaVersion: S.Literal("yeet-attempt-journal/v1")'),
        "embedded_verdict": fact("attempt-finished embeds the verdict", YEET + "AttemptJournal.ts", "verdict: YeetVerdict,"),
        "verdict_schema": fact("yeet-verdict/v2", YEET + "Verdict.ts", 'schemaVersion: S.Literal("yeet-verdict/v2")'),
        "verdict_writer": fact("YeetVerdictJson.encode", YEET + "Handler.ts", "const verdictJson = yield* YeetVerdictJson.encode(verdict)"),
        "proof_provenance": fact("runId, attemptId, originKey, tier, stage, headSha, hostedRunId", YEET + "ProofFact.ts", "export class ProofProvenance"),
        "failure_signature_serialization": fact("failureKind + failedStepId; optional flakeQuarantine incidents retained", YEET + "Verdict.ts", "failureKind: YeetFailureKind.pipe"),
        "failed_step_serialization": fact("failedStepId", YEET + "Verdict.ts", "failedStepId: S.optionalKey(S.String)"),
        "failure_signature_domain": fact("step-exit, handler-error", YEET + "Verdict.ts", "export const YeetFailureKind ="),
        "cache_plan_domain": fact("caller-controlled, local-only, remote-read", CLI + "internal/cli/TurboCache.ts", 'export const TurboCachePlanTag ='),
        "cache_plan_execution": fact("resolver result feeds command args; verdict schema has no cache-plan field", CLI + "commands/Quality/Tasks.ts", "resolveTurboCachePlan(readTurboCacheEnvironmentSync()"),
    }
    losses = [
        ("best-effort journal appends (lock-busy drops)", REPO_RUN + "AdmissionJournal.ts", "stayed busy; dropping one", "current for best-effort callers; durable reap sinks retry"),
        ("claim-race loser edge", REPO_RUN + "QualityScheduler.ts", "const createReapClaim =", "historical loss class; current durable claims and acknowledged sinks mitigate it; no zero-loss assertion"),
        ("quarantined malformed state is journal-invisible", REPO_RUN + "QualityScheduler.ts", 'quarantineEntry(directories, entryPath, "undecodable")', "current; opportunistic quarantine capture excludes undecodable bytes"),
        ("evictedAtMillis is reap time not death time", REPO_RUN + "QualityScheduler.ts", "evictedAtMillis: claimedAtMillis", "current"),
        ("heartbeat instant dropped at reap until v3 lands", REPO_RUN + "QualityScheduler.ts", "const admissionEventForReapClaim =", "current v2 event builder omits lease heartbeat"),
        ("ring windows (admission 200 rows per root; attempts 50 rows per branch)", REPO_RUN + "AdmissionJournal.ts", "const RETAINED_ADMISSIONS = 200;", "brief wording is historical shorthand; actual retention units are admitted transitions and terminal attempts"),
    ]
    loss_receipts = [{"class": name, "source": source_cite(file, needle), "current_source_assessment": assessment}
                     for name, file, needle, assessment in losses]
    loss_receipts[-1]["attempt_source"] = source_cite(REPO_RUN + "AttemptTerminationJournal.ts", "const RETAINED_ATTEMPTS = 50;")
    loss_receipts[-1]["retention_algorithm_source"] = source_cite(REPO_RUN + "AttemptTerminationJournal.ts", "const unprotectedCapacity =")
    joins = {
        "nonce": fact("nonce threads ticket -> lease -> admitted -> released/evicted -> agent-run-<nonce>.scope", REPO_RUN + "RunScope.ts", "return `agent-run-"),
        "attemptId": fact("admission rows join attempts, embedded verdict and ledger on attemptId when present", YEET + "ProofFact.ts", "export class ProofProvenance"),
        "runId": fact("<safe-branch>-<sha12(branch)>", REPO_RUN + "RepoRunArtifacts.ts", "pipe(branch, repoRunSafeArtifactName"),
        "branch_sha12": fact("sha256 UTF-8 branch, lowercase hex first 12", REPO_RUN + "RepoRunArtifacts.ts", "const artifactNameHash ="),
        "originKey": fact("repo-grain, expected one value fleet-wide; empty is a real value; never a checkout key", YEET + "ArtifactPaths.ts", "artifactNameHash(canonicalRepositoryIdentity(repositoryIdentity))"),
        "journal_time": fact("epoch-millis in journal/ticket/lease", REPO_RUN + "AdmissionJournal.ts", "admittedAtMillis:"),
        "attempt_time": fact("ISO in attempts/verdict/ledger", YEET + "AttemptJournal.ts", "recordedAt:"),
    }
    return emitted, {"capture_instant": started, "capture_finished_at": instant(), "stage": "A",
        "capture_instant_basis": "capture start; files read once over the recorded interval, not an atomic fleet snapshot",
        "custody": {"rule": 'ownerRef = sha12(f"{pid}:{procStart}:{captureSalt}")',
                    "capture_salt_representation": "hexadecimal encoding of 32 random bytes",
                    "salt_policy": "per-capture, unrecorded, unlinkable across captures",
                    "missing_procStart_rule": "pid:<absent>:salt; weaker key tallied separately",
                    "missing_procStart_caveat": "weak references cannot be joined to full custody references by ownerRef; nonce remains available"},
        "admission_roots": roots, "checkouts": checkouts,
        "checkout_counts": dict(collections.Counter(c["kind"] for c in checkouts)),
        "sources": source_receipts, "source_facts": sources,
        "rider_evidence": rider_evidence(raw),
        "proof_ledger": {"checkouts_with_ledger": ledger_count, "materialization_owner": "Stage B"},
        "known_loss_classes": loss_receipts, "join_keys": joins,
        "live_state_filename_policy": "source filenames replaced with capture-local state ordinals; nonce retained inside payload",
        "excluded_sources": ["lock files", "proof-locks directories", "install roots", "claims and transitions outside the requested live families"],
        "stage_b": "v3 journal PR, organic traffic, proof-ledger materialization, synthetic eviction/withdrawal scenario",
        "ts_adapter": "Ruling 7 non-trigger; no TS observations generated"}


def verify_census(manifest: dict[str, Any], raw: dict[str, list[JsonValue]]) -> None:
    for root in manifest["admission_roots"]:
        receipt = root["journal"]
        rows = raw.get(receipt.get("path"), [])
        if receipt["retained_rows"] != len(rows) or receipt["events"] != event_census(rows):
            fail("admission census differs from pinned rows")
    for receipt in manifest["sources"]:
        if receipt["status"] == "present":
            rows = raw[receipt["path"]]
            if receipt["retained_rows"] != len(rows) or receipt["events"] != event_census(rows):
                fail("source census differs from pinned rows")
    if manifest["rider_evidence"] != rider_evidence(raw):
        fail("rider evidence census differs from pinned rows")
    for checkout in manifest["checkouts"]:
        for field, family, filename in (("attempt_files", "attempts", "attempts.ndjson"),
                                        ("verdict_files", "verdicts", "verdict.json")):
            observed = sum(f"{family}/{checkout['checkout']}/{run}/{filename}" in raw
                           for run in checkout["runs_dir_listing"])
            if checkout[field] != observed:
                fail("checkout file census differs")
    if manifest["proof_ledger"]["checkouts_with_ledger"] != sum(path.startswith("ledger/") for path in raw):
        fail("ledger census differs")


if __name__ == "__main__":
    main()
