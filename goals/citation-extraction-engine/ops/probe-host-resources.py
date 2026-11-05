#!/usr/bin/env python3
"""Observe controlled custom keys with actual canonical Resources and callbacks."""
import argparse
import copy
from datetime import datetime
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
    import eyecite.helpers as helpers
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 28, tzinfo=tz)
    models.datetime = helpers.datetime = Clock
    canonical_hash = hash(models.Resource(get_citations("1 U.S. 1")[0]))
    assert canonical_hash == 1986750081022884797
    wide = canonical_hash + 8 * sys.hash_info.modulus
    other_canonical = models.Resource(get_citations("1 U.S. 2")[0])
    second_hash = hash(other_canonical)
    def state(raw=canonical_hash, mode="token", token="same", truth=True, after=None):
        return {"hashRaw": str(raw), "mode": mode, "token": token, "truth": truth, "truthAfterHash": after, "failHash": False, "failEq": False, "failBool": False}
    def op(kind, **fields):
        return {"kind": kind, **fields}
    put = lambda key, value: op("set", key=key, value=value)
    get = lambda key: op("get", key=key)
    h = lambda index: {"kind": "host", "host": index}
    c = {"kind": "canonical"}
    definitions = [
        ("canonical-first-reflection", [state(mode="not-implemented")], [c, h(0)], [put(0, 0), put(1, 1), get(1), get(0)]),
        ("host-first-reflection", [state(mode="not-implemented")], [h(0), c], [put(0, 0), put(1, 1), get(1), get(0)]),
        ("canonical-first-wide-raw-hash", [state(wide, mode="normalized")], [c, h(0)], [put(0, 0), put(1, 1), get(1), get(0)]),
        ("host-first-wide-raw-hash", [state(wide, mode="normalized")], [h(0), c], [put(0, 0), put(1, 1), get(1), get(0)]),
        ("false-equality-pointer-and-alias", [state(7, mode="false"), state(7, mode="false")], [h(0), h(1)], [put(0, 0), get(0), put(1, 1), get(1), op("alias", key=0), get(2)]),
        ("live-hash-and-truth", [state(5)], [h(0), c], [op("append", key=0, member=0), op("truth", host=0, value=False), op("append", key=0, member=1), op("hashRaw", host=0, value="20"), put(0, 1), op("remove", key=0), op("clear"), op("truth", host=0, value=True), op("append", key=0, member=1)]),
        ("live-canonical-access", [state(mode="citation", token="1")], [h(0), c], [put(0, 0), get(1), op("page", value="2"), op("clear"), op("hashRaw", host=0, value=str(second_hash)), op("token", host=0, value="2"), put(0, 1), get(1)]),
        ("hash-equality-truth-errors", [state(7), state(7)], [h(0), h(1)], [put(0, 0), op("flag", host=0, field="failEq", value=True), put(1, 1), op("flag", host=0, field="failEq", value=False), op("flag", host=1, field="failHash", value=True), get(1), op("flag", host=1, field="failHash", value=False), op("flag", host=0, field="failBool", value=True), op("append", key=0, member=0)]),
    ]
    normalized = {}
    rows = []
    original_equal = models.Resource.__eq__
    for name, initial, specs, operations in definitions:
        trace = []
        states = copy.deepcopy(initial)
        canonical = models.Resource(get_citations("1 U.S. 1")[0])
        keys = []
        def operand(value):
            return {"kind": "host", "slot": value.slot} if isinstance(value, Host) else {"kind": "canonical", "slot": next(i for i, key in enumerate(keys) if key is value)}
        class Host:
            def __init__(self, slot):
                self.slot = slot
            def __hash__(self):
                value = states[self.slot]
                trace.append({"kind": "hash", "slot": self.slot, "raw": value["hashRaw"]})
                if value["failHash"]:
                    raise ValueError("hash")
                if value["truthAfterHash"] is not None:
                    value["truth"] = value["truthAfterHash"]
                return int(value["hashRaw"])
            def __bool__(self):
                value = states[self.slot]
                trace.append({"kind": "bool", "slot": self.slot, "result": value["truth"]})
                if value["failBool"]:
                    raise ValueError("bool")
                return value["truth"]
            def __eq__(self, other):
                value = states[self.slot]
                trace.append({"kind": "eq", "slot": self.slot, "other": operand(other)})
                if value["failEq"]:
                    raise ValueError("compare")
                if value["mode"] == "false":
                    return False
                if value["mode"] == "not-implemented":
                    return NotImplemented
                if value["mode"] == "citation":
                    return other.citation.groups.get("page") == value["token"] if isinstance(other, models.Resource) else NotImplemented
                if value["mode"] == "normalized":
                    return hash(self) == hash(other)
                return value["token"] == states[other.slot]["token"] if isinstance(other, Host) else NotImplemented
        hosts = [Host(i) for i in range(len(states))]
        keys.extend(canonical if spec["kind"] == "canonical" else hosts[spec["host"]] for spec in specs)
        def resource_equal(left, right):
            trace.append({"kind": "resource-eq", "slot": operand(left)["slot"], "other": operand(right)})
            return original_equal(left, right)
        models.Resource.__eq__ = resource_equal
        lists = [[], [], [], []]
        def allocate():
            value = []
            lists.append(value)
            return value
        from collections import defaultdict
        table = defaultdict(allocate)
        events = []
        fulls = [(canonical.citation, hosts[0])]
        def presentation(value):
            return {"kind": "host", "slot": value.slot, "token": states[value.slot]["token"]} if isinstance(value, Host) else operand(value)
        try:
            for operation in operations:
                trace.clear()
                kind = operation["kind"]
                try:
                    result = None
                    if kind == "set":
                        table[keys[operation["key"]]] = lists[operation["value"]]
                    elif kind == "get":
                        value = table[keys[operation["key"]]]
                        result = next(i for i, item in enumerate(lists) if item is value)
                    elif kind == "remove":
                        value = table.pop(keys[operation["key"]], None)
                        result = None if value is None else next(i for i, item in enumerate(lists) if item is value)
                    elif kind == "clear":
                        table.clear()
                    elif kind == "page":
                        canonical.citation.groups["page"] = operation["value"]
                    elif kind == "alias":
                        keys.append(keys[operation["key"]])
                        result = next(i for i, key in enumerate(keys) if key is keys[-1])
                    elif kind == "append":
                        key = keys[operation["key"]]
                        if key:
                            table[key].append(operation["member"])
                    else:
                        field = operation["field"] if kind == "flag" else kind
                        states[operation["host"]][field] = operation["value"]
                    outcome = {"status": "value", "result": result}
                except ValueError as error:
                    outcome = {"status": "error", "operation": str(error)}
                fulls[:] = list(fulls)
                entries = [{"objectId": next(i for i, key in enumerate(keys) if key is actual), "slot": next(i for i, item in enumerate(lists) if item is value), "presentation": presentation(actual)} for actual, value in table.items()]
                events.append({"operation": operation, "outcome": outcome, "entries": entries, "lists": copy.deepcopy(lists), "trace": copy.deepcopy(trace), "priorPresentation": presentation(fulls[0][1])})
        finally:
            models.Resource.__eq__ = original_equal
        rows.append({"name": name, "hosts": initial, "keys": specs, "events": events})
    callbacks = []
    for name, initial in [("truthy", state()), ("falsy", state(truth=False)), ("truth-changes-in-hash", state(after=False))]:
        trace = []
        states = [copy.deepcopy(initial)]
        hosts = [Host(0)]
        citations = [get_citations("1 U.S. 1")[0], get_citations("Id. at 2")[0]]
        result = resolve.resolve_citations(citations, resolve_full_citation=lambda citation: hosts[0])
        callbacks.append({"name": name, "host": initial, "trace": copy.deepcopy(trace), "groups": [[next(i for i, citation in enumerate(citations) if citation is member) for member in members] for members in result.values()]})
    raws = {value["hashRaw"] for _, initial, _, _ in definitions for value in initial}
    raws.update(operation["value"] for _, _, _, operations in definitions for operation in operations if operation["kind"] == "hashRaw")
    class HashProbe:
        def __init__(self, value): self.value = value
        def __hash__(self): return int(self.value)
    normalized = {raw: str(hash(HashProbe(raw))) for raw in sorted(raws)}
    output = {"schemaVersion": "citation-host-resources/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "lockSha256": hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest(), "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "resolve.py")}, "scope": "Controlled custom-key protocol, one actual canonical Resource and default full/Id callbacks; no automatic native primitive normalization, set uniqueness or reentrant mutation proof.", "normalizedHashes": normalized, "cases": rows, "callbacks": callbacks}
    args.output.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n")
    print(f"captured {len(rows)} custom-key histories / {sum(len(row['events']) for row in rows)} events and {len(callbacks)} callback scenes")


if __name__ == "__main__":
    main()
