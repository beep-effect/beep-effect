#!/usr/bin/env python3
"""Run-4 properties evidence, with a vocabulary census and disclosed selection rules.

Execute a reviewed trusted copy through run_adapter_sandbox.sh. The repository
copy is provenance. Only two named pins' properties projections are read;
the run manifest supplies the independently checked commit. No raw payload or
corpus manifest is executed or parsed. See adapter-journal-run4.md for the rule table.

A chain is one observation per (pin, root, nonce), spanning its first through
last event. Facts come only from that nonce's stanzas. The complete verbatim
span is retained in source_excerpt, including interleaved stanzas, so each tag,
instant and checkout pairing remains reconstructible without opening a file.

A vocabulary record is one record stanza: a `# record N` marker line through
the line before the next marker. Lines ahead of a file's first marker, or a
file with no marker, are one leading stanza. No vocabulary span crosses a marker.
"""
from __future__ import annotations

import collections
import difflib
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ADAPTER_ID = "adapter-journal"
ADAPTER_VERSION = "1.3.0"
ONTOLOGY_REL = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops"
SCRIPT = f"{ONTOLOGY_REL}/adapters/adapter-journal-run4.py"
CORPUS_REL = f"{ONTOLOGY_REL}/corpus"
MANIFEST_REL = f"{ONTOLOGY_REL}/work/run-manifest.yaml"
GOLDEN_INPUT_REL = f"{ONTOLOGY_REL}/adapters/golden/journal-run4/input"
PINS = ("run4-fleet", "run4-ledger")
EVENT_TAGS = frozenset(("admission-enqueued", "admission-withdrawn",
                        "admission-lease-evicted", "admission-ticket-evicted"))
EVICTIONS = frozenset(("admission-lease-evicted", "admission-ticket-evicted"))
ABSENT = "<absent>"
PROPERTY_LINE = re.compile(r"^[ \t]*([^\s=/]+)[ \t]*[:=][ \t]*(.*)$")
OBJECT = re.compile(r"^[^\s=/]+=\S+$")
EXPECTED_NAME = re.compile(r"so-[0-9a-f]{12}\.yaml\.expected")
COMMIT = re.compile(r'^[ \t]*commit:[ \t]*(?:"([0-9a-f]{40})"|([0-9a-f]{40}))[ \t]*$', re.M)
MARKER = re.compile(r"^# record ([0-9]+)$")


class AdapterError(RuntimeError):
    """Closed input or proof failure."""


@dataclass(frozen=True)
class Pair:
    key: str
    value: str
    line: int

    @property
    def object(self):
        return f"{self.key}={self.value}"


@dataclass(frozen=True)
class Event:
    start: int
    end: int
    pairs: tuple[Pair, ...]

    def first(self):
        result = {}
        for pair in self.pairs:
            result.setdefault(pair.key, pair.value)
        return result


def read_utf8(path):
    return path.read_bytes().decode("utf-8")


def strip_comments_config(text, path="a.properties"):
    """Exactly v14's properties stripper, including BOM, CR and form feed."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").lstrip("\ufeff")
    text = re.sub(r"^[ \t\f]*#[^\n]*", "", text, flags=re.M)
    return re.sub(r"^[ \t\f]*![^\n]*", "", text, flags=re.M)


def config_pair_occurs(key, value, text):
    """Exactly v14's properties pairing arm; quotes and inline markers are payload."""
    if not value:
        return False
    end = r"(?=[ \t]*(?:\r?\n(?:[ \t]*\r?\n)*(?:(?![ \t\r\n])|\Z)|\Z))"
    sep = r"[ \t]*[:=][ \t]*"
    return re.search(rf"^[ \t]*{re.escape(key)}{sep}{re.escape(value)}{end}", text, re.M) is not None


def strip_comments(text):
    """Mirror the separate UNION stripper used for symbol authentication."""
    text = re.sub(r"<!--.*?(-->|\Z)", "", text, flags=re.S)
    text = re.sub(r"/\*.*?(\*/|\Z)", "", text, flags=re.S)
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"#[^\n]*", "", text)
    return re.sub(r"^[ \t]*[;!][^\n]*", "", text, flags=re.M)


