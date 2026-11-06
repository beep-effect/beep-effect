#!/usr/bin/env python3
"""Observe one Python dictionary containing live case/law/journal Resources."""
import argparse
import copy
from dataclasses import replace
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
    from eyecite.tokenizers import EDITIONS_LOOKUP
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
    mapping = {row["artifactSha256"]: row for row in json.loads((fixture_dir / "vocabulary-mapping.json").read_bytes())["editions"]}
    all_editions = {}
    for group in EDITIONS_LOOKUP.values():
        for edition in group:
            all_editions[normal(edition)["artifactSha256"]] = edition
    def ties(source, abbreviation):
        result = [edition for ref, edition in sorted(all_editions.items()) if edition.reporter.source == source and edition.short_name == abbreviation]
        assert len(result) == 2
        return result
    law_ties = ties("laws", "Ga. Code Ann. Adv. Legis. Serv.")
    journal_ties = ties("journals", "Rutgers Race & L. Rev.")
    def op(kind, **fields):
        return {"kind": kind, **fields}
    create = lambda reference: op("create", reference=reference)
    put = lambda resource, value: op("set", resource=resource, value=value)
    get = lambda resource: op("get", resource=resource)
    change = lambda reference, field, value: op("change", reference=reference, field=field, value=value)
    editions_op = lambda reference, values: op("editions", reference=reference, values=[normal(value)["artifactSha256"] for value in values])
    case_editions = get_citations("1 U.S. 1")[0].all_editions
    scenes = [
        ("mixed-live-fields", ["1 U.S. 1", "35 U.S.C. § 101", "93 Harv. L. Rev. 518"], [create(0), create(1), create(2), put(0, 0), put(1, 1), put(2, 2), change(0, "page", "20"), get(0), put(0, 3), change(1, "section", "102"), get(1), put(1, 4), change(2, "page", "520"), get(2), put(2, 5), op("equal", left=0, right=1), op("remove", resource=0), op("clear"), put(1, 6), get(1)]),
        ("distinct-equal-all-families", ["1 U.S. 1", "1 U.S. 1", "35 U.S.C. § 101", "35 U.S.C. § 101", "93 Harv. L. Rev. 518", "93 Harv. L. Rev. 518"], [create(i) for i in range(6)] + [put(i, i) for i in range(6)] + [get(i) for i in range(6)] + [op("equal", left=i, right=i+1) for i in (0, 2, 4)]),
        ("actual-law-edition-ties", ["35 U.S.C. § 101", "1 U.S. 1"], [create(0), create(0), create(1), put(2, 2), editions_op(0, law_ties), put(0, 0), op("hash", resource=0), editions_op(0, list(reversed(law_ties))), op("hash", resource=0), get(0), put(0, 1), get(1), editions_op(0, law_ties + [law_ties[0]]), put(1, 3), editions_op(0, []), put(0, 4)]),
        ("actual-journal-edition-ties", ["93 Harv. L. Rev. 518", "37 C.F.R. § 1.56"], [create(0), create(1), put(1, 1), editions_op(0, journal_ties), put(0, 0), op("hash", resource=0), editions_op(0, list(reversed(journal_ties))), op("hash", resource=0), get(0), put(0, 2), editions_op(0, []), get(0), put(0, 3)]),
        ("case-independent-selection", ["1 U.S. 1", "35 U.S.C. § 101"], [create(0), create(1), put(0, 0), put(1, 1), editions_op(0, []), op("hash", resource=0), get(0), editions_op(0, case_editions), op("hash", resource=0), get(0)]),
        ("controlled-null-page-lazy-artifact", ["1 U.S. 1", "35 U.S.C. § 101"], [create(0), create(0), create(1), put(0, 0), put(2, 1), get(1), op("equal", left=0, right=1), op("hash", resource=0), put(1, 2)]),
    ]
    rows = []
    original_equal = models.Resource.__eq__
    for name, texts, operations_list in scenes:
        citations = [get_citations(text)[0] for text in texts]
        identities = [None for citation in citations]
        if name == "controlled-null-page-lazy-artifact":
            unknown = replace(citations[0].all_editions[0], short_name="Unregistered test edition")
            assert normal(unknown)["artifactSha256"] not in all_editions
            citations[0].groups = {"page": None}
            citations[0].all_editions = (unknown,)
            citations[0].edition_guess = unknown
            identities[0] = "4294967296"
        initial = []
        for index, citation in enumerate(citations):
            kind = {"FullCaseCitation": "case", "FullLawCitation": "law", "FullJournalCitation": "journal"}[type(citation).__name__]
            target = copy.deepcopy(next(row["input"]["citation"] for row in templates if row["input"]["citation"]["type"] == kind))
            refs = [normal(value)["artifactSha256"] for value in citation.all_editions]
            selected = normal(citation.edition_guess)["artifactSha256"] if citation.edition_guess else None
            target["components"] = citation.groups.copy()
            publication = {"editions": refs, "selectedEdition": selected}
            if kind == "case":
                publication = {**target["publication"], **publication, "editions": [{"edition": ref, "reporterId": mapping[ref]["reporterId"] if ref in mapping else target["publication"]["editions"][0]["reporterId"]} for ref in refs]}
            target["publication"] = publication
            initial.append({"citation": target, "missingPageIdentityHash": identities[index]})
        resources, events, comparisons = [], [], []
        table = {}
        def equal(left, right):
            comparisons.append([next(i for i, value in enumerate(resources) if value is left), next(i for i, value in enumerate(resources) if value is right)])
            return original_equal(left, right)
        models.Resource.__eq__ = equal
        if any(value is not None for value in identities):
            models.id = lambda value: int(identities[next(i for i, citation in enumerate(citations) if citation is value)])
        try:
            for operation in operations_list:
                comparisons.clear()
                kind = operation["kind"]
                result = None
                if kind == "create":
                    resources.append(models.Resource(citations[operation["reference"]]))
                    result = len(resources) - 1
                elif kind == "change":
                    citations[operation["reference"]].groups[operation["field"]] = operation["value"]
                elif kind == "editions":
                    citations[operation["reference"]].all_editions = tuple(all_editions[ref] for ref in operation["values"])
                elif kind == "hash":
                    result = str(hash(resources[operation["resource"]]))
                elif kind == "get":
                    result = table.get(resources[operation["resource"]])
                elif kind == "set":
                    table[resources[operation["resource"]]] = operation["value"]
                elif kind == "remove":
                    result = table.pop(resources[operation["resource"]], None)
                elif kind == "clear":
                    table.clear()
                elif kind == "equal":
                    result = resources[operation["left"]] == resources[operation["right"]]
                entries = [{"objectId": next(i for i, value in enumerate(resources) if value is key), "value": value} for key, value in table.items()]
                events.append({"operation": operation, "outcome": result, "entries": entries, "comparisons": [pair.copy() for pair in comparisons], "publications": [{"editions": [normal(edition)["artifactSha256"] for edition in citation.all_editions], "selectedEdition": normal(citation.edition_guess)["artifactSha256"] if citation.edition_guess else None} for citation in citations]})
        finally:
            models.Resource.__eq__ = original_equal
            if any(value is not None for value in identities):
                del models.id
        rows.append({"name": name, "identityMode": "controlled-source-id-hook" if any(value is not None for value in identities) else "content", "initial": initial, "events": events})
    output = {"schemaVersion": "citation-live-resources/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "pythonHashSeed": "0", "versions": versions, "license": "BSD-2-Clause", "licenseSha256": hashlib.sha256((root / "LICENSE").read_bytes()).hexdigest(), "lockSha256": hashlib.sha256((root / "uv.lock").read_bytes()).hexdigest(), "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "normalizerSha256": hashlib.sha256(Path(__file__).with_name("export-operations.py").read_bytes()).hexdigest(), "sources": {name: hashlib.sha256((root / "eyecite" / name).read_bytes()).hexdigest() for name in ("models.py", "utils.py", "tokenizers.py")}, "scope": "Mixed actual Resource/table composition and actual frozen abbreviation ties; null-page identity is controlled, full callback dispatch remains open.", "cases": rows}
    args.output.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n")
    print(f"captured {len(rows)} mixed resource histories / {sum(len(row['events']) for row in rows)} events")


if __name__ == "__main__":
    main()
