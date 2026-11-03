#!/usr/bin/env python3
"""Verify immutable legacy evidence and, optionally, paired exact-match retention."""
import argparse
import hashlib
import json
import pathlib
import sys


def verify(root, freeze, result=None):
    changed = [row["path"] for row in freeze["files"]
               if not (root / row["path"]).is_file()
               or hashlib.sha256((root / row["path"]).read_bytes()).hexdigest() != row["sha256"]]
    gates = root / "goals/claim-check-performance/research/usefulness-gates.json"
    canonical = json.dumps(json.loads(gates.read_text()), sort_keys=True, separators=(",", ":")).encode()
    if hashlib.sha256(canonical).hexdigest() != freeze["usefulnessGatesCanonicalSha256"]:
        changed.append("goals/claim-check-performance/research/usefulness-gates.json")
    lost = []
    matches = None
    if result is not None:
        rows = [(family["familyId"], claim) for family in result["families"] for claim in family["claims"]]
        identities = [(family, claim["claimNumber"]) for family, claim in rows]
        if len(rows) != 538 or len(set(identities)) != 538:
            raise ValueError("Evaluation must account for all 538 unique selected claims")
        baseline = json.loads((root / freeze["legacyResult"]).read_text())
        selected = {(family["familyId"], claim["claimNumber"])
                    for family in baseline["families"] for claim in family["claims"]}
        if set(identities) != selected:
            raise ValueError("Selected family/claim identities differ from the frozen legacy cohort")
        passed = {(family, claim["claimNumber"]) for family, claim in rows if claim["strict"] is True}
        expected = {(row["familyId"], row["claimNumber"]) for row in freeze["passingClaims"]}
        lost = [f"{family}:{claim}" for family, claim in sorted(expected - passed)]
        matches = len(passed)
    return {"filesChecked": len(freeze["files"]), "changed": changed,
            "passingClaimsProtected": len(freeze["passingClaims"]), "lost": lost,
            "strictMatches": matches, "retentionEvaluated": result is not None,
            "preserved": not changed and not lost}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--result", type=pathlib.Path)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[3]
    freeze = json.loads(pathlib.Path(__file__).with_name("preservation-freeze.json").read_text())
    result = json.loads(args.result.read_text()) if args.result else None
    report = verify(root, freeze, result)
    print(json.dumps(report, indent=2))
    return 0 if report["preserved"] else 1


if __name__ == "__main__":
    sys.exit(main())
