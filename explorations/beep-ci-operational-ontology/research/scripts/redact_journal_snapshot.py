"""Committable redacted projection of an admission-journal snapshot (PR #1386 review;
addendum to the 2026-10-01 admission-journal snapshot ruling in DECISIONS.md).

The 2026-10-01 snapshot froze the canonical admission journal before its 200-admission
rolling window dropped the only organic withdrawal and ticket-eviction rows (run-4 docket
Queue D). The raw payload `canonical/journal.ndjson` stays git-ignored: its rows carry
process ids, process-start instants and host checkout paths, and this repository is
public. A digest alone cannot feed the run-4 pin from a fresh clone or a detached
worktree, so this script writes a redacted projection at the snapshot ROOT,
`journal.redacted.ndjson`, which is committed beside `MANIFEST.md` and `SHA256SUMS.txt`.

Redaction rule (follows the committed run-3b corpus custody precedent,
`ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py`):

  - `pid` and `procStart` are dropped; every row gains
    `ownerRef = sha256(f"{pid}:{procStart}:{captureSalt.hex()}")[:12]` (lowercase hex)
    and `ownerRefVariant`. The variant follows the ETL's member-driven label
    (`etl_run3b_fleet_corpus.py:395-398`): a row whose identity member is `pid` is
    `pid_pair`, and every row of this journal carries `pid`. A missing `procStart` is
    written `<absent>` and does not change the label; the ETL counts such rows as
    `owner_refs_without_start`, and this script reports them as `ownerRef without start`.
    A reference without a start cannot join one with a start by `ownerRef`; `nonce` and
    `attemptId` remain the row joins.
  - `checkoutRoot` (a host path) is replaced by `checkoutRef = sha256(checkoutRoot)[:12]`
    over its UTF-8 bytes: equality joins between rows survive, no label is kept.
  - Every other known member is kept verbatim: `_tag`, `schemaVersion`, `attemptId`,
    `nonce`, `originKey`, `kind`, `priority`, `weightTokens`, `branch`,
    `memoryPeakBytes`, `reason` and every `*AtMillis` instant.
  - Any `_tag` or member outside the per-tag census in `KNOWN` fails the run (no pass-through).
  - Output: one JSON object per row, payload row order, keys sorted, compact separators,
    UTF-8, newline-terminated. Given the same payload and salt the bytes are identical.

The capture salt is `canonical/capture-salt.hex` (hexadecimal encoding of 32 random
bytes). It lives under the git-ignored `canonical/` directory, is generated once by the
first `--write`, and is never committed or printed. Without it the projection cannot be
recomputed, only verified by digest.

Modes (exactly one):

  --write  verify the payload digest recorded in SHA256SUMS.txt, load or mint the salt,
           write the projection, and record its digest line in SHA256SUMS.txt (the
           payload line is kept). Idempotent. Refuses when a recorded projection digest
           would change (for example a lost salt): a re-render needs a DECISIONS entry.
  --check  verify the committed projection against its recorded digest, its structure
           (known members only, no pid/procStart/checkoutRoot, 12-hex refs, canonical
           form) and a residue scan (no home-directory path, no `uid-<digits>`). When the raw
           payload is present it must match its digest, and when the salt is also present
           the projection is recomputed and must be byte-identical. When the payload is
           absent only the committed projection is verified, and the output says so.

Run from the packet directory (stdlib only):

  UV_CACHE_DIR=$HOME/.cache/beep/uv-cache uv run python \\
    research/scripts/redact_journal_snapshot.py --check [--snapshot DIR]

`--snapshot` defaults to `research/evidence/journal-snapshot-2026-10-01` beside this
script. Exit 0 on success, 1 on any failure or mismatch, 2 on usage errors.
"""
import argparse
import collections
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

DEFAULT_SNAPSHOT = Path(__file__).resolve().parent.parent / "evidence" / "journal-snapshot-2026-10-01"
PAYLOAD = "canonical/journal.ndjson"
SALT = "canonical/capture-salt.hex"
PROJECTION = "journal.redacted.ndjson"
SUMS = "SHA256SUMS.txt"

