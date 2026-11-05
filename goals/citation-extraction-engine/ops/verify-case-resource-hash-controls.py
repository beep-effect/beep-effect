#!/usr/bin/env python3
"""Check portable case-hash observations, corruption controls and optional replay."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["page-1", "page-2", "page-20", "volume-2", "volume-absent", "volume-null", "reporter-null", "reporter-empty", "bmp", "astral", "quotes", "control-del", "high-surrogate", "low-surrogate", "corrected", "corrected-no-raw", "ignored-extra", "ignored-metadata", "null-page", "null-page-same-identity", "null-page-other-identity", "null-page-lazy-edition", "missing-page", "missing-reporter"]


def check(data):
    assert data["schemaVersion"] == "citation-case-resource-hashes/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["hashWidth"] == 64 and data["hashModulus"] == "2305843009213693951"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-case-resource-hash.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "utils.py": "8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e"}
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    for index, row in enumerate(rows):
        assert row["identityMode"] == ("controlled-source-id-hook" if 18 <= index <= 21 else "content")
        if index >= 22:
            assert row["expected"] == {"error": "missing-page" if index == 22 else "missing-reporter"}
        else:
            assert set(row["expected"]) == {"citationHash", "resourceHash"}
            for value in row["expected"].values():
                assert str(int(value)) == value and 0 <= int(value) < 2**63
    assert [row["expected"]["resourceHash"] for row in rows[:3]] == ["1986750081022884797", "1465210507262904853", "1226098292844416122"]
    assert all(rows[i]["expected"] == rows[0]["expected"] for i in (14, 15, 16, 17))
    assert rows[18]["expected"] == rows[19]["expected"] == rows[21]["expected"]
    assert rows[20]["expected"] != rows[18]["expected"]
    assert rows[4]["expected"] != rows[5]["expected"]
    assert rows[6]["expected"] != rows[7]["expected"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/case-resource-hashes.json").read_bytes())
    check(data)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(license="unknown"), lambda d: d.update(hashWidth=32), lambda d: d["cases"][0]["expected"].update(resourceHash="0"), lambda d: d["cases"][18].update(identityMode="content"), lambda d: d["cases"][22].update(expected={"error": "missing-reporter"}), lambda d: d["cases"][19]["expected"].update(citationHash="4294967312")]
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
        with tempfile.TemporaryDirectory(prefix="citation-case-hash-") as directory:
            output = Path(directory) / "hashes.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-case-resource-hash.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 24 case/resource hash observations and 8 corruption controls; live object identity and owner integration remain open")


if __name__ == "__main__":
    main()
