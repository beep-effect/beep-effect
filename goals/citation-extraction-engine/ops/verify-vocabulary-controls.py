#!/usr/bin/env python3
"""Exercise actual portable legacy/public vocabulary corruption controls."""
import argparse
import copy
import json
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixture = root / "packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json"
    original = json.loads(fixture.read_text())
    validator = root / "goals/citation-extraction-engine/ops/check-vocabulary-mapping.ts"
    def invoke(path): return subprocess.run(["bun", "run", str(validator), str(path)], cwd=root, capture_output=True, text=True, timeout=180)
    baseline = invoke(fixture)
    if baseline.returncode or "Vocabulary mapping valid:" not in baseline.stdout: raise SystemExit("baseline mapping must pass")
    def noncase_identity(report):
        next(row for row in report["reporters"] if row["kind"] == "law-publication")["reporterId"] = "reporter:fake"
    def wrong_identity(report):
        next(row for row in report["reporters"] if row["kind"] == "case-reporter")["reporterId"] = "reporter:fake"
    def erased_transition(report):
        next(row for row in report["reporters"] if row.get("method") == "alias-merger")["method"] = "exact-source-identity"
    def unrecorded_reporter_drift(report):
        next(row for row in report["reporters"] if row.get("differences"))["differences"] = []
    def unrecorded_edition_drift(report):
        next(row for row in report["editions"] if row.get("differences"))["differences"] = []
    def wrong_edition_parent(report): report["editions"][0]["reporterArtifactSha256"] = "a" * 64
    def unrecorded_court_drift(report): next(row for row in report["courts"] if row["differences"])["differences"] = []
    def wrong_ambiguous_identity(report):
        rows = [row for row in report["reporters"] if row["kind"] == "case-reporter" and row["legacyAbbreviation"] == "Woolw."]
        if len(rows) != 2: raise RuntimeError("ambiguity control source changed")
        rows[0]["reporterId"] = rows[1]["reporterId"]
    def substitute_current_date(report):
        row = next(row for row in report["reporters"] if row["kind"] == "case-reporter" and row["legacyAbbreviation"] == "N.W.")
        next(edition for edition in row["legacyMetadata"]["editions"] if edition["abbreviation"] == "N.W.2d")["end"] = "2023-12-31T00:00:00"
    controls = {
      "wrong-public-version": lambda r: r.update(publicArtifactVersion="stale"),
      "wrong-source-corpus-hash": lambda r: r.update(operationCorpusSha256="a" * 64),
      "missing-publication": lambda r: r["reporters"].pop(),
      "duplicate-publication": lambda r: r["reporters"].append(r["reporters"][0]),
      "unissued-case-identity": wrong_identity,
      "wrong-ambiguous-alias-identity": wrong_ambiguous_identity,
      "current-date-substituted-for-legacy": substitute_current_date,
      "noncase-forged-reporter-id": noncase_identity,
      "unreviewed-transition": erased_transition,
      "unrecorded-reporter-drift": unrecorded_reporter_drift,
      "missing-edition": lambda r: r["editions"].pop(),
      "wrong-edition-parent": wrong_edition_parent,
      "unrecorded-edition-drift": unrecorded_edition_drift,
      "missing-court": lambda r: r["courts"].pop(),
      "duplicate-court": lambda r: r["courts"].append(r["courts"][0]),
      "changed-court-selection-order": lambda r: r["courts"].reverse(),
      "changed-court-citation-string": lambda r: r["courts"][0].update(citationString="changed"),
      "unrecorded-court-drift": unrecorded_court_drift,
      "missing-new-reporter": lambda r: r["publicOnlyReporterIds"].pop(),
      "missing-new-court": lambda r: r["publicOnlyCourtIds"].pop(),
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vocabulary-controls-", dir=args.scratch_root) as scratch:
        path = Path(scratch) / "corrupted.json"
        for name, mutate in controls.items():
            report = copy.deepcopy(original)
            mutate(report)
            path.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
            result = invoke(path)
            if result.returncode != 1 or "Vocabulary mapping validation failed;" not in result.stderr: raise SystemExit(f"negative control did not fail: {name}")
            print(f"PASS {name}")
    print(f"baseline passed; {len(controls)} vocabulary corruption controls passed")


if __name__ == "__main__": main()
