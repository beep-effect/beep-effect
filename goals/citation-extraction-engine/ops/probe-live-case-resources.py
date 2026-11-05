#!/usr/bin/env python3
"""Observe actual Resource objects sharing live citation fields in frozen eyecite."""
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == "cpython"
    assert sys.hash_info.width == 64 and os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    sys.path.insert(0, str(root))
    import eyecite.models as models
    base = {"volume": "1", "reporter": "U.S.", "page": "1"}
    def op(kind, **fields):
        return {"kind": kind, **fields}
    create = lambda reference=0: op("create", reference=reference)
    change = lambda value, reference=0: op("change", reference=reference, field="page", value=value)
    set_value = lambda resource, value: op("set", resource=resource, value=value)
    get = lambda resource: op("get", resource=resource)
    scenes = [
        ("same-bucket-live-alias", [base], [create(), set_value(0, 0), change("2"), get(0), set_value(0, 1)]),
        ("changed-bucket-live-alias", [base], [create(), set_value(0, 0), change("20"), get(0), set_value(0, 1), get(0), op("remove", resource=0), get(0)]),
        ("distinct-resources-shared-citation", [base], [create(), create(), set_value(0, 0), get(1), change("20"), set_value(1, 1), op("equal", left=0, right=1), get(0), get(1)]),
        ("distinct-citations-current-equality", [base, {**base, "page": "2"}], [create(), create(1), set_value(0, 0), set_value(1, 1), change("2"), op("equal", left=0, right=1), get(0), get(1), op("clear"), set_value(0, 2), get(1)]),
        ("create-does-not-hash", [{"volume": "1", "page": "1"}], [create(), op("hash", resource=0), op("change", reference=0, field="reporter", value="U.S."), op("hash", resource=0), set_value(0, 0)]),
    ]
    rows = []
    original_equal = models.Resource.__eq__
    for name, initial, operations in scenes:
        citations = [models.FullCaseCitation(models.CitationToken("x", 0, 1, groups.copy()), index=i, groups=groups.copy()) for i, groups in enumerate(initial)]
        resources = []
        table = {}
        comparisons = []
        def equal(left, right):
            comparisons.append([next(i for i, resource in enumerate(resources) if resource is left), next(i for i, resource in enumerate(resources) if resource is right)])
            return original_equal(left, right)
        models.Resource.__eq__ = equal
        events = []
        try:
            for operation in operations:
                comparisons.clear()
                kind = operation["kind"]
                try:
                    result = None
                    if kind == "create":
                        resources.append(models.Resource(citations[operation["reference"]]))
                        result = len(resources) - 1
                    elif kind == "change":
                        citations[operation["reference"]].groups[operation["field"]] = operation["value"]
                    elif kind == "hash":
                        result = str(hash(resources[operation["resource"]]))
                    elif kind == "set":
                        table[resources[operation["resource"]]] = operation["value"]
                    elif kind == "get":
                        result = table.get(resources[operation["resource"]])
                    elif kind == "remove":
                        result = table.pop(resources[operation["resource"]], None)
                    elif kind == "equal":
                        result = resources[operation["left"]] == resources[operation["right"]]
                    elif kind == "clear":
                        table.clear()
                    outcome = {"status": "value", "result": result}
                except KeyError as error:
                    outcome = {"status": "error", "field": error.args[0]}
                entries = [{"objectId": next(i for i, resource in enumerate(resources) if resource is key), "value": value} for key, value in table.items()]
                events.append({"operation": operation, "outcome": outcome, "entries": entries, "comparisons": [pair.copy() for pair in comparisons]})
        finally:
            models.Resource.__eq__ = original_equal
        rows.append({"name": name, "initial": initial, "events": events})
    output = {"schemaVersion": "citation-live-case-resources/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "lockSha256": hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest(), "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "utils.py")}, "scope": "Actual case-resource/table composition only; full callback dispatch and arbitrary host keys remain open.", "cases": rows}
    args.output.write_text(json.dumps(output, indent=2) + "\n")
    print(f"captured {len(rows)} live-resource histories / {sum(len(row['events']) for row in rows)} events")


if __name__ == "__main__":
    main()
