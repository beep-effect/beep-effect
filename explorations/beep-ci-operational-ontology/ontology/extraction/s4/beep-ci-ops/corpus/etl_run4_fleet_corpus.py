"""Capture and verify the public run-4 Stage C fleet corpus (the ``run4-fleet`` pin).

Run with ``UV_CACHE_DIR=$HOME/.cache/beep/uv-cache uv run --offline --with pyyaml python -B <this-script>``.
First success pins; ordinary reruns verify ONLY the pinned bytes, this generator, and the
tree-pinned citations (git object reads against the recorded ``corpus_tree``).
``--refresh fleet`` deliberately captures again.
``--dry-run-root DIR`` captures and fully verifies into ``DIR/run4-fleet`` (DIR is an existing
absolute directory outside the repository) and never touches the corpus home; rerunning with the
same flag verifies that tree. Do not hand-edit generated payloads.
Stdlib + PyYAML only. Run-3b mechanics are copied, never imported or modified; this generator is
standalone so its self-pin covers its full implementation (Stage B Ruling 18).

Lineage (source: ``etl_run3b_fleet_corpus.py``; its blob digest at ``corpus_tree`` is recorded in
the manifest's ``generator_lineage``, Ruling 22 rider):

- Copied with byte-identical bodies (AST-compared): ``_repo_root``, ``fleet_root``, the identifier,
  timestamp, path-boundary and 1Password constants, ``fail``, ``sha256``, ``reject_json_constant``,
  ``unique_object``, ``decode_json``, ``decode_ndjson``, ``same_json``, ``host_prefixes``,
  ``uri_host_root_pattern``, ``redact_host_root``, ``redact_pid_match``, ``redact_process_text``,
  ``normalized_member``, ``process_member``, ``owner_ref_census``, ``migrate_custody_census`` (kept for
  the Ruling 23 repair script, unused here), ``verify_owner_census``, ``guard_origin``, ``redact``,
  ``encode_ndjson``, ``encode_json``, ``render_property_scalar``, ``eligible_property_pairs``,
  ``encode_properties_projection``, ``projected_bytes``, ``projection_path``, ``parse_timestamp_scalar``,
  ``collect_timestamps``, ``format_timestamp``, ``timestamp_bounds``, ``validate_component``,
  ``checkout_component``, ``strict_object``, ``instant``, ``complete``, ``safe_relative_path``, ``Payload``,
  ``record_observations``, ``verify_fields``, ``payload_pair``, ``write_staged_capture`` (the stage and
  backup names follow the root name, so they read ``.run4-fleet-stage-*``), ``admission_sources``,
  ``event_census``, ``validate_envelope``, ``transform_source``, ``classify_chain``, ``loss_population``,
  ``synthetic_checkout_aliases``, ``locked_name``, and the synthetic label, protocol, admission-tag and
  chain-class constants.
- Removed: ``source_cite`` and ``verify_source_citations`` (replaced by tree-pinned citations, item 2),
  and every synthetic-population path: ``read_synthetic_export``, ``verify_synthetic_expected``,
  ``synthetic_termination_join``, ``--synthetic-root`` and the synthetic branches of
  ``verify_output_tree`` and ``verify_census`` (item 3).
- Deviations, each with its reason and ruling:
  1. Residue scan, split in two (run-3 Ruling 22). ``scan_output_bytes`` keeps every run-3b class and
     adds host-independent classes: the encoded home marker (dash, home, dash starting a path
     component only; a branch-derived label carrying it mid-token is an ordinary public label, P1
     build sitting recorded call s), home-relative tilde-slash and HOME-variable prefixes (knowledge-refs gate classes);
     the knowledge-refs machine tree name in any case and any home subtree other than a dot directory;
     a fleet path whose first component is not a beep-effect checkout (P1 Ruling 5(1): rows of other
     fleet projects fail closed); writer staging suffixes carrying a pid, merged-preview pid forms in any spelling and plural
     pid members; numeric uid, euid, gid and user id assignments; GitHub OAuth/app/user tokens,
     1Password service-account tokens, Stripe, Google, GitLab, npm, Hugging Face, Slack, JWT and
     TOKEN/SECRET/PASSWORD/_KEY assignments; a boundary before the ``sk-`` prefix (it matched
     ``task-`` in long file names, exploration OPPORTUNITIES receipt); a scan-side right boundary that
     also stops at a backslash, and a second pass over JSON-escaped slashes. ``scan_capture_only`` holds
     the classes that depend on the capturing host and never run in ordinary verify, so a verifier's
     own host or login name (main, build, ci; runner, root, node) cannot fail an intact pin: the
     hostname, its full sha256 and 12-hex prefix, raw or lowercased, in any case (moved out of the
     run-3b scan, which compared the verifier's own exact name); the login name and its sanitized
     branch forms in any case, the exact bytes of every absolute path seen in host-path members
     (checkoutRoot, originKey, command, cwd, repoRoot, hotPaths; never persisted), and the redacted
     labels of excluded checkouts and their -worktrees lanes (P1 Ruling 5(1): an admission, live or
     quarantine row written by an excluded checkout fails the capture closed instead of publishing the
     label; excluding and counting such rows would change the closed-world census and needs a ruling).
  2. ``redact_string`` adds two passes before the host roots: writer staging suffixes
     (``QualityScheduler.ts`` stagingTemporaryPath ``.tmp-<pid>[-<hex start identity>]-<uuid>``,
     ``AdmissionJournal.ts`` ``.tombstone-``/``.stage-``, ``JournalFile.ts`` ``.staging-``) keep their
     UUID while the pid becomes ``<process>`` and the start identity is dropped (run-3 Ruling 11: no raw
     process identity or start reaches the tree); hostname replacement is case-insensitive and covers
     the full sha256 and the lowercased name's digests, longest first, so no digest tail survives.
     Ordinary verify replays the idempotence check under ``host_independent_redaction`` (the hostname
     pass off); capture keeps it, and ``scan_capture_only`` refuses any surviving form. The staging
     templates are cited as source facts.
  3. Citations are tree-pinned (graduation Ruling 8 item 7, P1 Ruling 4): ``tree_cite`` reads
     ``git cat-file blob <corpus_tree>:<file>`` from the fetched ``refs/remotes/origin/main`` tree,
     requires the capturing checkout's file to be byte-equal (``working=False`` at verify), refuses
     ambiguous needles unless an ``occurrence`` is named, and records the blob digest.
     ``verify_tree_citations`` replaces the current-tree check: every citation is gating against
     ``corpus_tree`` (line, needle, occurrence, sha256), a blob missing from a partial clone names
     ``git fetch origin <corpus_commit>``, and current-tree resolution, a locally absent
     ``corpus_commit``, an absent ``origin/main`` and ``corpus_base`` non-ancestry are separate
     advisory counts. The ``git`` wrapper adds ``--no-replace-objects``, ``--no-lazy-fetch``, a scrubbed
     git environment and a 60 s timeout; the corpus ids are probed once before any observation read.
  4. Identity: ``OUTPUT_ROOTS`` holds only ``fleet`` (``run4-fleet``), the schema id is
     ``beep-ci-ops-run4-fleet-corpus/v1``, ``stage`` is ``C``; no synthetic root. The synthetic constants,
     alias rule and ``provenance: synthetic`` vocabulary are kept so run 4 never mislabels run3b-synthetic
     rows (intake docket Stage C clause; PLAN W3), and ``assert_organic`` fails an organic row carrying a
     synthetic checkout token or synthetic provenance. ``--dry-run-root`` is new (Stage C brief).
  5. Discovery (P1 Ruling 5): a public-origin filter read from the filesystem (``.git``, ``gitdir:``,
     ``commondir``, ``config``), ``<clone>/.claude/worktrees/<name>`` checkouts, kind by the ``.git``
     test for nested clones, a ``layout`` per checkout, and ``checkout_counts`` reshaped from run-3b's
     kind counter to ``{by_kind, by_layout, excluded}``. Capture refuses to run from a Claude-app
     worktree because ``fleet_root`` would name the wrong root; ordinary verify, which reads no fleet
     path, runs from anywhere.
  6. Live families add ``promotions`` (``yeet-admission-promotion/v1``); ``quarantine`` is one NDJSON
     payload per admission root in sorted file-name order with ordinals only (P1 Ruling 5(3)(4)). Its
     receipt adds ``family_semantics``, a counts-only ``mtime_days`` census at UTC day grain, and
     ``vanished_before_read``/``blank_files`` accounting (W3-A4); the file name's nonce is kept as a
     join key, its pid and ordinal tail are not persisted.
  7. Ring caps are module constants bound to cited retention facts whose needles carry the values, so a
     moved or changed constant fails the capture by name; verify requires the three facts.
  8. ``known_losses`` reads ``KNOWN_LOSS_CLASSES`` and attaches the ring-window extras by class key.
  9. ``join_keys`` adds ``parentLaneId``, ``stepId``, ``failedStepId``, ``taskId`` and ``id``, cites
     ``runId`` at ``repoRunArtifactId`` and corrects the ``originKey`` text (the deployed writer emits the
     12-hex digest; older rows carry a 64-hex digest). ``deployed_join_keys`` reads the deployed id-member
     set at ``corpus_tree`` against an explicit allowlist and is pinned as ``join_key_census``
     (graduation Ruling 8 item 5).
  10. ``proof_ledger`` names the ``run4-ledger`` sibling and carries ``observation_basis`` as a constant
      member; per-checkout receipts stay existence-only (graduation Ruling 1; P1 Rulings 1, 2, 3, 6).
  11. Queue D: the committed 2026-10-01 journal projection is read by path and sha256 after
      ``redact_journal_snapshot.py --check`` passes, recorded with a recomputed census and chains,
      reconciled against the live canonical journal, and never copied; any miss fails closed with no
      fallback (snapshot ruling addenda; P1 orchestrator note c).
  12. New manifest members: ``generator_lineage``, ``corpus_ref``, ``capture_head``, ``citation_replay``,
      ``admission_root_basis``, ``rulings`` (graduation and snapshot rulings cited; the P1 sitting named
      in prose, orchestrator note j), ``admission_kind_note`` with ``attempt_starts_by_stage`` and
      ``last_merged_preview_start`` (W3-A3, orchestrator note k), a per-root ``window`` (W3-A6, note m;
      its note departs from the W3-A6 wording, item 15),
      ``origin_key_shapes`` (every originKey censused by shape; any other shape fails; item 14),
      ``join_key_census``, ``absence_policy``, ``residue_rules``, ``synthetic_label_policy`` and
      ``discovery_receipts_unverifiable``; ``excluded_sources`` adds the non-public-origin checkouts and
      the uncopied snapshot projection. The member order is ``MANIFEST_KEYS``.
  13. ``finish_manifest`` takes the corpus ids from the capture probe instead of re-probing git, writes
      the run-4 header line, refuses an emitted path with a git-ignored component, and fixes the member
      order. ``verify_output_tree`` checks the top-level shape, turns a missing or mistyped nested member
      into one ``manifest shape differs`` message, checks ``corpus_ref``, ``citation_replay`` and the
      ``capture_head`` shape, rebuilds ``source_facts``, ``known_loss_classes``, ``join_keys``,
      ``rulings`` and ``admission_kind_note`` from ``corpus_tree`` bytes and compares them, compares every
      policy member with its module constant, replays the lineage, join-key census and Queue D sections,
      refuses git-ignored emitted components, and ``verify_census`` recomputes the windows, stage census,
      originKey shapes, quarantine identities, custody policy and ledger block. Verify never takes the
      legacy custody-census branch (no run-4 pin predates payload-bound variants). ``main`` prints a
      top-level ``advisories`` object.
  14. ``originKey`` width (hosted Secret Scanning reads main's ``.gitleaks.toml``, whose ``generic-api-key``
      rule flags a 64-hex value under a ``*key*`` member, so the verbatim 64-hex rows failed the required
      check and no in-PR allowlist can pass it). ``prefix_origin_keys`` writes a 64-hex ``originKey`` at any
      depth as its first 11 hex characters (``ORIGIN_KEY_PREFIX_WIDTH``) after ``transform_source`` and
      before ``payload_pair``; no value of 11 or fewer hex characters can reach the rule's 3.5-bit entropy
      cut, and ``check_origin_key_prefixes`` refuses any width whose log2 reaches it. It also fails the
      capture when two 64-hex values share a prefix, when a pinned row carries a native 11-hex value, or
      when a prefix equals a native 11-hex value or the first 11 hex characters of a native 12-hex value
      the live rows or the snapshot projection carry; 12-hex and empty values stay verbatim.
      ``origin_key_shapes`` censuses the written prefixes as ``hex11_prefix``, gains
      ``hex64_written_as_prefix`` (members, distinct values, rule) and fails on any 64-hex member in pinned
      rows; verify requires the receipt's members and distinct values to equal the pinned ``hex11_prefix``
      census, and the reconciliation compares ``originKey`` in its written form on both sides. P1 Ruling 7
      (2026-10-06 build sitting) adopts this arm at the width of P1 Ruling 3 as amended (11 hex); the 64-hex
      rows were written by a checkout on an earlier lock-name derivation. The ruling is named in prose until
      the goal decisions log is in the ``origin/main`` tree. A later ruling that lands a path- and
      shape-scoped allowlist first reverts this item by removing the two ``prefix_origin_keys`` calls, the
      prefix receipt, the ``hex11_prefix`` shape and their policy lines.
  15. ``WINDOW_NOTE`` departs from the brief's W3-A6 wording ("released-only chains have no admitted pair
      in the retained window"). The member keeps the brief's name ``released_only_chains``, but its count
      is the ``pre-v3`` class of ``classify_chain``, which the brief's sentence misdescribes: a pre-v3 chain
      has no retained ``admission-enqueued`` row and at least one ``admission-admitted`` or
      ``admission-released`` row, so an admitted->released pair without its enqueue counts. The note states
      the classifier's rule exactly instead: at most one terminal row and no eviction row; an enqueue-less
      chain of withdrawn rows only is unclassified; an enqueue-less chain whose one terminal row is an
      eviction is ``lease-evicted`` or ``ticket-evicted``; a chain with more than one terminal row is
      unclassified. ``classify_chain`` itself is unchanged.
  16. ``ts_adapter`` reads "run-3 Ruling 7 non-trigger" where run-3b wrote a bare "Ruling 7": the ruling is
      the run-3 corpora design grill's TS adapter non-trigger (exploration DECISIONS), and the bare form
      could be read as P1 Ruling 7 (the 2026-10-06 build sitting's originKey ruling, item 14).
"""
from __future__ import annotations

