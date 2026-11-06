"""Reject missing laws/questions, altered evidence and premature divergence proof."""
import argparse
import copy
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
    original = json.loads((fixtures / "divergences.json").read_text())
    validator = root / "goals/citation-extraction-engine/ops/check-divergences.ts"
    def invoke(folder, audit=True):
        return subprocess.run(["bun", "run", str(validator), "--fixtures", str(folder), *(["--audit"] if audit else [])], cwd=root,
                              capture_output=True, text=True, timeout=180)
    baseline = invoke(fixtures)
    if baseline.returncode or "11 representation laws, 4 fidelity questions, 15 unfinished" not in baseline.stdout:
        raise SystemExit("divergence audit baseline must pass")
    strict = invoke(fixtures, False)
    if strict.returncode != 1 or "Citation divergence validation failed." not in strict.stdout + strict.stderr:
        raise SystemExit("unfinished divergence proof must fail default mode")
    proof = {"test": {"path":"packages/law-practice/use-cases/test/CitationPrerequisites.test.ts", "name":"citation engine prerequisite compatibility", "sha256":"a" * 64},
             "receipt": {"path":"goals/citation-extraction-engine/history/evidence/nonexistent-divergence-proof.json", "sha256":"a" * 64}, "result":"passed"}
    def complete_rule(report):
        report["normalizations"][0].update(workflowState="complete", proof=copy.deepcopy(proof))
    def semantic_waiver(report):
        report["questions"][0].update(workflowState="complete", resolution="semantic-waiver", rationale="unsupported shortcut", proof=copy.deepcopy(proof))
    def outside_test(report):
        complete_rule(report)
        report["normalizations"][0]["proof"]["test"]["path"] = "../../outside.test.ts"
    controls = {
        "missing-law": lambda r: r["normalizations"].pop(),
        "duplicate-law": lambda r: r["normalizations"].append(r["normalizations"][0]),
        "missing-question": lambda r: r["questions"].pop(),
        "duplicate-question": lambda r: r["questions"].append(r["questions"][0]),
        "cross-projection-id": lambda r: r["questions"][0].update(id=r["normalizations"][0]["id"]),
        "unexplained-law": lambda r: r["normalizations"][0].update(id="unexplained"),
        "altered-law-statement": lambda r: r["normalizations"][0].update(statement="drop legal fields"),
        "missing-source-reference": lambda r: r["normalizations"][0].update(references=[]),
        "stale-source-reference": lambda r: r["normalizations"][0]["references"][0].update(sha256="a" * 64),
        "unplanned-source-reference": lambda r: r["normalizations"][0]["references"][0].update(path="README.md"),
        "outside-source-reference": lambda r: r["normalizations"][0]["references"][0].update(path="../../outside"),
        "unknown-law-kind": lambda r: r["normalizations"][0].update(kind="semantic-change"),
        "unknown-workflow": lambda r: r["normalizations"][0].update(workflowState="complete-and-audit"),
        "missing-null-proof": lambda r: r["normalizations"][0].pop("proof"),
        "null-completion-proof": lambda r: r["normalizations"][0].update(workflowState="complete"),
        "forged-completion-proof": complete_rule,
        "outside-target-test": outside_test,
        "missing-question-blocker": lambda r: r["questions"][0].pop("blocker"),
        "altered-question-blocker": lambda r: r["questions"][0].update(blocker="ignore canonical output"),
        "missing-observation": lambda r: r["questions"][0]["observations"].pop(),
        "duplicate-observation": lambda r: r["questions"][0]["observations"].append(r["questions"][0]["observations"][0]),
        "dangling-observation": lambda r: r["questions"][0]["observations"][0].update(id="absent"),
        "stale-observation": lambda r: r["questions"][0]["observations"][0].update(normalizedSha256="a" * 64),
        "wrong-observation-owner": lambda r: r["questions"][0]["observations"][0].update(collection="cases"),
        "missing-observation-owner": lambda r: r["questions"][0]["observations"][0].pop("file"),
        "approved-semantic-waiver": lambda r: r.update(semanticWaivers=["ignore-anchor-ambiguity"]),
        "semantic-resolution": semantic_waiver,
        "missing-empty-waiver-list": lambda r: r.pop("semanticWaivers"),
        "missing-license": lambda r: r.pop("license"),
        "wrong-license": lambda r: r.update(license="MIT"),
        "stale-plan": lambda r: r.update(planSha256="a" * 64),
        "stale-exporter": lambda r: r.update(exporterSha256="a" * 64),
        "stale-supplemental": lambda r: r.update(supplementalSha256="a" * 64),
        "wrong-pin": lambda r: r.update(commit="a" * 40),
        "missing-planned-test": lambda r: r["normalizations"][0].pop("targetTest"),
        "changed-planned-test": lambda r: r["normalizations"][0]["targetTest"].update(name="unrelated"),
        "changed-question-target": lambda r: r["questions"][0]["targetTest"].update(path="packages/other/test/unrelated.test.ts"),
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="divergence-controls-", dir=args.scratch_root) as scratch:
        scratch = Path(scratch)
        shutil.copyfile(fixtures / "supplemental-extraction.json", scratch / "supplemental-extraction.json")
        for name, mutate in controls.items():
            report = copy.deepcopy(original)
            mutate(report)
            (scratch / "divergences.json").write_text(json.dumps(report))
            result = invoke(scratch)
            if result.returncode != 1:
                raise SystemExit(f"negative control did not fail: {name}")
            print(f"PASS {name}")
    print(f"audit baseline passed; incomplete default proof and {len(controls)} divergence corruption controls rejected")


if __name__ == "__main__":
    main()
