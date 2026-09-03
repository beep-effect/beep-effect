#!/usr/bin/env python3
"""Emit bounded SourceObservations from the run-2 journal projections.

The adapter processes the three corpus kinds separately and in this fixed
order: ``admission``, ``attempts``, then ``verdicts``. Within each kind it
walks matching ``.properties`` files in lexicographic repo-relative path
order and maintains the set of property keys already observed for that kind.
For each file, the candidate facts are the first physical assignment of every
key not yet observed in that kind. Only assignments representable by the
SourceObservation ``config_key_value`` grammar are facts; whitespace-bearing
prose values are never shortened or normalized into false pairings. A file
with at least one new representable key emits one record containing exactly
those sorted facts, and only emitted keys enter the kind's observed-key set.

Each record spans the whole file. Its content digest covers the exact decoded
UTF-8 file text, and its excerpt is the first-occurrence line of the first
fact after canonical fact sorting. The symbols are the record-family tokens
``yeet-admission-journal``, ``yeet-attempt-journal``, and ``yeet-verdict`` —
each occurs token-bounded in every span through its ``schemaVersion``
pairing, which the validator requires of a symbol — all with syntactic
kind ``properties_projection``. This yields at most one observation point per
distinct validator-representable key in each corpus kind.

Repository mode reads the pinned commit from ``work/run-manifest.yaml``
because the adapter sandbox cannot traverse a worktree gitdir outside the
read-only repository bind. The auditor gate independently verifies that every
record commit equals both the manifest commit and repository HEAD.

Committed repository copies are provenance only; execute a byte-identical
trusted copy through the auditor sandbox runner.

Usage:
  python adapter-journal.py --self-check <golden-dir>
  python adapter-journal.py --repo <root> --out <dir>
"""

from __future__ import annotations

import difflib
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


ADAPTER_ID = "adapter-journal"
ADAPTER_VERSION = "1.0.0"
PARSER = "python-stdlib-properties"
SCRIPT = (
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/"
    "beep-ci-ops/adapters/adapter-journal.py"
)
ONTOLOGY_REL = (
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/"
    "beep-ci-ops"
)
CORPUS_REL = f"{ONTOLOGY_REL}/corpus/run2-fleet"
MANIFEST_REL = f"{ONTOLOGY_REL}/work/run-manifest.yaml"
GOLDEN_INPUT_REL = f"{ONTOLOGY_REL}/adapters/golden/journal/input"

# kind, corpus-relative glob, symbol name
KIND_SPECS = (
    ("admission", "admission/*/journal.properties", "yeet-admission-journal"),
    ("attempts", "attempts/*/*/attempts.properties", "yeet-attempt-journal"),
    ("verdicts", "verdicts/*/*/verdict.properties", "yeet-verdict"),
)

COMMIT_RE = re.compile(
    r'^\s*commit:\s*"?([0-9a-f]{40})"?\s*$',
    re.MULTILINE,
)
COMMENT_LINE_RE = re.compile(r"^[ \t\f]*[#!]")
PROPERTY_LINE_RE = re.compile(r"^[ \t]*([^\s=/]+)[ \t]*[:=][ \t]*(.*)$")
CONFIG_OBJECT_RE = re.compile(r"^[^\s=/]+=\S+$")
# Expected golden records carry a .expected suffix so the auditor's scanner —
# which treats every so-*.yaml under the ontology root as a live observation —
# never reads fixture bytes as evidence.
EXPECTED_NAME_RE = re.compile(r"^so-[0-9a-f]{12}\.yaml\.expected$")


class AdapterError(RuntimeError):
    """A fail-closed adapter error suitable for a concise CLI diagnostic."""


@dataclass(frozen=True)
class PropertyPair:
    """The first physical assignment of one key in a properties file."""

    key: str
    value: str
    line_number: int
    line_text: str


def read_utf8(path: Path) -> str:
    """Read bytes without newline translation and require valid UTF-8."""

    try:
        return path.read_bytes().decode("utf-8")
    except UnicodeDecodeError as error:
        raise AdapterError(f"{path}: properties input is not valid UTF-8") from error


def without_line_ending(line: str) -> str:
    """Remove one physical CRLF, LF, or CR terminator without trimming payload."""

    if line.endswith("\r\n"):
        return line[:-2]
    if line.endswith(("\n", "\r")):
        return line[:-1]
    return line


