#!/usr/bin/env python3
"""Retain the frozen authority-grouping consequence of the public CIT merger."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle pin/tree/cleanliness mismatch")
    sys.path.insert(0, str(root))
    from eyecite import get_citations, resolve_citations
    text = "1 C.I.T. 1. 1 Ct. Int'l Trade 1."
    citations = get_citations(text)
    groups = resolve_citations(citations)
    result = {"input": text, "citations": [{"kind": type(cite).__name__, "correctedReporter": cite.corrected_reporter(),
                "groups": cite.groups, "span": list(cite.span())} for cite in citations],
              "equal": citations[0] == citations[1],
              "authorityGroups": [[index for index, cite in enumerate(citations) if any(cite is member for member in members)] for members in groups.values()]}
    if len(citations) != 2 or result["equal"] or result["authorityGroups"] != [[0], [1]]:
        raise RuntimeError("frozen identity-merger grouping probe changed")
    result.update({"schemaVersion": "citation-identity-merger-probe/v1", "oracleCommit": PIN, "oracleTree": TREE,
        "scope": "Focused compatibility probe; requires integration into the final supplemental case ledger.",
        "exporterSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "modelSourceSha256": hashlib.sha256((root / "eyecite/models.py").read_bytes()).hexdigest(),
        "resolveSourceSha256": hashlib.sha256((root / "eyecite/resolve.py").read_bytes()).hexdigest()})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("CIT merger probe passed: shared public identity must retain two frozen authority groups.")


if __name__ == "__main__": main()
