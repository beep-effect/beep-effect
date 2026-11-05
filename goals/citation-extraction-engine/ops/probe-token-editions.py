#!/usr/bin/env python3
"""Capture actual CitationToken edition merging, then replay its frozen hash profile."""
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
    p = argparse.ArgumentParser()
    p.add_argument("--oracle-root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--profile", type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    def git(*xs):
        return subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("requires clean exact oracle")
    if sys.version_info[:3] != (3, 11, 15) or sys.hash_info.width != 64:
        raise SystemExit("requires pinned 64-bit Python")
    sys.path.insert(0, str(root))
    from eyecite.models import Edition, Reporter, CitationToken
    from eyecite.tokenizers import token_is_from_nominative_reporter
    names = ["Thompson", "Cooke", "Holmes", "Olcott", "Chase", "Gilmer", "Bee", "Deady", "Taney", "U.S.", "thompson", "Thompson\u0301"]
    values = [Edition(Reporter(name, name, "state", "reporters"), name, None, None) for name in names]
    values += [Edition(values[0].reporter, values[0].short_name, None, None), Edition(values[0].reporter, "different edition", None, None)]
    identities = {id(value): i for i, value in enumerate(values)}
    bindings = [{"id": i, "hash": str(hash(value)), "equalityClass": next(j for j, other in enumerate(values) if other == value), "reporterShortName": value.reporter.short_name} for i, value in enumerate(values)]
    if args.profile:
        frozen = json.loads(args.profile.read_text())
        expected = frozen["bindings"]
        assert [{k: v for k, v in row.items() if k != "hash"} for row in bindings] == [{k: v for k, v in row.items() if k != "hash"} for row in expected]
        bindings = expected
        # Explicitly replay the prior runtime's captured hash parameters. No
        # universal hash(None) or new-process edition-hash claim is made.
        Edition.__hash__ = lambda self: int(bindings[identities[id(self)]]["hash"])
    sequences = [list(v) for size in range(4) for v in itertools.product((0, 1, 9, 12), repeat=size)]
    sequences += [list(range(14)), list(reversed(range(14))), list(range(14)) * 3, [0, 12] * 20]
    rows = []
    for i, sequence in enumerate(sequences):
        variation = sequence[::-1]
        mid = len(sequence) // 2
        left = CitationToken("x", 0, 1, exact_editions=[values[x] for x in sequence[:mid]], variation_editions=[values[x] for x in variation[:mid]])
        right = CitationToken("x", 0, 1, exact_editions=[values[x] for x in sequence[mid:]], variation_editions=[values[x] for x in variation[mid:]])
        assert left.merge(right) is left
        try:
            nominative = token_is_from_nominative_reporter(left)
        except IndexError:
            nominative = None
        rows.append({"id": i, "exactInput": sequence, "variationInput": variation,
                     "exact": [identities[id(e)] for e in left.exact_editions], "variation": [identities[id(e)] for e in left.variation_editions], "nominative": nominative})
    choices = []
    for index in range(len(values)):
        for exact, variation in (([index], []), ([], [index]), ([9], [index])):
            token = CitationToken("x", 0, 1, exact_editions=[values[x] for x in exact], variation_editions=[values[x] for x in variation])
            choices.append({"exact": exact, "variation": variation, "result": token_is_from_nominative_reporter(token)})
    out = {"schemaVersion": "citation-token-editions/v1", "oracleCommit": PIN, "oracleTree": TREE,
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "python": "3.11.15",
           "hashProfile": "captured-source-runtime", "bindings": bindings, "cases": rows, "choices": choices}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"bindings": len(bindings), "cases": len(rows), "replay": bool(args.profile)}))


if __name__ == "__main__":
    main()