def occurs(token, text):
    return re.search(rf"(?<![\w$#]){re.escape(token)}(?![\w$#])", text) is not None


def parse_pairs(text):
    """Read physical assignments; retain duplicate keys and exact EOL payloads.

    Unpairable syntax remains unrepresented. No trimming, quote removal, escape
    decoding, dotted-key invention, or prefix shortening is applied to values.
    Coordinates follow the validator's str.splitlines(keepends=True).
    """
    # The pairing stripper consumes only CR/LF physical breaks. Using its result
    # for extraction prevents form-feed comment text from becoming assignments.
    normalized = strip_comments_config(text)
    pairs = []
    raw_lines = re.split(r"\r\n|\r|\n", text)
    clean_lines = normalized.split("\n")
    coordinate = 1
    for physical, cleaned in zip(raw_lines, clean_lines):
        match = PROPERTY_LINE.fullmatch(cleaned)
        if match is not None:
            key, value = match.groups()
            pairs.append(Pair(key, value, coordinate))
        coordinate += len((physical + "\n").splitlines(keepends=True))
    return pairs


def eligible(pairs, text):
    stripped = strip_comments_config(text)
    return [p for p in pairs if OBJECT.fullmatch(p.object)
            and config_pair_occurs(p.key, p.value, stripped)]


def first_pairs(pairs):
    result = {}
    for pair in pairs:
        result.setdefault(pair.key, pair)
    return list(result.values())


def events(text, pairs):
    lines = text.splitlines(keepends=True)
    starts = [i for i, line in enumerate(lines, 1) if MARKER.fullmatch(line.rstrip("\r\n"))]
    return [Event(start, end - 1, tuple(p for p in pairs if start <= p.line < end))
            for start, end in zip(starts, starts[1:] + [len(lines) + 1])]


def stanzas(text, pairs):
    """Vocabulary boundary: the leading lines, then each `# record N` event.

    Yields (index, start, end, pairs); the leading stanza has index None.
    """
    parsed = events(text, pairs)
    head = parsed[0].start - 1 if parsed else len(text.splitlines(keepends=True))
    lead = [(None, 1, head, tuple(p for p in pairs if p.line <= head))] if head else []
    return lead + [(i, e.start, e.end, e.pairs) for i, e in enumerate(parsed)]


