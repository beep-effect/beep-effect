"""etl_snapshot — redact and project one admission-journal snapshot.

The source /tmp journal is copied, never modified.  Redaction surgically removes
only the pid and procStart JSON members while preserving every other source byte,
including member order, escaping, and line endings.  The graph projects admitted
events through ratified predicates only; unratified state/kind/priority/capacity
telemetry remains explicit in MANIFEST.yaml.  Deterministic and idempotent for a
fixed source journal.

Run: uv run --with pyyaml python etl_snapshot.py
"""

from __future__ import annotations

import collections
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

import yaml

from _common import S6, corpus_commit, sha256_12, write_generated_yaml

# The scheduler constructs its admission root per-user (beep-admit-uid-<uid>);
# fresh captures must follow the running uid, never a hardcoded one.
SOURCE = Path(f"/tmp/beep-admit-uid-{os.getuid()}/journal.ndjson")
RAW = S6 / "snapshot/raw/journal.ndjson"
MANIFEST = S6 / "snapshot/raw/MANIFEST.yaml"
CI_IRI = "https://oip.law/ontology/ci-ops#"
MANIFEST_IRI = "https://oip.law/ontology/ci-ops-s6-manifest#"
DROP_FIELDS = ("pid", "procStart")
JSON_VALUE = rb'(?:"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)'


def remove_json_member(line: bytes, field: str) -> tuple[bytes, int]:
    """Remove one compact-JSON member without reserializing neighboring bytes."""

    encoded = re.escape(field.encode())
    with_trailing = re.compile(rb'"' + encoded + rb'":' + JSON_VALUE + rb',')
    line, leading_count = with_trailing.subn(b"", line)
    at_end = re.compile(rb',"' + encoded + rb'":' + JSON_VALUE + rb'(?=\s*(?:\r?\n)?$)')
    line, end_count = at_end.subn(b"", line)
    return line, leading_count + end_count


def redact(source: bytes) -> tuple[bytes, list[dict], list[dict], dict[str, int]]:
    """Return redacted bytes and validated source/redacted event objects."""

    source_events = []
    redacted_events = []
    removed = collections.Counter()
    output = []
    for number, line in enumerate(source.splitlines(keepends=True), start=1):
        if not line.strip():
            output.append(line)
            continue
        try:
            source_event = json.loads(line)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"source journal line {number} is invalid JSON: {exc}") from exc
        changed = line
        for field in DROP_FIELDS:
            changed, count = remove_json_member(changed, field)
            removed[field] += count
        try:
            redacted_event = json.loads(changed)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"redacted journal line {number} is invalid JSON: {exc}") from exc
        expected = {key: value for key, value in source_event.items() if key not in DROP_FIELDS}
        if redacted_event != expected:
            raise SystemExit(f"redaction changed non-redacted data on journal line {number}")
        source_events.append(source_event)
        redacted_events.append(redacted_event)
        output.append(changed)
    if not source_events:
        raise SystemExit("source journal contains no events")
    expected_removed = {
        field: sum(1 for event in source_events if field in event) for field in DROP_FIELDS
    }
    if dict(removed) != expected_removed:
        raise SystemExit(f"redaction counts {dict(removed)} != expected {expected_removed}")
    return b"".join(output), source_events, redacted_events, dict(removed)


def utc_millis(value: int) -> str:
    """Render epoch milliseconds as an xsd:dateTime UTC lexical form."""

    return dt.datetime.fromtimestamp(value / 1000, tz=dt.timezone.utc).isoformat(
        timespec="milliseconds"
    ).replace("+00:00", "Z")


def ttl_string(value: str) -> str:
    """Encode one JSON-compatible Turtle string literal."""

    return json.dumps(value, ensure_ascii=False)


def safe_nonce(value: object) -> str:
    """Validate the journal nonce for the contract's direct local-name minting."""

    nonce = str(value)
    if not re.fullmatch(r"[A-Za-z0-9._~-]+", nonce):
        raise SystemExit(f"nonce {nonce!r} is not safe for direct IRI local-name minting")
    return nonce


def _source_block(pinned: bool, events, removed: int, redacted_bytes: bytes) -> dict:
    """The transform stats describe how RAW was captured from /tmp; a pinned rerun
    reads RAW itself, so the capture-time block is carried forward verbatim."""
    if pinned and MANIFEST.is_file():
        prior = yaml.safe_load(MANIFEST.read_text())
        if isinstance(prior, dict) and isinstance(prior.get("source"), dict):
            return prior["source"]
    return {
        "path": SOURCE.as_posix(),
        "copied_to": "snapshot/raw/journal.ndjson",
        "event_count": len(events),
        "transform": {
            "mode": "surgical compact-JSON member removal",
            "dropped_fields": list(DROP_FIELDS),
            "removed_occurrences": removed,
            "preservation": "all other bytes retained in source order, including line endings",
        },
        "redacted_sha256_12": sha256_12(redacted_bytes),
    }


