#!/usr/bin/env python3
"""Capture exact law/journal edition-sensitive runtime hashes from pinned eyecite."""
import argparse
import copy
from dataclasses import asdict, replace
from datetime import datetime, timezone
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *parts: subprocess.check_output(["git", "-C", str(root), *parts], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and sys.implementation.name == "cpython" and sys.hash_info.width == 64
    assert os.environ.get("PYTHONHASHSEED") == "0" and not sys.flags.hash_randomization
    versions = {name: importlib.metadata.version(name) for name in ("eyecite", "reporters-db", "courts-db")}
    assert versions == {"eyecite": "2.7.6", "reporters-db": "3.2.53", "courts-db": "0.10.22"}
    sys.path.insert(0, str(root))
    from eyecite import get_citations
    from eyecite.models import Resource
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
    fixture_dir = repo / "packages/law-practice/use-cases/test/fixtures/eyecite"
    templates = json.loads((fixture_dir / "authority-identity-cases.json").read_bytes())["cases"]
    law = get_citations("35 U.S.C. § 101")[0]
    journal = get_citations("93 Harv. L. Rev. 518")[0]
    edition = law.all_editions[0]
    first = replace(edition, short_name="A", start=datetime(1900, 1, 2), end=None)
    second = replace(edition, short_name="Z", reporter=replace(edition.reporter, name="Changed", is_scotus=True))
    tie = replace(first, reporter=replace(first.reporter, name="Tie"))
    dates = replace(edition, start=datetime(1900, 1, 2, 3, 4, 5, 6000, timezone.utc), end=datetime(2000, 12, 31))
    astral = replace(edition, short_name="😀")
    bmp = replace(edition, short_name="\ue000")
    scenes = []
    def add(name, kind="law", groups=None, editions=None, metadata=False, selected=True):
        source = law if kind == "law" else journal
        scenes.append((name, kind, source.groups.copy() if groups is None else groups, list(source.all_editions) if editions is None else editions, metadata, selected))
    add("law")
    add("journal", "journal")
    add("law-metadata", metadata=True)
    add("selected-ignored", selected=False)
    add("no-editions", editions=[])
    add("duplicate-edition", editions=[edition, edition])
    add("edition-order", editions=[first, second])
    add("edition-order-reversed", editions=[second, first])
    add("tied-abbreviation", editions=[first, tie])
    add("tied-abbreviation-reversed", editions=[tie, first])
    add("date-strings", editions=[dates])
    add("unicode-edition-order", editions=[astral, bmp])
    add("unicode-edition-order-reversed", editions=[bmp, astral])
    add("extra-group", groups={**law.groups, "extra": "retained"})
    add("extra-null", groups={**law.groups, "extra": None})
    add("extra-empty", groups={**law.groups, "extra": ""})
    add("reserved-groups", groups={**law.groups, "class": "overwritten", "all_editions": "overwritten"})
    add("unicode-group-keys", groups={**law.groups, "😀": "astral", "\ue000": "bmp", "é": "\x7f\ud800"})
    add("absent-groups", groups={})
    add("null-reporter", groups={**law.groups, "reporter": None})
    add("journal-extra", "journal", groups={**journal.groups, "extra": "retained"})
    add("journal-no-editions", "journal", editions=[])
    rows = []
    for name, kind, groups, editions, metadata, selected in scenes:
        citation = copy.deepcopy(law if kind == "law" else journal)
        citation.groups = groups.copy()
        citation.all_editions = tuple(editions)
        if metadata:
            citation.metadata.publisher = "Ignored"
            citation.metadata.year = "2020"
        values = []
        for value in editions:
            payload = asdict(value)
            payload["start"] = None if value.start is None else str(value.start)
            payload["end"] = None if value.end is None else str(value.end)
            values.append({"edition": normal(value)["artifactSha256"], "value": payload})
        target = copy.deepcopy(next(row["input"]["citation"] for row in templates if row["input"]["citation"]["type"] == kind))
        target["components"] = groups
        refs = [value["edition"] for value in values]
        target["publication"] = {"editions": refs, "selectedEdition": refs[0] if refs and selected else None}
        if metadata:
            target["metadata"].update(publisher="Ignored", year="2020")
        rows.append({"name": name, "input": {"citation": target, "editions": values}, "expected": {"citationHash": str(hash(citation)), "resourceHash": str(hash(Resource(citation)))}})
    output = {"schemaVersion": "citation-publication-resource-hashes/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "hashWidth": 64, "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "lockSha256": hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest(), "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "normalizerSha256": hashlib.sha256(Path(__file__).with_name("export-operations.py").read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "utils.py")}, "scope": "Exact law/journal resource hashes with actual and controlled dataclass editions; no live artifact-adapter or full engine proof.", "cases": rows}
    args.output.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n")
    print(f"captured {len(rows)} publication resource hash observations")


if __name__ == "__main__":
    main()
