#!/usr/bin/env python3
"""Export normalized public-operation observations from the unmodified pin.

The AST call-site inventory is independent of runtime capture. These operation
observations supplement, and do not replace, model/helper assertion accounting.
Coordinates explicitly name the string they index; cleaned-text ranges are
never mislabeled as verified raw-source anchors.
"""

import argparse
import ast
import dataclasses
from datetime import datetime
import functools
import hashlib
import importlib
import importlib.metadata
import inspect
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import unittest


PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
OPERATIONS = {
    "clean_text": "eyecite.clean",
    "get_citations": "eyecite.find",
    "resolve_citations": "eyecite.resolve",
    "annotate_citations": "eyecite.annotate",
}
SCHEMA_VERSION = "citation-oracle-operations/v1"
CLOCK = "2026-10-28"


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def source_inventory(root):
    rows = []
    for path in sorted((root / "tests").glob("test_*.py")):
        relative = path.relative_to(root).as_posix()
        raw = path.read_bytes()
        for node in ast.walk(ast.parse(raw)):
            if not isinstance(node, ast.Call):
                continue
            name = node.func.id if isinstance(node.func, ast.Name) else None
            if name in OPERATIONS:
                rows.append({
                    "id": f"{relative}:{node.lineno}:{node.col_offset}:{name}",
                    "path": relative, "line": node.lineno,
                    "column": node.col_offset, "operation": name,
                    "sourceSha256": sha(raw),
                })
    return sorted(rows, key=lambda row: (row["path"], row["line"], row["column"]))