def strip_comments_config(text: str, path: str) -> str:
    """Mirror the validator's comment stripper for ``.properties`` pairing.

    Java properties comments use ``#`` and ``!`` only at physical line start
    after space, tab, or form-feed indentation. Inline markers are payload.
    """

    if not str(path).lower().endswith(".properties"):
        return text
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.lstrip("\ufeff")
    text = re.sub(r"^[ \t\f]*#[^\n]*", "", text, flags=re.MULTILINE)
    return re.sub(r"^[ \t\f]*![^\n]*", "", text, flags=re.MULTILINE)


def config_pair_occurs(key: str, value: str, text: str) -> bool:
    """Mirror the validator's ini/properties pairing arm exactly."""

    if not value:
        return False
    escaped_key = re.escape(str(key))
    escaped_value = re.escape(str(value))
    unquoted_end = (
        r"(?=[ \t]*(?:\r?\n(?:[ \t]*\r?\n)*(?:(?![ \t\r\n])|\Z)|\Z))"
    )
    separator = r"[ \t]*[:=][ \t]*"
    pattern = rf"^[ \t]*{escaped_key}{separator}{escaped_value}{unquoted_end}"
    return re.search(pattern, text, re.MULTILINE) is not None


def first_property_pairs(text: str, path: str) -> dict[str, PropertyPair]:
    """Return each key's first physical assignment, preserving its raw value."""

    first: dict[str, PropertyPair] = {}
    for line_number, physical_line in enumerate(text.splitlines(keepends=True), 1):
        line_text = without_line_ending(physical_line)
        parse_text = line_text.lstrip("\ufeff") if line_number == 1 else line_text
        if not parse_text.strip() or COMMENT_LINE_RE.match(parse_text):
            continue
        match = PROPERTY_LINE_RE.fullmatch(parse_text)
        if match is None:
            raise AdapterError(
                f"{path}:{line_number}: unsupported properties line; "
                "expected a comment, blank line, or key=value assignment"
            )
        key, value = match.groups()
        first.setdefault(
            key,
            PropertyPair(
                key=key,
                value=value,
                line_number=line_number,
                line_text=line_text,
            ),
        )
    return first


def canonical_id(
    commit: str,
    path: str,
    start_line: int,
    end_line: int,
    facts: list[list[str]],
) -> str:
    """Return the validator-defined SourceObservation content id."""

    payload = [
        commit,
        path,
        start_line,
        end_line,
        sorted(facts),
        ADAPTER_ID,
        ADAPTER_VERSION,
    ]
    digest = hashlib.sha256(
        json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    ).hexdigest()
    return f"so:sha256:{digest}"


