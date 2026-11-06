#!/usr/bin/env python3
"""Validate candidate-set evidence and reject omitted/reordered semantic proof."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["changed-hash-same-bucket", "equal-objects", "collision-linear-probes-growth", "resize-caches-insertion-hash", "false-equality-pointer", "signed-wide-hashes", "comparison-error", "current-equality-cached-hash"]
CALLBACKS = ["short-equal", "short-collision", "short-same-object", "short-named-equal", "short-named-collision", "short-narrow", "supra-equal", "supra-collision", "supra-same-object", "reference-equal", "reference-collision", "reference-same-object"]


def check(data):
    assert data["schemaVersion"] == "citation-runtime-set/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause" and data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["cpythonLicenseSha256"] == "3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf"
    assert data["setSourceSha256"] == "01462829ff1e731582656adf49ef1d662a5f48002ac49114acdae1ea3674ce57"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-runtime-set.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "resolve.py": "651ede8c2a2d5df9ec9c9f1145530a6de7fca15304d1816b7f620a81ab3f2044"}
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    assert [len(row["events"]) for row in rows] == [4, 3, 33, 8, 4, 10, 5, 4]
    assert [len(row["events"][-1]["objects"]) for row in rows] == [2, 1, 30, 7, 2, 5, 2, 3]
    assert [sum(len(event["comparisons"]) for event in row["events"]) for row in rows] == [0, 1, 543, 0, 2, 14, 2, 1]
    assert rows[0]["events"][-1]["objects"] == [0, 0]
    assert rows[1]["events"][-1]["objects"] == [0]
    for row in rows:
        for event in row["events"]:
            assert all(0 <= index < len(event["keys"]) for index in event["objects"])
    assert rows[6]["events"][2]["outcome"] == {"status": "error", "kind": "ValueError"}
    assert rows[6]["events"][2]["objects"] == rows[6]["events"][0]["objects"]
    callbacks = data["callbacks"]
    assert [row["name"] for row in callbacks] == CALLBACKS
    assert [len(row["trace"]) for row in callbacks] == [11, 11, 9, 11, 14, 14, 11, 11, 9, 11, 11, 9]
    assert [row["groups"] for row in callbacks] == [[[0, 1, 2]], [[0], [1]], [[0, 1, 2]], [[0, 1, 2]], [[0], [1]], [[0, 2], [1]], [[0, 1, 2]], [[0], [1]], [[0, 1, 2]], [[0, 1, 2]], [[0], [1]], [[0, 1, 2]]]
    assert callbacks[3]["antecedentGuess"] == callbacks[4]["antecedentGuess"] == callbacks[5]["antecedentGuess"] == "Alpha"
    assert callbacks[5]["fullNames"] == ["Alpha", "Beta"]
    assert callbacks[0]["trace"] == callbacks[3]["trace"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    parser.add_argument("--cpython-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/runtime-set.json").read_bytes())
    check(data)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(setSourceSha256="a" * 64), lambda d: d["cases"][0]["events"][-1]["objects"].pop(), lambda d: d["cases"][2]["events"][-1].update(comparisons=[]), lambda d: d["cases"][6]["events"][2].update(outcome={"status": "value"}), lambda d: d["callbacks"][3]["trace"].append({"kind": "hash"}), lambda d: d["callbacks"][5].update(groups=[[0, 1, 2]])]
    for mutate in mutations:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            check(broken)
        except AssertionError:
            continue
        raise AssertionError("corruption accepted")
    if args.oracle_root:
        assert args.cpython_root is not None
        assert hashlib.sha256((args.cpython_root / "setobject.c").read_bytes()).hexdigest() == data["setSourceSha256"]
        assert hashlib.sha256((args.cpython_root / "LICENSE").read_bytes()).hexdigest() == data["cpythonLicenseSha256"]
        for name, digest in data["sources"].items():
            assert hashlib.sha256((args.oracle_root / "eyecite" / name).read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix="citation-runtime-set-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-runtime-set.py")), "--oracle-root", str(args.oracle_root), "--cpython-root", str(args.cpython_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 8 candidate-set histories / 71 events, 12 resolver scenes and 8 corruption controls; deletion/reentrancy remain outside this helper")


if __name__ == "__main__": main()
