#!/usr/bin/env python3
"""Check all callback mutation source observations and optional pinned replay.

No target row is promoted by these source controls.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import os
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    exporter = Path(__file__).with_name("probe-callback-mutations.py")
    fixture = repo / "packages/law-practice/use-cases/test/fixtures/eyecite/callback-mutation-observations.json"
    data = json.loads(fixture.read_bytes())
    assert data["schemaVersion"] == "citation-callback-mutation-observations/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["pythonVersion"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["exporterSha256"] == hashlib.sha256(exporter.read_bytes()).hexdigest()
    rows = {row["name"]: row for row in data["cases"]}
    assert len(rows) == len(data["cases"]) == 16
    assert Counter(row["family"] for row in rows.values()) == {
        "known-group": 10, "alias": 3, "detached-member": 1, "detached-prior-full": 2,
    }
    expected = {
        "create-empty": [("base", [0]), ("empty", [])],
        "clear-groups": [], "move-members": [("moved", [0, 1])],
        "reverse-members": [("base", [1, 0, 2])],
        "duplicate-prior": [("base", [0, 0, 1])],
        "copy-to-second": [("base", [0, 1]), ("other", [0])],
        "falsy-key": [("base", [0]), (0, [])],
        "none-key": [("base", [0]), (None, [0])],
        "insert-current": [("base", [0, 1, 1])],
        "read-missing-default": [("base", [0, 1]), ("unused", [])],
        "alias-member-lists": [("base", [0, 1]), ("other", [0, 1])],
        "dictionary-identity": [("base", [0, 1, 2])],
        "retained-dictionary-full": [("base", [2, 3])],
        "detached-member": [("base", [0]), ("other", ["detached:0"])],
        "append-detached-full": [("base", [0]), ("foreign", [1, 2])],
        "replace-detached-full": [("base", [0, 1, 2])],
    }
    assert set(rows) == set(expected)
    for name, row in rows.items():
        assert row["outcome"]["status"] == "value", name
        groups = row["outcome"]["groups"]
        def ref(value):
            if value["kind"] == "input":
                assert 0 <= value["index"] < len(row["kinds"])
                return value["index"]
            assert value["kind"] == "detached"
            assert 0 <= value["slot"] < len(row["detachedObjects"])
            return f'detached:{value["slot"]}'
        assert [(group["resource"]["value"], [ref(item) for item in group["members"]]) for group in groups] == expected[name], name
        # Equal list slots within a single snapshot mean the same contents.
        def check_lists(snapshot):
            seen = {}
            for group in snapshot:
                index = group["listSlot"]
                assert isinstance(index, int) and index >= 0
                if index in seen:
                    assert seen[index] == group["members"]
                seen[index] = group["members"]
        check_lists(groups)
        for event in row["events"]:
            if event["slot"] == "id":
                check_lists(event["before"])
                check_lists(event["after"])
    alias = rows["alias-member-lists"]["outcome"]["groups"]
    assert alias[0]["listSlot"] == alias[1]["listSlot"]
    identity = [event for event in rows["dictionary-identity"]["events"] if event["slot"] == "id"]
    assert identity[0]["retainedDictionaryMatches"] is None
    assert identity[1]["retainedDictionaryMatches"] is True
    assert identity[0]["dictionarySlot"] == identity[1]["dictionarySlot"]
    fulls = [event for event in rows["retained-dictionary-full"]["events"] if event["slot"] == "full"]
    assert fulls[1]["clearedDictionarySlot"] == 0
    for name in ("detached-member", "append-detached-full", "replace-detached-full"):
        detached = rows[name]["detachedObjects"]
        assert len(detached) == 1 and detached[0]["slot"] == 0
        assert detached[0]["citationType"] == "FullCaseCitation"
        assert detached[0]["groups"]["page"] == "9"
        assert detached[0]["metadata"]["plaintiff"] == "Detached"
    if args.oracle_root:
        for name, digest in data["sources"].items():
            assert hashlib.sha256((args.oracle_root / "eyecite" / name).read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix="citation-callback-mutations-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(exporter), "--oracle-root", str(args.oracle_root), "--output", str(output)],
                           env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data, "pinned source replay differs"
    print("PASS 16 mutation source observations; alias/detached target and final projection proof remain open")


if __name__ == "__main__":
    main()
