#!/usr/bin/env python3
"""Record canonical model fields and focused observations, not target parity."""
import argparse
from dataclasses import asdict, fields
from datetime import datetime
import hashlib
import importlib.metadata
import inspect
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
CLASSES = ["FullCaseCitation", "ShortCaseCitation", "FullLawCitation", "FullJournalCitation",
           "IdCitation", "SupraCitation", "ReferenceCitation", "UnknownCitation"]
PROBES = [
    ("named-reference", "Roe v. Wade, 410 U.S. 113 (1973). Roe at 120.", ["FullCaseCitation", "ReferenceCitation"]),
    ("short-case", "Adarand, 515 U.S. at 241", ["ShortCaseCitation"]),
    ("supra", "Smith, supra, at 240.", ["SupraCitation"]),
    ("id", "Id. at 240.", ["IdCitation"]),
    ("unknown", "§ 2", ["UnknownCitation"]),
    ("journal", "93 Harv. L. Rev. 518, 520 (1980)", ["FullJournalCitation"]),
    ("law", "35 U.S.C. § 101 (2018)", ["FullLawCitation"]),
    ("case-missing-page", "1 U.S. ___", ["FullCaseCitation"]),
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
    if sys.version_info[:2] != (3, 11) or os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization != 0:
        raise SystemExit("frozen Python/hash-seed mismatch")
    if importlib.metadata.version("reporters-db") != "3.2.53":
        raise SystemExit("frozen reporters dependency mismatch")
    sys.path.insert(0, str(root))
    from eyecite import get_citations
    import eyecite.models as models
    import eyecite.helpers as helpers
    class OracleDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 28, tzinfo=tz)
    helpers.datetime = models.datetime = OracleDatetime
    model_fields = []
    for name in CLASSES:
        model = getattr(models, name)
        model_fields.append({"name": name, "fields": [item.name for item in fields(model)],
                             "metadataFields": [item.name for item in fields(model.Metadata)],
                             "sourceSha256": sha(inspect.getsource(model).encode())})
    observations = []
    for name, text, expected in PROBES:
        citations = get_citations(text)
        if [type(cite).__name__ for cite in citations] != expected:
            raise SystemExit(f"canonical model probe changed: {name}")
        observations.append({"id": name, "text": text, "citations": [
            {"kind": type(cite).__name__, "groups": cite.groups, "metadata": asdict(cite.metadata),
             "span": list(cite.span()), "fullSpan": list(cite.full_span()),
             "correctedCitation": cite.corrected_citation(), "correctedFullCitation": cite.corrected_citation_full()}
            for cite in citations]})
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed during observation")
    result = {"schemaVersion": "citation-canonical-model-audit/v1",
              "scope": "Model field ownership and focused oracle observations; no target parser/formatter/resolution proof.",
              "commit": PIN, "tree": TREE, "license": "BSD-2-Clause", "licenseSha256": sha((root / "LICENSE").read_bytes()),
              "lockSha256": sha((root / "uv.lock").read_bytes()), "producerSha256": sha(Path(__file__).read_bytes()),
              "python": sys.version.split()[0], "hashSeed": "0", "clockDate": "2026-10-28",
              "dependencies": {name: importlib.metadata.version(name) for name in ["eyecite", "reporters-db", "courts-db"]},
              "sources": [{"path": name, "sha256": sha((root / name).read_bytes())} for name in ["eyecite/models.py", "eyecite/helpers.py", "eyecite/find.py", "eyecite/resolve.py"]],
              "models": model_fields, "observations": observations}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"canonical model audit: {len(model_fields)} model/metadata projections, {len(observations)} oracle probes; target proof open")


if __name__ == "__main__":
    main()
