"""Capture and verify the public run-4 Stage C proof-ledger corpus (``run4-ledger``).

Run with ``UV_CACHE_DIR=$HOME/.cache/beep/uv-cache uv run --offline --with pyyaml python -B <this-script>``.
First success pins; ordinary reruns verify ONLY pinned bytes, this generator and the tree-pinned
citations. ``--refresh ledger`` deliberately captures again. ``--dry-run-root DIR`` captures and fully
verifies into ``DIR/run4-ledger`` (DIR absolute and outside the repository and the fleet root) and never
touches the corpus home; a rerun with the same ``--dry-run-root`` and no ``--refresh`` verifies that tree.
Exit 0 is PASS, 1 is any failure (one actionable message that never echoes residue bytes), and 3 means the
run-4 gate does not hold (one census line; nothing is written). A post-cut merged-preview fact never refuses
the pin: it is pinned and counted, and the census reading says so (P1 Ruling 8).
Stdlib + PyYAML only. The run3b mechanics are copied, never imported or modified; this generator is
standalone so its self-pin covers its full implementation. It reads each owning clone's proof ledger as a
document only (graduation Ruling 3): it never imports repo-cli, never writes through the ledger, never
opens anything under a linked worktree's ``.beep`` tree, and reads no attempt journal (P1 note f).

Lineage (``etl_run3b_fleet_corpus.py``; Stage B Ruling 18 "patterns copied, nothing imported"; run-3
Ruling 22 rider "manifests record generator lineage"):

- Copied byte-identical: ``_repo_root``, ``fleet_root``, the identifier and residue regex constants,
  ``fail``, ``sha256``, ``reject_json_constant``, ``unique_object``, ``decode_json``, ``decode_ndjson``,
  ``same_json``, ``host_prefixes``, ``uri_host_root_pattern``, ``redact_host_root``, ``redact_pid_match``,
  ``redact_process_text``, ``redact_string``, ``normalized_member``, ``process_member``,
  ``owner_ref_census``, ``verify_owner_census``, ``guard_origin``, ``redact``, ``encode_ndjson``,
  ``encode_json``, ``render_property_scalar``, ``eligible_property_pairs``,
  ``encode_properties_projection``, ``projected_bytes``, ``projection_path``, ``parse_timestamp_scalar``,
  ``collect_timestamps``, ``format_timestamp``, ``timestamp_bounds``, ``validate_component``,
  ``checkout_component``, ``strict_object``, ``event_census``, ``locked_name``, ``instant``, ``complete``,
  ``safe_relative_path``, ``Payload``, ``record_observations``, ``verify_fields``, ``payload_pair``,
  ``write_staged_capture`` (generic over the root name; the stage directory is ``.run4-ledger-stage-*``).
  ``strict_object``, ``event_census`` and ``locked_name`` are unused here and kept so the brief's
  copy-unchanged set is whole: the run-4 decoder classifies tears itself (see below), ledger rows carry no
  ``_tag`` (a kind census replaces ``event_census``), and one exact path per owning clone is read, so no
  lock-name filter applies.
- Extended: ``scan_output_bytes`` keeps every run3b class except where noted and adds (a) a capture-only
  ``identity`` argument: every hostname form (``gethostname``, ``getfqdn``, short names) and its sha12 in
  three letter cases, the login name, the home basename and the fleet root's home-owner component, all
  matched case-insensitively; (b) the capture-only exact-bytes deny list of every raw host path the capture
  saw (fleet root, checkout, owner and excluded-checkout roots, raw ``originKey`` values, home, the session
  temp root), case-insensitive and never persisted. Verify passes neither, so a fresh clone verifies on any
  host and login; run3b's verify-time hostname check moves to capture with them, and verify runs the copied
  ``redact`` idempotence check under ``host_independent_redaction`` (a NUL-delimited stand-in hostname),
  because the copied ``redact_string`` rewrites the running hostname. (c) A bare ``~/`` anywhere;
  (d) the knowledge-refs encoded home marker (dash, home, dash) wherever it starts a path component, i.e.
  not after an ASCII letter or digit, in every label, payload and ``MANIFEST.yaml`` (the run4-fleet rule,
  P1 call s): a branch-derived lane label such as ``<x>-worktrees/workspace-home-paths`` or a branch such as
  ``feat/take-home-exam`` is an ordinary public label, and (a) still catches an encoded home there; (e) uid assignments (``uid=N``, ``"uid": N``, ``gid`` alike) and relative ``run/user/N``
  continuations; (f) the ``sk-`` provider key needs a left boundary that excludes only ASCII letters and
  digits (run3b matched ``task`` inside long names; the first run-4 boundary missed ``x_sk-...``), plus
  GitHub ``gh[ousr]_``, GitLab, Stripe, Google, npm, JWT and Slack webhook shapes; (g) ``token``, ``auth``
  and ``credential`` assignment names. ``deny_tokens`` is new.
- Replaced: run3b's working-tree ``source_cite``/``verify_source_citations`` by tree-pinned citations
  (``TreeReader``, ``cite``, ``verify_tree_citations``) against ``refs/remotes/origin/main``'s tree
  (graduation Ruling 8 item 7, P1 Ruling 4); the ``git`` wrapper is ``git_run`` with
  ``--no-replace-objects --no-lazy-fetch`` and a scrubbed environment, and only after a failed probe spawns
  ``git version`` so an old git is named instead of misreported as a missing object. ``fact`` takes
  ``(reader, value, file, needle, occurrence)`` instead of run3b's ``(value, file, needle)``.
  ``source_facts`` is rewritten as one table (``source_fact_specs``) over the ledger writer, reader and
  schemas, used by capture and by verify, so every value, file, needle and occurrence is bound.
  ``discover_checkouts`` keeps run3b's name with different semantics: filesystem-only public-origin filter
  with counts by reason (P1 Ruling 5(1), note h), Claude-app worktrees of every clone including nested ones
  (P1 Ruling 5(2)), ``os.path`` probes that never raise and unreadable directories counted
  (``unreadable_candidate_directory``), never echoed, and the excluded paths returned in memory for the
  label guard and the deny list; ``main`` turns any other ``OSError`` during capture into one message
  without a path. ``finish_manifest``, ``verify_output_tree``, ``verify_census``,
  ``capture`` and ``main`` are ledger-specific; ``main`` prints ``advisories`` and, for a dry run,
  ``dry_run`` beside run3b's summary.
- Dropped: ``join_keys`` and ``known_losses`` (admission and attempt join keys and loss classes belong to
  the run4-fleet population; this pin reads no journal, P1 note f; run3b's ``join_keys().originKey`` prose
  describes the admission field, not the ledger's ``originKey``), so the run3b manifest members
  ``known_loss_classes``, ``join_keys``, ``proof_ledger``, ``checkouts``/``checkout_counts``, ``sources``,
  ``loss_population``, ``live_state_filename_policy`` and ``ts_adapter`` are absent; ``gate``, ``cut``,
  ``merged_preview_followup``, ``discovery``, ``ledgers``, ``census``, ``capture_only_members`` take their
  place (P1 Rulings 1, 2, 6). Also unused and not copied: ``transform_source``, ``validate_envelope``,
  ``classify_chain``, ``loss_population``, ``admission_sources``, the synthetic export helpers and
  ``migrate_custody_census`` (no admission, synthetic or legacy pin here).
- Rules prose: ``PROJECTION_RULES`` keeps run3b's five items and adds four (reuse-key width, originKey
  label, row id by source line, pairing over decoded rows with orphans kept beside a tear).
  ``REDACTION_RULES`` keeps run3b's first seven items, drops
  "Lock files and proof-locks are excluded;" from the eighth (one exact ledger path per owner is read, never
  a lock file) and adds six (ledger member guard, capture-only identity, shape classes, the home marker,
  git-ignored paths, encoded host bytes out of scope).
- New: owning-clone resolution mirroring the time-to-certainty ruling 71 resolver without spawning git
  (P1 Ruling 2); a strict exact-key-set ledger decoder (duplicate members and NaN fail closed as drift;
  invalid UTF-8 and JSON syntax errors are tears, tallied, located (``torn_line_ranges``) and excluded);
  pairing over the decoded rows, so an intact pair with a torn line between its members still pairs, while
  an orphan whose raw neighbour toward its missing partner is a tear or the unterminated tail is KEPT in the
  payload, counted as ``unpaired_adjacent_to_tear`` per ledger and in ``census.pairing``, and left out of
  pairs, hit resolution, the gate count and the paired census; any other orphan, including a shadow
  followed by a disagreeing fact, fails closed (P1 note e, P1 Ruling 2 addendum, brief W4-A6, P1 Ruling 6
  "every terminated row"); "neighbour" is read directionally (the next non-empty raw line after a shadow,
  the previous one before a fact) because a tear on the far side cannot have destroyed the partner, and
  empty lines are skipped as the TypeScript reader skips them; verify recomputes the pairing and the orphan
  counts from the pinned rows plus the recorded ranges; ``source_line_ranges`` per ledger so row id is
  (label, source line);
  the originKey label projection with a refusal for any label naming an excluded checkout (P1 notes d, h);
  11-hex reuse-key prefixes (P1 Ruling 3; see below); whole-ledger pins with a cut census (P1 Ruling 6);
  the amended gate; post-cut merged-preview facts are pinned and counted, never refused, and
  ``stage_census.merged-preview.reading`` is "dormant in capture window (P1 Ruling 1)" only when no
  merged-preview FACT lies after the cut, else "observed after the cut: <n> merged-preview fact(s) (P1
  Ruling 8)", recomputed at verify from pinned bytes; the count is of facts (P1 call t), orphans kept beside
  a tear included, so a lone post-cut merged-preview shadow whose fact tore reads dormant and stays under
  the tear receipts. P1 Ruling 8 replaces the lane's earlier exit-3 refusal and narrows note (l): that
  refusal made the pin hostage to one attempt; exact member sets and constant prose bound
  at verify, with ``capture_only_members`` naming what verify can only bound, never recompute; emitted
  paths refused when ``.gitignore`` would swallow them; ``--dry-run-root`` refused under the fleet root too.
- Deviations from the lane brief: the reuse-key width is 11, not 12: twelve distinct hex digits carry
  log2(12) = 3.58 bits, above gitleaks' 3.5-bit generic-api-key cut, so the required hosted Secret Scanning
  check (base-branch config) flags about 0.3% of 12-hex keys; no 11-character value can exceed 3.46 bits.
  P1 Ruling 3 as first written names 12 hex; its amendment to 11 hex is recorded in the goal decisions log
  (2026-10-06 build sitting), and the manifest's projection rule cites the ruling as amended.
  ``merged_preview_followup`` follows P1 Ruling 8 instead of W4-A4's text: the later sibling pin covers
  only merged-preview facts recorded after this pin, because post-cut ones already recorded are pinned
  here. Tear
  receipts use W4-A6's name ``unpaired_adjacent_to_tear`` (per ledger and in ``census.pairing``) and add
  ``torn_line_ranges``, capture-only positions that verify bounds and replays.
  No raw-ledger digest or length is recorded,
  not even a fleet-root-neutral one (W4-A1, P1 note i): torn rows and an unterminated tail are digested but
  never emitted, so any digest of source bytes is an offline oracle. ``census.residue.deny_list_hits`` stays
  (brief) beside ``deny_list_basis``, which says it is 0 by construction.
"""
from __future__ import annotations

import argparse
import collections
import contextlib
import copy
import dataclasses
import datetime as dt
import hashlib
import json
import math
import os
import pwd
import re
import shutil
import socket
import stat
import subprocess
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, NoReturn, TypeAlias
from urllib.parse import quote, urlsplit

import yaml

SCRIPT = Path(__file__).resolve()
CORPUS_ROOT = SCRIPT.parent
MANIFEST_NAME = "MANIFEST.yaml"
PROJECTION_KIND = "properties_projection"
CLI = "packages/tooling/tool/cli/src/"
REPO_RUN = CLI + "internal/repo-run/"
YEET = CLI + "commands/Yeet/internal/"
PACKET = "explorations/beep-ci-operational-ontology/"
CORPUS_REL = PACKET + "ontology/extraction/s4/beep-ci-ops/corpus/"
LINEAGE_GENERATOR = "etl_run3b_fleet_corpus.py"
TTC_PLAN = "goals/time-to-certainty/PLAN.md"
C4_1_NEEDLE = "C4.1 shadow mode — done 2026-09-21"
C4_1_CHECKED_PREFIX = "  - [x]"
CUT_INSTANT = "2026-09-28T15:09:38Z"
CUT_COMMIT = "9d52d8f587"
CORPUS_REF = "refs/remotes/origin/main"
PUBLIC_ORIGIN = "github.com/beep-effect/beep-effect"
LEDGER_PARTS = (".beep", "yeet", "proof-ledger.ndjson")
LEDGER_KIND = "proof-ledger"
# P1 Ruling 3 width, amended from 12 to 11. Gitleaks' generic-api-key entropy cut (3.5 bits) is exceeded by
# a 12-hex value whose twelve digits are all distinct (log2(12) = 3.58), which the required hosted Secret
# Scanning check flags; no value of 11 or fewer characters can exceed log2(11) = 3.46.
REUSE_KEY_HEX = 11
GITLEAKS_ENTROPY_CUT = 3.5
MERGED_PREVIEW_FOLLOWUP = ("a later sibling pin captures merged-preview facts recorded after this pin; post-cut "
                           "merged-preview facts recorded before it are pinned and counted here (P1 Rulings 1 and 8)")
GIT_ENV_DROP = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
                "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE", "GIT_REPLACE_REF_BASE")


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
# Identifier tokens, shared by structural keys and serialized string members.
PROCESS_MEMBER_PATTERN = (
    r"(?:(?i:pid|ppid|process[_-]?id)"
    r"|[A-Za-z0-9_-]*[a-z0-9](?:Pid|PID)|[A-Za-z0-9_-]+[_-](?i:pid)"
    r"|(?:(?:[A-Za-z0-9_-]+[_-])?(?:procStart|processStart)|[A-Za-z0-9_-]*[a-z0-9](?:ProcStart|ProcessStart|PROCSTART|PROCESSSTART))(?:[A-Z][A-Za-z0-9]*)?"
    r"|(?i:(?:[a-z0-9_-]+[_-])?(?:proc|process)[_-]start(?:[_-][a-z0-9]+)*))"
)
PROCESS_MEMBER = re.compile(PROCESS_MEMBER_PATTERN)
# Atomic whitespace prevents retries over long nonmatching diagnostic messages.
PID_IN_TEXT = re.compile(
    r"(?<![A-Za-z0-9_-])(?P<member>" + PROCESS_MEMBER_PATTERN + r")"
    r"""(?P<prefix>(?>(?P<key_quote>\\*["'])?(?>(?:\s|\\+[nrt])*)(?P<assignment>[=:](?>(?:\s|\\+[nrt])*))?(?P<value_quote>\\*["'])?))"""
    r"""(?P<value>(?(value_quote)(?:(?!(?P=value_quote))[^\\\r\n]|\\.)*(?=(?P=value_quote))|(?(assignment)[^\s,;:{}\[\]\\"'=]+|[0-9]+)))"""
)
# Consume complete JSON strings, including escaped characters, on both sides.
# Nested serialization is decoded one string at a time, preserving its depth.
JSON_STRING_PATTERN = r'"(?:[^"\\]|\\.)*"'
JSON_TEXT_MEMBER = re.compile(
    r"(?P<string>" + JSON_STRING_PATTERN + r")"
    r"(?P<separator>\s*[:=]\s*)?"
)
# Compatibility name for diagnostics; only unredacted values count as residue.
PROCESS_METADATA_IN_TEXT = PID_IN_TEXT
TIMESTAMP_KEY = re.compile(r"(?:^ts$|AtMillis$|At$|TimestampMillis$|Timestamp$)")
PROPERTY_KEY = re.compile(r"[A-Za-z0-9_]+")
PROPERTY_RECORD_COMMENT = re.compile(r"# record (0|[1-9][0-9]*)")
# Outside a URI prefix, retain the existing slash/colon boundary rule.
PATH_LEFT_BOUNDARY = r"(?:(?<![A-Za-z0-9_.~/-])|(?<=[/:]/))"
PATH_RIGHT_BOUNDARY = r"(?=/|$|[\s\"'=,:;)\]])"
OWNER_VARIANTS = ("pid_pair", "ownerpid", "attachedpid", "weak")
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


