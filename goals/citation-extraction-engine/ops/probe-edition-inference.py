#!/usr/bin/env python3
"""Capture actual edition year checks and resource edition selection."""
import argparse
from dataclasses import asdict
from datetime import datetime
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import models
    from eyecite.tokenizers import EXTRACTORS
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normalize, _ = operations.make_normalizer(root)
    sha = lambda data: hashlib.sha256(data).hexdigest()
    canonical = {}
    for extractor in EXTRACTORS:
        for key in ("exact_editions", "variation_editions"):
            for edition in extractor.extra.get(key, []):
                canonical[normalize(edition)["artifactSha256"]] = edition
    assert len(canonical) == 2533
    synthetic = [models.Edition(models.Reporter(f"Inference{i}", "Inference fixture", "state", ("reporters", "laws", "journals")[i % 3]), f"Inference{i}",
                   None if start is None else datetime(start, 7, 1), None if end is None else datetime(end, 2, 1))
                 for i, (start, end) in enumerate(((None, None), (1900, 2000), (2000, None), (None, 1999), (2020, 2030)))]
    identities = {id(e): i for i, e in enumerate(synthetic)}
    refs = [sha(f"edition-inference-control:{i}".encode()) for i in range(5)]
    runtime = lambda ref, e: {"edition": ref, "value": {"short_name": e.short_name, "start": None if e.start is None else str(e.start),
                             "end": None if e.end is None else str(e.end), "reporter": asdict(e.reporter)}}
    trace = []
    clock = []
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            clock.append(2026)
            return datetime(2026, 11, 3)
    original = models.Edition.includes_year
    def checked(edition, year):
        trace.append(identities[id(edition)])
        return original(edition, year)
    rows = []
    sequences = [list(values) for size in range(3) for values in itertools.product(range(5), repeat=size)]
    variations = [[], [0], [1, 0], [2, 2]]
    with patch.object(models, "datetime", FrozenDateTime), patch.object(models.Edition, "includes_year", checked):
        for exact, variation, year, prior in itertools.product(sequences, variations, (None, 0, -1, 1899, 1900, 1999, 2000, 2001, 2026, 2027), (None, 3)):
            token = models.CitationToken("1 X 1", 0, 5, {"volume": "1", "reporter": "X", "page": "1"})
            citation = models.ResourceCitation(token, 0, exact_editions=[synthetic[i] for i in exact], variation_editions=[synthetic[i] for i in variation],
                year=year, edition_guess=None if prior is None else synthetic[prior])
            trace.clear()
            clock.clear()
            assert citation.guess_edition() is None
            result = None if citation.edition_guess is None else identities[id(citation.edition_guess)]
            rows.append([exact, variation, year, prior, result, list(trace), len(clock)])
    year_cases = []
    ordered = sorted(canonical.items())
    with patch.object(models, "datetime", FrozenDateTime):
        for index, (_, edition) in enumerate(ordered):
            years = {-1, 0, 1, 1599, 1600, 2025, 2026, 2027}
            for bound in (edition.start, edition.end):
                if bound is not None:
                    years.update((bound.year - 1, bound.year, bound.year + 1))
            for year in sorted(years):
                year_cases.append([index, year, edition.includes_year(year)])
    out = {"schemaVersion": "citation-edition-inference/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "currentYear": 2026,
           "producerSha256": sha(Path(__file__).read_bytes()), "modelsSha256": sha((root / "eyecite/models.py").read_bytes()),
           "synthetic": [runtime(refs[i], e) for i, e in enumerate(synthetic)], "cases": rows,
           "canonical": [ref for ref, _ in ordered], "yearCases": year_cases}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(rows), "includesCalls": sum(len(r[5]) for r in rows), "canonical": len(ordered), "yearCases": len(year_cases)}))


if __name__ == "__main__":
    main()