def make_record(
    commit: str,
    logical_path: str,
    symbol_name: str,
    text: str,
    seen_keys: set[str],
) -> dict[str, object] | None:
    """Build one whole-file record for a file's new representable keys."""

    lines = text.splitlines(keepends=True)
    first_pairs = first_property_pairs(text, logical_path)
    candidates: list[tuple[PropertyPair, str]] = []
    for pair in first_pairs.values():
        if pair.key in seen_keys:
            continue
        fact_object = f"{pair.key}={pair.value}"
        # This is the validator's closed config_key_value object grammar.
        if CONFIG_OBJECT_RE.fullmatch(fact_object) is None:
            continue
        candidates.append((pair, fact_object))

    if not candidates:
        return None

    stripped = strip_comments_config(text, logical_path)
    # The validator requires the symbol to occur token-bounded in its own
    # comment-stripped span (its `occurs` rule: word chars, $ and # bound a
    # token; `-` and `/` do not), so every span must carry the record-family
    # token — the schemaVersion pairing provides it in real corpus files.
    if re.search(rf"(?<![\w$#]){re.escape(symbol_name)}(?![\w$#])", stripped) is None:
        raise AdapterError(
            f"{logical_path}: symbol {symbol_name!r} does not occur "
            "token-bounded in the comment-stripped span"
        )
    for pair, fact_object in candidates:
        if not config_pair_occurs(pair.key, pair.value, stripped):
            raise AdapterError(
                f"{logical_path}:{pair.line_number}: config pair "
                f"{fact_object!r} does not satisfy the validator's "
                "properties pairing grammar"
            )

    facts = sorted([["config_key_value", fact_object] for _, fact_object in candidates])
    fact_lines = {fact_object: pair.line_text for pair, fact_object in candidates}
    start_line = 1
    end_line = len(lines)
    if end_line < 1:
        raise AdapterError(f"{logical_path}: cannot emit a record for an empty file")

    record_id = canonical_id(
        commit,
        logical_path,
        start_line,
        end_line,
        facts,
    )
    seen_keys.update(pair.key for pair, _ in candidates)
    return {
        "id": record_id,
        "schema_version": 1,
        "repository": {"commit": commit, "path": logical_path},
        "source_span": {
            "start_line": start_line,
            "end_line": end_line,
            "content_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        },
        "extractor": {
            "id": ADAPTER_ID,
            "version": ADAPTER_VERSION,
            "parser": PARSER,
            "script": SCRIPT,
        },
        "symbol": {
            "qualified_name": symbol_name,
            "lexical_name": symbol_name,
            "syntactic_kind": "properties_projection",
        },
        "observed_facts": [
            {"predicate": predicate, "object": fact_object}
            for predicate, fact_object in facts
        ],
        "source_excerpt": fact_lines[facts[0][1]],
        "epistemic_status": "parser_derived",
    }


def yaml_string(value: object) -> str:
    """Encode a string as a JSON double-quoted scalar, valid in YAML."""

    return json.dumps(str(value), ensure_ascii=False)


def render_record(record: dict[str, object]) -> bytes:
    """Hand-emit one deterministic, validator-parseable YAML document."""

    repository = record["repository"]
    source_span = record["source_span"]
    extractor = record["extractor"]
    symbol = record["symbol"]
    facts = record["observed_facts"]
    if not all(
        isinstance(node, dict)
        for node in (repository, source_span, extractor, symbol)
    ) or not isinstance(facts, list):
        raise AdapterError("internal record shape is not renderable")

    output = [
        f"id: {yaml_string(record['id'])}",
        "schema_version: 1",
        "repository:",
        f"  commit: {yaml_string(repository['commit'])}",
        f"  path: {yaml_string(repository['path'])}",
        "source_span:",
        f"  start_line: {source_span['start_line']}",
        f"  end_line: {source_span['end_line']}",
        f"  content_sha256: {yaml_string(source_span['content_sha256'])}",
        "extractor:",
        f"  id: {yaml_string(extractor['id'])}",
        f"  version: {yaml_string(extractor['version'])}",
        f"  parser: {yaml_string(extractor['parser'])}",
        f"  script: {yaml_string(extractor['script'])}",
        "symbol:",
        f"  qualified_name: {yaml_string(symbol['qualified_name'])}",
        f"  lexical_name: {yaml_string(symbol['lexical_name'])}",
        f"  syntactic_kind: {yaml_string(symbol['syntactic_kind'])}",
        "observed_facts:",
    ]
    for fact in facts:
        if not isinstance(fact, dict):
            raise AdapterError("internal fact shape is not renderable")
        output.extend(
            (
                f"  - predicate: {yaml_string(fact['predicate'])}",
                f"    object: {yaml_string(fact['object'])}",
            )
        )
    output.extend(
        (
            f"source_excerpt: {yaml_string(record['source_excerpt'])}",
            f"epistemic_status: {yaml_string(record['epistemic_status'])}",
        )
    )
    return ("\n".join(output) + "\n").encode("utf-8")


def logical_path(logical_root: str, tree_root: Path, path: Path) -> str:
    """Map a physical input beneath ``tree_root`` to a stable repo path."""

    relative = path.relative_to(tree_root).as_posix()
    return (PurePosixPath(logical_root) / PurePosixPath(relative)).as_posix()


def extract_tree(
    tree_root: Path,
    logical_root: str,
    commit: str,
) -> dict[str, bytes]:
    """Extract the three kind-local vocabularies into filename-keyed bytes."""

    if not tree_root.is_dir():
        raise AdapterError(f"input tree does not exist: {tree_root}")

    rendered: dict[str, bytes] = {}
    for _kind, pattern, symbol_name in KIND_SPECS:
        seen_keys: set[str] = set()
        files = []
        for path in tree_root.glob(pattern):
            if path.is_symlink():
                raise AdapterError(f"refusing symlinked corpus input: {path}")
            if path.is_file():
                files.append((logical_path(logical_root, tree_root, path), path))
        for repo_path, physical_path in sorted(files, key=lambda item: item[0]):
            record = make_record(
                commit,
                repo_path,
                symbol_name,
                read_utf8(physical_path),
                seen_keys,
            )
            if record is None:
                continue
            digest = str(record["id"]).rsplit(":", 1)[-1]
            filename = f"so-{digest[:12]}.yaml"
            if filename in rendered:
                raise AdapterError(f"duplicate SourceObservation filename: {filename}")
            rendered[filename] = render_record(record)
    return rendered


def declared_commit(path: Path) -> str:
    """Read exactly one fixed 40-hex ``commit:`` declaration without YAML."""

    text = read_utf8(path)
    matches = COMMIT_RE.findall(text)
    if len(matches) != 1:
        raise AdapterError(
            f"{path}: expected exactly one 40-hex commit declaration; "
            f"found {len(matches)}"
        )
    return matches[0]


def expected_records(expected_dir: Path) -> dict[str, bytes]:
    """Load the golden record byte set and reject unexpected record names."""

    if not expected_dir.is_dir():
        raise AdapterError(f"golden expected directory does not exist: {expected_dir}")
    records: dict[str, bytes] = {}
    for path in sorted(expected_dir.iterdir(), key=lambda item: item.name):
        if not path.is_file():
            continue
        if EXPECTED_NAME_RE.fullmatch(path.name) is None:
            raise AdapterError(f"unexpected golden record filename: {path.name}")
        records[path.name.removesuffix(".expected")] = path.read_bytes()
    if not records:
        raise AdapterError(f"golden expected directory has no records: {expected_dir}")
    return records


def compare_golden(expected: dict[str, bytes], actual: dict[str, bytes]) -> None:
    """Raise with a deterministic filename/byte diff summary on mismatch."""

    mismatch = False
    for filename in sorted(expected.keys() - actual.keys()):
        print(f"- missing derived record: {filename}", file=sys.stderr)
        mismatch = True
    for filename in sorted(actual.keys() - expected.keys()):
        print(f"+ unexpected derived record: {filename}", file=sys.stderr)
        mismatch = True
    for filename in sorted(expected.keys() & actual.keys()):
        wanted = expected[filename]
        got = actual[filename]
        if wanted == got:
            continue
        mismatch = True
        print(
            f"! byte mismatch {filename}: expected {len(wanted)} bytes, "
            f"derived {len(got)} bytes",
            file=sys.stderr,
        )
        diff = difflib.unified_diff(
            wanted.decode("utf-8", errors="replace").splitlines(keepends=True),
            got.decode("utf-8", errors="replace").splitlines(keepends=True),
            fromfile=f"expected/{filename}",
            tofile=f"derived/{filename}",
        )
        for index, line in enumerate(diff):
            if index == 80:
                print("... diff truncated after 80 lines", file=sys.stderr)
                break
            print(line, end="" if line.endswith("\n") else "\n", file=sys.stderr)
    if mismatch:
        raise AdapterError("golden self-check failed")


def self_check(golden_dir: Path) -> int:
    """Re-derive the relocatable fixture and compare record bytes exactly."""

    commit = declared_commit(golden_dir / "expected-metadata.yaml")
    actual = extract_tree(golden_dir / "input", GOLDEN_INPUT_REL, commit)
    expected = expected_records(golden_dir / "expected")
    compare_golden(expected, actual)
    print(f"{ADAPTER_ID} --self-check PASS ({len(actual)} records)")
    return 0


def write_records(out_dir: Path, records: dict[str, bytes]) -> None:
    """Write deterministic record bytes into the sandbox's dedicated output."""

    out_dir.mkdir(parents=True, exist_ok=True)
    for filename in sorted(records):
        (out_dir / filename).write_bytes(records[filename])


def usage() -> None:
    """Print the only two accepted CLI shapes."""

    print(
        "usage: adapter-journal.py --self-check <golden-dir> | "
        "--repo <root> --out <dir>",
        file=sys.stderr,
    )


def main(argv: list[str] | None = None) -> int:
    """Run exact-shape CLI dispatch with concise fail-closed diagnostics."""

    args = sys.argv[1:] if argv is None else argv
    try:
        if len(args) == 2 and args[0] == "--self-check":
            return self_check(Path(args[1]).resolve())
        if len(args) == 4 and args[0] == "--repo" and args[2] == "--out":
            repo = Path(args[1]).resolve()
            if not repo.is_dir():
                raise AdapterError(f"repository root does not exist: {repo}")
            commit = declared_commit(repo / MANIFEST_REL)
            records = extract_tree(repo / CORPUS_REL, CORPUS_REL, commit)
            out_dir = Path(args[3]).resolve()
            write_records(out_dir, records)
            print(
                f"{ADAPTER_ID}: wrote {len(records)} SourceObservations to {out_dir}"
            )
            return 0
    except (AdapterError, OSError) as error:
        print(f"{ADAPTER_ID}: {error}", file=sys.stderr)
        return 1
    usage()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
