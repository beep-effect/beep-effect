#!/usr/bin/env python3
"""Capture ordered immutable factory lookup inputs from pinned eyecite (BSD-2-Clause)."""
import argparse
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
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()


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
    normalizer_path = Path(__file__).with_name("export-operations.py")
    spec = importlib.util.spec_from_file_location("operations", normalizer_path)
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, _ = operations.make_normalizer(root)
    rows = [{"reporter": name, "editions": [normal(edition)["artifactSha256"] for edition in EDITIONS_LOOKUP[name]]}
            for name in ("U.S.", "U. S.", "F. Supp.")]
    output = {"schemaVersion": "citation-factory-edition-lookup/v1", "oracleCommit": PIN, "oracleTree": TREE,
              "python": "3.11.15", "versions": versions, "license": "BSD-2-Clause",
              "licenseSha256": sha(root / "LICENSE"), "lockSha256": sha(root / "uv.lock"),
              "producerSha256": sha(__file__), "normalizerSha256": sha(normalizer_path),
              "sources": {name: sha(root / "eyecite" / name) for name in ("tokenizers.py", "test_factories.py")},
              "scope": "Ordered immutable lookup inputs only; object identity and dynamic lookup protocols remain open.",
              "rows": rows}
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
