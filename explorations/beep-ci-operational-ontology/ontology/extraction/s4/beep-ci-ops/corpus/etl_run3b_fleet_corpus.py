"""Capture and verify a public run-3 Stage B fleet and synthetic corpora.

Run with ``UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --with pyyaml python <this-script>``.
First success pins; ordinary reruns verify ONLY pinned bytes and this generator.
``--refresh {fleet|synthetic|all}`` deliberately captures again.
``--synthetic-root <export>`` is required to create or refresh the synthetic pin.
Without it an absent synthetic pin is reported as absent; an existing pin verifies.
The two roots are independent. Verify ignores the export, even if supplied. Do not hand-edit generated payloads.
Stdlib + PyYAML only. Stage A and run-2 mechanics are copied, never imported or modified;
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
from urllib.parse import quote

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


def fleet_root(checkout: Path) -> Path:
    """Sibling worktrees share their parent checkout's fleet, without Git reads at replay."""
    parent = checkout.parent
    return parent.parent if parent.name.endswith("-worktrees") else parent


FLEET_ROOT = fleet_root(REPO_ROOT)
# String leaves may contain JSON serialized through several escaping layers.
PID_IN_TEXT = re.compile(
    r"""(?P<prefix>\bpid(?P<key_quote>\\*["'])?(?:\s|\\+[nrt])*(?:[=:](?:\s|\\+[nrt])*)?(?P<value_quote>\\*["'])?)[0-9]+""",
    re.IGNORECASE,
)
TIMESTAMP_KEY = re.compile(r"(?:^ts$|AtMillis$|At$|TimestampMillis$|Timestamp$)")
PROPERTY_KEY = re.compile(r"[A-Za-z0-9_]+")
PROPERTY_RECORD_COMMENT = re.compile(r"# record (0|[1-9][0-9]*)")
PATH_LEFT_BOUNDARY = r"(?<![A-Za-z0-9_.~/-])"
PATH_RIGHT_BOUNDARY = r"(?=/|$|[\s\"'=,:;)\]])"
# Normalized non-identity exceptions require a deployed source citation here.
PROCESS_MEMBER_ALLOWLIST: frozenset[str] = frozenset()
OWNER_VARIANTS = ("pid", "ownerpid", "attachedpid", "other")
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
    roots = {"/home": "<home>", str(Path(os.sep) / "tmp"): "<tmp>", str(Path.home()): "<home>"}
    session = str(Path(tempfile.gettempdir()))
    if session != str(Path(os.sep) / "tmp"):
        roots[session] = "<session-tmp>"
    roots[str(FLEET_ROOT)] = "<fleet>"
    roots[str(Path(os.sep) / "run/user" / str(os.geteuid()))] = "<runtime>"
    if os.environ.get("XDG_RUNTIME_DIR"):
        roots[str(Path(os.environ["XDG_RUNTIME_DIR"]))] = "<runtime>"
    roots[str(Path(os.sep) / "proc")] = "<proc>"
    roots[str(Path(os.sep) / "dev/shm")] = "<shm>"
    return sorted(roots.items(), key=lambda item: -len(item[0]))


def redact_pid_match(match: re.Match[str]) -> str:
    """Preserve JSON punctuation and escaping while removing only PID digits."""
    replacement = "null" if match["key_quote"] and not match["value_quote"] else "<redacted>"
    return match["prefix"] + replacement


def redact_string(value: str, aliases: dict[str, str] | None = None) -> str:
    for prefix, token in sorted((aliases or {}).items(), key=lambda item: -len(item[0])):
        value = re.sub(PATH_LEFT_BOUNDARY + re.escape(prefix) + PATH_RIGHT_BOUNDARY, lambda _: token, value)
    value = re.sub(PATH_LEFT_BOUNDARY + re.escape("~/.beep/runtime") + PATH_RIGHT_BOUNDARY, "<runtime-root>", value)
    value = re.sub(r"-\d+(?=\.(?:lease|ticket)\.json)", "-<process>", value)
    value = re.sub(r"merged-preview-\d+", "merged-preview-<process>", value)
    value = re.sub(PATH_LEFT_BOUNDARY + r"/run/user/\d+" + PATH_RIGHT_BOUNDARY, "<runtime>", value)
    value = re.sub(PATH_LEFT_BOUNDARY + r"/proc/\d+" + PATH_RIGHT_BOUNDARY, "<proc>/<process>", value)
    value = re.sub(r"(user(?:-runtime-dir)?@)\d+(\.service)", r"\1<uid>\2", value)
    value = re.sub(r"user-\d+\.slice", "user-<uid>.slice", value)
    for prefix, replacement in host_prefixes():
        value = re.sub(PATH_LEFT_BOUNDARY + re.escape(prefix) + PATH_RIGHT_BOUNDARY, lambda _: replacement, value)
    hostname = socket.gethostname()
    value = value.replace(sha256(hostname.encode())[:12], "<host>")
    value = value.replace(hostname, "<host>")
    value = re.sub(r"\buid-\d+", "uid-<uid>", value)
    return PID_IN_TEXT.sub(redact_pid_match, value)


def normalized_member(key: str) -> str:
    return key.replace("_", "").replace("-", "").lower()


def process_member(key: str) -> bool:
    normalized = normalized_member(key)
    return normalized not in PROCESS_MEMBER_ALLOWLIST and (
        normalized.endswith("pid") or "procstart" in normalized or "processstart" in normalized
        or normalized == "processid"  # Preserve the older generator's explicit protection.
    )


def guard_origin(value: str) -> None:
    if re.search(r"://[^/@]+@", value):
        fail("origin credential guard: URL userinfo is forbidden")
    # SCP-form git@host:path is retained. Any other userinfo is refused.
    if "@" in value and not re.match(r"git@[^/:]+:[^\s]+$", value):
        fail("origin credential guard: unexpected or token-looking userinfo")
    scan_output_bytes([("origin", value.encode())])


def redact(value: JsonValue, salt: bytes | None, counts: collections.Counter,
           preserve_origins: bool = False, aliases: dict[str, str] | None = None) -> JsonValue:
    """Mint custody before dropping process members; transform string leaves only."""
    if isinstance(value, str):
        return redact_string(value, aliases)
    if isinstance(value, list):
        return [redact(child, salt, counts, preserve_origins, aliases) for child in value]
    if not isinstance(value, dict):
        return value
    result: dict[str, JsonValue] = {}
    identities = {normalized_member(key): child for key, child in value.items() if process_member(key)}
    if len(identities) != sum(process_member(key) for key in value):
        fail("ambiguous normalized process identity members")
    if identities and salt is not None:
        if "ownerRef" in value:
            fail("source ownerRef collides with capture custody surrogate")
        variant = next((key for key in OWNER_VARIANTS[:-1] if key in identities), "other")
        if variant == "other":
            # Unpaired start identities and future variants still get object-local custody.
            if any(child is not None and type(child) not in (str, int) for child in identities.values()):
                fail("custody process identity is not a scalar")
            owner = json.dumps(identities, sort_keys=True, separators=(",", ":"))
            start = next((child for key, child in sorted(identities.items())
                          if ("procstart" in key or "processstart" in key) and child not in (None, "")), "<absent>")
        else:
            owner = identities[variant]
            if type(owner) is not int:
                fail("custody pid is not an integer")
            start = identities.get({"pid": "procstart", "ownerpid": "ownerprocstart"}.get(variant), "<absent>")
            if start is not None and type(start) not in (str, int):
                fail("custody procStart is not a scalar")
            if start is None or start == "":
                start = "<absent>"
        # captureSalt is the hexadecimal representation of 32 random bytes.
        result["ownerRef"] = sha256(f"{owner}:{start}:{salt.hex()}".encode())[:12]
        counts["owner_refs"] += 1
        counts["owner_refs_variant_" + variant] += 1
        if start == "<absent>":
            counts["owner_refs_without_proc_start"] += 1
    for key, child in value.items():
        if process_member(key):
            counts["dropped_" + normalized_member(key)] += 1
            continue
        if preserve_origins and key in {"originUrl", "origin_url"}:
            if not isinstance(child, str):
                fail("origin URL is not a string")
            guard_origin(child)
            result[key] = child
        else:
            result[key] = redact(child, salt, counts, preserve_origins, aliases)
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
            if process_member(key):
                continue
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