def uri_host_root_pattern(root_pattern: str) -> str:
    """Capture the URI authority and bounded host root without variable-width lookbehind."""
    return r'''((?i:[a-z][a-z0-9+.-]*)://[^/\s"']*)(''' + root_pattern + ")" + PATH_RIGHT_BOUNDARY


def redact_host_root(value: str, root_pattern: str, replacement: str) -> str:
    """Keep a slash before URI tokens so they cannot become part of the authority on replay."""
    value = re.sub(uri_host_root_pattern(root_pattern), lambda match: match[1] + "/" + replacement, value)
    return re.sub(PATH_LEFT_BOUNDARY + root_pattern + PATH_RIGHT_BOUNDARY, lambda _: replacement, value)


def redact_pid_match(match: re.Match[str]) -> str:
    """Preserve JSON punctuation and escaping while replacing process scalar values."""
    if match["value"] in ("<redacted>", "null"):
        return match[0]
    replacement = "null" if match["key_quote"] and not match["value_quote"] else "<redacted>"
    return match["member"] + match["prefix"] + replacement


def redact_process_text(value: str) -> str:
    """Redact whole serialized values; never reinterpret part of a quoted key."""
    parts = []
    end = 0
    for match in JSON_TEXT_MEMBER.finditer(value):
        if match.start() < end:
            continue
        # Free-text assignments can start before a quoted value. Consume them
        # only from the unquoted gap, never from the middle of a JSON token.
        for bare in PID_IN_TEXT.finditer(value, end, match.end()):
            if bare.start() >= match.start():
                break
            parts.append(value[end:bare.start()])
            parts.append(redact_pid_match(bare))
            end = bare.end()
        if end > match.start():
            parts.append(value[end:match.end()])
            end = match.end()
            continue
        parts.append(value[end:match.start()])
        token = match["string"]
        try:
            decoded = json.loads(token)
        except json.JSONDecodeError:
            # Malformed diagnostic strings still receive the free-text rewrite.
            parts.append(PID_IN_TEXT.sub(redact_pid_match, match[0]))
            end = match.end()
            continue
        if match["separator"]:
            parts.append(match[0])
            end = match.end()
            if process_member(decoded):
                scalar = re.match(JSON_STRING_PATTERN + r'|[^\s,;:{}\[\]\\"\'=]+', value[end:])
                if scalar:
                    parts.append('"<redacted>"' if scalar[0].startswith('"') else "null")
                    end += scalar.end()
        else:
            redacted = redact_process_text(decoded)
            parts.append(token if redacted == decoded else json.dumps(redacted, ensure_ascii=False))
            end = match.end()
    parts.append(PID_IN_TEXT.sub(redact_pid_match, value[end:]))
    return "".join(parts)


def redact_string(value: str, aliases: dict[str, str] | None = None) -> str:
    for prefix, token in sorted((aliases or {}).items(), key=lambda item: -len(item[0])):
        value = redact_host_root(value, re.escape(prefix), token)
    value = redact_host_root(value, re.escape("~/.beep/runtime"), "<runtime-root>")
    value = re.sub(r"-\d+(?=\.(?:lease|ticket)\.json)", "-<process>", value)
    value = re.sub(r"merged-preview-\d+", "merged-preview-<process>", value)
    value = redact_host_root(value, r"/run/user/\d+", "<runtime>")
    value = redact_host_root(value, r"/proc/\d+", "<proc>/<process>")
    value = re.sub(r"(user(?:-runtime-dir)?@)\d+(\.service)", r"\1<uid>\2", value)
    value = re.sub(r"user-\d+\.slice", "user-<uid>.slice", value)
    for prefix, replacement in host_prefixes():
        value = redact_host_root(value, re.escape(prefix), replacement)
    hostname = socket.gethostname()
    value = value.replace(sha256(hostname.encode())[:12], "<host>")
    value = value.replace(hostname, "<host>")
    value = re.sub(r"\buid-\d+", "uid-<uid>", value)
    return redact_process_text(value)


def normalized_member(key: str) -> str:
    return key.replace("_", "").replace("-", "").lower()


def process_member(key: str) -> bool:
    return PROCESS_MEMBER.fullmatch(key) is not None


def owner_ref_census(value: JsonValue, legacy: bool = False) -> collections.Counter:
    """Count custody variants from object-local pinned bytes, including nested claims."""
    result = collections.Counter()
    if isinstance(value, dict):
        if "ownerRef" in value:
            if not isinstance(value["ownerRef"], str) or not re.fullmatch(r"[0-9a-f]{12}", value["ownerRef"]):
                fail("invalid owner reference shape")
            variant = value.get("ownerRefVariant")
            if not legacy and variant not in OWNER_VARIANTS:
                fail("missing or invalid owner reference variant")
            result[variant if variant in OWNER_VARIANTS else "weak"] += 1
        elif "ownerRefVariant" in value:
            fail("owner reference variant without surrogate")
        for child in value.values():
            result.update(owner_ref_census(child, legacy))
    elif isinstance(value, list):
        for child in value:
            result.update(owner_ref_census(child, legacy))
    return result


def verify_owner_census(receipt: dict[str, Any], rows: list[JsonValue], legacy: bool) -> collections.Counter:
    counts = receipt.get("redaction_counts", {})
    variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))
    variants.update(owner_ref_census(rows, legacy))
    total = sum(variants.values())
    if counts.get("owner_refs", 0) != total:
        fail("owner reference census differs")
    if not legacy:
        recorded = receipt.get("owner_refs_by_variant")
        if (not isinstance(recorded, dict) or any(type(n) is not int or n < 0 for n in recorded.values())
                or recorded != dict(variants)):
            fail("owner reference variant accounting differs from pinned bytes")
    if not 0 <= counts.get("owner_refs_without_start", 0) <= total:
        fail("weaker owner reference accounting differs")
    return variants


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
    if salt is not None and len(identities) != sum(process_member(key) for key in value):
        fail("ambiguous normalized process identity members")
    if identities and salt is not None:
        if "ownerRef" in value or "ownerRefVariant" in value:
            fail("source ownerRef collides with capture custody surrogate")
        variant = next((key for key in ("pid", "ownerpid", "attachedpid") if key in identities), "other")
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
        result["ownerRefVariant"] = {"pid": "pid_pair", "other": "weak"}.get(variant, variant)
        counts["owner_refs_variant_" + result["ownerRefVariant"]] += 1
        if start == "<absent>":
            counts["owner_refs_without_start"] += 1
    for key, child in value.items():
        if process_member(key):
            counts["dropped_member_" + normalized_member(key) + "_count"] += 1
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


def login_name() -> str:
    """The capturing user's login name; an unknown uid yields no token."""
    try:
        return pwd.getpwuid(os.getuid()).pw_name
    except KeyError:
        return ""


def capture_identity_tokens() -> list[bytes]:
    """Capture-only identity tokens, compared case-insensitively: every hostname form and its sha12 in three
    letter cases, the login name, the home directory's basename and the fleet root's home-owner component."""
    hosts: set[str] = set()
    for name in (socket.gethostname(), socket.getfqdn()):
        if name:
            hosts |= {name, name.split(".")[0]}
    cased = {form for name in hosts for form in (name, name.lower(), name.upper())}
    owners = {login_name(), Path.home().name}
    parts = FLEET_ROOT.parts
    if len(parts) > 2 and parts[1] == "home":
        owners.add(parts[2])
    tokens = cased | {sha256(name.encode())[:12] for name in cased} | owners
    return sorted({token.lower().encode() for token in tokens if token})


# Knowledge-refs gate class, shared with the run4-fleet capture (P1 call s): the encoded session-directory
# form starts a path component (its leading slash became a dash), so a mid-token occurrence is a public label.
ENCODED_HOME_MARKER = re.compile(rb"(?<![A-Za-z0-9])-home-")
PROVIDER_KEY = re.compile(
    rb"(?<![A-Za-z0-9])sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|(?<![A-Za-z0-9])[sr]k_(?:live|test)_[A-Za-z0-9]{10,}"
    rb"|gh[ousr]_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|npm_[A-Za-z0-9]{36}"
    rb"|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}|hooks\.slack\.com/services/"
    rb"|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----")
CREDENTIAL_ASSIGNMENT = re.compile(
    rb"(?i)(?:authorization[\" ]*[:=]\s*[\"]?bearer\s+\S+|(?:password|api[_-]?key|access[_-]?token|secret"
    rb"|(?<![A-Za-z0-9])(?:token|auth|credentials?))[\" ]*[:=]\s*[\"]?[A-Za-z0-9+/=_-]{16,})")
USER_IDENTITY = re.compile(
    rb"(?i:user(?:-runtime-dir)?@\d+\.service|user-\d+\.slice|\buid-\d+|\b[ug]id[\"']?\s*[=:]\s*[\"']?\d|run/user/\d)")


def scan_output_bytes(files: list[tuple[str, bytes]], deny: tuple[bytes, ...] | list[bytes] = (),
                      identity: list[bytes] | None = None) -> None:
    """Fail closed without printing matched private bytes (including path names).

    ``identity`` and ``deny`` are capture-only: they name the capturing host, so verify (any host, any login)
    runs only the host-independent shape classes and stays portable.
    """
    roots = {prefix for prefix, _ in host_prefixes()} | {"/home", "/tmp", "/run/user", "/proc", "/dev/shm", "~/.beep/runtime"}
    host_paths = [re.compile(pattern.encode()) for prefix in roots for pattern in (
        uri_host_root_pattern(re.escape(prefix)),
        PATH_LEFT_BOUNDARY + re.escape(prefix) + PATH_RIGHT_BOUNDARY,
    )]
    denied = [token.lower() for token in deny if token]
    identities = [token.lower() for token in identity or () if token]
    for _label, data in files:
        combined = _label.encode() + b"\n" + data
        if identity is not None:
            folded = combined.lower()
            # Run-4 addition: exact bytes of every raw host path this capture saw (never persisted), any case.
            if any(token in folded for token in denied):
                fail("residue scan failed: capture deny-list host bytes")
            # Run-4 addition: hostname forms, their sha12, login and home-owner names in any letter case.
            if any(token in folded for token in identities):
                fail("residue scan failed: hostname, hostname digest, login or home-owner name (any letter case)")
        if any(pattern.search(combined) for pattern in host_paths):
            fail("residue scan failed: host path")
        # Run-4 addition: bare home-relative paths (git refuses "~" in branch names, so no ref can carry one).
        if b"~/" in combined:
            fail("residue scan failed: home-relative path")
        # Run-4 addition: the knowledge-refs gate's encoded home marker where it starts a path component, in every
        # label and file (the run4-fleet rule, P1 call s); mid-token forms such as feat/take-home-exam or a lane
        # named workspace-home-paths stay legal (identity tokens catch an encoded home there).
        if ENCODED_HOME_MARKER.search(combined):
            fail("residue scan failed: encoded home marker starting a path component")
        # Run-4 extension: uid assignments and relative runtime-directory continuations as well.
        if USER_IDENTITY.search(combined):
            fail("residue scan failed: user identity in runtime or unit name, or a uid assignment")
        if re.search(rb"(?:merged-preview-\d+|-\d+\.(?:lease|ticket)\.json)", combined):
            fail("residue scan failed: process identity in state or preview filename")
        # Consume whole JSON strings so member-like text inside a VALUE is never a key.
        members = [] if _label.endswith(".properties") else [
            json.loads(match[1]) for match in re.finditer(rb'("(?:\\.|[^"\\\r\n])*")\s*(:)?', data) if match[2]]
        properties = [match[1].decode() for match in re.finditer(rb"(?m)^[ \t]*([^\s=]+)[ \t]*=", data)]
        if any(process_member(key) for key in members + properties):
            fail("residue scan failed: process identity member")
        text = combined.decode("utf-8")
        if redact_process_text(text) != text:
            fail("residue scan failed: free-text process identifier")
        if b"ghp_" in combined or b"github_pat_" in combined:
            fail("residue scan failed: GitHub credential prefix")
        if OP_REFERENCE_WITH_MATERIAL.search(combined):
            fail("residue scan failed: 1Password reference with credential material")
        if re.search(rb"://[^/@\s\"]+@", combined):
            fail("residue scan failed: credential-bearing URL")
        # Run-4 fix: sk- needs a left boundary that excludes only ASCII letters and digits (run3b matched "task"
        # inside long names); run-4 adds GitHub, GitLab, Stripe, Google, npm, JWT and Slack webhook shapes.
        if PROVIDER_KEY.search(combined):
            fail("residue scan failed: provider credential or private key")
        if CREDENTIAL_ASSIGNMENT.search(combined):
            fail("residue scan failed: credential assignment")


def deny_tokens(values: list[str]) -> list[bytes]:
    """Exact-bytes deny list; a token that contains a shorter listed token adds nothing."""
    tokens = sorted({value.lower().encode() for value in values if value}, key=lambda token: (len(token), token))
    kept: list[bytes] = []
    for token in tokens:
        if not any(shorter in token for shorter in kept):
            kept.append(token)
    return kept


# .gitignore traps (repository root): an emitted path with one of these components is silently dropped at
# commit, so verify on a fresh clone would fail. Names are compared case-sensitively, as git does.
IGNORED_COMPONENTS = frozenset({".beep", ".claude", "docs", "tmp", "dist", "build", "coverage", "trace", "secrets",
                                ".secrets", "__pycache__", "credentials.json", "secrets.json"})
IGNORED_NAME = re.compile(r"\.env(?:\..*)?|.*\.(?:key|pem|p12|pfx|crt|cer|pyc)|service-account.*\.json")


def refuse_ignored_path(path: str) -> None:
    if any(part in IGNORED_COMPONENTS or IGNORED_NAME.fullmatch(part) for part in PurePosixPath(path).parts):
        fail("emitted path would be git-ignored at commit; rename the checkout or extend the path encoding")


def event_census(rows: list[JsonValue]) -> list[dict[str, Any]]:
    counter = collections.Counter((r.get("schemaVersion", "<absent>"), r.get("_tag", "<absent>")) for r in rows)
    return [{"schemaVersion": key[0], "_tag": key[1], "rows": value}
            for key, value in sorted(counter.items())]


