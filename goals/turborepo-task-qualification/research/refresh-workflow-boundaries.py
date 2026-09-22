"""Project source-only workflow boundaries from the retained parsed snapshot."""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKET = ROOT / "goals/turborepo-task-qualification/research"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", default="workflow-sources-runtime-routing.json")
parser.add_argument("--output", default="workflow-boundaries.json")
args = parser.parse_args()
SOURCE = PACKET / args.source
snapshot = json.loads(SOURCE.read_text())
uses = defaultdict(list)
jobs = []

def collect_uses(value, location):
    if isinstance(value, dict):
        if isinstance(value.get("uses"), str):
            uses[value["uses"]].append(location)
        for key, child in value.items():
            collect_uses(child, f"{location}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            collect_uses(child, f"{location}/{index}")

for item in snapshot["files"]:
    path = ROOT / item["path"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
        raise ValueError(f"Workflow source drift: {item['path']}")
    doc = item["document"]
    collect_uses(doc, item["path"])
    for name, job in doc.get("jobs", {}).items():
        matrix = job.get("strategy", {}).get("matrix")
        jobs.append({
            "path": item["path"], "job": name,
            "needs": job.get("needs", []), "condition": job.get("if"),
            "reusableWorkflow": job.get("uses"), "matrix": matrix,
            "conditionalSteps": [
                {"index": i, "condition": step["if"]}
                for i, step in enumerate(job.get("steps", [])) if "if" in step
            ],
        })

references = []
for ref, locations in sorted(uses.items()):
    kind = "local" if ref.startswith("./") else (
        "commit-pinned" if re.search(r"@[0-9a-f]{40}$", ref) else "mutable-or-dynamic"
    )
    references.append({"reference": ref, "kind": kind, "locations": locations})
report = {
    "authority": "Source projection only. Matrices, expressions and remote sources are not executed or resolved; no hosted proof or qualification.",
    "source": {"path": str(SOURCE.relative_to(ROOT)), "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest()},
    "workflowAndActionFiles": len(snapshot["files"]),
    "jobs": jobs, "uses": references,
}
(PACKET / args.output).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"files": len(snapshot["files"]), "jobs": len(jobs), "uniqueUses": len(references), "usesOccurrences": sum(len(x["locations"]) for x in references), "mutableReferences": [x["reference"] for x in references if x["kind"] == "mutable-or-dynamic"], "matrixJobs": sum(x["matrix"] is not None for x in jobs)}))