import argparse
import collections
import contextlib
import contextvars
import dataclasses
import datetime as dt
import functools
import hashlib
import json
import math
import os
import pwd
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Callable, NoReturn, TypeAlias
from urllib.parse import quote, urlsplit

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


# Run-4: scheduler and journal writers name staging siblings after the writer process
# (QualityScheduler.ts stagingTemporaryPath: <target>.tmp-<pid>[-<hex start identity>]-<uuid>;
# AdmissionJournal.ts .tombstone-<pid>-<uuid> and .stage-<pid>-<uuid>; JournalFile.ts .staging-<pid>-<uuid>).
UUID_AHEAD = r"(?=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
STAGING_TMP_SUFFIX = re.compile(r"\.tmp-\d+(?:-[0-9a-f]+)?-" + UUID_AHEAD)
STAGING_SIBLING_SUFFIX = re.compile(r"\.(stage|staging|tombstone)-\d+-" + UUID_AHEAD)


@functools.lru_cache(maxsize=4)
def hostname_forms(hostname: str) -> tuple[str, ...]:
    """Full digests before 12-hex prefixes, of the raw and lowercased name, then the name itself."""
    if not hostname:
        return ()
    digests = [sha256(form.encode()) for form in dict.fromkeys((hostname, hostname.lower()))]
    return (*digests, *(digest[:12] for digest in digests), hostname)


@functools.lru_cache(maxsize=4)
def _hostname_patterns(hostname: str) -> tuple[re.Pattern[str], ...]:
    return tuple(re.compile(re.escape(form), re.IGNORECASE) for form in hostname_forms(hostname))


# Ordinary verify replays redaction idempotence with the hostname pass off: a verifier's own host name
# ("main", "build", "ci") must never fail an intact pin. Capture keeps the pass and scan_capture_only refuses
# any surviving form.
HOSTNAME_PASS = contextvars.ContextVar("hostname_pass", default=True)


def hostname_patterns() -> tuple[re.Pattern[str], ...]:
    """Case-insensitive replacement patterns for this host's name and its digests (none while verify replays)."""
    return _hostname_patterns(socket.gethostname()) if HOSTNAME_PASS.get() else ()


@contextlib.contextmanager
def host_independent_redaction():
    """Turn the hostname pass off for one replay; the capture-host classes belong to scan_capture_only."""
    token = HOSTNAME_PASS.set(False)
    try:
        yield
    finally:
        HOSTNAME_PASS.reset(token)


def redact_string(value: str, aliases: dict[str, str] | None = None) -> str:
    for prefix, token in sorted((aliases or {}).items(), key=lambda item: -len(item[0])):
        value = redact_host_root(value, re.escape(prefix), token)
    value = redact_host_root(value, re.escape("~/.beep/runtime"), "<runtime-root>")
    value = re.sub(r"-\d+(?=\.(?:lease|ticket)\.json)", "-<process>", value)
    value = re.sub(r"merged-preview-\d+", "merged-preview-<process>", value)
    value = STAGING_TMP_SUFFIX.sub(".tmp-<process>-", value)
    value = STAGING_SIBLING_SUFFIX.sub(r".\1-<process>-", value)
    value = redact_host_root(value, r"/run/user/\d+", "<runtime>")
    value = redact_host_root(value, r"/proc/\d+", "<proc>/<process>")
    value = re.sub(r"(user(?:-runtime-dir)?@)\d+(\.service)", r"\1<uid>\2", value)
    value = re.sub(r"user-\d+\.slice", "user-<uid>.slice", value)
    for prefix, replacement in host_prefixes():
        value = redact_host_root(value, re.escape(prefix), replacement)
    for pattern in hostname_patterns():
        value = pattern.sub("<host>", value)
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


def migrate_custody_census(manifest: dict[str, Any]) -> dict[str, Any] | None:
    """Mark historical security replays whose variants cannot be recovered from bytes."""
    if manifest.get("custody", {}).get("variant_source") == "ownerRefVariant":
        return None
    def migrate_counts(value: Any) -> None:
        if isinstance(value, dict):
            counts = value.get("redaction_counts")
            if isinstance(counts, dict):
                for key in list(counts):
                    if key == "owner_refs_without_proc_start":
                        counts["owner_refs_without_start"] = counts.pop(key)
                    elif key.startswith("dropped_") and not key.endswith("_count"):
                        counts["dropped_member_" + key.removeprefix("dropped_") + "_count"] = counts.pop(key)
            for child in value.values():
                migrate_counts(child)
        elif isinstance(value, list):
            for child in value:
                migrate_counts(child)
    migrate_counts(manifest)
    migration = {"legacy": True, "reason": "source capture predates payload-bound custody variants"}
    manifest.setdefault("custody", {})["census_migration"] = migration
    return migration


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


def login_tokens() -> tuple[bytes, ...]:
    """The capturing login name and the sanitized forms a branch-derived runId would carry (lowercased)."""
    try:
        name = pwd.getpwuid(os.getuid()).pw_name
    except (KeyError, OSError):
        return ()
    if not name:
        return ()
    name = name.lower()
    forms = [f"home_{name}"]
    if len(name) >= 3:
        # A one- or two-letter name would match ordinary words; the sanitized home form still binds it.
        forms += [name, f"{name}_"]
    return tuple(form.encode() for form in forms)


# The knowledge-refs gate's machine-local tree anchor (Knowledge.refs.ts MACHINE_TREE_NAME), refused in any case.
MACHINE_TREE_NAME = b"yeebois"
# Scan-side right boundary also stops at a backslash, so JSON-escaped and escaped-newline forms are caught.
SCAN_RIGHT_BOUNDARY = r"(?=/|$|[\s\"'=,:;)\]\\])"
PROVIDER_CREDENTIAL = re.compile(
    rb"(?:(?<![A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{20,}|xox[a-z]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16}"
    rb"|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?<![A-Za-z0-9])gh[opsur]_[A-Za-z0-9]{30,}|(?<![A-Za-z0-9])ops_eyJ"
    rb"|(?<![A-Za-z0-9])(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{35}|(?<![A-Za-z0-9])glpat-[A-Za-z0-9_-]{10,}"
    rb"|(?<![A-Za-z0-9])npm_[A-Za-z0-9]{36}|(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}"
    rb"|(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})")
CREDENTIAL_ASSIGNMENT = re.compile(
    rb"(?i)(?:authorization[\" ]*[:=]\s*[\"]?bearer\s+\S+"
    rb"|(?:password|api[_-]?key|access[_-]?token|secret)[\" ]*[:=]\s*[\"]?[A-Za-z0-9+/=_-]{16,}"
    rb"|(?<![A-Za-z0-9])[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|_KEY)\s*[:=]\s*[^\s\"',;]{16,})")
PLURAL_PROCESS_MEMBER = re.compile(r"(?:(?i:pids|pid[_-]?list)|[A-Za-z0-9_-]*[a-z0-9](?:Pids|PIDS)|[A-Za-z0-9_-]+[_-](?i:pids))")
UID_CONTEXT = re.compile(rb"(?i)(?<![A-Za-z0-9])(?:e?uid|gid|user_?id)[\"' ]*[=:][\"' ]*\d+")


def scan_output_bytes(files: list[tuple[str, bytes]]) -> None:
    """Fail closed without printing matched private bytes (including path names).

    Host-independent classes only; the classes that depend on the capturing host (hostname and its
    digests, login name, observed host paths, excluded labels) live in ``scan_capture_only`` so a
    verifier's own host or login name never fails ordinary verify.
    """
    roots = {prefix for prefix, _ in host_prefixes()} | {"/home", "/tmp", "/run/user", "/proc", "/dev/shm", "~/.beep/runtime"}
    host_paths = [re.compile(pattern.encode()) for prefix in roots for pattern in (
        uri_host_root_pattern(re.escape(prefix)),
        PATH_LEFT_BOUNDARY + re.escape(prefix) + SCAN_RIGHT_BOUNDARY,
    )]
    for _label, data in files:
        combined = _label.encode() + b"\n" + data
        folded = combined.lower()
        unescaped = combined.replace(b"\\/", b"/")  # JSON-escaped slashes
        if any(pattern.search(combined) or pattern.search(unescaped) for pattern in host_paths):
            fail("residue scan failed: host path")
        # The encoded session-directory form starts a path component (its leading slash became a dash).
        if re.search(rb"(?<![A-Za-z0-9])-home-", combined) or b"~/" in combined or re.search(rb"\$\{?HOME\}?/", combined):
            fail("residue scan failed: encoded home marker or home-relative path")
        if MACHINE_TREE_NAME in folded or re.search(rb"<home>/(?!\.)", combined):
            fail("residue scan failed: machine tree name or home subtree outside a dot directory")
        if re.search(rb"<fleet>/(?!beep-effect)", combined):
            fail("residue scan failed: fleet path outside the beep-effect checkouts")
        if UID_CONTEXT.search(combined):
            fail("residue scan failed: numeric user identity member")
        if re.search(rb"(?:user(?:-runtime-dir)?@\d+\.service|user-\d+\.slice|\buid-\d+)", combined):
            fail("residue scan failed: user identity in runtime or unit name")
        if re.search(rb"(?i)(?:merged[_-]?preview[_-]?\d|-\d+\.(?:lease|ticket)\.json|\.(?:tmp|stage|staging|tombstone)-\d)", combined):
            fail("residue scan failed: process identity in state, staging or preview filename")
        # Consume whole JSON strings so member-like text inside a VALUE is never a key.
        members = [] if _label.endswith(".properties") else [
            json.loads(match[1]) for match in re.finditer(rb'("(?:\\.|[^"\\\r\n])*")\s*(:)?', data) if match[2]]
        properties = [match[1].decode() for match in re.finditer(rb"(?m)^[ \t]*([^\s=]+)[ \t]*=", data)]
        if any(process_member(key) or PLURAL_PROCESS_MEMBER.fullmatch(key) for key in members + properties):
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
        if PROVIDER_CREDENTIAL.search(combined):
            fail("residue scan failed: provider credential or private key")
        if CREDENTIAL_ASSIGNMENT.search(combined):
            fail("residue scan failed: credential assignment")


def scan_capture_only(files: list[tuple[str, bytes]], deny: tuple[bytes, ...] | list[bytes] | set[bytes] = (),
                      deny_patterns: tuple[re.Pattern[bytes], ...] | list[re.Pattern[bytes]] = ()) -> None:
    """Capture-host classes: the hostname with its full digests and 12-hex prefixes (raw or lowercased name,
    any case), the login name (any case), the exact raw host paths this capture saw, and the redacted labels
    of excluded checkouts. Never persisted and never run by ordinary verify."""
    host_forms = tuple(form.lower().encode() for form in hostname_forms(socket.gethostname()))
    login = login_tokens()
    denied = tuple(token for token in deny if token)
    for _label, data in files:
        combined = _label.encode() + b"\n" + data
        folded = combined.lower()
        if any(token in folded for token in host_forms):
            fail("residue scan failed: hostname or hostname digest")
        if any(token in folded for token in login):
            fail("residue scan failed: login name")
        if any(token in combined for token in denied):
            fail("residue scan failed: capture-observed host path")
        if any(pattern.search(combined) for pattern in deny_patterns):
            fail("residue scan failed: excluded checkout label")


def strict_object(data: bytes) -> dict[str, JsonValue]:
    """Classified parse failure, with no source bytes in diagnostics."""
    try:
        value = decode_json(data, "source")
    except (SystemExit, ValueError, UnicodeError):
        raise ValueError("invalid-json") from None
    if not isinstance(value, dict):
        raise ValueError("non-object")
    return value


GIT_SCRUBBED_ENV = ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY",
                    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE", "GIT_REPLACE_REF_BASE")
CORPUS_REF = "refs/remotes/origin/main"
OBJECT_ID = re.compile(r"[0-9a-f]{40}(?:[0-9a-f]{24})?")
CITATION_REPLAY = ("tree-pinned against corpus_tree (graduation Ruling 8, P1 Ruling 4); "
                   "current-tree resolution advisory")


