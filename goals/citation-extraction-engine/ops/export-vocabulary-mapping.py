#!/usr/bin/env python3
"""Bind every frozen oracle publication/court to its public identity boundary."""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
VERSION = "crv1:f353e51400a5:fad63b383b92"
# These are reviewed, exact source-identity transitions, never fuzzy matching.
TRANSITIONS = {
    ("C.I.T.", "specialty", "Court of International Trade Reports"): (
        "reporter:ec9ba165d777489bf3ceb824", "alias-merger",
        "The current Ct. Int'l Trade record explicitly owns C.I.T. as an alias; both legacy records map to that identity. Legacy edition bounds remain parser data."),
    ("Ct. Int'l Trade", "federal", "Court of International Trade Reports"): (
        "reporter:ec9ba165d777489bf3ceb824", "cite-type-update",
        "The same primary abbreviation and report title now use specialty rather than federal. Preserve legacy cite_type in oracle parsing data."),
    ("Teiss.", "state", "Louisiana Court of Appeals Reports, Teisser"): (
        "reporter:d6ce49dfb219086bae7a6d8a", "name-correction",
        "The current public record corrects Teisser to Teissier with the same abbreviation, edition dates and jurisdictions."),
}


def sha(data): return hashlib.sha256(data).hexdigest()


