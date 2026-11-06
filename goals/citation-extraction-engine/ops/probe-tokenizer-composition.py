#!/usr/bin/env python3
"""Observe actual source Aho selection, built-in construction and mixed assembly."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from re import _parser
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def native(text):
    if text is None:
        return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--oracle-root", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *v: subprocess.check_output(["git", "-C", str(root), *v], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    sys.path.insert(0, str(root))
    from eyecite import models, tokenizers
    definitions = [(r"(?P<body>Id\.)", "IdToken", 2, ["id."]), (r"(?P<body>supra)", "SupraToken", 2, ["supra"]),
                   (r"(?P<body>¶)", "ParagraphToken", 0, ["¶"]), (r"(?P<body>§)", "SectionToken", 0, ["§"]),
                   (r"(?P<body>see)", "StopWordToken", 2, ["see"]), (r"(?P<body>\[CITE\])", "PlaceholderCitationToken", 0, ["[CITE]"]),
                   (r"(?P<body>Id\.)", "Token", 2, ["id."])]
    extractors = [models.TokenExtractor(pattern, getattr(models, kind).from_match, flags=flags, strings=strings) for pattern, kind, flags, strings in definitions]
    configuration = []
    for index, (extractor, (_, kind, _, _)) in enumerate(zip(extractors, definitions, strict=True)):
        pattern = native(extractor.regex)
        fingerprint = sha(bytes([pattern["width"]]) + bytes.fromhex(pattern["bytes"]))
        compiled = extractor.compiled_regex
        profile = {"groups": compiled.groups, "names": dict(compiled.groupindex), "minimumWidthFloor": _parser.parse(extractor.regex, extractor.flags).getwidth()[0], "repeatedCaptures": False, "nullableMultiRepeat": False}
        configuration.append({"ordering": {"id": index, "flags": extractor.flags, "strings": [native(s) for s in extractor.strings], "hash": str(hash(extractor)), "equalityClass": index},
                              "recipe": {"id": index, "patternSha256": fingerprint, "flags": extractor.flags, "kind": kind, "exact": [], "variation": [], "short": False},
                              "pattern": pattern, "descriptor": {"patternSha256": fingerprint, "flags": extractor.flags, "profile": profile}})
    def seed(t):
        return {"kind": type(t).__name__, "data": native(t.data), "start": t.start, "end": t.end,
                "groups": {k: native(v) for k, v in t.groups.items()}, "exact": [], "variation": [], "short": False}
    texts = ["", "plain", "Id.", "id. ID.", "a Id. b", "supra", "see supra Id.", "¶ §", "[CITE]", "Id.[CITE]supra", "  Id.  ", "\tId.\n", "\U0001d7ce\ud835\udfce Id. ¶", "İ ID. Σ", "see see", "xseeY", "§§¶¶", "nothing matches", "Id. supra Id. supra", "[CITE] [CITE]"]
    prior_extractors = tokenizers.EXTRACTORS
    try:
        tokenizers.EXTRACTORS = extractors
        selector = tokenizers.AhocorasickTokenizer(extractors)
    finally:
        tokenizers.EXTRACTORS = prior_extractors
    original = models.TokenExtractor.get_token
    cases = []
    try:
        for number, text in enumerate(texts):
            created = []
            def observe(self, match, offset=0):
                token = original(self, match, offset)
                created.append(token)
                return token
            models.TokenExtractor.get_token = observe
            ordered = list(selector.get_extractors(text))
            all_tokens, citation_tokens = selector.tokenize(text)
            ids = {id(token): index for index, token in enumerate(created)}
            cases.append({"id": number, "source": native(text), "selected": [extractors.index(e) for e in ordered], "candidates": len(created),
                          "items": [{"kind": "Text", "data": native(token)} if isinstance(token, str) else {"kind": "Token", "id": ids[id(token)]} for token in all_tokens],
                          "citations": [[position, ids[id(token)]] for position, token in citation_tokens],
                          "tokens": [{"id": ids[id(token)], "seed": seed(token)} for _, token in citation_tokens]})
    finally:
        models.TokenExtractor.get_token = original
    out = {"schemaVersion": "citation-tokenizer-composition/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "hashSeed": "0",
           "producerSha256": sha(Path(__file__).read_bytes()), "sources": {name: sha((root / "eyecite" / name).read_bytes()) for name in ("models.py", "tokenizers.py")},
           "scope": "Actual source composition over seven controlled built-in extractors; full canonical engine and family safety remain open.", "configuration": {"extractors": configuration, "editions": []}, "cases": cases}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "candidates": sum(row["candidates"] for row in cases)}))


if __name__ == "__main__":
    main()