# Known members per `_tag`, from the 2026-10-01 payload census (695 rows). Members marked
# optional are absent on some rows of that tag. Anything else fails the run.
COMMON = frozenset({"_tag", "schemaVersion", "nonce", "pid"})
KNOWN: dict[str, tuple[frozenset[str], frozenset[str]]] = {
    # tag: (required members, optional members)
    "admission-enqueued": (COMMON | {"procStart", "kind", "priority", "originKey", "checkoutRoot", "branch",
                                     "enqueuedAtMillis", "weightTokens"}, frozenset({"attemptId"})),
    "admission-admitted": (COMMON | {"procStart", "kind", "priority", "originKey", "weightTokens",
                                     "enqueuedAtMillis", "admittedAtMillis"}, frozenset({"attemptId"})),
    "admission-released": (COMMON | {"checkoutRoot", "branch", "releasedAtMillis"},
                           frozenset({"attemptId", "memoryPeakBytes"})),
    "admission-withdrawn": (COMMON | {"procStart", "kind", "priority", "originKey", "checkoutRoot", "branch",
                                      "enqueuedAtMillis", "withdrawnAtMillis"}, frozenset({"attemptId"})),
    "admission-ticket-evicted": (COMMON | {"checkoutRoot", "branch", "evictedAtMillis", "reason"}, frozenset()),
}
DROPPED = frozenset({"pid", "procStart", "checkoutRoot"})
ADDED = frozenset({"ownerRef", "ownerRefVariant"})
REF = re.compile(r"[0-9a-f]{12}")
# Same matches as the packet's residue scan; spelled so this file does not match it.
RESIDUE = re.compile(rb"/home(?=/)|uid-\d+")
SUM_LINE = re.compile(r"([0-9a-f]{64})  (\S.*)")


