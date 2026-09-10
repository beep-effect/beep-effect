#!/usr/bin/env python3
"""Run-3 properties evidence, with a vocabulary census and disclosed docket joins.

Execute a reviewed trusted copy through run_adapter_sandbox.sh. The repository
copy is provenance. Only four named pins' properties projections are read;
the run manifest supplies the independently checked commit. No raw payload or
corpus manifest is executed or parsed. See adapters/README.md for the rule table.

A chain is one observation per (pin, root, nonce), spanning its first through
last event. Facts come only from that nonce's stanzas. The complete verbatim
span is retained in source_excerpt, including interleaved stanzas, so each tag,
instant and checkout pairing remains reconstructible without opening a file.
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
ADAPTER_VERSION = "1.1.0"
ONTOLOGY_REL = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops"
SCRIPT = f"{ONTOLOGY_REL}/adapters/adapter-journal-run3.py"
CORPUS_REL = f"{ONTOLOGY_REL}/corpus"
MANIFEST_REL = f"{ONTOLOGY_REL}/work/run-manifest.yaml"
GOLDEN_INPUT_REL = f"{ONTOLOGY_REL}/adapters/golden/journal-run3/input"
PINS = ("run3-fleet", "run3-checkout-identity", "run3b-fleet", "run3b-synthetic")
EVENT_TAGS = frozenset(("admission-enqueued", "admission-withdrawn",
                        "admission-lease-evicted", "admission-ticket-evicted"))
EVICTIONS = frozenset(("admission-lease-evicted", "admission-ticket-evicted"))
CACHE_KEYS = frozenset(("cachePlan", "cachePlanTag", "turboCachePlan", "turboCachePlanTag",
                        "cachePosture", "resolvedCachePosture", "resolverResult"))
CACHE_TAGS = frozenset(("caller-controlled", "local-only", "remote-read"))
BINDING_KEYS = ("kind", "turbo_local_cache_present", "turbo_remote_cache_configured")
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


def binding_classes(pairs):
    d = {p.key: p.value for p in first_pairs(pairs)}
    classes = {(key, d.get(key, "<absent>")) for key in BINDING_KEYS}
    gd, common = d.get("git_dir"), d.get("git_common_dir")
    linkage = "absent" if not gd or not common else "same" if gd == common else "linked"
    classes.add(("git-dir-linkage", linkage))
    # The pin has clone/linked-worktree, not a canonical-runtime kind. Never
    # reclassify a checkout by a suggestive filename or branch spelling.
    return classes


def verdict_classes(pairs):
    d = {p.key: p.value for p in first_pairs(pairs)}
    classes = set()
    if d.get("failureKind") and d.get("failedStepId"):
        classes.add(("failure-signature", d["failureKind"], d["failedStepId"]))
    for p in pairs:
        if p.key in CACHE_KEYS or (p.key in ("tag", "_tag") and p.value in CACHE_TAGS):
            classes.add(("cache-plan", p.key, p.value))
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
                end = len(text.splitlines(keepends=True))
                fresh = [p for p in eligible(first_pairs(pairs), text) if p.key not in seen_keys]
                seen_keys.update(p.key for p in fresh)
                name = f"{pin}/{path.relative_to(root).as_posix()}"
                selected = False
                rule = "vocabulary"
                if pin == "run3b-synthetic":
                    selected, rule = True, "synthetic-all"
                elif pin == "run3-checkout-identity" and kind == "bindings":
                    classes = binding_classes(pairs)
                    selected = bool(classes - seen_classes)
                    seen_classes.update(classes)
                    rule = "binding-class" if selected else rule
                elif kind == "verdicts":
                    classes = verdict_classes(pairs)
                    selected = bool(classes - seen_classes)
                    seen_classes.update(classes)
                    rule = "verdict-class" if selected else rule
                if selected or fresh:
                    add(path, text, pairs if selected else fresh, 1, end, name, rule)
                if kind != "admission" or path.name != "journal.properties" or pin == "run3b-synthetic":
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
