"""Bind reviewed representation laws and fidelity questions to current evidence."""
import argparse
import hashlib
import json
from pathlib import Path


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    plan_file = Path(__file__).with_name("divergence-plan.json")
    plan = json.loads(plan_file.read_text())
    fixture = root / "packages/law-practice/use-cases/test/fixtures/eyecite/supplemental-extraction.json"
    supplemental = json.loads(fixture.read_text())
    observations = {row["id"]: row for row in supplemental["textCases"]}
    rules = [{"kind": "representation-law", "id": row["id"], "statement": row["statement"],
              "targetTest": row["targetTest"], "references": [{"path": name, "sha256": sha((root / name).read_bytes())} for name in row["referencePaths"]],
              "workflowState": "audit", "proof": None} for row in plan["normalizations"]]
    questions = [{"kind": "fidelity-question", "id": row["id"], "blocker": row["blocker"], "workflowState": "audit",
                  "targetTest": row["targetTest"], "observations": [{"file": "supplemental-extraction.json", "collection": "textCases", "id": name,
                                    "normalizedSha256": observations[name]["normalizedSha256"]} for name in row["observationIds"]]}
                 for row in plan["questions"]]
    output = {"schemaVersion": "citation-divergences/v1", "scope": plan["scope"],
              "commit": supplemental["commit"], "tree": supplemental["tree"],
              "license": supplemental["license"], "licenseSha256": supplemental["licenseSha256"],
              "planSha256": sha(plan_file.read_bytes()), "exporterSha256": sha(Path(__file__).read_bytes()),
              "supplementalSha256": sha(fixture.read_bytes()), "normalizations": rules, "questions": questions,
              "semanticWaivers": []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Divergence ledger: {len(rules)} representation laws; {len(questions)} open fidelity questions; no target proof or semantic waiver.")


if __name__ == "__main__":
    main()