def locked_name(name: str) -> bool:
    return ".lock" in name.lower() or name.lower().endswith("lock")


def strict_object(data: bytes) -> dict[str, JsonValue]:
    """Classified parse failure, with no source bytes in diagnostics."""
    try:
        value = decode_json(data, "source")
    except (SystemExit, ValueError, UnicodeError):
        raise ValueError("invalid-json") from None
    if not isinstance(value, dict):
        raise ValueError("non-object")
    return value


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


# --- Tree-pinned citations (graduation Ruling 8 item 7, P1 Ruling 4) -------------------------------------


def git_env() -> dict[str, str]:
    return {key: value for key, value in os.environ.items() if key not in GIT_ENV_DROP}


def git_run(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run git plumbing against REPO_ROOT; stderr is withheld from every message."""
    completed = subprocess.run(["git", "--no-optional-locks", "--no-replace-objects", "--no-lazy-fetch",
                                "-C", str(REPO_ROOT), *args], env=git_env(), capture_output=True, timeout=60)
    if check and completed.returncode:
        fail("git probe failed: " + " ".join(args) + " (stderr withheld)")
    return completed


def git_text(*args: str) -> str:
    return git_run(*args).stdout.decode("utf-8").strip()


def require_git_flags() -> None:
    """Spawned only after a failed probe: a git older than 2.45 rejects --no-lazy-fetch (exit 129), which must
    not be misreported as an absent object or ref."""
    if git_run("version", check=False).returncode:
        fail("git rejects --no-lazy-fetch; git 2.45 or newer is required to capture or verify this pin")


def object_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        fail(f"{label} is not a full object id")
    return value


class TreeReader:
    """Read blobs at one recorded tree id; ``None`` marks a missing path."""

    def __init__(self, tree: str) -> None:
        self.tree = object_id(tree, "corpus_tree")
        self.cache: dict[str, bytes | None] = {}

    def blob(self, file: str) -> bytes | None:
        safe_relative_path(file)
        if file not in self.cache:
            completed = git_run("cat-file", "blob", f"{self.tree}:{file}", check=False)
            self.cache[file] = None if completed.returncode else completed.stdout
        return self.cache[file]

    def lines(self, file: str) -> list[str] | None:
        data = self.blob(file)
        if data is None:
            return None
        try:
            return data.decode("utf-8").splitlines()
        except UnicodeDecodeError:
            fail("cited file is not UTF-8: " + file)


def probe_corpus() -> dict[str, str]:
    """Probe origin/main once, before any observation read; never fetch."""
    if git_run("rev-parse", "--verify", "--quiet", CORPUS_REF, check=False).returncode:
        require_git_flags()
        fail("refs/remotes/origin/main is absent; fetch origin before capturing")
    probe = {"corpus_commit": git_text("rev-parse", "--verify", CORPUS_REF + "^{commit}"),
             "corpus_tree": git_text("rev-parse", "--verify", CORPUS_REF + "^{tree}"),
             "corpus_base": git_text("merge-base", "HEAD", CORPUS_REF),
             "capture_head": git_text("rev-parse", "--verify", "HEAD^{commit}")}
    for key, value in probe.items():
        object_id(value, key)
    return probe


def cite(reader: TreeReader, file: str, needle: str, occurrence: int | None = None) -> dict[str, Any]:
    """Resolve a needle in the recorded tree; the capturing checkout's copy must equal the blob."""
    lines = reader.lines(file)
    if lines is None:
        fail("source citation file missing from corpus_tree: " + file)
    matches = [number for number, line in enumerate(lines, 1) if needle in line]
    if not matches:
        fail("source citation anchor missing: " + file)
    if occurrence is None and len(matches) > 1:
        fail("source citation anchor ambiguous: " + file)
    if occurrence is not None and not 1 <= occurrence <= len(matches):
        fail("source citation occurrence missing: " + file)
    working = REPO_ROOT / file
    if not working.is_file() or working.read_bytes() != reader.blob(file):
        fail("cited file differs from corpus_tree; merge origin/main into the capturing checkout: " + file)
    result = {"file": file, "line": matches[(occurrence or 1) - 1], "needle": needle,
              "sha256": sha256(reader.blob(file))}
    if occurrence is not None:
        result["occurrence"] = occurrence
    return result


def fact(reader: TreeReader, value: Any, file: str, needle: str, occurrence: int | None = None) -> dict[str, Any]:
    return {"value": value, "source": cite(reader, file, needle, occurrence)}


def repository_citations(value: Any, found: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every ``{file, line}`` dict whose file is not an angle-bracket fleet descriptor."""
    if isinstance(value, dict):
        if "file" in value and "line" in value and not (isinstance(value["file"], str) and value["file"].startswith("<")):
            found.append(value)
        for child in value.values():
            repository_citations(child, found)
    elif isinstance(value, list):
        for child in value:
            repository_citations(child, found)
    return found


def citation_holds(citation: dict[str, Any], lines: list[str] | None, blob: bytes | None, hashes: bool) -> bool:
    line, needle = citation.get("line"), citation.get("needle")
    if lines is None or type(line) is not int or not 1 <= line <= len(lines):
        return False
    if not isinstance(needle, str) or not needle or needle not in lines[line - 1]:
        return False
    return not hashes or citation.get("sha256") == sha256(blob)


def verify_tree_citations(manifest: dict[str, Any]) -> tuple[TreeReader, dict[str, int]]:
    """Gating replay against corpus_tree; current-tree resolution and base ancestry are advisory."""
    commit = object_id(manifest.get("corpus_commit"), "corpus_commit")
    tree = object_id(manifest.get("corpus_tree"), "corpus_tree")
    base = object_id(manifest.get("corpus_base"), "corpus_base")
    kind = git_run("cat-file", "-t", tree, check=False)
    if kind.returncode or kind.stdout.strip() != b"tree":
        if kind.returncode:
            require_git_flags()
        fail(f"corpus_tree object is absent; run git fetch origin {commit}")
    advisories = {"current_tree_citation_failures": 0, "corpus_commit_absent": 0,
                  "corpus_base_not_ancestor": 0, "corpus_base_unverified": 0}
    root = git_run("rev-parse", "--verify", "--quiet", commit + "^{tree}", check=False)
    if root.returncode:
        advisories["corpus_commit_absent"] = 1
    elif root.stdout.decode("utf-8").strip() != tree:
        fail("corpus_commit root tree differs from corpus_tree")
    reader = TreeReader(tree)
    citations = repository_citations(manifest, [])
    if not citations:
        fail("no repository citations found")
    for citation in citations:
        file = citation["file"]
        if not isinstance(file, str):
            fail("source citation file is not a string")
        safe_relative_path(file)
        if reader.blob(file) is None:
            fail("source citation file missing from corpus_tree: " + file)
        if not citation_holds(citation, reader.lines(file), reader.blob(file), True):
            fail("source citation differs from corpus_tree: " + file)
        target = REPO_ROOT / file
        current = target.read_bytes() if target.is_file() else None
        try:
            current_lines = None if current is None else current.decode("utf-8").splitlines()
        except UnicodeDecodeError:
            current_lines = None
        if not citation_holds(citation, current_lines, current, False):
            advisories["current_tree_citation_failures"] += 1
    lineage = manifest.get("generator_lineage")
    expected = [{"generator": LINEAGE_GENERATOR, "relation": "patterns copied, nothing imported (Stage B Ruling 18)"}]
    if (not isinstance(lineage, list) or len(lineage) != 1 or not isinstance(lineage[0], dict)
            or {k: v for k, v in lineage[0].items() if k != "sha256"} != expected[0]):
        fail("generator lineage differs")
    blob = reader.blob(CORPUS_REL + LINEAGE_GENERATOR)
    if blob is None or lineage[0]["sha256"] != sha256(blob):
        fail("generator lineage digest differs from corpus_tree")
    ancestor = git_run("merge-base", "--is-ancestor", base, CORPUS_REF, check=False)
    if ancestor.returncode == 1:
        advisories["corpus_base_not_ancestor"] = 1
    elif ancestor.returncode:
        advisories["corpus_base_unverified"] = 1
    return reader, advisories


# --- Discovery and owning-clone resolution (P1 Rulings 2 and 5; time-to-certainty ruling 71) -------------


def read_git_text(path: Path) -> str:
    try:
        return path.read_text("utf-8")
    except (OSError, UnicodeDecodeError):
        fail("git metadata is unreadable")


def gitfile_target(dot_git: Path) -> str:
    """The ``gitdir:`` target of a linked worktree's ``.git`` file; a file without one fails closed."""
    text = read_git_text(dot_git).strip()
    if not text.startswith("gitdir:") or not text[len("gitdir:"):].strip():
        fail("a checkout .git file has no gitdir line")
    return text[len("gitdir:"):].strip()


def lexical(base: Path | str, target: str) -> Path:
    """Node ``path.resolve``: join (an absolute target wins) and normalize, never following links."""
    return Path(os.path.normpath(os.path.join(str(base), target)))


def git_common_dir(checkout: Path) -> Path:
    dot_git = checkout / ".git"
    if dot_git.is_dir():
        return dot_git
    gitdir = lexical(checkout, gitfile_target(dot_git))
    commondir = gitdir / "commondir"
    return lexical(gitdir, read_git_text(commondir).strip()) if os.path.exists(commondir) else gitdir


def owning_clone(checkout: Path) -> Path:
    """Mirror of ``owningCloneRoot``: lexical abspath/normpath, never realpath, never git."""
    origin = Path(os.path.abspath(checkout))
    dot_git = origin / ".git"
    if not os.path.exists(dot_git) or not dot_git.is_file():
        return origin
    gitdir = lexical(origin, gitfile_target(dot_git))
    commondir = gitdir / "commondir"
    common = lexical(gitdir, read_git_text(commondir).strip()) if os.path.exists(commondir) else gitdir
    return common.parent if common.name == ".git" else common


def origin_url(config: str) -> str | None:
    """The first ``url`` of the ``[remote "origin"]`` section, read as INI text."""
    in_origin = False
    for line in config.splitlines():
        stripped = line.strip()
        if stripped.startswith("["):
            in_origin = re.fullmatch(r'\[remote\s+"origin"\]', stripped) is not None
            continue
        key, separator, value = stripped.partition("=")
        if in_origin and separator and key.strip() == "url":
            return value.strip()
    return None


def canonical_origin(url: str) -> str | None:
    """``host/owner/repo`` for an scp-form or URL remote; lowercase host, no ``.git`` or slashes."""
    scp = re.fullmatch(r"[^@/\s]+@([^:/\s]+):(.+)", url)
    if scp:
        host, path = scp[1], scp[2]
    else:
        try:
            parts = urlsplit(url)
            host, path = parts.hostname, parts.path
        except ValueError:
            return None
        if not parts.scheme or not host:
            return None
    path = path.strip("/")
    if path.endswith(".git"):
        path = path[:-len(".git")].rstrip("/")
    return f"{host.lower()}/{path}" if path else None


def origin_verdict(checkout: Path) -> str:
    """``public`` or the exclusion reason; a .git file without a gitdir line fails closed."""
    try:
        common = git_common_dir(checkout)
        config = common / "config"
        if not os.path.lexists(config):
            return "missing_origin"
        text = config.read_text("utf-8")
    except (OSError, UnicodeDecodeError):
        return "unreadable_git_metadata"
    except SystemExit as exc:
        if str(exc) == "git metadata is unreadable":
            return "unreadable_git_metadata"
        raise
    url = origin_url(text)
    if url is None:
        return "missing_origin"
    return "public" if canonical_origin(url) == PUBLIC_ORIGIN else "non_public_origin"


EXCLUDED_REASONS = ("non_public_origin", "missing_origin", "unreadable_git_metadata", "symlinked_candidate",
                    "unreadable_candidate_directory")


def listed(directory: Path, excluded: dict[str, int]) -> list[Path]:
    """Sorted children; an unreadable directory is counted and skipped, never echoed (no path in any message)."""
    try:
        return sorted(directory.iterdir())
    except OSError:
        excluded["unreadable_candidate_directory"] += 1
        return []


def discover_checkouts() -> tuple[list[tuple[str, Path, str, str]], dict[str, int], list[Path]]:
    """Fleet checkouts as the run4-fleet capture discovers them; excluded ones get no label.

    The third member lists excluded candidate paths for the capture's in-memory label guard and deny list;
    it is never persisted.
    """
    excluded = dict.fromkeys(EXCLUDED_REASONS, 0)
    candidates = []
    # os.path probes return False on OSError, so an unreadable entry never raises a path-bearing traceback.
    for path in sorted(FLEET_ROOT.glob("beep-effect*")):
        if os.path.isdir(path) and os.path.exists(path / ".git"):
            candidates.append((path.name, path, "fleet-root"))
    for parent in sorted(FLEET_ROOT.glob("*-worktrees")):
        if os.path.isdir(parent):
            for path in listed(parent, excluded):
                if os.path.isdir(path) and os.path.exists(path / ".git"):
                    candidates.append((parent.name + "/" + path.name, path, "worktrees-dir"))
    # P1 Ruling 5(2): Claude-app worktrees of every clone, nested clones under a *-worktrees directory included.
    for label, path, _layout in list(candidates):
        claude = path / ".claude" / "worktrees"
        if (os.path.isdir(path / ".git") and not os.path.islink(path) and os.path.isdir(claude)
                and not os.path.islink(claude)):
            for child in listed(claude, excluded):
                if os.path.isdir(child) and os.path.exists(child / ".git"):
                    candidates.append((label + "/.claude/worktrees/" + child.name, child, "claude-worktrees"))
    admitted, excluded_paths = [], []
    for label, path, layout in candidates:
        if os.path.islink(path):
            excluded["symlinked_candidate"] += 1
            excluded_paths.append(path)
            continue
        verdict = origin_verdict(path)
        if verdict != "public":
            excluded[verdict] += 1
            excluded_paths.append(path)
            continue
        safe_relative_path(label)
        admitted.append((label, path, "linked-worktree" if os.path.isfile(path / ".git") else "clone", layout))
    return sorted(admitted), excluded, excluded_paths


def names_excluded(label: str, excluded_labels: set[str]) -> bool:
    """An origin label that is, or nests under, an excluded checkout, or sits in an excluded clone's lane dir."""
    first = label.split("/")[0]
    return (any(label == name or label.startswith(name + "/") for name in excluded_labels)
            or (first.endswith("-worktrees") and first[:-len("-worktrees")] in excluded_labels))


def fleet_label(path: Path, subject: str) -> str:
    """Fleet-relative label with every component validated; outside the fleet root fails closed."""
    try:
        relative = PurePosixPath(path.as_posix()).relative_to(PurePosixPath(FLEET_ROOT.as_posix()))
    except ValueError:
        fail(f"{subject} outside the fleet root")
    label = relative.as_posix()
    safe_relative_path(label)
    for part in relative.parts:
        validate_component(part, subject)
    return label


def owner_kind(owner: Path) -> str:
    """Admit a clone (``.git`` directory) or a bare or separated common dir; nothing else."""
    if (owner / ".git").is_file():
        fail("owning clone resolves to a linked worktree")
    if (owner / ".git").is_dir():
        return "clone"
    if owner.name != ".git" and (owner / "HEAD").is_file() and (owner / "objects").is_dir():
        return "bare-or-separated"
    fail("owning clone is neither a clone nor a bare or separated common dir")


def ledger_path(owner: Path) -> Path:
    path = owner.joinpath(*LEDGER_PARTS)
    if path.parent.parent.parent != owner:
        fail("ledger path escapes its owning clone")
    return path


def read_ledger(owner: Path) -> bytes | None:
    """Read exactly one path once, without following links; ``None`` when absent."""
    path = ledger_path(owner)
    if not os.path.lexists(path):
        return None
    if os.path.realpath(path) != str(path):
        fail("proof ledger path has a symlinked component")
    try:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0))
    except FileNotFoundError:
        return None
    except OSError:
        fail("proof ledger is unreadable or a symlink")
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            fail("proof ledger is not a regular file")
        with os.fdopen(descriptor, "rb", closefd=False) as handle:
            return handle.read()
    finally:
        os.close(descriptor)


