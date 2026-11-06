#!/usr/bin/env python3
"""Check complete frozen edition identities, runtime payloads and source replay."""
import argparse
import copy
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

MANIFEST = "b6d3fdd9b6fb4e006c3ede86639c46e7579ff03d39091bdd74ca60919dfe648e"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def check(data, operation_raw):
    assert data["schemaVersion"] == "citation-frozen-editions/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["python"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["lockSha256"] == "864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"
    assert data["producerSha256"] == sha(Path(__file__).with_name("probe-frozen-editions.py").read_bytes())
    assert data["normalizerSha256"] == sha(Path(__file__).with_name("export-operations.py").read_bytes())
    assert data["operationFileSha256"] == sha(operation_raw) == "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
    assert data["manifestSha256"] == MANIFEST
    assert data["reporterCount"] == 2430 and data["editionCount"] == 2533
    assert data["sources"] == {"models.py": "2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a", "tokenizers.py": "de2d345fe0211aa4f48d633035567ec941f113e48c41990b0b036db63d984a01"}  # Public source SHA-256, not a credential. gitleaks:allow
    reporters, editions = {}, {}
    for ref, artifact in json.loads(operation_raw)["artifacts"].items():
        if artifact["kind"] != "model-value":
            continue
        assert sha(artifact["payload"].encode()) == ref
        value = json.loads(artifact["payload"])
        if value["pythonType"] == "eyecite.models.Reporter":
            reporters[ref] = value["fields"]
        if value["pythonType"] == "eyecite.models.Edition":
            editions[ref] = value["fields"]
    assert len(reporters) == 2430 and len(editions) == 2533
    encoded = json.dumps({"editions": sorted(editions), "reporters": sorted(reporters)}, separators=(",", ":"), sort_keys=True)
    assert sha(encoded.encode()) == MANIFEST
    assert [row["edition"] for row in data["editions"]] == sorted(editions)
    assert Counter(row["family"] for row in data["editions"]) == {"case": 1362, "law": 373, "journal": 798}
    for row in data["editions"]:
        fields = editions[row["edition"]]
        reporter = reporters[fields["reporter"]["artifactSha256"]]
        assert row["family"] == {"reporters": "case", "laws": "law", "journals": "journal"}[reporter["source"]]
        assert row["shortName"] == fields["short_name"]
        payload = {**fields, "reporter": reporter}
        for name in ("start", "end"):
            value = fields[name]
            assert value is None or set(value) == {"datetime"}
            payload[name] = None if value is None else value["datetime"].replace("T", " ", 1)
        assert row["runtimePayloadSha256"] == sha(json.dumps(payload, sort_keys=True).encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    fixture = repo / "packages/law-practice/use-cases/test/fixtures/eyecite/frozen-editions.json"
    operation_raw = (fixture.parent / "operation-cases.json").read_bytes()
    data = json.loads(fixture.read_bytes())
    check(data, operation_raw)
    mutations = [lambda d: d["editions"].pop(), lambda d: d["editions"].append(copy.deepcopy(d["editions"][0])), lambda d: d.update(license="unknown"), lambda d: d.update(manifestSha256="0"*64), lambda d: d["editions"][0].update(runtimePayloadSha256="0"*64), lambda d: d["editions"][0].update(family="law"), lambda d: d["editions"][0].update(shortName="invented"), lambda d: d.update(producerSha256="0"*64)]
    for mutate in mutations:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            check(broken, operation_raw)
        except AssertionError:
            continue
        raise AssertionError("corruption accepted")
    if args.oracle_root:
        for name, digest in data["sources"].items():
            assert sha((args.oracle_root / "eyecite" / name).read_bytes()) == digest
        with tempfile.TemporaryDirectory(prefix="citation-frozen-editions-") as directory:
            output = Path(directory) / "editions.json"
            subprocess.run([sys.executable, str(Path(__file__).with_name("probe-frozen-editions.py")), "--oracle-root", str(args.oracle_root), "--output", str(output)], env={**os.environ, "PYTHONHASHSEED": "0"}, check=True)
            assert json.loads(output.read_bytes()) == data
    print("PASS all 2430 reporter / 2533 edition identities and runtime payloads, 8 corruption controls; final engine integration remains open")


if __name__ == "__main__":
    main()