def record(commit, path, text, pairs, start, end, name, excerpt=True):
    """Build one canonical record and authenticate every fact against its span."""
    span = "".join(text.splitlines(keepends=True)[start - 1:end])
    represented = eligible(pairs, span)
    if not represented:
        # Keep a selected but unrepresentable file visible to the dispositions pass.
        facts = [["unrepresentable_construct", "properties_projection"]]
    else:
        facts = sorted({("config_key_value", p.object) for p in represented})
    symbol_text = strip_comments(span)
    lex = next((p.key for p in pairs if occurs(p.key, symbol_text)), None)
    if lex is None:
        raise AdapterError(f"{path}: selected span has no authenticatable symbol")
    payload = [commit, path, start, end, sorted(facts), ADAPTER_ID, ADAPTER_VERSION]
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"),
                                      ensure_ascii=False).encode()).hexdigest()
    result = {
        "id": f"so:sha256:{digest}", "schema_version": 1,
        "repository": {"commit": commit, "path": path},
        "source_span": {"start_line": start, "end_line": end,
                        "content_sha256": hashlib.sha256(span.encode()).hexdigest()},
        "extractor": {"id": ADAPTER_ID, "version": ADAPTER_VERSION,
                      "parser": "python-stdlib-properties", "script": SCRIPT},
        "symbol": {"qualified_name": name, "lexical_name": lex,
                   "syntactic_kind": "properties_projection"},
        "observed_facts": [{"predicate": p, "object": o} for p, o in facts],
        "source_excerpt": span if excerpt else span.splitlines()[0],
        "epistemic_status": "parser_derived",
    }
    # JSON is a YAML subset; deterministic stdlib rendering needs no PyYAML.
    return f"so-{digest[:12]}.yaml", (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode()


def ledger_classes(clone, event):
    """Classify one ledger record by ordered occurrence; a missing key is a class value.

    Flattened leaves repeat `kind`: the first value is the record kind, the
    second (shadows only) the decision kind. Every other key reads its first
    occurrence. Returns (rule, class) in rule order.
    """
    kinds = [p.value for p in event.pairs if p.key == "kind"]
    d = event.first()
    if not kinds or kinds[0] not in ("fact", "shadow"):
        return []
    classes = [("ledger-clone-stage", (clone, kinds[0], d.get("stage", ABSENT)))]
    if kinds[0] == "shadow":
        decision = kinds[1] if len(kinds) > 1 else ABSENT
        classes.append(("ledger-shadow-class", (decision, d.get("reason", ABSENT),
                                               d.get("observed", ABSENT))))
    else:
        classes.append(("ledger-fact-class", (d.get("outcome", ABSENT), d.get("tier", ABSENT),
                                             d.get("inputSource", ABSENT),
                                             d.get("laneClass", ABSENT))))
    return classes


def extract_tree(tree_root, logical_root, commit):
    rendered = {}
    census = []
    rules = collections.Counter()
    classes_report = {}
    for pin in PINS:
        root = tree_root / pin
        if not root.is_dir() or root.is_symlink():
            raise AdapterError(f"missing or symlinked pin: {pin}")
        grouped = collections.defaultdict(list)
        for path in sorted(root.rglob("*.properties")):
            if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != tree_root.parent):
                raise AdapterError(f"symlinked projection in {pin}")
            rel = path.relative_to(root)
            kind = rel.parts[0] if len(rel.parts) > 1 else "snapshot"
            grouped[kind].append(path)
        for kind, files in sorted(grouped.items()):
            seen_keys, seen_classes, seen_tags = set(), set(), set()
            count_before = len(rendered)
            def add(path, text, pairs, start, end, name, rule):
                logical = (PurePosixPath(logical_root) / path.relative_to(tree_root).as_posix()).as_posix()
                filename, data = record(commit, logical, text, pairs, start, end, name)
                if filename in rendered and rendered[filename] != data:
                    raise AdapterError("12-hex observation filename collision")
                if filename not in rendered:
                    rendered[filename] = data
                    rules[rule] += 1
            for path in files:
                text = read_utf8(path)
                pairs = parse_pairs(text)
                lines = text.splitlines(keepends=True)
                name = f"{pin}/{path.relative_to(root).as_posix()}"
                for index, start, end, stanza in stanzas(text, pairs):
                    span = "".join(lines[start - 1:end])
                    fresh = [p for p in eligible(first_pairs(stanza), span) if p.key not in seen_keys]
                    seen_keys.update(p.key for p in fresh)
                    if fresh:
                        add(path, text, fresh, start, end,
                            name if index is None else f"{name}:record={index}", "vocabulary")
                if kind == "attempts" and path.name == "attempts.properties":
                    for index, event in enumerate(events(text, pairs)):
                        d = event.first()
                        if d.get("_tag") != "attempt-started":
                            continue
                        stage = ("first-stage", (d.get("stage", ABSENT),))
                        if stage not in seen_classes:
                            seen_classes.add(stage)
                            add(path, text, event.pairs, event.start, event.end,
                                f"{name}:record={index}", "first-stage")
                if kind == "ledgers" and path.name == "proof-ledger.properties":
                    clone = path.parent.relative_to(root).as_posix()
                    for index, event in enumerate(events(text, pairs)):
                        new = [c for c in ledger_classes(clone, event) if c not in seen_classes]
                        seen_classes.update(new)
                        if new:
                            add(path, text, event.pairs, event.start, event.end,
                                f"{name}:record={index}", new[0][0])
                if kind != "admission" or path.name != "journal.properties":
                    continue
                parsed = events(text, pairs)
                by_nonce = collections.defaultdict(list)
                wanted = set()
                root_label = path.parent.relative_to(root).as_posix()
                for index, event in enumerate(parsed):
                    d = event.first()
                    if d.get("nonce"):
                        by_nonce[d["nonce"]].append(index)
                    tag = d.get("_tag")
                    v3 = d.get("schemaVersion") == "yeet-admission-journal/v3"
                    docket_tag = tag in EVENT_TAGS or (tag == "admission-released" and
                                                      d.get("checkoutRoot") and d.get("branch"))
                    key = (root_label, tag)
                    if v3 and docket_tag and key not in seen_tags:
                        wanted.add(index)
                        seen_tags.add(key)
                covered = set()
                for nonce, indexes in by_nonce.items():
                    tags = {parsed[i].first().get("_tag") for i in indexes}
                    enqueues = [i for i in indexes if parsed[i].first().get("_tag") == "admission-enqueued"]
                    outcomes = [i for i in indexes if parsed[i].first().get("_tag") in
                                {"admission-withdrawn", "admission-admitted"}]
                    contention = bool(tags & EVICTIONS) or bool(enqueues and outcomes and
                                                               min(enqueues) < max(outcomes))
                    if not contention:
                        continue
                    if not tags & (EVICTIONS | {"admission-withdrawn"}):
                        d = parsed[min(enqueues)].first()
                        plain = ("plain-chain", (d.get("kind", ABSENT), d.get("priority", ABSENT)))
                        if plain in seen_classes:
                            continue
                        seen_classes.add(plain)
                    chain = [parsed[i] for i in indexes]
                    add(path, text, [p for e in chain for p in e.pairs], chain[0].start,
                        chain[-1].end, f"{name}:nonce={nonce}", "nonce-chain")
                    covered.update(indexes)
                for i in sorted(wanted - covered):
                    e = parsed[i]
                    add(path, text, e.pairs, e.start, e.end, f"{name}:record={i}", "first-event-tag")
            census.append({"pin": pin, "kind": kind, "files": len(files),
                           "observations": len(rendered) - count_before, "vocabulary_keys": len(seen_keys)})
            if seen_classes:
                classes_report[f"{pin}/{kind}"] = sorted(seen_classes)
    return rendered, {"census": census, "rules": dict(sorted(rules.items())),
                      "classes": classes_report, "total": len(rendered)}


