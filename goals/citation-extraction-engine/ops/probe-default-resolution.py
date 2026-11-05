#!/usr/bin/env python3
"""Capture default resolver groups for extracted and synthetic semantic inputs."""
import argparse
from datetime import datetime
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
TEXTS = [
    ("repeat-and-id", "1 U.S. 1. 1 U.S. 1. Id. at 2."),
    ("distinct-and-id", "1 U.S. 1; 2 U.S. 2; Id. at 3."),
    ("invalid-id-resets", "1 U.S. 1. Id. at 152. Id. at 2."),
    ("id-before-full", "Id. at 1. 1 U.S. 1."),
    ("unknown-resets", "1 U.S. 1. § 2. Id."),
    ("missing-page", "1 U.S. ___. Id."),
    ("law-and-id", "35 U.S.C. § 101. Id. at 99999."),
    ("journal-and-id", "93 Harv. L. Rev. 518 (1980). Id. at 520."),
    ("short-unique", "Smith v. Jones, 1 U.S. 1 (1900). Smith, 1 U.S. at 2. Id. at 3."),
    ("short-no-match", "1 U.S. 1. 2 U.S. at 3. Id."),
    ("short-ambiguous", "Smith v. Jones, 1 U.S. 1 (1900). Adams v. Doe, 1 U.S. 9 (1901). 1 U.S. at 10. Id."),
    ("short-refined", "Smith v. Jones, 1 U.S. 1 (1900). Adams v. Doe, 1 U.S. 9 (1901). Smith, 1 U.S. at 2."),
    ("supra-unique", "Smith v. Jones, 1 U.S. 1 (1900). Smith, supra, at 2."),
    ("supra-ambiguous", "Smith v. Jones, 1 U.S. 1 (1900). Smith v. Doe, 2 U.S. 9 (1901). Smith, supra, at 2. Id."),
    ("reference", "Roe v. Wade, 410 U.S. 113 (1973). Roe at 120. Id. at 121."),
    ("cit-vintage", "1 C.I.T. 1. 1 Ct. Int'l Trade 1. Id. at 2."),
    ("same-resource-names", "Smith v. Jones, 1 U.S. 1 (1900). Adams v. Smith, 1 U.S. 1 (1901). Smith, supra, at 2."),
    ("unicode-prefix", "😀 Roe v. Wade, 410 U.S. 113 (1973). Roe at 120."),
]
# Each tuple is (kind, legal groups, metadata). Text is a deliberate synthetic
# witness; classification is supplied, never asserted as target extraction.
C = lambda page="1", **metadata: ("case", {"volume": "1", "reporter": "U.S.", "page": page}, metadata)
I = lambda pin=None: ("id", {}, {"pin_cite": pin})
SYNTHETIC = [
    ("supra-no-name", [C(plaintiff="Smith"), ("supra", {}, {}), I()]),
    ("supra-punctuation-only", [C(plaintiff="Smith"), ("supra", {}, {"antecedent_guess": "!!!"})]),
    ("supra-case-sensitive", [C(plaintiff="Smith"), ("supra", {}, {"antecedent_guess": "smith"})]),
    ("supra-ignores-volume", [C(plaintiff="Smith"), ("supra", {}, {"antecedent_guess": "Smith", "volume": "999"})]),
    ("short-unique-ignores-wrong-name", [C(plaintiff="Smith"), ("shortFormCase", {"volume": "1", "reporter": "U.S."}, {"antecedent_guess": "Wrong"})]),
    ("reference-exact-not-substring", [C(plaintiff="Smithson"), ("reference", {}, {"plaintiff": "Smith"})]),
    ("reference-uses-all-metadata", [C(parenthetical="Special"), ("reference", {}, {"plaintiff": "Special"})]),
    ("reference-law-publisher", [("law", {"title": "35", "reporter": "U.S.C.", "section": "101"}, {"publisher": "West"}), ("reference", {}, {"plaintiff": "West"})]),
    ("reference-empty", [C(plaintiff="Smith"), ("reference", {}, {}), I()]),
    ("id-after-non-numeric-page", [C(page="*10"), I("nonsense")]),
    ("id-inclusive-boundary", [C(), I("151"), I("152"), I("1")]),
    ("full-page-null-no-reporter", [("case", {"page": None}, {}), I()]),
    ("full-page-null-lazy-reporter-error", [("case", {"page": None}, {}), ("shortFormCase", {"reporter": "U.S.", "volume": "1"}, {})]),
    ("full-missing-page-key", [("case", {"reporter": "U.S."}, {})]),
    ("full-missing-reporter-key", [("case", {"page": "1"}, {})]),
    ("short-no-full-lazy-reporter", [("shortFormCase", {}, {})]),
    ("law-null-page-exception", [("law", {"reporter": "X", "page": None}, {}), I("2")]),
    ("integer-conversion-exception", [C(page="²"), I("2")]),
    ("supra-resource-dedup", [C(plaintiff="Smith"), C(defendant="Smith"), ("supra", {}, {"antecedent_guess": "Smith"})]),
    ("short-multiple-resets-id", [C(plaintiff="Smith"), C(page="2", plaintiff="Adams"), ("shortFormCase", {"volume": "1", "reporter": "U.S."}, {}), I()]),
    ("short-name-refinement", [C(plaintiff="Smith"), C(page="2", plaintiff="Adams"), ("shortFormCase", {"volume": "1", "reporter": "U.S."}, {"antecedent_guess": "Smith"}), I("2")]),
    ("supra-multiple-resets-id", [C(plaintiff="Smith"), C(page="2", plaintiff="Smith"), ("supra", {}, {"antecedent_guess": "Smith"}), I()]),
    ("reference-multiple-resets-id", [C(plaintiff="Smith"), C(page="2", plaintiff="Smith"), ("reference", {}, {"plaintiff": "Smith"}), I()]),
    ("reference-court-metadata", [C(court="scotus"), ("reference", {}, {"plaintiff": "scotus"})]),
    ("unknown-between-id", [C(), ("unknown", {}, {}), I()]),
    ("short-only-noncase-predecessor", [("law", {"reporter": "X"}, {}), ("shortFormCase", {}, {}), I()]),
    ("empty", []),
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
        raise SystemExit("oracle provenance mismatch")
    if sys.version_info[:3] != (3, 11, 15) or os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization:
        raise SystemExit("frozen runtime mismatch")
    if importlib.metadata.version("reporters-db") != "3.2.53" or importlib.metadata.version("courts-db") != "0.10.22":
        raise SystemExit("frozen dependency mismatch")
    sys.path.insert(0, str(root))
    from eyecite import get_citations, resolve_citations
    import eyecite.models as models
    import eyecite.helpers as helpers
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 28, tzinfo=tz)
    models.datetime = helpers.datetime = Clock
    module = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(module)
    module.loader.exec_module(operations)
    normal, _ = operations.make_normalizer(root)
    repo = Path(__file__).resolve().parents[3]
    mapping = json.loads((repo / "packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json").read_text())
    edition_map = {row["artifactSha256"]: row for row in mapping["editions"]}
    names = {"case": "FullCaseCitation", "law": "FullLawCitation", "journal": "FullJournalCitation", "shortFormCase": "ShortCaseCitation", "id": "IdCitation", "supra": "SupraCitation", "reference": "ReferenceCitation", "unknown": "UnknownCitation"}
    kinds = {value: key for key, value in names.items()}
    scenarios = [(name, text, get_citations(text), "extracted") for name, text in TEXTS]
    for name, values in SYNTHETIC:
        text, citations = "", []
        for index, (kind, groups, metadata) in enumerate(values):
            token_text = f"witness-{index}"
            start = len(text)
            text += token_text + "; "
            token = models.CitationToken(token_text, start, start + len(token_text), groups)
            citations.append(getattr(models, names[kind])(token, index=index, groups=groups, metadata=metadata))
        scenarios.append((name, text, citations, "synthetic-semantic"))
    sample = get_citations("1 U.S. 1")[0]
    selected_text = "witness-0; witness-1"
    selected_cites = []
    for index, kind in enumerate(["FullCaseCitation", "ShortCaseCitation"]):
        groups = {"volume": "1", "page": str(index + 1)}
        token = models.CitationToken(f"witness-{index}", index * 11, index * 11 + 9, groups)
        selected_cites.append(getattr(models, kind)(token, index=index, groups=groups,
            exact_editions=sample.exact_editions, variation_editions=sample.variation_editions,
            edition_guess=sample.edition_guess))
    scenarios.append(("selected-reporter-without-raw-field", selected_text, selected_cites, "synthetic-semantic"))
    rows = []
    for name, text, citations, mode in scenarios:
        occurrences, descriptors = [], {}
        for cite in citations:
            kind = kinds[type(cite).__name__]
            metadata = {"pinCite": cite.metadata.pin_cite, "parenthetical": cite.metadata.parenthetical}
            semantic = {"type": kind, "components": cite.groups, "metadata": metadata}
            if isinstance(cite, models.ResourceCitation):
                refs = [normal(edition)["artifactSha256"] for edition in cite.all_editions]
                selected = normal(cite.edition_guess)["artifactSha256"] if cite.edition_guess else None
                semantic["publication"] = {"editions": refs, "selectedEdition": selected}
                if isinstance(cite, models.CaseCitation):
                    semantic["publication"] = {"vocabularyVersion": mapping["publicArtifactVersion"], "selectedEdition": selected,
                        "editions": [{"edition": ref, "reporterId": edition_map[ref]["reporterId"]} for ref in refs]}
                    metadata["court"] = {"status": "unmapped", "value": cite.metadata.court} if cite.metadata.court is not None else None
                metadata.update(year=cite.metadata.year, month=cite.metadata.month, day=cite.metadata.day)
                if cite.edition_guess:
                    descriptors[selected] = {"edition": selected, "shortName": cite.edition_guess.short_name}
            if kind == "case":
                metadata.update(plaintiff=cite.metadata.plaintiff, defendant=cite.metadata.defendant,
                    additionalText=cite.metadata.extra, antecedentGuess=cite.metadata.antecedent_guess,
                    shortCaseName=cite.metadata.resolved_case_name_short, caseName=cite.metadata.resolved_case_name)
            elif kind == "shortFormCase":
                metadata["antecedentGuess"] = cite.metadata.antecedent_guess
            elif kind == "law":
                metadata["publisher"] = cite.metadata.publisher
            elif kind == "supra":
                metadata.update(antecedentGuess=cite.metadata.antecedent_guess, volume=cite.metadata.volume)
            elif kind == "reference":
                metadata.update(plaintiff=cite.metadata.plaintiff, defendant=cite.metadata.defendant,
                    shortCaseName=cite.metadata.resolved_case_name_short, caseName=cite.metadata.resolved_case_name)
            start, end = cite.span()
            occurrences.append({"citation": semantic, "start": len(text[:start].encode("utf-16-le")) // 2,
                "end": len(text[:end].encode("utf-16-le")) // 2, "quote": text[start:end]})
        indices = {id(cite): index for index, cite in enumerate(citations)}
        try:
            resolutions = resolve_citations(citations)
            outcome = {"status": "value", "groups": [[indices[id(cite)] for cite in members] for members in resolutions.values()]}
        except (KeyError, ValueError, AttributeError) as error:
            outcome = {"status": "error", "kind": type(error).__name__}
        rows.append({"name": name, "mode": mode, "text": text, "mentions": occurrences, "editions": list(descriptors.values()), "outcome": outcome})
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed")
    result = {"schemaVersion": "citation-default-resolution-cases/v1", "oracleCommit": PIN, "oracleTree": TREE,
        "producerSha256": sha(Path(__file__).read_bytes()), "licenseSha256": sha((root / "LICENSE").read_bytes()), "lockSha256": sha((root / "uv.lock").read_bytes()),
        "scope": "Default resolution over decoded semantic mentions; no target extraction, custom callbacks or complete parity proof.", "cases": rows}
    args.output.write_text(json.dumps(result, ensure_ascii=True, indent=2) + "\n")
    print(f"Captured {len(rows)} default resolver scenarios with {sum(len(row['mentions']) for row in rows)} mentions")


if __name__ == "__main__":
    main()
