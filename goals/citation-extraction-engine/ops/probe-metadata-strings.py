#!/usr/bin/env python3
"""Observe actual source metadata string helpers and their year-search route."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
BINDINGS = "4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d"


def native(text):
    if text is None:
        return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--binding-corpus", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    import regex
    from eyecite import helpers, regexes
    assert importlib.metadata.version("regex") == "2023.12.25" and regex.DEFAULT_VERSION == regex.V0
    sha = lambda data: hashlib.sha256(data).hexdigest()
    binding_bytes = args.binding_corpus.read_bytes()
    assert sha(binding_bytes) == BINDINGS
    previous = json.loads(binding_bytes)["patterns"][5]
    assert previous["pattern"] == native(regexes.YEAR_REGEX) and previous["flags"] == 64
    seeds = [None, "", ", ", " , 12 , ", "\t,12,\t", ")", "2020", "2020 note", "2020-21", "2020) extra", "1999 (note)",
             "note) (extra)", "note (nested) more", "(nested)) extra", "unclosed (text", " 2020", "\U0001d7ce" * 4, "\ud835\udfce" * 4,
             "\U00011f50" * 4, "x" * 299, "x" * 300, "x" * 301, "x" * 301 + ") extra", "2020" + "x" * 301,
             "  ,é界\U0001f600, ", "é\ud800) extra", "((x))", ",  ,", "a\n", "200", "2020\n", "(2020)"]
    words = list(seeds)
    words += [chr(p) + ", value ," + chr(p) for p in range(128)]
    spaces = [chr(p) for p in range(0x110000) if chr(p).isspace()]
    words += [c + "2020" + c for c in spaces]
    digits = [chr(p) for p in range(0x110000) if regex.fullmatch(r"\d", chr(p))]
    assert len(digits) == 680
    words += [c * 4 for c in digits]
    words += [chr(p) * 4 for p in range(0x110000) if chr(p).isdigit() and not chr(p).isdecimal()]
    rows = []
    original = helpers.re.match
    for index, word in enumerate(words):
        calls = []
        def match(pattern, text, flags=0):
            calls.append((pattern, text, flags))
            return original(pattern, text, flags=flags)
        with patch.object(helpers.re, "match", match):
            parenthetical = helpers.process_parenthetical(word)
        assert len(calls) <= 1
        if calls:
            assert calls == [(regexes.YEAR_REGEX, word, regex.X)]
        rows.append({"id": index, "smoke": index < len(seeds), "source": native(word), "pin": native(helpers.clean_pin_cite(word)),
                     "parenthetical": native(parenthetical), "yearSearch": bool(calls)})
    out = {"schemaVersion": "citation-metadata-strings/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "regex": "2023.12.25",
           "producerSha256": sha(Path(__file__).read_bytes()), "helpersSha256": sha((root / "eyecite/helpers.py").read_bytes()),
           "bindingCorpusSha256": BINDINGS, "yearPattern": previous["pattern"], "bindings": previous["bindings"], "cases": rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(rows), "yearSearches": sum(row["yearSearch"] for row in rows),
                      "smokeCases": sum(row["smoke"] for row in rows), "smokeYearSearches": sum(row["yearSearch"] and row["smoke"] for row in rows)}))


if __name__ == "__main__":
    main()
