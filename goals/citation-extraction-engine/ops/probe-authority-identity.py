#!/usr/bin/env python3
"""Capture focused resource equality, not parser or resolution parity."""
import argparse
from datetime import datetime
import hashlib
import importlib.util
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
TEXTS = [
    ("case", "1 U.S. 1"),
    ("case-repeat", "1 U.S. 1"),
    ("case-metadata", "1 U.S. 1, 2 (1900)"),
    ("case-volume", "2 U.S. 1"),
    ("missing-page", "1 U.S. ___"),
    ("missing-page-repeat", "1 U.S. ___"),
    ("cit-primary", "1 C.I.T. 1"),
    ("cit-alias", "1 Ct. Int'l Trade 1"),
    ("law", "35 U.S.C. § 101"),
    ("law-repeat", "35 U.S.C. § 101 (2018)"),
    ("law-section", "35 U.S.C. § 102"),
    ("journal", "93 Harv. L. Rev. 518"),
    ("journal-repeat", "93 Harv. L. Rev. 518, 520 (1980)"),
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle provenance mismatch")
    if sys.version_info[:2] != (3, 11) or os.environ.get("PYTHONHASHSEED") != "0":
        raise SystemExit("frozen runtime mismatch")
    if sys.flags.hash_randomization != 0:
        raise SystemExit("hash randomization must be disabled")
    if importlib.metadata.version("reporters-db") != "3.2.53" or importlib.metadata.version("courts-db") != "0.10.22":
        raise SystemExit("frozen dependency mismatch")
    sys.path.insert(0, str(root))
    from eyecite import get_citations
    from eyecite.models import FullCaseCitation, Resource
    import eyecite.models as models
    import eyecite.helpers as helpers
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 28, tzinfo=tz)
    models.datetime = helpers.datetime = Clock
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, _ = operations.make_normalizer(root)
    repo = Path(__file__).resolve().parents[3]
    mapping = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json").read_text())
    editions = {row["artifactSha256"]: row for row in mapping["editions"]}
    citations, rows = [], []
    for index, (name, text) in enumerate(TEXTS):
        found = get_citations(text)
        if len(found) != 1 or type(found[0]).__name__ not in {"FullCaseCitation", "FullLawCitation", "FullJournalCitation"}:
            raise SystemExit(f"unexpected probe shape: {name}")
        cite = found[0]
        citations.append(cite)
        refs = [normal(edition)["artifactSha256"] for edition in cite.all_editions]
        selected = normal(cite.edition_guess)["artifactSha256"] if cite.edition_guess else None
        metadata = {"pinCite": cite.metadata.pin_cite, "parenthetical": cite.metadata.parenthetical,
                    "year": cite.metadata.year, "month": cite.metadata.month, "day": cite.metadata.day}
        publication = {"editions": refs, "selectedEdition": selected}
        kind = {"FullCaseCitation": "case", "FullLawCitation": "law", "FullJournalCitation": "journal"}[type(cite).__name__]
        if isinstance(cite, FullCaseCitation):
            publication = {"vocabularyVersion": mapping["publicArtifactVersion"], "selectedEdition": selected,
                           "editions": [{"edition": ref, "reporterId": editions[ref]["reporterId"]} for ref in refs]}
            metadata.update(court={"status": "unmapped", "value": cite.metadata.court} if cite.metadata.court is not None else None,
                            plaintiff=cite.metadata.plaintiff, defendant=cite.metadata.defendant,
                            additionalText=cite.metadata.extra, antecedentGuess=cite.metadata.antecedent_guess,
                            shortCaseName=cite.metadata.resolved_case_name_short, caseName=cite.metadata.resolved_case_name)
        elif kind == "law":
            metadata["publisher"] = cite.metadata.publisher
        mention_id = "cm1:" + sha(f"authority-probe:{index}".encode())
        if kind == "case":
            if cite.groups["page"] is None:
                key = ["citation-authority/v1", "case-occurrence", mention_id]
            else:
                groups = {key: cite.groups[key] for key in ("volume", "page") if key in cite.groups}
                groups["reporter"] = cite.corrected_reporter()
                key = ["citation-authority/v1", "case", sorted(groups.items())]
        else:
            key = ["citation-authority/v1", kind, sorted(cite.groups.items()), sorted(refs)]
        preimage = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
        rows.append({"name": name, "text": text, "expectedId": "ca1:" + sha(preimage.encode()), "input": {
            "citation": {"type": kind, "components": cite.groups, "publication": publication, "metadata": metadata},
            "mentionId": mention_id,
            "selectedEdition": {"edition": selected, "shortName": cite.edition_guess.short_name} if selected else None,
        }})
    equality = [[Resource(left) == Resource(right) for right in citations] for left in citations]
    # Same missing-page object is reflexively equal; separate occurrences are not.
    if not equality[0][1] or equality[4][5] or equality[6][7] or not equality[8][9] or not equality[11][12]:
        raise SystemExit("focused resource equality expectations changed")
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed")
    result = {"schemaVersion": "citation-authority-identity-cases/v1", "oracleCommit": PIN, "oracleTree": TREE,
              "producerSha256": sha(Path(__file__).read_bytes()), "license": "BSD-2-Clause",
              "licenseSha256": sha((root / "LICENSE").read_bytes()), "lockSha256": sha((root / "uv.lock").read_bytes()),
              "reportersVersion": "3.2.53", "courtsVersion": "0.10.22", "clock": "2026-10-28",
              "scope": "Focused authority equality only; no target extraction or full resolution proof.",
              "cases": rows, "equality": equality}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Captured {len(rows)} authorities and {len(rows) ** 2} equality observations")


if __name__ == "__main__":
    main()
