#!/usr/bin/env python3
"""Capture verbose grammar and matching from both exact pinned Python engines."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
from re import _parser
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def cpython_profile(tree):
    def walk(node, repeated=False):
        captures = repeated_capture = nullable = False
        for kind, value in node:
            name = str(kind)
            if name == "SUBPATTERN":
                captures = True
                repeated_capture |= repeated
                child = walk(value[3], repeated)
            elif name == "BRANCH":
                children = [walk(branch, repeated) for branch in value[1]]
                child = tuple(any(row[index] for row in children) for index in range(3))
            elif name in ("MAX_REPEAT", "MIN_REPEAT", "POSSESSIVE_REPEAT"):
                multiple = value[1] > 1
                nullable |= multiple and value[2].getwidth()[0] == 0
                child = walk(value[2], repeated or multiple)
            else:
                child = (False, False, False)
            captures |= child[0]
            repeated_capture |= child[1]
            nullable |= child[2]
        return captures, repeated_capture, nullable
    _, captures, nullable = walk(tree)
    return tree.getwidth()[0], captures, nullable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    import regex
    from regex import _regex_core as core
    assert importlib.metadata.version("regex") == "2023.12.25" and regex.DEFAULT_VERSION == regex.V0
    sha = lambda data: hashlib.sha256(data).hexdigest()
    def v0_profile(node, repeated=False):
        name = type(node).__name__
        if name == "Fuzzy":
            raise NotImplementedError("fuzzy")
        if isinstance(node, core.Group):
            width, _, inner_repeat, nullable = v0_profile(node.subpattern, repeated)
            return width, True, repeated or inner_repeat, nullable
        if isinstance(node, (core.GreedyRepeat, core.LazyRepeat, core.PossessiveRepeat)):
            multiple = node.max_count is None or node.max_count > 1
            width, captures, inner_repeat, nullable = v0_profile(node.subpattern, repeated or multiple)
            return width * node.min_count, captures, inner_repeat, nullable or (multiple and width == 0)
        if isinstance(node, (core.Sequence, core.Branch)):
            rows = [v0_profile(item, repeated) for item in (node.items if isinstance(node, core.Sequence) else node.branches)]
            width = sum(row[0] for row in rows) if isinstance(node, core.Sequence) else min(row[0] for row in rows)
            return width, *(any(row[index] for row in rows) for index in range(1, 4))
        assert name in ("Character", "String", "Property", "Range", "SetUnion", "Any", "StartOfString", "EndOfString", "EndOfStringLine"), name
        return (0 if node.is_empty() else node.max_width()), False, False, False
    definitions = [
        ("", ["", "x"], 64, False),
        (" a # comment\n b ", ["ab", "a#b"], 64, True),
        (" # comment only", ["", "x"], 64, False),
        (r"a\#b", ["a#b", "ab"], 64, False),
        (r"a\ b", ["a b", "ab"], 64, False),
        ("[ #]+", [" ##", "a"], 64, True),
        (r"[a #\t] ?", ["a", "#"], 64, False),
        ("a # comment\n *", ["aaa", "b"], 64, False),
        ("a * ?", ["aaa", "b"], 64, True),
        ("a{ 1, 2}", ["a{1,2}", "aa"], 64, True),
        ("a{1, 2}", ["a{1,2}", "aa"], 64, False),
        ("a{, 2}", ["a{,2}", "aa"], 64, False),
        ("a{1,# comment\n2}", ["a{1,2}", "aa"], 64, False),
        ("a {1} ?", ["a", "b"], 64, False),
        ("(?P< x > a)", ["a", "b"], 64, True),
        ("(?P<x y>a)", ["a", "b"], 64, False),
        ("(?P # comment\n <x> a)", ["a", "b"], 64, False),
        ("(? P<x>a)", ["a", "b"], 64, False),
        ("(? :a)", ["a", "b"], 64, False),
        ("( a ) +", ["aa", "b"], 64, False),
        ("(?P<x>a # comment\n) b", ["ab", "a"], 64, False),
        ("(?: a | b ) +", ["ab", "c"], 64, False),
        (r"\x 6 1", ["a", "b"], 64, True),
        (r"[\x 6 1]", ["a", "6"], 64, False),
        ("a\\x6 # comment\n1", ["aa", "ab"], 64, False),
        ("a\u00a0b", ["a\u00a0b", "ab"], 64, True),
        ("a\x1cb", ["a\x1cb", "ab"], 64, False),
        ("a\u2003b", ["a\u2003b", "ab"], 64, False),
        ("a # comment\\\n b", ["ab", "a"], 64, False),
        ("a # comment\r b", ["a", "ab"], 64, False),
        ("a\\# # comment\nb", ["a#b", "ab"], 64, False),
        (r" i d \.", ["ıD.", "İD."], 66, True),
        (" [a-z] ", ["ı", " "], 66, False),
        (r" \s \w ", [" \u0301", "\x1ca"], 64, False),
        ("\\ \u00a0", [" \u00a0", " "], 64, False),
        ("\\\u00a0", ["\u00a0", ""], 64, False),
        ("a#comment", ["a#comment", "a"], 0, False),
        ("a{ 1, 2}", ["a{ 1, 2}", "aa"], 0, False),
        ("a{e<=1}", ["a", "a{e<=1}"], 64, False),
        ("a{1i<=2}", ["a", "a{1i<=2}"], 0, False),
        ("a{foo}", ["a{foo}", "a"], 64, False),
        ("a{1x}", ["a{1x}", "a"], 64, False),
        ("a{e>1}", ["a{e>1}", "a"], 64, False),
        ("a * *", ["a", ""], 64, False),
        ("(?P<x>a", ["a", ""], 64, False),
        ("[ #", ["#", " "], 64, False),
        (" ^ a # comment\n $ ", ["a", "a\n"], 64, False),
    ]
    rows = []
    totals = {"sourceErrors": 0, "parserOnly": 0, "singleMatch": 0, "unqualified": 0, "sourceObservations": 0}
    for index, (pattern, texts, flags, smoke) in enumerate(definitions):
        p = native(pattern)
        record = {"id": index, "pattern": p, "flags": flags, "smoke": smoke, "patternSha256": sha(bytes([p["width"]]) + bytes.fromhex(p["bytes"])), "engines": {}}
        for name, engine in (("python-re", re), ("python-regex-v0", regex)):
            try:
                compiled = engine.compile(pattern, flags)
            except (re.error, regex.error) as exc:
                record["engines"][name] = {"kind": "source-error", "failure": {"type": type(exc).__name__, "message": str(exc), "position": exc.pos}, "profile": None, "cases": []}
                totals["sourceErrors"] += 1
                continue
            cases = []
            for text in texts:
                modes = {}
                for mode in ("search", "match", "finditer"):
                    matches = list(compiled.finditer(text)) if mode == "finditer" else [getattr(compiled, mode)(text)]
                    modes[mode] = [[list(match.span(group)) for group in range(compiled.groups + 1)] for match in matches if match is not None]
                cases.append({"source": native(text), "modes": modes})
            totals["sourceObservations"] += len(texts) * 3
            try:
                if name == "python-re":
                    width, repeated, nullable = cpython_profile(_parser.parse(pattern, flags))
                else:
                    source = core.Source(pattern)
                    source.ignore_space = bool(flags & regex.X)
                    info = core.Info(flags | core.UNICODE | core.VERSION0)
                    tree = core._parse_pattern(source, info)
                    assert info.group_count == compiled.groups
                    width, _, repeated, nullable = v0_profile(tree)
                profile = {"groups": compiled.groups, "names": dict(compiled.groupindex), "minimumWidthFloor": width, "repeatedCaptures": repeated, "nullableMultiRepeat": nullable}
                kind = "parser-only" if repeated or nullable else "single-match"
                totals["parserOnly" if kind == "parser-only" else "singleMatch"] += 1
            except NotImplementedError:
                profile, kind = None, "unqualified"
                totals["unqualified"] += 1
            record["engines"][name] = {"kind": kind, "failure": None, "profile": profile, "cases": cases}
        rows.append(record)
    out = {"schemaVersion": "citation-regex-verbose/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "regex": "2023.12.25", "producerSha256": sha(Path(__file__).read_bytes()), "coreSha256": sha(Path(core.__file__).read_bytes()), "totals": totals, "patterns": rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"patterns": len(rows), **totals}))


if __name__ == "__main__":
    main()
