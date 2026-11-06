#!/usr/bin/env python3
"""Capture retained prior-full-list and immutable pair identity from pinned eyecite.

Maintainer evidence only; no target parity or original-source extraction claim.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
SCENES = [
    ("list-identity", ["case", "supra", "short", "reference"]),
    ("retained-sees-full-append", ["case", "supra", "case", "supra"]),
    ("retained-clear-from-full", ["case", "supra", "case", "supra"]),
    ("retained-reverse-from-full", ["case", "case", "supra", "case", "supra"]),
    ("retained-insert-current-full", ["case", "supra", "case", "supra"]),
    ("retained-clear-from-id", ["case", "supra", "id", "supra"]),
    ("replace-first-entry", ["case", "supra", "supra"]),
    ("equal-replace-pair", ["case", "supra", "supra"]),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    if (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}")) != (PIN, TREE) or git("status", "--porcelain"):
        raise SystemExit("oracle provenance mismatch")
    if sys.version_info[:3] != (3, 11, 15) or os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization:
        raise SystemExit("frozen runtime mismatch")
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    if versions != {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}:
        raise SystemExit("frozen dependency mismatch")
    sys.path.insert(0, str(root))
    import eyecite.models as models
    import eyecite.resolve as resolve

    rows = []
    for action, kinds in SCENES:
        values = []
        for index, kind in enumerate(kinds):
            groups = {"volume": "1", "reporter": "U.S.", "page": "1"}
            metadata = {}
            if kind in ("case", "reference"):
                metadata["plaintiff"] = "Smith"
            if kind in ("short", "supra"):
                metadata["antecedent_guess"] = "Smith"
            if kind == "id":
                metadata["pin_cite"] = "2"
            token = models.CitationToken(f"witness-{index}", index * 11, index * 11 + 9, groups)
            cls = {"case": models.FullCaseCitation, "short": models.ShortCaseCitation,
                   "supra": models.SupraCitation, "reference": models.ReferenceCitation, "id": models.IdCitation}[kind]
            values.append(cls(token, index=index, groups=groups, metadata=metadata))
        originals = {id(value): index for index, value in enumerate(values)}
        list_objects, pair_objects = [], []
        def slot(pool, value):
            for index, existing in enumerate(pool):
                if existing is value:
                    return index
            pool.append(value)
            return len(pool) - 1
        def pair_view(pair):
            return {"pairSlot": slot(pair_objects, pair), "mention": originals[id(pair[0])], "resource": pair[1]}
        def fulls_view(fulls):
            return [pair_view(pair) for pair in fulls]
        retained = None
        retained_pair = None
        events = []
        def full(value):
            event = {"slot": "full", "mention": originals[id(value)]}
            if retained is not None:
                event["retainedListSlot"] = slot(list_objects, retained)
                event["before"] = fulls_view(retained)
                if action == "retained-clear-from-full":
                    retained.clear()
                elif action == "retained-reverse-from-full":
                    retained.reverse()
                elif action == "retained-insert-current-full":
                    retained.append((value, "foreign"))
                event["after"] = fulls_view(retained)
            events.append(event)
            return "base"
        def contextual(value, fulls):
            nonlocal retained, retained_pair
            event = {"slot": kinds[originals[id(value)]], "mention": originals[id(value)],
                     "listSlot": slot(list_objects, fulls), "before": fulls_view(fulls),
                     "retainedListMatches": None if retained is None else retained is fulls}
            retained = fulls
            if action in ("replace-first-entry", "equal-replace-pair") and retained_pair is None:
                retained_pair = fulls[0]
                fulls[0] = (fulls[0][0], "foreign" if action == "replace-first-entry" else fulls[0][1])
            if retained_pair is not None:
                event["retainedPair"] = pair_view(retained_pair)
                event["retainedPairMatchesFirst"] = retained_pair is fulls[0]
            helper = {models.SupraCitation: resolve._resolve_supra_citation,
                      models.ShortCaseCitation: resolve._resolve_shortcase_citation,
                      models.ReferenceCitation: resolve._resolve_reference_citation}[type(value)]
            result = helper(value, fulls)
            event["after"] = fulls_view(fulls)
            event["result"] = result
            events.append(event)
            return result
        def id_callback(value, last, groups):
            event = {"slot": "id", "mention": originals[id(value)], "retainedListSlot": slot(list_objects, retained),
                     "before": fulls_view(retained)}
            retained.clear()
            event["after"] = fulls_view(retained)
            result = resolve._resolve_id_citation(value, last, groups)
            event["result"] = result
            events.append(event)
            return result
        groups = resolve.resolve_citations(values, resolve_full_citation=full, resolve_shortcase_citation=contextual,
                                           resolve_supra_citation=contextual, resolve_reference_citation=contextual,
                                           resolve_id_citation=id_callback)
        rows.append({"name": action, "kinds": kinds, "events": events,
                     "outcome": {"groups": [{"resource": key, "members": [originals[id(item)] for item in members]}
                                            for key, members in groups.items()],
                                 "fulls": fulls_view(retained)}})
    payload = {"schemaVersion": "citation-prior-full-observations/v1", "oracleCommit": PIN, "oracleTree": TREE,
               "pythonVersion": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause",
               "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(),
               "exporterSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest()
                           for name in ("resolve.py", "models.py")}, "cases": rows}
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Captured {len(rows)} prior-full list/pair observations")


if __name__ == "__main__":
    main()
