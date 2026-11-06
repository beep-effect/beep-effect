#!/usr/bin/env python3
"""Check independent return/append history and optional fresh source replay."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["distinct-equal-returned-key", "falsy-retained-result", "truth-changes-during-append", "removed-entry-history", "same-object-reinsert-history", "unknown-resets-last", "none-full-result", "live-returned-presentation"]


def check(data):
    assert data["schemaVersion"] == "citation-dispatch-decisions/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-dispatch-decisions.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "resolve.py": "651ede8c2a2d5df9ec9c9f1145530a6de7fca15304d1816b7f620a81ab3f2044"}
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    assert [len(row["decisions"]) for row in rows] == [2, 2, 2, 3, 3, 3, 2, 2]
    assert [len(row["trace"]) for row in rows] == [6, 2, 4, 10, 10, 3, 0, 5]
    for row in rows:
        assert [decision["mention"] for decision in row["decisions"]] == list(range(len(row["kinds"])))
        assert [decision["callback"] for decision in row["decisions"]] == ["full" if kind == "case" else kind for kind in row["kinds"]]
        assert len({group["entrySlot"] for group in row["groups"]}) == len(row["groups"])
    equal = rows[0]["decisions"][1]
    assert equal["resource"]["slot"] == 1 and equal["assignment"]["resource"]["slot"] == 0 and equal["assignment"]["entrySlot"] == 0
    assert rows[1]["decisions"][0]["resource"]["kind"] == "host" and rows[1]["decisions"][0]["assignment"] is None
    assert rows[1]["groups"] == []
    assert rows[2]["decisions"][0]["assignment"] is not None and rows[2]["decisions"][1]["resource"] == {"kind": "none"}
    for index in (3, 4):
        assert [decision["assignment"]["entrySlot"] for decision in rows[index]["decisions"]] == [0, 1, 1]
        assert [group["entrySlot"] for group in rows[index]["groups"]] == [1]
        assert rows[index]["groups"][0]["members"] == [1, 2]
    assert [decision["resource"]["slot"] for decision in rows[4]["decisions"]] == [0, 0, 0]
    assert rows[5]["decisions"][1]["resource"] == rows[5]["decisions"][2]["resource"] == {"kind": "none"}
    assert all(decision["resource"] == {"kind": "none"} and decision["assignment"] is None for decision in rows[6]["decisions"])
    assert all(decision["resource"]["token"] == "changed" and decision["assignment"]["resource"]["token"] == "changed" for decision in rows[7]["decisions"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/dispatch-decisions.json").read_bytes())
    check(data)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(oracleCommit="a" * 40), lambda d: d["cases"][1]["decisions"][0].update(resource={"kind": "none"}), lambda d: d["cases"][0]["decisions"][1]["assignment"].update(resource=d["cases"][0]["decisions"][1]["resource"]), lambda d: d["cases"][3]["decisions"][0]["assignment"].update(entrySlot=1), lambda d: d["cases"][6]["decisions"].pop(), lambda d: d["cases"][7]["decisions"][0]["resource"].update(token="same")]
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
        with tempfile.TemporaryDirectory(prefix="citation-dispatch-decisions-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-dispatch-decisions.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 8 dispatcher histories / 19 decisions and 8 corruption controls; unique-list observation is not shared-list selection proof")


if __name__ == "__main__": main()