class Refusal(Exception):
    """A verification or redaction step failed; the message names the cause."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_line(row: dict) -> bytes:
    return (json.dumps(row, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def read_sums(snapshot: Path) -> dict[str, str]:
    path = snapshot / SUMS
    if not path.is_file():
        raise Refusal(f"{SUMS} is absent from the snapshot")
    sums: dict[str, str] = {}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        match = SUM_LINE.fullmatch(line)
        if match is None or match.group(2) in sums:
            raise Refusal(f"{SUMS}:{number} is not a unique '<sha256>  <path>' line")
        sums[match.group(2)] = match.group(1)
    return sums


def git_ignored(path: Path) -> bool | None:
    """True/False from `git check-ignore`; None outside a git checkout or without git."""
    try:
        completed = subprocess.run(["git", "-C", str(path.parent), "check-ignore", "-q", path.name],
                                   capture_output=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    return {0: True, 1: False}.get(completed.returncode)


def project_row(row: object, number: int, salt: bytes) -> dict:
    if not isinstance(row, dict):
        raise Refusal(f"payload row {number} is not a JSON object")
    tag = row.get("_tag")
    if tag not in KNOWN:
        raise Refusal(f"payload row {number}: unknown _tag {tag!r}")
    required, optional = KNOWN[tag]
    members = set(row)
    if unknown := sorted(members - required - optional):
        raise Refusal(f"payload row {number} ({tag}): unknown members {unknown}")
    if missing := sorted(required - members):
        raise Refusal(f"payload row {number} ({tag}): missing members {missing}")
    pid = row["pid"]
    if type(pid) is not int:
        raise Refusal(f"payload row {number} ({tag}): pid is not an integer")
    start = row.get("procStart")
    if start is not None and (type(start) is not str or not start):
        raise Refusal(f"payload row {number} ({tag}): procStart is not a nonempty string")
    result = {key: value for key, value in row.items() if key not in DROPPED}
    # Same surrogate and label as etl_run3b_fleet_corpus.py:395-398 for the `pid` variant.
    result["ownerRef"] = sha256(f"{pid}:{start if start is not None else '<absent>'}:{salt.hex()}".encode())[:12]
    result["ownerRefVariant"] = "pid_pair"
    if "checkoutRoot" in row:
        root = row["checkoutRoot"]
        if type(root) is not str or not root:
            raise Refusal(f"payload row {number} ({tag}): checkoutRoot is not a nonempty string")
        result["checkoutRef"] = sha256(root.encode("utf-8"))[:12]
    return result


def project(payload: bytes, salt: bytes) -> bytes:
    out = bytearray()
    for number, line in enumerate(payload.decode("utf-8").splitlines(), 1):
        if not line.strip():
            raise Refusal(f"payload row {number} is empty")
        try:
            row = json.loads(line)
        except json.JSONDecodeError as error:
            raise Refusal(f"payload row {number} is malformed JSON ({error.msg})") from None
        out += canonical_line(project_row(row, number, salt))
    return bytes(out)


def verify_projection(data: bytes) -> tuple[collections.Counter, int]:
    """Structure, canonical form and residue checks; returns the census and distinct checkoutRefs."""
    census: collections.Counter = collections.Counter()
    checkouts: set[str] = set()
    for number, raw in enumerate(data.splitlines(keepends=True), 1):
        if hit := RESIDUE.search(raw):
            raise Refusal(f"{PROJECTION}:{number}: residue {hit.group().decode()!r}")
        try:
            row = json.loads(raw)
        except json.JSONDecodeError as error:
            raise Refusal(f"{PROJECTION}:{number} is malformed JSON ({error.msg})") from None
        if not isinstance(row, dict) or row.get("_tag") not in KNOWN:
            raise Refusal(f"{PROJECTION}:{number}: not an object with a known _tag")
        if canonical_line(row) != raw:
            raise Refusal(f"{PROJECTION}:{number} is not in canonical form (sorted keys, compact, newline)")
        tag = row["_tag"]
        required, optional = KNOWN[tag]
        expected = (required - DROPPED) | ADDED | ({"checkoutRef"} if "checkoutRoot" in required else set())
        members = set(row)
        if leaked := sorted(members & DROPPED):
            raise Refusal(f"{PROJECTION}:{number} ({tag}): redacted members present {leaked}")
        if members - optional != expected:
            raise Refusal(f"{PROJECTION}:{number} ({tag}): members differ from the projected set")
        if not REF.fullmatch(str(row["ownerRef"])) or row["ownerRefVariant"] != "pid_pair":
            raise Refusal(f"{PROJECTION}:{number} ({tag}): malformed ownerRef or ownerRefVariant")
        if "checkoutRef" in row and not REF.fullmatch(str(row["checkoutRef"])):
            raise Refusal(f"{PROJECTION}:{number} ({tag}): malformed checkoutRef")
        census["rows"] += 1
        census[f"tag {tag}"] += 1
        census[f"ownerRefVariant {row['ownerRefVariant']}"] += 1
        if "procStart" not in required:
            census["ownerRef without start"] += 1
        census[f"schemaVersion {row['schemaVersion']}"] += 1
        if "checkoutRef" in row:
            checkouts.add(row["checkoutRef"])
    if not census["rows"]:
        raise Refusal(f"{PROJECTION} has no rows")
    return census, len(checkouts)


def print_census(census: collections.Counter, checkouts: int) -> None:
    print(f"projection rows: {census['rows']}")
    for key in sorted(k for k in census if k.startswith("tag ")):
        print(f"  {key[4:]}: {census[key]}")
    for key in sorted(k for k in census if k.startswith(("ownerRef", "schemaVersion "))):
        print(f"  {key}: {census[key]}")
    print(f"  distinct checkoutRef: {checkouts}")


def load_salt(snapshot: Path, sums: dict[str, str], mint: bool) -> bytes | None:
    path = snapshot / SALT
    if path.is_file():
        text = path.read_text(encoding="ascii").strip()
        if not re.fullmatch(r"[0-9a-f]{64}", text):
            raise Refusal(f"{SALT} is not the hexadecimal encoding of 32 bytes")
        return bytes.fromhex(text)
    if not mint:
        return None
    if PROJECTION in sums:
        raise Refusal(f"{SALT} is absent but {SUMS} already records {PROJECTION}; a new salt would mint "
                      "different ownerRefs (a re-render needs a DECISIONS entry)")
    salt = os.urandom(32)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="ascii") as handle:
        handle.write(salt.hex() + "\n")
    print(f"minted {SALT} (local-only, git-ignored, never printed)")
    return salt


def payload_bytes(snapshot: Path, sums: dict[str, str]) -> bytes | None:
    path = snapshot / PAYLOAD
    if not path.is_file():
        return None
    if PAYLOAD not in sums:
        raise Refusal(f"{SUMS} records no digest for {PAYLOAD}")
    data = path.read_bytes()
    if sha256(data) != sums[PAYLOAD]:
        raise Refusal(f"{PAYLOAD} digest differs from {SUMS}: the snapshot bytes changed")
    print(f"ok {PAYLOAD}: digest matches {SUMS} ({sums[PAYLOAD][:12]})")
    return data


def write(snapshot: Path) -> None:
    sums = read_sums(snapshot)
    payload = payload_bytes(snapshot, sums)
    if payload is None:
        raise Refusal(f"{PAYLOAD} is absent: --write needs the local raw payload")
    if git_ignored(snapshot / SALT) is False:
        raise Refusal(f"{SALT} is not git-ignored; refusing to mint a committable salt")
    salt = load_salt(snapshot, sums, mint=True)
    assert salt is not None
    data = project(payload, salt)
    census, checkouts = verify_projection(data)
    digest = sha256(data)
    target = snapshot / PROJECTION
    if PROJECTION in sums and sums[PROJECTION] != digest:
        raise Refusal(f"recorded {PROJECTION} digest {sums[PROJECTION][:12]} differs from the recomputed "
                      f"{digest[:12]}; refusing to re-render (a re-render needs a DECISIONS entry)")
    if target.is_file() and target.read_bytes() == data:
        print(f"unchanged {PROJECTION} ({digest[:12]})")
    else:
        target.write_bytes(data)
        print(f"wrote {PROJECTION} ({digest[:12]})")
    if git_ignored(target) is True:
        raise Refusal(f"{PROJECTION} is git-ignored; it must be committable")
    if PROJECTION not in sums:
        with (snapshot / SUMS).open("a", encoding="utf-8") as handle:
            handle.write(f"{digest}  {PROJECTION}\n")
        print(f"recorded {PROJECTION} digest in {SUMS}")
    print_census(census, checkouts)


def check(snapshot: Path) -> None:
    sums = read_sums(snapshot)
    if PROJECTION not in sums:
        raise Refusal(f"{SUMS} records no digest for {PROJECTION}")
    target = snapshot / PROJECTION
    if not target.is_file():
        raise Refusal(f"{PROJECTION} is absent (Queue D fails closed)")
    data = target.read_bytes()
    if sha256(data) != sums[PROJECTION]:
        raise Refusal(f"{PROJECTION} digest differs from {SUMS} (Queue D fails closed)")
    print(f"ok {PROJECTION}: digest matches {SUMS} ({sums[PROJECTION][:12]})")
    census, checkouts = verify_projection(data)
    print("ok structure: known members only; no pid/procStart/checkoutRoot; canonical form; residue scan clean")
    payload = payload_bytes(snapshot, sums)
    if payload is None:
        print(f"note: raw payload {PAYLOAD} is absent (git-ignored, local-only); "
              "verified only the committed projection's digest and structure")
    else:
        salt = load_salt(snapshot, sums, mint=False)
        if salt is None:
            print(f"note: {SALT} is absent (local-only); payload digest verified, recompute skipped")
        elif project(payload, salt) != data:
            raise Refusal(f"recomputed projection differs from the committed {PROJECTION}")
        else:
            print("ok recompute: projection rebuilt from the local payload and salt is byte-identical")
    print_census(census, checkouts)


def main() -> int:
    parser = argparse.ArgumentParser(description="redacted projection of an admission-journal snapshot")
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT,
                        help="snapshot directory (default: the 2026-10-01 journal snapshot)")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="write the projection and record its digest")
    mode.add_argument("--check", action="store_true", help="verify the projection (and payload when present)")
    args = parser.parse_args()
    snapshot = args.snapshot.resolve()
    if not snapshot.is_dir():
        print(f"usage: snapshot directory {args.snapshot} does not exist", file=sys.stderr)
        return 2
    try:
        if args.write:
            write(snapshot)
        else:
            check(snapshot)
    except Refusal as refusal:
        print(f"FAIL: {refusal}")
        print("VERDICT FAIL")
        return 1
    print("VERDICT PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
