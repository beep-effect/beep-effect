#!/usr/bin/env python3
"""Observe returned objects separately from dispatcher append destinations."""
import argparse
import copy
from collections import defaultdict
import hashlib
import importlib.metadata
import json
import os
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
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == "cpython" and sys.hash_info.width == 64
    assert os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    sys.path.insert(0, str(root))
    from eyecite import get_citations
    import eyecite.models as models
    import eyecite.resolve as resolve
    original = resolve.defaultdict
    rows = []
    definitions = [
        ("distinct-equal-returned-key", ["case", "case"], "equal"),
        ("falsy-retained-result", ["case", "id"], "falsy"),
        ("truth-changes-during-append", ["case", "id"], "truth-change"),
        ("removed-entry-history", ["case", "id", "id"], "clear-new"),
        ("same-object-reinsert-history", ["case", "id", "id"], "clear-same"),
        ("unknown-resets-last", ["case", "unknown", "id"], "unknown"),
        ("none-full-result", ["case", "id"], "none"),
        ("live-returned-presentation", ["case", "id"], "presentation-change"),
    ]
    try:
        for name, kinds, action in definitions:
            states = [{"hashRaw": "7", "mode": "token", "token": "same", "truth": action != "falsy", "truthAfterHash": False if action == "truth-change" else None, "failHash": False, "failEq": False, "failBool": False} for _ in range(2)]
            trace = []
            results = {}
            assignments = {}
            lists = []
            table = None
            class Host:
                def __init__(self, slot): self.slot = slot
                def __hash__(self):
                    state = states[self.slot]
                    trace.append({"kind": "hash", "slot": self.slot, "raw": state["hashRaw"]})
                    if state["truthAfterHash"] is not None: state["truth"] = state["truthAfterHash"]
                    return int(state["hashRaw"])
                def __bool__(self):
                    result = states[self.slot]["truth"]
                    trace.append({"kind": "bool", "slot": self.slot, "result": result})
                    return result
                def __eq__(self, other):
                    trace.append({"kind": "eq", "slot": self.slot, "other": {"kind": "host", "slot": other.slot}})
                    return states[self.slot]["token"] == states[other.slot]["token"]
            hosts = [Host(0), Host(1)]
            def present(resource):
                return {"kind": "none"} if resource is None else {"kind": "host", "slot": resource.slot, "token": states[resource.slot]["token"]}
            citations = [get_citations(f"1 U.S. {index + 1}")[0] if kind == "case" else get_citations("Id. at 2")[0] if kind == "id" else models.UnknownCitation(models.CitationToken("unknown", 0, 7, {}), index=0) for index, kind in enumerate(kinds)]
            def index_of(citation): return next(i for i, value in enumerate(citations) if value is citation)
            class ObservedList(list):
                def __init__(self): self.slot = len(lists); lists.append(self)
                def append(self, citation):
                    # These scenes have no shared list aliases. Inspect identity
                    # only; never perform another key hash/equality lookup.
                    selected = [(key, value) for key, value in table.items() if value is self]
                    assert len(selected) == 1
                    assignments[index_of(citation)] = {"entrySlot": self.slot, "listSlot": self.slot, "resource": selected[0][0]}
                    super().append(citation)
            def observed_defaultdict(factory):
                nonlocal table
                assert factory is list
                table = defaultdict(ObservedList)
                return table
            resolve.defaultdict = observed_defaultdict
            def full(citation):
                index = index_of(citation)
                result = None if action == "none" else hosts[index if action == "equal" else 0]
                results[index] = result
                return result
            def id_callback(citation, last, groups):
                index = index_of(citation)
                if index == 1 and action in ("clear-new", "clear-same"):
                    groups.clear()
                    result = hosts[1 if action == "clear-new" else 0]
                elif action == "presentation-change":
                    states[0]["token"] = "changed"
                    result = hosts[0]
                else: result = resolve._resolve_id_citation(citation, last, groups)
                results[index] = result
                return result
            initial = copy.deepcopy(states)
            output = resolve.resolve_citations(citations, resolve_full_citation=full, resolve_id_citation=id_callback)
            decisions = [{"mention": index, "callback": "full" if kind == "case" else kind, "resource": present(results.get(index)), "assignment": None if index not in assignments else {**assignments[index], "resource": present(assignments[index]["resource"])}} for index, kind in enumerate(kinds)]
            groups = [{"entrySlot": value.slot, "listSlot": value.slot, "resource": present(key), "members": [index_of(citation) for citation in value]} for key, value in output.items()]
            rows.append({"name": name, "kinds": kinds, "action": action, "hosts": initial, "decisions": decisions, "groups": groups, "trace": trace})
    finally: resolve.defaultdict = original
    payload = {"schemaVersion": "citation-dispatch-decisions/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "lockSha256": hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest(), "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "resolve.py")}, "scope": "Actual callbacks with observational list.append subclass; these scenes have unique per-entry lists, so normalized insertion/list allocation slots coincide. No shared-list selection or native integer-entry-ID claim.", "cases": rows}
    args.output.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Captured {len(rows)} dispatcher histories / {sum(len(row['decisions']) for row in rows)} decisions")


if __name__ == "__main__": main()
