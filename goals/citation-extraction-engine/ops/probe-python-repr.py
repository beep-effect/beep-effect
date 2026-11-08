#!/usr/bin/env python3
"""Capture pinned CPython printability inputs and independent native repr outputs (PSF-2.0)."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import unicodedata


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "hex": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cpython-source", type=Path, required=True)
    parser.add_argument("--table", type=Path, required=True)
    parser.add_argument("--cases", type=Path, required=True)
    args = parser.parse_args()
    assert sys.implementation.name == "cpython" and sys.version_info[:3] == (3, 11, 15)
    assert unicodedata.unidata_version == "14.0.0"
    assert sha(args.cpython_source) == "5dde8eb1b99878b4ea113cd6b5f88bca3667b0e23dc8c5262a07f5ea14d0d82e"
    ranges = []
    start = None
    for point in range(0x110000):
        printable = chr(point).isprintable()
        if printable and start is None:
            start = point
        if start is not None and (not printable or point == 0x10ffff):
            ranges.append([start, point - 1 if not printable else point])
            start = None
    table = {"schemaVersion": "citation-python-printability/v1", "python": "3.11.15", "unicode": "14.0.0",
             "sourceSha256": sha(args.cpython_source), "sourceUrl": "https://github.com/python/cpython/blob/v3.11.15/Objects/unicodeobject.c",
             "license": "PSF-2.0", "producerSha256": sha(__file__), "printableRanges": ranges}
    args.table.write_text(json.dumps(table, separators=(",", ":")) + "\n")
    points = set(range(256)) | {0xd800, 0xdbff, 0xdc00, 0xdfff, 0x10000, 0x10ffff}
    for left, right in ranges:
        points.update(p for p in (left-1, left, right, right+1) if 0 <= p <= 0x10ffff)
    strings = ["", "'", '"', "'\"", "\"'", "\\\t\n\r", "\ud800\udc00", "😀", "a'😀\"b"]
    strings.extend(chr(p) for p in sorted(points))
    alphabet = [chr(p) for p in [0, 9, 10, 13, 27, 32, 39, 34, 92, 127, 160, 255, 0x300, 0x2000, 0x2028, 0xd800, 0xdc00, 0xffff, 0x1f600]]
    strings.extend(a + b for a in alphabet for b in alphabet)
    strings = list(dict.fromkeys(strings))
    cases = {"schemaVersion": "citation-python-repr-cases/v1", "python": "3.11.15", "unicode": "14.0.0",
             "license": "PSF-2.0", "sourceSha256": sha(args.cpython_source), "tableSha256": sha(args.table),
             "producerSha256": sha(__file__), "scope": "Builtin str repr only; subclass hooks and general object repr remain open.",
             "cases": [{"input": native(text), "output": native(repr(text))} for text in strings]}
    args.cases.write_text(json.dumps(cases, separators=(",", ":")) + "\n")
    print(json.dumps({"ranges": len(ranges), "cases": len(strings), "sourceSha256": sha(args.cpython_source),
                      "tableSha256": sha(args.table), "casesSha256": sha(args.cases)}))


if __name__ == "__main__":
    main()