def canonical(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def normal(value):
    if isinstance(value, datetime): return value.isoformat()
    if isinstance(value, dict): return {key: normal(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)): return [normal(item) for item in value]
    return value


def differences(legacy, current):
    return [{"field": key, "legacy": value, "current": current[key]} for key, value in legacy.items() if value != current[key]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--public-snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle pin/tree/cleanliness mismatch")
    sys.path.insert(0, str(root))
    from courts_db import courts
    from reporters_db import REPORTERS, LAWS, JOURNALS
    if importlib.metadata.version("courts-db") != "0.10.22" or importlib.metadata.version("reporters-db") != "3.2.53":
        raise RuntimeError("frozen vocabulary dependency versions changed")
    public = json.loads(args.public_snapshot.read_text())
    if public["artifactVersion"] != VERSION: raise RuntimeError("public vocabulary version mismatch")
    repo = Path(__file__).resolve().parents[3]
    operation_path = repo / "packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json"
    operations = json.loads(operation_path.read_text())
    reporter_artifacts, edition_artifacts = {}, {}
    for key, artifact in operations["artifacts"].items():
        if sha(artifact["payload"].encode()) != key: raise RuntimeError("operation shared artifact hash mismatch")
        value = json.loads(artifact["payload"])
        if artifact["kind"] == "model-value" and value["pythonType"] == "eyecite.models.Reporter": reporter_artifacts[key] = value["fields"]
        if artifact["kind"] == "model-value" and value["pythonType"] == "eyecite.models.Edition": edition_artifacts[key] = value["fields"]
    public_by_key = {row["semanticKey"]: row for row in public["reporters"]["records"]}
    public_by_id = {row["id"]: row for row in public["reporters"]["records"]}
    seeds = {(kind, abbreviation, row["cite_type"], row["name"]): row for kind, dataset in
             [("reporters", REPORTERS), ("laws", LAWS), ("journals", JOURNALS)] for abbreviation, records in dataset.items() for row in records}
    if len(seeds) != len(reporter_artifacts): raise RuntimeError("legacy publication source/artifact coverage differs")
    mappings, mapped_ids, seen_seeds = [], set(), set()
    for key, legacy in sorted(reporter_artifacts.items()):
        identity = (legacy["source"], legacy["short_name"], legacy["cite_type"], legacy["name"])
        if identity not in seeds: raise RuntimeError("oracle Reporter lacks exact source record")
        seen_seeds.add(identity)
        row = {"artifactSha256": key, "legacySource": legacy["source"], "legacyAbbreviation": legacy["short_name"],
               "legacyName": legacy["name"], "legacyCiteType": legacy["cite_type"]}
        if legacy["source"] != "reporters":
            row.update(kind="law-publication" if legacy["source"] == "laws" else "journal-publication",
                       citationFamily="FullLawCitation" if legacy["source"] == "laws" else "FullJournalCitation")
        else:
            source_key = (legacy["short_name"], legacy["cite_type"], legacy["name"])
            current = public_by_key.get("\x1f".join(source_key))
            method, rationale = "exact-source-identity", "The public primary abbreviation, cite type and report name match the frozen source tuple exactly."
            if current is None:
                if source_key not in TRANSITIONS: raise RuntimeError("unmapped case-reporter identity")
                target_id, method, rationale = TRANSITIONS[source_key]
                current = public_by_id[target_id]
                if legacy["short_name"] not in current["aliases"]: raise RuntimeError("reviewed transition lacks public alias")
            mapped_ids.add(current["id"])
            data = seeds[identity]
            legacy_projection = {"primaryAbbreviation": legacy["short_name"], "name": legacy["name"], "citeType": legacy["cite_type"],
                                 "jurisdictions": data["mlz_jurisdiction"], "editions": [{"abbreviation": abbreviation,
                                     "start": normal(edition["start"]), "end": normal(edition["end"])} for abbreviation, edition in data["editions"].items()]}
            row.update(kind="case-reporter", reporterId=current["id"], method=method, rationale=rationale,
                       legacyMetadata={key: legacy_projection[key] for key in ("jurisdictions", "editions")},
                       differences=differences(legacy_projection, current))
        mappings.append(row)
    if seen_seeds != set(seeds): raise RuntimeError("unaccounted legacy publication source")
    mapping_by_artifact = {row["artifactSha256"]: row for row in mappings}
    edition_mappings = []
    for key, legacy in sorted(edition_artifacts.items()):
        reporter_key = legacy["reporter"]["artifactSha256"]
        parent = mapping_by_artifact[reporter_key]
        row = {"artifactSha256": key, "reporterArtifactSha256": reporter_key, "legacyAbbreviation": legacy["short_name"]}
        if parent["kind"] != "case-reporter": row.update(kind=parent["kind"])
        else:
            current = public_by_id[parent["reporterId"]]
            editions = [edition for edition in current["editions"] if edition["abbreviation"] == legacy["short_name"]]
            method = "exact-edition-abbreviation"
            if not editions and parent["method"] == "alias-merger" and legacy["short_name"] == "C.I.T.":
                editions = [edition for edition in current["editions"] if edition["abbreviation"] == "Ct. Int'l Trade"]
                method = "historical-edition-alias"
            if len(editions) != 1: raise RuntimeError("unmapped or ambiguous legacy reporter edition")
            edition = editions[0]
            old = {"abbreviation": legacy["short_name"], "start": legacy["start"]["datetime"] if legacy["start"] else None,
                   "end": legacy["end"]["datetime"] if legacy["end"] else None}
            row.update(kind="case-reporter", reporterId=parent["reporterId"], currentAbbreviation=edition["abbreviation"],
                       method=method, differences=differences(old, edition))
        edition_mappings.append(row)
    current_courts = {row["sourceId"]: row for row in public["courts"]["records"]}
    court_rows = []
    for ordinal, legacy in enumerate(courts, 1):
        if legacy["id"] not in current_courts: raise RuntimeError("legacy court has no public identity")
        current = current_courts[legacy["id"]]
        row = {"id": legacy["id"], "ordinal": ordinal, "citationString": legacy["citation_string"],
               "legacyMetadata": {"name": legacy["name"], "nameAbbreviation": legacy.get("name_abbreviation"),
                   "sourceJurisdiction": legacy.get("jurisdiction"), "system": legacy["system"], "type": legacy.get("type"),
                   "hierarchyLevel": legacy.get("level"), "location": legacy["location"], "effectiveRanges": legacy["dates"]}}
        projection = dict(row["legacyMetadata"])
        jurisdiction = projection["sourceJurisdiction"]
        if isinstance(jurisdiction, list) and len(jurisdiction) == 1: projection["sourceJurisdiction"] = jurisdiction[0]
        projection["effectiveRanges"] = [{"start": dates.get("start"), "end": dates.get("end")} for dates in legacy["dates"]]
        row["differences"] = differences({"citationString": row["citationString"], **projection}, current)
        court_rows.append(row)
    report = {"schemaVersion": "citation-vocabulary-mapping/v1", "oracleCommit": PIN, "oracleTree": TREE,
              "oracleReportersVersion": "3.2.53", "oracleCourtsVersion": "0.10.22", "publicArtifactVersion": VERSION,
              "publicReportersVersion": public["reporters"]["source"]["release"], "publicCourtsVersion": public["courts"]["source"]["release"],
              "exporterSha256": sha(Path(__file__).read_bytes()), "publicExporterSha256": sha(Path(__file__).with_name("export-public-vocabulary.ts").read_bytes()),
              "operationCorpusSha256": sha(operation_path.read_bytes()),
              "legacyReporterDataSha256": sha(canonical(normal({"reporters": REPORTERS, "laws": LAWS, "journals": JOURNALS})).encode()),
              "legacyCourtSelectionSha256": sha(canonical([{key: row[key] for key in ("id", "ordinal", "citationString")} for row in court_rows]).encode()),
              "reporters": mappings, "editions": edition_mappings, "courts": court_rows,
              "publicOnlyReporterIds": sorted(set(public_by_id) - mapped_ids),
              "publicOnlyCourtIds": sorted({row["id"] for row in public["courts"]["records"]} - {row["id"] for row in court_rows})}
    arrays = {key: value for key, value in report.items() if isinstance(value, list)}
    head = {key: value for key, value in report.items() if key not in arrays}
    text = json.dumps(head, ensure_ascii=False, indent=2)[:-2]
    for key, values in arrays.items(): text += ',\n  ' + canonical(key) + ': [\n' + ',\n'.join('    ' + canonical(row) for row in values) + '\n  ]'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text + '\n}\n')
    print(f"reporters={dict(Counter(row['kind'] for row in mappings))}; editions={len(edition_mappings)}; courts={len(court_rows)}")
    print(f"case transitions={dict(Counter(row.get('method') for row in mappings if row['kind']=='case-reporter'))}; court changes={sum(bool(row['differences']) for row in court_rows)}")


if __name__ == "__main__": main()