def projected_bytes(records: list[JsonValue], provenance: str) -> bytes:
    header = b"# provenance: synthetic\n" if provenance == "synthetic" else b""
    return header + encode_properties_projection(records)


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


def checkout_component(label: str) -> str:
    """Encode a label injectively as one component; retain the label in receipts."""
    safe_relative_path(label)
    component = quote(label, safe="")
    validate_component(component, "checkout")
    return component


def scan_output_bytes(files: list[tuple[str, bytes]]) -> None:
    """Fail closed without printing matched private bytes (including path names)."""
    hostname = socket.gethostname().encode()
    roots = {prefix for prefix, _ in host_prefixes()} | {"/home", "/tmp", "/run/user", "/proc", "/dev/shm", "~/.beep/runtime"}
    host_paths = [re.compile((PATH_LEFT_BOUNDARY + re.escape(prefix) + PATH_RIGHT_BOUNDARY).encode()) for prefix in roots]
    for _label, data in files:
        combined = _label.encode() + b"\n" + data
        if any(pattern.search(combined) for pattern in host_paths) or any(
                token and token in combined for token in (hostname, sha256(hostname)[:12].encode())):
            fail("residue scan failed: host path, hostname, or hostname digest")
        if re.search(rb"(?:user(?:-runtime-dir)?@\d+\.service|user-\d+\.slice|\buid-\d+)", combined):
            fail("residue scan failed: user identity in runtime or unit name")
        if re.search(rb"(?:merged-preview-\d+|-\d+\.(?:lease|ticket)\.json)", combined):
            fail("residue scan failed: process identity in state or preview filename")
        # Consume whole JSON strings so member-like text inside a VALUE is never a key.
        members = [] if _label.endswith(".properties") else [
            json.loads(match[1]) for match in re.finditer(rb'("(?:\\.|[^"\\\r\n])*")\s*(:)?', data) if match[2]]
        properties = [match[1].decode() for match in re.finditer(rb"(?m)^[ \t]*([^\s=]+)[ \t]*=", data)]
        if any(process_member(key) for key in members + properties):
            fail("residue scan failed: process identity member")
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
    return {"file": file, "line": matches[0], "needle": needle, "sha256": sha256(content)}


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


def record_observations(records: list[JsonValue]) -> dict[str, Any]:
    """Derive the receipt census from decoded bytes in capture and verification."""
    bounds = timestamp_bounds([t for row in records for t in collect_timestamps(row, "record")])
    return {"event_count": len(records), "min_timestamp_observed": bounds[0],
            "max_timestamp_observed": bounds[1]}


def verify_fields(actual: dict[str, Any], expected: dict[str, Any], label: str) -> None:
    for key, value in expected.items():
        if key not in actual or actual[key] != value:
            fail(f"{label} differs: {key}")


def payload_pair(path: str, records: list[JsonValue], kind: str, source: str,
                 observed_at: str, **metadata: Any) -> list[Payload]:
    safe_relative_path(path)
    data = encode_ndjson(records) if path.endswith(".ndjson") else encode_json(records[0])
    decoded = decode_ndjson(data, "redacted") if path.endswith(".ndjson") else [decode_json(data, "redacted")]
    if not same_json(decoded, records):
        fail("redaction round-trip changed decoded data")
    receipt = {"path": path, "kind": kind, "source": {"file": source, "line": 1},
                **record_observations(records), **complete(source, observed_at), **metadata}
    # Keep per-file source cites separate from the closed-world descriptor.
    receipt["source"] = {"file": source, "line": 1}
    projection = projection_path(path)
    projection_receipt = {**receipt, "path": projection, "kind": PROJECTION_KIND, "derived_from": path}
    return [Payload(path, data, receipt),
            Payload(projection, projected_bytes(records, metadata["provenance"]), projection_receipt)]


def finish_manifest(metadata: dict[str, Any], emitted: list[Payload], population: str) -> bytes:
    emitted.sort(key=lambda entry: entry.path)
    if len({entry.path for entry in emitted}) != len(emitted):
        fail("duplicate emitted paths")
    manifest = {"schema_version": manifest_schema(population), "generated_by": SCRIPT.name,
                "generator_sha256": sha256(SCRIPT.read_bytes()),
                "corpus_commit": git(REPO_ROOT, "rev-parse", "HEAD"), **metadata,
                "checkout_path_encoding": "UTF-8 percent-encoded single component; checkout labels remain verbatim in receipts",
                "projection_rules": [
                    "config_key_value channel: one .properties sibling for every raw payload",
                    "# record <zero-based-index>; eligible leaf_key=value in source traversal order",
                    "ASCII alphanumeric/underscore keys; nonempty single-line strings, JSON numbers and booleans",
                    "null, empty strings and CR/LF values omitted; duplicate pairs and scalar array leaves retained",
                    "events count raw JSON records once; projections do not double-count events"],
                "redaction_rules": [
                    "All families: longest host-root match at start or after a character outside ASCII alphanumeric, underscore, dot, tilde, slash and hyphen; relative path continuations survive",
                    "fleet root is <fleet>; home is <home>; temp roots are <session-tmp> and <tmp>; runtime is <runtime>; proc is <proc>; shared memory is <shm>",
                    "Per-user systemd unit identifiers become <uid>; proc process-directory identifiers become <process>",
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
                "# Public run-3 Stage B capture; source descriptors are portable.\n"
                + yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True, width=100)).encode()
        total = manifest["totals"]["payload_bytes"] + len(data)
        if manifest["totals"]["bytes_emitted"] == total:
            return data
        manifest["totals"]["bytes_emitted"] = total
    fail("manifest byte total did not reach a fixed point")


