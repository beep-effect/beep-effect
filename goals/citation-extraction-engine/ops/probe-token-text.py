#!/usr/bin/env python3
"""Observe Tokenizer.append_text boundaries without regex/token constructors."""
import argparse
import hashlib
import itertools
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    def git(*xs):
        return subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("requires exact clean oracle")
    if sys.version_info[:3] != (3, 11, 15):
        raise SystemExit("requires pinned Python")
    sys.path.insert(0, str(root))
    from eyecite.tokenizers import Tokenizer
    alphabet = ["a", " ", "\t", "\n", "\ud800", "\U0001f600"]
    texts = ["".join(parts) for size in range(5) for parts in itertools.product(alphabet, repeat=size)]
    texts += ["\ud835\udfce \U0001d7ce", "a\u00a0b\u2003c", " a  b ", "\x00 \x00", "x" * 8193, " " * 8193]
    cases = []
    for index, text in enumerate(texts):
        parts = []
        Tokenizer.append_text(parts, text)
        spans = []
        cursor = 0
        for part in parts:
            assert part and text[cursor:cursor + len(part)] == part
            spans.append([cursor, cursor + len(part)])
            cursor += len(part)
        assert cursor == len(text)
        width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
        cases.append({"id": index, "source": {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}, "spans": spans})
    ranges = []
    range_texts = ["", "a b  c", "x\t y\nz", "a\u00a0b c", "\ud835\udfce \U0001d7ce", "\U0001f600 x", " a ", "x" * 8193 + " y"]
    for text in range_texts:
        bounds = [(start, end) for start in range(len(text) + 1) for end in range(start, len(text) + 1)] if len(text) < 100 else [(0, 8193), (4095, 8194), (8193, 8195)]
        width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
        source = {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}
        for start, end in bounds:
            parts = []
            Tokenizer.append_text(parts, text[start:end])
            cursor, spans = start, []
            for part in parts:
                spans.append([cursor, cursor + len(part)])
                cursor += len(part)
            assert cursor == end
            ranges.append({"id": len(ranges), "source": source, "start": start, "end": end, "spans": spans})
    out = {"schemaVersion": "citation-token-text/v2", "oracleCommit": PIN, "oracleTree": TREE,
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           "tokenizerSourceSha256": hashlib.sha256((root / "eyecite/tokenizers.py").read_bytes()).hexdigest(),
           "python": "3.11.15", "cases": cases, "ranges": ranges}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "ranges": len(ranges)}))


if __name__ == "__main__":
    main()
