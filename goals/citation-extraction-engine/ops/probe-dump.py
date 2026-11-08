#!/usr/bin/env python3
"""Capture ordered builtin dump observations from pinned eyecite (BSD-2-Clause)."""
import argparse
import base64
import dataclasses
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def native(text):
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": base64.b64encode(b"".join(ord(c).to_bytes(width, "little") for c in text)).decode("ascii")}


def label(value):
    return value if value.isascii() else native(value)


def scalar(value):
    if value is None:
        return {"_tag": "None"}
    if isinstance(value, str):
        return {"_tag": "Text", "value": native(value)}
    if isinstance(value, bool):
        return {"_tag": "Boolean", "value": value}
    if isinstance(value, int):
        assert abs(value) <= 2**53-1
        return {"_tag": "Integer", "value": value}
    raise TypeError(type(value).__name__)


def view(citation):
    fields = []
    for name, value in citation.dump().items():
        if isinstance(value, dict):
            fields.append({"_tag": "Fields", "name": label(name),
                           "entries": [{"name": label(key), "value": scalar(item)} for key, item in value.items()]})
        else:
            fields.append({"_tag": "Scalar", "name": label(name), "value": scalar(value)})
    return {"kind": label(type(citation).__name__), "span": list(citation.span()), "fields": fields}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--cases", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert git("rev-parse", "HEAD") == PIN and not git("status", "--porcelain")
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == "cpython"
    assert importlib.metadata.version("eyecite") == "2.7.6"
    sys.path.insert(0, str(root))
    from eyecite import models
    from eyecite.utils import dump_citations
    classes = [getattr(models, name) for name in ("FullCaseCitation", "ShortCaseCitation", "FullJournalCitation",
               "FullLawCitation", "IdCitation", "SupraCitation", "ReferenceCitation", "UnknownCitation")]
    provenance = {"oracleCommit": PIN, "python": "3.11.15", "license": "BSD-2-Clause",
                  "producerSha256": sha(__file__), "licenseSha256": sha(root / "LICENSE"),
                  "sources": {name: sha(root / "eyecite" / name) for name in ("utils.py", "models.py")}}
    profile = {"schemaVersion": "citation-builtin-dump-profile/v1", **provenance,
               "classes": [{"kind": cls.__name__, "metadata": [f.name for f in dataclasses.fields(cls.Metadata)],
                            "year": issubclass(cls, models.ResourceCitation)} for cls in classes]}
    args.profile.write_text(json.dumps(profile, separators=(",", ":")) + "\n")
    cases = []
    texts = ["  before Foo v. Bar, 1 U.S. 2, 3-4 (1999). after  ", " a\n\tbefore X after\n next", "\x85\x1c a X b\x1f\xa0", "😀\ud800\udc00 X \u2028\ufeff Z"]
    for cls in classes:
        for text in texts:
            for start, end in [(0, len(text)), (2, 7), (-8, -2), (8, 2), (100, 120)]:
                for context in [0, 3, 30, -2, 2**53-1]:
                    citation = cls(models.Token("token", start, end, groups={"reporter": "U.S.", "page": "2", "nullable": None}), 0)
                    citation.metadata.pin_cite = "3'\"\\\n😀\ud800\udc00"
                    citation.metadata.pin_cite_span_end = 31
                    if isinstance(citation, models.ResourceCitation):
                        citation.year = 1999
                    inputs = {"text": native(text), "citations": [view(citation)], "contextChars": context}
                    cases.append({"input": inputs, "output": native(dump_citations([citation], text, context))})
    empty = classes[0](models.Token("", 0, 0), 0)
    cases.append({"input": {"text": native(""), "citations": [], "contextChars": 30}, "output": native("")})
    cases.append({"input": {"text": native(""), "citations": [view(empty), view(empty)], "contextChars": 30}, "output": native(dump_citations([empty, empty], ""))})
    unusual = classes[-1](models.Token("X", 0, 1), 0)
    unusual.groups["\ud800\udc00\u2028"] = "v"
    cases.append({"input": {"text": native("X"), "citations": [view(unusual)], "contextChars": 30},
                  "output": native(dump_citations([unusual], "X"))})
    output = {"schemaVersion": "citation-builtin-dump-cases/v1", **provenance, "profileSha256": sha(args.profile),
              "scope": "Builtin flat dump observations; hooks, subclasses and general retained model behavior remain open.", "cases": cases}
    args.cases.write_text(json.dumps(output, separators=(",", ":")) + "\n")
    print(json.dumps({"cases": len(cases), "profileSha256": sha(args.profile), "casesSha256": sha(args.cases)}))


if __name__ == "__main__":
    main()