def verify_output_tree(root: Path, population: str) -> dict[str, Any]:
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
    if not isinstance(manifest, dict) or manifest.get("schema_version") != manifest_schema(population):
        fail("unsupported manifest schema")
    if manifest.get("generator_sha256") != sha256(SCRIPT.read_bytes()):
        fail("generator digest differs from pin; use --refresh deliberately")
    verify_fields(manifest, {"generated_by": SCRIPT.name, "stage": "B",
                  "provenance": "synthetic" if population == "synthetic" else "organic"}, "manifest identity")
    receipts = manifest["files"]
    paths = [safe_relative_path(r["path"]).as_posix() for r in receipts]
    if paths != sorted(set(paths)):
        fail("manifest paths duplicated or unordered")
    actual = sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and p != root / MANIFEST_NAME)
    if paths != actual:
        fail("payload inventory differs from manifest")
    raw, projections, payload_bytes, events = {}, {}, 0, 0
    for receipt in receipts:
        path = receipt["path"]
        if receipt.get("provenance") != manifest["provenance"]:
            fail("payload receipt provenance differs")
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
            try:
                validate_envelope(row, receipt["kind"])
            except ValueError:
                fail("unsupported pinned record envelope")
            if population == "synthetic" and row.get("provenance") != "synthetic":
                fail("synthetic row lacks provenance")
        verify_fields(receipt, record_observations(rows), "raw receipt observations")
        raw[path] = rows
        events += len(rows)
    if len(projections) != len(raw):
        fail("one projection per raw payload is required")
    receipt_by_path = {receipt["path"]: receipt for receipt in receipts}
    for path, rows in raw.items():
        projection = projections.get(projection_path(path))
        if projection is None or projection[0].get("derived_from") != path:
            fail("projection linkage differs")
        expected_receipt = {**receipt_by_path[path], "path": projection_path(path),
                            "kind": PROJECTION_KIND, "derived_from": path,
                            "bytes": len(projection[1]), "sha256": sha256(projection[1])}
        if projection[0] != expected_receipt:
            fail("projection receipt differs from raw receipt")
        if projection[1] != projected_bytes(rows, manifest["provenance"]) or projection[0]["event_count"] != len(rows):
            fail("projection completeness, order or values differ")
    expected = {"payload_files": len(paths), "files_emitted": len(paths) + 1, "events": events,
                "payload_bytes": payload_bytes, "bytes_emitted": payload_bytes + len(manifest_bytes)}
    if manifest["totals"] != expected:
        fail("manifest totals differ from pinned payloads")
    verify_census(manifest, raw)
    return expected


def write_staged_capture(emitted: list[Payload], manifest_bytes: bytes,
                         output_root: Path, population: str) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix=f".{output_root.name}-stage-", dir=output_root.parent) as name:
        stage = Path(name)
        for entry in emitted:
            destination = stage / entry.path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(entry.data)
        (stage / MANIFEST_NAME).write_bytes(manifest_bytes)
        summary = verify_output_tree(stage, population)
        if output_root.is_symlink():
            fail("refusing to replace symlinked pin")
        backup = output_root.parent / ("." + output_root.name + "-previous")
        if backup.exists() or backup.is_symlink():
            fail("stale backup blocks refresh")
        if output_root.exists():
            os.replace(output_root, backup)
        try:
            os.replace(stage, output_root)
        except BaseException:
            if backup.exists():
                os.replace(backup, output_root)
            raise
        if backup.exists():
            shutil.rmtree(backup)
        return summary


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


OUTPUT_ROOTS = {name: CORPUS_ROOT / f"run3b-{name}" for name in ("fleet", "synthetic")}
LIVE_FAMILIES = ("leases", "queue", "claims", "quarantine")
SYNTHETIC_LABELS = ("contender-a", "dead-lease", "dead-ticket")
SYNTHETIC_SOURCE_LABELS = ("contender-a", "contender-b", "dead-lease", "dead-ticket")
PROTOCOL_SCHEMA = "yeet-admission-protocol/v2"
LIVE_SCHEMAS = {f"yeet-admission-{kind}/v1" for kind in ("lease", "ticket", "reap-claim")}
ADMISSION_TAGS = {
    "yeet-admission-journal/v1": {"admission-admitted", "admission-released"},
    "yeet-admission-journal/v2": {"admission-lease-evicted", "admission-ticket-evicted"},
    "yeet-admission-journal/v3": {"admission-enqueued", "admission-withdrawn", "admission-released",
                                  "admission-lease-evicted", "admission-ticket-evicted"},
}
CHAIN_CLASSES = ("win", "withdrawn", "lease-evicted", "ticket-evicted", "in-flight", "pre-v3")
PACKET = "explorations/beep-ci-operational-ontology/"


def manifest_schema(population: str) -> str:
    return f"beep-ci-ops-run3b-{population}-corpus/v1"


def validate_envelope(record: dict[str, JsonValue], kind: str) -> None:
    """Recognize deployed version/tag envelopes, without inventing missing fields."""
    schema = record.get("schemaVersion")
    known = {"admission": ADMISSION_SCHEMAS, "protocol": {PROTOCOL_SCHEMA},
             "attempts": {ATTEMPT_SCHEMA}, "live": LIVE_SCHEMAS}
    if kind not in known or not isinstance(schema, str) or schema not in known[kind]:
        raise ValueError("unknown-schema-version")
    if "_tag" in record and not isinstance(record["_tag"], str):
        raise ValueError("invalid-envelope")
    if kind == "admission":
        if record.get("_tag") not in ADMISSION_TAGS[schema] or not isinstance(record.get("nonce"), str):
            raise ValueError("invalid-envelope")
    if kind == "protocol" and record.get("eviction") not in ("on", "off"):
        raise ValueError("invalid-envelope")


def transform_source(data: bytes, kind: str, salt: bytes, ndjson: bool = True,
                     aliases: dict[str, str] | None = None, synthetic: bool = False
                     ) -> tuple[list[JsonValue], dict[str, Any]]:
    """One read, source order, and classified exclusions without discarded bytes."""
    rows, retained_lines, rejected = [], [], collections.Counter()
    counts = collections.Counter()
    observed = 0
    for number, line in enumerate(data.splitlines() if ndjson else [data], 1):
        if not line.strip():
            continue
        observed += 1
        row_counts = collections.Counter()
        try:
            record = strict_object(line)
            validate_envelope(record, kind)
            transformed = redact(record, salt, row_counts, aliases=aliases)
            if synthetic:
                if "provenance" in transformed and transformed["provenance"] != "synthetic":
                    raise ValueError("provenance-collision")
                transformed["provenance"] = "synthetic"
        except ValueError as exc:
            rejected[str(exc)] += 1
            continue
        rows.append(transformed)
        counts.update(row_counts)
        retained_lines.append(number)
    variants = {variant: counts.pop("owner_refs_variant_" + variant, 0) for variant in OWNER_VARIANTS}
    return rows, {"observed_rows": observed, "retained_rows": len(rows),
                  "retained_source_lines": retained_lines,
                  "excluded_undecodable": sum(rejected.values()), "excluded_by_reason": dict(sorted(rejected.items())),
                  "redaction_counts": dict(sorted(counts.items())), "owner_refs_by_variant": variants,
                  "events": event_census(rows)}


def classify_chain(tags: list[str]) -> str | None:
    """Classify retained evidence; partial/conflicting terminal chains stay unclassified."""
    terminal_tags = {"admission-released", "admission-withdrawn", "admission-lease-evicted",
                     "admission-ticket-evicted"}
    terminals = [tag for tag in tags if tag in terminal_tags]
    if len(terminals) > 1:
        return None
    if "admission-lease-evicted" in tags:
        return "lease-evicted"
    if "admission-ticket-evicted" in tags:
        return "ticket-evicted"
    if tags == ["admission-enqueued", "admission-admitted", "admission-released"]:
        return "win"
    if tags == ["admission-enqueued", "admission-withdrawn"]:
        return "withdrawn"
    if "admission-enqueued" in tags and not terminals:
        return "in-flight"
    if "admission-enqueued" not in tags and any(t in tags for t in ("admission-admitted", "admission-released")):
        return "pre-v3"
    return None


