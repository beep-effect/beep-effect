#!/usr/bin/env python3
"""Bind every frozen reporter/edition artifact to actual source dataclass payloads."""
import argparse
from dataclasses import asdict
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
MANIFEST = "b6d3fdd9b6fb4e006c3ede86639c46e7579ff03d39091bdd74ca60919dfe648e"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == "cpython"
    assert os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    sys.path.insert(0, str(root))
    from eyecite.tokenizers import EDITIONS_LOOKUP
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, artifacts = operations.make_normalizer(root)
    actual = {}
    for values in EDITIONS_LOOKUP.values():
        for edition in values:
            reference = normal(edition)["artifactSha256"]
            value = asdict(edition)
            payload = json.dumps(value, sort_keys=True, default=str)
            family = {"reporters": "case", "laws": "law", "journals": "journal"}[edition.reporter.source]
            row = {"edition": reference, "family": family, "shortName": edition.short_name, "runtimePayloadSha256": sha(payload.encode())}
            if reference in actual:
                assert actual[reference] == row
            actual[reference] = row
    repo = Path(__file__).resolve().parents[3]
    operation_file = repo / "packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json"
    captured = json.loads(operation_file.read_bytes())["artifacts"]
    refs = {"reporters": [], "editions": []}
    for ref, artifact in artifacts.items():
        assert artifact["kind"] == "model-value"
        value = artifact["value"]
        kind = {"eyecite.models.Reporter": "reporters", "eyecite.models.Edition": "editions"}[value["pythonType"]]
        payload = operations.encoded(value)
        assert ref == sha(payload.encode())
        assert captured[ref] == {"kind": "model-value", "payload": payload}
        refs[kind].append(ref)
    assert len(refs["reporters"]) == 2430 and len(refs["editions"]) == len(actual) == 2533
    expected = {ref for ref, artifact in captured.items() if artifact["kind"] == "model-value" and json.loads(artifact["payload"])["pythonType"] in ("eyecite.models.Reporter", "eyecite.models.Edition")}
    assert set(artifacts) == expected
    manifest = operations.encoded({kind: sorted(values) for kind, values in refs.items()})
    assert sha(manifest.encode()) == MANIFEST
    output = {"schemaVersion": "citation-frozen-editions/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause", "licenseSha256": sha((root / "LICENSE").read_bytes()), "lockSha256": sha((root / "uv.lock").read_bytes()), "producerSha256": sha(Path(__file__).read_bytes()), "normalizerSha256": sha(Path(__file__).with_name("export-operations.py").read_bytes()), "operationFileSha256": sha(operation_file.read_bytes()), "manifestSha256": MANIFEST, "reporterCount": 2430, "editionCount": 2533, "sources": {name: sha((root / "eyecite" / name).read_bytes()) for name in ("models.py", "tokenizers.py")}, "scope": "Complete immutable edition/reporter adapter proof; raw candidate order and full engine integration remain separate.", "editions": [actual[ref] for ref in sorted(actual)]}
    args.output.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n")
    print("captured all 2430 reporter / 2533 edition identities and exact runtime payload digests")


if __name__ == "__main__":
    main()
