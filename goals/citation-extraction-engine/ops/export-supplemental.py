#!/usr/bin/env python3
"""Observe focused synthetic extraction/resolution probes at the clean oracle pin."""
import argparse
from datetime import datetime
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if sys.version_info[:2] != (3, 11) or os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization != 0:
        raise SystemExit("Python 3.11 and pre-start PYTHONHASHSEED=0 required")
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle pin/tree/cleanliness mismatch")
    sys.path.insert(0, str(root))
    from eyecite import get_citations, resolve_citations
    import eyecite.helpers as helpers
    import eyecite.models as models
    class OracleDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 28, tzinfo=tz)
    helpers.datetime = models.datetime = OracleDatetime
    plan_file = Path(__file__).with_name("supplemental-extraction-plan.json")
    plan = json.loads(plan_file.read_text())
    cases = []
    for row in plan["cases"]:
        text = row["text"]
        citations = get_citations(text)
        resolved = resolve_citations(citations)
        groups = [[next(index for index, cite in enumerate(citations) if cite is member)
                   for member in members] for members in resolved.values()]
        observed = []
        for cite in citations:
            spans = {}
            for name, method in [("span", cite.span), ("fullSpan", cite.full_span), ("spanWithPincite", cite.span_with_pincite)]:
                start, end = method()
                spans[name] = {"python": [start, end], "utf16": [len(text[:value].encode("utf-16-le")) // 2 for value in [start, end]], "text": text[start:end]}
            reporter = cite.corrected_reporter() if hasattr(cite, "corrected_reporter") else None
            observed.append({"kind": type(cite).__name__, "groups": cite.groups, "correctedReporter": reporter,
                             "correctedCitation": cite.corrected_citation(), "correctedFullCitation": cite.corrected_citation_full(), "spans": spans})
        if [cite["kind"] for cite in observed] != row["expectedKinds"] or groups != row["expectedAuthorityGroups"]:
            raise RuntimeError(f"probe no longer exercises its planned behavior: {row['id']}")
        cases.append({"id": row["id"], "text": text, "citations": observed, "authorityGroups": groups,
                      "equality": [[left == right for right in citations] for left in citations],
                      "workflowState": "audit", "targetProof": None})
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed during execution")
    for case in cases:
        payload = json.dumps({key: case.pop(key) for key in ["text", "citations", "authorityGroups", "equality"]}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        case.update(payload=payload, normalizedSha256=sha(payload.encode()))
    text_plan_file = Path(__file__).with_name("supplemental-text-plan.json")
    text_plan = json.loads(text_plan_file.read_text())
    helper = importlib.import_module("observe-supplemental-text")
    text_cases = []
    for row, observed in zip(text_plan["cases"], helper.observe(text_plan["cases"]), strict=True):
        if row["expectedOutcome"] != observed["outcome"] or row["expectedMappingUpdates"] != observed["mappingUpdates"]:
            raise RuntimeError(f"text probe no longer exercises planned behavior: {row['id']}")
        payload = json.dumps({key: observed[key] for key in ["input", "mappingUpdates", "inputSpans", "mappedSpans", "outcome"]}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        text_cases.append({"id": row["id"], "operation": row["operation"], "payload": payload,
                           "normalizedSha256": sha(payload.encode()), "workflowState": "audit", "targetProof": None})
    output = {"schemaVersion": "citation-supplemental-extraction/v2", "scope": "Focused extraction/resolution/cleaning/annotation projections; not exhaustive supplemental or target parity proof.",
              "commit": PIN, "tree": TREE, "license": "BSD-2-Clause",
              "licenseSha256": sha((root / "LICENSE").read_bytes()), "lockSha256": sha((root / "uv.lock").read_bytes()),
              "python": sys.version.split()[0], "hashSeed": "0", "clockDate": "2026-10-28",
              "dependencies": {name: importlib.metadata.version(name) for name in ["eyecite", "reporters-db", "courts-db", "regex", "lxml", "fast-diff-match-patch", "pyahocorasick"]},
              "exporterSha256": sha(Path(__file__).read_bytes()), "planSha256": sha(plan_file.read_bytes()),
              "textPlanSha256": sha(text_plan_file.read_bytes()), "observerSha256": sha(Path(helper.__file__).read_bytes()),
              "sourceHashes": {name: sha((root / name).read_bytes()) for name in ["eyecite/find.py", "eyecite/models.py", "eyecite/helpers.py", "eyecite/resolve.py", "eyecite/clean.py", "eyecite/annotate.py", "eyecite/utils.py"]},
              "cases": cases, "textCases": text_cases, "remainingCoverage": plan["remainingCoverage"]}
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed during text execution")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Supplemental probes: {len(cases)} extraction/resolution, {len(text_cases)} cleaning/annotation; target and remaining coverage proof still open.")


if __name__ == "__main__":
    main()