def loss_population(raw: dict[str, list[JsonValue]], root_labels: list[str]) -> dict[str, Any]:
    """Derive root/version/tag counts and nonce chains solely from redacted pinned rows."""
    roots, chains, counts = [], [], collections.Counter()
    heartbeat = {"rule": "lastHeartbeatAtMillis <= evictedAtMillis", "checked_rows": 0,
                 "legacy_rows_without_heartbeat": 0, "violations": 0}
    for label in root_labels:
        path = f"admission/{label}/journal.ndjson"
        rows = raw.get(path, [])
        roots.append({"root": label, "rows": len(rows), "events": event_census(rows)})
        grouped = collections.defaultdict(list)
        for index, row in enumerate(rows):
            grouped[row["nonce"]].append((index, row))
            if row["_tag"] == "admission-lease-evicted":
                if row["schemaVersion"] == "yeet-admission-journal/v3":
                    values = [row.get(key) for key in ("lastHeartbeatAtMillis", "evictedAtMillis")]
                    if any(type(value) not in (int, float) for value in values):
                        fail("v3 lease eviction lacks numeric heartbeat/eviction instants")
                    heartbeat["checked_rows"] += 1
                    heartbeat["violations"] += int(values[0] > values[1])
                else:
                    heartbeat["legacy_rows_without_heartbeat"] += int("lastHeartbeatAtMillis" not in row)
        for nonce, entries in sorted(grouped.items()):
            tags = [row["_tag"] for _, row in entries]
            classification = classify_chain(tags)
            counts[classification or "unclassified"] += 1
            chains.append({"root": label, "nonce": nonce, "classification": classification,
                           "tags": tags, "source": {"file": path, "record_indexes": [i for i, _ in entries]}})
    if heartbeat["violations"]:
        fail("heartbeat invariant failed in pinned admission rows")
    return {"roots": roots, "chains": chains,
            "chain_counts": {key: counts[key] for key in (*CHAIN_CLASSES, "unclassified")},
            "heartbeat_check": heartbeat,
            "classification_basis": "retained source order, scoped by root and nonce; no live-state inference",
            "pre_v3_caveat": "label means admitted/released without retained enqueue, not proof of writer version",
            "unclassified_policy": "partial or conflicting terminal chains retain tags and null classification; never infer a win",
            "duration_derivation": "wait = admittedAtMillis - enqueuedAtMillis; hold = releasedAtMillis - admittedAtMillis; join within root/nonce only when both instants exist; no durations computed"}


def synthetic_checkout_aliases(records: list[JsonValue]) -> dict[str, str]:
    """Map observed fixture checkout roots to producer labels, before host rewriting."""
    aliases = {}
    def visit(value: JsonValue) -> None:
        if isinstance(value, dict):
            root = value.get("checkoutRoot")
            if isinstance(root, str):
                path = Path(root)
                label = path.name
                if not path.is_absolute() or label not in SYNTHETIC_SOURCE_LABELS:
                    fail("synthetic checkoutRoot cannot be mapped to a declared producer label")
                token = f"<synthetic-checkout:{label}>"
                if token in aliases.values() and aliases.get(root) != token:
                    fail("multiple synthetic roots claim the same checkout label")
                aliases[root] = token
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(records)
    return aliases


def verify_synthetic_expected(expected: Any, census: dict[str, Any]) -> None:
    """Require the producer's exact tag multiset and nonce chains, including multiplicity."""
    if not isinstance(expected, dict) or not isinstance(expected.get("tags"), dict) or not isinstance(expected.get("chains"), list):
        fail("scenario expected must contain tags and chains")
    actual_tags = collections.Counter()
    for root in census["roots"]:
        for event in root["events"]:
            actual_tags[event["_tag"]] += event["rows"]
    if dict(actual_tags) != expected["tags"]:
        fail("synthetic tag census differs from scenario expected")
    expected_chains = []
    for chain in expected["chains"]:
        if not isinstance(chain, dict) or not isinstance(chain.get("nonce"), str) or not isinstance(chain.get("tags"), list):
            fail("scenario expected chain must contain nonce and tags")
        if not all(isinstance(tag, str) for tag in chain["tags"]):
            fail("scenario expected chain tags must be strings")
        expected_chains.append((chain["nonce"], tuple(chain["tags"])))
    actual_chains = [(chain["nonce"], tuple(chain["tags"])) for chain in census["chains"]]
    if collections.Counter(expected_chains) != collections.Counter(actual_chains):
        fail("synthetic nonce chains differ from scenario expected")


def locked_name(name: str) -> bool:
    return ".lock" in name.lower() or name.lower().endswith("lock")


def synthetic_termination_join(raw: dict[str, list[JsonValue]]) -> dict[str, Any]:
    """Prove both termination joins from portable retained payloads, at capture and replay."""
    admission = raw.get("admission/synthetic/journal.ndjson", [])
    receipt = {}
    for label, tag, reason in (("dead-lease", "admission-lease-evicted", "lease-eviction"),
                               ("dead-ticket", "admission-ticket-evicted", "queued-submitter-death")):
        journals = [path for path in raw if PurePosixPath(path).match(f"attempts/{label}/*/attempts.ndjson")]
        if len(journals) != 1:
            fail(f"synthetic termination join: {label} requires exactly one attempts.ndjson")
        journal = journals[0]
        terminated = [row for row in raw[journal] if row.get("_tag") == "attempt-terminated"]
        if len(terminated) != 1:
            fail(f"synthetic termination join: {label} requires exactly one attempt-terminated row")
        row = terminated[0]
        if row.get("reason") != reason:
            fail(f"synthetic termination join: {label} reason differs")
        evicted = [event for event in admission if event.get("_tag") == tag
                   and event.get("checkoutRoot") == f"<synthetic-checkout:{label}>"]
        if len(evicted) != 1:
            fail(f"synthetic termination join: {label} requires exactly one matching eviction row")
        attempt = row.get("attemptId")
        if not isinstance(attempt, str) or not attempt or attempt != evicted[0].get("attemptId"):
            fail(f"synthetic termination join: {label} attemptId differs")
        receipt[label] = {"journal_path": journal, "attemptId": attempt, "attemptId_match": True, "reason": reason}
    # The holder emits no termination; an absent journal or an empty journal is evidence.
    if any(rows for path, rows in raw.items() if path.startswith("attempts/contender-a/")):
        fail("synthetic contender-a attempts receipt must be empty")
    return receipt