# --- Ledger row model (deployed ProofFact.ts schemas; exact key sets, stricter than the TS reader) -------


PROOF_FACT_SCHEMA = "proof-fact/v1"
PROOF_OUTCOMES = ("passed", "failed")
PROOF_STAGES = ("repair-loop", "pre-push", "merged-preview", "hosted")
PROOF_TIERS = ("full", "cheap-gates", "review-fix")
ENV_PROFILES = ("local", "pr-posture", "hosted")
LANE_CLASSES = ("cli-runnable", "workflow-gated", "ci-native")
INPUT_SOURCES = ("turbo-task-hash", "declared-inputs", "undeclared")
MISS_REASONS = ("no-fact", "prior-failed", "epoch-changed", "profile-mismatch",
                "changed-package-tripwire", "undeclared-inputs", "expired")
DECISION_KINDS = ("hit", "miss")
ROW_KINDS = ("fact", "shadow")
FACT_ROW_KEYS = ("kind", "schemaVersion", "fact")
FACT_KEYS = ("schemaVersion", "key", "epoch", "outcome", "durationMs", "provenance", "recordedAt", "expiresAt")
INPUT_KEYS = ("laneId", "laneClass", "commandDigest", "envProfile", "inputDigest", "inputSource", "epochDigest", "key")
EPOCH_KEYS = ("lockfileDigest", "bunVersion", "nodeVersion", "rootTurboConfigDigest", "rootTsconfigDigest",
              "policyPackVersion", "digest")
PROVENANCE_KEYS = ("runId", "attemptId", "originKey", "tier", "stage", "headSha", "hostedRunId")
SHADOW_KEYS = ("kind", "schemaVersion", "attemptId", "laneId", "branch", "stage", "envProfile", "decision",
               "observed", "durationMs", "recordedAt")
HIT_KEYS = ("kind", "key", "factRecordedAt")
MISS_KEYS = ("kind", "key", "reason")
PROJECTED_PATHS = {("fact", "key", "key"), ("fact", "provenance", "originKey"), ("decision", "key")}
ORIGIN_KINDS = ("clone-root", "fleet-root-checkout", "lane", "claude-worktree", "merged-preview")
CUT = dt.datetime(2026, 9, 28, 15, 9, 38, tzinfo=dt.timezone.utc)


def drift(where: str, member: str, what: str) -> NoReturn:
    fail(f"{where}: {member} {what} (schema drift; capture fails closed)")


