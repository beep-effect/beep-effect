#!/usr/bin/env python3
"""Capture default source tokenizer composition with explicit edition hash parameters."""
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
CONFIG = "8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def native(text):
    if text is None:
        return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def text_of(value):
    raw = bytes.fromhex(value["bytes"])
    width = value["width"]
    return "".join(chr(int.from_bytes(raw[i:i + width], "little")) for i in range(0, len(raw), width))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--oracle-root", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--profile", type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *v: subprocess.check_output(["git", "-C", str(root), *v], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db", "pyahocorasick")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22", "pyahocorasick": "2.0.0"}
    sys.path.insert(0, str(root))
    from eyecite import models, tokenizers
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, _ = operations.make_normalizer(root)
    fixtures = Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite"
    inputs = {name: (fixtures / name).read_bytes() for name in ("operation-cases.json", "extractor-recipes.json", "extractor-selection.json", "regex-program-facts.json")}
    artifacts = json.loads(inputs["operation-cases.json"])["artifacts"]
    recipes = json.loads(inputs["extractor-recipes.json"])
    selection = json.loads(inputs["extractor-selection.json"])["canonical"]
    assert recipes["extractorsSha256"] == selection["extractorsSha256"] == CONFIG
    assert len(tokenizers.EXTRACTORS) == len(recipes["recipes"]) == 6805
    selector = tokenizers.AhocorasickTokenizer()
    assert normal(selector)["extractorsSha256"] == CONFIG
    objects = {}
    for extractor in tokenizers.EXTRACTORS:
        assert all(not 0xd800 <= ord(c) <= 0xdfff for text in [extractor.regex, *extractor.strings] for c in text)
        for key in ("exact_editions", "variation_editions"):
            for value in extractor.extra.get(key, []):
                ref = normal(value)["artifactSha256"]
                assert artifacts[ref]["kind"] == "model-value"
                assert operations.encoded(normal(value)) == operations.encoded({"artifactSha256": ref})
                objects[ref] = value
    assert sorted(objects) == recipes["editionRefs"] and len(objects) == 2533
    ids = {ref: index for index, ref in enumerate(sorted(objects))}
    editions = [{"id": ids[ref], "ref": ref, "hash": str(hash(value)), "equalityClass": ids[ref], "reporterShortName": value.reporter.short_name} for ref, value in sorted(objects.items())]
    # Verify the reference/equality partition rather than assume different refs
    # necessarily mean different source values.
    buckets = {}
    for ref, value in sorted(objects.items()):
        prior = buckets.setdefault(hash(value), [])
        assert all(other != value for other in prior)
        prior.append(value)
    if args.profile:
        old = json.loads(args.profile.read_text())
        assert [{k: v for k, v in row.items() if k != "hash"} for row in editions] == [{k: v for k, v in row.items() if k != "hash"} for row in old["editions"]]
        editions = old["editions"]
        frozen_hashes = {row["ref"]: int(row["hash"]) for row in editions}
        models.Edition.__hash__ = lambda value: frozen_hashes[normal(value)["artifactSha256"]]
    identities = {id(extractor): i for i, extractor in enumerate(tokenizers.EXTRACTORS)}
    assert [str(hash(extractor)) for extractor in tokenizers.EXTRACTORS] == [row[0] for row in selection["hashes"]]
    def seed(token):
        return {"kind": type(token).__name__, "data": native(token.data), "start": token.start, "end": token.end,
                "groups": {k: native(v) for k, v in token.groups.items()},
                "exact": [ids[normal(value)["artifactSha256"]] for value in getattr(token, "exact_editions", [])],
                "variation": [ids[normal(value)["artifactSha256"]] for value in getattr(token, "variation_editions", [])],
                "short": getattr(token, "short", False)}
    texts = [text_of(row["source"]) for row in selection["cases"]]
    texts += ["1 U.S. (1 Cranch) 1", "1 Wheat. 1", "123 F.2d 456, 459", "1 U.S. 1 and 1 U.S. 1", "See 1 U.S. 1; id. at 2"]
    original = models.TokenExtractor.get_token
    cases = []
    try:
        for number, text in enumerate(texts):
            created = []
            def observe(self, match, offset=0):
                value = original(self, match, offset)
                created.append(value)
                return value
            models.TokenExtractor.get_token = observe
            selected = [identities[id(e)] for e in selector.get_extractors(text)]
            if number < 12:
                assert selected == selection["cases"][number]["ordered"]
            output, citations = selector.tokenize(text)
            tokens = {id(token): index for index, token in enumerate(created)}
            cases.append({"id": number, "source": native(text), "selected": selected, "candidates": len(created),
                          "items": [{"kind": "Text", "data": native(value)} if isinstance(value, str) else {"kind": "Token", "id": tokens[id(value)]} for value in output],
                          "citations": [[position, tokens[id(value)]] for position, value in citations],
                          "tokens": [{"id": tokens[id(value)], "seed": seed(value)} for _, value in citations]})
    finally:
        models.TokenExtractor.get_token = original
    out = {"schemaVersion": "citation-canonical-tokenizer/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "hashSeed": "0", "hashProfile": "captured-source-runtime",
           "producerSha256": sha(Path(__file__).read_bytes()), "normalizerSha256": sha(Path(__file__).with_name("export-operations.py").read_bytes()),
           "inputs": {name: sha(value) for name, value in inputs.items()}, "extractorsSha256": CONFIG, "extractorCount": 6805, "editionCount": 2533,
           "scope": "Default source tokenizer composition under explicit captured edition hashes; fresh-process hash production and family approval remain open.",
           "versions": versions, "editions": editions, "cases": cases}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "candidates": sum(row["candidates"] for row in cases), "workerInvocations": sum(len(row["selected"]) for row in cases), "profileReplay": bool(args.profile)}))


if __name__ == "__main__":
    main()