def source_facts() -> dict[str, Any]:
    journal = REPO_RUN + "AdmissionJournal.ts"
    scheduler = REPO_RUN + "QualityScheduler.ts"
    schemas = REPO_RUN + "QualityScheduler.schemas.ts"
    facts = {
        "canonical_runtime_root": fact("<home>/.beep/runtime", REPO_RUN + "RuntimeRoot.ts", "const CANONICAL_RUNTIME_ROOT ="),
        "admission_leaf": fact("beep-admit-uid-<uid>", REPO_RUN + "RuntimeRoot.ts", 'path.join(choice.root, `beep-admit-uid-'),
        "admission_v1": fact("yeet-admission-journal/v1", journal, 'schemaVersion: S.Literal("yeet-admission-journal/v1")'),
        "admission_v2": fact("yeet-admission-journal/v2", journal, 'schemaVersion: S.Literal("yeet-admission-journal/v2")'),
        "protocol": fact(PROTOCOL_SCHEMA, journal, 'export class AdmissionProtocol extends'),
        "protocol_filename": fact("protocol.json", journal, 'const PROTOCOL_FILE_NAME ='),
        "lease": fact("yeet-admission-lease/v1", schemas, 'export class YeetAdmissionLease extends'),
        "ticket": fact("yeet-admission-ticket/v1", schemas, 'export class YeetAdmissionTicket extends'),
        "lease_claim": fact("yeet-admission-reap-claim/v1; nested lease custody", schemas, 'export class AdmissionLeaseReapClaim extends'),
        "ticket_claim": fact("yeet-admission-reap-claim/v1; nested ticket custody", schemas, 'export class AdmissionTicketReapClaim extends'),
        "claim_sinks": fact("pending, pending-protocol-off, complete", schemas, 'export const AdmissionClaimSinkState ='),
        "claim_replay": fact("acknowledge attempt and admission sinks before deleting claim", scheduler, 'const processReapClaim ='),
        "attempt_schema": fact(ATTEMPT_SCHEMA, YEET + "AttemptJournal.ts", 'schemaVersion: S.Literal("yeet-attempt-journal/v1")'),
        "attempt_lease_termination": fact("lease-eviction", REPO_RUN + "AttemptTerminationJournal.ts", '"lease-eviction",'),
        "attempt_ticket_termination": fact("queued-submitter-death", REPO_RUN + "AttemptTerminationJournal.ts", '"queued-submitter-death",'),
        "admitted_retention": fact(200, journal, "const RETAINED_ADMISSIONS = 200;"),
        "known_history_retention": fact(2400, journal, "const RETAINED_KNOWN_ROWS ="),
        "terminal_attempt_retention": fact(50, REPO_RUN + "AttemptTerminationJournal.ts", "const RETAINED_ATTEMPTS = 50;"),
    }
    for tag, symbol in (("admission-enqueued", "AdmissionJournalEnqueued"),
                        ("admission-withdrawn", "AdmissionJournalWithdrawn"),
                        ("admission-released", "AdmissionJournalReleasedV3"),
                        ("admission-lease-evicted", "AdmissionJournalLeaseEvictedV3"),
                        ("admission-ticket-evicted", "AdmissionJournalTicketEvictedV3")):
        facts[tag] = fact("yeet-admission-journal/v3 deployed", journal, f"export class {symbol} extends")
    return facts


def known_losses() -> list[dict[str, Any]]:
    journal = REPO_RUN + "AdmissionJournal.ts"
    scheduler = REPO_RUN + "QualityScheduler.ts"
    losses = [
        ("best-effort journal appends (lock-busy drops)", journal, "stayed busy; dropping one",
         "best-effort callers can drop; durable reap sinks retry"),
        ("claim-race loser edge", scheduler, "const createReapClaim =",
         "historical loss class mitigated by durable claims and acknowledged sinks; no zero-loss assertion"),
        ("quarantined malformed state is journal-invisible", scheduler, 'quarantineEntry(directories, entryPath, "undecodable")',
         "malformed bytes are excluded and tallied, never emitted raw"),
        ("evictedAtMillis is reap time not death time", scheduler, "evictedAtMillis: claimedAtMillis",
         "original claim instant, including a later protocol-enabled replay"),
        ("heartbeat carried on v3 lease-evicted rows; still absent on v1/v2 rows", scheduler, "lastHeartbeatAtMillis: lease.heartbeatAtMillis",
         "v3 last heartbeat is an observation, not the owner death instant"),
        ("ring windows", journal, "const RETAINED_ADMISSIONS = 200;",
         "200 admitted transitions and 2400 known rows per root; 50 terminal attempts per branch; active/protected/unknown rows may exceed nominal caps"),
        ("eviction rows deferred while the protocol marker was off", scheduler, 'const PROTOCOL_DEFERRED_REAP_CLAIM_SUFFIX =',
         "claims replayed on the first enabled pass; evictedAtMillis is the original claim instant"),
    ]
    receipts = [{"class": name, "source": source_cite(file, needle), "current_source_assessment": assessment}
                for name, file, needle, assessment in losses]
    receipts[5]["known_history_source"] = source_cite(journal, "const RETAINED_KNOWN_ROWS =")
    receipts[5]["attempt_source"] = source_cite(REPO_RUN + "AttemptTerminationJournal.ts", "const RETAINED_ATTEMPTS = 50;")
    receipts[5]["retention_algorithm_source"] = source_cite(REPO_RUN + "AttemptTerminationJournal.ts", "const unprotectedCapacity =")
    return receipts


def join_keys() -> dict[str, Any]:
    return {
        "nonce": fact("ticket -> lease -> admitted -> released/evicted -> agent-run-<nonce>.scope", REPO_RUN + "RunScope.ts", "return `agent-run-"),
        "attemptId": fact("admission -> attempts; embedded verdict/ledger joins are optional; Stage A holds verdict and identity evidence", YEET + "ProofFact.ts", "export class ProofProvenance"),
        "claim": fact("claim -> eviction by nonce; sourcePath basename identifies dead lease/ticket with process segment redacted", REPO_RUN + "QualityScheduler.ts", "const admissionEventForReapClaim ="),
        "claim_filename": fact("<nonce>-<process>.lease.json or .ticket.json; nonce and suffix retained", REPO_RUN + "QualityScheduler.ts", 'const leasePath = path.join(directories.leases,'),
        "runId": fact("<safe-branch>-<sha12(branch)>", REPO_RUN + "RepoRunArtifacts.ts", "pipe(branch, repoRunSafeArtifactName"),
        "branch_sha12": fact("sha256 UTF-8 branch, lowercase hex first 12", REPO_RUN + "RepoRunArtifacts.ts", "const artifactNameHash ="),
        "originKey": fact("repo-grain, not a checkout key; empty is a real value", YEET + "ArtifactPaths.ts", "artifactNameHash(canonicalRepositoryIdentity(repositoryIdentity))"),
        "journal_time": fact("epoch-millis in journal/ticket/lease", REPO_RUN + "AdmissionJournal.ts", "admittedAtMillis:"),
        "attempt_time": fact("ISO in attempts", YEET + "AttemptJournal.ts", "recordedAt:"),
        "stage_a": {"value": "checkout labels cross-reference run3-checkout-identity and run3-fleet; distinct capture windows, missing matches do not prove absence",
                    "source": source_cite(PACKET + "DECISIONS.md", "**Ruling 18")},
    }