def declared_commit(path):
    text = read_utf8(path)
    declarations = re.findall(r"^[ \t]*commit:", text, re.M)
    matches = COMMIT.findall(text)
    if len(declarations) != 1 or len(matches) != 1:
        raise AdapterError("expected exactly one well-formed 40-hex commit declaration")
    return matches[0][0] or matches[0][1]


def self_check(golden):
    records, census = extract_tree(golden / "input", GOLDEN_INPUT_REL,
                                   declared_commit(golden / "expected-metadata.yaml"))
    expected = {}
    for path in sorted((golden / "expected").iterdir()):
        if not path.is_file() or not EXPECTED_NAME.fullmatch(path.name):
            raise AdapterError("unexpected golden expected member")
        expected[path.name.removesuffix(".expected")] = path.read_bytes()
    if not expected or records != expected:
        missing, extra = expected.keys() - records.keys(), records.keys() - expected.keys()
        print(f"golden missing={sorted(missing)} extra={sorted(extra)}", file=sys.stderr)
        for name in sorted(expected.keys() & records.keys()):
            if expected[name] != records[name]:
                print("".join(difflib.unified_diff(expected[name].decode().splitlines(True),
                                                records[name].decode().splitlines(True))), file=sys.stderr)
        raise AdapterError("golden self-check failed")
    print(json.dumps(census, sort_keys=True))
    print(f"{ADAPTER_ID}@{ADAPTER_VERSION} self-check PASS ({len(records)} records)")


def main(args):
    try:
        if len(args) == 2 and args[0] == "--self-check":
            self_check(Path(args[1]))
            return 0
        if len(args) == 4 and args[0] == "--repo" and args[2] == "--out":
            repo, output = Path(args[1]), Path(args[3])
            records, census = extract_tree(repo / CORPUS_REL, CORPUS_REL,
                                           declared_commit(repo / MANIFEST_REL))
            output.mkdir(parents=True, exist_ok=True)
            for name, data in sorted(records.items()):
                target = output / name
                if target.exists() and target.read_bytes() != data:
                    raise AdapterError("output would overwrite different evidence")
                target.write_bytes(data)
            print(json.dumps(census, sort_keys=True))
            print(f"{ADAPTER_ID}@{ADAPTER_VERSION}: wrote {len(records)} SourceObservations")
            return 0
        raise AdapterError("usage: --self-check <golden-dir> | --repo <root> --out <dir>")
    except (AdapterError, OSError, UnicodeError) as error:
        print(f"{ADAPTER_ID}: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
