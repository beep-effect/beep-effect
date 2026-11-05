#!/usr/bin/env python3
"""Audit frozen law capture/metadata ownership; not target extraction parity."""
import argparse
from collections import Counter
from dataclasses import asdict
from datetime import datetime
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
TEXTS = [
    "35 U.S.C. § 101 (2018)",
    "37 C.F.R. § 1.56 (2020)",
    "37 C.F.R. § 1.56(a) (West Jan. 2, 2020) (disclosure)",
    "42 C.F.R. §§ 405.1-405.2",
    "35 U.S.C. § 101 et seq.",
    "37 C.F.R. §§ 1.56-1.58(a)-(c)",
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle pin/tree/cleanliness mismatch")
    if os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization != 0:
        raise SystemExit("pre-start PYTHONHASHSEED=0 required")
    if sys.version_info[:2] != (3, 11) or importlib.metadata.version("reporters-db") != "3.2.53":
        raise SystemExit("frozen Python/reporters dependency mismatch")
    sys.path.insert(0, str(root))
    from eyecite import get_citations
    import eyecite.helpers as helpers
    import eyecite.models as models
    from eyecite.tokenizers import default_tokenizer
    class OracleDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 28, tzinfo=tz)
    helpers.datetime = models.datetime = OracleDatetime
    counts = Counter()
    instances = 0
    for extractor in default_tokenizer.extractors:
        editions = tuple(extractor.extra.get("exact_editions", ())) + tuple(extractor.extra.get("variation_editions", ()))
        if any(edition.reporter.source == "laws" for edition in editions):
            instances += 1
            counts.update(list(extractor.compiled_regex.groupindex))
    if instances != 575 or len(counts) != 19:
        raise SystemExit("frozen law extractor coverage changed")
    cases = []
    for text in TEXTS:
        citations = get_citations(text)
        if len(citations) != 1 or type(citations[0]).__name__ != "FullLawCitation":
            raise SystemExit("planned law probe no longer exercises exactly one canonical law citation")
        cite = citations[0]
        cases.append({"text": text, "kind": type(cite).__name__, "groups": cite.groups,
                      "metadata": asdict(cite.metadata), "parsedYear": cite.year,
                      "correctedCitation": cite.corrected_citation(),
                      "correctedFullCitation": cite.corrected_citation_full(),
                      "span": list(cite.span()), "fullSpan": list(cite.full_span())})
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed during observation")
    fixtures = Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite"
    result = {"schemaVersion": "citation-law-field-audit/v1", "scope": "Source/field ownership and focused observations only; no target parser or donor disposition proof.",
              "commit": PIN, "tree": TREE, "license": "BSD-2-Clause", "licenseSha256": sha((root / "LICENSE").read_bytes()),
              "lockSha256": sha((root / "uv.lock").read_bytes()),
              "operationCorpusSha256": sha((fixtures / "operation-cases.json").read_bytes()),
              "publicationMappingSha256": sha((fixtures / "vocabulary-mapping.json").read_bytes()),
              "python": sys.version.split()[0], "reportersVersion": importlib.metadata.version("reporters-db"),
              "clockDate": "2026-10-28", "hashSeed": "0", "producerSha256": sha(Path(__file__).read_bytes()),
              "sources": [{"path": name, "sha256": sha((root / name).read_bytes())} for name in ["eyecite/models.py", "eyecite/helpers.py", "eyecite/tokenizers.py", "eyecite/regexes.py", "eyecite/find.py"]],
              "lawExtractorCount": instances, "captureKeyInstanceCounts": dict(sorted(counts.items())), "cases": cases}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"law field audit: {instances} extractors, {len(counts)} keys, {len(cases)} observations; target proof open")


if __name__ == "__main__":
    main()