def read_synthetic_export(root: Path) -> tuple[dict[Path, bytes], dict[str, Any], dict[str, str]]:
    """READY is the producer's publication boundary. Read export bytes once, without mutation."""
    if root.is_symlink() or not root.is_dir() or not (root / "READY").is_file():
        fail("synthetic export READY marker is absent; refusing to pin")
    if any(path.is_symlink() for path in root.rglob("*")):
        fail("symlink in synthetic export")
    try:
        scenario_bytes = (root / "scenario.json").read_bytes()
        scenario = strict_object(scenario_bytes)
    except (OSError, ValueError):
        fail("synthetic scenario metadata is absent or undecodable")
    producer = scenario.get("producer")
    if not isinstance(producer, dict) or not isinstance(producer.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", producer["sha256"]):
        fail("scenario producer must have path and sha256")
    safe_relative_path(producer.get("path"))
    if not isinstance(scenario.get("steps"), list) or not isinstance(scenario.get("capturedAt"), str):
        fail("scenario steps or capture instant missing")
    parse_timestamp_scalar("capturedAt", scenario["capturedAt"], "scenario")
    # These fields are copied verbatim: refuse private material instead of silently changing the scenario.
    scenario_public = {key: scenario[key] for key in ("producer", "steps", "capturedAt", "expected")}
    if not same_json(scenario_public, redact(scenario_public, None, collections.Counter())):
        fail("scenario verbatim metadata requires redaction; producer must supply portable metadata")
    scan_output_bytes([("scenario metadata", encode_json(scenario_public))])
    paths = [root / "admission" / name for name in ("journal.ndjson", "protocol.json")]
    for family in LIVE_FAMILIES:
        directory = root / "admission" / family
        if directory.is_dir():
            paths.extend(p for p in directory.iterdir() if p.is_file() and not locked_name(p.name))
    for label in SYNTHETIC_LABELS:
        journals = list((root / "checkouts" / label / ".beep/yeet/runs").glob("*/attempts.ndjson"))
        if label != "contender-a" and len(journals) != 1:
            fail(f"synthetic termination join: {label} requires exactly one attempts.ndjson")
        paths.extend(journals)
    payloads, records = {}, []
    for path in sorted(paths):
        if not path.is_file():
            continue
        data = path.read_bytes()
        payloads[path] = data
        for line in data.splitlines() if path.suffix == ".ndjson" else [data]:
            if not line.strip():
                continue
            try:
                records.append(strict_object(line))
            except ValueError:
                pass  # Capture's transform_source supplies the classified exclusion receipt.
    aliases = synthetic_checkout_aliases(records)
    if not {f"<synthetic-checkout:{label}>" for label in SYNTHETIC_LABELS} <= set(aliases.values()):
        fail("synthetic export does not attest every fixture checkout root")
    metadata = {"producer": producer, "scenario_sha256": sha256(scenario_bytes),
                "scenario_captured_at": scenario["capturedAt"], "scenario_steps": scenario["steps"],
                "expected": scenario["expected"],
                "synthetic_checkout_labels": {f"<source-checkout:{Path(root).name}>": token for root, token in sorted(aliases.items())},
                "synthetic_checkout_label_rule": "observed checkoutRoot basename binds source-checkout to synthetic-checkout; contender-b has journal rows but no exported attempts directory; replace the whole temp root before generic rewriting; raw mapping never persisted",
                "ready": {"status": "present", "complete_within": "producer writes READY last after assertions and export copies", "world": "closed"}}
    return payloads, metadata, aliases


def capture(population: str, synthetic_root: Path | None = None) -> tuple[list[Payload], dict[str, Any]]:
    started = instant()
    synthetic = population == "synthetic"
    export_bytes, scenario, aliases = {}, {}, {}
    if synthetic:
        if synthetic_root is None:
            fail("--synthetic-root is required to pin or refresh synthetic")
        export_bytes, scenario, aliases = read_synthetic_export(synthetic_root)
        admission = [("synthetic", synthetic_root / "admission")]
        discovered = [(label, synthetic_root / "checkouts" / label, "synthetic") for label in SYNTHETIC_LABELS]
    else:
        admission, discovered = admission_sources(), discover_checkouts()
    # Resolve citations before the observation interval's file reads; no new salt in verify.
    facts, losses, joins = source_facts(), known_losses(), join_keys()
    ledger_evidence = source_cite("goals/time-to-certainty/PLAN.md", "not yet wired into any lane")
    salt = os.urandom(32)  # Never persist, print, or return this capture-local value.
    emitted, roots, checkouts, source_receipts, raw = [], [], [], [], {}
    provenance = "synthetic" if synthetic else "organic"

    def collect(path: Path, destination: str, kind: str, source: str,
                ndjson: bool = True, **metadata: Any) -> dict[str, Any]:
        observed_at = instant()
        if path.is_symlink():
            return complete(source, observed_at, "excluded-symlink")
        try:
            data = export_bytes[path] if synthetic else path.read_bytes()
        except (FileNotFoundError, KeyError):
            return complete(source, observed_at, "vanished-before-read")
        rows, census = transform_source(data, kind, salt, ndjson, aliases, synthetic)
        if not ndjson and not rows:
            return {**complete(source, observed_at, "excluded"), **census}
        pair = payload_pair(destination, rows, kind, source, observed_at, provenance=provenance, **metadata)
        emitted.extend(pair)
        raw[destination] = rows
        return {"path": destination, **complete(source, observed_at), **census}

    for label, root in admission:
        root_receipt = {"label": label, "status": "present" if root.is_dir() else "absent",
                        "complete_within": "named admission root at capture", "world": "closed"}
        for filename, kind in (("journal.ndjson", "admission"), ("protocol.json", "protocol")):
            source = f"<{label}-admission>/{filename}"
            path = root / filename
            receipt = collect(path, f"admission/{label}/{filename}", kind, source, filename.endswith(".ndjson")) \
                if path.is_file() else complete(source, instant(), "absent")
            if kind == "admission":
                rows = raw.get(receipt.get("path"), [])
                admitted = sum(r["_tag"] == "admission-admitted" for r in rows)
                receipt["ring_window"] = {"observed_rows": receipt.get("observed_rows", 0),
                    "writer_cap": 200, "writer_unit": "admitted transitions", "observed_admitted": admitted,
                    "at_writer_cap": admitted >= 200, "known_history_cap": 2400,
                    "retained_known_rows": len(rows), "at_known_history_cap": len(rows) >= 2400,
                    "wrapped": "unknown; below-cap does not prove complete history"}
            root_receipt["journal" if kind == "admission" else "protocol"] = receipt
        root_receipt["live"] = []
        for family in LIVE_FAMILIES:
            directory = root / family
            live_receipt = {"family": family, **complete(f"<{label}-admission>/{family}", instant(),
                                      "present" if directory.is_dir() else "absent"),
                            "files_observed": 0, "captured_files": 0, "excluded_lock_files": 0,
                            "excluded_symlinks": 0, "sources": []}
            if directory.is_dir():
                for path in sorted(directory.iterdir()):
                    if path.is_symlink():
                        live_receipt["excluded_symlinks"] += 1
                        continue
                    if locked_name(path.name):
                        live_receipt["excluded_lock_files"] += 1
                        continue
                    if not path.is_file():
                        continue
                    index = live_receipt["files_observed"]
                    live_receipt["files_observed"] += 1
                    target = f"live/{label}/{family}/state-{index:04d}.json"
                    source_name = f"<{label}-admission>/{family}/<state-{index:04d}>"
                    state = collect(path, target, "live", source_name, False)
                    live_receipt["sources"].append(state)
                    live_receipt["captured_files"] += int(state["status"] == "present")
            root_receipt["live"].append(live_receipt)
        roots.append(root_receipt)

    for label, checkout, kind in discovered:
        runs = checkout / ".beep/yeet/runs"
        descriptor_root = f"<synthetic-checkout:{label}>" if synthetic else f"<fleet>/{label}"
        row = {"checkout": label, "kind": kind, "runs_dir_listing": [], "attempt_files": 0,
               "complete_within": "listed run directories and ledger existence only during this capture", "world": "closed"}
        if runs.is_dir():
            for run in sorted(p for p in runs.iterdir() if p.is_dir() and not p.is_symlink()):
                validate_component(run.name, "run id")
                row["runs_dir_listing"].append(run.name)
                descriptor = f"{descriptor_root}/.beep/yeet/runs/{run.name}/attempts.ndjson"
                source = run / "attempts.ndjson"
                dest = f"attempts/{checkout_component(label)}/{run.name}/attempts.ndjson"
                receipt = collect(source, dest, "attempts", descriptor, checkout=label, run_id=run.name) \
                    if source.is_file() else complete(descriptor, instant(), "absent")
                row["attempt_files"] += int(receipt["status"] == "present")
                rows = raw.get(dest, [])
                terminal_ids = {r.get("attemptId") for r in rows
                                if r.get("_tag") in {"attempt-finished", "attempt-terminated"}
                                and isinstance(r.get("attemptId"), str)}
                receipt["ring_window"] = {"observed_rows": receipt.get("observed_rows", 0), "writer_cap": 50,
                    "writer_unit": "terminal attempts; active/protected/unknown rows may exceed cap",
                    "observed_terminal_attempts": len(terminal_ids), "at_writer_cap": len(terminal_ids) >= 50,
                    "compaction_receipts": sum(r.get("_tag") == "journal-compacted" for r in rows),
                    "wrapped": "unknown unless a retained compaction receipt supplies evidence"}
                source_receipts.append(receipt)
        row["runs_directory_status"] = "present" if runs.is_dir() else "absent"
        ledger = checkout / ".beep/yeet/proof-ledger.ndjson"
        row["proof_ledger"] = complete(f"{descriptor_root}/.beep/yeet/proof-ledger.ndjson", instant(),
                                       "present" if ledger.is_file() else "absent")
        checkouts.append(row)

    census = loss_population(raw, [label for label, _ in admission])
    if synthetic:
        verify_synthetic_expected(scenario["expected"], census)
        scenario["termination_join"] = synthetic_termination_join(raw)
    custody_variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))
    for receipt in [*source_receipts, *(r[field] for r in roots for field in ("journal", "protocol")),
                    *(s for r in roots for live in r["live"] for s in live["sources"])]:
        custody_variants.update(receipt.get("owner_refs_by_variant", {}))
    return emitted, {"capture_instant": started, "capture_finished_at": instant(), "stage": "B", "provenance": provenance,
        "capture_instant_basis": "capture start; files read once over the recorded interval, not an atomic fleet snapshot",
        **scenario,
        "custody": {"rule": 'ownerRef = sha12(f"{pid}:{procStart}:{captureSalt}")',
                    "member_rule": "remove underscore/hyphen and lowercase; ends with pid or contains procstart/processstart; legacy processid also protected",
                    "non_identity_allowlist": sorted(PROCESS_MEMBER_ALLOWLIST),
                    "pair_precedence": ["pid/procstart", "ownerpid/ownerprocstart", "attachedpid/<absent>"],
                    "other_identity_rule": "other variant uses sorted normalized identity-member JSON as the owner component; its first nonempty start member is the start, else <absent>",
                    "owner_refs_by_variant": dict(custody_variants),
                    "capture_salt_representation": "hexadecimal encoding of 32 random bytes",
                    "salt_policy": "per-capture, unrecorded, unlinkable across captures",
                    "missing_procStart_rule": "owner:<absent>:salt; missing, null and empty starts tallied as weaker keys",
                    "missing_procStart_caveat": "weak references cannot join full references by ownerRef; nonce remains available",
                    "nested_payloads": "each object containing a process identity receives its own ownerRef before member removal; precedence is local to that object"},
        "admission_roots": roots, "checkouts": checkouts,
        "checkout_counts": dict(collections.Counter(c["kind"] for c in checkouts)),
        "sources": source_receipts, "source_facts": facts, "loss_population": census,
        "proof_ledger": {"status": "re-parked to run 4", "ruling": 17, "evidence": ledger_evidence,
                         "checkouts_with_ledger": sum(c["proof_ledger"]["status"] == "present" for c in checkouts),
                         "expected_count": 0, "observation_basis": "file existence only; no ledger contents read or emitted"},
        "known_loss_classes": losses, "join_keys": joins,
        "live_state_filename_policy": "capture-local ordinals; payload sourcePath retains nonce and lease/ticket suffix with process component redacted",
        "excluded_sources": ["lock files and sidecars", "symlinks", "proof-locks", "verdict family", "ledger family", "checkout identity re-capture", "install roots"],
        "ts_adapter": "Ruling 7 non-trigger; no TS observations generated"}