def require_keys(value: Any, keys: tuple[str, ...], where: str, member: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != set(keys):
        drift(where, member, "member set differs from the deployed schema")
    return value


def require_text(value: Any, where: str, member: str) -> str:
    if not isinstance(value, str) or not value:
        drift(where, member, "is not a non-empty string")
    return value


def require_literal(value: Any, vocabulary: tuple[str, ...], where: str, member: str) -> str:
    if not isinstance(value, str) or value not in vocabulary:
        drift(where, member, "is not a deployed literal")
    return value


def require_instant(value: Any, where: str, member: str) -> dt.datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        drift(where, member, "is not a UTC ISO-8601 instant")
    try:
        parsed = dt.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        drift(where, member, "is not a UTC ISO-8601 instant")
    return parsed.astimezone(dt.timezone.utc)


def require_duration(value: Any, where: str, member: str) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != value or value in (
            float("inf"), float("-inf")) or value < 0:
        drift(where, member, "is not a finite non-negative number")


def require_reuse_key(value: Any, projected: bool, where: str, member: str) -> str:
    pattern = f"[0-9a-f]{{{REUSE_KEY_HEX}}}" if projected else r"[0-9a-f]{64}"
    if not isinstance(value, str) or not re.fullmatch(pattern, value):
        drift(where, member, "is not a lowercase hex reuse key of the expected width")
    return value


def require_origin(value: Any, projected: bool, where: str) -> str:
    member = "fact.provenance.originKey"
    text = require_text(value, where, member)
    if projected:
        if not text.startswith("<fleet>/"):
            drift(where, member, "is not a fleet descriptor")
        label = text[len("<fleet>/"):]
        safe_relative_path(label)
        for part in PurePosixPath(label).parts:
            validate_component(part, "origin label")
    elif not text.startswith("/") or os.path.normpath(text) != text:
        drift(where, member, "is not a normalized absolute checkout path")
    return text


def validate_ledger_row(row: Any, where: str, projected: bool = False) -> dict[str, Any]:
    """Exact key sets, deployed literals and types at every level; any drift fails closed."""
    if not isinstance(row, dict):
        drift(where, "row", "is not an object")
    kind = require_literal(row.get("kind"), ROW_KINDS, where, "kind")
    if row.get("schemaVersion") != PROOF_FACT_SCHEMA:
        drift(where, "schemaVersion", "is not the deployed proof-fact version")
    if kind == "fact":
        require_keys(row, FACT_ROW_KEYS, where, "fact row")
        fact_value = require_keys(row["fact"], FACT_KEYS, where, "fact")
        if fact_value["schemaVersion"] != PROOF_FACT_SCHEMA:
            drift(where, "fact.schemaVersion", "is not the deployed proof-fact version")
        key = require_keys(fact_value["key"], INPUT_KEYS, where, "fact.key")
        for member in ("laneId", "commandDigest", "inputDigest", "epochDigest"):
            require_text(key[member], where, "fact.key." + member)
        require_literal(key["laneClass"], LANE_CLASSES, where, "fact.key.laneClass")
        require_literal(key["envProfile"], ENV_PROFILES, where, "fact.key.envProfile")
        require_literal(key["inputSource"], INPUT_SOURCES, where, "fact.key.inputSource")
        require_reuse_key(key["key"], projected, where, "fact.key.key")
        epoch = require_keys(fact_value["epoch"], EPOCH_KEYS, where, "fact.epoch")
        for member in EPOCH_KEYS:
            require_text(epoch[member], where, "fact.epoch." + member)
        require_literal(fact_value["outcome"], PROOF_OUTCOMES, where, "fact.outcome")
        require_duration(fact_value["durationMs"], where, "fact.durationMs")
        provenance = require_keys(fact_value["provenance"], PROVENANCE_KEYS, where, "fact.provenance")
        for member in ("runId", "attemptId", "headSha"):
            require_text(provenance[member], where, "fact.provenance." + member)
        require_origin(provenance["originKey"], projected, where)
        require_literal(provenance["tier"], PROOF_TIERS, where, "fact.provenance.tier")
        require_literal(provenance["stage"], PROOF_STAGES, where, "fact.provenance.stage")
        if provenance["hostedRunId"] is not None:
            require_text(provenance["hostedRunId"], where, "fact.provenance.hostedRunId")
        require_instant(fact_value["recordedAt"], where, "fact.recordedAt")
        require_instant(fact_value["expiresAt"], where, "fact.expiresAt")
        return row
    require_keys(row, SHADOW_KEYS, where, "shadow row")
    for member in ("attemptId", "laneId", "branch"):
        require_text(row[member], where, member)
    require_literal(row["stage"], PROOF_STAGES, where, "stage")
    require_literal(row["envProfile"], ENV_PROFILES, where, "envProfile")
    decision = row["decision"]
    decision_kind = require_literal(decision.get("kind") if isinstance(decision, dict) else None,
                                    DECISION_KINDS, where, "decision.kind")
    require_keys(decision, HIT_KEYS if decision_kind == "hit" else MISS_KEYS, where, "decision")
    require_reuse_key(decision["key"], projected, where, "decision.key")
    if decision_kind == "hit":
        require_instant(decision["factRecordedAt"], where, "decision.factRecordedAt")
    else:
        require_literal(decision["reason"], MISS_REASONS, where, "decision.reason")
    require_literal(row["observed"], PROOF_OUTCOMES, where, "observed")
    require_duration(row["durationMs"], where, "durationMs")
    require_instant(row["recordedAt"], where, "recordedAt")
    return row


class LineDrift(Exception):
    """A line that is JSON but not strict JSON (duplicate members, NaN or Infinity): drift, never a tear."""


def drift_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise LineDrift
        result[key] = value
    return result


def drift_constant(_value: str) -> NoReturn:
    raise LineDrift


def classify_line(line: bytes) -> Any:
    """A decoded value, or ``None`` for a torn line (invalid UTF-8, which a tear can split, or a JSON syntax
    error). Duplicate members and non-standard constants cannot come from a torn append, so they raise."""
    try:
        text = line.decode("utf-8")
    except UnicodeDecodeError:
        return None
    try:
        return json.loads(text, object_pairs_hook=drift_pairs, parse_constant=drift_constant)
    except json.JSONDecodeError:
        return None


def paired_members_differ(shadow: dict[str, Any], row: dict[str, Any]) -> bool:
    value = row["fact"]
    return not all((shadow["attemptId"] == value["provenance"]["attemptId"],
                    shadow["laneId"] == value["key"]["laneId"],
                    shadow["recordedAt"] == value["recordedAt"],
                    shadow["decision"]["key"] == value["key"]["key"],
                    shadow["stage"] == value["provenance"]["stage"],
                    shadow["envProfile"] == value["key"]["envProfile"],
                    shadow["durationMs"] == value["durationMs"],
                    shadow["observed"] == value["outcome"]))


def line_ranges(ordinals: list[int]) -> list[list[int]]:
    """Inclusive one-based ``[first, last]`` runs of consecutive source line ordinals."""
    ranges: list[list[int]] = []
    for ordinal in ordinals:
        if ranges and ranges[-1][1] + 1 == ordinal:
            ranges[-1][1] = ordinal
        else:
            ranges.append([ordinal, ordinal])
    return ranges


def expand_ranges(ranges: list[list[int]]) -> list[int]:
    return [ordinal for first, last in ranges for ordinal in range(first, last + 1)]


def pair_decoded(ordinals: list[int], rows: list[dict[str, Any]], torn: set[int], terminated: int, tail: bool,
                 label: str) -> list[bool]:
    """Pairing over the DECODED rows (brief W4-A6, P1 Ruling 2 addendum); ``True`` marks a paired row.

    A shadow pairs with the next decoded row when that row is its fact (eight equalities), so torn and empty
    lines between the two are skipped. An orphan is a shadow whose next decoded row is not its fact, or a fact
    whose previous decoded row is not its shadow. An orphan whose neighbouring non-empty raw line toward its
    missing partner (after a shadow, before a fact) is torn, or is the unterminated tail after a shadow, is
    kept unpaired; any other orphan is writer drift and fails closed. Capture and verify share this function:
    verify rebuilds the raw layout from ``source_line_ranges``, ``torn_line_ranges`` and the line counts.
    """
    occupied = set(ordinals) | torn

    def tear_toward(ordinal: int, step: int) -> bool:
        neighbour = ordinal + step
        while 1 <= neighbour <= terminated and neighbour not in occupied:
            neighbour += step
        return neighbour in torn or (step > 0 and tail and neighbour == terminated + 1)

    paired, index = [False] * len(rows), 0
    while index < len(rows):
        row, number = rows[index], ordinals[index]
        after = rows[index + 1] if index + 1 < len(rows) else None
        partner = row["kind"] == "shadow" and after is not None and after["kind"] == "fact"
        if partner and not paired_members_differ(row, after):
            paired[index] = paired[index + 1] = True
            index += 2
            continue
        if tear_toward(number, 1 if row["kind"] == "shadow" else -1):
            index += 1
            continue
        if partner:
            fail(f"proof ledger {label} line {number}: pairing violation (paired members differ)")
        fail(f"proof ledger {label} line {number}: pairing violation (unpaired row not adjacent to a torn line)")
    return paired


def ledger_pairing(rows: list[dict[str, Any]], layout: dict[str, Any], label: str) -> list[bool]:
    """``pair_decoded`` over a ledger receipt's recorded layout (capture receipt or pinned manifest entry)."""
    return pair_decoded(expand_ranges(layout["source_line_ranges"]), rows, set(expand_ranges(layout["torn_line_ranges"])),
                        len(rows) + layout["torn_rows"] + layout["empty_lines"], layout["unterminated_tail_bytes"] > 0,
                        label)


def decode_ledger(data: bytes, label: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Every terminated decodable row, in source order; decodable drift fails closed (P1 note e).

    A torn line (and a non-empty unterminated tail) is tallied, located and excluded. Every decoded row is
    kept, orphans included (P1 Ruling 6, "every terminated row"); ``pair_decoded`` counts an orphan beside a
    tear as ``unpaired_adjacent_to_tear`` and fails closed on any other orphan. ``source_line_ranges`` maps
    pinned records to source line ordinals and ``torn_line_ranges`` locates the tears, so verify recomputes
    the pairing from pinned bytes.
    """
    segments = data.split(b"\n")
    tail = segments.pop()
    empty, torn, ordinals, rows = 0, [], [], []
    for number, line in enumerate(segments, 1):
        where = f"proof ledger {label} line {number}"
        if not line:
            empty += 1
            continue
        try:
            record = classify_line(line)
        except LineDrift:
            drift(where, "row", "carries duplicate members or a non-standard JSON constant")
        if record is None:
            torn.append(number)
            continue
        ordinals.append(number)
        rows.append(validate_ledger_row(record, where))
    paired = pair_decoded(ordinals, rows, set(torn), len(segments), bool(tail), label)
    return rows, {"empty_lines": empty, "torn_rows": len(torn), "torn_line_ranges": line_ranges(torn),
                  "unterminated_tail_bytes": len(tail), "unpaired_adjacent_to_tear": paired.count(False),
                  "source_line_ranges": line_ranges(ordinals)}


# --- Projection (P1 Rulings 3 and 6, P1 note d) ------------------------------------------------------------


def origin_label(origin_key: str, owner: Path, owner_label: str, nested: bool = False) -> tuple[str, str]:
    """``(label, kind)`` for a raw originKey; no filesystem reads; unknown layouts fail closed."""
    path = PurePosixPath(origin_key)
    if not path.is_absolute() or path.as_posix() != origin_key or os.path.normpath(origin_key) != origin_key:
        fail("originKey is not a normalized absolute path")
    try:
        parts = path.relative_to(PurePosixPath(FLEET_ROOT.as_posix())).parts
    except ValueError:
        fail("originKey outside the fleet root")
    for part in parts:
        validate_component(part, "origin")
    if path == PurePosixPath(owner.as_posix()):
        return owner_label, "clone-root"
    if (not nested and len(parts) >= 4 and parts[-3:-1] == (".beep", "yeet")
            and re.fullmatch(r"merged-preview-\d+", parts[-1])):
        base = PurePosixPath(FLEET_ROOT.as_posix()).joinpath(*parts[:-3]).as_posix()
        base_label, _ = origin_label(base, owner, owner_label, True)
        return base_label + "/.beep/yeet/merged-preview-<process>", "merged-preview"
    if len(parts) == 1 and parts[0].startswith("beep-effect"):
        kind = "fleet-root-checkout"
    elif len(parts) == 2 and parts[0].endswith("-worktrees"):
        kind = "lane"
    elif claude_worktree_parts(parts):
        kind = "claude-worktree"
    else:
        fail("originKey outside the known fleet layouts")
    label = "/".join(parts)
    safe_relative_path(label)
    return label, kind


def projected_origin_kind(token: str, owner_label: str) -> str:
    """Re-derive the origin kind from a pinned ``<fleet>/<label>`` token (verify path)."""
    label = token[len("<fleet>/"):]
    parts = PurePosixPath(label).parts
    if label.endswith("/.beep/yeet/merged-preview-<process>"):
        return "merged-preview"
    if label == owner_label:
        return "clone-root"
    if len(parts) == 1 and parts[0].startswith("beep-effect"):
        return "fleet-root-checkout"
    if len(parts) == 2 and parts[0].endswith("-worktrees"):
        return "lane"
    if claude_worktree_parts(parts):
        return "claude-worktree"
    fail("pinned origin token outside the known fleet layouts")


def claude_worktree_parts(parts: tuple[str, ...]) -> bool:
    """``<clone>/.claude/worktrees/<name>`` or ``<x>-worktrees/<nested-clone>/.claude/worktrees/<name>``."""
    return ((len(parts) == 4 and parts[1:3] == (".claude", "worktrees"))
            or (len(parts) == 5 and parts[0].endswith("-worktrees") and parts[2:4] == (".claude", "worktrees")))


def leaf_paths(left: Any, right: Any, prefix: tuple[str, ...] = ()) -> set[tuple[str, ...]]:
    """Paths whose JSON values differ (type-exact)."""
    if isinstance(left, dict) and isinstance(right, dict) and list(left) == list(right):
        changed: set[tuple[str, ...]] = set()
        for key in left:
            changed |= leaf_paths(left[key], right[key], prefix + (key,))
        return changed
    return set() if same_json(left, right) else {prefix}


def project_row(row: dict[str, Any], origin: str | None) -> dict[str, Any]:
    result = copy.deepcopy(row)
    if row["kind"] == "fact":
        result["fact"]["key"]["key"] = row["fact"]["key"]["key"][:REUSE_KEY_HEX]
        result["fact"]["provenance"]["originKey"] = "<fleet>/" + origin
    else:
        result["decision"]["key"] = row["decision"]["key"][:REUSE_KEY_HEX]
    return result


def run_id_for_branch(branch: str) -> str:
    """``repoRunArtifactId``: sanitized branch plus sha12 of the UTF-8 branch."""
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", branch).strip("_") or "repo"
    return f"{safe}-{sha256(branch.encode())[:12]}"


def side(instant_text: str) -> str:
    parsed = dt.datetime.fromisoformat(instant_text[:-1] + "+00:00")
    return "post" if parsed >= CUT else "pre"


def sorted_rows(counter: collections.Counter, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{**dict(zip(keys, key, strict=True)), "rows": count}
            for key, count in sorted(counter.items(), key=lambda item: tuple("" if v is None else str(v) for v in item[0]))]


def derive_census(ledgers: list[tuple[str, list[dict[str, Any]], dict[str, Any]]]) -> dict[str, Any]:
    """Every census field recomputable from pinned rows and each ledger's recorded layout (capture and verify
    share it). Orphans kept beside a tear count toward ``rows``, ``facts`` (projection totals) and the
    merged-preview reading, and are excluded from pairs, hit resolution and every paired census member
    (brief W4-A6). The reading tests FACTS only (P1 Ruling 8, P1 call t): it is dormant when no merged-preview
    fact, orphan or paired, lies after the cut, so a lone post-cut merged-preview shadow whose fact tore stays
    under the tear receipts; otherwise it names the post-cut merged-preview fact count."""
    facts_by, shadows_by, origins = collections.Counter(), collections.Counter(), collections.Counter()
    stage = {name: {"facts": {"pre": 0, "post": 0}, "shadows": {"pre": 0, "post": 0}} for name in PROOF_STAGES}
    vocabularies = {
        "fact.key.laneClass": dict.fromkeys(LANE_CLASSES, 0), "fact.key.envProfile": dict.fromkeys(ENV_PROFILES, 0),
        "fact.key.inputSource": dict.fromkeys(INPUT_SOURCES, 0), "fact.outcome": dict.fromkeys(PROOF_OUTCOMES, 0),
        "fact.provenance.tier": dict.fromkeys(PROOF_TIERS, 0), "fact.provenance.stage": dict.fromkeys(PROOF_STAGES, 0),
        "shadow.stage": dict.fromkeys(PROOF_STAGES, 0), "shadow.envProfile": dict.fromkeys(ENV_PROFILES, 0),
        "shadow.observed": dict.fromkeys(PROOF_OUTCOMES, 0), "shadow.decision.kind": dict.fromkeys(DECISION_KINDS, 0),
        "shadow.decision.reason": dict.fromkeys(MISS_REASONS, 0)}
    attempts = {"all": set(), "pre": set(), "post": set()}
    run_ids, branches, lanes, heads, epochs, labels = set(), set(), set(), set(), set(), set()
    hits = {"total": 0, "resolved_prior": 0, "unresolved": 0, "prior_passed": 0, "cross_origin": 0,
            "same_attempt": 0, "disagreements": 0,
            "reading": "hypothetical would-reuse, never realized (graduation Ruling 1)",
            "flagged_legs": FLAGGED_LEGS,
            "resolution_rule": "newest earlier fact in the same ledger with equal projected key and recordedAt equal to factRecordedAt"}
    derivation = {"matches": 0, "differs": 0,
                  "rule": "runId equals the sanitized paired shadow branch plus sha12 of the branch (repoRunArtifactId)"}
    instants, post_instants, pairs, post_cut_pre_push = [], [], 0, 0
    unpaired: dict[str, int] = {}
    facts_all, merged_preview_post_facts = 0, 0
    for label, rows, layout in ledgers:
        mask = ledger_pairing(rows, layout, label)
        pairs += mask.count(True) // 2
        unpaired[label] = mask.count(False)
        prior: dict[tuple[str, str], list[dict[str, Any]]] = collections.defaultdict(list)
        for index, row in enumerate(rows):
            recorded = row["fact"]["recordedAt"] if row["kind"] == "fact" else row["recordedAt"]
            where = side(recorded)
            row_stage = row["fact"]["provenance"]["stage"] if row["kind"] == "fact" else row["stage"]
            facts_all += int(row["kind"] == "fact")
            merged_preview_post_facts += int(where == "post" and row_stage == "merged-preview" and row["kind"] == "fact")
            if not mask[index]:
                continue
            instants.append(recorded)
            if where == "post":
                post_instants.append(recorded)
            if row["kind"] == "fact":
                value = row["fact"]
                provenance, key = value["provenance"], value["key"]
                facts_by[(label, provenance["stage"], provenance["tier"], value["outcome"], where)] += 1
                stage[provenance["stage"]]["facts"][where] += 1
                post_cut_pre_push += int(where == "post" and provenance["stage"] == "pre-push")
                for name, member in (("fact.key.laneClass", key["laneClass"]), ("fact.key.envProfile", key["envProfile"]),
                                     ("fact.key.inputSource", key["inputSource"]), ("fact.outcome", value["outcome"]),
                                     ("fact.provenance.tier", provenance["tier"]), ("fact.provenance.stage", provenance["stage"])):
                    vocabularies[name][member] += 1
                attempts["all"].add(provenance["attemptId"])
                attempts[where].add(provenance["attemptId"])
                run_ids.add(provenance["runId"])
                lanes.add(key["laneId"])
                heads.add(provenance["headSha"])
                epochs.add(value["epoch"]["digest"])
                labels.add(provenance["originKey"])
                origins[(projected_origin_kind(provenance["originKey"], label), where)] += 1
                shadow = rows[index - 1]
                matched = provenance["runId"] == run_id_for_branch(shadow["branch"])
                derivation["matches" if matched else "differs"] += 1
                prior[(key["key"], value["recordedAt"])].append(row)
                continue
            decision = row["decision"]
            reason = decision.get("reason")
            shadows_by[(label, row["stage"], row["observed"], decision["kind"], reason, where)] += 1
            stage[row["stage"]]["shadows"][where] += 1
            for name, member in (("shadow.stage", row["stage"]), ("shadow.envProfile", row["envProfile"]),
                                 ("shadow.observed", row["observed"]), ("shadow.decision.kind", decision["kind"])):
                vocabularies[name][member] += 1
            if reason is not None:
                vocabularies["shadow.decision.reason"][reason] += 1
            branches.add(row["branch"])
            if decision["kind"] == "hit":
                hits["total"] += 1
                hits["disagreements"] += int(row["observed"] == "failed")
                candidates = prior.get((decision["key"], decision["factRecordedAt"]), [])
                if not candidates:
                    hits["unresolved"] += 1
                    continue
                found = candidates[-1]["fact"]
                paired = rows[index + 1]["fact"]
                hits["resolved_prior"] += 1
                hits["prior_passed"] += int(found["outcome"] == "passed")
                hits["cross_origin"] += int(found["provenance"]["originKey"] != paired["provenance"]["originKey"])
                hits["same_attempt"] += int(found["provenance"]["attemptId"] == row["attemptId"])
    stage["merged-preview"]["reading"] = (MERGED_PREVIEW_READING if merged_preview_post_facts == 0
                                          else MERGED_PREVIEW_OBSERVED.format(facts=merged_preview_post_facts))
    parsed = sorted(instants, key=lambda text: dt.datetime.fromisoformat(text[:-1] + "+00:00"))
    post = sorted(post_instants, key=lambda text: dt.datetime.fromisoformat(text[:-1] + "+00:00"))
    return {
        "facts_by": sorted_rows(facts_by, ("checkout", "stage", "tier", "outcome", "side")),
        "shadows_by": sorted_rows(shadows_by, ("checkout", "stage", "observed", "decision_kind", "reason", "side")),
        "stage_census": stage,
        "vocabularies": vocabularies,
        "distinct": {"attempts": {key: len(value) for key, value in attempts.items()}, "run_ids": len(run_ids),
                     "branches": len(branches), "lanes": len(lanes),
                     "lanes_bare": sum(":" not in lane for lane in lanes),
                     "lanes_qualified": sum(":" in lane for lane in lanes), "head_shas": len(heads),
                     "epochs": len(epochs), "origin_labels": len(labels)},
        "origin": [{"kind": kind, "side": where, "facts": count}
                   for (kind, where), count in sorted(origins.items(), key=lambda item: (ORIGIN_KINDS.index(item[0][0]), item[0][1]))],
        "pairing": {"pairs": pairs, "unpaired_adjacent_to_tear": sum(unpaired.values()), "violations": 0,
                    "rule": PAIRING_RULE},
        "hits": hits,
        "run_id_branch_derivation": derivation,
        "time_range": {"first": format_timestamp(dt.datetime.fromisoformat(parsed[0][:-1] + "+00:00")) if parsed else None,
                       "last": format_timestamp(dt.datetime.fromisoformat(parsed[-1][:-1] + "+00:00")) if parsed else None,
                       "first_post_cut": format_timestamp(dt.datetime.fromisoformat(post[0][:-1] + "+00:00")) if post else None},
        "post_cut_pre_push_facts": post_cut_pre_push,
        "facts": facts_all,
        "rows": sum(len(rows) for _, rows, _ in ledgers),
        "unpaired_by_ledger": unpaired,
    }


# --- Capture ----------------------------------------------------------------------------------------------


OUTPUT_ROOTS = {"ledger": CORPUS_ROOT / "run4-ledger"}
OBSERVATION_BASIS = ("one read of each owning-clone ledger; append-only, untrimmed; writer failures are swallowed "
                     "(Handler.ts proof shadow skipped), so completeness is within-ledger and open-world against attempts; "
                     "reused and early-stopped lanes are never recorded (time-to-certainty ruling 63)")
MERGED_PREVIEW_READING = "dormant in capture window (P1 Ruling 1)"
MERGED_PREVIEW_OBSERVED = "observed after the cut: {facts} merged-preview fact(s) (P1 Ruling 8)"
FLAGGED_LEGS = ("realization, copy and correction legs wait for time-to-certainty C4.2 (graduation Ruling 1); "
                "merged-preview legs stay flagged until a post-#1321 merged-preview fact exists (P1 Ruling 1) "
                "and may discharge against post-cut merged-preview rows pinned here (P1 Ruling 8)")
CITATION_REPLAY = "tree-pinned against corpus_tree (graduation Ruling 8, P1 Ruling 4); current-tree resolution advisory"
CAPTURE_INSTANT_BASIS = ("capture start; each owning-clone ledger read once over the recorded interval, "
                         "not an atomic fleet snapshot")
GATE_RULE = ("time-to-certainty C4.1 checked plus at least one pre-push ProofFact recorded at or after the cut in an "
             "owning-clone ledger")
GATE_RULINGS = ["graduation Ruling 1", "P1 Ruling 1", "P1 Ruling 2"]
CUT_SOURCE = "committer instant of 9d52d8f587 (#1321)"
CUT_PREDICATE = "recordedAt >= cut"
CUT_CHECKS = ("advisory: commit absent at capture", "committer instant verified at capture")
ORIGIN_FILTER = ("only checkouts whose common-dir config names origin github.com/beep-effect/beep-effect; excluded "
                 "checkouts carry no label, and an originKey naming one fails the capture (P1 note h)")
LANE_LEDGER_BASIS = "existence probe only; contents never read (P1 Ruling 2)"
OWNER_RULE = "gitdir line then commondir file, lexical paths, no git spawned (time-to-certainty ruling 71)"
ORIGIN_PROBE_BASIS = "capture-time existence and owner probes of the raw path; counts only, never pinned as paths"
ATTEMPTS_JOIN_TARGET = "run4-fleet attempts/<component>/<runId>/attempts.ndjson by attemptId"
DENY_LIST_BASIS = ("a deny-list hit fails the capture before staging, so a pinned corpus records 0 by construction; "
                   "the list holds every raw host path the capture saw and is never persisted")
EXCLUDED_SOURCES = ["lane ledgers under linked worktrees (existence probe only; P1 Ruling 2)",
                    "attempt journals (owned by the run4-fleet capture; P1 note f)",
                    "torn ledger lines and the unterminated tail (tallied and located per ledger, never emitted)",
                    "checkouts whose origin is not the public repository (counted, never labelled)",
                    "lock files and symlinks"]
CHECKOUT_PATH_ENCODING = "UTF-8 percent-encoded single component; checkout labels remain verbatim in receipts"
PAIRING_RULE = ("a shadow row pairs with the next decoded row when it is its fact from the same appendAll, with eight "
                "equalities (attemptId, laneId, recordedAt, reuse key, stage, envProfile, durationMs, observed "
                "outcome); torn and empty lines between them are skipped (brief W4-A6)")
CAPTURE_ONLY_MEMBERS = [
    "capture_head", "corpus_base (ancestry advisory)", "capture_instant", "capture_finished_at", "cut.capture_check",
    "discovery.checkouts", "discovery.by_kind", "discovery.by_layout", "discovery.excluded",
    "discovery.lane_ledgers_present_not_read", "ledgers[].observed_at", "ledgers[].empty_lines", "ledgers[].torn_rows",
    "ledgers[].torn_line_ranges", "ledgers[].unterminated_tail_bytes", "ledgers[].source_line_ranges",
    "census.join_coverage.origin_present_at_capture", "census.join_coverage.origin_gone_at_capture",
    "census.join_coverage.origin_present_without_git_at_capture",
    "census.join_coverage.origin_owner_unresolvable_at_capture", "census.join_coverage.origin_owner_differs_at_capture"]
INTEGRITY = {"algorithm": "sha256", "digest_scope": "all payload files; manifest excluded from its own digest"}
VERIFICATION = {"redaction_compare": "PASS", "projection_compare": "PASS", "residue_scan": "PASS"}
MANIFEST_KEYS = ["schema_version", "generated_by", "generator_sha256", "generator_lineage", "corpus_commit", "corpus_tree",
                 "corpus_base", "corpus_ref", "capture_head", "citation_replay", "capture_instant", "capture_finished_at",
                 "stage", "provenance", "capture_instant_basis", "custody", "gate", "cut", "merged_preview_followup",
                 "discovery", "ledgers", "census", "source_facts", "excluded_sources", "checkout_path_encoding",
                 "capture_only_members", "projection_rules", "redaction_rules", "files", "integrity", "verification",
                 "totals"]
GATE_KEYS = ["c4_1", "c4_1_checked", "post_cut_pre_push_facts", "holds", "rule", "rulings"]
CUT_KEYS = ["instant", "source", "predicate", "capture_check"]
DISCOVERY_KEYS = ["checkouts", "by_kind", "by_layout", "excluded", "origin_filter", "owners_resolved",
                  "owners_bare_or_separated", "owners_with_ledger", "owners_without_ledger",
                  "lane_ledgers_present_not_read", "lane_ledger_basis", "owner_rule"]
LEDGER_KEYS = ["checkout", "owner_kind", "ledger", "path", "source", "world", "status", "complete_within", "observed_at",
               "history_outside_window", "rows", "facts", "shadows", "empty_lines", "torn_rows", "torn_line_ranges",
               "unterminated_tail_bytes", "unpaired_adjacent_to_tear", "source_line_ranges", "first_recorded_at",
               "last_recorded_at", "redaction_counts", "owner_refs_by_variant"]
ABSENT_LEDGER_KEYS = [key for key in LEDGER_KEYS if key not in ("path", "redaction_counts", "owner_refs_by_variant")]
ABSENT_COUNTS = {"rows": 0, "facts": 0, "shadows": 0, "empty_lines": 0, "torn_rows": 0, "torn_line_ranges": [],
                 "unterminated_tail_bytes": 0, "unpaired_adjacent_to_tear": 0, "source_line_ranges": [],
                 "first_recorded_at": None, "last_recorded_at": None}
CENSUS_KEYS = ["facts_by", "shadows_by", "stage_census", "vocabularies", "distinct", "origin", "pairing", "hits",
               "run_id_branch_derivation", "time_range", "join_coverage", "residue", "observation_basis"]
JOIN_COVERAGE_KEYS = ["clone_origin_facts", "fleet_root_checkout_origin_facts", "lane_origin_facts",
                      "claude_worktree_origin_facts", "merged_preview_origin_facts", "origin_present_at_capture",
                      "origin_gone_at_capture", "origin_unprobed", "origin_present_without_git_at_capture",
                      "origin_owner_unresolvable_at_capture", "origin_owner_differs_at_capture", "origin_probe_basis",
                      "attempts_read_by_w4", "attempts_join_target"]
RESIDUE_KEYS = ["owner_refs", "owner_refs_by_variant", "origin_keys_replaced", "keys_projected", "deny_list_hits",
                "deny_list_basis"]
RAW_FILE_KEYS = ["path", "kind", "source", "event_count", "min_timestamp_observed", "max_timestamp_observed", "world",
                 "status", "complete_within", "observed_at", "history_outside_window", "provenance", "checkout", "bytes",
                 "sha256"]
CHECKOUT_KINDS = ("clone", "linked-worktree")
CHECKOUT_LAYOUTS = ("fleet-root", "worktrees-dir", "claude-worktrees")


def custody_block(variants: dict[str, int]) -> dict[str, Any]:
    return {"rule": 'ownerRef = sha12(f"{pid}:{procStart}:{captureSalt}")',
            "member_rule": "identifier tokens: exact pid/ppid, camel Pid boundary, separated pid, start tokens and legacy processId",
            "variant_source": "ownerRefVariant",
            "pair_precedence": ["pid/procstart", "ownerpid/ownerprocstart", "attachedpid/<absent>"],
            "other_identity_rule": "weak variant uses sorted normalized identity-member JSON as the owner component; its first nonempty start member is the start, else <absent>",
            "owner_refs_by_variant": dict(variants),
            "capture_salt_representation": "hexadecimal encoding of 32 random bytes",
            "salt_policy": "per-capture, unrecorded, unlinkable across captures",
            "missing_procStart_rule": "owner:<absent>:salt; missing, null and empty starts tallied as weaker keys",
            "missing_procStart_caveat": "weak references cannot join full references by ownerRef; nonce remains available",
            "nested_payloads": "each object containing a process identity receives its own ownerRef before member removal; precedence is local to that object"}


class GateStop(Exception):
    """The run-4 gate does not hold; carries the counts-only census."""

    def __init__(self, census: dict[str, Any]) -> None:
        super().__init__("run-4 gate does not hold")
        self.census = census


def manifest_schema(population: str) -> str:
    return f"beep-ci-ops-run4-{population}-corpus/v1"


def source_fact_specs() -> list[tuple[str, Any, str, str, int | None]]:
    """``(name, value, file, needle, occurrence)``: one table drives capture and verify, so no value is unbound."""
    proof_fact, shadow, ledger = YEET + "ProofFact.ts", YEET + "ProofShadow.ts", YEET + "ProofLedger.ts"
    schemas, paths = REPO_RUN + "QualityScheduler.schemas.ts", YEET + "ArtifactPaths.ts"
    artifacts = REPO_RUN + "RepoRunArtifacts.ts"
    return [
        ("schema_version", PROOF_FACT_SCHEMA, proof_fact, "export const PROOF_FACT_SCHEMA_VERSION", None),
        ("fact_row", list(FACT_ROW_KEYS), proof_fact, "export class ProofLedgerFactRow extends", None),
        ("fact", list(FACT_KEYS), proof_fact, "export class ProofFact extends", None),
        ("input_digest", list(INPUT_KEYS), proof_fact, "export class ProofInputDigest extends", None),
        ("epoch", list(EPOCH_KEYS), proof_fact, "export class ProofEpoch extends", None),
        ("provenance", list(PROVENANCE_KEYS), proof_fact, "export class ProofProvenance extends", None),
        ("shadow_row", list(SHADOW_KEYS), proof_fact, "export class ProofLedgerShadowRow extends", None),
        ("reuse_hit", list(HIT_KEYS), proof_fact, "export class ProofReuseHit extends", None),
        ("reuse_miss", list(MISS_KEYS), proof_fact, "export class ProofReuseMiss extends", None),
        ("row_union", list(ROW_KINDS), proof_fact, "export const ProofLedgerRow = S.Union(", None),
        ("vocabulary_outcome", list(PROOF_OUTCOMES), proof_fact, "export const ProofOutcome = LiteralKit(", None),
        ("vocabulary_input_source", list(INPUT_SOURCES), proof_fact, "export const ProofInputSource = LiteralKit(", None),
        ("vocabulary_miss_reason", list(MISS_REASONS), proof_fact, "export const ProofMissReason = LiteralKit([", None),
        ("vocabulary_stage", list(PROOF_STAGES), schemas, "export const ProofStage = LiteralKit(", None),
        ("vocabulary_tier", list(PROOF_TIERS), schemas, "export const YeetProofTier = LiteralKit(", None),
        ("vocabulary_env_profile", list(ENV_PROFILES), schemas, "export const ProofEnvProfile = LiteralKit(", None),
        ("vocabulary_lane_class", list(LANE_CLASSES), CLI + "commands/Ci/CiLane.ts", "export const CI_LANE_CLASS_VALUES =", None),
        ("origin_key_writer", "absolute path of the checkout that ran; pinned as <fleet>/<label>", shadow, "originKey: repoRoot,", None),
        ("hosted_run_id_writer", "null for every locally written fact", shadow, "hostedRunId: null,", None),
        ("lane_class_writer", "cli-runnable for every locally journaled lane", shadow, 'laneClass: "cli-runnable",', 2),
        ("fact_ttl", "expiresAt is recordedAt plus 30 days", shadow, "export const PROOF_FACT_TTL", None),
        ("shadow_then_fact", "one appendAll per lane writes the shadow row then its fact", shadow, "yield* ledger.appendAll(", None),
        ("tolerant_reader", "drops the unterminated tail, skips empty lines, counts malformed rows; this capture is stricter", ledger, "const loadProofLedger", None),
        ("reader_codec", "Effect decode ignores unknown members; this capture refuses them", ledger, "JsonStringCodec(ProofLedgerRow)", None),
        ("owning_clone", "gitdir and commondir resolution without spawning git (time-to-certainty ruling 71)", paths, "const owningCloneRoot", None),
        ("ledger_path", ".beep/yeet/proof-ledger.ndjson inside the owning clone", paths, "export const proofLedgerPathForCheckout", None),
        ("run_id", "<safe-branch>-<sha12(branch)>", artifacts, "export const repoRunArtifactId = Effect.fn(", None),
        ("branch_sha12", "sha256 UTF-8 branch, lowercase hex first 12", artifacts, "const artifactNameHash = Effect.fnUntraced", None),
        ("attempt_stage", "merged gives merged-preview; repair or review-fix gives repair-loop; otherwise pre-push", YEET + "Handler.ts", "const attemptStageFor = (", None),
        ("writer_failure_swallowed", "a ledger fault is logged and the verdict proceeds", YEET + "Handler.ts", "proof shadow skipped", None),
        ("attempt_journal_file", "attempts.ndjson lives in the origin checkout; not read by this capture", YEET + "AttemptJournal.ts", 'const JOURNAL_FILE_NAME = "attempts.ndjson";', None),
    ]


def source_facts(reader: TreeReader) -> dict[str, Any]:
    """Tree-pinned citations for the writer, reader, row schemas and every vocabulary checked at decode."""
    return {name: fact(reader, value, file, needle, occurrence)
            for name, value, file, needle, occurrence in source_fact_specs()}


def verify_source_fact_table(facts: Any) -> None:
    """Names, values, files, needles and occurrences equal the generator's table; lines and digests replay by tree."""
    specs = source_fact_specs()
    if not isinstance(facts, dict) or list(facts) != [spec[0] for spec in specs]:
        fail("source facts differ from the generator's table")
    for name, value, file, needle, occurrence in specs:
        entry = facts[name]
        source = entry.get("source") if isinstance(entry, dict) else None
        expected = ["file", "line", "needle", "sha256"] + (["occurrence"] if occurrence is not None else [])
        if (not isinstance(source, dict) or list(entry) != ["value", "source"] or entry["value"] != value
                or list(source) != expected or source["file"] != file or source["needle"] != needle
                or source.get("occurrence") != occurrence):
            fail("source fact differs from the generator's table: " + name)


def verify_vocabulary_facts(facts: dict[str, Any], reader: TreeReader) -> None:
    """Each pinned vocabulary and key set must equal the generator's constants and appear in its cited blob."""
    expected = {"schema_version": PROOF_FACT_SCHEMA, "fact_row": list(FACT_ROW_KEYS), "fact": list(FACT_KEYS),
                "input_digest": list(INPUT_KEYS), "epoch": list(EPOCH_KEYS), "provenance": list(PROVENANCE_KEYS),
                "shadow_row": list(SHADOW_KEYS), "reuse_hit": list(HIT_KEYS), "reuse_miss": list(MISS_KEYS),
                "row_union": list(ROW_KINDS), "vocabulary_outcome": list(PROOF_OUTCOMES),
                "vocabulary_input_source": list(INPUT_SOURCES), "vocabulary_miss_reason": list(MISS_REASONS),
                "vocabulary_stage": list(PROOF_STAGES), "vocabulary_tier": list(PROOF_TIERS),
                "vocabulary_env_profile": list(ENV_PROFILES), "vocabulary_lane_class": list(LANE_CLASSES)}
    for name, value in expected.items():
        entry = facts.get(name)
        if not isinstance(entry, dict) or entry.get("value") != value:
            fail("source fact differs from the generator's decode contract: " + name)
        blob = reader.blob(entry["source"]["file"]) or b""
        text = blob.decode("utf-8", errors="replace")
        members = [value] if isinstance(value, str) else value
        if name.startswith("vocabulary_") or name in ("schema_version", "row_union"):
            missing = [m for m in members if f'"{m}"' not in text]
        else:
            missing = [m for m in members if re.search(rf"\b{re.escape(m)}\s*:", text) is None]
        if missing:
            fail("cited schema no longer carries a decoded member or literal: " + name)


def gate_citation(reader: TreeReader) -> tuple[dict[str, Any], bool]:
    citation = cite(reader, TTC_PLAN, C4_1_NEEDLE)
    checked = reader.lines(TTC_PLAN)[citation["line"] - 1].startswith(C4_1_CHECKED_PREFIX)
    return citation, checked


def cut_check() -> str:
    """Confirm the cut instant from the #1321 commit when it resolves locally (capture only)."""
    if git_run("rev-parse", "--verify", "--quiet", CUT_COMMIT + "^{commit}", check=False).returncode:
        return CUT_CHECKS[0]
    committed = dt.datetime.fromisoformat(git_text("show", "-s", "--format=%cI", CUT_COMMIT))
    if committed.astimezone(dt.timezone.utc) != CUT:
        fail("cut commit instant differs from the recorded cut")
    return CUT_CHECKS[1]


@dataclasses.dataclass
class Capture:
    emitted: list[Payload]
    metadata: dict[str, Any]
    deny: list[bytes]


def capture() -> Capture:
    if REPO_ROOT.parent.name == "worktrees" and REPO_ROOT.parent.parent.name == ".claude":
        fail("refusing to capture from a .claude/worktrees checkout; run from a clone or a sibling worktree")
    if math.log2(REUSE_KEY_HEX) >= GITLEAKS_ENTROPY_CUT:
        fail("reuse-key prefix width can exceed the gitleaks generic-api-key entropy cut; Secret Scanning would fail")
    started = instant()
    probe = probe_corpus()
    reader = TreeReader(probe["corpus_tree"])
    c4_1, c4_1_checked = gate_citation(reader)
    facts = source_facts(reader)
    lineage_blob = reader.blob(CORPUS_REL + LINEAGE_GENERATOR)
    if lineage_blob is None:
        fail("lineage generator missing from corpus_tree")
    cut_status = cut_check()
    salt = os.urandom(32)  # Never persist, print, or return this capture-local value.
    discovered, excluded, excluded_paths = discover_checkouts()
    excluded_labels: set[str] = set()
    for path in excluded_paths:
        try:
            excluded_labels.add(PurePosixPath(path.as_posix()).relative_to(PurePosixPath(FLEET_ROOT.as_posix())).as_posix())
        except ValueError:
            continue
    raw_paths = [str(FLEET_ROOT), str(Path.home()), str(Path(tempfile.gettempdir()))]
    raw_paths += [str(path) for path in excluded_paths]
    owners: dict[Path, str] = {}
    lane_ledgers = 0
    for _label, checkout, _kind, _layout in discovered:
        raw_paths.append(str(checkout))
        owner = owning_clone(checkout)
        owners.setdefault(owner, "")
        if owner != Path(os.path.abspath(checkout)):
            lane_ledgers += int(os.path.lexists(checkout.joinpath(*LEDGER_PARTS)))
    owner_rows = []
    for owner in owners:
        raw_paths.append(str(owner))
        owner_rows.append((fleet_label(owner, "owning clone"), owner, owner_kind(owner)))
    owner_rows.sort()
    if len({label for label, _, _ in owner_rows}) != len(owner_rows):
        fail("owning-clone labels collide")
    decoded, ledgers = [], []
    for label, owner, kind in owner_rows:
        observed_at = instant()
        data = read_ledger(owner)
        source = f"<fleet>/{label}/" + "/".join(LEDGER_PARTS)
        status = "present" if data is not None else "absent"
        receipt: dict[str, Any] = {"checkout": label, "owner_kind": kind, "ledger": status}
        if data is not None:
            receipt["path"] = f"ledgers/{checkout_component(label)}/proof-ledger.ndjson"
        receipt.update(complete(source, observed_at, status))
        receipt["source"] = {"file": source, "line": 1}
        ledgers.append(receipt)
        if data is None:
            receipt.update(copy.deepcopy(ABSENT_COUNTS))
            continue
        rows, decode_receipt = decode_ledger(data, label)
        decoded.append((label, owner, rows, receipt, decode_receipt, ledger_pairing(rows, decode_receipt, label)))
    keys: dict[str, str] = {}
    for _, _, rows, _, _, _ in decoded:
        for row in rows:
            for key in ((row["fact"]["key"]["key"],) if row["kind"] == "fact" else (row["decision"]["key"],)):
                if keys.setdefault(key[:REUSE_KEY_HEX], key) != key:
                    fail("reuse-key prefix collides across distinct keys; the P1 Ruling 3 projection is not injective")
    emitted, pinned, existence = [], [], collections.Counter()
    custody_variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))
    for label, owner, rows, receipt, decode_receipt, paired in decoded:
        counts, projected = collections.Counter(), []
        for index, row in enumerate(rows):
            origin = None
            if row["kind"] == "fact":
                raw_origin = row["fact"]["provenance"]["originKey"]
                raw_paths.append(raw_origin)
                origin, kind = origin_label(raw_origin, owner, label)
                if names_excluded(origin, excluded_labels):
                    fail(f"proof ledger {label} record {index}: originKey names a checkout excluded by the "
                         "public-origin filter (P1 note h); the capture fails closed")
                if not paired[index]:
                    pass  # pinned as issuance history, outside the paired census and its probes (W4-A6)
                elif kind == "merged-preview":
                    existence["origin_unprobed"] += 1
                elif os.path.lexists(raw_origin):
                    existence["origin_present_at_capture"] += 1
                    if kind != "clone-root" and not os.path.lexists(os.path.join(raw_origin, ".git")):
                        existence["origin_present_without_git_at_capture"] += 1
                    elif kind != "clone-root":
                        try:
                            differs = owning_clone(Path(raw_origin)) != owner
                        except SystemExit:
                            existence["origin_owner_unresolvable_at_capture"] += 1
                        else:
                            existence["origin_owner_differs_at_capture"] += int(differs)
                else:
                    existence["origin_gone_at_capture"] += 1
            candidate = project_row(row, origin)
            redacted = redact(candidate, salt, counts)
            if not same_json(redacted, candidate) or not leaf_paths(row, redacted) <= PROJECTED_PATHS:
                fail(f"proof ledger {label} record {index}: a member other than originKey or the reuse keys "
                     "changed under redaction; a new host-bearing member fails closed")
            projected.append(redacted)
        variants = {variant: counts.pop("owner_refs_variant_" + variant, 0) for variant in OWNER_VARIANTS}
        custody_variants.update(variants)
        recorded = [row["fact"]["recordedAt"] if row["kind"] == "fact" else row["recordedAt"] for row in projected]
        bounds = timestamp_bounds([require_instant(value, label, "recordedAt") for value in recorded])
        receipt.update({"rows": len(projected), "facts": sum(row["kind"] == "fact" for row in projected),
                        "shadows": sum(row["kind"] == "shadow" for row in projected), **decode_receipt,
                        "first_recorded_at": bounds[0], "last_recorded_at": bounds[1],
                        "redaction_counts": dict(sorted(counts.items())), "owner_refs_by_variant": variants})
        emitted.extend(payload_pair(receipt["path"], projected, LEDGER_KIND, receipt["source"]["file"],
                                    receipt["observed_at"], provenance="organic", checkout=label))
        pinned.append((label, projected, receipt))
    for entry in emitted:
        refuse_ignored_path(entry.path)
    census = derive_census(pinned)
    post_cut = census.pop("post_cut_pre_push_facts")
    unpaired = census.pop("unpaired_by_ledger")
    if any(unpaired[label] != receipt["unpaired_adjacent_to_tear"] for label, _, receipt in pinned):
        fail("ledger pairing census differs between decode and census derivation")
    holds = c4_1_checked and post_cut > 0
    stop = {"c4_1_checked": c4_1_checked, "post_cut_pre_push_facts": post_cut, "owners_with_ledger": len(decoded),
            "owners_resolved": len(owner_rows), "stage_census": census["stage_census"],
            "unpaired_adjacent_to_tear": census["pairing"]["unpaired_adjacent_to_tear"]}
    if not holds:
        raise GateStop({"status": "census recorded; pin lane stopped", **stop})
    facts_total, rows_total = census.pop("facts"), census.pop("rows")
    kinds = collections.Counter()
    for entry in census["origin"]:
        kinds[entry["kind"]] += entry["facts"]
    census["join_coverage"] = {
        "clone_origin_facts": kinds["clone-root"], "fleet_root_checkout_origin_facts": kinds["fleet-root-checkout"],
        "lane_origin_facts": kinds["lane"], "claude_worktree_origin_facts": kinds["claude-worktree"],
        "merged_preview_origin_facts": kinds["merged-preview"],
        "origin_present_at_capture": existence["origin_present_at_capture"],
        "origin_gone_at_capture": existence["origin_gone_at_capture"],
        "origin_unprobed": existence["origin_unprobed"],
        "origin_present_without_git_at_capture": existence["origin_present_without_git_at_capture"],
        "origin_owner_unresolvable_at_capture": existence["origin_owner_unresolvable_at_capture"],
        "origin_owner_differs_at_capture": existence["origin_owner_differs_at_capture"],
        "origin_probe_basis": ORIGIN_PROBE_BASIS, "attempts_read_by_w4": 0, "attempts_join_target": ATTEMPTS_JOIN_TARGET}
    census["residue"] = {"owner_refs": sum(custody_variants.values()), "owner_refs_by_variant": dict(custody_variants),
                         "origin_keys_replaced": facts_total, "keys_projected": rows_total, "deny_list_hits": 0,
                         "deny_list_basis": DENY_LIST_BASIS}
    census["observation_basis"] = OBSERVATION_BASIS
    present = sum(entry["ledger"] == "present" for entry in ledgers)
    metadata = {
        "corpus": probe,
        "generator_lineage": [{"generator": LINEAGE_GENERATOR, "sha256": sha256(lineage_blob),
                               "relation": "patterns copied, nothing imported (Stage B Ruling 18)"}],
        "capture_instant": started, "capture_finished_at": instant(), "stage": "C", "provenance": "organic",
        "capture_instant_basis": CAPTURE_INSTANT_BASIS,
        "custody": custody_block(custody_variants),
        "gate": {"c4_1": c4_1, "c4_1_checked": c4_1_checked, "post_cut_pre_push_facts": post_cut, "holds": holds,
                 "rule": GATE_RULE, "rulings": list(GATE_RULINGS)},
        "cut": {"instant": CUT_INSTANT, "source": CUT_SOURCE, "predicate": CUT_PREDICATE, "capture_check": cut_status},
        "merged_preview_followup": MERGED_PREVIEW_FOLLOWUP,
        "discovery": {"checkouts": len(discovered),
                      "by_kind": dict(sorted(collections.Counter(kind for _, _, kind, _ in discovered).items())),
                      "by_layout": dict(sorted(collections.Counter(layout for _, _, _, layout in discovered).items())),
                      "excluded": excluded, "origin_filter": ORIGIN_FILTER,
                      "owners_resolved": len(owner_rows),
                      "owners_bare_or_separated": sum(kind == "bare-or-separated" for _, _, kind in owner_rows),
                      "owners_with_ledger": present, "owners_without_ledger": len(ledgers) - present,
                      "lane_ledgers_present_not_read": lane_ledgers, "lane_ledger_basis": LANE_LEDGER_BASIS,
                      "owner_rule": OWNER_RULE},
        "ledgers": ledgers,
        "census": census,
        "source_facts": facts,
        "excluded_sources": list(EXCLUDED_SOURCES),
        "checkout_path_encoding": CHECKOUT_PATH_ENCODING,
        "capture_only_members": list(CAPTURE_ONLY_MEMBERS),
    }
    return Capture(emitted, metadata, deny_tokens(raw_paths))


