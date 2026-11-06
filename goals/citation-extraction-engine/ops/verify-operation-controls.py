#!/usr/bin/env python3
"""Exercise the actual portable validator against isolated corpus corruptions."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


def change_payload(report, operation, change):
    row = next(row for row in report["cases"] if row["operation"] == operation)
    payload = json.loads(row["payload"])
    change(payload)
    row["payload"] = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    row["normalizedSha256"] = hashlib.sha256(row["payload"].encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixture = root / "packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json"
    original = json.loads(fixture.read_text())
    validator = root / "goals/citation-extraction-engine/ops/check-operations.ts"

    def invoke(path):
        result = subprocess.run(["bun", "run", str(validator), str(path)], cwd=root,
                                capture_output=True, text=True, timeout=180)
        return result.returncode, result.stdout, result.stderr

    code, stdout, _ = invoke(fixture)
    if code != 0 or "Operation evidence valid:" not in stdout:
        raise SystemExit("baseline validator must pass before negative controls")

    def stale_payload(report):
        report["cases"][0]["payload"] += " "

    def absent_artifact(report):
        del report["artifacts"][next(iter(report["artifacts"]))]

    def wrong_coordinate(report):
        def change(payload):
            payload["stages"]["citationSpans"][0]["span"]["utf16"][0] += 1
        change_payload(report, "get_citations", change)

    def absent_observation(report):
        counts = {}
        for row in report["cases"]:
            counts[row["sourceSiteId"]] = counts.get(row["sourceSiteId"], 0) + 1
        index = next(index for index, row in enumerate(report["cases"]) if counts[row["sourceSiteId"]] == 1)
        del report["cases"][index]

    def unknown_operation(report):
        report["cases"][0]["operation"] = "unknown"

    def wrong_source(report):
        report["sourceSites"][0]["sourceSha256"] = "a" * 64

    def absent_occurrence(report):
        def change(payload):
            payload["stages"]["resolutionGroups"][0]["members"][0] = len(payload["input"]["citations"])
        change_payload(report, "resolve_citations", change)

    def dangling_reference(report):
        def change(payload):
            payload["input"]["tokenizer"]["extractorsSha256"] = "a" * 64
        change_payload(report, "get_citations", change)

    def invalid_filter_candidate(report):
        def change(payload):
            stage = payload["stages"]["filtering"][-1]
            stage["retained"][0] = len(stage["candidates"])
        change_payload(report, "get_citations", change)

    def wrong_filter_output(report):
        def change(payload):
            stage = payload["stages"]["filtering"][-1]
            stage["candidates"][stage["retained"][0]]["matchedText"] += "changed"
        change_payload(report, "get_citations", change)

    def unordered_edition_candidates(report):
        row = next(row for row in report["cases"] if row["operation"] == "get_citations" and
                   any(len({edition["artifactSha256"] for edition in c["fields"].get("all_editions", [])}) > 1 for c in json.loads(row["payload"])["outcome"].get("value", [])))
        payload = json.loads(row["payload"])
        citation = next(c for c in payload["outcome"]["value"] if len({edition["artifactSha256"] for edition in c["fields"].get("all_editions", [])}) > 1)
        citation["fields"]["all_editions"].reverse()
        row["payload"] = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        row["normalizedSha256"] = hashlib.sha256(row["payload"].encode()).hexdigest()

    controls = {
        "stale-payload-hash": stale_payload,
        "unordered-edition-bag-with-valid-hash": unordered_edition_candidates,
        "invalid-filter-candidate-with-valid-hash": invalid_filter_candidate,
        "filter-selection-output-mismatch-with-valid-hash": wrong_filter_output,
        "absent-shared-artifact": absent_artifact,
        "wrong-utf16-coordinate-with-valid-hash": wrong_coordinate,
        "absent-source-site-observation": absent_observation,
        "unknown-operation": unknown_operation,
        "wrong-independent-source-hash": wrong_source,
        "absent-resolution-occurrence-with-valid-hash": absent_occurrence,
        "dangling-tokenizer-reference-with-valid-hash": dangling_reference,
    }
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="operation-controls-", dir=args.scratch_root) as scratch:
        path = Path(scratch) / "corrupted.json"
        for name, mutate in controls.items():
            report = copy.deepcopy(original)
            mutate(report)
            path.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
            code, _, stderr = invoke(path)
            if code != 1 or "Public-operation oracle validation failed;" not in stderr:
                raise SystemExit(f"negative control did not fail through the validator: {name}")
            print(f"PASS {name}")
    print(f"baseline passed; {len(controls)} actual-validator negative controls passed")


if __name__ == "__main__":
    main()