def verify_census(manifest: dict[str, Any], raw: dict[str, list[JsonValue]]) -> None:
    """Bind every derived receipt and census field to persisted payloads."""
    files = {r["path"]: r for r in manifest["files"] if r["kind"] != PROJECTION_KIND}
    checked = set()
    custody_variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))

    def check_source(receipt: dict[str, Any], kind: str) -> None:
        path = receipt.get("path")
        rows = raw.get(path, [])
        if path is not None:
            if path not in raw or path in checked or receipt["status"] != "present":
                fail("source payload linkage differs")
            checked.add(path)
            verify_fields(files[path], {**complete(receipt["source"], receipt["observed_at"]),
                          "kind": kind, "source": {"file": receipt["source"], "line": 1}}, "source receipt linkage")
        elif receipt["status"] not in {"absent", "vanished-before-read", "excluded", "excluded-symlink"}:
            fail("source without payload has invalid status")
        if "retained_rows" in receipt:
            verify_fields(receipt, {"retained_rows": len(rows), "events": event_census(rows)}, "source census")
            excluded = receipt["excluded_undecodable"]
            exclusions = receipt.get("excluded_by_reason", {})
            if (any(type(n) is not int or n < 0 for n in exclusions.values())
                    or excluded != sum(exclusions.values()) or receipt["observed_rows"] != len(rows) + excluded):
                fail("source exclusion accounting differs")
            lines = receipt.get("retained_source_lines", [])
            if (len(lines) != len(rows) or any(type(n) is not int or n < 1 for n in lines)
                    or lines != sorted(set(lines))):
                fail("retained source line accounting differs")
            def owner_count(value: JsonValue) -> int:
                if isinstance(value, dict):
                    if "ownerRef" in value and (not isinstance(value["ownerRef"], str) or not re.fullmatch(r"[0-9a-f]{12}", value["ownerRef"])):
                        fail("invalid owner reference shape")
                    return int("ownerRef" in value) + sum(owner_count(v) for v in value.values())
                if isinstance(value, list):
                    return sum(owner_count(v) for v in value)
                return 0
            counts = receipt.get("redaction_counts", {})
            if counts.get("owner_refs", 0) != owner_count(rows):
                fail("owner reference census differs")
            variants = receipt.get("owner_refs_by_variant", {})
            if (set(variants) != set(OWNER_VARIANTS) or any(type(n) is not int or n < 0 for n in variants.values())
                    or sum(variants.values()) != counts.get("owner_refs", 0)):
                fail("owner reference variant accounting differs")
            custody_variants.update(variants)
            if not 0 <= counts.get("owner_refs_without_proc_start", 0) <= counts.get("owner_refs", 0):
                fail("weaker owner reference accounting differs")
        ring = receipt.get("ring_window")
        if ring is not None:
            expected = {"observed_rows": receipt.get("observed_rows", 0)}
            if kind == "admission":
                admitted = sum(r["_tag"] == "admission-admitted" for r in rows)
                expected.update(writer_cap=200, writer_unit="admitted transitions", observed_admitted=admitted,
                                at_writer_cap=admitted >= 200, known_history_cap=2400,
                                retained_known_rows=len(rows), at_known_history_cap=len(rows) >= 2400)
            elif kind == "attempts":
                terminal = {r["attemptId"] for r in rows if r.get("_tag") in {"attempt-finished", "attempt-terminated"}
                            and isinstance(r.get("attemptId"), str)}
                expected.update(writer_cap=50, observed_terminal_attempts=len(terminal), at_writer_cap=len(terminal) >= 50,
                                compaction_receipts=sum(r.get("_tag") == "journal-compacted" for r in rows))
            verify_fields(ring, expected, "ring census")

    labels = [root["label"] for root in manifest["admission_roots"]]
    if len(labels) != len(set(labels)):
        fail("duplicate admission root label")
    for root in manifest["admission_roots"]:
        validate_component(root["label"], "admission root")
        for field, kind, filename in (("journal", "admission", "journal.ndjson"), ("protocol", "protocol", "protocol.json")):
            receipt = root[field]
            check_source(receipt, kind)
            if "path" in receipt and receipt["path"] != f"admission/{root['label']}/{filename}":
                fail("admission path differs")
        if [live["family"] for live in root["live"]] != list(LIVE_FAMILIES):
            fail("live family census differs")
        for live in root["live"]:
            for index, receipt in enumerate(live["sources"]):
                check_source(receipt, "live")
                expected_path = f"live/{root['label']}/{live['family']}/state-{index:04d}.json"
                if "path" in receipt and receipt["path"] != expected_path:
                    fail("live path differs from family ordinal")
            verify_fields(live, {"files_observed": len(live["sources"]),
                          "captured_files": sum(r["status"] == "present" for r in live["sources"])}, "live census")
    for receipt in manifest["sources"]:
        check_source(receipt, "attempts")
    if checked != set(raw):
        fail("source census does not cover every raw payload exactly once")
    verify_fields(manifest["custody"], {"owner_refs_by_variant": dict(custody_variants)}, "custody variant census")
    census = loss_population(raw, labels)
    if manifest["loss_population"] != census:
        fail("loss-population census differs from pinned rows")
    checkouts = manifest["checkouts"]
    checkout_labels = [c["checkout"] for c in checkouts]
    if checkout_labels != sorted(set(checkout_labels)):
        fail("checkout labels duplicated or unordered")
    if manifest["checkout_counts"] != dict(collections.Counter(c["kind"] for c in checkouts)):
        fail("checkout kind census differs")
    for checkout in checkouts:
        component = checkout_component(checkout["checkout"])
        listing = checkout["runs_dir_listing"]
        if listing != sorted(set(listing)):
            fail("run directory listing duplicated or unordered")
        observed = sum(f"attempts/{component}/{run}/attempts.ndjson" in raw for run in listing)
        if checkout["attempt_files"] != observed:
            fail("checkout file census differs")
        if checkout["proof_ledger"]["status"] not in ("present", "absent"):
            fail("ledger existence receipt has unsupported status")
    by_label = {c["checkout"]: c for c in checkouts}
    for path, receipt in files.items():
        if receipt["kind"] == "attempts":
            label, run = receipt["checkout"], receipt["run_id"]
            if label not in by_label or run not in by_label[label]["runs_dir_listing"]:
                fail("attempt file checkout/run missing from census")
            if path != f"attempts/{checkout_component(label)}/{run}/attempts.ndjson":
                fail("checkout file path differs from label")
    verify_fields(manifest["proof_ledger"], {"status": "re-parked to run 4", "ruling": 17, "expected_count": 0,
                  "checkouts_with_ledger": sum(c["proof_ledger"]["status"] == "present" for c in checkouts)}, "ledger census")
    if manifest["provenance"] == "synthetic":
        if labels != ["synthetic"] or checkout_labels != list(SYNTHETIC_LABELS):
            fail("synthetic source inventory differs")
        verify_synthetic_expected(manifest["expected"], census)
        verify_fields(manifest, {"termination_join": synthetic_termination_join(raw)}, "synthetic termination join")
        observed_tokens = set()
        def visit_checkout_roots(value: JsonValue) -> None:
            if isinstance(value, dict):
                if "checkoutRoot" in value:
                    observed_tokens.add(value["checkoutRoot"])
                for child in value.values():
                    visit_checkout_roots(child)
            elif isinstance(value, list):
                for child in value:
                    visit_checkout_roots(child)
        for rows in raw.values():
            visit_checkout_roots(rows)
        allowed = {f"<synthetic-checkout:{label}>" for label in SYNTHETIC_SOURCE_LABELS}
        required = {f"<synthetic-checkout:{label}>" for label in SYNTHETIC_LABELS}
        if not required <= observed_tokens <= allowed:
            fail("synthetic checkout roots differ from declared labels")
        expected_labels = {token.replace("<synthetic-checkout:", "<source-checkout:"): token for token in sorted(observed_tokens)}
        verify_fields(manifest, {"synthetic_checkout_labels": expected_labels}, "synthetic checkout labels")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", choices=("fleet", "synthetic", "all"), help="deliberately replace the selected pin(s)")
    parser.add_argument("--synthetic-root", type=Path, help="READY-gated producer export; ignored for an existing pin's verification")
    args = parser.parse_args()
    if args.refresh in ("synthetic", "all") and args.synthetic_root is None:
        fail("--synthetic-root is required to refresh synthetic")
    summaries = {}
    for population, root in OUTPUT_ROOTS.items():
        refresh = args.refresh in (population, "all")
        if (root.exists() or root.is_symlink()) and not refresh:
            summaries[population] = {"status": "verified", **verify_output_tree(root, population)}
        elif population == "synthetic" and args.synthetic_root is None:
            summaries[population] = {"status": "absent", "reason": "supply --synthetic-root to pin the READY-gated export"}
        else:
            emitted, metadata = capture(population, args.synthetic_root if population == "synthetic" else None)
            manifest = finish_manifest(metadata, emitted, population)
            scan_output_bytes([(entry.path, entry.data) for entry in emitted] + [(MANIFEST_NAME, manifest)])
            summaries[population] = {"status": "pinned", **write_staged_capture(emitted, manifest, root, population)}
    print(json.dumps({"verification": "PASS", **summaries}, sort_keys=True))


if __name__ == "__main__":
    main()