def main() -> None:
    # The committed raw copy is the pinned source once it exists: the live /tmp
    # journal grows with every machine-wide admission, and a ratified-by-digest
    # snapshot must not drift on rerun. --refresh deliberately re-captures.
    pinned = RAW.is_file() and "--refresh" not in sys.argv[1:]
    if pinned:
        source_bytes = RAW.read_bytes()
    else:
        if not SOURCE.is_file():
            raise SystemExit(f"snapshot source missing: {SOURCE}")
        source_bytes = SOURCE.read_bytes()
    redacted_bytes, _, events, removed = redact(source_bytes)
    RAW.write_bytes(redacted_bytes)

    millis = [
        value
        for event in events
        for key, value in event.items()
        if key.endswith("Millis") and isinstance(value, (int, float)) and not isinstance(value, bool)
    ]
    if not millis:
        raise SystemExit("journal has no numeric *Millis timestamp")
    max_millis = int(max(millis))
    instant_dt = dt.datetime.fromtimestamp(max_millis / 1000, tz=dt.timezone.utc)
    instant = instant_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    instant_file = instant_dt.strftime("%Y%m%dT%H%M%SZ")
    snapshot_name = f"snapshot-{instant_file}.ttl"
    manifest_graph_name = f"manifest-{instant_file}.ttl"

    admitted = [event for event in events if event.get("_tag") == "admission-admitted"]
    released = [event for event in events if event.get("_tag") == "admission-released"]
    unknown_tags = sorted(
        {str(event.get("_tag")) for event in events}
        - {"admission-admitted", "admission-released"}
    )
    if unknown_tags:
        raise SystemExit(f"journal contains unsupported event tags: {unknown_tags}")
    admitted_nonces = [safe_nonce(event.get("nonce")) for event in admitted]
    if len(admitted_nonces) != len(set(admitted_nonces)):
        raise SystemExit("journal contains duplicate admission-admitted nonces")
    released_nonces = {safe_nonce(event.get("nonce")) for event in released}
    admitted_set = set(admitted_nonces)

    kind_counts = dict(sorted(collections.Counter(str(event.get("kind")) for event in admitted).items()))
    priority_counts = dict(
        sorted(collections.Counter(str(event.get("priority")) for event in admitted).items())
    )
    state_tallies = {
        "active": len(admitted_set - released_nonces),
        "released": len(admitted_set & released_nonces),
        "unmatched_release_events": sum(
            1 for event in released if safe_nonce(event.get("nonce")) not in admitted_set
        ),
    }

    ttl = [
        "# GENERATED by scripts/etl_snapshot.py — do not hand-edit.",
        f"# Golden admission snapshot at {instant}; ratified vocabulary only.",
        f"@prefix ciops: <{CI_IRI}> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
    ]
    for event in sorted(admitted, key=lambda row: (int(row["admittedAtMillis"]), str(row["nonce"]))):
        nonce = safe_nonce(event["nonce"])
        enqueued = event.get("enqueuedAtMillis")
        admitted_at = event.get("admittedAtMillis")
        weight = event.get("weightTokens")
        if not isinstance(enqueued, int) or isinstance(enqueued, bool):
            raise SystemExit(f"admission {nonce}: enqueuedAtMillis is not an integer")
        if not isinstance(admitted_at, int) or isinstance(admitted_at, bool):
            raise SystemExit(f"admission {nonce}: admittedAtMillis is not an integer")
        if not isinstance(weight, int) or isinstance(weight, bool):
            raise SystemExit(f"admission {nonce}: weightTokens is not an integer")
        wait = admitted_at - enqueued
        if wait < 0:
            raise SystemExit(f"admission {nonce}: negative queue wait {wait}")
        origin = event.get("originKey")
        if not isinstance(origin, str):
            raise SystemExit(f"admission {nonce}: originKey is not a string")

        request_predicates = [
            "    rdf:type ciops:SeatRequest",
            f'    ciops:enqueuedAt "{utc_millis(enqueued)}"^^xsd:dateTime',
            f'    ciops:observedQueueWaitMs "{wait}"^^xsd:integer',
        ]
        if origin:
            request_predicates.append(f"    ciops:hasOriginKey {ttl_string(origin)}")
        ttl.append(f"ciops:seat-request-{nonce}")
        ttl.append(" ;\n".join(request_predicates) + " .")

        grant_predicates = [
            "    rdf:type ciops:SeatGrant",
            f'    ciops:admissionChargeTokens "{weight}"^^xsd:integer',
        ]
        if origin:
            grant_predicates.append(f"    ciops:hasOriginKey {ttl_string(origin)}")
        ttl.append(f"ciops:seat-grant-{nonce}")
        ttl.append(" ;\n".join(grant_predicates) + " .")
        ttl.append("")

    graph_path = S6 / "graphs" / snapshot_name
    graph_path.write_text("\n".join(ttl).rstrip() + "\n")
    for stale in sorted((S6 / "graphs").glob("snapshot-*.ttl")):
        if stale != graph_path:
            stale.unlink()

    # Closure is declared ONLY for predicates the snapshot graph actually asserts:
    # declaring an unmaterialized predicate closed would license absence-as-evidence
    # over triples that were never emitted (PR #919 review). hasGrantState stays a
    # vocabulary gap — its active/released tallies live in counts, never as closure.
    complete = []
    for predicate in (
        "enqueuedAt",
        "admissionChargeTokens",
        "observedQueueWaitMs",
        "hasOriginKey",
    ):
        complete.append(
            {
                "predicate": predicate,
                "world": "closed",
                "complete_within": f"redacted yeet-admission-journal/v1 window through {instant}",
                "source": "snapshot/raw/journal.ndjson",
                "freshness": "snapshot_instant",
            }
        )

    manifest = {
        "generated_by": "scripts/etl_snapshot.py",
        "corpus_commit": corpus_commit(),
        "snapshot_instant": instant,
        "snapshot_instant_millis": max_millis,
        "graph": f"graphs/{snapshot_name}",
        "manifest_graph": f"graphs/{manifest_graph_name}",
        "source": _source_block(pinned, events, removed, redacted_bytes),
        "counts": {
            "admission_admitted": len(admitted),
            "admission_released": len(released),
            "nonempty_origin_key": sum(1 for event in admitted if event.get("originKey")),
            "empty_origin_key": sum(1 for event in admitted if not event.get("originKey")),
            "kind": kind_counts,
            "priority": priority_counts,
            "grant_state_tallies": state_tallies,
        },
        "completeForPredicate": complete,
        "vocabulary_gaps": [
            {
                "predicate": "hasGrantState",
                "telemetry": "active/released tallies retained in this manifest",
                "reason": "unratified vocabulary; no state triple asserted",
            },
            {
                "predicate": "hasWorkKind",
                "telemetry": "counts.kind",
                "reason": "unratified request predicate; no work-kind triple asserted",
            },
            {
                "predicate": "hasPriorityClass",
                "telemetry": "counts.priority",
                "reason": "unratified request predicate; no priority triple asserted",
            },
            {
                "predicate": "capacityAtAdmissionTokens",
                "telemetry": None,
                "reason": "yeet-admission-journal/v1 does not record capacity at admission",
            },
            {
                "predicate": "activeTokens",
                "telemetry": None,
                "reason": "yeet-admission-journal/v1 does not record active token totals",
            },
            {
                "predicate": "admittedBy",
                "telemetry": None,
                "reason": (
                    "taxonomy direction is WorkUnitSpecification to SeatGrant; journal requests are SeatRequest, "
                    "so no directionally invalid request/grant edge is minted"
                ),
            },
        ],
    }
    write_generated_yaml(
        MANIFEST,
        manifest,
        "etl_snapshot.py",
        "Public snapshot receipt; source journal was copied and never modified.",
        "Redaction drops pid and procStart only; grant state/kind/priority remain manifest tallies.",
    )

    manifest_ttl = [
        "# GENERATED by scripts/etl_snapshot.py — do not hand-edit.",
        "# Companion encoding for SHACL validation of MANIFEST.yaml closure declarations.",
        f"@prefix ciops: <{CI_IRI}> .",
        f"@prefix manifest: <{MANIFEST_IRI}> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "",
        f"manifest:snapshot-{instant_file} rdf:type manifest:SnapshotManifest ;",
    ]
    refs = [f"manifest:closure-{index:02d}" for index in range(1, len(complete) + 1)]
    manifest_ttl.append("    manifest:hasClosureDeclaration " + ", ".join(refs) + " .")
    manifest_ttl.append("")
    for index, record in enumerate(complete, start=1):
        manifest_ttl.extend(
            [
                f"manifest:closure-{index:02d} rdf:type manifest:ClosureDeclaration ;",
                f"    manifest:completeForPredicate ciops:{record['predicate']} ;",
                f"    manifest:world {ttl_string(record['world'])} ;",
                f"    manifest:completeWithin {ttl_string(record['complete_within'])} ;",
                f"    manifest:source {ttl_string(record['source'])} ;",
                f"    manifest:freshness {ttl_string(record['freshness'])} .",
                "",
            ]
        )
    manifest_graph_path = S6 / "graphs" / manifest_graph_name
    manifest_graph_path.write_text("\n".join(manifest_ttl).rstrip() + "\n")
    for stale in sorted((S6 / "graphs").glob("manifest-*.ttl")):
        if stale != manifest_graph_path:
            stale.unlink()

    print(
        f"snapshot: {instant}; {len(events)} events / {len(admitted)} admissions; "
        f"redacted sha256_12={sha256_12(redacted_bytes)}"
    )


if __name__ == "__main__":
    main()