def git_run(*args: str) -> subprocess.CompletedProcess:
    """Run git plumbing against REPO_ROOT: no optional locks, replace refs or lazy fetch; stderr withheld."""
    env = {key: value for key, value in os.environ.items() if key not in GIT_SCRUBBED_ENV}
    try:
        return subprocess.run(["git", "--no-optional-locks", "--no-replace-objects", "--no-lazy-fetch",
                               "-C", str(REPO_ROOT), *args], env=env, capture_output=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        fail("git probe failed: " + " ".join(args[:1]) + " (stderr withheld)")


def git(*args: str) -> str:
    completed = git_run(*args)
    if completed.returncode:
        fail("git probe failed: " + " ".join(args) + " (stderr withheld)")
    return completed.stdout.decode("utf-8").strip()


def probe_corpus() -> dict[str, str]:
    """Bind the fetched origin/main commit and tree once, before any observation read (P1 Ruling 4)."""
    if git_run("rev-parse", "--verify", "--quiet", CORPUS_REF + "^{commit}").returncode:
        fail("refs/remotes/origin/main is absent; fetch origin before capturing")
    probe = {"corpus_commit": git("rev-parse", "--verify", CORPUS_REF + "^{commit}"),
             "corpus_tree": git("rev-parse", "--verify", CORPUS_REF + "^{tree}"),
             "corpus_base": git("merge-base", "HEAD", CORPUS_REF),
             "corpus_ref": "origin/main",
             "capture_head": git("rev-parse", "--verify", "HEAD^{commit}")}
    for key in ("corpus_commit", "corpus_tree", "corpus_base", "capture_head"):
        if not OBJECT_ID.fullmatch(probe[key]):
            fail("git probe returned a non-object id for " + key)
    return probe


class TreeReader:
    """Blob reads at one recorded tree; a missing path reads as None, never as working-tree bytes."""

    def __init__(self, tree: str) -> None:
        if not isinstance(tree, str) or not OBJECT_ID.fullmatch(tree):
            fail("corpus_tree is not an object id")
        self.tree = tree
        self.cache: dict[str, bytes | None] = {}

    def read(self, file: str) -> bytes | None:
        safe_relative_path(file)
        if file not in self.cache:
            completed = git_run("cat-file", "blob", f"{self.tree}:{file}")
            self.cache[file] = None if completed.returncode else completed.stdout
        return self.cache[file]

    def blob_absent(self, file: str) -> bool:
        """The tree names the path but its blob is not in this object store (a partial clone)."""
        return git_run("rev-parse", "--verify", "--quiet", f"{self.tree}:{file}").returncode == 0


def needle_lines(data: bytes, needle: str) -> list[int] | None:
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError:
        return None
    return [number for number, line in enumerate(lines, 1) if needle in line]


def tree_cite(reader: TreeReader, file: str, needle: str, occurrence: int | None = None,
              working: bool = True) -> dict[str, Any]:
    """Cite one line of the corpus_tree blob; at capture the checkout's copy must be byte-equal.

    Verify rebuilds the citation tables with ``working=False`` (tree bytes only) and compares them.
    """
    blob = reader.read(file)
    if blob is None:
        fail("source citation file missing from corpus_tree: " + file)
    matches = needle_lines(blob, needle)
    if matches is None:
        fail("source citation file is not UTF-8: " + file)
    if not matches:
        fail("source citation anchor missing: " + file)
    if occurrence is None and len(matches) > 1:
        fail("source citation anchor ambiguous: " + file)
    if occurrence is not None and (type(occurrence) is not int or not 1 <= occurrence <= len(matches)):
        fail("source citation occurrence out of range: " + file)
    target = REPO_ROOT / file
    if working and (target.is_symlink() or not target.is_file() or target.read_bytes() != blob):
        fail("cited file differs from corpus_tree; merge origin/main into the capturing checkout: " + file)
    citation = {"file": file, "line": matches[(occurrence or 1) - 1], "needle": needle, "sha256": sha256(blob)}
    if occurrence is not None:
        citation["occurrence"] = occurrence
    return citation


Cite: TypeAlias = Callable[..., dict[str, Any]]


def fact(cite: Cite, value: Any, file: str, needle: str, occurrence: int | None = None) -> dict[str, Any]:
    return {"value": value, "source": cite(file, needle, occurrence)}


def repository_citations(manifest: Any) -> list[dict[str, Any]]:
    """Every {file, line} dict whose file is not an angle-bracket fleet descriptor."""
    found: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if "file" in value and "line" in value and not (isinstance(value["file"], str) and value["file"].startswith("<")):
                found.append(value)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(manifest)
    return found


def citation_problem(citation: dict[str, Any], read: Callable[[str], bytes | None], hashes: bool) -> str | None:
    """First failing reason for one citation, or None (the verify_run3_citations.py check order)."""
    file = citation.get("file")
    try:
        safe_relative_path(file)
    except SystemExit:
        return "unsafe path"
    data = read(file)
    if data is None:
        return "file missing"
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError:
        return "file not UTF-8"
    line, needle = citation.get("line"), citation.get("needle")
    if type(line) is not int or not 1 <= line <= len(lines):
        return "line out of range"
    if not isinstance(needle, str) or not needle or needle not in lines[line - 1]:
        return "needle differs"
    if "occurrence" in citation:
        occurrence = citation["occurrence"]
        matches = [number for number, text in enumerate(lines, 1) if needle in text]
        if type(occurrence) is not int or not 1 <= occurrence <= len(matches) or matches[occurrence - 1] != line:
            return "occurrence differs"
    if hashes and citation.get("sha256") != sha256(data):
        return "sha256 differs"
    return None


def current_tree_read(file: str) -> bytes | None:
    target = REPO_ROOT / file
    if target.is_symlink() or not target.is_file():
        return None
    return target.read_bytes()


def verify_tree_citations(manifest: dict[str, Any]) -> tuple[TreeReader, dict[str, int]]:
    """Gating replay against corpus_tree; current-tree and corpus_base results are advisory counts."""
    commit, tree, base = (manifest.get(key) for key in ("corpus_commit", "corpus_tree", "corpus_base"))
    if not all(isinstance(value, str) and OBJECT_ID.fullmatch(value) for value in (commit, tree, base)):
        fail("corpus_commit, corpus_tree or corpus_base is not an object id")
    kind = git_run("cat-file", "-t", tree)
    if kind.returncode or kind.stdout.strip() != b"tree":
        fail(f"corpus_tree object is absent; run: git fetch origin {commit}")
    advisories = {"citations_checked": 0, "current_tree_citation_failures": 0, "corpus_commit_absent": 0,
                  "origin_main_absent": 0, "corpus_base_not_ancestor_of_origin_main": 0}
    if git_run("rev-parse", "--verify", "--quiet", commit + "^{commit}").returncode == 0:
        if git("rev-parse", "--verify", commit + "^{tree}") != tree:
            fail("corpus_commit root tree differs from corpus_tree")
    else:
        advisories["corpus_commit_absent"] = 1
    reader = TreeReader(tree)
    citations = repository_citations(manifest)
    if not citations:
        fail("no repository citations found")
    for citation in citations:
        problem = citation_problem(citation, reader.read, True)
        if problem is not None:
            file = citation.get("file")
            if problem == "file missing" and reader.blob_absent(file):
                fail(f"source citation blob absent from this clone (partial clone?); run: git fetch origin {commit}: " + file)
            fail(f"source citation fails in corpus_tree ({problem}): " + (file if isinstance(file, str) else "<non-string>"))
        if citation_problem(citation, current_tree_read, False) is not None:
            advisories["current_tree_citation_failures"] += 1
    advisories["citations_checked"] = len(citations)
    if git_run("rev-parse", "--verify", "--quiet", CORPUS_REF + "^{commit}").returncode:
        advisories["origin_main_absent"] = 1
    elif git_run("merge-base", "--is-ancestor", base, CORPUS_REF).returncode:
        advisories["corpus_base_not_ancestor_of_origin_main"] = 1
    return reader, advisories


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
    for entry in emitted:
        check_emitted_path(entry.path)
    manifest = {"schema_version": manifest_schema(population), "generated_by": SCRIPT.name,
                "generator_sha256": sha256(SCRIPT.read_bytes()), **metadata,
                "projection_rules": PROJECTION_RULES, "redaction_rules": REDACTION_RULES,
                "files": [{**entry.receipt, "bytes": len(entry.data), "sha256": sha256(entry.data)} for entry in emitted],
                "integrity": INTEGRITY, "verification": VERIFICATION,
                "totals": {"payload_files": len(emitted), "files_emitted": len(emitted) + 1,
                           "events": sum(e.receipt["event_count"] for e in emitted if e.receipt["kind"] != PROJECTION_KIND),
                           "payload_bytes": sum(len(e.data) for e in emitted), "bytes_emitted": 0}}
    if tuple(manifest) != MANIFEST_KEYS:
        fail("manifest member order differs from MANIFEST_KEYS")
    for _ in range(12):
        data = (f"# GENERATED by {SCRIPT.name}; do not hand-edit.\n"
                "# Public run-4 Stage C capture; source descriptors are portable.\n"
                + yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True, width=100)).encode()
        total = manifest["totals"]["payload_bytes"] + len(data)
        if manifest["totals"]["bytes_emitted"] == total:
            return data
        manifest["totals"]["bytes_emitted"] = total
    fail("manifest byte total did not reach a fixed point")


def check_manifest_shape(manifest: dict[str, Any]) -> None:
    """One actionable message for a manifest whose top-level members differ from the schema."""
    keys = list(manifest)
    if keys != list(MANIFEST_KEYS):
        detail = next((key for key in MANIFEST_KEYS if key not in manifest), None) \
            or next((key for key in keys if key not in MANIFEST_KEYS), None) or "member order"
        fail("manifest shape differs: " + (detail if isinstance(detail, str) and re.fullmatch(r"[A-Za-z0-9_ ]{1,64}", detail)
                                           else "<unnamed member>"))


def verify_output_tree(root: Path, population: str) -> dict[str, Any]:
    """Verify pinned bytes and tree-pinned citations; git object reads only, no fleet, export, snapshot payload or salt."""
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
    check_manifest_shape(manifest)
    try:
        return verify_pinned(root, population, manifest, manifest_bytes)
    except (KeyError, TypeError, IndexError, AttributeError) as exc:
        name = exc.args[0] if isinstance(exc, KeyError) and exc.args else None
        detail = name if isinstance(name, str) and re.fullmatch(r"[A-Za-z0-9_]{1,64}", name) else type(exc).__name__
        fail("manifest shape differs: " + detail)


def verify_pinned(root: Path, population: str, manifest: dict[str, Any], manifest_bytes: bytes) -> dict[str, Any]:
    verify_fields(manifest, {"generated_by": SCRIPT.name, "stage": "C", "provenance": "organic",
                             "corpus_ref": "origin/main", "citation_replay": CITATION_REPLAY}, "manifest identity")
    if not isinstance(manifest.get("capture_head"), str) or not OBJECT_ID.fullmatch(manifest["capture_head"]):
        fail("capture_head is not an object id")
    reader, advisories = verify_tree_citations(manifest)
    if manifest.get("generator_lineage") != generator_lineage(reader.read):
        fail("generator lineage differs from corpus_tree")
    if manifest.get("join_key_census") != deployed_join_keys(reader.read):
        fail("deployed join-key census differs from corpus_tree")
    # Rebuild the citation tables from tree bytes alone: a cited value, needle choice or prose edit fails.
    tree_only = functools.partial(tree_cite, reader, working=False)
    for key, build in (("source_facts", source_facts), ("known_loss_classes", known_losses), ("join_keys", join_keys),
                       ("rulings", ruling_citations), ("admission_kind_note", admission_kind_note)):
        if manifest[key] != build(tree_only):
            fail(f"{key} differs from the tables rebuilt at corpus_tree")
    for key, value in POLICY_MEMBERS.items():
        if manifest[key] != value:
            fail(f"{key} differs from the generator's policy text")
    snapshot = verify_queue_d(manifest, reader)
    receipts = manifest["files"]
    paths = [safe_relative_path(r["path"]).as_posix() for r in receipts]
    if paths != sorted(set(paths)):
        fail("manifest paths duplicated or unordered")
    for path in paths:
        check_emitted_path(path)
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
            with host_independent_redaction():
                replayed = redact(row, None, collections.Counter(), True)
            if not same_json(row, replayed):
                fail("persisted raw payload is not redaction-idempotent")
            try:
                validate_envelope(row, receipt["kind"])
            except ValueError:
                fail("unsupported pinned record envelope")
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
    verify_census(manifest, raw, snapshot)
    return {**expected, "advisories": advisories}


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


def discovered_kind(path: Path) -> str:
    return "clone" if (path / ".git").is_dir() else "linked-worktree"


PUBLIC_ORIGIN = "github.com/beep-effect/beep-effect"
EXCLUSION_REASONS = ("non_public_origin", "missing_origin", "unreadable_git_metadata")
CHECKOUT_LAYOUTS = ("fleet-root", "worktrees-dir", "claude-worktrees")


def git_common_dir(checkout: Path) -> Path:
    """Filesystem-only resolution: a .git directory, else gitdir: then commondir (time-to-certainty ruling 71)."""
    marker = checkout / ".git"
    if marker.is_dir():
        return marker
    lines = marker.read_text(encoding="utf-8").splitlines()
    first = lines[0].strip() if lines else ""
    if not first.startswith("gitdir:") or not first[len("gitdir:"):].strip():
        raise ValueError("gitfile without gitdir line")
    gitdir = Path(os.path.normpath(os.path.join(checkout, first[len("gitdir:"):].strip())))
    commondir = gitdir / "commondir"
    if commondir.is_file():
        return Path(os.path.normpath(os.path.join(gitdir, commondir.read_text(encoding="utf-8").strip())))
    return gitdir


def origin_url(config: str) -> str | None:
    """The first url line of the [remote "origin"] section, INI-style, tolerant of tabs and spaces."""
    in_origin = False
    for raw in config.splitlines():
        line = raw.strip()
        if not line or line[0] in "#;":
            continue
        if line.startswith("["):
            in_origin = re.fullmatch(r'\[\s*remote\s+"origin"\s*\]', line) is not None
            continue
        match = re.fullmatch(r"url\s*=\s*(.*)", line) if in_origin else None
        if match and match[1].strip():
            return match[1].strip()
    return None


def canonical_origin(url: str) -> str | None:
    """Canonical host/owner/repo for scp-form or URL-form origins; host lowercased, .git and slashes stripped."""
    value = url.strip().strip('"')
    if "://" in value:
        parts = urlsplit(value)
        host, path = parts.hostname, parts.path
    else:
        scp = re.fullmatch(r"(?:[^@/\s]+@)?([^/\s:]+):(.+)", value)
        if scp is None:
            return None
        host, path = scp[1], scp[2]
    if not host:
        return None
    path = path.strip("/")
    if path.endswith(".git"):
        path = path[:-len(".git")]
    path = path.strip("/")
    return f"{host.lower()}/{path}" if path else None


def origin_exclusion(checkout: Path) -> str | None:
    """None admits the checkout; otherwise the exclusion reason. Never spawns git."""
    try:
        config = (git_common_dir(checkout) / "config").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError, ValueError):
        return "unreadable_git_metadata"
    url = origin_url(config)
    if url is None:
        return "missing_origin"
    return None if canonical_origin(url) == PUBLIC_ORIGIN else "non_public_origin"


def discover_checkouts(excluded: collections.Counter | None = None, seen: list[Path] | None = None,
                       rejected: list[tuple[str, Path]] | None = None) -> list[tuple[str, Path, str, str]]:
    """Fleet checkouts admitted by the public-origin filter, sorted (label, path, kind, layout) (P1 Ruling 5)."""
    candidates: list[tuple[str, Path, str]] = []
    clones: list[Path] = []
    for path in sorted(FLEET_ROOT.glob("beep-effect*")):
        if path.is_dir() and (path / ".git").exists():
            candidates.append((path.name, path, "fleet-root"))
            if (path / ".git").is_dir():
                clones.append(path)
    for parent in sorted(FLEET_ROOT.glob("*-worktrees")):
        if parent.is_dir():
            for path in sorted(parent.iterdir()):
                if path.is_dir() and (path / ".git").exists():
                    candidates.append((parent.name + "/" + path.name, path, "worktrees-dir"))
    for clone in clones:
        nested = clone / ".claude" / "worktrees"
        if nested.is_dir():
            for path in sorted(nested.iterdir()):
                if path.is_dir() and (path / ".git").exists():
                    candidates.append((f"{clone.name}/.claude/worktrees/{path.name}", path, "claude-worktrees"))
    found = []
    for label, path, layout in candidates:
        if seen is not None:
            seen.append(path)
        reason = origin_exclusion(path)
        if reason is not None:
            if excluded is not None:
                excluded[reason] += 1
            if rejected is not None:
                rejected.append((label, path))
            continue
        safe_relative_path(label)
        found.append((label, path, discovered_kind(path), layout))
    return sorted(found)


