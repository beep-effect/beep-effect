#!/usr/bin/env python3
"""Consume Cache's census without changing qualification policy or prior evidence."""

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("census", type=Path)
    args = parser.parse_args()
    recipe = Path(__file__).resolve()
    root = recipe.parents[3]
    census_path = args.census.resolve()
    census = json.loads(census_path.read_text(encoding="utf-8"))
    for source in census["sources"]:
        path = (root / source["path"]).resolve()
        if not path.is_relative_to(root) or not path.is_file() or digest(path) != source["sha256"]:
            raise SystemExit(f"Census source changed or escaped the checkout: {source['path']}")

    prior_path = root / "goals/turborepo-task-qualification/research/adoption/population.json"
    prior = json.loads(prior_path.read_text(encoding="utf-8"))
    prior_rows = {row["computation"]: row for row in prior["rows"]}
    ledger_path = root / "standards/cache-qualification.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    records = defaultdict(list)
    for entry in ledger["entries"]:
        records[entry["key"]["computation"]].append({
            "key": entry["key"], "state": entry["status"]["state"],
        })

    rows = []
    configurations = {}
    for node in sorted(census["nodes"], key=lambda item: item["id"]):
        command = node.get("command")
        if not isinstance(command, str) or not command.strip():
            continue
        previous = prior_rows.get(node["id"])
        same_command = previous is not None and previous.get("command") == command
        config = node["configuration"]
        config_id = hashlib.sha256(json.dumps(config, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        configurations[config_id] = config
        rows.append({
            "computation": node["id"],
            "workspace": node["workspace"],
            "task": node["task"],
            "commandDigest": node["commandDigest"],
            "configurationId": config_id,
            "dependencies": node["dependencies"],
            "observedInputCount": node["inputCount"],
            "observedInputsDigest": node["inputsDigest"],
            "priorCommandTextUnchanged": same_command,
            "priorSemanticProfileIdsForReview": previous.get("semanticProfileIds", []) if same_command else [],
            "retainedQualificationRecords": records[node["id"]],
            "currentSemanticReview": "pending",
            "finalDisposition": None,
            "owner": "turborepo-quality-cache-adoption",
        })

    states = Counter(record["state"] for row in rows for record in row["retainedQualificationRecords"])
    report = {
        "schemaVersion": "cache-adoption-population-refresh/v1",
        "authority": "Inventory and review queue only. Cache remains the qualification state writer.",
        "sourceBaseRevision": census["revision"],
        "turboVersion": census["turboVersion"],
        "counts": {
            "workspaces": len(census["workspaces"]),
            "rootScripts": len(census["rootScripts"]),
            "configuredGraphNodes": len(census["nodes"]),
            "executableComputations": len(rows),
            "graphOnlyNodes": len(census["nodes"]) - len(rows),
            "cacheEnabledExecutableComputations": sum(configurations[row["configurationId"]]["cache"] for row in rows),
            "newSinceRetainedHandoff": sum(row["computation"] not in prior_rows for row in rows),
            "retainedCommandTextUnchanged": sum(row["priorCommandTextUnchanged"] for row in rows),
            "retainedQualificationRecordStates": dict(states),
        },
        "provenance": {
            "censusSha256": digest(census_path),
            "priorPopulationSha256": digest(prior_path),
            "qualificationLedgerSha256": digest(ledger_path),
            "recipeSha256": digest(recipe),
            "censusSources": census["sources"],
        },
        "unresolvedCensusObligations": census["unresolved"],
        "configurations": configurations,
        "rows": rows,
        "limits": [
            "Retained semantic profiles are leads, not renewed runtime review.",
            "Retained qualification records apply only to their original computation/layer/profile/epoch.",
            "A configured cache flag grants no qualification or hosted-proof authority.",
            "Every current semantic review and final disposition remains open until separately proven.",
        ],
    }
    output = recipe.parent / "current-population.json"
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report["counts"], indent=2))


if __name__ == "__main__":
    main()
