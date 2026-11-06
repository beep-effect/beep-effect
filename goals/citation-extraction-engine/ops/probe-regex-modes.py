#!/usr/bin/env python3
"""Pinned CPython observations distinguishing iteration, search and prefix match."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if sys.version_info[:3] != (3, 11, 15) or unicodedata.unidata_version != "14.0.0":
        raise SystemExit("Python/Unicode pin mismatch")
    pattern = "(?P<maybe>a)?(b)"
    compiled = re.compile(pattern)
    digest = hashlib.sha256(b"\x01" + pattern.encode("ascii")).hexdigest()
    cases = []
    for index, text in enumerate(["b ab", "zz b ab", "ab b", "\U0001d7ce\ud835\udfce b", ""]):
        width = 4 if any(ord(point) > 0xffff for point in text) else 1
        native = b"".join(ord(point).to_bytes(width, "little") for point in text)
        modes = {}
        for mode in ("finditer", "search", "match"):
            observed = list(compiled.finditer(text)) if mode == "finditer" else [getattr(compiled, mode)(text)]
            modes[mode] = [[list(match.span(group)) for group in range(compiled.groups + 1)]
                           for match in observed if match is not None]
        cases.append({"id": index, "width": width, "sourceWords": base64.b64encode(native).decode(),
                      "sourcePoints": len(text), "modes": modes})
    output = {"schemaVersion": "citation-regex-mode-controls/v1",
              "scope": "Synthetic CPython operation-selection controls; no source-family approval.",
              "pythonVersion": "3.11.15", "unicodeVersion": "14.0.0",
              "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "pattern": pattern, "patternSha256": digest, "flags": 0,
              "profile": {"groups": compiled.groups, "names": dict(compiled.groupindex),
                          "minimumWidthFloor": 1, "repeatedCaptures": False, "nullableMultiRepeat": False},
              "cases": cases}
    args.output.write_text(json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "evaluations": 3 * len(cases),
                      "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == "__main__":
    main()
