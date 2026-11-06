#!/usr/bin/env python3
"""Verify focused callback observations and optionally replay the pinned oracle.

This validates source evidence only; it is never a target parity gate.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    exporter = Path(__file__).with_name("probe-custom-resolution.py")
    fixture = repo / "packages/law-practice/use-cases/test/fixtures/eyecite/custom-resolution-observations.json"
    raw = fixture.read_bytes()
    data = json.loads(raw)
    assert data["schemaVersion"] == "citation-custom-resolution-observations/v1"
    assert data["oracleCommit"] == "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
    assert data["oracleTree"] == "a35a58fac03400f71a93a93485b77f1d56f2b02f"
    assert data["pythonVersion"] == "3.11.15" and data["pythonHashSeed"] == "0"
    assert data["versions"] == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    assert data["license"] == "BSD-2-Clause"
    assert data["licenseSha256"] == "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"
    assert data["exporterSha256"] == hashlib.sha256(exporter.read_bytes()).hexdigest()
    rows = {row["name"]: row for row in data["cases"]}
    assert len(rows) == len(data["cases"]) == 18
    expected = {
        "all-five-dispatch": [[0, 1, 2, 3, 4, 6, 7]],
        "full-merge-first-page-controls-id": [[0, 1]],
        "full-merge-reversed-pages": [[0, 1, 2]],
        **{f"falsy-full-{label}": [] for label in ("none", "false", "zero", "empty-string", "empty-tuple")},
        "equal-keys-keep-first-key-object": [[0, 1, 2]],
        **{f"{kind}-resource-without-full": [[0, 1]] for kind in ("short", "supra", "reference", "id")},
        "false-short-resets-last": [[0]],
        "custom-key-default-short-supra": [[0, 1, 2, 3]],
        "mutable-prior-full-state": [[0]],
    }
    assert set(rows) == set(expected) | {"unhashable-truthy-resource", "callback-exception-stops-dispatch"}
    for name, groups in expected.items():
        outcome = rows[name]["outcome"]
        assert outcome["status"] == "value", name
        assert [group["members"] for group in outcome["groups"]] == groups, name
    assert rows["unhashable-truthy-resource"]["outcome"] == {"status": "error", "kind": "TypeError"}
    assert rows["callback-exception-stops-dispatch"]["outcome"] == {"status": "error", "kind": "ValueError"}
    events = rows["all-five-dispatch"]["events"]
    assert [(event["slot"], event["mention"]) for event in events] == [
        ("full", 0), ("shortcase", 1), ("supra", 2), ("reference", 3), ("id", 4), ("full", 6), ("full", 7)
    ]
    assert [entry["mention"] for entry in events[1]["fulls"]] == [0]
    assert events[4]["groups"][0]["members"] == [0, 1, 2, 3]
    assert rows["equal-keys-keep-first-key-object"]["outcome"]["groups"][0]["resource"] == {"kind": "int", "value": 1}
    assert [event["slot"] for event in rows["callback-exception-stops-dispatch"]["events"]] == ["full", "shortcase"]
    assert rows["mutable-prior-full-state"]["events"][2]["fulls"] == []
    if args.oracle_root:
        for name, digest in data["sources"].items():
            assert hashlib.sha256((args.oracle_root / "eyecite" / name).read_bytes()).hexdigest() == digest
        with tempfile.TemporaryDirectory(prefix="citation-custom-resolution-") as temporary:
            output = Path(temporary) / "observations.json"
            subprocess.run(
                [sys.executable, str(exporter), "--oracle-root", str(args.oracle_root), "--output", str(output)],
                env={**os.environ, "PYTHONHASHSEED": "0"}, check=True,
            )
            assert json.loads(output.read_bytes()) == data, "oracle replay differs from committed evidence"
    print("PASS 18 callback/resource source observations; target custom resolution remains unproved")


if __name__ == "__main__":
    main()
