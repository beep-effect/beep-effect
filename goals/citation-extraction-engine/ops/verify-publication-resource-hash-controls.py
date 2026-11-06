#!/usr/bin/env python3
"""Check exact publication hashes, stable-tie evidence and optional source replay."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["law", "journal", "law-metadata", "selected-ignored", "no-editions", "duplicate-edition", "edition-order", "edition-order-reversed", "tied-abbreviation", "tied-abbreviation-reversed", "date-strings", "unicode-edition-order", "unicode-edition-order-reversed", "extra-group", "extra-null", "extra-empty", "reserved-groups", "unicode-group-keys", "absent-groups", "null-reporter", "journal-extra", "journal-no-editions"]


def check(data):
    assert data["schemaVersion"] == "citation-publication-resource-hashes/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0" and data["hashWidth"] == 64
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-publication-resource-hashes.py").read_bytes()).hexdigest()
    assert data["normalizerSha256"] == hashlib.sha256(Path(__file__).with_name("export-operations.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "utils.py": "8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e"}
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    for row in rows:
        assert set(row["expected"]) == {"citationHash", "resourceHash"}
        for value in row["expected"].values():
            assert str(int(value)) == value and 0 <= int(value) < 2305843009213693951
        refs = row["input"]["citation"]["publication"]["editions"]
        assert refs == [edition["edition"] for edition in row["input"]["editions"]]
    assert rows[0]["expected"]["resourceHash"] == "1337401405081846410"
    assert rows[1]["expected"]["resourceHash"] == "1596664220133016073"
    assert all(rows[index]["expected"] == rows[0]["expected"] for index in (2, 3, 16))
    assert rows[6]["expected"] == rows[7]["expected"]
    assert rows[8]["expected"] != rows[9]["expected"]
    assert rows[11]["expected"] == rows[12]["expected"]
    assert rows[0]["expected"] != rows[4]["expected"] != rows[5]["expected"]
    assert rows[14]["expected"] != rows[15]["expected"] != rows[0]["expected"]
    assert rows[10]["input"]["editions"][0]["value"]["start"] == "1900-01-02 03:04:05.006000+00:00"
    assert rows[10]["input"]["editions"][0]["value"]["end"] == "2000-12-31 00:00:00"
    assert rows[8]["input"]["editions"][0]["value"]["short_name"] == rows[8]["input"]["editions"][1]["value"]["short_name"]
    assert rows[9]["input"]["editions"] == list(reversed(rows[8]["input"]["editions"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/publication-resource-hashes.json").read_bytes())
    check(data)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(license="unknown"), lambda d: d.update(hashWidth=32), lambda d: d["cases"][0]["expected"].update(resourceHash="0"), lambda d: d["cases"][9].update(expected=copy.deepcopy(d["cases"][8]["expected"])), lambda d: d["cases"][10]["input"]["editions"][0]["value"].update(start="1900-01-02T03:04:05.006000+00:00"), lambda d: d["cases"][8]["input"]["citation"]["publication"]["editions"].reverse()]
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
        with tempfile.TemporaryDirectory(prefix="citation-publication-hash-") as directory:
            output = Path(directory) / "hashes.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-publication-resource-hashes.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 22 law/journal hash observations, stable-tie counterexample, 8 corruption controls; live artifact/owner integration remains open")


if __name__ == "__main__":
    main()
