#!/usr/bin/env python3
"""Capture actual add-only CPython candidate-set behavior and resolver traces."""
import argparse
import copy
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
    parser.add_argument("--cpython-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    assert sys.implementation.name == "cpython" and sys.hash_info.width == 64
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    sys.path.insert(0, str(root))
    from eyecite import get_citations
    import eyecite.models as models
    import eyecite.resolve as resolve
    def config(raw, token="same", mode="token"):
        return {"raw": str(raw), "token": token, "mode": mode, "error": False}
    def op(kind, key=0, value=None):
        return {"kind": kind, "key": key, **({"value": value} if value is not None else {})}
    add = lambda key: op("add", key)
    definitions = [
        ("changed-hash-same-bucket", [config(5)], [add(0), op("hash", 0, "13"), add(0), add(0)]),
        ("equal-objects", [config(7), config(7)], [add(0), add(1), add(0)]),
        ("collision-linear-probes-growth", [config(17, str(i)) for i in range(30)], [add(i) for i in range(30)] + [add(i) for i in (0, 10, 29)]),
        ("resize-caches-insertion-hash", [config(5, "zero")] + [config(i, str(i)) for i in (1, 2, 3, 4, 6)], [add(0), op("hash", 0, "10")] + [add(i) for i in range(1, 6)] + [add(0)]),
        ("false-equality-pointer", [config(17, mode="false"), config(17, mode="false")], [add(0), add(0), add(1), add(1)]),
        ("signed-wide-hashes", [config(raw, str(i)) for i, raw in enumerate((-1, -2, -9223372036854775808, 9223372036854775807, 1986750081022884797 + 8 * (2**61 - 1)))], [add(i) for i in range(5)] + [add(i) for i in range(5)]),
        ("comparison-error", [config(1, "left"), config(1, "right")], [add(0), op("error", 0, True), add(1), op("error", 0, False), add(1)]),
        ("current-equality-cached-hash", [config(7, mode="hash"), config(7, mode="hash")], [add(0), op("hash", 0, "15"), add(1), add(0)]),
    ]
    rows = []
    for name, configs, operations in definitions:
        class Key:
            def __init__(self, index, value): self.index = index; self.raw = int(value["raw"]); self.token = value["token"]; self.mode = value["mode"]; self.error = value["error"]
            def __hash__(self): return self.raw
            def __eq__(self, other):
                comparisons.append([self.index, other.index])
                if self.error: raise ValueError("comparison")
                if self.mode == "false": return False
                return hash(self) == hash(other) if self.mode == "hash" else self.token == other.token
        keys = [Key(i, value) for i, value in enumerate(configs)]
        table = set()
        events = []
        for operation in operations:
            comparisons = []
            key = keys[operation["key"]]
            if operation["kind"] == "hash": key.raw = int(operation["value"])
            if operation["kind"] == "error": key.error = operation["value"]
            try:
                if operation["kind"] == "add": table.add(key)
                outcome = {"status": "value"}
            except ValueError:
                outcome = {"status": "error", "kind": "ValueError"}
            events.append({"operation": operation, "keys": [{"objectId": key.index, "hash": str(hash(key)), "token": key.token, "mode": key.mode, "error": key.error} for key in keys], "outcome": outcome, "comparisons": copy.deepcopy(comparisons), "objects": [key.index for key in table]})
        rows.append({"name": name, "events": events})
    callbacks = []
    for kind in ("short", "supra", "reference"):
        for flavor in (("equal", "collision", "same-object", "named-equal", "named-collision", "narrow") if kind == "short" else ("equal", "collision", "same-object")):
            states = [{"hashRaw": "7", "mode": "token", "token": token, "truth": True, "truthAfterHash": None, "failHash": False, "failEq": False, "failBool": False} for token in ("same", "other" if flavor in ("collision", "named-collision", "narrow") else "same")]
            trace = []
            class Host:
                def __init__(self, slot): self.slot = slot
                def __hash__(self): trace.append({"kind": "hash", "slot": self.slot, "raw": "7"}); return 7
                def __bool__(self): trace.append({"kind": "bool", "slot": self.slot, "result": True}); return True
                def __eq__(self, other): trace.append({"kind": "eq", "slot": self.slot, "other": {"kind": "host", "slot": other.slot}}); return states[self.slot]["token"] == states[other.slot]["token"]
            hosts = [Host(0), Host(1)]
            fulls = [get_citations("1 U.S. 1")[0], get_citations("1 U.S. 2")[0]]
            full_names = ["Alpha", "Beta" if flavor == "narrow" else "Alpha"]
            for full, name in zip(fulls, full_names): full.metadata.plaintiff = name
            if kind == "short":
                tail = get_citations("1 U.S., at 2")[0]
                tail.metadata.antecedent_guess = "Alpha" if flavor in ("named-equal", "named-collision", "narrow") else None
            elif kind == "supra": tail = get_citations("Alpha, supra, at 2")[0]
            else: tail = models.ReferenceCitation(models.CitationToken("Alpha", 0, 5, {}), index=0, metadata={"plaintiff": "Alpha"})
            citations = [*fulls, tail]
            returns = [0, 0 if flavor == "same-object" else 1]
            def full_resolver(citation): return hosts[returns[next(i for i, full in enumerate(fulls) if full is citation)]]
            result = resolve.resolve_citations(citations, resolve_full_citation=full_resolver)
            callbacks.append({"name": f"{kind}-{flavor}", "kind": kind, "fullNames": full_names, "antecedentGuess": tail.metadata.antecedent_guess if kind in ("short", "supra") else None, "hosts": states, "returns": returns, "trace": trace, "groups": [[next(i for i, citation in enumerate(citations) if citation is member) for member in members] for members in result.values()]})
    output = {"schemaVersion": "citation-runtime-set/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "cpythonLicenseSha256": hashlib.sha256((args.cpython_root / "LICENSE").read_bytes()).hexdigest(), "setSourceSha256": hashlib.sha256((args.cpython_root / "setobject.c").read_bytes()).hexdigest(), "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "resolve.py")}, "scope": "Add-only candidate construction, ordered comparisons and iteration; no deletion or reentrant set mutation proof.", "cases": rows, "callbacks": callbacks}
    args.output.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Captured {len(rows)} set histories / {sum(len(row['events']) for row in rows)} events and {len(callbacks)} resolver scenes")


if __name__ == "__main__": main()
