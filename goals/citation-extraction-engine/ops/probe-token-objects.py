#!/usr/bin/env python3
"""Observe source token constructors and base/citation merge return identities."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def seed(token):
    return {"kind": type(token).__name__, "data": native(token.data), "start": token.start, "end": token.end,
            "groups": {k: native(v) for k, v in token.groups.items()}, "exact": [], "variation": [], "short": getattr(token, "short", False)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--oracle-root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    def git(*xs):
        return subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("requires exact clean oracle")
    if sys.version_info[:3] != (3, 11, 15):
        raise SystemExit("requires pinned Python")
    sys.path.insert(0, str(root))
    from eyecite import models
    names = ["Token", "CitationToken", "SectionToken", "SupraToken", "IdToken", "ParagraphToken", "StopWordToken", "PlaceholderCitationToken", "CaseReferenceToken"]
    witnesses = [(r"(?P<value>.)", t) for t in ("x", "\U0001f600", "\ud835\udfce", "\x00", "\ud800")]
    witnesses += [(r"(?P<value>a)?", "x"), (r"(?P<value>)", ""), (r"(?P<first>x)(?P<tail>y)?", "x"), (r"(?P<a>x)(?P<b>y)", "xy"), (r"(?P<á>x)", "x"), (r"(?P<__proto__>x)", "x")]
    constructors = []
    for name in names:
        cls = getattr(models, name)
        for pattern, text in witnesses:
            match = re.search(pattern, text)
            assert match is not None
            for offset in (0, 7, -3):
                raw = cls.from_match(match, {}, 0)
                actual = cls.from_match(match, {}, offset)
                constructors.append({"id": len(constructors), "input": seed(raw), "offset": offset, "expected": seed(actual)})
    merges = []
    for name in names:
        cls = getattr(models, name)
        for data in ("x", "", None):
            for variant in ("same", "data", "groups-order", "groups-value", "groups-missing", "span", "class", "short"):
                left = cls(data, 0, 1, {"a": "\ud835\udfce", "b": None})
                right_cls = models.IdToken if name != "IdToken" else models.Token
                right = (right_cls if variant == "class" else cls)("different" if variant == "data" else data, 1 if variant == "span" else 0, 1, {"b": None, "a": "\ud835\udfce"} if variant == "groups-order" else {"a": "\U0001d7ce" if variant == "groups-value" else "\ud835\udfce", "b": None})
                if variant == "groups-missing":
                    del right.groups["b"]
                if variant == "short" and name == "CitationToken":
                    right.short = True
                a, b = seed(left), seed(right)
                try:
                    result = left.merge(right)
                    outcome = "left" if result is left else "none"
                    try:
                        truth = bool(result)
                    except TypeError:
                        truth = None
                except TypeError:
                    outcome, truth = "error", None
                merges.append({"id": len(merges), "left": a, "right": b, "outcome": outcome, "truth": truth})
    out = {"schemaVersion": "citation-token-objects/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15",
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "constructors": constructors, "merges": merges}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"constructors": len(constructors), "merges": len(merges)}))


if __name__ == "__main__":
    main()