PROJECTION_RULES = [
    "config_key_value channel: one .properties sibling for every raw payload",
    "# record <zero-based-index>; eligible leaf_key=value in source traversal order",
    "ASCII alphanumeric/underscore keys; nonempty single-line strings, JSON numbers and booleans",
    "null, empty strings and CR/LF values omitted; duplicate pairs and scalar array leaves retained",
    "events count raw JSON records once; projections do not double-count events",
    f"reuse key members fact.key.key and decision.key pinned as {REUSE_KEY_HEX}-hex prefixes (P1 Ruling 3 as amended: "
    "no value that short can exceed the gitleaks generic-api-key entropy cut); every other digest verbatim",
    "originKey mapped to <fleet>/<label> (P1 note d); merged-preview process components written <process>",
    "row id is (checkout label, one-based source line ordinal); each ledger receipt's source_line_ranges maps the "
    "pinned records, in order, onto source lines; whole ledgers pinned (P1 Ruling 6)",
    "pairing runs over decoded rows; an unpaired row whose neighbouring raw line toward its missing partner is torn "
    "(or is the unterminated tail after a shadow) stays in the payload as issuance history, is counted as "
    "unpaired_adjacent_to_tear per ledger and in census.pairing, and is left out of pairs, hit resolution, the "
    "gate count and the paired census (P1 Ruling 2 addendum, brief W4-A6); any other unpaired row fails the capture; "
    "torn_line_ranges locates each tear so verify recomputes the pairing from pinned bytes",
]
REDACTION_RULES = [
    "All families: longest host-root match at start, after a character outside ASCII alphanumeric, underscore, dot, tilde, slash and hyphen, or after a slash preceded by slash or colon; relative path continuations survive",
    "URI authority pre-pass preserves scheme and authority, with a slash before the host-root token",
    "fleet root is <fleet>; home is <home>; temp roots are <session-tmp> and <tmp>; runtime is <runtime>; proc is <proc>; shared memory is <shm>",
    "Per-user systemd unit identifiers become <uid>; proc process-directory identifiers become <process>",
    "Process identity members dropped recursively; complete serialized process scalar values replaced",
    "JSON keys and values consume escaped character pairs; nested string serialization retains its depth",
    "Structural keys and non-process numbers, booleans, nulls retain their decoded values",
    "hostname and sha12(hostname) in string values become <host>; residue fails capture",
    "Ledger rows: any member other than originKey and the two reuse keys that changes under redaction fails capture closed",
    "Residue at capture only: the capture deny list (every raw host path seen) and every hostname form, its sha12, the login and home-owner names, all in any letter case; verify runs only host-independent shape classes, so it replays on any host and login",
    "Residue everywhere: bare home-relative paths, uid assignments, relative runtime-directory continuations, and GitHub, GitLab, Stripe, Google, npm, JWT, Slack webhook, sk-style, AWS and private-key credential shapes",
    "The knowledge-refs encoded home marker (dash, home, dash) is refused wherever it starts a path component (not after an ASCII letter or digit), in every label, payload and MANIFEST.yaml; a mid-token occurrence in a branch or lane label stays legal, and identity tokens still catch an encoded home there (P1 call s)",
    "Emitted paths never carry a component that .gitignore swallows (.beep, .claude, docs, tmp, dist, build, coverage, trace, secrets, env files, key and certificate names); such a capture fails closed",
    "Out of scope: host bytes in an encoded form (base64 or hex) inside a free-text member; the exact-key-set decode fixes every member, and branch and runId are the only free-text members",
]


