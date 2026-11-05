#!/usr/bin/env python3
"""Validate prior-full source observations, corruption controls and optional replay."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["list-identity", "retained-sees-full-append", "retained-clear-from-full", "retained-reverse-from-full",
         "retained-insert-current-full", "retained-clear-from-id", "replace-first-entry", "equal-replace-pair"]
EXPECTED_GROUPS = [[("base", [0, 1, 2, 3])], [("base", [0, 1, 2, 3])], [("base", [0, 1, 2, 3])],
                   [("base", [0, 1, 2, 3, 4])], [("base", [0, 1, 2])], [("base", [0, 1, 2])],
                   [("base", [0]), ("foreign", [1, 2])], [("base", [0, 1, 2])]]
EXPECTED_FULLS = [[(0, 0, "base")], [(0, 0, "base"), (1, 2, "base")], [(1, 2, "base")],
                  [(1, 1, "base"), (0, 0, "base"), (2, 3, "base")],
                  [(0, 0, "base"), (1, 2, "foreign"), (2, 2, "base")], [], [(1, 0, "foreign")], [(1, 0, "base")]]


def check(data):
    assert data["schemaVersion"] == "citation-prior-full-observations/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["pythonVersion"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["exporterSha256"] == hashlib.sha256(Path(__file__).with_name("probe-prior-fulls.py").read_bytes()).hexdigest()
    assert [row["name"] for row in data["cases"]] == NAMES
    assert sum(len(row["events"]) for row in data["cases"]) == 31
    for index, row in enumerate(data["cases"]):
        assert len(row["events"]) == len(row["kinds"])
        pairs = {}
        first_context = True
        def pair(value):
            slot = value["pairSlot"]
            assert isinstance(slot, int) and slot >= 0
            assert 0 <= value["mention"] < len(row["kinds"])
            assert value["resource"] in ("base", "foreign")
            signature = (value["mention"], value["resource"])
            if slot in pairs:
                assert pairs[slot] == signature
            else:
                assert slot == len(pairs)
                pairs[slot] = signature
        for mention, event in enumerate(row["events"]):
            assert event["mention"] == mention
            assert event["slot"] == ("full" if row["kinds"][mention] == "case" else row["kinds"][mention])
            if event["slot"] in ("short", "supra", "reference"):
                assert event["listSlot"] == 0
                assert event["retainedListMatches"] is (None if first_context else True)
                first_context = False
                assert event["result"] in (None, "base", "foreign")
            if "retainedListSlot" in event:
                assert event["retainedListSlot"] == 0
            for value in event.get("before", []):
                pair(value)
            if "retainedPair" in event:
                pair(event["retainedPair"])
                assert event["retainedPair"]["pairSlot"] == 0
                assert event["retainedPairMatchesFirst"] is False
            for value in event.get("after", []):
                pair(value)
        for value in row["outcome"]["fulls"]:
            pair(value)
        assert [(g["resource"], g["members"]) for g in row["outcome"]["groups"]] == EXPECTED_GROUPS[index]
        assert [(p["pairSlot"], p["mention"], p["resource"]) for p in row["outcome"]["fulls"]] == EXPECTED_FULLS[index]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    fixture = repo / "packages/law-practice/use-cases/test/fixtures/eyecite/prior-full-observations.json"
    data = json.loads(fixture.read_bytes())
    check(data)
    mutations = [
        lambda value: value["cases"].pop(),
        lambda value: value["cases"].append(copy.deepcopy(value["cases"][0])),
        lambda value: value.update(license="unknown"),
        lambda value: value["cases"][0]["events"].pop(),
        lambda value: value["cases"][0]["events"][1].update(listSlot=1),
        lambda value: value["cases"][0]["events"][1]["before"][0].update(pairSlot=999),
        lambda value: value["cases"][7]["outcome"]["fulls"][0].update(pairSlot=0),
        lambda value: value["cases"][6]["events"][1].update(retainedPairMatchesFirst=True),
    ]
    for mutate in mutations:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            check(broken)
        except AssertionError:
            continue
        raise AssertionError("corruption accepted")
    if args.oracle_root:
        for name, digest in data["sources"].items():
            assert hashlib.sha256((args.oracle_root / "eyecite" / name).read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix="citation-prior-fulls-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-prior-fulls.py")),
                            "--oracle-root", str(args.oracle_root), "--output", str(output)],
                           env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 8 prior-full list/pair source observations and 8 corruption controls; target completion is separate")


if __name__ == "__main__":
    main()
