#!/usr/bin/env python3
"""Observe actual pinned match_on_tokens results, including native capture spans."""
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


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    import regex
    from regex import _regex_core as core
    from eyecite import helpers, models, regexes
    assert importlib.metadata.version("regex") == "2023.12.25" and regex.DEFAULT_VERSION == regex.V0
    assert helpers.MAX_MATCH_CHARS == 300
    sha = lambda data: hashlib.sha256(data).hexdigest()

    def profile(node, repeated=False):
        name = type(node).__name__
        if isinstance(node, core.Group):
            width, _, inner_repeat, nullable = profile(node.subpattern, repeated)
            return width, True, repeated or inner_repeat, nullable
        if isinstance(node, (core.GreedyRepeat, core.LazyRepeat, core.PossessiveRepeat)):
            multiple = node.max_count is None or node.max_count > 1
            width, captures, inner_repeat, nullable = profile(node.subpattern, repeated or multiple)
            return width * node.min_count, captures, inner_repeat, nullable or (multiple and width == 0)
        if isinstance(node, (core.Sequence, core.Branch)):
            rows = [profile(item, repeated) for item in (node.items if isinstance(node, core.Sequence) else node.branches)]
            width = sum(row[0] for row in rows) if isinstance(node, core.Sequence) else min(row[0] for row in rows)
            return width, *(any(row[index] for row in rows) for index in range(1, 4))
        assert name in ("Character", "String", "Property", "Range", "SetUnion", "Any", "StartOfString", "EndOfString", "EndOfStringLine"), name
        return (0 if node.is_empty() else node.max_width()), False, False, False

    vectors = [
        [], [("Text", "123")], [("Text", "x "), ("Text", "123")],
        [("Text", "a"), ("Text", "b")], [("Text", ""), ("Text", "b")],
        [("Text", "a"), ("Text", "b"), ("Token", None)],
        [("Text", "x"), ("IdToken", "Id."), ("Text", "123")],
        [("Text", "x"), ("ParagraphToken", "\n\n"), ("Text", "2020")],
        [("Text", " (West 2020)")], [("Text", ", § 2 (Supp. 2020) (amended)")],
        [("Text", "\U0001d7ce")], [("Text", "\ud835\udfce")],
        [("Text", "x" * 299), ("Text", "123")], [("Text", "20")],
    ]
    # One real source call for each configuration and pattern; no matcher stub.
    configurations = [(v, start, forward, strings, prefix) for v, start, forward, strings, prefix in (
        (0, 0, True, True, ""), (1, 0, True, True, ""), (2, 1, False, True, ""),
        (2, 0, True, True, ""), (3, 0, True, False, ""), (4, 0, True, False, ""),
        (5, 0, True, False, ""), (6, 0, True, True, ""), (6, 2, False, True, ""),
        (7, 2, False, False, ""), (8, 0, True, True, ""), (9, 0, True, True, ""),
        (10, 0, True, True, ""), (11, 0, True, True, ""), (12, 1, False, True, ""),
        (13, 0, True, True, "20"), (1, -2, True, True, ""), (0, 0, True, True, "p" * 301),
    )]
    patterns = []
    original_search = helpers.re.search
    definitions = [(r"(?P<value>\d+)", 0), (r"(?P<head>a)?(?P<tail>b)", 0), (r"(?P<empty>)", 0),
                   (" a #comment\n (?P<word>\\w+) ", 64), (regexes.POST_LAW_CITATION_REGEX, 64), (regexes.YEAR_REGEX, 64),
                   (r"(?P<optional>a?)?", 0), (r"(?P<optional>a?)??", 0)]
    for index, (pattern, flags) in enumerate(definitions):
        bindings = []
        for wrapped in (f"^(?:{pattern})", f"(?:{pattern})$"):
            compiled = regex.compile(wrapped, flags)
            source = core.Source(wrapped)
            source.ignore_space = bool(flags & regex.X)
            info = core.Info(flags | core.UNICODE | core.VERSION0)
            tree = core._parse_pattern(source, info)
            width, _, repeated, nullable = profile(tree)
            p = native(wrapped)
            bindings.append({"patternSha256": sha(bytes([p["width"]]) + bytes.fromhex(p["bytes"])), "flags": flags,
                             "profile": {"groups": compiled.groups, "names": dict(compiled.groupindex), "minimumWidthFloor": width,
                                         "repeatedCaptures": repeated, "nullableMultiRepeat": nullable}})
        cases = []
        for vector_id, start, forward, strings_only, prefix in configurations:
            words = [text if kind == "Text" else getattr(models, kind)(text, 0, 0) for kind, text in vectors[vector_id]]
            observed = []
            def search(raw, text, flags):
                observed.append(native(text))
                return original_search(raw, text, flags=flags)
            with patch.object(helpers.re, "search", search):
                try:
                    matched = helpers.match_on_tokens(words, start, pattern, prefix=prefix, strings_only=strings_only, forward=forward, flags=flags)
                    failure = None
                    match = None if matched is None else {"captures": [{"_tag": "Unmatched"} if matched.start(group) < 0 else
                        {"_tag": "Range", "start": matched.start(group), "end": matched.end(group)} for group in range(matched.re.groups + 1)],
                        "names": dict(matched.re.groupindex)}
                except IndexError:
                    failure, match = "IndexError", None
            assert len(observed) == (0 if failure else 1)
            cases.append({"request": {"words": [{"kind": k, "data": native(t)} for k, t in vectors[vector_id]], "startIndex": start,
                                      "forward": forward, "stringsOnly": strings_only, "prefix": native(prefix)},
                          "failure": failure, "result": None if failure else {"context": observed[0], "match": match}})
        patterns.append({"id": index, "pattern": native(pattern), "flags": flags, "bindings": bindings, "cases": cases})
    out = {"schemaVersion": "citation-context-matches/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "regex": "2023.12.25",
           "producerSha256": sha(Path(__file__).read_bytes()), "helpersSha256": sha((root / "eyecite/helpers.py").read_bytes()), "patterns": patterns}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"patterns": len(patterns), "cases": sum(len(p["cases"]) for p in patterns),
                      "matches": sum(c["result"] is not None and c["result"]["match"] is not None for p in patterns for c in p["cases"])}))


if __name__ == "__main__":
    main()