def finish_manifest(metadata: dict[str, Any], emitted: list[Payload], population: str) -> bytes:
    emitted.sort(key=lambda entry: entry.path)
    if len({entry.path for entry in emitted}) != len(emitted):
        fail("duplicate emitted paths")
    metadata = dict(metadata)
    corpus = metadata.pop("corpus")
    lineage = metadata.pop("generator_lineage")
    manifest = {"schema_version": manifest_schema(population), "generated_by": SCRIPT.name,
                "generator_sha256": sha256(SCRIPT.read_bytes()), "generator_lineage": lineage,
                "corpus_commit": corpus["corpus_commit"], "corpus_tree": corpus["corpus_tree"],
                "corpus_base": corpus["corpus_base"], "corpus_ref": "origin/main",
                "capture_head": corpus["capture_head"],
                "citation_replay": CITATION_REPLAY,
                **metadata,
                "projection_rules": PROJECTION_RULES,
                "redaction_rules": REDACTION_RULES,
                "files": [{**entry.receipt, "bytes": len(entry.data), "sha256": sha256(entry.data)} for entry in emitted],
                "integrity": dict(INTEGRITY),
                "verification": dict(VERIFICATION),
                "totals": {"payload_files": len(emitted), "files_emitted": len(emitted) + 1,
                           "events": sum(e.receipt["event_count"] for e in emitted if e.receipt["kind"] != PROJECTION_KIND),
                           "payload_bytes": sum(len(e.data) for e in emitted), "bytes_emitted": 0}}
    for _ in range(12):
        data = (f"# GENERATED by {SCRIPT.name}; do not hand-edit.\n"
                "# Public run-4 Stage C capture; source descriptors are portable.\n"
                + yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True, width=100)).encode()
        total = manifest["totals"]["payload_bytes"] + len(data)
        if manifest["totals"]["bytes_emitted"] == total:
            return data
        manifest["totals"]["bytes_emitted"] = total
    fail("manifest byte total did not reach a fixed point")


# --- Verify -----------------------------------------------------------------------------------------------


LAST_ADVISORIES: dict[str, int] = {}


