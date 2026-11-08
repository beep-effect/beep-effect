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
    parser.add_argument(
        "--nested-entrypoint-inventory", type=Path,
        help="Current source-bound native catalogue join, required to preserve script-only coverage",
    )
    parser.add_argument(
        "--prior-review-archive", type=Path,
        help="Fresh sibling JSON archive required before replacing reviewed population evidence",
    )
    args = parser.parse_args()
    recipe = Path(__file__).resolve()
    root = recipe.parents[3]
    census_path = args.census.resolve()
    census = json.loads(census_path.read_text(encoding="utf-8"))
    for source in census["sources"]:
        path = (root / source["path"]).resolve()
        if not path.is_relative_to(root) or not path.is_file() or digest(path) != source["sha256"]:
            raise SystemExit(f"Census source changed or escaped the checkout: {source['path']}")

    output = recipe.parent / "current-population.json"
    if output.is_symlink() or (output.exists() and not output.is_file()):
        raise SystemExit("The current population must be a regular non-symlink file.")
    existing_bytes = output.read_bytes() if output.is_file() else None
    existing = json.loads(existing_bytes) if existing_bytes is not None else {}
    nested = None
    nested_path = None
    if existing.get("nestedEntrypointInventory") and args.nested_entrypoint_inventory is None:
        raise SystemExit("Script-only inventory exists; supply its current replacement. Nothing was replaced.")
    if args.nested_entrypoint_inventory is not None:
        nested_path = args.nested_entrypoint_inventory.absolute()
        if nested_path.is_symlink() or nested_path.parent.resolve() != recipe.parent or not nested_path.is_file():
            raise SystemExit("The nested inventory must be a regular non-symlink sibling file.")
        nested_path = nested_path.parent.resolve() / nested_path.name
        nested = json.loads(nested_path.read_text(encoding="utf-8"))
        scripts = {
            workspace["name"] + "#" + task: command
            for workspace in census["workspaces"] for task, command in workspace["scripts"].items()
        }
        nodes = {node["id"]: node for node in census["nodes"]}
        workspaces = {workspace["name"]: workspace for workspace in census["workspaces"]}
        if len(nodes) != len(census["nodes"]) or len(workspaces) != len(census["workspaces"]):
            raise SystemExit("Census node and workspace identities must be unique.")
        if any(node.get("command") != scripts.get(task) for task, node in nodes.items()):
            raise SystemExit("Configured commands disagree with the manifest scripts.")
        callers = defaultdict(list)
        for task, node in nodes.items():
            command = node.get("command")
            if command and command.startswith("bun run ") and command[8:] in workspaces[node["workspace"]]["scripts"]:
                callers[node["workspace"] + "#" + command[8:]].append(task)
        extras = sorted(set(scripts) - set(nodes))
        expected_rows = [{
            "entrypoint": task,
            "literalCommandSha256": hashlib.sha256(scripts[task].encode()).hexdigest(),
            "directConfiguredCallers": sorted(callers[task]),
        } for task in extras]
        executable = sum(bool(node.get("command")) for node in nodes.values())
        expected_counts = {
            "workspaces": len(workspaces), "configuredGraphNodes": len(nodes),
            "configuredExecutable": executable, "graphOnly": len(nodes) - executable,
            "catalogue": len(set(nodes) | set(scripts)), "scripts": len(scripts),
            "scriptOnly": len(extras),
            "withLiteralCaller": sum(bool(row["directConfiguredCallers"]) for row in expected_rows),
            "withoutLiteralCaller": sum(not row["directConfiguredCallers"] for row in expected_rows),
            "literalCallerEdges": sum(len(row["directConfiguredCallers"]) for row in expected_rows),
        }
        observation = nested.get("nativeObservation", {})
        observations = observation.get("observations", [])
        if (
            nested.get("schemaVersion") != "cache-adoption-native-catalogue-join/v1"
            or nested.get("sourceBaseRevision") != census["revision"]
            or nested.get("censusSha256") != digest(census_path)
            or nested.get("sourceBindingsVerified") != len(census["sources"])
            or nested.get("counts") != expected_counts or nested.get("rows") != expected_rows
            or nested.get("taskBodiesExecuted") != 0 or nested.get("qualificationGranted") is not False
            or observation.get("sourceHead") != census["revision"]
            or observation.get("censusSha256") != digest(census_path)
            or observation.get("sourceBindingsVerifiedBeforeAndAfter") != len(census["sources"])
            or observation.get("taskBodiesExecuted") != 0
            or observation.get("taskQualificationGranted") is not False
            or observation.get("featureAcceptanceGranted") is not False
            or len(observations) != 2 or {item.get("channel") for item in observations} != {"stable", "canary"}
            or any(item.get("tasks") != expected_counts["catalogue"]
                   or item.get("executableTasks") != len(scripts)
                   or item.get("packages") != len(workspaces) for item in observations)
        ):
            raise SystemExit("The nested inventory does not completely match this census. Nothing was replaced.")
    reviewed = {
        row["computation"]: row for row in existing.get("rows", [])
        if row.get("currentSemanticReview", "pending") != "pending" or row.get("finalDisposition") is not None
    }
    archive = None
    retained_review = existing.get("provenance", {}).get("priorReviewedPopulation")
    retained_review_ids = set(reviewed)
    history_ref = retained_review
    visited = set()
    while history_ref:
        history = (root / history_ref["path"]).resolve()
        if history in visited or len(visited) >= 32:
            raise SystemExit("The retained population history contains a cycle or exceeds its bound.")
        visited.add(history)
        if not history.is_relative_to(root) or not history.is_file() or digest(history) != history_ref["sha256"]:
            raise SystemExit("The retained prior-reviewed population changed or escaped the checkout.")
        historical = json.loads(history.read_text(encoding="utf-8"))
        retained_review_ids.update(
            row["computation"] for row in historical["rows"]
            if row.get("currentSemanticReview", "pending") != "pending" or row.get("finalDisposition") is not None
        )
        history_ref = historical.get("provenance", {}).get("priorReviewedPopulation")
    if reviewed:
        if args.prior_review_archive is None:
            raise SystemExit("Reviewed population exists; --prior-review-archive is required. Nothing was replaced.")
        archive = args.prior_review_archive.absolute()
        if archive.parent.resolve() != recipe.parent or archive == output or archive.is_symlink():
            raise SystemExit("The prior-review archive must be a distinct sibling file, never a symlink.")
        archive = archive.parent.resolve() / archive.name
        if archive.exists():
            raise SystemExit("The prior-review archive already exists. Nothing was replaced.")
        retained_review = {
            "path": str(archive.relative_to(root)),
            "sha256": hashlib.sha256(existing_bytes).hexdigest(),
            "sourceBaseRevision": existing["sourceBaseRevision"],
            "reviewedDispositionCount": len(reviewed),
            "authority": "Historical source reviews retained byte-identically; current applicability is not inferred.",
        }

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
            "priorReviewedDispositionsRetained": len(retained_review_ids),
            "priorReviewedComputationsStillPresent": len(retained_review_ids.intersection(row["computation"] for row in rows)),
        },
        "provenance": {
            "censusSha256": digest(census_path),
            "priorPopulationSha256": digest(prior_path),
            "qualificationLedgerSha256": digest(ledger_path),
            "recipeSha256": digest(recipe),
            "censusSources": census["sources"],
            "priorReviewedPopulation": retained_review,
        },
        "unresolvedCensusObligations": census["unresolved"],
        "configurations": configurations,
        "rows": rows,
        "limits": [
            "Retained semantic profiles are leads, not renewed runtime review.",
            "Retained qualification records apply only to their original computation/layer/profile/epoch.",
            "A configured cache flag grants no qualification or hosted-proof authority.",
            "Every current semantic review and final disposition remains open until separately proven.",
            "The retained prior-reviewed population preserves earlier decisions, including computations no longer present; this refresh does not revalidate them.",
        ],
    }
    if nested is not None:
        counts = nested["counts"]
        report["counts"].update({
            "declaredExecutableScriptEntrypoints": counts["scripts"],
            "configuredGraphExecutableComputations": counts["configuredExecutable"],
            "additionalScriptOnlyEntrypoints": counts["scriptOnly"],
            "queryCatalogueNodes": counts["catalogue"],
        })
        report["nestedEntrypointInventory"] = {
            "path": str(nested_path.relative_to(recipe.parent.parent)),
            "sha256": digest(nested_path),
            "scriptOnlyEntrypoints": counts["scriptOnly"],
            "withLiteralConfiguredCaller": counts["withLiteralCaller"],
            "withoutLiteralConfiguredCaller": counts["withoutLiteralCaller"],
            "reviewState": "pending",
            "countsDoNotMeanDistinctSemanticComputations": True,
        }
        report["limits"].append(
            "The linked script-only inventory preserves complete manifest coverage; literal callers do not prove execution or equivalence."
        )
    if archive is not None:
        with archive.open("xb") as handle:
            handle.write(existing_bytes)
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report["counts"], indent=2))


if __name__ == "__main__":
    main()