def refuse_claude_worktree(checkout: Path) -> None:
    """fleet_root would name <clone>/.claude/worktrees for a Claude-app worktree; refuse that location."""
    if checkout.parent.name == "worktrees" and checkout.parent.parent.name == ".claude":
        fail("refusing to run from a .claude/worktrees checkout; run from a fleet clone or a *-worktrees lane")


def event_census(rows: list[JsonValue]) -> list[dict[str, Any]]:
    counter = collections.Counter((r.get("schemaVersion", "<absent>"), r.get("_tag", "<absent>")) for r in rows)
    return [{"schemaVersion": key[0], "_tag": key[1], "rows": value}
            for key, value in sorted(counter.items())]


OUTPUT_ROOTS = {"fleet": CORPUS_ROOT / "run4-fleet"}
LIVE_FAMILIES = ("leases", "queue", "claims", "quarantine", "promotions")
QUARANTINE_FAMILY = "quarantine"
SYNTHETIC_LABELS = ("contender-a", "dead-lease", "dead-ticket")
SYNTHETIC_SOURCE_LABELS = ("contender-a", "contender-b", "dead-lease", "dead-ticket")
PROTOCOL_SCHEMA = "yeet-admission-protocol/v2"
LIVE_SCHEMAS = {f"yeet-admission-{kind}/v1" for kind in ("lease", "ticket", "reap-claim", "promotion")}
ADMISSION_TAGS = {
    "yeet-admission-journal/v1": {"admission-admitted", "admission-released"},
    "yeet-admission-journal/v2": {"admission-lease-evicted", "admission-ticket-evicted"},
    "yeet-admission-journal/v3": {"admission-enqueued", "admission-withdrawn", "admission-released",
                                  "admission-lease-evicted", "admission-ticket-evicted"},
}
CHAIN_CLASSES = ("win", "withdrawn", "lease-evicted", "ticket-evicted", "in-flight", "pre-v3")
PACKET = "explorations/beep-ci-operational-ontology/"
CORPUS_PATH = PACKET + "ontology/extraction/s4/beep-ci-ops/corpus/"
LINEAGE_GENERATOR = "etl_run3b_fleet_corpus.py"
CANONICAL_LABEL = "canonical"
# Ring caps; each is bound to a cited retention fact whose needle carries the literal value.
ADMITTED_RING_CAP = 200
KNOWN_HISTORY_CAP = ADMITTED_RING_CAP * 3 * 4
TERMINAL_ATTEMPT_CAP = 50
JOIN_KEY_FILES = (YEET + "Verdict.ts", YEET + "AttemptJournal.ts", YEET + "ProofState.ts",
                  REPO_RUN + "AttemptTerminationJournal.ts", REPO_RUN + "RepoRun.models.ts")
JOIN_KEY_ALLOWLIST = ("attemptId", "failedStepId", "id", "parentLaneId", "runId", "stepId", "taskId")
SCHEMA_FIELD = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:S\.|UUID)", re.MULTILINE)
SNAPSHOT_DIR = PACKET + "research/evidence/journal-snapshot-2026-10-01"
SNAPSHOT_PROJECTION = "journal.redacted.ndjson"
SNAPSHOT_SUMS = "SHA256SUMS.txt"
SNAPSHOT_SHA256 = "8cceaf17163669f5ec031624ebcffeeb8ea0c56281f2f1a29180ea7c04134762"
SNAPSHOT_ROWS = 695
SNAPSHOT_CHECK = PACKET + "research/scripts/redact_journal_snapshot.py"
SNAPSHOT_CHECK_COMMAND = "python research/scripts/redact_journal_snapshot.py --check"
SNAPSHOT_LABEL = "snapshot-2026-10-01"
SNAPSHOT_KEY = "journal_snapshot_2026_10_01"
SNAPSHOT_SUM_LINE = re.compile(r"^([0-9a-f]{64})  (.+)$")
QUEUE_D_CLOSED = "Queue D fails closed; no run3b-fleet fallback"
RECONCILED_EXCLUDED_MEMBERS = ("ownerRef", "ownerRefVariant", "checkoutRef", "checkoutRoot")
RAW_HOST_MEMBERS = frozenset(("checkoutRoot", "originKey", "command", "cwd", "repoRoot", "hotPaths"))
ABSOLUTE_PATH_TOKEN = re.compile(r"(?<![A-Za-z0-9_.~/<>-])/[^\s\"'=,;:)\]\\]+")
CUT_INSTANT = "2026-09-28T15:09:38.000Z"
PROOF_STAGES = ("repair-loop", "pre-push", "merged-preview", "hosted")
ABSENT_STAGE = "<absent>"
ORIGIN_KEY_SHAPES = ("hex12", "hex11_prefix", "hex64", "empty")
# P1 Ruling 7 (the width of P1 Ruling 3 as amended): log2(11) = 3.459 bits stays under the 3.5-bit cut.
ORIGIN_KEY_PREFIX_WIDTH = 11
SECRET_SCAN_ENTROPY_CUT = 3.5
ORIGIN_KEY_HEX64 = re.compile(r"[0-9a-f]{64}")
ORIGIN_KEY_HEX12 = re.compile(r"[0-9a-f]{12}")
ORIGIN_KEY_PREFIX = re.compile(r"[0-9a-f]{%d}" % ORIGIN_KEY_PREFIX_WIDTH)
GITIGNORE_TRAP_SEGMENTS = frozenset((".beep", ".claude", "docs", "tmp", "dist", "build", "coverage", "trace",
                                     "__pycache__", "secrets", ".secrets"))
GITIGNORE_TRAP_NAME = re.compile(r".*\.(?:key|pem|p12|pfx|crt|cer|pyc)|\.env(?:\..*)?|credentials\.json|secrets\.json"
                                 r"|service-account.*\.json")
if CORPUS_ROOT != REPO_ROOT / CORPUS_PATH:
    raise SystemExit("refusing: generator is not at its corpus-home path")


def manifest_schema(population: str) -> str:
    return f"beep-ci-ops-run4-{population}-corpus/v1"


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
    if synthetic and len(rows) != observed:
        fail("synthetic source has undecodable rows; every observed row must be retained")
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


def locked_name(name: str) -> bool:
    return ".lock" in name.lower() or name.lower().endswith("lock")


def add_denied(deny: set[bytes], value: Any) -> None:
    """Exact-bytes deny entries: absolute host paths with at least two components (never persisted)."""
    text = str(value)
    if text.startswith("/") and len(PurePosixPath(text).parts) >= 3:
        deny.add(text.encode())


def observe_host_strings(data: bytes, deny: set[bytes]) -> None:
    """Record raw absolute paths carried by host-path members before redaction, for the deny scan only.

    A path that redaction maps to a token never reaches the output; one outside every token root
    survives redaction and the deny scan then fails the capture closed."""
    def harvest(value: Any, inside: bool) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                harvest(child, inside or key in RAW_HOST_MEMBERS)
        elif isinstance(value, list):
            for child in value:
                harvest(child, inside)
        elif inside and isinstance(value, str):
            add_denied(deny, value)
            for token in ABSOLUTE_PATH_TOKEN.findall(value):
                add_denied(deny, token)
    try:
        documents = [json.loads(data)]
    except (json.JSONDecodeError, UnicodeDecodeError):
        documents = []
        for line in data.splitlines():
            try:
                documents.append(json.loads(line))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
    for document in documents:
        harvest(document, False)


def excluded_label_patterns(rejected: list[tuple[str, Path]]) -> tuple[re.Pattern[bytes], ...]:
    """Redacted forms of excluded checkouts (and a fleet-root clone's -worktrees lanes); capture-only."""
    patterns = []
    for label, _ in rejected:
        for form in (label, *((label + "-worktrees",) if "/" not in label else ())):
            patterns.append(re.compile(re.escape(b"<fleet>/" + form.encode()) + rb"(?=$|[/\s\"'\\,;:)\]}=])"))
    return tuple(patterns)


def generator_lineage(read: Callable[[str], bytes | None]) -> list[dict[str, Any]]:
    blob = read(CORPUS_PATH + LINEAGE_GENERATOR)
    if blob is None:
        fail("lineage generator missing from corpus_tree")
    return [{"generator": LINEAGE_GENERATOR, "sha256": sha256(blob),
             "relation": "patterns copied, nothing imported (Stage B Ruling 18)"}]


def deployed_join_keys(read: Callable[[str], bytes | None]) -> dict[str, Any]:
    """Read the deployed id-shaped schema members at corpus_tree; a new writer field is a named failure."""
    observed: set[str] = set()
    for file in JOIN_KEY_FILES:
        data = read(file)
        if data is None:
            fail("join-key schema file missing from corpus_tree: " + file)
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            fail("join-key schema file is not UTF-8: " + file)
        observed.update(key for key in SCHEMA_FIELD.findall(text) if normalized_member(key).endswith("id"))
    joins = sorted(key for key in observed if not process_member(key))
    # Normalized (lowercase) so custody member names never appear in their writer spelling in pinned bytes.
    identities = sorted({normalized_member(key) for key in observed if process_member(key)})
    if joins != sorted(JOIN_KEY_ALLOWLIST):
        new = sorted(set(joins) - set(JOIN_KEY_ALLOWLIST))
        gone = sorted(set(JOIN_KEY_ALLOWLIST) - set(joins))
        fail("deployed join-key set differs from the allowlist; new: " + (", ".join(new) or "none")
             + "; gone: " + (", ".join(gone) or "none"))
    return {"files": list(JOIN_KEY_FILES), "join_keys": joins, "process_identities_normalized": identities,
            "rule": "schema members whose normalized name ends in id; process identities are custody members, the rest are non-process join keys compared with an explicit allowlist"}


def source_facts(cite: Cite) -> dict[str, Any]:
    journal = REPO_RUN + "AdmissionJournal.ts"
    scheduler = REPO_RUN + "QualityScheduler.ts"
    schemas = REPO_RUN + "QualityScheduler.schemas.ts"
    termination = REPO_RUN + "AttemptTerminationJournal.ts"
    facts = {
        "canonical_runtime_root": fact(cite, "<home>/.beep/runtime", REPO_RUN + "RuntimeRoot.ts", "const CANONICAL_RUNTIME_ROOT ="),
        "admission_leaf": fact(cite, "beep-admit-uid-<uid>", REPO_RUN + "RuntimeRoot.ts", 'path.join(choice.root, `beep-admit-uid-'),
        "admission_v1": fact(cite, "yeet-admission-journal/v1", journal, 'schemaVersion: S.Literal("yeet-admission-journal/v1")', 1),
        "admission_v2": fact(cite, "yeet-admission-journal/v2", journal, 'schemaVersion: S.Literal("yeet-admission-journal/v2")', 1),
        "admission_v3": fact(cite, "yeet-admission-journal/v3", journal, 'schemaVersion: S.Literal("yeet-admission-journal/v3")', 1),
        "protocol": fact(cite, PROTOCOL_SCHEMA, journal, "export class AdmissionProtocol extends"),
        "protocol_filename": fact(cite, "protocol.json", journal, "const PROTOCOL_FILE_NAME ="),
        "lease": fact(cite, "yeet-admission-lease/v1", schemas, "export class YeetAdmissionLease extends"),
        "ticket": fact(cite, "yeet-admission-ticket/v1", schemas, "export class YeetAdmissionTicket extends"),
        "lease_claim": fact(cite, "yeet-admission-reap-claim/v1; nested lease custody", schemas, "export class AdmissionLeaseReapClaim extends"),
        "ticket_claim": fact(cite, "yeet-admission-reap-claim/v1; nested ticket custody", schemas, "export class AdmissionTicketReapClaim extends"),
        "claim_sinks": fact(cite, "pending, pending-protocol-off, complete", schemas, "export const AdmissionClaimSinkState ="),
        "promotion": fact(cite, "yeet-admission-promotion/v1; nested ticket and lease custody", schemas, 'schemaVersion: S.Literal("yeet-admission-promotion/v1"),'),
        "promotion_class": fact(cite, "AdmissionPromotionTransition", schemas, "export class AdmissionPromotionTransition extends"),
        "promotion_directory": fact(cite, "promotions", scheduler, 'promotions: path.join(root, "promotions"),'),
        "quarantine_directory": fact(cite, "quarantine", scheduler, 'quarantine: path.join(root, "quarantine"),'),
        "claim_replay": fact(cite, "acknowledge attempt and admission sinks before deleting claim", scheduler, "const processReapClaim ="),
        "attempt_schema": fact(cite, ATTEMPT_SCHEMA, YEET + "AttemptJournal.ts", 'schemaVersion: S.Literal("yeet-attempt-journal/v1")', 1),
        "attempt_lease_termination": fact(cite, "lease-eviction", termination, '"lease-eviction",'),
        "attempt_ticket_termination": fact(cite, "queued-submitter-death", termination, '"queued-submitter-death",'),
        "admitted_retention": fact(cite, ADMITTED_RING_CAP, journal, f"const RETAINED_ADMISSIONS = {ADMITTED_RING_CAP};"),
        "known_history_retention": fact(cite, KNOWN_HISTORY_CAP, journal, "const RETAINED_KNOWN_ROWS = RETAINED_ADMISSIONS * 3 * 4;"),
        "terminal_attempt_retention": fact(cite, TERMINAL_ATTEMPT_CAP, termination, f"const RETAINED_ATTEMPTS = {TERMINAL_ATTEMPT_CAP};"),
        "lease_evicted_v3_heartbeat": fact(cite, "lastHeartbeatAtMillis carried on v3 admission-lease-evicted rows", journal, "lastHeartbeatAtMillis: S.Finite,"),
        # Writer staging siblings name the writer process; redaction keeps the UUID and drops the pid and start identity.
        "staging_tmp_suffix": fact(cite, ".tmp-<process>[-<hex start identity>]-<uuid>", scheduler, "return `${filePath}.tmp-${process.pid}"),
        "staging_tombstone_suffix": fact(cite, ".tombstone-<process>-<uuid>", journal, ".tombstone-${process.pid}-"),
        "staging_stage_suffix": fact(cite, ".stage-<process>-<uuid>", journal, ".stage-${process.pid}-"),
        "staging_journal_suffix": fact(cite, ".staging-<process>-<uuid>", REPO_RUN + "JournalFile.ts", ".staging-${process.pid}-"),
    }
    for tag, symbol in (("admission-enqueued", "AdmissionJournalEnqueued"),
                        ("admission-withdrawn", "AdmissionJournalWithdrawn"),
                        ("admission-released", "AdmissionJournalReleasedV3"),
                        ("admission-lease-evicted", "AdmissionJournalLeaseEvictedV3"),
                        ("admission-ticket-evicted", "AdmissionJournalTicketEvictedV3")):
        facts[tag] = fact(cite, "yeet-admission-journal/v3 deployed", journal, f"export class {symbol} extends")
    return facts


