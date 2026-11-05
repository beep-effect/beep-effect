#!/usr/bin/env python3
"""Reconcile pinned TypeScript export/test discovery with actual donor suites."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET


PINS = {
    "eyecite-ts": {"commit": "34133d03143ea65861f48a5ed0eb32c931581666", "tree": "f1243d0723cea1e53a5263ef67c9e066230729fc",
                   "license": "MIT", "lock": "pnpm-lock.yaml", "prefix": "ts", "version": "0.34.2",
                   "repository": "https://github.com/medelman17/eyecite-ts"},
    "eyecite-js": {"commit": "53a49f2412da668aaf262e5f92584c2c3781043b", "tree": "521fc394d7130f9b21e206d2bf236ffebcca932c",
                   "license": "BSD-2-Clause", "lock": "bun.lock", "prefix": "js", "version": "2.7.6-alpha.28",
                   "repository": "https://github.com/beshkenadze/eyecite-js"},
}


def sha(value): return hashlib.sha256(value).hexdigest()


def canonical(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def runtime_cases(cache, root, donor):
    if donor == "eyecite-ts":
        node_version = subprocess.check_output(["node", "--version"], cwd=root, text=True).strip()
        runner_version = json.loads((root / "node_modules/vitest/package.json").read_text())["version"]
        if node_version != "v24.22.1" or runner_version != "4.0.18": raise RuntimeError("donor Node/Vitest metadata requires an explicit version rebaseline")
    elif subprocess.check_output(["bun", "--version"], cwd=root, text=True).strip() != "1.4.4":
        raise RuntimeError("donor Bun metadata requires an explicit version rebaseline")
    if donor == "eyecite-ts":
        report = json.loads((cache / "ts-runtime-tests.json").read_text())
        if not report["success"] or report["numFailedTests"] != 0: raise RuntimeError("TypeScript suite failed")
        rows = []
        for file in report["testResults"]:
            path = Path(file["name"]).relative_to(root).as_posix()
            for event in file["assertionResults"]:
                rows.append({"path": path, "line": event["location"]["line"], "column": event["location"]["column"],
                             "title": event["title"], "ancestors": event["ancestorTitles"], "status": event["status"]})
        return rows, {"passed": report["numPassedTests"], "skipped": report["numPendingTests"], "todo": report["numTodoTests"], "failed": 0,
                      "command": "NPM_CONFIG_USERCONFIG=/dev/null NPM_CONFIG_IGNORE_SCRIPTS=true pnpm exec vitest run --includeTaskLocation --reporter=json --outputFile=<cache>/ts-runtime-tests.json",
                      "runner": "vitest@4.0.18", "runtime": "node@24.22.1"}
    report = ET.parse(cache / "js-runtime-tests.xml").getroot()
    if report.attrib["failures"] != "0": raise RuntimeError("JavaScript suite failed")
    rows = [{"path": event.attrib["file"], "line": int(event.attrib["line"]), "column": None,
             "title": event.attrib["name"], "ancestors": list(reversed(event.attrib.get("classname", "").split(" > "))),
             "status": "skipped" if event.find("skipped") is not None else "passed"}
            for event in report.iter("testcase")]
    return rows, {"passed": len(rows), "skipped": 0, "todo": 0, "failed": 0,
                  "command": "bun test --reporter=junit --reporter-outfile=<cache>/js-runtime-tests.xml",
                  "runner": "bun:test@1.4.4", "runtime": "bun@1.4.4"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    cache = args.cache_root.resolve()
    donors, dispositions = [], []
    static_tool = Path(__file__).with_name("inventory-typescript-donors.mjs")
    for donor_id, pin in PINS.items():
        root = cache / donor_id
        git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
        if git("rev-parse", "HEAD") != pin["commit"] or git("rev-parse", "HEAD^{tree}") != pin["tree"]:
            raise RuntimeError("donor pin/tree mismatch")
        dirty = git("status", "--porcelain")
        allowed = " M llms.txt" if donor_id == "eyecite-ts" else ""
        if dirty.strip() != allowed.strip(): raise RuntimeError("unaccounted donor worktree changes")
        static = json.loads((cache / f"{pin['prefix']}-static-inventory.json").read_text())
        if static["generatorSha256"] != sha(static_tool.read_bytes()): raise RuntimeError("stale AST exporter")
        for file in [*static["files"], *static["fixtures"]]:
            if sha((root / file["path"]).read_bytes()) != file["sha256"]: raise RuntimeError("donor source hash mismatch")
        for export in static["exports"]:
            for origin in [*export["origins"], *[member["origin"] for member in export["members"]]]:
                if sha((root / origin["path"]).read_bytes()) != origin["sourceSha256"]: raise RuntimeError("export origin hash mismatch")
        source_index = defaultdict(list)
        for row in static["testDeclarations"]:
            key = (row["path"], row["runtimeLine"], row["runtimeColumn"] if donor_id == "eyecite-ts" else None)
            source_index[key].append(row)
        if any(len(values) != 1 for values in source_index.values()): raise RuntimeError("ambiguous registration locations")
        events, suite = runtime_cases(cache, root, donor_id)
        events.sort(key=lambda row: (row["path"], row["line"], row["column"] or 0, row["ancestors"], row["title"]))
        counts = Counter()
        for event in events:
            source = source_index.get((event["path"], event["line"], event["column"]))
            if source is None: raise RuntimeError(f"unbound runtime registration: {event['path']}:{event['line']}")
            declaration = source[0]
            counts[declaration["id"]] += 1
            event.update({"declarationId": declaration["id"], "ordinal": counts[declaration["id"]],
                          "id": f"{declaration['id']}::{counts[declaration['id']]}"})
            event["normalizedSha256"] = sha(canonical({key: value for key, value in event.items() if key != "normalizedSha256"}).encode())
        actual_status = Counter(event["status"] for event in events)
        if actual_status != Counter({key: suite[key] for key in ["passed", "skipped", "todo"] if suite[key]}): raise RuntimeError("suite summary and cases differ")
        unobserved = []
        for declaration in static["testDeclarations"]:
            if declaration["id"] in counts: continue
            if donor_id != "eyecite-ts" or declaration["id"] != "tests/integration/expandedCorpus.test.ts:86:11:testDeclaration":
                raise RuntimeError("unclassified unobserved test declaration")
            fixture_path = "tests/fixtures/expanded-corpus.json"
            fixture = json.loads((root / fixture_path).read_text())
            if any(row.get("knownLimitation") and not row.get("performanceBenchmark") for row in fixture["samples"]):
                raise RuntimeError("expected empty skip branch now has qualifying data")
            unobserved.append({"declarationId": declaration["id"], "reason": "Conditional skip registration has no qualifying fixture rows; not a passing behavior observation.",
                               "fixturePath": fixture_path, "fixtureSha256": sha((root / fixture_path).read_bytes()),
                               "fixtureRows": len(fixture["samples"]), "qualifyingRows": 0})
        package = json.loads((root / "package.json").read_text())
        if package["version"] != pin["version"]: raise RuntimeError("donor version mismatch")
        donors.append({"id": donor_id, "repository": pin["repository"], "commit": pin["commit"], "tree": pin["tree"],
                       "version": pin["version"], "license": pin["license"], "licenseSha256": sha((root / "LICENSE").read_bytes()),
                       "lockPath": pin["lock"], "lockSha256": sha((root / pin["lock"]).read_bytes()),
                       "packageExports": package["exports"], "postSuiteTrackedChanges": ["llms.txt"] if dirty else [],
                       "static": static, "runtimeCases": events, "unobservedDeclarations": unobserved, "suite": suite})
        def obligation(source_kind, source_id):
            dispositions.append({"id": f"{donor_id}::{source_kind}::{source_id}", "donorId": donor_id,
                                 "kind": "extension", "sourceKind": source_kind, "sourceId": source_id,
                                 "disposition": "unresolved", "workflowState": "audit", "rationale": None,
                                 "proof": None, "targetTest": None, "successorGoal": None})
        for export in static["exports"]:
            obligation("publicExport", export["id"])
            for member in export["members"]:
                origin = member["origin"]
                obligation("exportedMember", f"{export['id']}::{member['name']}::{origin['line']}:{origin['column']}")
        for event in events: obligation("testBehavior", event["id"])
        for row in unobserved: obligation("unobservedDeclaration", row["declarationId"])
    if len({row["id"] for row in dispositions}) != len(dispositions): raise RuntimeError("duplicate disposition obligation")
    report = {"schemaVersion": "citation-typescript-donors/v1", "scope": "Pinned donor export/test evidence and independent target disposition accounting.",
              "exporterSha256": sha(Path(__file__).read_bytes()), "staticExporterSha256": sha(static_tool.read_bytes()),
              "donors": donors, "dispositions": dispositions}
    def render(record, depth=0):
        indent = "  " * depth
        fields = []
        for key, value in record.items():
            if key == "donors":
                rendered = "[\n" + ",\n".join("  " * (depth + 2) + render(row, depth + 2) for row in value) + "\n" + "  " * (depth + 1) + "]"
            elif key == "static":
                rendered = render(value, depth + 1)
            elif isinstance(value, list):
                rendered = "[\n" + ",\n".join("  " * (depth + 2) + canonical(row) for row in value) + "\n" + "  " * (depth + 1) + "]"
            else:
                rendered = canonical(value)
            fields.append("  " * (depth + 1) + canonical(key) + ": " + rendered)
        return "{\n" + ",\n".join(fields) + "\n" + indent + "}"
    text = render(report) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text)
    print(f"donors={len(donors)}; publicExports={sum(len(row['static']['exports']) for row in donors)}; runtimeCases={sum(len(row['runtimeCases']) for row in donors)}; obligations={len(dispositions)}")


if __name__ == "__main__": main()
