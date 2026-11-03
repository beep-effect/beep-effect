#!/usr/bin/env python3
"""Observe bound constructor classes and ordered extras of every canonical extractor."""
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
ARTIFACT = "8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"


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
    from eyecite.models import Token
    from eyecite.tokenizers import EXTRACTORS
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, _ = operations.make_normalizer(root)
    fixtures = Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite"
    operation_bytes = (fixtures / "operation-cases.json").read_bytes()
    artifacts = json.loads(operation_bytes)["artifacts"]
    payload = artifacts[ARTIFACT]["payload"]
    assert sha(payload.encode()) == ARTIFACT
    original = json.loads(payload)
    assert len(original) == len(EXTRACTORS) == 6805
    rows = []
    editions = set()
    counts = {}
    for index, (extractor, captured) in enumerate(zip(EXTRACTORS, original, strict=True)):
        observed = normal(extractor)
        if operations.encoded(observed) != operations.encoded(captured):
            raise ValueError((index, {k: (observed["fields"][k], v) for k, v in captured["fields"].items() if observed["fields"][k] != v}))
        method = extractor.constructor
        cls = method.__self__
        assert isinstance(cls, type) and issubclass(cls, Token) and method.__func__ is Token.from_match.__func__
        kind = cls.__name__
        assert kind in {"Token", "CitationToken", "SectionToken", "SupraToken", "IdToken", "ParagraphToken", "StopWordToken", "PlaceholderCitationToken", "CaseReferenceToken"}
        assert set(extractor.extra) <= {"exact_editions", "variation_editions", "short"}
        if kind != "CitationToken":
            assert extractor.extra == {}
        exact = [normal(e)["artifactSha256"] for e in extractor.extra.get("exact_editions", [])]
        variation = [normal(e)["artifactSha256"] for e in extractor.extra.get("variation_editions", [])]
        for ref in exact + variation:
            assert artifacts[ref]["kind"] == "model-value"
            assert json.loads(artifacts[ref]["payload"])["pythonType"] == "eyecite.models.Edition"
            editions.add(ref)
        largest = max(map(ord, extractor.regex), default=0)
        width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
        native = bytes([width]) + b"".join(ord(c).to_bytes(width, "little") for c in extractor.regex)
        rows.append({"id": index, "patternSha256": sha(native), "flags": extractor.flags, "kind": kind,
                     "exact": exact, "variation": variation, "short": extractor.extra.get("short", False)})
        counts[kind] = counts.get(kind, 0) + 1
    out = {"schemaVersion": "citation-extractor-recipes/v1", "oracleCommit": PIN, "oracleTree": TREE,
           "python": "3.11.15", "versions": versions, "producerSha256": sha(Path(__file__).read_bytes()),
           "normalizerSha256": sha(Path(__file__).with_name("export-operations.py").read_bytes()),
           "operationFileSha256": sha(operation_bytes), "extractorsSha256": ARTIFACT,
           "sources": {name: sha((root / "eyecite" / name).read_bytes()) for name in ("models.py", "tokenizers.py")},
           "scope": "Bound built-in class and ordered constructor extras; not matching, runtime hashes or family approval.",
           "counts": counts, "editionRefs": sorted(editions), "recipes": rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"recipes": len(rows), "counts": counts, "editionRefs": len(editions)}))


if __name__ == "__main__":
    main()
