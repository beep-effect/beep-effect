#!/usr/bin/env python3
"""Delete fixed evidence fields and require rejection by the actual validators.

The committed inputs remain unchanged. Payload edits receive fresh hashes so
missing observations cannot be rejected merely because the old hash is stale.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


def remove_path(value, path):
    for key in path[:-1]: value = value[key]
    del value[path[-1]]


def payload_remove(report, collection, path):
    row = report[collection][0]
    value = json.loads(row["payload"])
    remove_path(value, path)
    row["payload"] = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    row["normalizedSha256"] = hashlib.sha256(row["payload"].encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scratch-root", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    fixture = root / "packages/law-practice/use-cases/test/fixtures/eyecite"
    evidence = root / "goals/citation-extraction-engine/history/evidence"
    configurations = [
      ("discovery", "check-discovery.ts", evidence, ["oracle-discovery.json"], "Discovery valid:", "Citation oracle discovery validation failed;"),
      ("operations", "check-operations.ts", fixture, ["operation-cases.json"], "Operation evidence valid:", "Public-operation oracle validation failed;"),
      ("assertions", "check-assertions.ts", fixture, ["assertion-cases.json"], "Validated 1583 assertions", "Assertion oracle validation failed;"),
      ("ledgers", "check-ledgers.ts", fixture, ["source-inventory.json", "canonical-cases.json", "regex-inventory.json"], "Ledger projections valid:", "Citation ledger validation failed;"),
      ("donors", "check-typescript-donors.ts", fixture, ["typescript-extensions.json"], "Donor accounting valid:", "TypeScript donor validation failed;"),
      ("vocabulary", "check-vocabulary-mapping.ts", fixture, ["vocabulary-mapping.json"], "Vocabulary mapping valid:", "Vocabulary mapping validation failed;"),
      ("safety", "check-safety-contract.ts", evidence, ["citation-policy-contract.json", "regex-process-isolation-probe.json"], "Citation safety contract valid:", "Citation safety contract validation failed."),
    ]
    args.scratch_root.mkdir(parents=True, exist_ok=True)
    total = 0
    with tempfile.TemporaryDirectory(prefix="evidence-presence-", dir=args.scratch_root) as scratch:
        for name, script, original_folder, names, success, failure in configurations:
            folder = Path(scratch) / name
            folder.mkdir()
            originals = [json.loads((original_folder / item).read_text()) for item in names]
            def invoke(target):
                return subprocess.run(["bun", "run", str(root / "goals/citation-extraction-engine/ops" / script), str(target)],
                                      cwd=root, capture_output=True, text=True, timeout=180)
            directory_input = name in ("ledgers", "safety")
            baseline = invoke(original_folder if directory_input else original_folder / names[0])
            if baseline.returncode or success not in baseline.stdout: raise SystemExit(f"{name} baseline must pass")
            controls = []
            def field(label, index, path):
                controls.append((label, lambda records, i=index, p=path: remove_path(records[i], p)))
            if name in ("discovery", "operations", "assertions"):
                for key in ["schemaVersion", "scope", "commit", "tree", "license", "licenseSha256"]:
                    field(f"missing-{key}", 0, [key])
                if name != "discovery":
                    for key in ["clockDate", "hashSeed", "normalizationVersion", "testsRun", "lockSha256"]:
                        field(f"missing-{key}", 0, [key])
            if name == "discovery":
                for key in ["successful", "failures", "errors", "skipped"]: field(f"missing-runtime-{key}", 0, ["runtime", key])
            if name == "operations":
                controls.append(("missing-outcome-kind-with-valid-hash", lambda rows: payload_remove(rows[0], "cases", ["outcome", "kind"])))
                controls.append(("missing-artifact-kind", lambda rows: rows[0]["artifacts"][next(iter(rows[0]["artifacts"]))].pop("kind")))
            if name == "assertions":
                for key in ["passed", "relation"]:
                    controls.append((f"missing-payload-{key}-with-valid-hash", lambda rows, key=key: payload_remove(rows[0], "events", [key])))
                controls.append(("missing-relation-kind-with-valid-hash", lambda rows: payload_remove(rows[0], "events", ["relation", "kind"])))
            if name == "ledgers":
                for index in range(3):
                    field(f"missing-schemaVersion-{index}", index, ["schemaVersion"])
                    for path in [["generatorVersion"], ["source", "repository"], ["source", "commit"], ["source", "tree"],
                                 ["source", "license", "id"], ["source", "license", "sha256"], ["source", "license", "material"], ["source", "license", "notice"]]:
                        field(f"missing-{index}-{'-'.join(path)}", index, path)
                for key in ["id", "sha256", "material", "notice"]:
                    field(f"missing-fixture-license-{key}", 1, ["fixtures", 0, "license", key])
                field("missing-case-kind", 1, ["cases", 0, "kind"])
                field("missing-observation-file", 1, ["cases", 0, "observation", "file"])
                field("missing-input-projection", 1, ["cases", 0, "inputProjection"])
                field("missing-expected-projection", 1, ["cases", 0, "expectedProjection"])
                field("missing-regex-scope", 2, ["scope"])
            if name == "donors":
                for key in ["schemaVersion", "scope"]: field(f"missing-{key}", 0, [key])
                for donor in range(2):
                    for key in ["id", "repository", "commit", "tree", "version", "license", "licenseSha256", "lockPath", "lockSha256"]:
                        field(f"missing-donor-{donor}-{key}", 0, ["donors", donor, key])
                    field(f"missing-donor-{donor}-zero-failures", 0, ["donors", donor, "suite", "failed"])
                field("missing-empty-branch-reason", 0, ["donors", 0, "unobservedDeclarations", 0, "reason"])
                field("missing-empty-branch-zero", 0, ["donors", 0, "unobservedDeclarations", 0, "qualifyingRows"])
                field("missing-disposition-kind", 0, ["dispositions", 0, "kind"])
            if name == "vocabulary":
                for key in ["schemaVersion", "oracleCommit", "oracleTree", "oracleReportersVersion", "oracleCourtsVersion", "publicReportersVersion", "publicCourtsVersion"]:
                    field(f"missing-{key}", 0, [key])
                for kind in ["case-reporter", "law-publication", "journal-publication"]:
                    index = next(i for i, row in enumerate(originals[0]["reporters"]) if row["kind"] == kind)
                    field(f"missing-{kind}-kind", 0, ["reporters", index, "kind"])
                    field(f"missing-{kind}-source", 0, ["reporters", index, "legacySource"])
                    if kind != "case-reporter": field(f"missing-{kind}-family", 0, ["reporters", index, "citationFamily"])
            if name == "safety":
                for key in ["schemaVersion", "durationEncoding"]: field(f"missing-policy-{key}", 0, [key])
                for key in ["version", "execution"]: field(f"missing-default-{key}", 0, ["defaultPolicy", key])
                for key in ["schemaVersion", "scope", "warmups", "repetitions"]: field(f"missing-probe-{key}", 1, [key])
                for key in ["exitConfirmed", "deadlineMillis"]: field(f"missing-observation-{key}", 1, ["results", 0, key])
            for label, mutate in controls:
                records = copy.deepcopy(originals)
                mutate(records)
                for path, record in zip(names, records): (folder / path).write_text(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
                result = invoke(folder if directory_input else folder / names[0])
                if result.returncode != 1 or failure not in result.stderr: raise SystemExit(f"missing evidence accepted or wrong failure: {name}/{label}")
                print(f"PASS {name}/{label}", flush=True)
                total += 1
            print(f"{name}: baseline passed; {len(controls)} explicit-presence controls passed", flush=True)
    print(f"all {len(configurations)} baselines passed; {total} actual-validator explicit-presence controls passed")


if __name__ == "__main__": main()
