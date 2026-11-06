#!/usr/bin/env python3
"""Observe pinned CPython add-only set copies, cached hashes and independent mutation."""
import argparse
import hashlib
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
    parser.add_argument("--cpython-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *v: subprocess.check_output(["git", "-C", str(root), *v], text=True).strip()
    if (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) != (PIN, TREE, ""):
        raise SystemExit("oracle source mismatch")
    if sys.version_info[:3] != (3, 11, 15) or sys.hash_info.width != 64 or sys.implementation.name != "cpython":
        raise SystemExit("CPython/word-size mismatch")
    if os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization:
        raise SystemExit("hash seed mismatch")
    source = args.cpython_root / "setobject.c"
    if hashlib.sha256(source.read_bytes()).hexdigest() != "01462829ff1e731582656adf49ef1d662a5f48002ac49114acdae1ea3674ce57":
        raise SystemExit("CPython source digest mismatch")
    rows = []
    for count in (0, 1, 4, 5, 7, 10, 18, 19, 20, 76):
        for mutated in (False, True):
            trace, hashes = [], []
            class Key:
                def __init__(self, slot):
                    self.slot = slot
                    self.raw = (5 if slot % 3 == 0 else slot * 32 + 5) if slot % 11 else -2
                def __hash__(self):
                    hashes.append(self.slot)
                    return self.raw
                def __eq__(self, other):
                    trace.append([self.slot, other.slot])
                    return self.slot == other.slot
            keys = [Key(i) for i in range(100)]
            initial = [str(hash(key)) for key in keys]
            adds = list(reversed(range(count)))
            parent = set()
            for index in adds:
                parent.add(keys[index])
            if count and mutated:
                keys[0].raw = 13
            current = [str(hash(key)) for key in keys]
            hashes.clear()
            trace.clear()
            target = parent.copy()
            if hashes or trace:
                raise SystemExit("copy invoked an object hash or comparison")
            copied = [key.slot for key in target]
            rebuilt = set()
            for key in parent:
                rebuilt.add(key)
            events = []
            actions = [("target", count), ("target", 0), ("parent", 90), ("target", count + 1), ("target", count)]
            for destination, index in actions:
                trace.clear()
                table = target if destination == "target" else parent
                table.add(keys[index])
                events.append({"destination": destination, "key": index, "comparisons": list(trace),
                               "parent": [key.slot for key in parent], "target": [key.slot for key in target]})
            hashes.clear()
            trace.clear()
            nested = target.copy()
            if hashes or trace:
                raise SystemExit("nested copy invoked an object hash or comparison")
            rows.append({"name": f"size-{count}-mutated-{mutated}", "initialHashes": initial, "currentHashes": current,
                         "adds": adds, "copied": copied, "rebuilt": [key.slot for key in rebuilt],
                         "events": events, "nested": [key.slot for key in nested]})
    out = {"schemaVersion": "citation-runtime-set-copy/v1", "scope": "Add-only copies with cached hashes; deletion/dummies and generic set merge remain open.",
           "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "hashWidth": 64, "hashSeed": "0",
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           "cpythonSourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "cases": rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(rows), "events": sum(len(row["events"]) for row in rows),
                      "differentFromRebuild": sum(row["copied"] != row["rebuilt"] for row in rows)}))


if __name__ == "__main__":
    main()
