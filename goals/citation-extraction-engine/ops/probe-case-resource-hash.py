#!/usr/bin/env python3
"""Maintainer-only exact case/resource hash observations from frozen eyecite."""
import argparse
import copy
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


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
    assert sys.hash_info.width == 64 and sys.hash_info.modulus == 2305843009213693951
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    sys.path.insert(0, str(root))
    import eyecite.models as models

    fixture_dir = Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite"
    template = json.loads((fixture_dir / "authority-identity-cases.json").read_text())["cases"][0]["input"]
    base = {"volume": "1", "reporter": "U.S.", "page": "1"}
    scenes = []
    def add(name, groups=None, corrected=None, identity=None, metadata=False):
        scenes.append((name, base.copy() if groups is None else groups, corrected, identity, metadata))
    for page in ("1", "2", "20"):
        add("page-" + page, {**base, "page": page})
    add("volume-2", {**base, "volume": "2"})
    add("volume-absent", {"reporter": "U.S.", "page": "1"})
    add("volume-null", {**base, "volume": None})
    add("reporter-null", {**base, "reporter": None})
    add("reporter-empty", {**base, "reporter": ""})
    for name, value in (("bmp", "é中"), ("astral", "😀"), ("quotes", '"\\'), ("control-del", "\x00\n\t\x7f"), ("high-surrogate", "\ud800"), ("low-surrogate", "\udfff")):
        add(name, {**base, "reporter": value})
    add("corrected", {**base, "reporter": "raw"}, "U.S.")
    add("corrected-no-raw", {"volume": "1", "page": "1"}, "U.S.")
    add("ignored-extra", {**base, "extra": "unhashed"})
    add("ignored-metadata", metadata=True)
    add("null-page", {**base, "page": None}, identity=4294967296)
    add("null-page-same-identity", {"page": None}, identity=4294967296)
    add("null-page-other-identity", {"page": None}, identity=4294967312)
    add("null-page-lazy-edition", {"page": None}, "U.S.", 4294967296)
    add("missing-page", {"reporter": "U.S."})
    add("missing-reporter", {"page": "1"})
    rows = []
    for name, groups, corrected, identity, metadata in scenes:
        citation = models.FullCaseCitation(models.CitationToken("x", 0, 1, groups.copy()), index=0, groups=groups.copy())
        if corrected is not None:
            citation.edition_guess = SimpleNamespace(short_name=corrected)
        if metadata:
            citation.metadata.plaintiff = "unhashed"
        target = copy.deepcopy(template["citation"])
        target["components"] = groups
        target["publication"]["selectedEdition"] = None if corrected is None else template["selectedEdition"]["edition"]
        if metadata:
            target["metadata"]["plaintiff"] = "unhashed"
        supplied = None if corrected is None else {**template["selectedEdition"], "shortName": corrected}
        if name == "null-page-lazy-edition":
            # Deliberately absent selected reference proves the null-page branch skips lookup coherence.
            target["publication"]["selectedEdition"] = None
        data = {"citation": target, "selectedEdition": supplied, "missingPageIdentityHash": None if identity is None else str(identity)}
        # Controlled module-global id hook avoids emitting private process addresses.
        # It exercises the actual source __hash__, not a reimplementation.
        if identity is not None:
            models.id = lambda obj, value=identity: value
        try:
            result = {"citationHash": str(hash(citation)), "resourceHash": str(hash(models.Resource(citation)))}
        except KeyError as error:
            result = {"error": "missing-" + error.args[0]}
        finally:
            if identity is not None:
                del models.id
        rows.append({"name": name, "identityMode": "controlled-source-id-hook" if identity is not None else "content", "input": data, "expected": result})
    output = {"schemaVersion": "citation-case-resource-hashes/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "hashWidth": 64, "hashModulus": str(sys.hash_info.modulus), "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "lockSha256": hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "utils.py")}, "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "scope": "Exact case/resource hashes only; controlled null-page identities are not live identity-adapter proof.", "cases": rows}
    args.output.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n")
    print(f"captured {len(rows)} source case/resource hash observations")


if __name__ == "__main__":
    main()
