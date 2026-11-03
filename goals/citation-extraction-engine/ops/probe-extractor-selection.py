#!/usr/bin/env python3
"""Observe source Ahocorasick selection membership independently of regex matching."""
import argparse
import hashlib
import importlib.util
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import unicodedata

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def native(text):
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *v: subprocess.check_output(["git", "-C", str(root), *v], text=True).strip()
    if (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) != (PIN, TREE, ""):
        raise SystemExit("oracle source mismatch")
    if sys.version_info[:3] != (3, 11, 15) or unicodedata.unidata_version != "14.0.0":
        raise SystemExit("Python/Unicode pin mismatch")
    if os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization:
        raise SystemExit("hash seed pin mismatch")
    sys.path.insert(0, str(root))
    import eyecite.tokenizers as module
    from eyecite.models import IdToken, TokenExtractor
    definitions = [(0, []), (0, ["see"]), (0, ["see also"]), (0, ["ee"]), (0, ["see", "also"]),
                   (2, ["ID."]), (2, ["\u0130"]), (2, ["\u03a3"]), (0, ["\ud835\udfce"]),
                   (0, ["\U0001d7ce"]), (2, ["\U00010400"]), (2, ["\u1c89"]), (2, ["\U00010d50"]),
                   (0, ["a", "aa", "aaa"]), (0, ["A\ud800"]), (0, ["\x00"])]
    extractors = [TokenExtractor(f"selection_{i}", IdToken.from_match, flags=flags, strings=strings)
                  for i, (flags, strings) in enumerate(definitions)]
    prior = module.EXTRACTORS
    try:
        module.EXTRACTORS = extractors
        selector = module.AhocorasickTokenizer()
        identities = {id(e): i for i, e in enumerate(extractors)}
        texts = ["", "nothing", "see", "see also", "xsee alsosee", "SEE ALSO", "id. ID. Id.", "\u0130 i\u0307 I i",
                 "\u03a3", "A\u03a3", "A\u03a3A", "A\u03a3\u0301", "A\u03a3\u0301A", "\ud835\udfce", "\U0001d7ce",
                 "\ud835\udfce\U0001d7ce", "\U00010428", "\u1c89\u1c8a", "\U00010d50\U00010d70", "aaaaa",
                 "A\ud800", "\x00", "see" * 2048]
        cases = [{"id": i, "source": native(text), "selected": sorted(identities[id(e)] for e in selector.get_extractors(text))}
                 for i, text in enumerate(texts)]
    finally:
        module.EXTRACTORS = prior
    bindings = [{"id": i, "flags": flags, "strings": [native(s) for s in strings]} for i, (flags, strings) in enumerate(definitions)]
    spec = importlib.util.spec_from_file_location("source_operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, artifacts = operations.make_normalizer(root)
    canonical_selector = module.AhocorasickTokenizer()
    descriptor = normal(canonical_selector)
    config = descriptor["extractorsSha256"]
    operation_file = Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json"
    captured = json.loads(operation_file.read_bytes())
    dependencies = {name: importlib.metadata.version(name) for name in captured["dependencies"]}
    if dependencies != captured["dependencies"]:
        raise SystemExit("oracle dependency versions differ from frozen operation corpus")
    if any(0xd800 <= ord(c) <= 0xdfff for e in module.EXTRACTORS for text in e.strings for c in text):
        raise SystemExit("canonical required strings need a native-word transport instead of JSON string projection")
    payload = operations.encoded(artifacts[config]["value"])
    if captured["artifacts"].get(config) != {"kind": "tokenizer-extractors", "payload": payload}:
        raise SystemExit("default extractor configuration differs from captured source artifact")
    canonical_ids = {id(e): i for i, e in enumerate(module.EXTRACTORS)}
    canonical_texts = ["", "nothing", "1 U.S. 1", "1 u.s. 1", "35 U.S.C. § 112", "37 C.F.R. § 1.56", "See also id. at 2, supra", "123 F.3d 456", "Mass. Gen. Laws ch. 1, §§ 2-3", "<p>1 U.S. 1</p>", "\u0130 ID. \u03a3", "see" * 2048]
    canonical = {"extractorsSha256": config, "extractorCount": len(module.EXTRACTORS),
                 "uniqueExtractorCount": len(set(module.EXTRACTORS)),
                 "cases": [{"id": i, "source": native(text), "selected": sorted(canonical_ids[id(e)] for e in canonical_selector.get_extractors(text))} for i, text in enumerate(canonical_texts)]}
    out = {"schemaVersion": "citation-extractor-selection-controls/v1", "scope": "Source synthetic selection membership only; no source set-order or family approval.",
           "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "unicode": "14.0.0", "hashSeed": "0",
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           "tokenizerSourceSha256": hashlib.sha256((root / "eyecite/tokenizers.py").read_bytes()).hexdigest(),
           "dependencies": dependencies, "bindings": bindings, "cases": cases, "canonical": canonical}
    args.output.write_text(json.dumps(out, ensure_ascii=True, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"bindings": len(bindings), "cases": len(cases), "canonical": canonical["extractorCount"], "unique": canonical["uniqueExtractorCount"]}))


if __name__ == "__main__":
    main()
