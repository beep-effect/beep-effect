#!/usr/bin/env python3
"""Capture callback-mutated group values and alias relations from pinned eyecite.

Maintainer-only source observations, not target parity or extraction proof.
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
    ("create-empty", ["case", "id"], "known-group"),
    ("clear-groups", ["case", "id"], "known-group"),
    ("move-members", ["case", "id"], "known-group"),
    ("reverse-members", ["case", "case", "id"], "known-group"),
    ("duplicate-prior", ["case", "id"], "known-group"),
    ("copy-to-second", ["case", "id"], "known-group"),
    ("falsy-key", ["case", "id"], "known-group"),
    ("none-key", ["case", "id"], "known-group"),
    ("insert-current", ["case", "id"], "known-group"),
    ("read-missing-default", ["case", "id"], "known-group"),
    ("alias-member-lists", ["case", "id"], "alias"),
    ("dictionary-identity", ["case", "id", "id"], "alias"),
    ("retained-dictionary-full", ["case", "id", "case", "id"], "alias"),
    ("detached-member", ["case", "id"], "detached-member"),
    ("append-detached-full", ["case", "supra", "id"], "detached-prior-full"),
    ("replace-detached-full", ["case", "supra", "id"], "detached-prior-full"),
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

    def citation(kind, index, detached=False):
        groups = {"volume": "9" if detached else "1", "reporter": "U.S.", "page": "9" if detached else "1"}
        metadata = {"plaintiff": "Detached" if detached else "Smith"} if kind == "case" else {}
        if kind == "id":
            metadata["pin_cite"] = "2"
        if kind == "supra":
            metadata["antecedent_guess"] = "Detached"
        text = "detached" if detached else f"witness-{index}"
        start = 10000 if detached else index * 11
        token = models.CitationToken(text, start, start + len(text), groups)
        cls = {"case": models.FullCaseCitation, "id": models.IdCitation, "supra": models.SupraCitation}[kind]
        return cls(token, index=index, groups=groups, metadata=metadata)

    def resource(value):
        return {"kind": type(value).__name__, "value": value}

    rows = []
    for action, kinds, family in SCENES:
        values = [citation(kind, index) for index, kind in enumerate(kinds)]
        originals = {id(value): index for index, value in enumerate(values)}
        detached = citation("case", 99, detached=True)
        objects, lists, dictionaries = [], [], []
        # Strong references prevent allocator address reuse from inventing alias
        # relations. Only test-local slots, never process addresses, are emitted.
        def slot(pool, value):
            for index, existing in enumerate(pool):
                if existing is value:
                    return index
            pool.append(value)
            return len(pool) - 1

        def member(value):
            if id(value) in originals:
                return {"kind": "input", "index": originals[id(value)]}
            return {"kind": "detached", "slot": slot(objects, value)}

        def groups_view(groups):
            return [{"resource": resource(key), "listSlot": slot(lists, members), "members": [member(item) for item in members]}
                    for key, members in groups.items()]

        events = []
        retained = None

        def full(value):
            event = {"slot": "full", "mention": member(value)}
            if action == "retained-dictionary-full" and retained is not None:
                retained.clear()
                event["clearedDictionarySlot"] = slot(dictionaries, retained)
            events.append(event)
            return "base"

        def supra(value, fulls):
            event = {"slot": "supra", "mention": member(value),
                     "before": [{"citation": member(item), "resource": resource(key)} for item, key in fulls]}
            if action == "append-detached-full":
                fulls.append((detached, "foreign"))
            else:
                fulls[:] = [(detached, "base")]
            result = resolve._resolve_supra_citation(value, fulls)
            event["after"] = [{"citation": member(item), "resource": resource(key)} for item, key in fulls]
            events.append(event)
            return result

        def id_callback(value, last, groups):
            nonlocal retained
            event = {"slot": "id", "mention": member(value), "last": resource(last),
                     "dictionarySlot": slot(dictionaries, groups), "before": groups_view(groups)}
            result = None
            if action == "create-empty":
                groups["empty"]
            elif action == "clear-groups":
                groups.clear()
            elif action == "move-members":
                groups["moved"] = groups.pop("base")
                result = "moved"
            elif action == "reverse-members":
                groups["base"].reverse()
                result = "base"
            elif action == "duplicate-prior":
                groups["base"].append(values[0])
                result = "base"
            elif action == "copy-to-second":
                groups["other"] = [values[0]]
                result = "base"
            elif action == "falsy-key":
                groups[0] = []
            elif action == "none-key":
                groups[None] = [values[0]]
            elif action == "insert-current":
                groups["base"].append(value)
                result = "base"
            elif action == "read-missing-default":
                groups["unused"]
                result = resolve._resolve_id_citation(value, last, groups)
            elif action == "alias-member-lists":
                groups["other"] = groups["base"]
                result = "base"
            elif action in ("dictionary-identity", "retained-dictionary-full"):
                event["retainedDictionaryMatches"] = None if retained is None else retained is groups
                retained = groups
                result = resolve._resolve_id_citation(value, last, groups)
            elif action == "detached-member":
                groups["other"] = [detached]
            else:
                result = resolve._resolve_id_citation(value, last, groups)
            event["after"] = groups_view(groups)
            events.append(event)
            return result

        try:
            groups = resolve.resolve_citations(values, resolve_full_citation=full,
                                               resolve_supra_citation=supra, resolve_id_citation=id_callback)
            outcome = {"status": "value", "groups": groups_view(groups)}
        except Exception as error:
            outcome = {"status": "error", "kind": type(error).__name__}
        detached_values = [{"slot": index, "citationType": type(value).__name__,
                            "groups": dict(value.groups), "metadata": dict(value.metadata.__dict__)}
                           for index, value in enumerate(objects)]
        rows.append({"name": action, "family": family, "kinds": kinds, "events": events,
                     "detachedObjects": detached_values, "outcome": outcome})

    payload = {"schemaVersion": "citation-callback-mutation-observations/v1", "oracleCommit": PIN,
               "oracleTree": TREE, "pythonVersion": "3.11.15", "pythonHashSeed": "0", "versions": versions,
               "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(),
               "exporterSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("resolve.py", "models.py")},
               "cases": rows}
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Captured {len(rows)} callback mutation observations")


if __name__ == "__main__":
    main()
