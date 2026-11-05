#!/usr/bin/env python3
"""Check controlled host protocol observations; optionally replay pinned Python."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["canonical-first-reflection", "host-first-reflection", "canonical-first-wide-raw-hash", "host-first-wide-raw-hash", "false-equality-pointer-and-alias", "live-hash-and-truth", "live-canonical-access", "hash-equality-truth-errors"]


def check(data):
    assert data["schemaVersion"] == "citation-host-resources/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-host-resources.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "resolve.py": "651ede8c2a2d5df9ec9c9f1145530a6de7fca15304d1816b7f620a81ab3f2044"}
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    assert [len(row["events"]) for row in rows] == [4, 4, 4, 4, 6, 9, 8, 9]
    assert [len(row["events"][-1]["entries"]) for row in rows] == [1, 1, 2, 1, 2, 1, 1, 1]
    assert [sum(len(event["trace"]) for event in row["events"]) for row in rows] == [6, 8, 6, 6, 7, 9, 4, 5]
    for row in rows:
        for event in row["events"]:
            assert all(0 <= entry["slot"] < len(event["lists"]) for entry in event["entries"])
            assert event["priorPresentation"]["kind"] == "host" and event["priorPresentation"]["slot"] == 0
            assert event["priorPresentation"]["token"] == ("2" if row["name"] == "live-canonical-access" and event["operation"]["kind"] in ("token", "set", "get") and row["events"].index(event) >= 5 else row["hosts"][0]["token"])
    errors = [event["outcome"] for event in rows[-1]["events"] if event["outcome"]["status"] == "error"]
    assert errors == [{"status": "error", "operation": operation} for operation in ("compare", "hash", "bool")]
    assert rows[4]["events"][1]["trace"] == [{"kind": "hash", "slot": 0, "raw": "7"}]
    assert rows[4]["events"][-1]["outcome"] == {"status": "value", "result": 0}
    assert rows[5]["events"][-1]["lists"] == [[], [], [], [], [0], [1]]
    assert rows[6]["events"][-1]["priorPresentation"]["token"] == "2"
    h = "1986750081022884797"
    assert data["normalizedHashes"][str(int(h) + 8 * (2**61 - 1))] == h
    callbacks = data["callbacks"]
    assert [row["name"] for row in callbacks] == ["truthy", "falsy", "truth-changes-in-hash"]
    assert [row["groups"] for row in callbacks] == [[[0, 1]], [], [[0]]]
    assert [[event["kind"] for event in row["trace"]] for row in callbacks] == [["bool", "hash", "hash", "bool", "hash", "bool", "hash"], ["bool", "bool"], ["bool", "hash", "hash", "bool"]]
    assert callbacks[-1]["trace"][-1] == {"kind": "bool", "slot": 0, "result": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/host-resources.json").read_bytes())
    check(data)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(license="unknown"), lambda d: d["cases"][2]["events"][-1]["entries"].pop(), lambda d: d["cases"][4]["events"][1]["trace"].append({"kind": "eq"}), lambda d: d["cases"][6]["events"][-1]["priorPresentation"].update(token="1"), lambda d: d["callbacks"][2]["trace"][-1].update(result=True), lambda d: d["callbacks"][0].update(groups=[])]
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
        with tempfile.TemporaryDirectory(prefix="citation-host-resources-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-host-resources.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 8 controlled host histories / 48 events, 3 full/Id callback scenes and 8 corruption controls; native primitives, set uniqueness and reentrancy remain open")


if __name__ == "__main__":
    main()