KNOWN_LOSS_CLASSES = (
    ("best-effort journal appends (lock-busy drops)", "journal", "stayed busy; dropping one", 1,
     "best-effort callers can drop; durable reap sinks retry"),
    ("claim-race loser edge", "scheduler", "const createReapClaim =", None,
     "historical loss class mitigated by durable claims and acknowledged sinks; no zero-loss assertion"),
    ("quarantined malformed state is journal-invisible", "scheduler", 'quarantineEntry(directories, entryPath, "undecodable")', None,
     "malformed bytes are excluded and tallied, never emitted raw"),
    ("evictedAtMillis is reap time not death time", "scheduler", "evictedAtMillis: claimedAtMillis", 1,
     "original claim instant, including a later protocol-enabled replay"),
    ("heartbeat carried on v3 lease-evicted rows; still absent on v1/v2 rows", "scheduler", "lastHeartbeatAtMillis: lease.heartbeatAtMillis", None,
     "v3 last heartbeat is an observation, not the owner death instant"),
    ("ring windows", "journal", f"const RETAINED_ADMISSIONS = {ADMITTED_RING_CAP};", None,
     f"{ADMITTED_RING_CAP} admitted transitions and {KNOWN_HISTORY_CAP} known rows per root; {TERMINAL_ATTEMPT_CAP} terminal attempts per branch; active/protected/unknown rows may exceed nominal caps"),
    ("eviction rows deferred while the protocol marker was off", "scheduler", "const PROTOCOL_DEFERRED_REAP_CLAIM_SUFFIX =", None,
     "claims replayed on the first enabled pass; evictedAtMillis is the original claim instant"),
)
RING_WINDOW_CLASS = "ring windows"


def known_losses(cite: Cite) -> list[dict[str, Any]]:
    files = {"journal": REPO_RUN + "AdmissionJournal.ts", "scheduler": REPO_RUN + "QualityScheduler.ts"}
    termination = REPO_RUN + "AttemptTerminationJournal.ts"
    receipts = [{"class": name, "source": cite(files[file], needle, occurrence), "current_source_assessment": assessment}
                for name, file, needle, occurrence, assessment in KNOWN_LOSS_CLASSES]
    # Keyed, never positional: the ring-window extras attach to their class wherever it sits.
    ring = {receipt["class"]: receipt for receipt in receipts}[RING_WINDOW_CLASS]
    ring["known_history_source"] = cite(files["journal"], "const RETAINED_KNOWN_ROWS =")
    ring["attempt_source"] = cite(termination, f"const RETAINED_ATTEMPTS = {TERMINAL_ATTEMPT_CAP};")
    ring["retention_algorithm_source"] = cite(termination, "const unprotectedCapacity =")
    return receipts


def join_keys(cite: Cite) -> dict[str, Any]:
    return {
        "nonce": fact(cite, "ticket -> lease -> admitted -> released/evicted -> agent-run-<nonce>.scope", REPO_RUN + "RunScope.ts", "return `agent-run-"),
        "attemptId": fact(cite, "admission -> attempts; embedded verdict/ledger joins are optional; ledger contents are pinned by run4-ledger", YEET + "ProofFact.ts", "export class ProofProvenance"),
        "claim": fact(cite, "claim -> eviction by nonce; sourcePath basename identifies dead lease/ticket with process segment redacted", REPO_RUN + "QualityScheduler.ts", "const admissionEventForReapClaim ="),
        "claim_filename": fact(cite, "<nonce>-<process>.lease.json or .ticket.json; nonce and suffix retained", REPO_RUN + "QualityScheduler.ts", "const leasePath = path.join(directories.leases,"),
        "runId": fact(cite, "<safe-branch>-<sha12(branch)>", REPO_RUN + "RepoRunArtifacts.ts", "export const repoRunArtifactId = Effect.fn("),
        "branch_sha12": fact(cite, "sha256 UTF-8 branch, lowercase hex first 12", REPO_RUN + "RepoRunArtifacts.ts", "const artifactNameHash ="),
        "originKey": fact(cite, "repo-grain, not a checkout key: the deployed writer emits the 12-hex digest of the canonical repository identity; empty is a real value; older rows may carry a 64-hex digest, written as its first 11 hex characters (P1 Ruling 7); 12-hex and empty values kept verbatim (run-3 Ruling 5, snapshot addendum); shapes censused in origin_key_shapes", YEET + "ArtifactPaths.ts", "artifactNameHash(canonicalRepositoryIdentity(repositoryIdentity))"),
        "parentLaneId": fact(cite, "verdict lane parent; a non-process lane join key (graduation Ruling 8 item 5)", YEET + "Verdict.ts", "parentLaneId: S.optionalKey(S.String),"),
        "id": fact(cite, "verdict lane id", YEET + "Verdict.ts", "    id: S.String,"),
        "failedStepId": fact(cite, "verdict failed step", YEET + "Verdict.ts", "failedStepId: S.optionalKey(S.String),", 1),
        "stepId": fact(cite, "repo step result", REPO_RUN + "RepoRun.models.ts", "stepId: S.String,"),
        "taskId": fact(cite, "turbo plan task", REPO_RUN + "RepoRun.models.ts", "taskId: S.String,"),
        "journal_time": fact(cite, "epoch-millis in journal/ticket/lease", REPO_RUN + "AdmissionJournal.ts", "admittedAtMillis:"),
        "attempt_time": fact(cite, "ISO in attempts", YEET + "AttemptJournal.ts", "recordedAt:", 1),
        "stage_a": {"value": "checkout labels cross-reference run3-checkout-identity and run3-fleet; distinct capture windows, missing matches do not prove absence",
                    "source": cite(PACKET + "DECISIONS.md", "**Ruling 18")},
    }


def ruling_citations(cite: Cite) -> dict[str, Any]:
    decisions = PACKET + "DECISIONS.md"
    return {
        "graduation_sitting": cite(decisions, "## 2026-10-01 — graduation sitting"),
        "graduation_ruling_1": cite(decisions, "**Ruling 1 — C4.1 satisfies the run-4 gate.**"),
        "graduation_ruling_8": cite(decisions, "**Ruling 8 — frozen corpus pins replay against their recorded tree.**"),
        "snapshot_ruling": cite(decisions, "## 2026-10-01 — admission-journal snapshot"),
        "snapshot_addendum": cite(decisions, "**2026-10-01 addendum to the admission-journal snapshot ruling"),
        "snapshot_second_addendum": cite(decisions, "**2026-10-01 second addendum to the admission-journal snapshot ruling"),
        "custody_ruling_11": cite(decisions, "**Ruling 11 — custody surrogate before the pid drop.**"),
        "sibling_ruling_18": cite(decisions, "**Ruling 18"),
        "residue_ruling_22": cite(decisions, "**Ruling 22 — residue law outranks pin immutability"),
        "p1_sitting": "goal ciops-ontology-pipeline, research decisions, 2026-10-05 P1 sitting, Rulings 1-6; named in prose because it is not yet in the origin/main tree",
        "p1_build_sitting": ("goal ciops-ontology-pipeline, research decisions, 2026-10-06 P1 build sitting, the Ruling 3 "
                             "amendment (11-hex ledger key width), Ruling 7 (64-hex originKey written as its first 11 hex "
                             "characters), recorded call (r) (the attempt-start census by stage is a capture-time census "
                             "over ring buffers, and the pinned census governs) and recorded call (s) (the encoded home "
                             "marker is refused only when it starts a path component); named in prose because it is not "
                             "yet in the origin/main tree"),
    }


def queue_d_fail(reason: str) -> NoReturn:
    fail(f"{QUEUE_D_CLOSED}: {reason}")


def snapshot_paths() -> tuple[str, str]:
    return SNAPSHOT_DIR + "/" + SNAPSHOT_PROJECTION, SNAPSHOT_DIR + "/" + SNAPSHOT_SUMS


def parse_snapshot_sums(data: bytes) -> dict[str, str]:
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError:
        queue_d_fail("SHA256SUMS.txt is not UTF-8")
    sums: dict[str, str] = {}
    for line in lines:
        if not line.strip():
            continue
        match = SNAPSHOT_SUM_LINE.fullmatch(line)
        if match is None or match[2] in sums:
            queue_d_fail("SHA256SUMS.txt has a malformed or duplicate line")
        sums[match[2]] = match[1]
    return sums


def snapshot_rows(data: bytes) -> list[dict[str, JsonValue]]:
    try:
        rows = decode_ndjson(data, "snapshot projection")
    except SystemExit:
        queue_d_fail("projection rows do not decode as strict JSON")
    if len(rows) != SNAPSHOT_ROWS:
        queue_d_fail("projection row count differs from the pinned count")
    for row in rows:
        if not isinstance(row, dict):
            queue_d_fail("projection row is not an object")
        try:
            validate_envelope(row, "admission")
        except ValueError:
            queue_d_fail("projection row has an unknown schema or envelope")
    return rows


