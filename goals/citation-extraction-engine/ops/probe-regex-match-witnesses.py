#!/usr/bin/env python3
"""Observe CPython capture spans for a positive witness of every source extractor.

The witness builder only constructs data for the frozen parsed feature domain.
CPython re independently decides all matches; no target implementation is used.
It deliberately fails on an unseen opcode instead of inventing its semantics.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import unicodedata
from re import _parser

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode()


def category(name, point):
    return {"CATEGORY_DIGIT": point.isdecimal(), "CATEGORY_SPACE": point.isspace(),
            "CATEGORY_WORD": point.isalnum() or point == "_", "CATEGORY_NOT_SPACE": not point.isspace()}[str(name)]


def member(items, point):
    negated = bool(items and str(items[0][0]) == "NEGATE")
    found = False
    for op, value in items:
        name = str(op)
        if name == "NEGATE":
            continue
        if name == "LITERAL":
            found |= ord(point) == value
        elif name == "RANGE":
            found |= value[0] <= ord(point) <= value[1]
        elif name == "CATEGORY":
            found |= category(value, point)
        else:
            raise ValueError("unreviewed class opcode")
    return not found if negated else found


def witness(tree):
    parts = []
    for op, value in tree:
        name = str(op)
        if name == "LITERAL":
            parts.append(chr(value))
        elif name == "ANY":
            parts.append("a")
        elif name == "AT":
            if str(value) not in ("AT_BEGINNING", "AT_END"):
                raise ValueError("unreviewed anchor")
        elif name == "SUBPATTERN":
            if value[1:3] != (0, 0):
                raise ValueError("unreviewed scoped flags")
            parts.append(witness(value[3]))
        elif name == "BRANCH":
            parts.append(witness(value[1][0]))
        elif name == "MAX_REPEAT":
            if value[0] > 1024:
                raise ValueError("witness repetition exceeds fixed producer bound")
            parts.append(witness(value[2]) * value[0])
        elif name == "IN":
            candidates = [" ", "!", "0", "a", "_", "\n"]
            for sub, item in value:
                if str(sub) == "LITERAL":
                    candidates.append(chr(item))
                elif str(sub) == "RANGE":
                    candidates.append(chr(item[0]))
            parts.append(next(point for point in candidates if member(value, point)))
        else:
            raise ValueError("unreviewed source opcode")
    text = "".join(parts)
    if len(text) > 1024:
        raise ValueError("witness exceeds fixed producer bound")
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle source pin mismatch")
    if sys.version_info[:3] != (3, 11, 15) or unicodedata.unidata_version != "14.0.0":
        raise SystemExit("Python/Unicode version mismatch")
    source_path = Path(__file__).with_name("probe-regex-compatibility.py")
    spec = importlib.util.spec_from_file_location("regex_source_inventory", source_path)
    source = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(source)
    entries, hashes = source.source_entries()
    rows = []
    for identity, fields in entries:
        pattern = re.compile(fields["regex"], fields["flags"])
        if list(pattern.finditer("")):
            raise ValueError("source extractor unexpectedly matches empty input")
        positive = witness(_parser.parse(fields["regex"], fields["flags"]))
        if pattern.search(positive) is None:
            raise ValueError("constructed witness does not match source pattern: " + identity)
        # One scalar and two literal surrogate words must stay distinct through
        # native transport and offset projection. Never serialize this as a JS string.
        text = "\U0001d7ce\ud835\udfce " + positive + "  " + positive + " !"
        matches = [[list(match.span(group)) for group in range(pattern.groups + 1)] for match in pattern.finditer(text)]
        if not matches or len(matches) > 8:
            raise ValueError("unexpected bounded witness matches: " + identity)
        native = b"".join(ord(point).to_bytes(4, "little") for point in text)
        rows.append({"id": identity, "sourceWords": base64.b64encode(native).decode(),
                     "sourcePoints": len(text), "sourceUtf16": len(text.encode("utf-16-le", "surrogatepass")) // 2,
                     "captures": matches})
    if len(rows) != 13610:
        raise ValueError("source coverage changed")
    shards = []
    for index in range(16):
        start, end = index * len(rows) // 16, (index + 1) * len(rows) // 16
        shards.append({"index": index, "start": start, "end": end, "vectorSha256": sha(canonical(rows[start:end]))})
    output = {"schemaVersion": "citation-regex-match-witnesses/v1",
              "scope": "Positive source-extractor capture witnesses; not exhaustive matching or family scaling approval.",
              "oracleCommit": PIN, "oracleTree": TREE, "pythonVersion": "3.11.15", "unicodeVersion": "14.0.0",
              "producerSha256": sha(Path(__file__).read_bytes()), "sourceReaderSha256": sha(source_path.read_bytes()),
              "oracleLicense": json.loads((source.FIXTURES / "regex-inventory.json").read_text())["source"]["license"],
              "sources": hashes, "instances": len(rows), "emptyInstances": len(rows), "matches": sum(len(row["captures"]) for row in rows),
              "vectorSha256": sha(canonical(rows)), "shards": shards, "cases": rows}
    # Exactly one source-owned case per line, like the descriptor catalog.
    fields = []
    for key in sorted(output):
        value = output[key]
        rendered = "[\n" + ",\n".join("    " + canonical(row).decode() for row in value) + "\n  ]" if key == "cases" else canonical(value).decode()
        fields.append("  " + json.dumps(key) + ": " + rendered)
    args.output.write_text("{\n" + ",\n".join(fields) + "\n}\n")
    print(json.dumps({"instances": len(rows), "matches": output["matches"], "sha256": sha(args.output.read_bytes())}))


if __name__ == "__main__":
    main()
