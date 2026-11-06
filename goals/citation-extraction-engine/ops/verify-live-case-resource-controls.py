#!/usr/bin/env python3
"""Validate live Resource/table composition observations and exact source replay."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["same-bucket-live-alias", "changed-bucket-live-alias", "distinct-resources-shared-citation", "distinct-citations-current-equality", "create-does-not-hash"]


def check(data):
    assert data["schemaVersion"] == "citation-live-case-resources/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-live-case-resources.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "utils.py": "8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e"}
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    assert [len(row["events"]) for row in rows] == [5, 8, 9, 11, 5]
    assert rows[0]["events"][3]["outcome"] == {"status": "value", "result": 0}
    assert rows[1]["events"][3]["outcome"] == {"status": "value", "result": None}
    assert rows[1]["events"][4]["entries"] == [{"objectId": 0, "value": 0}, {"objectId": 0, "value": 1}]
    assert rows[2]["events"][3]["comparisons"] == [[0, 1]]
    assert rows[2]["events"][5]["entries"] == [{"objectId": 0, "value": 0}, {"objectId": 1, "value": 1}]
    assert rows[3]["events"][5]["outcome"] == {"status": "value", "result": True}
    assert rows[4]["events"][0]["outcome"] == {"status": "value", "result": 0}
    assert rows[4]["events"][1]["outcome"] == {"status": "error", "field": "reporter"}
    assert rows[4]["events"][3]["outcome"] == {"status": "value", "result": "1986750081022884797"}
    for row in rows:
        created = 0
        for event in row["events"]:
            if event["operation"]["kind"] == "create":
                assert event["outcome"] == {"status": "value", "result": created}
                created += 1
            assert all(0 <= entry["objectId"] < created and type(entry["value"]) is int for entry in event["entries"])
            assert all(0 <= value < created for pair in event["comparisons"] for value in pair)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/live-case-resources.json").read_bytes())
    check(data)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(license="unknown"), lambda d: d.update(python="3.12.0"), lambda d: d["cases"][0]["events"][3]["outcome"].update(result=None), lambda d: d["cases"][1]["events"][4]["entries"].pop(), lambda d: d["cases"][2]["events"][3].update(comparisons=[]), lambda d: d["cases"][4]["events"][1].update(outcome={"status": "value", "result": None})]
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
        with tempfile.TemporaryDirectory(prefix="citation-live-resources-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-live-case-resources.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 5 actual Resource/table histories / 38 events and 8 corruption controls; full callback dispatch remains open")


if __name__ == "__main__":
    main()