class VerifyHost:
    """Host-independent stand-in for ``socket`` inside the copied redact path at verify: run3b's
    ``redact_string`` rewrites the running hostname, so a verifier named ``beep`` or ``ci`` would rewrite
    pinned bytes and fail the idempotence check. The NUL-delimited name cannot occur in a decoded member."""

    @staticmethod
    def gethostname() -> str:
        return "\x00verify-host\x00"


@contextlib.contextmanager
def host_independent_redaction():
    global socket
    real, socket = socket, VerifyHost
    try:
        yield
    finally:
        socket = real


def require_member_order(value: Any, keys: list[str], label: str) -> dict[str, Any]:
    """Exact member set and order; a same-length rename, an added or a dropped member fails."""
    if not isinstance(value, dict) or list(value) != keys:
        fail(f"{label} members differ from the generator's shape")
    return value


def count(value: Any, label: str) -> int:
    if type(value) is not int or value < 0:
        fail(f"{label} is not a non-negative integer")
    return value


def utc_instant(value: Any, label: str) -> dt.datetime:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z", value):
        fail(f"{label} is not a millisecond UTC instant")
    return dt.datetime.fromisoformat(value[:-1] + "+00:00")


def verify_output_tree(root: Path, population: str) -> dict[str, Any]:
    """Verify pinned bytes and tree-pinned citations; git cat-file/rev-parse/merge-base only, no fleet or salt."""
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
    require_member_order(manifest, MANIFEST_KEYS, "manifest")
    verify_fields(manifest, {"generated_by": SCRIPT.name, "stage": "C", "provenance": "organic",
                             "corpus_ref": "origin/main"}, "manifest identity")
    object_id(manifest.get("capture_head"), "capture_head")
    reader, advisories = verify_tree_citations(manifest)
    receipts = manifest["files"]
    paths = [safe_relative_path(r["path"]).as_posix() for r in receipts]
    if paths != sorted(set(paths)):
        fail("manifest paths duplicated or unordered")
    for path in paths:
        refuse_ignored_path(path)
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
        if receipt["kind"] != LEDGER_KIND or not path.endswith(".ndjson"):
            fail("unsupported pinned payload kind")
        require_member_order(receipt, RAW_FILE_KEYS, "payload receipt")
        rows = decode_ndjson(data, path)
        with host_independent_redaction():
            for index, row in enumerate(rows):
                validate_ledger_row(row, f"pinned {path} record {index}", projected=True)
                if not same_json(row, redact(row, None, collections.Counter(), True)):
                    fail("persisted raw payload is not redaction-idempotent")
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
    verify_census(manifest, raw, reader)
    LAST_ADVISORIES.clear()
    LAST_ADVISORIES.update(advisories)
    return expected


def range_ordinals(ranges: Any, label: str) -> list[int]:
    """Ascending, non-adjacent, one-based inclusive ``[first, last]`` runs (the ``line_ranges`` normal form)."""
    if not isinstance(ranges, list):
        fail("ledger source line ranges differ: " + label)
    previous = -1
    for item in ranges:
        if (not isinstance(item, list) or len(item) != 2 or any(type(n) is not int for n in item)
                or not previous + 1 < item[0] <= item[1]):
            fail("ledger source line ranges differ: " + label)
        previous = item[1]
    return expand_ranges(ranges)


def verify_line_ranges(entry: dict[str, Any], label: str) -> None:
    """``source_line_ranges`` covers exactly the pinned rows and ``torn_line_ranges`` exactly the torn lines,
    disjoint and inside the ledger's terminated lines (rows + torn + empty); the remaining lines are empty."""
    rows, torn = range_ordinals(entry["source_line_ranges"], label), range_ordinals(entry["torn_line_ranges"], label)
    terminated = entry["rows"] + entry["torn_rows"] + entry["empty_lines"]
    if (len(rows) != entry["rows"] or len(torn) != entry["torn_rows"] or set(rows) & set(torn)
            or max(rows + torn, default=0) > terminated):
        fail("ledger source line ranges differ: " + label)


def verify_census(manifest: dict[str, Any], raw: dict[str, list[JsonValue]], reader: TreeReader) -> None:
    """Bind every receipt, census, gate, prose and custody member to persisted payloads and generator constants."""
    verify_fields(manifest, {"citation_replay": CITATION_REPLAY, "capture_instant_basis": CAPTURE_INSTANT_BASIS,
                             "merged_preview_followup": MERGED_PREVIEW_FOLLOWUP, "excluded_sources": EXCLUDED_SOURCES,
                             "checkout_path_encoding": CHECKOUT_PATH_ENCODING,
                             "capture_only_members": CAPTURE_ONLY_MEMBERS, "projection_rules": PROJECTION_RULES,
                             "redaction_rules": REDACTION_RULES, "integrity": INTEGRITY,
                             "verification": VERIFICATION}, "manifest prose")
    started = utc_instant(manifest["capture_instant"], "capture_instant")
    finished = utc_instant(manifest["capture_finished_at"], "capture_finished_at")
    if finished < started:
        fail("capture interval is reversed")
    files = {r["path"]: r for r in manifest["files"] if r["kind"] != PROJECTION_KIND}
    ledgers = manifest["ledgers"]
    if not isinstance(ledgers, list):
        fail("ledger receipts are not a list")
    labels = [entry.get("checkout") if isinstance(entry, dict) else None for entry in ledgers]
    if labels != sorted(set(labels)):
        fail("ledger labels duplicated or unordered")
    custody_variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))
    pinned, checked = [], set()
    for entry in ledgers:
        label = entry["checkout"]
        safe_relative_path(label)
        absent = entry.get("ledger") == "absent"
        require_member_order(entry, ABSENT_LEDGER_KEYS if absent else LEDGER_KEYS, "ledger receipt")
        source = f"<fleet>/{label}/" + "/".join(LEDGER_PARTS)
        if entry["source"] != {"file": source, "line": 1} or entry["owner_kind"] not in ("clone", "bare-or-separated"):
            fail("ledger source descriptor differs")
        observed = utc_instant(entry["observed_at"], "ledger observed_at")
        if not started <= observed <= finished:
            fail("ledger observed_at lies outside the capture interval")
        verify_fields(entry, {key: value for key, value in complete(source, entry["observed_at"],
                                                                     "absent" if absent else "present").items()
                              if key != "source"}, "ledger completeness descriptor")
        if absent:
            verify_fields(entry, ABSENT_COUNTS, "absent ledger census")
            continue
        if entry["ledger"] != "present":
            fail("ledger receipt has unsupported status")
        path = entry["path"]
        if path != f"ledgers/{checkout_component(label)}/proof-ledger.ndjson" or path not in raw or path in checked:
            fail("ledger payload linkage differs")
        checked.add(path)
        rows = raw[path]
        verify_fields(files[path], {**complete(source, entry["observed_at"]), "kind": LEDGER_KIND,
                                    "source": {"file": source, "line": 1}, "checkout": label}, "ledger receipt linkage")
        recorded = [row["fact"]["recordedAt"] if row["kind"] == "fact" else row["recordedAt"] for row in rows]
        bounds = timestamp_bounds([require_instant(value, label, "recordedAt") for value in recorded])
        verify_fields(entry, {"rows": len(rows), "facts": sum(row["kind"] == "fact" for row in rows),
                              "shadows": sum(row["kind"] == "shadow" for row in rows),
                              "first_recorded_at": bounds[0], "last_recorded_at": bounds[1]}, "ledger row census")
        for member in ("empty_lines", "torn_rows", "unterminated_tail_bytes", "unpaired_adjacent_to_tear"):
            count(entry[member], "ledger decode receipt " + member)
        verify_line_ranges(entry, label)
        custody_variants.update(verify_owner_census(entry, rows, False))
        pinned.append((label, rows, entry))
    if checked != set(raw):
        fail("ledger census does not cover every raw payload exactly once")
    if manifest["custody"] != custody_block(custody_variants):
        fail("custody block differs from the generator's rule or the pinned variant census")
    census = derive_census(pinned)
    post_cut, facts_total, rows_total = census.pop("post_cut_pre_push_facts"), census.pop("facts"), census.pop("rows")
    unpaired = census.pop("unpaired_by_ledger")
    for label, _, entry in pinned:
        if entry["unpaired_adjacent_to_tear"] != unpaired[label]:
            fail("ledger pairing census differs: unpaired_adjacent_to_tear of " + label)
    gate = require_member_order(manifest["gate"], GATE_KEYS, "gate")
    if gate["c4_1"]["file"] != TTC_PLAN or gate["c4_1"]["needle"] != C4_1_NEEDLE:
        fail("gate citation differs")
    lines = reader.lines(gate["c4_1"]["file"]) or []
    checked_box = lines[gate["c4_1"]["line"] - 1].startswith(C4_1_CHECKED_PREFIX)
    verify_fields(gate, {"c4_1_checked": checked_box, "post_cut_pre_push_facts": post_cut,
                         "holds": checked_box and post_cut > 0, "rule": GATE_RULE, "rulings": GATE_RULINGS},
                  "gate census")
    if gate["holds"] is not True:
        fail("a pinned ledger corpus requires a holding gate")
    pinned_census = require_member_order(manifest["census"], CENSUS_KEYS, "census")
    verify_fields(pinned_census, census, "ledger census")
    if pinned_census["observation_basis"] != OBSERVATION_BASIS:
        fail("ledger census differs: observation_basis")
    kinds = collections.Counter()
    for entry in census["origin"]:
        kinds[entry["kind"]] += entry["facts"]
    coverage = require_member_order(pinned_census["join_coverage"], JOIN_COVERAGE_KEYS, "join coverage")
    verify_fields(coverage, {"clone_origin_facts": kinds["clone-root"],
                             "fleet_root_checkout_origin_facts": kinds["fleet-root-checkout"],
                             "lane_origin_facts": kinds["lane"], "claude_worktree_origin_facts": kinds["claude-worktree"],
                             "merged_preview_origin_facts": kinds["merged-preview"], "attempts_read_by_w4": 0,
                             "origin_probe_basis": ORIGIN_PROBE_BASIS, "attempts_join_target": ATTEMPTS_JOIN_TARGET},
                  "join coverage")
    probed = [count(coverage[key], "join coverage " + key) for key in (
        "origin_present_at_capture", "origin_gone_at_capture", "origin_unprobed",
        "origin_present_without_git_at_capture", "origin_owner_unresolvable_at_capture",
        "origin_owner_differs_at_capture")]
    if sum(probed[:3]) != sum(kinds.values()) or probed[2] != kinds["merged-preview"] or sum(probed[3:]) > probed[0]:
        fail("origin existence census differs from pinned facts")
    residue = require_member_order(pinned_census["residue"], RESIDUE_KEYS, "residue census")
    verify_fields(residue, {"owner_refs": sum(custody_variants.values()), "owner_refs_by_variant": dict(custody_variants),
                            "origin_keys_replaced": facts_total, "keys_projected": rows_total, "deny_list_hits": 0,
                            "deny_list_basis": DENY_LIST_BASIS}, "residue census")
    cut = require_member_order(manifest["cut"], CUT_KEYS, "cut")
    if (cut["instant"] != CUT_INSTANT or cut["source"] != CUT_SOURCE or cut["predicate"] != CUT_PREDICATE
            or cut["capture_check"] not in CUT_CHECKS):
        fail("cut differs")
    verify_discovery(manifest["discovery"], ledgers)
    verify_source_fact_table(manifest["source_facts"])
    verify_vocabulary_facts(manifest["source_facts"], reader)


def verify_discovery(discovery: Any, ledgers: list[dict[str, Any]]) -> None:
    """Recomputable owner counts, constant prose, and internal consistency of the capture-only counts."""
    require_member_order(discovery, DISCOVERY_KEYS, "discovery")
    present = sum(entry["ledger"] == "present" for entry in ledgers)
    verify_fields(discovery, {"owners_resolved": len(ledgers), "owners_with_ledger": present,
                              "owners_without_ledger": len(ledgers) - present,
                              "owners_bare_or_separated": sum(e["owner_kind"] == "bare-or-separated" for e in ledgers),
                              "origin_filter": ORIGIN_FILTER, "lane_ledger_basis": LANE_LEDGER_BASIS,
                              "owner_rule": OWNER_RULE}, "discovery census")
    checkouts = count(discovery["checkouts"], "discovery checkouts")
    by_kind, by_layout = discovery["by_kind"], discovery["by_layout"]
    excluded = require_member_order(discovery["excluded"], list(EXCLUDED_REASONS), "discovery exclusions")
    for name, table, allowed in (("by_kind", by_kind, CHECKOUT_KINDS), ("by_layout", by_layout, CHECKOUT_LAYOUTS)):
        if not isinstance(table, dict) or not set(table) <= set(allowed) or list(table) != sorted(table):
            fail("discovery census differs: " + name)
        for value in table.values():
            count(value, "discovery " + name)
    for value in excluded.values():
        count(value, "discovery exclusions")
    if sum(by_kind.values()) != checkouts or sum(by_layout.values()) != checkouts:
        fail("discovery census differs: kinds and layouts must each sum to the checkout count")
    if (len(ledgers) > checkouts
            or count(discovery["lane_ledgers_present_not_read"], "lane ledgers") > by_kind.get("linked-worktree", 0)):
        fail("discovery census differs: owners or lane ledgers exceed the discovered checkouts")


def resolve_root(dry_run_root: Path | None) -> Path:
    if dry_run_root is None:
        return OUTPUT_ROOTS["ledger"]
    if not dry_run_root.is_absolute():
        fail("--dry-run-root must be an absolute path")
    resolved = Path(os.path.abspath(dry_run_root))
    for guarded, where in ((REPO_ROOT, "the repository"), (FLEET_ROOT, "the fleet root")):
        if (resolved == guarded or guarded in resolved.parents or resolved.resolve() == guarded.resolve()
                or guarded.resolve() in resolved.resolve().parents):
            fail(f"--dry-run-root must be outside {where}")
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved / OUTPUT_ROOTS["ledger"].name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", choices=("ledger",), help="deliberately replace the ledger pin")
    parser.add_argument("--dry-run-root", type=Path,
                        help="capture and verify into DIR/run4-ledger (absolute, outside the repository and fleet root)")
    args = parser.parse_args()
    root = resolve_root(args.dry_run_root)
    if (root.exists() or root.is_symlink()) and args.refresh != "ledger":
        summary = {"status": "verified", **verify_output_tree(root, "ledger")}
    else:
        try:
            captured = capture()
        except GateStop as stop:
            print(json.dumps({"verification": "GATE", "ledger": stop.census}, sort_keys=True))
            raise SystemExit(3) from None
        except OSError as exc:
            # Tracebacks would echo fleet paths; report the class and errno only.
            fail(f"filesystem read failed during capture ({type(exc).__name__}, errno {exc.errno}); path withheld")
        manifest = finish_manifest(captured.metadata, captured.emitted, "ledger")
        scan_output_bytes([(entry.path, entry.data) for entry in captured.emitted] + [(MANIFEST_NAME, manifest)],
                          captured.deny, capture_identity_tokens())
        summary = {"status": "pinned", **write_staged_capture(captured.emitted, manifest, root, "ledger")}
    if args.dry_run_root is not None:
        summary["dry_run"] = True
    print(json.dumps({"verification": "PASS", "ledger": summary, "advisories": dict(LAST_ADVISORIES)}, sort_keys=True))


if __name__ == "__main__":
    main()
