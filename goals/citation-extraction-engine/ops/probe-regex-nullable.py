#!/usr/bin/env python3
"""Capture nullable literal/group controls under both pinned Python regex engines."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
from re import _parser
import sys
import unicodedata


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    assert sys.version_info[:3] == (3, 11, 15) and unicodedata.unidata_version == "14.0.0"
    import regex
    assert importlib.metadata.version("regex") == "2023.12.25"
    patterns = ["", "(?P<maybe>a)?", "(?P<maybe>a)?b?", "a*", "(?P<empty>)(b)?", "^a?", "(?P<a>a)?|b", "b|$"]
    texts = ["", "a", "b", "ab", "zz b", "\U0001d7ce\ud835\udfce", "a\n"]
    records = []
    for pattern in patterns:
        compiled = re.compile(pattern)
        observations = []
        for text in texts:
            engines = {}
            for name, engine in (("re", re), ("regex", regex)):
                program = engine.compile(pattern)
                assert (program.groups, program.groupindex) == (compiled.groups, compiled.groupindex)
                modes = {}
                for mode in ("finditer", "search", "match"):
                    matches = list(program.finditer(text)) if mode == "finditer" else [getattr(program, mode)(text)]
                    modes[mode] = [[list(match.span(group)) for group in range(program.groups + 1)] for match in matches if match is not None]
                engines[name] = modes
            assert engines["re"] == engines["regex"]
            observations.append({"source": native(text), "engines": engines})
        assert _parser.parse(pattern, 0).getwidth()[0] == 0
        records.append({"pattern": native(pattern), "patternSha256": hashlib.sha256(b"\x01" + pattern.encode("ascii")).hexdigest(), "flags": 0,
                        "profile": {"groups": compiled.groups, "names": dict(compiled.groupindex), "minimumWidthFloor": 0, "repeatedCaptures": False, "nullableMultiRepeat": False}, "cases": observations})
    out = {"schemaVersion": "citation-regex-nullable/v1", "python": "3.11.15", "unicode": "14.0.0", "regex": "2023.12.25", "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "scope": "Synthetic literal/group nullable controls independently executed by both engines; no third-party Unicode, source-family or full finditer target qualification.", "patterns": records}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"patterns": len(records), "cases": len(records) * len(texts), "observations": len(records) * len(texts) * 3 * 2}))


if __name__ == "__main__":
    main()
