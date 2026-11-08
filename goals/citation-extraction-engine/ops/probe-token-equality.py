#!/usr/bin/env python3
"""Capture builtin token dataclass equality from pinned eyecite (BSD-2-Clause)."""
import argparse
import dataclasses
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def native(text):
    if text is None:
        return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--edition-profile", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == "cpython"
    assert importlib.metadata.version("eyecite") == "2.7.6"
    sys.path.insert(0, str(root))
    from eyecite import models
    profile = json.loads(args.edition_profile.read_text())
    names = ["Thompson", "Cooke", "Holmes", "Olcott", "Chase", "Gilmer", "Bee", "Deady", "Taney", "U.S.", "thompson", "Thompson\u0301"]
    editions = [models.Edition(models.Reporter(n, n, "state", "reporters"), n, None, None) for n in names]
    editions += [models.Edition(editions[0].reporter, editions[0].short_name, None, None), models.Edition(editions[0].reporter, "different edition", None, None)]
    facts = [{"id": i, "equalityClass": next(j for j, other in enumerate(editions) if other == e), "reporterShortName": e.reporter.short_name} for i, e in enumerate(editions)]
    assert facts == [{k: v for k, v in row.items() if k != "hash"} for row in profile["bindings"]]
    identities = {id(e): i for i, e in enumerate(editions)}
    classes = [getattr(models, n) for n in ["Token", "CitationToken", "SectionToken", "SupraToken", "IdToken", "ParagraphToken", "StopWordToken", "PlaceholderCitationToken", "CaseReferenceToken"]]
    def make(cls, text):
        value = cls(text, 0, 1, {"a": "\ud800\udc00", "b": None})
        if cls is models.CitationToken:
            value.exact_editions = (editions[0], editions[9])
            value.variation_editions = (editions[0],)
        return value
    def seed(value):
        return {"kind": type(value).__name__, "data": native(value.data), "start": value.start, "end": value.end,
                "groups": {k: native(v) for k, v in value.groups.items()},
                "exact": [identities[id(e)] for e in getattr(value, "exact_editions", ())],
                "variation": [identities[id(e)] for e in getattr(value, "variation_editions", ())], "short": getattr(value, "short", False)}
    cases = []
    texts = ["x", "", None, "\x00", "😀", "\ud800\udc00", "\U00010000"]
    variants = ["same", "data", "projection", "start", "end", "groups", "groups-missing", "class", "short", "exact-alias", "exact-order", "exact-length", "variation"]
    def observe(left, right, label):
        cases.append({"label": label, "left": seed(left), "right": seed(right), "equal": left == right})
    for i, cls in enumerate(classes):
        for text in texts:
            for variant in variants:
                left, right = make(cls, text), make(cls, text)
                if variant == "data": right.data = "different"
                elif variant == "projection": right.data = "\U00010000"
                elif variant == "start": right.start = -1
                elif variant == "end": right.end = 2
                elif variant == "groups": right.groups = {"a": "\U00010000", "b": None}
                elif variant == "groups-missing": right.groups = {}
                elif variant == "class": right = make(classes[(i + 1) % len(classes)], text)
                elif variant == "short": right.short = True
                elif variant == "exact-alias": right.exact_editions = (editions[12], editions[9])
                elif variant == "exact-order": right.exact_editions = (editions[9], editions[0])
                elif variant == "exact-length": right.exact_editions = (editions[0], editions[0], editions[9])
                elif variant == "variation": right.variation_editions = (editions[9],)
                observe(left, right, variant)
    for left_cls in classes:
        for right_cls in classes:
            for text in ("x", "", None): observe(make(left_cls, text), make(right_cls, text), "class-pair")
    for field in ("exact_editions", "variation_editions"):
        for a in editions:
            for b in editions:
                left, right = make(models.CitationToken, "x"), make(models.CitationToken, "x")
                setattr(left, field, (a,))
                setattr(right, field, (b,))
                observe(left, right, field)
    histories = []
    for text in ("x", "", None):
        left, right = make(models.CitationToken, text), make(models.CitationToken, text)
        left.exact_editions = left.variation_editions = (editions[0], editions[0])
        right.exact_editions = right.variation_editions = (editions[12],)
        row = {"left": seed(left), "right": seed(right), "before": left == right}
        try:
            merged = left.merge(right)
            row["outcome"] = "left" if merged is left else "none"
        except TypeError:
            row["outcome"] = "error"
        row["after"] = left == right
        histories.append(row)
    output = {"schemaVersion": "citation-builtin-token-equality/v1", "oracleCommit": PIN, "python": "3.11.15",
              "license": "BSD-2-Clause", "licenseSha256": sha(root / "LICENSE"), "sourceSha256": sha(root / "eyecite/models.py"),
              "producerSha256": sha(__file__), "editionProfileSha256": sha(args.edition_profile), "editionBindings": profile["bindings"],
              "comparisonFields": {cls.__name__: [f.name for f in dataclasses.fields(cls) if f.compare] for cls in classes},
              "scope": "Owned builtin fields and frozen edition value equality; external mutations, custom classes, hashes and general UserString protocols remain open.",
              "cases": cases, "histories": histories}
    args.output.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(json.dumps({"cases": len(cases), "histories": len(histories), "sha256": sha(args.output), "editionProfileSha256": sha(args.edition_profile)}))


if __name__ == "__main__":
    main()
