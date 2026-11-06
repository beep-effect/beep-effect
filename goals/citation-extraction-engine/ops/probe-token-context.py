#!/usr/bin/env python3
"""Observe original helpers.match_on_tokens context assembly before regex search."""
import argparse
import hashlib
import itertools
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
    from eyecite import helpers, models
    import importlib.metadata
    assert importlib.metadata.version("regex") == "2023.12.25"
    assert helpers.MAX_MATCH_CHARS == 300
    sha = lambda value: hashlib.sha256(value).hexdigest()
    kinds = ("Token", "CitationToken", "SectionToken", "SupraToken", "IdToken", "ParagraphToken", "StopWordToken", "PlaceholderCitationToken", "CaseReferenceToken")
    # Every exact built-in class is distinguished from Python str. Unicode
    # includes scalars and adjacent literal surrogate words in both directions.
    vectors = [[], [("Text", "a"), ("Text", " "), ("Text", "b")]]
    vectors += [[("Text", "left "), (kind, "MARK"), ("Text", " right")] for kind in kinds]
    vectors += [[("Text", "x" * n), ("Text", " END")] for n in (299, 300, 301)]
    vectors += [[("Text", "\ud835\udfce"), ("Text", "\U0001d7ce"), ("Text", "é界")], [("Token", None)], [("Text", ""), ("Text", " ")]]
    prefixes = ["", "P", "p" * 299, "p" * 300, "p" * 301, "\ud835\udfce\U0001d7ce"]
    cases = []
    for vector_id, vector in enumerate(vectors):
        words = [text if kind == "Text" else getattr(models, kind)(text, 0, 0) for kind, text in vector]
        starts = sorted(set((-len(words) - 1, -len(words), -1, 0, 1, len(words) - 1, len(words), len(words) + 1)))
        for start, prefix_id, strings_only, forward in itertools.product(starts, range(len(prefixes)), (False, True), (False, True)):
            observations = []
            def search(pattern, text, flags):
                observations.append({"pattern": pattern, "text": native(text), "flags": int(flags)})
                return None
            with patch.object(helpers.re, "search", search):
                try:
                    value = helpers.match_on_tokens(words, start, "CONTROL", prefix=prefixes[prefix_id], strings_only=strings_only, forward=forward)
                    assert value is None and len(observations) == 1
                    failure = None
                except (IndexError, TypeError) as exc:
                    failure = type(exc).__name__
                    assert not observations
            cases.append({"vector": vector_id, "start": start, "prefix": prefix_id, "stringsOnly": strings_only, "forward": forward, "search": observations[0] if observations else None, "failure": failure})
    out = {"schemaVersion": "citation-token-context/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "regex": "2023.12.25", "producerSha256": sha(Path(__file__).read_bytes()), "helpersSha256": sha((root / "eyecite/helpers.py").read_bytes()), "scope": "Actual match_on_tokens context preparation, index errors, pattern anchoring and forwarded flags; regex search is intercepted and no matching parity is claimed.", "maxMatchChars": 300, "vectors": [[{"kind": kind, "data": native(text)} for kind, text in vector] for vector in vectors], "prefixes": [native(text) for text in prefixes], "cases": cases}
    encoded = lambda value: json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    fields = []
    for name in sorted(out):
        rendered = "[\n" + ",\n".join("    " + encoded(row) for row in out[name]) + "\n  ]" if name == "cases" else encoded(out[name])
        fields.append("  " + json.dumps(name) + ": " + rendered)
    args.output.write_text("{\n" + ",\n".join(fields) + "\n}\n")
    print(json.dumps({"cases": len(cases), "searches": sum(row["search"] is not None for row in cases), "indexErrors": sum(row["failure"] == "IndexError" for row in cases), "typeErrors": sum(row["failure"] == "TypeError" for row in cases)}))


if __name__ == "__main__":
    main()