def snapshot_chains(rows: list[dict[str, JsonValue]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    grouped: dict[str, list[str]] = collections.defaultdict(list)
    for row in rows:
        grouped[row["nonce"]].append(row["_tag"])
    chains, counts = [], collections.Counter()
    for nonce, tags in sorted(grouped.items()):
        classification = classify_chain(tags)
        counts[classification or "unclassified"] += 1
        chains.append({"nonce": nonce, "classification": classification, "tags": tags})
    return chains, {key: counts[key] for key in (*CHAIN_CLASSES, "unclassified")}


def snapshot_section(rows: list[dict[str, JsonValue]], data: bytes, script_sha256: str) -> dict[str, Any]:
    projection, sums = snapshot_paths()
    chains, counts = snapshot_chains(rows)
    low, high = timestamp_bounds([t for row in rows for t in collect_timestamps(row, "snapshot")])
    return {"path": projection, "sha256": sha256(data), "sums_path": sums, "rows": len(rows),
            "events": event_census(rows), "window": {"min": low, "max": high},
            "chain_counts": counts, "chains": chains,
            "check": {"command": SNAPSHOT_CHECK_COMMAND, "exit": 0, "script_sha256": script_sha256},
            "custody": "snapshot-salted ownerRef/checkoutRef; not joinable to this capture's surrogates (per-capture salts)",
            "joins": "nonce and attemptId only",
            "classification_basis": "classify_chain per nonce in file order within this source; never across sources"}


def read_queue_d_snapshot(reader: TreeReader, deny: set[bytes]) -> tuple[dict[str, Any], list[dict[str, JsonValue]]]:
    """Read the committed projection by path and sha256 after --check passes; any miss fails closed."""
    projection, sums_path = snapshot_paths()
    source = REPO_ROOT / projection
    if source.is_symlink() or not source.is_file():
        queue_d_fail("projection is absent or not a regular file")
    sums_file = REPO_ROOT / sums_path
    if sums_file.is_symlink() or not sums_file.is_file():
        queue_d_fail("SHA256SUMS.txt is absent or not a regular file")
    sums = parse_snapshot_sums(sums_file.read_bytes())
    data = source.read_bytes()
    digest = sha256(data)
    if sums.get(SNAPSHOT_PROJECTION) != digest:
        queue_d_fail("projection digest differs from SHA256SUMS.txt")
    if digest != SNAPSHOT_SHA256:
        queue_d_fail("projection digest differs from the pinned constant")
    if reader.read(projection) != data:
        queue_d_fail("projection differs from corpus_tree")
    script_blob = reader.read(SNAPSHOT_CHECK)
    script = REPO_ROOT / SNAPSHOT_CHECK
    if script_blob is None or script.is_symlink() or not script.is_file() or script.read_bytes() != script_blob:
        queue_d_fail("redact_journal_snapshot.py differs from corpus_tree")
    try:
        # Its stdout names local paths: captured and never printed.
        completed = subprocess.run([sys.executable, "-B", str(script), "--check"], cwd=REPO_ROOT / PACKET,
                                   capture_output=True, timeout=120)
    except (OSError, subprocess.TimeoutExpired):
        queue_d_fail("redact_journal_snapshot.py --check did not run")
    if completed.returncode != 0:
        queue_d_fail("redact_journal_snapshot.py --check did not pass")
    rows = snapshot_rows(data)
    try:
        scan_output_bytes([(SNAPSHOT_LABEL, data)])
        scan_capture_only([(SNAPSHOT_LABEL, data)], deny)
    except SystemExit:
        queue_d_fail("projection residue scan failed")
    return snapshot_section(rows, data, sha256(script_blob)), rows


def verify_queue_d(manifest: dict[str, Any], reader: TreeReader) -> list[dict[str, JsonValue]]:
    """Re-read the projection from corpus_tree by path; recompute its census. Never runs --check."""
    inputs = manifest.get("queue_d_inputs")
    if not isinstance(inputs, dict) or list(inputs) != [SNAPSHOT_KEY] or not isinstance(inputs[SNAPSHOT_KEY], dict):
        queue_d_fail("manifest lacks the snapshot input section")
    projection, _ = snapshot_paths()
    data = reader.read(projection)
    if data is None:
        queue_d_fail("projection is absent from corpus_tree")
    if sha256(data) != SNAPSHOT_SHA256:
        queue_d_fail("corpus_tree projection digest differs from the pinned constant")
    script = reader.read(SNAPSHOT_CHECK)
    if script is None:
        queue_d_fail("redact_journal_snapshot.py is absent from corpus_tree")
    rows = snapshot_rows(data)
    if inputs[SNAPSHOT_KEY] != snapshot_section(rows, data, sha256(script)):
        queue_d_fail("snapshot census differs from the corpus_tree projection")
    return rows


def compared_members(row: dict[str, JsonValue]) -> str:
    """Non-surrogate members, with originKey in its written form on both sides."""
    return json.dumps({key: written_origin_key(value) if key == "originKey" else value
                       for key, value in row.items() if key not in RECONCILED_EXCLUDED_MEMBERS},
                      sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def reconcile_sources(live: list[dict[str, JsonValue]], snapshot: list[dict[str, JsonValue]],
                      live_chains: list[dict[str, Any]]) -> dict[str, Any]:
    """Overlap receipt between the live canonical root and the snapshot; joins on nonce only."""
    def by_key(rows: list[dict[str, JsonValue]]) -> dict[tuple[str, str], list[str]]:
        grouped: dict[tuple[str, str], list[str]] = collections.defaultdict(list)
        for row in rows:
            grouped[(row["nonce"], row["_tag"])].append(compared_members(row))
        return grouped
    live_keys, snapshot_keys = by_key(live), by_key(snapshot)
    both = {row["nonce"] for row in live} & {row["nonce"] for row in snapshot}
    identical = conflicts = 0
    for key in sorted(set(live_keys) & set(snapshot_keys)):
        if key[0] not in both:
            continue
        if live_keys[key] == snapshot_keys[key]:
            identical += len(live_keys[key])
        else:
            conflicts += 1
    live_class = {chain["nonce"]: chain["classification"] for chain in live_chains if chain["root"] == CANONICAL_LABEL}
    snapshot_class = {chain["nonce"]: chain["classification"] for chain in snapshot_chains(snapshot)[0]}
    transitions = collections.Counter(
        f"{snapshot_class[nonce] or 'unclassified'}->{live_class.get(nonce) or 'unclassified'}" for nonce in both)
    return {"sources": [CANONICAL_LABEL, SNAPSHOT_LABEL], "nonces_in_both": len(both),
            "rows_identical_on_non_surrogate_members": identical,
            "class_transitions": dict(sorted(transitions.items())), "conflicts": conflicts,
            "compared_members": "every member except ownerRef, ownerRefVariant, checkoutRef and checkoutRoot; originKey in its written form",
            "rule": "chains classified per source, scoped by root and nonce; a conflict is one (nonce, _tag) present in both sources with different compared members; conflicts fail capture closed"}


def assert_organic(raw: dict[str, list[JsonValue]]) -> None:
    """Organic rows never carry the synthetic checkout alias or synthetic provenance."""
    for rows in raw.values():
        if b"<synthetic-checkout:" in encode_ndjson(rows) or any(
                isinstance(row, dict) and row.get("provenance") == "synthetic" for row in rows):
            fail("organic pin carries a synthetic checkout label or synthetic provenance")


ADMISSION_ROOT_BASIS = ("three roots by label: canonical (the runtime root under the operator home), system-tmp (the "
                        "system temp root) and session-tmp (the capturing shell's temp root, listed only when it differs "
                        "from system-tmp); each holds the beep-admit-uid-<uid> leaf; an absent root is recorded absent")
CAPTURE_INSTANT_BASIS = "capture start; files read once over the recorded interval, not an atomic fleet snapshot"
CUSTODY_KEYS = ("rule", "member_rule", "variant_source", "pair_precedence", "other_identity_rule", "owner_refs_by_variant",
                "capture_salt_representation", "salt_policy", "missing_procStart_rule", "missing_procStart_caveat",
                "nested_payloads")
CUSTODY_POLICY = {
    "rule": 'ownerRef = sha12(f"{pid}:{procStart}:{captureSalt}")',
    "member_rule": "identifier tokens: exact pid/ppid, camel Pid boundary, separated pid, start tokens and legacy processId",
    "variant_source": "ownerRefVariant",
    "pair_precedence": ["pid/procstart", "ownerpid/ownerprocstart", "attachedpid/<absent>"],
    "other_identity_rule": "weak variant uses sorted normalized identity-member JSON as the owner component; its first nonempty start member is the start, else <absent>",
    "capture_salt_representation": "hexadecimal encoding of 32 random bytes",
    "salt_policy": "per-capture, unrecorded, unlinkable across captures",
    "missing_procStart_rule": "owner:<absent>:salt; missing, null and empty starts tallied as weaker keys",
    "missing_procStart_caveat": "weak references cannot join full references by ownerRef; nonce remains available",
    "nested_payloads": "each object containing a process identity receives its own ownerRef before member removal; precedence is local to that object"}
QUARANTINE_SEMANTICS = "reaper-quarantined dead leases moved aside by the admission reaper; not live queue or lease state"
WINDOW_NOTE = ("ring-trimmed; released_only_chains counts the pre-v3 chains as classify_chain computes them: no retained "
               "admission-enqueued row and at least one admission-admitted or admission-released row, with at most one "
               "terminal row and no eviction row (admitted->released pairs, admitted-only and released-only chains "
               "alike); an enqueue-less chain of withdrawn rows only is unclassified, an enqueue-less chain whose one "
               "terminal row is an eviction is lease-evicted or ticket-evicted, and a chain with more than one terminal "
               "row is unclassified, so none of these counts; the P2 replay skips the pre-v3 chains instead of failing")
WINDOW_COUNT_BASIS = "released_only_chains is this root's pre-v3 class count in loss_population (no retained enqueue)"
CUT_BASIS = ("committer instant of 9d52d8f587 (#1321), the P1 sitting's cut (named in prose: the goal decisions log "
             "is not yet in the origin/main tree); compared with attempt-started startedAt")
STAGE_CENSUS_BASIS = ("a capture-time census over ring buffers: attempt journals keep a bounded tail, so these counts are "
                      "the starts retained in the pinned files at capture; a count taken over a different file set or at "
                      "a different instant differs, and this pinned census governs (P1 recorded call r)")
STAGE_ROW_BASIS = ("attempt-started rows in the pinned attempt journals, by their stage member (absent on rows written "
                   "before the stage field shipped); a start without startedAt counts in all only")
ADMISSION_KIND_TEXT = ("the admission work kind merged-preview is written by real merged-preview admissions (yeet verify "
                       "--merged) and by any full proof whose steps include the CI-parity step, so admission rows of that "
                       "kind are not merged-preview STAGE activity; the merged-preview STAGE is attempt-started.stage, "
                       "censused in attempt_starts_by_stage; under P1 Ruling 1 a stage without starts since the cut is "
                       "dormant in the capture window, never observed and empty of failures")
ORIGIN_KEY_BASIS = ("every originKey member at any depth of the pinned raw rows, by shape; journal_rows_without_member "
                    "counts admission-journal rows without the member; any other shape fails the capture; 12-hex and empty "
                    "values are kept verbatim (run-3 Ruling 5, snapshot addendum); hex11_prefix counts the 64-hex members "
                    "written as their first 11 hex characters, so pinned rows carry no 64-hex originKey; "
                    "hex64_written_as_prefix records those members and their distinct values, which must equal the "
                    "hex11_prefix census")
ORIGIN_KEY_PREFIX_RULE = ("a 64-hex originKey (written by a checkout on an earlier lock-name derivation) is written as its first "
                          "11 hex characters, under P1 Ruling 7 (the width of P1 Ruling 3 as amended); the hosted Secret "
                          "Scanning generic-api-key rule flags the 64-hex form, and no value of 11 or fewer hex characters "
                          "reaches its 3.5-bit entropy cut; the mapping is injective over the capture, no pinned row carries "
                          "a native 11-hex value, and a prefix never equals a native 11-hex value or the first 11 hex "
                          "characters of a native 12-hex value either source carries, else the capture fails closed; the "
                          "64-hex values are not persisted")
LIVE_STATE_FILENAME_POLICY = ("capture-local ordinals; payload sourcePath retains nonce and lease/ticket suffix with process "
                              "component redacted; quarantine: row i is the i-th file in sorted filename order; file names "
                              "and their ordinal suffixes are not persisted; the nonce they embed is kept as a join key "
                              "(retained_source_lines hold the 1-based file ordinals of retained rows)")
EXCLUDED_SOURCES = ["lock files and sidecars", "symlinks", "proof-locks", "verdict family",
                    "ledger family (contents pinned by run4-ledger)", "checkout identity re-capture", "install roots",
                    "checkouts whose origin is not the public repository (counted by reason, never labelled)",
                    "Queue D snapshot projection bytes (cited by path and sha256, not copied)"]
ABSENCE_POLICY = "zero retained events of a class do not establish that none occurred; every census is retained-window only"
RESIDUE_RULES = [
    "run-3b residue classes over every payload, projection and this manifest",
    "encoded home marker, home-relative tilde-slash and HOME-variable prefixes refused",
    "the knowledge-refs machine tree name (any letter case) and any home subtree other than a dot directory refused",
    "fleet paths whose first component is not a beep-effect checkout refused",
    "writer staging sibling suffixes carrying a pid (tmp, stage, staging, tombstone), merged-preview pid forms in any spelling and plural pid members refused",
    "numeric uid, euid, gid and user id assignments refused",
    "GitHub, 1Password service-account, Stripe, Google, GitLab, npm, Hugging Face, Slack, AWS and JWT credential shapes and TOKEN, SECRET, PASSWORD and _KEY assignments refused",
    "provider sk- prefix requires a boundary before it",
    "host-path scan boundaries also stop at a backslash",
    "emitted path components never match a git-ignored name, so no payload is silently dropped from the commit",
    "capture only, never persisted: the capturing hostname, its full sha256 and its 12-hex prefix, raw or lowercased, in any letter case; the capturing login name (any letter case) and its sanitized branch forms; the exact bytes of every absolute path seen in host-path members; the redacted labels of excluded checkouts",
    "ordinary verify is host-independent: it replays redaction idempotence with the hostname pass off and runs no capture-only class, so a verifier's own host or login name never fails an intact pin",
    "known limits: a bare pid in free text that names no process member, and an absolute path outside every token root inside free text (not a host-path member), are not recognized"]
SYNTHETIC_LABEL_POLICY = {
    "labels": list(SYNTHETIC_SOURCE_LABELS),
    "alias_rule": "<synthetic-checkout:label> replaces a synthetic producer checkout root before generic rewriting",
    "provenance": "synthetic rows carry provenance synthetic and stay in run3b-synthetic; this pin is organic and refuses synthetic tokens",
    "source": "intake docket Stage C clause and PLAN W3 (named in prose; both are edited by the capture pull request)"}
DISCOVERY_RECEIPTS_UNVERIFIABLE = [
    "checkout_counts.excluded: excluded checkouts are never labelled, so these counts cannot be re-derived from pinned bytes",
    "live family excluded_lock_files and excluded_symlinks; quarantine files_observed, vanished_before_read, blank_files and mtime_days (their identities and shapes are checked)",
    "absent, vanished-before-read, excluded and excluded-symlink source statuses, runs_dir_listing entries without a payload, and proof_ledger existence statuses",
    "observed_at, capture_instant and capture_finished_at instants",
    "capture_head (object-id shape only; the capturing lane HEAD can be unreachable after the squash merge)",
    "origin_key_shapes.hex64_written_as_prefix injectivity (the 64-hex values are not persisted; members and distinct_values are recomputed from the pinned hex11_prefix census)"]
TS_ADAPTER = "run-3 Ruling 7 non-trigger (corpora design grill, TS adapter v1.1.0); no TS observations generated"
CHECKOUT_PATH_ENCODING = "UTF-8 percent-encoded single component; checkout labels remain verbatim in receipts"
PROJECTION_RULES = [
    "config_key_value channel: one .properties sibling for every raw payload",
    "# record <zero-based-index>; eligible leaf_key=value in source traversal order",
    "ASCII alphanumeric/underscore keys; nonempty single-line strings, JSON numbers and booleans",
    "null, empty strings and CR/LF values omitted; duplicate pairs and scalar array leaves retained",
    "events count raw JSON records once; projections do not double-count events"]
REDACTION_RULES = [
    "All families: longest host-root match at start, after a character outside ASCII alphanumeric, underscore, dot, tilde, slash and hyphen, or after a slash preceded by slash or colon; relative path continuations survive",
    "URI authority pre-pass preserves scheme and authority, with a slash before the host-root token",
    "fleet root is <fleet>; home is <home>; temp roots are <session-tmp> and <tmp>; runtime is <runtime>; proc is <proc>; shared memory is <shm>",
    "Per-user systemd unit identifiers become <uid>; proc process-directory identifiers become <process>",
    "Process identity members dropped recursively; complete serialized process scalar values replaced",
    "JSON keys and values consume escaped character pairs; nested string serialization retains its depth",
    "Structural keys and non-process numbers, booleans, nulls retain their decoded values",
    "Lock files and proof-locks are excluded; hostname and sha12(hostname) in string values become <host>; residue fails capture",
    "Writer staging sibling suffixes (tmp with an optional hex start identity, stage, staging, tombstone) keep their UUID; the pid becomes <process> and the start identity is dropped",
    "hostname, sha256(hostname) and its 12-hex prefix, of the raw and the lowercased name, become <host> in any letter case",
    "a 64-hex originKey is written as its first 11 hex characters, censused as origin_key_shapes.hex11_prefix (origin_key_shapes.hex64_written_as_prefix); 12-hex and empty values are kept verbatim"]
INTEGRITY = {"algorithm": "sha256", "digest_scope": "all payload files; manifest excluded from its own digest"}
VERIFICATION = {"redaction_compare": "PASS", "projection_compare": "PASS", "residue_scan": "PASS"}
PROOF_LEDGER_BLOCK = {"status": "captured by the run4-ledger sibling pin", "sibling_root": "run4-ledger",
                      "sibling_generator": "etl_run4_proof_ledger.py", "rulings": "graduation Ruling 1; P1 Rulings 1, 2, 3, 6",
                      "observation_basis": "file existence only in this pin; contents are pinned by the sibling"}
MANIFEST_KEYS = (
    "schema_version", "generated_by", "generator_sha256", "generator_lineage", "corpus_commit", "corpus_tree",
    "corpus_base", "corpus_ref", "capture_head", "citation_replay", "capture_instant", "capture_finished_at", "stage",
    "provenance", "capture_instant_basis", "custody", "admission_root_basis", "admission_roots", "checkouts",
    "checkout_counts", "sources", "source_facts", "rulings", "admission_kind_note", "attempt_starts_by_stage",
    "last_merged_preview_start", "origin_key_shapes", "loss_population", "queue_d_inputs", "proof_ledger",
    "known_loss_classes", "join_keys", "join_key_census", "live_state_filename_policy", "excluded_sources",
    "absence_policy", "residue_rules", "synthetic_label_policy", "discovery_receipts_unverifiable", "ts_adapter",
    "checkout_path_encoding", "projection_rules", "redaction_rules", "files", "integrity", "verification", "totals")
# Manifest members that are generator text: verify compares them with these constants.
POLICY_MEMBERS = {
    "capture_instant_basis": CAPTURE_INSTANT_BASIS, "admission_root_basis": ADMISSION_ROOT_BASIS,
    "live_state_filename_policy": LIVE_STATE_FILENAME_POLICY, "excluded_sources": EXCLUDED_SOURCES,
    "absence_policy": ABSENCE_POLICY, "residue_rules": RESIDUE_RULES, "synthetic_label_policy": SYNTHETIC_LABEL_POLICY,
    "discovery_receipts_unverifiable": DISCOVERY_RECEIPTS_UNVERIFIABLE, "ts_adapter": TS_ADAPTER,
    "checkout_path_encoding": CHECKOUT_PATH_ENCODING, "projection_rules": PROJECTION_RULES,
    "redaction_rules": REDACTION_RULES, "integrity": INTEGRITY, "verification": VERIFICATION}


def custody_block(variants: dict[str, int]) -> dict[str, Any]:
    return {key: dict(variants) if key == "owner_refs_by_variant" else CUSTODY_POLICY[key] for key in CUSTODY_KEYS}


def admission_kind_note(cite: Cite) -> dict[str, Any]:
    """Admission kind is not the proof stage (W3-A3, P1 orchestrator note k)."""
    handler = YEET + "Handler.ts"
    return {"text": ADMISSION_KIND_TEXT,
            "merged_preview_admission": cite(handler, "const runWithMergedPreviewAdmission = "),
            "ci_parity_kind": cite(handler, "const kind = A.some(proofSteps, (step) => step.id === CI_PARITY_STEP_ID)"),
            "attempt_stage": cite(handler, "const attemptStageFor = ")}


def stage_census(raw: dict[str, list[JsonValue]]) -> tuple[dict[str, Any], str | None]:
    """Attempt starts by stage, all and since the #1321 cut, from pinned attempt rows only."""
    stages = {stage: {"all": 0, "since_cut": 0} for stage in (*PROOF_STAGES, ABSENT_STAGE)}
    cut = parse_timestamp_scalar("cut", CUT_INSTANT, "stage census cut")
    without, last = 0, None
    for path in sorted(raw):
        if not path.startswith("attempts/"):
            continue
        for row in raw[path]:
            if row.get("_tag") != "attempt-started":
                continue
            stage = row.get("stage", ABSENT_STAGE)
            if not isinstance(stage, str) or stage not in PROOF_STAGES and not (stage == ABSENT_STAGE and "stage" not in row):
                fail("attempt start carries a stage outside the deployed ProofStage vocabulary")
            stages[stage]["all"] += 1
            started = row.get("startedAt")
            moment = parse_timestamp_scalar("startedAt", started, "attempt start") if isinstance(started, str) else None
            if moment is None:
                without += 1
                continue
            stages[stage]["since_cut"] += int(moment >= cut)
            if stage == "merged-preview" and (last is None or moment > last):
                last = moment
    census = {"cut": CUT_INSTANT, "cut_basis": CUT_BASIS, "census_basis": STAGE_CENSUS_BASIS, "row_basis": STAGE_ROW_BASIS,
              "starts_without_started_at": without, "stages": stages}
    return census, None if last is None else format_timestamp(last)


def written_origin_key(value: JsonValue) -> JsonValue:
    """A 64-hex originKey is written as its first 11 hex characters; every other value is kept verbatim."""
    return value[:ORIGIN_KEY_PREFIX_WIDTH] if isinstance(value, str) and ORIGIN_KEY_HEX64.fullmatch(value) else value


def prefix_origin_keys(value: JsonValue, tracker: dict[str, Any]) -> JsonValue:
    """Rewrite every originKey member at any depth; record the 64-hex values and the native 12- and 11-hex ones."""
    if isinstance(value, list):
        return [prefix_origin_keys(child, tracker) for child in value]
    if not isinstance(value, dict):
        return value
    result: dict[str, JsonValue] = {}
    for key, child in value.items():
        if key == "originKey" and isinstance(child, str):
            if ORIGIN_KEY_HEX64.fullmatch(child):
                tracker["hex64"].add(child)
                tracker["members"] += 1
            elif ORIGIN_KEY_HEX12.fullmatch(child):
                tracker["hex12"].add(child)
            elif ORIGIN_KEY_PREFIX.fullmatch(child):
                tracker["hex11"].add(child)
            result[key] = written_origin_key(child)
        else:
            result[key] = prefix_origin_keys(child, tracker)
    return result


def origin_key_tracker() -> dict[str, Any]:
    return {"hex64": set(), "hex12": set(), "hex11": set(), "members": 0}


def check_origin_key_prefixes(tracker: dict[str, Any], snapshot_rows: list[dict[str, JsonValue]]) -> dict[str, Any]:
    """The 11-hex prefix mapping must stay injective and never collide with a native value either source carries."""
    if math.log2(ORIGIN_KEY_PREFIX_WIDTH) >= SECRET_SCAN_ENTROPY_CUT:
        fail("originKey prefix width reaches the secret-scan entropy cut; P1 Ruling 7 pins 11 hex")
    if tracker["hex11"]:
        fail("a native 11-hex originKey is indistinguishable from a written prefix; capture fails closed")
    prefixes = {value[:ORIGIN_KEY_PREFIX_WIDTH] for value in tracker["hex64"]}
    native12, native11 = set(tracker["hex12"]), set()
    for row in snapshot_rows:
        value = row.get("originKey")
        if isinstance(value, str) and ORIGIN_KEY_HEX12.fullmatch(value):
            native12.add(value)
        elif isinstance(value, str) and ORIGIN_KEY_PREFIX.fullmatch(value):
            native11.add(value)
    heads = {value[:ORIGIN_KEY_PREFIX_WIDTH] for value in native12}
    if len(prefixes) != len(tracker["hex64"]) or prefixes & (native11 | heads):
        fail("originKey 11-hex prefix mapping is not injective; capture fails closed")
    return {"members": tracker["members"], "distinct_values": len(prefixes), "rule": ORIGIN_KEY_PREFIX_RULE}


def origin_key_shape(value: JsonValue) -> str:
    if value == "":
        return "empty"
    if isinstance(value, str) and ORIGIN_KEY_HEX12.fullmatch(value):
        return "hex12"
    if isinstance(value, str) and ORIGIN_KEY_PREFIX.fullmatch(value):
        return "hex11_prefix"
    if isinstance(value, str) and ORIGIN_KEY_HEX64.fullmatch(value):
        return "hex64"
    fail("originKey has a shape outside the census vocabulary (hex12, hex11_prefix, hex64, empty)")


def origin_key_census(raw: dict[str, list[JsonValue]]) -> tuple[collections.Counter, int, set[str]]:
    """Shape counts, admission-journal rows without the member, and the distinct written prefixes."""
    shapes = collections.Counter(dict.fromkeys(ORIGIN_KEY_SHAPES, 0))
    prefixes: set[str] = set()

    def visit(value: JsonValue) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "originKey":
                    shape = origin_key_shape(child)
                    shapes[shape] += 1
                    if shape == "hex11_prefix":
                        prefixes.add(child)
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    without = 0
    for path in sorted(raw):
        visit(raw[path])
        if path.startswith("admission/") and path.endswith("/journal.ndjson"):
            without += sum("originKey" not in row for row in raw[path])
    if shapes["hex64"]:
        fail("a 64-hex originKey reached the pinned rows; the capture writes its 11-hex prefix")
    return shapes, without, prefixes


def origin_key_shapes(raw: dict[str, list[JsonValue]], prefixed: dict[str, Any]) -> dict[str, Any]:
    shapes, without, _ = origin_key_census(raw)
    return {**{shape: shapes[shape] for shape in ORIGIN_KEY_SHAPES}, "journal_rows_without_member": without,
            "hex64_written_as_prefix": prefixed, "basis": ORIGIN_KEY_BASIS}


def verify_origin_key_shapes(recorded: Any, raw: dict[str, list[JsonValue]]) -> None:
    """Recompute the shape census from pinned rows; the prefix receipt must equal the hex11_prefix census."""
    prefixed = recorded.get("hex64_written_as_prefix") if isinstance(recorded, dict) else None
    if (not isinstance(prefixed, dict) or list(prefixed) != ["members", "distinct_values", "rule"]
            or any(type(prefixed[key]) is not int or prefixed[key] < 0 for key in ("members", "distinct_values"))
            or prefixed["rule"] != ORIGIN_KEY_PREFIX_RULE):
        fail("originKey shape census differs from pinned rows")
    shapes, _, prefixes = origin_key_census(raw)
    if (recorded != origin_key_shapes(raw, prefixed) or prefixed["members"] != shapes["hex11_prefix"]
            or prefixed["distinct_values"] != len(prefixes)):
        fail("originKey shape census differs from pinned rows")


def root_window(rows: list[JsonValue], chains: list[dict[str, Any]]) -> dict[str, Any]:
    """Retained-row instants and released-only chain count per admission root, for the P2 replay (note m)."""
    low, high = timestamp_bounds([moment for row in rows for moment in collect_timestamps(row, "window")])
    return {"first_retained_row_instant": low, "last_retained_row_instant": high,
            "released_only_chains": sum(chain["classification"] == "pre-v3" for chain in chains),
            "count_basis": WINDOW_COUNT_BASIS, "note": WINDOW_NOTE}


def root_windows(raw: dict[str, list[JsonValue]], census: dict[str, Any], label: str) -> dict[str, Any]:
    return root_window(raw.get(f"admission/{label}/journal.ndjson", []),
                       [chain for chain in census["chains"] if chain["root"] == label])


def check_emitted_path(path: str) -> None:
    """A git-ignored component would drop the payload from the commit without any error."""
    for part in PurePosixPath(path).parts:
        if part in GITIGNORE_TRAP_SEGMENTS or GITIGNORE_TRAP_NAME.fullmatch(part):
            fail("emitted path has a git-ignored component; refusing a payload git would silently drop")


def capture(population: str = "fleet") -> tuple[list[Payload], dict[str, Any], set[bytes], tuple[re.Pattern[bytes], ...]]:
    started = instant()
    # Bind the corpus tree and resolve every citation before the observation interval's file reads.
    probe = probe_corpus()
    reader = TreeReader(probe["corpus_tree"])
    cite = functools.partial(tree_cite, reader)
    lineage = generator_lineage(reader.read)
    facts, losses, joins, rulings = source_facts(cite), known_losses(cite), join_keys(cite), ruling_citations(cite)
    kind_note = admission_kind_note(cite)
    join_census = deployed_join_keys(reader.read)
    deny: set[bytes] = set()
    for path in (FLEET_ROOT, REPO_ROOT, Path.home(), Path(tempfile.gettempdir())):
        add_denied(deny, path)
    snapshot, snapshot_raw = read_queue_d_snapshot(reader, deny)
    admission = admission_sources()
    excluded = collections.Counter(dict.fromkeys(EXCLUSION_REASONS, 0))
    seen: list[Path] = []
    rejected: list[tuple[str, Path]] = []
    discovered = discover_checkouts(excluded, seen, rejected)
    for path in [*seen, *(root for _, root in admission)]:
        add_denied(deny, path)
    deny_patterns = excluded_label_patterns(rejected)
    salt = os.urandom(32)  # Never persist, print, or return this capture-local value.
    emitted, roots, checkouts, source_receipts, raw = [], [], [], [], {}
    provenance = "organic"
    origin_keys = origin_key_tracker()

    def collect(path: Path, destination: str, kind: str, source: str,
                ndjson: bool = True, **metadata: Any) -> dict[str, Any]:
        observed_at = instant()
        if path.is_symlink():
            return complete(source, observed_at, "excluded-symlink")
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            return complete(source, observed_at, "vanished-before-read")
        observe_host_strings(data, deny)
        rows, census = transform_source(data, kind, salt, ndjson)
        rows = prefix_origin_keys(rows, origin_keys)
        if not ndjson and not rows:
            return {**complete(source, observed_at, "excluded"), **census}
        pair = payload_pair(destination, rows, kind, source, observed_at, provenance=provenance, **metadata)
        emitted.extend(pair)
        raw[destination] = rows
        return {"path": destination, **complete(source, observed_at), **census}

    def collect_quarantine(label: str, directory: Path) -> dict[str, Any]:
        """One NDJSON payload per root; row order is sorted file-name order; file names never persisted."""
        descriptor = f"<{label}-admission>/{QUARANTINE_FAMILY}/<state-ndjson>"
        destination = f"live/{label}/{QUARANTINE_FAMILY}/state.ndjson"
        observed_at = instant()
        receipt = {"family": QUARANTINE_FAMILY, "family_semantics": QUARANTINE_SEMANTICS, "ndjson": True,
                   "files_observed": 0, "captured_files": 0, "excluded_lock_files": 0, "excluded_symlinks": 0,
                   "vanished_before_read": 0, "blank_files": 0, "mtime_days": {}}
        if not directory.is_dir():
            return {**receipt, **complete(descriptor, observed_at, "absent")}
        rows, lines, rejected_rows, counts = [], [], collections.Counter(), collections.Counter()
        variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))
        days: collections.Counter = collections.Counter()
        observed = 0
        for path in sorted(directory.iterdir()):
            if path.is_symlink():
                receipt["excluded_symlinks"] += 1
                continue
            if locked_name(path.name):
                receipt["excluded_lock_files"] += 1
                continue
            if not path.is_file():
                continue
            receipt["files_observed"] += 1
            ordinal = receipt["files_observed"]
            try:
                with open(path, "rb") as handle:
                    modified = os.fstat(handle.fileno()).st_mtime
                    data = handle.read()
            except FileNotFoundError:
                receipt["vanished_before_read"] += 1
                continue
            # Counts only, at UTC day grain: no names and no finer instants.
            days[dt.datetime.fromtimestamp(modified, dt.timezone.utc).strftime("%Y-%m-%d")] += 1
            observe_host_strings(data, deny)
            file_rows, census = transform_source(data, "live", salt, False)
            receipt["blank_files"] += int(census["observed_rows"] == 0)
            observed += census["observed_rows"]
            rejected_rows.update(census["excluded_by_reason"])
            counts.update(census["redaction_counts"])
            variants.update(census["owner_refs_by_variant"])
            if file_rows:
                rows.append(prefix_origin_keys(file_rows[0], origin_keys))
                lines.append(ordinal)
        receipt["captured_files"] = len(rows)
        receipt["mtime_days"] = dict(sorted(days.items()))
        census = {"observed_rows": observed, "retained_rows": len(rows), "retained_source_lines": lines,
                  "excluded_undecodable": sum(rejected_rows.values()),
                  "excluded_by_reason": dict(sorted(rejected_rows.items())),
                  "redaction_counts": dict(sorted(counts.items())), "owner_refs_by_variant": dict(variants),
                  "events": event_census(rows)}
        if not rows:
            return {**receipt, **complete(descriptor, observed_at, "excluded"), **census}
        emitted.extend(payload_pair(destination, rows, "live", descriptor, observed_at, provenance=provenance))
        raw[destination] = rows
        return {**receipt, "path": destination, **complete(descriptor, observed_at), **census}

    for label, root in admission:
        root_receipt = {"label": label, "status": "present" if root.is_dir() else "absent",
                        "complete_within": "named admission root at capture", "world": "closed"}
        for filename, kind in (("journal.ndjson", "admission"), ("protocol.json", "protocol")):
            source = f"<{label}-admission>/{filename}"
            path = root / filename
            receipt = collect(path, f"admission/{label}/{filename}", kind, source, filename.endswith(".ndjson")) \
                if path.is_file() else complete(source, instant(), "absent")
            if kind == "admission":
                receipt["ring_window"] = admission_ring(receipt, raw.get(receipt.get("path"), []))
            root_receipt["journal" if kind == "admission" else "protocol"] = receipt
        root_receipt["live"] = []
        for family in LIVE_FAMILIES:
            directory = root / family
            if family == QUARANTINE_FAMILY:
                root_receipt["live"].append(collect_quarantine(label, directory))
                continue
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

    for label, checkout, kind, layout in discovered:
        runs = checkout / ".beep/yeet/runs"
        descriptor_root = f"<fleet>/{label}"
        row = {"checkout": label, "kind": kind, "layout": layout, "runs_dir_listing": [], "attempt_files": 0,
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
                receipt["ring_window"] = attempt_ring(receipt, raw.get(dest, []))
                source_receipts.append(receipt)
        row["runs_directory_status"] = "present" if runs.is_dir() else "absent"
        ledger = checkout / ".beep/yeet/proof-ledger.ndjson"
        row["proof_ledger"] = complete(f"{descriptor_root}/.beep/yeet/proof-ledger.ndjson", instant(),
                                       "present" if ledger.is_file() else "absent")
        checkouts.append(row)

    assert_organic(raw)
    prefixed = check_origin_key_prefixes(origin_keys, snapshot_raw)
    census = loss_population(raw, [label for label, _ in admission])
    census["reconciliation"] = reconcile_sources(raw.get(f"admission/{CANONICAL_LABEL}/journal.ndjson", []),
                                                 snapshot_raw, census["chains"])
    if census["reconciliation"]["conflicts"]:
        fail("cross-source reconciliation found conflicting rows; capture fails closed")
    for root_receipt in roots:
        root_receipt["window"] = root_windows(raw, census, root_receipt["label"])
    starts, last_merged_preview = stage_census(raw)
    custody_variants = collections.Counter(dict.fromkeys(OWNER_VARIANTS, 0))
    for receipt in [*source_receipts, *(r[field] for r in roots for field in ("journal", "protocol")),
                    *(s for r in roots for live in r["live"] for s in live_sources(live))]:
        custody_variants.update(receipt.get("owner_refs_by_variant", {}))
    return emitted, {
        "generator_lineage": lineage, **probe, "citation_replay": CITATION_REPLAY,
        "capture_instant": started, "capture_finished_at": instant(), "stage": "C", "provenance": provenance,
        "capture_instant_basis": CAPTURE_INSTANT_BASIS, "custody": custody_block(custody_variants),
        "admission_root_basis": ADMISSION_ROOT_BASIS,
        "admission_roots": roots, "checkouts": checkouts,
        "checkout_counts": checkout_counts(checkouts, excluded),
        "sources": source_receipts, "source_facts": facts, "rulings": rulings,
        "admission_kind_note": kind_note, "attempt_starts_by_stage": starts,
        "last_merged_preview_start": last_merged_preview, "origin_key_shapes": origin_key_shapes(raw, prefixed),
        "loss_population": census, "queue_d_inputs": {SNAPSHOT_KEY: snapshot},
        "proof_ledger": proof_ledger_block(checkouts),
        "known_loss_classes": losses, "join_keys": joins, "join_key_census": join_census,
        **{key: POLICY_MEMBERS[key] for key in ("live_state_filename_policy", "excluded_sources", "absence_policy",
                                                "residue_rules", "synthetic_label_policy",
                                                "discovery_receipts_unverifiable", "ts_adapter",
                                                "checkout_path_encoding")}}, deny, deny_patterns


def proof_ledger_block(checkouts: list[dict[str, Any]]) -> dict[str, Any]:
    return {**PROOF_LEDGER_BLOCK,
            "checkouts_with_ledger": sum(c["proof_ledger"]["status"] == "present" for c in checkouts)}


def live_sources(live: dict[str, Any]) -> list[dict[str, Any]]:
    """Source receipts of one live family: the quarantine family receipt is its own source receipt."""
    return [live] if live["family"] == QUARANTINE_FAMILY else live["sources"]


def admission_ring(receipt: dict[str, Any], rows: list[JsonValue]) -> dict[str, Any]:
    admitted = sum(r["_tag"] == "admission-admitted" for r in rows)
    return {"observed_rows": receipt.get("observed_rows", 0),
            "writer_cap": ADMITTED_RING_CAP, "writer_unit": "admitted transitions", "observed_admitted": admitted,
            "at_writer_cap": admitted >= ADMITTED_RING_CAP, "known_history_cap": KNOWN_HISTORY_CAP,
            "retained_known_rows": len(rows), "at_known_history_cap": len(rows) >= KNOWN_HISTORY_CAP,
            "cap_sources": "source_facts.admitted_retention and source_facts.known_history_retention",
            "wrapped": "unknown; below-cap does not prove complete history"}


def attempt_ring(receipt: dict[str, Any], rows: list[JsonValue]) -> dict[str, Any]:
    terminal_ids = {r.get("attemptId") for r in rows
                    if r.get("_tag") in {"attempt-finished", "attempt-terminated"} and isinstance(r.get("attemptId"), str)}
    return {"observed_rows": receipt.get("observed_rows", 0), "writer_cap": TERMINAL_ATTEMPT_CAP,
            "writer_unit": "terminal attempts; active/protected/unknown rows may exceed cap",
            "observed_terminal_attempts": len(terminal_ids), "at_writer_cap": len(terminal_ids) >= TERMINAL_ATTEMPT_CAP,
            "compaction_receipts": sum(r.get("_tag") == "journal-compacted" for r in rows),
            "cap_source": "source_facts.terminal_attempt_retention",
            "wrapped": "unknown unless a retained compaction receipt supplies evidence"}


def checkout_counts(checkouts: list[dict[str, Any]], excluded: collections.Counter) -> dict[str, Any]:
    return {"by_kind": dict(sorted(collections.Counter(c["kind"] for c in checkouts).items())),
            "by_layout": dict(sorted(collections.Counter(c["layout"] for c in checkouts).items())),
            "excluded": {reason: excluded.get(reason, 0) for reason in EXCLUSION_REASONS}}


def verify_quarantine_receipt(live: dict[str, Any], retained: int) -> None:
    counters = [live[key] for key in ("files_observed", "captured_files", "excluded_lock_files",
                                      "excluded_symlinks", "vanished_before_read", "blank_files")]
    lines = live.get("retained_source_lines", [])
    days = live["mtime_days"]
    if (any(type(n) is not int or n < 0 for n in counters) or live["captured_files"] != retained
            or (live["status"] != "absent" and live["files_observed"] != live["observed_rows"]
                + live["vanished_before_read"] + live["blank_files"])
            or any(n > live["files_observed"] for n in lines)):
        fail("quarantine census differs")
    if live["family_semantics"] != QUARANTINE_SEMANTICS:
        fail("quarantine family semantics differ")
    if (not isinstance(days, dict) or list(days) != sorted(days)
            or any(not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) for day in days)
            or any(type(n) is not int or n < 1 for n in days.values())
            or sum(days.values()) != live["files_observed"] - live["vanished_before_read"]):
        fail("quarantine mtime_days census differs")


def verify_census(manifest: dict[str, Any], raw: dict[str, list[JsonValue]],
                  snapshot: list[dict[str, JsonValue]]) -> None:
    """Bind every derived receipt and census field to persisted payloads and the corpus_tree snapshot."""
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
            custody_variants.update(verify_owner_census(receipt, rows, False))
        ring = receipt.get("ring_window")
        if ring is not None:
            if kind == "admission":
                expected = admission_ring(receipt, rows)
            elif kind == "attempts":
                expected = attempt_ring(receipt, rows)
            else:
                fail("ring census on an unsupported source kind")
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
            if kind == "admission" and "ring_window" not in receipt:
                fail("admission ring census missing")
        if [live["family"] for live in root["live"]] != list(LIVE_FAMILIES):
            fail("live family census differs")
        for live in root["live"]:
            if live["family"] == QUARANTINE_FAMILY:
                if live.get("ndjson") is not True or "sources" in live:
                    fail("quarantine census shape differs")
                check_source(live, "live")
                expected_path = f"live/{root['label']}/{QUARANTINE_FAMILY}/state.ndjson"
                if "path" in live and live["path"] != expected_path:
                    fail("quarantine path differs")
                verify_quarantine_receipt(live, len(raw.get(live.get("path"), [])))
                continue
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
    if manifest["custody"] != custody_block(custody_variants) or list(manifest["custody"]) != list(CUSTODY_KEYS):
        fail("custody variant census or custody policy differs")
    assert_organic(raw)
    census = loss_population(raw, labels)
    census["reconciliation"] = reconcile_sources(raw.get(f"admission/{CANONICAL_LABEL}/journal.ndjson", []),
                                                 snapshot, census["chains"])
    if census["reconciliation"]["conflicts"]:
        fail("cross-source reconciliation found conflicting rows")
    if manifest["loss_population"] != census:
        fail("loss-population census differs from pinned rows")
    for root in manifest["admission_roots"]:
        if root["window"] != root_windows(raw, census, root["label"]):
            fail("admission root window differs from pinned rows")
    starts, last_merged_preview = stage_census(raw)
    if manifest["attempt_starts_by_stage"] != starts or manifest["last_merged_preview_start"] != last_merged_preview:
        fail("attempt-start stage census differs from pinned rows")
    verify_origin_key_shapes(manifest["origin_key_shapes"], raw)
    checkouts = manifest["checkouts"]
    checkout_labels = [c["checkout"] for c in checkouts]
    if checkout_labels != sorted(set(checkout_labels)):
        fail("checkout labels duplicated or unordered")
    if any(c["kind"] not in ("clone", "linked-worktree") or c["layout"] not in CHECKOUT_LAYOUTS for c in checkouts):
        fail("checkout kind or layout outside its vocabulary")
    counts = manifest["checkout_counts"]
    excluded = counts.get("excluded") if isinstance(counts, dict) else None
    if (not isinstance(excluded, dict) or list(excluded) != list(EXCLUSION_REASONS)
            or any(type(n) is not int or n < 0 for n in excluded.values())
            or counts != checkout_counts(checkouts, collections.Counter(excluded))):
        fail("checkout census differs")
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
    if manifest["proof_ledger"] != proof_ledger_block(checkouts):
        fail("ledger census differs")
    facts = manifest["source_facts"]
    for key, cap in (("admitted_retention", ADMITTED_RING_CAP), ("known_history_retention", KNOWN_HISTORY_CAP),
                     ("terminal_attempt_retention", TERMINAL_ATTEMPT_CAP)):
        if not isinstance(facts.get(key), dict) or facts[key].get("value") != cap:
            fail("ring cap differs from its cited retention fact")


def dry_run_root(directory: Path, name: str) -> Path:
    """DIR must be an existing absolute directory outside the repository."""
    if not directory.is_absolute():
        fail("--dry-run-root must be an absolute path")
    resolved = Path(os.path.realpath(directory))
    repository = Path(os.path.realpath(REPO_ROOT))
    if resolved == repository or resolved.is_relative_to(repository):
        fail("--dry-run-root must be outside the repository")
    if not resolved.is_dir():
        fail("--dry-run-root must be an existing directory")
    return resolved / name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--refresh", choices=("fleet",), help="deliberately replace the selected pin")
    parser.add_argument("--dry-run-root", type=Path,
                        help="capture and verify into DIR/run4-fleet (absolute, outside the repository); the corpus home is never touched")
    args = parser.parse_args()
    roots = dict(OUTPUT_ROOTS)
    if args.dry_run_root is not None:
        roots = {population: dry_run_root(args.dry_run_root, root.name) for population, root in roots.items()}
    summaries, advisories = {}, {}
    for population, root in roots.items():
        if (root.exists() or root.is_symlink()) and args.refresh != population:
            summary = {"status": "verified", **verify_output_tree(root, population)}
        else:
            # Capture reads the fleet through fleet_root, which names the wrong root from a Claude-app worktree.
            refuse_claude_worktree(REPO_ROOT)
            emitted, metadata, deny, deny_patterns = capture(population)
            manifest = finish_manifest(metadata, emitted, population)
            files = [(entry.path, entry.data) for entry in emitted] + [(MANIFEST_NAME, manifest)]
            scan_output_bytes(files)
            scan_capture_only(files, deny, deny_patterns)
            summary = {"status": "pinned", **write_staged_capture(emitted, manifest, root, population)}
        advisories = summary.pop("advisories")
        summaries[population] = summary
    print(json.dumps({"verification": "PASS", **summaries, "advisories": advisories}, sort_keys=True))


if __name__ == "__main__":
    main()
