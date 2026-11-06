#!/usr/bin/env python3
"""Capture actual Tokenizer.tokenize assembly and host callback decisions."""
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
    from eyecite import models, tokenizers
    original_nom = tokenizers.token_is_from_nominative_reporter
    source = "aa bb cc dd ee"
    def edition(name):
        return models.Edition(models.Reporter(name, name, "state", "reporters"), name, None, None)
    def tokens():
        return [models.Token("aa bb", 0, 5, {"a": "x"}), models.Token("different", 0, 5, {"a": "x"}),
                models.IdToken("Id", 0, 5), models.CitationToken("nom", 0, 8, exact_editions=[edition("Thompson")]),
                models.CitationToken("cite", 2, 4, exact_editions=[edition("U.S.")]),
                models.Token("", 0, 3), models.Token(None, 0, 4), models.Token("late", 9, 11)]
    def native(text):
        if text is None:
            return None
        width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
        return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}
    token_seeds = [{"kind": type(t).__name__, "data": native(t.data), "start": t.start, "end": t.end,
                    "groups": {k: native(v) for k, v in t.groups.items()},
                    "exact": [0 if e.reporter.short_name == "Thompson" else 9 for e in getattr(t, "exact_editions", [])],
                    "variation": [], "short": getattr(t, "short", False)} for t in tokens()]
    profile_bytes = (Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite/token-editions.json").read_bytes()
    profile_sha = hashlib.sha256(profile_bytes).hexdigest()
    assert profile_sha == "b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c"
    edition_bindings = json.loads(profile_bytes)["bindings"]
    inputs = [[]] + [[i] for i in range(8)] + [list(p) for size in (2, 3) for p in itertools.permutations(range(8), size)]
    inputs += [[0, 0], [3, 3], [5, 5], [3, 4, 7, 4], [7, 0, 1], [2, 0, 1]]
    cases = []
    for number, ids in enumerate(inputs):
        values = tokens()
        identities = {id(t): i for i, t in enumerate(values)}
        views = [{"start": t.start, "end": t.end, "hasData": t.data is not None,
                  "truthy": bool(t) if t.data is not None else False, "citation": isinstance(t, models.CitationToken)} for t in values]
        trace = []
        for index, token in enumerate(values):
            original = token.merge
            def merge(other, original=original, index=index):
                result = original(other)
                trace.append({"kind": "merge", "left": index, "right": identities[id(other)], "result": bool(result)})
                return result
            token.merge = merge
        def nominative(token):
            result = original_nom(token)
            trace.append({"kind": "nominative", "left": identities[id(token)], "result": result})
            return result
        tokenizers.token_is_from_nominative_reporter = nominative
        class Controlled(tokenizers.Tokenizer):
            def extract_tokens(self, text):
                yield from (values[i] for i in ids)
            @staticmethod
            def append_text(output, text):
                trace.append({"kind": "text", "text": text})
                tokenizers.Tokenizer.append_text(output, text)
        all_tokens, citation_tokens = Controlled().tokenize(source)
        items = [{"kind": "text", "text": item} if isinstance(item, str) else {"kind": "token", "id": identities[id(item)]} for item in all_tokens]
        cases.append({"id": number, "source": source, "ids": ids, "views": views, "trace": trace,
                      "items": items, "citations": [[index, identities[id(token)]] for index, token in citation_tokens]})
    tokenizers.token_is_from_nominative_reporter = original_nom
    out = {"schemaVersion": "citation-token-assembly/v2", "oracleCommit": PIN, "oracleTree": TREE,
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           "python": "3.11.15", "tokenSeeds": token_seeds, "editionBindings": edition_bindings, "editionProfileSha256": profile_sha, "scope": "Assembly control flow with actual source host decisions; not a target token-merge implementation.", "cases": cases}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(cases)}))


if __name__ == "__main__":
    main()
