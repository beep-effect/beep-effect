"""Reject missing, corrupted or falsely completed supplemental oracle evidence."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixtures = root / "packages/law-practice/use-cases/test/fixtures/eyecite"
    validator = root / "goals/citation-extraction-engine/ops/check-supplemental.ts"
    original = json.loads((fixtures / "supplemental-extraction.json").read_text())

    def invoke(folder, audit=True):
        return subprocess.run(["bun", "run", str(validator), "--fixtures", str(folder), *(["--audit"] if audit else [])],
                              cwd=root, capture_output=True, text=True, timeout=180)

    baseline = invoke(fixtures)
    if baseline.returncode or "13 probes, 57 coordinate slices" not in baseline.stdout:
        raise SystemExit("supplemental baseline must pass")
    strict = invoke(fixtures, False)
    if strict.returncode != 1 or "Citation supplemental validation failed." not in strict.stdout + strict.stderr:
        raise SystemExit("unfinished supplemental proof must fail strict mode")

    def payload(report, case_id, mutate):
        row = next(row for row in report["cases"] if row["id"] == case_id)
        value = json.loads(row["payload"])
        mutate(value)
        row["payload"] = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        row["normalizedSha256"] = hashlib.sha256(row["payload"].encode()).hexdigest()

    def text_payload(report, case_id, mutate):
        row = next(row for row in report["textCases"] if row["id"] == case_id)
        value = json.loads(row["payload"])
        mutate(value)
        row["payload"] = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        row["normalizedSha256"] = hashlib.sha256(row["payload"].encode()).hexdigest()

    controls = {
        "missing-case": lambda r: r["cases"].pop(),
        "duplicate-case": lambda r: r["cases"].append(r["cases"][0]),
        "unplanned-case": lambda r: r["cases"][0].update(id="unplanned"),
        "wrong-license": lambda r: r.update(license="MIT"),
        "missing-license": lambda r: r.pop("license"),
        "missing-proof-field": lambda r: r["cases"][0].pop("targetProof"),
        "missing-workflow": lambda r: r["cases"][0].pop("workflowState"),
        "unknown-workflow": lambda r: r["cases"][0].update(workflowState="complete-and-audit"),
        "stale-source": lambda r: r["sourceHashes"].update({"eyecite/models.py": "a" * 64}),
        "missing-dependency": lambda r: r["dependencies"].pop("reporters-db"),
        "stale-exporter": lambda r: r.update(exporterSha256="a" * 64),
        "stale-plan": lambda r: r.update(planSha256="a" * 64),
        "stale-observation": lambda r: r["cases"][0].update(normalizedSha256="a" * 64),
        "wrong-utf16-offset": lambda r: payload(r, "astral-prefix", lambda v: v["citations"][0]["spans"]["span"].update(utf16=[2, 10])),
        "wrong-slice": lambda r: payload(r, "astral-prefix", lambda v: v["citations"][0]["spans"]["span"].update(text="other")),
        "reversed-range": lambda r: payload(r, "astral-prefix", lambda v: v["citations"][0]["spans"]["span"].update(python=[10, 2])),
        "missing-span": lambda r: payload(r, "astral-prefix", lambda v: v["citations"][0]["spans"].pop("fullSpan")),
        "nonreflexive-equality": lambda r: payload(r, "astral-prefix", lambda v: v.update(equality=[[False]])),
        "ragged-equality": lambda r: payload(r, "cit-merger", lambda v: v.update(equality=[[True], [False, True]])),
        "merged-historical-authorities": lambda r: payload(r, "cit-merger", lambda v: v.update(authorityGroups=[[0, 1]])),
        "false-historical-equality": lambda r: payload(r, "cit-merger", lambda v: v.update(equality=[[True, True], [True, True]])),
        "changed-reporter": lambda r: payload(r, "cit-merger", lambda v: v["citations"][0].update(correctedReporter="Ct. Int'l Trade")),
        "misclassified-regulation": lambda r: payload(r, "cfr-law", lambda v: v["citations"][0].update(kind="FullCaseCitation")),
        "hidden-open-coverage": lambda r: r.update(remainingCoverage=[]),
        "target-outside-repo": lambda r: r["cases"][0].update(targetProof={"path": "../../outside", "name": "probe", "evidenceSha256": "a" * 64}),
    }
    controls.update({
        "missing-text-case": lambda r: r["textCases"].pop(),
        "duplicate-text-case": lambda r: r["textCases"].append(r["textCases"][0]),
        "cross-projection-id": lambda r: r["textCases"][0].update(id=r["cases"][0]["id"]),
        "missing-text-ledger": lambda r: r.pop("textCases"),
        "missing-text-plan-hash": lambda r: r.pop("textPlanSha256"),
        "stale-observer": lambda r: r.update(observerSha256="a" * 64),
        "missing-observer-hash": lambda r: r.pop("observerSha256"),
        "stale-text-plan": lambda r: r.update(textPlanSha256="a" * 64),
        "missing-clean-source": lambda r: r["sourceHashes"].pop("eyecite/clean.py"),
        "stale-annotation-source": lambda r: r["sourceHashes"].update({"eyecite/annotate.py": "a" * 64}),
        "text-unknown-state": lambda r: r["textCases"][0].update(workflowState="deferred"),
        "text-missing-proof": lambda r: r["textCases"][0].pop("targetProof"),
        "failure-as-success": lambda r: text_payload(r, "clean-empty-html", lambda v: v.update(outcome={"kind": "success", "value": ""})),
        "missing-exception-type": lambda r: text_payload(r, "clean-empty-html", lambda v: v["outcome"].pop("type")),
        "wrong-exception-message": lambda r: text_payload(r, "annotation-invalid-mode", lambda v: v["outcome"].update(message="other")),
        "reordered-cleaners": lambda r: text_payload(r, "clean-order-a", lambda v: v["input"]["steps"].reverse()),
        "changed-diff-mode": lambda r: text_payload(r, "annotation-repeat-insert-builtin", lambda v: v["input"].update(use_dmp=True)),
        "missing-diff-mode": lambda r: text_payload(r, "annotation-repeat-insert", lambda v: v["input"].pop("use_dmp")),
        "wrong-bisect-side": lambda r: text_payload(r, "annotation-markup", lambda v: v["mappingUpdates"][0].update(side="bisect_left")),
        "wrong-mapped-boundary": lambda r: text_payload(r, "annotation-markup", lambda v: v["mappingUpdates"][0].update(result=6)),
        "missing-mapping-trace": lambda r: text_payload(r, "annotation-markup", lambda v: v.update(mappingUpdates=[])),
        "wrong-source-coordinate": lambda r: text_payload(r, "annotation-markup", lambda v: v["mappedSpans"][0].update(utf16=[6, 17])),
        "wrong-annotation-unit": lambda r: text_payload(r, "annotation-astral", lambda v: v["inputSpans"][0].update(utf16=[2, 10])),
        "empty-point-with-text": lambda r: text_payload(r, "annotation-zero-width", lambda v: v["inputSpans"][0].update(text="c")),
        "wrong-empty-point-offset": lambda r: text_payload(r, "annotation-repeat-delete", lambda v: v["mappedSpans"][0].update(utf16=[8, 8])),
        "annotation-payload-as-cleaner": lambda r: next(row for row in r["textCases"] if row["id"] == "annotation-markup").update(operation="clean_text"),
        "forged-text-target": lambda r: r["textCases"][0].update(targetProof={"path": "../../outside", "name": "probe", "evidenceSha256": "a" * 64}),
    })
    controls.update({
        "missing-warning-ledger": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v.pop("warnings")),
        "missing-empty-warning-ledger": lambda r: text_payload(r, "clean-none", lambda v: v.pop("warnings")),
        "dropped-skip-warning": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v.update(warnings=[])),
        "duplicated-warning": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"].append(v["warnings"][0])),
        "changed-warning-template": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].update(messageTemplate="other")),
        "interpolated-warning-template": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].update(messageTemplate="Citation was not annotated due to unbalanced tags 1 U.S. <span>1")),
        "changed-warning-arguments": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].update(arguments=["other"])),
        "missing-warning-arguments": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].pop("arguments")),
        "changed-warning-level": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].update(level="INFO")),
        "missing-warning-level": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].pop("level")),
        "changed-warning-logger": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].update(logger="other")),
        "unexpected-cleaner-warning": lambda r: text_payload(r, "clean-none", lambda v: v.update(warnings=[{"logger":"eyecite.clean","level":"WARNING","messageTemplate":"other","arguments":[]}])),
        "legacy-warning-free-version": lambda r: r.update(schemaVersion="citation-supplemental-extraction/v2"),
        "unclassified-warning-argument": lambda r: text_payload(r, "annotation-unbalanced-skip", lambda v: v["warnings"][0].update(arguments=[{"unclassified":True}])),
    })
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="supplemental-controls-", dir=args.scratch_root) as scratch:
        scratch = Path(scratch)
        for name in ["source-inventory.json", "operation-cases.json"]:
            shutil.copyfile(fixtures / name, scratch / name)
        for name, mutate in controls.items():
            report = copy.deepcopy(original)
            mutate(report)
            (scratch / "supplemental-extraction.json").write_text(json.dumps(report))
            result = invoke(scratch)
            if result.returncode != 1:
                raise SystemExit(f"negative control did not fail: {name}")
            print(f"PASS {name}")
    print(f"audit baseline passed; strict incomplete proof and {len(controls)} corruption controls rejected")


if __name__ == "__main__":
    main()