def capture(root, sites):
    import eyecite
    from eyecite.annotate import SpanUpdater
    from eyecite.models import CitationBase, Document, Edition, Reporter, TokenExtractor
    from eyecite.tokenizers import EXTRACTORS, Tokenizer

    artifacts = {}
    cases = []
    counts = {}
    current = {"test": None}
    active = []
    source_hashes = {}
    immutable_values = {}
    callable_values = {}
    extractor_values = {}
    tokenizer_values = {}
    by_location = {}
    for row in sites:
        key = (row["path"], row["line"], row["operation"])
        if key in by_location:
            raise RuntimeError(f"multiple operation calls on one line need column tracing: {key}")
        by_location[key] = row

    def normal_field(name, value):
        snapshot = normal(value)
        if name in ("exact_editions", "variation_editions", "all_editions"):
            return sorted(snapshot, key=encoded)
        return snapshot

    def normal(value):
        if value is None or isinstance(value, (bool, str)):
            return value
        if isinstance(value, int):
            # Preserve Python integers beyond JavaScript's exact-number range.
            return value if abs(value) <= 9007199254740991 else {"integer": str(value)}
        if isinstance(value, float):
            raise TypeError("floating-point oracle values require an explicit comparison law")
        if isinstance(value, type):
            return {"pythonType": f"{value.__module__}.{value.__qualname__}"}
        if isinstance(value, datetime):
            return {"datetime": value.isoformat()}
        if isinstance(value, Tokenizer):
            config = normal(value.extractors)
            fingerprint = tuple(id(extractor) for extractor in config)
            previous = tokenizer_values.get(id(value))
            if previous is not None and previous[0] == fingerprint:
                return previous[1]
            config_hash = sha(encoded(config).encode())
            artifacts[config_hash] = {"kind": "tokenizer-extractors", "value": config}
            descriptor = {"tokenizer": type(value).__name__, "extractorsSha256": config_hash}
            tokenizer_values[id(value)] = (fingerprint, descriptor, value)
            return descriptor
        if isinstance(value, TokenExtractor):
            # Compare all declared configuration fields. Cached compiled regexes
            # are execution details outside the dataclass and never evidence.
            constructor, extra = normal(value.constructor), normal(value.extra)
            fingerprint = (value.regex, value.flags, tuple(value.strings), constructor, extra)
            previous = extractor_values.get(id(value))
            if previous is not None and previous[0] == fingerprint:
                return previous[1]
            snapshot = {"pythonType": "eyecite.models.TokenExtractor", "fields": {
                "regex": value.regex, "flags": value.flags, "strings": list(value.strings),
                "constructor": constructor, "extra": extra}}
            extractor_values[id(value)] = (fingerprint, snapshot, value)
            return snapshot
        if isinstance(value, CitationBase):
            fields = {field.name: normal_field(field.name, getattr(value, field.name))
                      for field in dataclasses.fields(value) if field.name != "document"}
            return {
                "citationType": type(value).__name__, "fields": fields,
                "matchedText": value.matched_text(),
                "correctedCitation": value.corrected_citation(),
                "correctedFullCitation": value.corrected_citation_full(),
                "span": normal(value.span()), "fullSpan": normal(value.full_span()),
                "spanWithPincite": normal(value.span_with_pincite()),
            }
        if isinstance(value, SpanUpdater):
            return {"spanUpdater": {"offsets": normal(value.offsets), "updaters": normal(value.updaters)}}
        if isinstance(value, functools.partial):
            return {"partial": normal(value.func), "args": normal(value.args), "keywords": normal(value.keywords)}
        if dataclasses.is_dataclass(value):
            # Frozen Resource contains a mutable citation. Only the deeply
            # immutable vocabulary values may be memoized or shared by hash.
            immutable = isinstance(value, (Reporter, Edition))
            if immutable and id(value) in immutable_values:
                return immutable_values[id(value)][1]
            snapshot = {"pythonType": f"{type(value).__module__}.{type(value).__qualname__}",
                        "fields": {field.name: normal_field(field.name, getattr(value, field.name))
                                   for field in dataclasses.fields(value)}}
            if immutable:
                content = encoded(snapshot)
                content_hash = sha(content.encode())
                artifacts[content_hash] = {"kind": "model-value", "value": snapshot}
                reference = {"artifactSha256": content_hash}
                immutable_values[id(value)] = (value, reference)
                return reference
            return snapshot
        if isinstance(value, dict):
            if all(isinstance(key, str) for key in value):
                return {key: normal_field(key, item) for key, item in sorted(value.items())}
            return {"mapping": [[normal(key), normal(item)] for key, item in value.items()]}
        if isinstance(value, (list, tuple)):
            return [normal(item) for item in value]
        if isinstance(value, (set, frozenset)):
            return {"set": sorted([normal(item) for item in value], key=encoded)}
        if callable(value):
            if id(value) in callable_values:
                return callable_values[id(value)][1]
            code = getattr(value, "__code__", None)
            descriptor = {"callable": f"{value.__module__}.{value.__qualname__}"}
            if code is not None:
                path = Path(code.co_filename).resolve()
                if path.is_relative_to(root):
                    if path not in source_hashes:
                        source_hashes[path] = sha(path.read_bytes())
                    descriptor.update({"path": path.relative_to(root).as_posix(), "line": code.co_firstlineno,
                                       "sourceSha256": source_hashes[path]})
            callable_values[id(value)] = (value, descriptor)
            return descriptor
        raise TypeError(f"unclassified oracle value: {type(value).__module__}.{type(value).__qualname__}")

    def span(text, bounds):
        start, end = bounds
        if not (0 <= start <= end <= len(text)):
            raise ValueError(f"oracle range out of bounds: {start}, {end}, length {len(text)}")
        return {"python": [start, end],
                "utf16": [len(text[:start].encode("utf-16-le")) // 2,
                          len(text[:end].encode("utf-16-le")) // 2],
                "text": text[start:end], "coordinateSpace": "plain-text"}

    def document_snapshot(document):
        return {"sourceText": document.source_text, "plainText": document.plain_text,
                "markupText": document.markup_text,
                "words": normal(document.words), "citationTokens": normal(document.citation_tokens),
                "emphasisTags": normal(document.emphasis_tags)}

    original_tokenize = Document.tokenize

    @functools.wraps(original_tokenize)
    def tokenize(document, *args, **kwargs):
        result = original_tokenize(document, *args, **kwargs)
        if active and active[-1]["operation"] == "get_citations":
            active[-1]["stages"]["document"] = document_snapshot(document)
        return result

    def wrap(name, original):
        signature = inspect.signature(original)

        @functools.wraps(original)
        def operation(*args, **kwargs):
            caller = inspect.currentframe().f_back
            path = Path(caller.f_code.co_filename).resolve()
            if not path.is_relative_to(root / "tests"):
                return original(*args, **kwargs)
            relative = path.relative_to(root).as_posix()
            site = by_location.get((relative, caller.f_lineno, name))
            if site is None:
                raise RuntimeError(f"runtime operation has no AST site: {relative}:{caller.f_lineno}:{name}")
            bound = signature.bind(*args, **kwargs)
            bound.apply_defaults()
            key = (current["test"], site["id"])
            ordinal = counts.get(key, 0) + 1
            counts[key] = ordinal
            case = {"id": f"{current['test']}::{site['id']}::{ordinal}",
                    "test": current["test"], "sourceSiteId": site["id"], "ordinal": ordinal,
                    "operation": name, "input": normal(dict(bound.arguments)), "stages": {}}
            cases.append(case)
            active.append(case)
            try:
                output = original(*args, **kwargs)
                case["outcome"] = {"kind": "success", "value": normal(output)}
                if name == "get_citations":
                    document = case["stages"].get("document")
                    if document is None:
                        raise RuntimeError("extraction returned without an observed document")
                    case["stages"]["citationSpans"] = [
                        {"span": span(document["plainText"], citation.span()),
                         "fullSpan": span(document["plainText"], citation.full_span()),
                         "spanWithPincite": span(document["plainText"], citation.span_with_pincite())}
                        for citation in output]
                if name == "resolve_citations":
                    citations = bound.arguments["citations"]
                    # Preserve occurrence membership, never compare equal citations by index().
                    occurrence = {id(citation): index for index, citation in enumerate(citations)}
                    case["stages"]["resolutionGroups"] = [
                        {"resource": normal(resource),
                         "members": [occurrence[id(citation)] for citation in members]}
                        for resource, members in output.items()]
                case["normalizedSha256"] = sha(encoded({"input": case["input"], "stages": case["stages"],
                                                         "outcome": case["outcome"]}).encode())
                return output
            except (ValueError, TypeError) as error:
                # Only capture failures thrown by the oracle itself. Export failures
                # (including unsupported values) must fail the whole generation.
                if "outcome" in case:
                    raise
                case["outcome"] = {"kind": "failure", "pythonType": f"{type(error).__module__}.{type(error).__qualname__}",
                                   "message": str(error)}
                case["normalizedSha256"] = sha(encoded({"input": case["input"], "stages": case["stages"],
                                                         "outcome": case["outcome"]}).encode())
                raise
            finally:
                active.pop()
        return operation

    patches = [(Document, "tokenize", original_tokenize)]
    Document.tokenize = tokenize
    import eyecite.find as find_module

    def track_filter(kind, original):
        @functools.wraps(original)
        def filtered(citations):
            if not active or active[-1]["operation"] != "get_citations":
                return original(citations)
            snapshot = normal(citations)
            indices = {id(citation): index for index, citation in enumerate(citations)}
            output = original(citations)
            active[-1]["stages"].setdefault("filtering", []).append({
                "kind": kind, "candidates": snapshot,
                "retained": [indices[id(citation)] for citation in output],
            })
            return output
        return filtered

    for name, kind in (("filter_citations", "filter"), ("disambiguate_reporters", "disambiguate")):
        original = getattr(find_module, name)
        patches.append((find_module, name, original))
        setattr(find_module, name, track_filter(kind, original))

    class WarningCapture(logging.Handler):
        def emit(self, record):
            if active and active[-1]["operation"] == "get_citations" and record.levelno >= logging.WARNING:
                active[-1]["stages"].setdefault("warnings", []).append({
                    "logger": record.name, "messageTemplate": record.msg, "arguments": normal(record.args),
                })

    warning_capture = WarningCapture()
    logging.getLogger("eyecite").addHandler(warning_capture)
    for name, module_name in OPERATIONS.items():
        module = importlib.import_module(module_name)
        original = getattr(module, name)
        replacement = wrap(name, original)
        for owner in (module, eyecite):
            patches.append((owner, name, getattr(owner, name)))
            setattr(owner, name, replacement)

    # The pin observes the current year in two locations. Freeze that explicit
    # environment input without modifying tracked source or legal field values.
    import eyecite.helpers as helpers
    import eyecite.models as models

    class OracleDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            value = cls.fromisoformat(CLOCK + "T12:00:00")
            return value if tz is None else value.replace(tzinfo=tz)

    models.datetime = OracleDatetime
    helpers._highest_valid_year = int(CLOCK[:4]) + 1
    suite = unittest.defaultTestLoader.discover(str(root / "tests"), pattern="test_*.py", top_level_dir=str(root))
    for module_name, module in list(sys.modules.items()):
        if module_name.startswith("tests.") and getattr(module, "datetime", None) is datetime:
            module.datetime = OracleDatetime

    class Result(unittest.TextTestResult):
        def startTest(self, test):
            current["test"] = test.id()
            super().startTest(test)

    try:
        result = unittest.TextTestRunner(verbosity=1, resultclass=Result).run(suite)
    finally:
        logging.getLogger("eyecite").removeHandler(warning_capture)
        for owner, name, value in reversed(patches):
            setattr(owner, name, value)
    if not result.wasSuccessful():
        raise RuntimeError("instrumented official suite did not pass")
    observed = {case["sourceSiteId"] for case in cases}
    missing = [site["id"] for site in sites if site["id"] not in observed]
    if missing:
        raise RuntimeError(f"unobserved operation sites: {missing}")
    return cases, artifacts, result.testsRun


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root, output = args.oracle_root.resolve(), args.output.resolve()
    if sys.version_info[:2] != (3, 11):
        raise SystemExit("Python 3.11 required")
    if os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization != 0:
        raise SystemExit("PYTHONHASHSEED=0 must be set before starting the oracle interpreter")
    if git(root, "rev-parse", "HEAD") != PIN or git(root, "rev-parse", "HEAD^{tree}") != TREE:
        raise SystemExit("oracle pin/tree mismatch")
    if git(root, "status", "--porcelain"):
        raise SystemExit("oracle source is dirty")
    sites = source_inventory(root)
    os.chdir(root)
    sys.path.insert(0, str(root))
    cases, artifacts, tests_run = capture(root, sites)
    if git(root, "status", "--porcelain"):
        raise SystemExit("oracle source changed during execution")
    # A canonical JSON string is the single encoded owner of each observation.
    # Consumers hash its original UTF-8 bytes and decode through Effect Schema;
    # they do not reserialize Python values with JavaScript key/number rules.
    for case in cases:
        if case["operation"] == "get_citations":
            case["stages"].setdefault("warnings", [])
            case["stages"].setdefault("filtering", [])
        case["normalizedSha256"] = sha(encoded({key: case[key] for key in ("input", "stages", "outcome")}).encode())
        case["payload"] = encoded({key: case.pop(key) for key in ("input", "stages", "outcome")})
    artifacts = {key: {"kind": artifact["kind"], "payload": encoded(artifact["value"])}
                 for key, artifact in artifacts.items()}
    payload = {"schemaVersion": SCHEMA_VERSION,
               "scope": "public-operation-observations; model/helper assertion proof remains separate",
               "commit": PIN, "tree": TREE, "clockDate": CLOCK, "hashSeed": "0",
               "normalizationVersion": "public-operation-normalization/v1",
               "python": sys.version.split()[0], "testsRun": tests_run,
               "license": "BSD-2-Clause", "licenseSha256": sha((root / "LICENSE").read_bytes()),
               "lockSha256": sha((root / "uv.lock").read_bytes()),
               "exporterSha256": sha(Path(__file__).read_bytes()),
               "dependencies": {name: importlib.metadata.version(name) for name in
                                ["eyecite", "reporters-db", "courts-db", "regex", "lxml", "fast-diff-match-patch", "pyahocorasick"]},
               "sourceSites": sites, "cases": cases, "artifacts": artifacts}
    output.parent.mkdir(parents=True, exist_ok=True)
    # One record per line keeps the generated diff reviewable without
    # distributing the same reporter/edition structure thousands of times.
    head = {key: value for key, value in payload.items() if key not in ("cases", "artifacts")}
    text = json.dumps(head, ensure_ascii=False, indent=2)[:-2] + ',\n  "cases": [\n'
    text += ",\n".join("    " + encoded(case) for case in cases)
    text += '\n  ],\n  "artifacts": {\n'
    text += ",\n".join("    " + encoded(key) + ":" + encoded(value) for key, value in sorted(artifacts.items()))
    text += "\n  }\n}\n"
    output.write_text(text)
    print(f"public operation sites={len(sites)}; observations={len(cases)}; artifacts={len(artifacts)}; methods={tests_run}")


if __name__ == "__main__":
    main()
