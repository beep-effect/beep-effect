#!/usr/bin/env python3
"""Validate mixed Resource/table histories and independent candidate/selection state."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

NAMES = ["mixed-live-fields", "distinct-equal-all-families", "actual-law-edition-ties", "actual-journal-edition-ties", "case-independent-selection", "controlled-null-page-lazy-artifact"]


def check(data, frozen):
    assert data["schemaVersion"] == "citation-live-resources/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == hashlib.sha256(Path(__file__).with_name("probe-live-resources.py").read_bytes()).hexdigest()
    assert data["normalizerSha256"] == hashlib.sha256(Path(__file__).with_name("export-operations.py").read_bytes()).hexdigest()
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "utils.py": "8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e", "tokenizers.py": "de2d345fe0211aa4f48d633035567ec941f113e48c41990b0b036db63d984a01"}  # Public source SHA-256 values. gitleaks:allow
    rows = data["cases"]
    assert [row["name"] for row in rows] == NAMES
    assert [len(row["events"]) for row in rows] == [20, 21, 16, 13, 10, 9]
    assert [sum(len(event["comparisons"]) for event in row["events"]) for row in rows] == [1, 9, 1, 0, 0, 3]
    known = {row["edition"]: row for row in frozen["editions"]}
    for index, row in enumerate(rows):
        assert row["identityMode"] == ("controlled-source-id-hook" if index == 5 else "content")
        publications = []
        for value in row["initial"]:
            citation = value["citation"]
            publication = citation["publication"]
            refs = [edition["edition"] for edition in publication["editions"]] if citation["type"] == "case" else publication["editions"]
            publications.append({"editions": refs, "selectedEdition": publication["selectedEdition"]})
            assert all(ref in known for ref in refs) or index == 5 and citation["components"] == {"page": None} and value["missingPageIdentityHash"] == "4294967296"
        created = 0
        for event in row["events"]:
            operation = event["operation"]
            if operation["kind"] == "create":
                assert event["outcome"] == created
                created += 1
            if operation["kind"] == "editions":
                assert all(ref in known for ref in operation["values"])
                publications[operation["reference"]]["editions"] = operation["values"]
            assert event["publications"] == publications
            assert all(0 <= entry["objectId"] < created and type(entry["value"]) is int for entry in event["entries"])
            assert all(0 <= value < created for pair in event["comparisons"] for value in pair)
    assert rows[1]["events"][-1]["entries"] == [{"objectId": 0, "value": 1}, {"objectId": 2, "value": 3}, {"objectId": 4, "value": 5}]
    for index, abbreviation, family, hashes in [(2, "Ga. Code Ann. Adv. Legis. Serv.", "law", ["1350038462333559363", "418362191979755020"]), (3, "Rutgers Race & L. Rev.", "journal", ["1290329969722259344", "928901355473534368"])]:
        row = rows[index]
        assert [event["outcome"] for event in row["events"] if event["operation"]["kind"] == "hash"] == hashes
        first = next(event["operation"]["values"] for event in row["events"] if event["operation"]["kind"] == "editions")
        assert len(first) == 2 and first[0] != first[1]
        assert all(known[ref]["family"] == family and known[ref]["shortName"] == abbreviation for ref in first)
        final = row["events"][-1]["publications"][0]
        assert final["editions"] == [] and final["selectedEdition"] is not None
    assert [event["outcome"] for event in rows[4]["events"] if event["operation"]["kind"] == "hash"] == ["1986750081022884797"] * 2
    assert rows[4]["events"][4]["publications"][0]["editions"] == []
    assert rows[4]["events"][4]["publications"][0]["selectedEdition"] is not None
    assert rows[5]["events"][7]["outcome"] == "725453319809313587"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    fixtures = repo / "packages/law-practice/use-cases/test/fixtures/eyecite"
    data = json.loads((fixtures / "live-resources.json").read_bytes())
    frozen = json.loads((fixtures / "frozen-editions.json").read_bytes())
    check(data, frozen)
    mutations = [lambda d: d["cases"].pop(), lambda d: d["cases"].append(copy.deepcopy(d["cases"][0])), lambda d: d.update(license="unknown"), lambda d: d["cases"][1]["events"][-1]["entries"].pop(), lambda d: d["cases"][1]["events"][-1].update(comparisons=[]), lambda d: d["cases"][2]["events"][8].update(outcome=d["cases"][2]["events"][6]["outcome"]), lambda d: d["cases"][4]["events"][4]["publications"][0].update(selectedEdition=None), lambda d: d["cases"][5].update(identityMode="content")]
    for mutate in mutations:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            check(broken, frozen)
        except AssertionError:
            continue
        raise AssertionError("corruption accepted")
    if args.oracle_root:
        for name, digest in data["sources"].items():
            assert hashlib.sha256((args.oracle_root / "eyecite" / name).read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix="citation-live-resources-") as directory:
            output = Path(directory) / "observations.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-live-resources.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS 6 mixed Resource/table histories / 89 events, independent selections and 8 corruption controls; full callback dispatch remains open")


if __name__ == "__main__":
    main()
